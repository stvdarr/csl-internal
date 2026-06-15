import { Op } from "sequelize";
import {
  sequelize,
  TaxTrack,
  HistoryLog,
  User,
  Client,
  TaskAssignment,
} from "../models/index.js";
import { normalizeTaskStatus, validateStateTransition } from "../constants/taskStatus.js";
import { ROLES } from "../constants/roles.js";
import { findOrCreateClientByName } from "./clientService.js";
import { logActivity, logActivityBatch } from "./activityService.js";
import { normalizeName } from "../utils/normalize.js";
import { runInTransaction } from "../utils/transactionHelper.js";
import logger from "../utils/logger.js";
import { emitTaxUpdated } from "./socketEventBus.js";

const taxInclude = [
  { model: User, attributes: ["id", "name", "email"] },
  { model: Client, attributes: ["id", "name", "taxIdNumber", "status"] },
];

export const listTaxes = async ({
  assigneeId,
  status,
  clientId,
  taxType,
  page = 1,
  limit = 20,
  currentUser,
} = {}) => {
  const where = {};
  
  // Enforce access control at service layer
  if (currentUser.role !== ROLES.ADMIN) {
    where.pic_id = currentUser.id;
  } else if (assigneeId) {
    // Only admin can filter by assigneeId
    where.pic_id = assigneeId;
  }
  
  if (status) where.status = normalizeTaskStatus(status);
  if (clientId) where.clientId = clientId;
  if (taxType) where.taxType = taxType;

  const offset = (page - 1) * limit;

  const { count, rows } = await TaxTrack.findAndCountAll({
    where,
    include: taxInclude,
    order: [["updatedAt", "DESC"]],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  return {
    total: count,
    page: parseInt(page),
    totalPages: Math.ceil(count / limit),
    data: rows,
  };
};
export const resetAllTaxData = async (actor) => {
  return runInTransaction(async (transaction) => {
    const [taxCount, assignmentCount] = await Promise.all([
      TaxTrack.count({ transaction }),
      TaskAssignment.count({ transaction }),
    ]);

    await logActivity({
      actionType: "DELETED_ALL_TAX_DATA",
      actorId: actor.id,
      targetType: "TAX",
      targetId: 0,
      metadata: { taxCount, assignmentCount },
      legacy: { recordType: "TAX", recordId: 0 },
      transaction,
    });

    await TaskAssignment.destroy({ where: {}, transaction });
    await TaxTrack.destroy({ where: {}, transaction });

    return { taxCount, assignmentCount };
  });
};

export const createTaxTask = async (payload, actor) => {
  return runInTransaction(async (transaction) => {
    const client = await findOrCreateClientByName(
      payload.clientName,
      transaction,
    );
    const picId =
      actor.role === ROLES.ADMIN && payload.pic_id ? payload.pic_id : actor.id;
    const assignee = await User.findByPk(picId, {
      attributes: ["id"],
      transaction,
    });

    if (!assignee) {
      const error = new Error("PIC tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const tax = await TaxTrack.create(
      {
        clientId: client.id,
        clientName: client.name,
        taxType: payload.taxType,
        period: payload.period,
        amount: payload.amount ?? 0,
        status: normalizeTaskStatus(payload.status || "NOT_STARTED"),
        pic_id: picId,
      },
      { transaction },
    );

    await TaskAssignment.create(
      {
        targetType: "TAX",
        targetId: tax.id,
        fromUserId: null,
        toUserId: picId,
        assignedById: actor.id,
        reason: "Initial assignment",
      },
      { transaction },
    );

    await logActivity({
      actionType: "CREATED_TASK",
      actorId: actor.id,
      targetType: "TAX",
      targetId: tax.id,
      metadata: {
        clientId: client.id,
        clientName: client.name,
        taxType: tax.taxType,
        period: tax.period,
      },
      legacy: { recordType: "TAX", recordId: tax.id, newStatus: tax.status },
      transaction,
    });

    await logActivity({
      actionType: "ASSIGNED_TASK",
      actorId: actor.id,
      targetType: "TAX",
      targetId: tax.id,
      metadata: { fromUserId: null, toUserId: picId },
      transaction,
    });

    return TaxTrack.findByPk(tax.id, { include: taxInclude, transaction });
  });
};

export const updateTaxTaskStatus = async (id, newStatus, actor) => {
  return runInTransaction(async (transaction) => {
    const normalizedStatus = normalizeTaskStatus(newStatus);
    
    // WS2: Implementation of Row-Level Locking (FOR UPDATE)
    const tax = await TaxTrack.findByPk(id, { 
      transaction,
      lock: transaction.LOCK.UPDATE 
    });

    if (!tax) {
      const error = new Error("Data pajak tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    // Task 2: Cek Kepemilikan (Ownership Check)
    // Hanya penanggung jawab (PIC) atau Admin yang boleh mengubah status
    if (tax.pic_id !== actor.id && actor.role !== ROLES.ADMIN) {
      const error = new Error("Akses Ditolak. Anda bukan penanggung jawab (PIC) untuk data pajak ini.");
      error.statusCode = 403;
      throw error;
    }

    const oldStatus = tax.status;
    if (oldStatus === normalizedStatus) {
      const error = new Error("Status sudah sama, tidak ada perubahan");
      error.statusCode = 400;
      throw error;
    }

    // Task 5: Validasi State Machine transisi
    validateStateTransition(oldStatus, normalizedStatus, actor.role);

    tax.status = normalizedStatus;
    await tax.save({ transaction });

    await logActivity({
      actionType: "UPDATED_STATUS",
      actorId: actor.id,
      targetType: "TAX",
      targetId: tax.id,
      metadata: { oldStatus, newStatus: normalizedStatus },
      legacy: {
        recordType: "TAX",
        recordId: tax.id,
        oldStatus,
        newStatus: normalizedStatus,
      },
      transaction,
    });

    const updatedTax = await TaxTrack.findByPk(tax.id, { include: taxInclude, transaction });
    // Emit WebSocket event via SocketEventBus
    emitTaxUpdated(updatedTax);
    return updatedTax;
  });
};

export const assignTaxTask = async (id, toUserId, actor, reason) => {
  return runInTransaction(async (transaction) => {
    // WS2: Implementation of Row-Level Locking (FOR UPDATE)
    const [tax, assignee] = await Promise.all([
      TaxTrack.findByPk(id, { 
        transaction,
        lock: transaction.LOCK.UPDATE 
      }),
      User.findByPk(toUserId, {
        attributes: ["id", "name", "email"],
        transaction,
      }),
    ]);

    if (!tax) {
      const error = new Error("Data pajak tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    if (!assignee) {
      const error = new Error("User tujuan assignment tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const fromUserId = tax.pic_id || null;
    tax.pic_id = assignee.id;
    await tax.save({ transaction });

    await TaskAssignment.create(
      {
        targetType: "TAX",
        targetId: tax.id,
        fromUserId,
        toUserId: assignee.id,
        assignedById: actor.id,
        reason,
      },
      { transaction },
    );

    await logActivity({
      actionType: "ASSIGNED_TASK",
      actorId: actor.id,
      targetType: "TAX",
      targetId: tax.id,
      metadata: { fromUserId, toUserId: assignee.id, reason },
      transaction,
    });

    const updatedTax = await TaxTrack.findByPk(tax.id, { include: taxInclude, transaction });
    emitTaxUpdated(updatedTax);
    return updatedTax;
  });
};

export const assignTaxTasksByClient = async (clientId, toUserId, actor, reason) => {
  return runInTransaction(async (transaction) => {
    // 1. Validasi User Tujuan
    const assignee = await User.findByPk(toUserId, {
      attributes: ["id", "name", "email"],
      transaction,
    });

    if (!assignee) {
      const error = new Error("User tujuan assignment tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    // 2. Ambil semua TaxTrack untuk klien ini yang need updating
    const taxesToUpdate = await TaxTrack.findAll({
      where: { 
        clientId,
        pic_id: { [Op.ne]: assignee.id }
      },
      attributes: ["id", "pic_id"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (taxesToUpdate.length === 0) {
      return { count: 0 };
    }

    // 3. Bulk update all TaxTrack records in one query
    await TaxTrack.update(
      { pic_id: assignee.id },
      {
        where: { id: taxesToUpdate.map(t => t.id) },
        transaction
      }
    );

    // 4. Prepare assignments and logs
    const assignments = taxesToUpdate.map(tax => ({
      targetType: "TAX",
      targetId: tax.id,
      fromUserId: tax.pic_id,
      toUserId: assignee.id,
      assignedById: actor.id,
      reason,
    }));

    const logs = taxesToUpdate.map(tax => ({
      actionType: "ASSIGNED_TASK",
      actorId: actor.id,
      targetType: "TAX",
      targetId: tax.id,
      metadata: { fromUserId: tax.pic_id, toUserId: assignee.id, reason },
    }));

    // 5. Bulk create assignments and logs
    await TaskAssignment.bulkCreate(assignments, { transaction });
    await logActivityBatch(logs, transaction);

    return { count: taxesToUpdate.length };
  });
};

const buildUserLookup = async (transaction) => {
  const users = await User.findAll({
    attributes: ["id", "name", "email"],
    transaction,
  });

  return users.reduce((lookup, user) => {
    // Standardize to consistent key format for comparison
    lookup[normalizeName(user.name)] = user;
    return lookup;
  }, {});
};

const buildClientLookup = async (transaction) => {
  const clients = await Client.findAll({
    attributes: ["id", "name", "normalizedName"],
    transaction,
  });

  return clients.reduce((lookup, client) => {
    lookup[client.normalizedName] = client;
    return lookup;
  }, {});
};

export const importTaxWorkbookRows = async (rows, actor) => {
  const BATCH_SIZE = 100;
  const results = {
    total: rows.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    errors: [],
  };

  let userByName = {};
  let clientByName = {};

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const chunkStats = {
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      errors: [],
    };
    const rowFailed = new Set();

    try {
      await runInTransaction(async (transaction) => {
        Object.assign(userByName, await buildUserLookup(transaction));
        Object.assign(clientByName, await buildClientLookup(transaction));

        const historyLogs = [];

        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j];
          try {
            const cleanName = String(row.clientName || "")
              .trim()
              .replace(/\s+/g, " ");
            const normalizedClientKey = normalizeName(cleanName);

            let client = clientByName[normalizedClientKey];
            if (!client) {
              client = await findOrCreateClientByName(row.clientName, transaction);
              clientByName[normalizedClientKey] = client;
            }

            const normalizedPicName = row.picName
              ? normalizeName(row.picName)
              : null;
            const picId = normalizedPicName
              ? userByName[normalizedPicName]?.id || null
              : null;

            const existing = await TaxTrack.findOne({
              where: {
                clientId: client.id,
                taxType: row.taxType,
                period: row.period,
              },
              include: [{ model: User, attributes: ["id", "name"] }],
              transaction,
            });

            if (!existing) {
              const tax = await TaxTrack.create(
                {
                  clientId: client.id,
                  clientName: client.name,
                  taxType: row.taxType,
                  period: row.period,
                  status: row.status || "NOT_STARTED",
                  pic_id: picId,
                  amount: row.amount || 0,
                },
                { transaction },
              );

              historyLogs.push({
                actionType: "CREATED_TASK",
                actorId: actor.id,
                targetType: "TAX",
                targetId: tax.id,
                metadata: row,
                legacy: {
                  recordType: "TAX",
                  recordId: tax.id,
                  newStatus: tax.status,
                },
              });
              chunkStats.created++;
            } else {
              const hasStatusChange = existing.status !== row.status;
              const hasPicChange = existing.pic_id !== picId;
              const hasAmountChange =
                Number(existing.amount) !== Number(row.amount || 0);

              if (hasStatusChange || hasPicChange || hasAmountChange) {
                const oldStatus = existing.status;
                const oldPicId = existing.pic_id;

                await existing.update(
                  {
                    status: row.status,
                    pic_id: picId,
                    amount: row.amount || 0,
                  },
                  { transaction },
                );

                if (hasPicChange) {
                  await TaskAssignment.create(
                    {
                      targetType: "TAX",
                      targetId: existing.id,
                      fromUserId: oldPicId,
                      toUserId: picId,
                      assignedById: actor.id,
                      reason: "Updated from workbook import",
                    },
                    { transaction },
                  );
                }

                historyLogs.push({
                  actionType: "UPDATED_FROM_IMPORT",
                  actorId: actor.id,
                  targetType: "TAX",
                  targetId: existing.id,
                  metadata: { ...row, oldStatus },
                  legacy: {
                    recordType: "TAX",
                    recordId: existing.id,
                    oldStatus,
                    newStatus: row.status,
                  },
                });
                chunkStats.updated++;
              } else {
                chunkStats.unchanged++;
              }
            }
          } catch (error) {
            rowFailed.add(j);
            chunkStats.failed++;
            chunkStats.errors.push({
              row: i + j,
              clientName: row.clientName,
              error: error.message,
            });
            logger.error({ error, rowIndex: i + j, row }, "Failed to import row");
          }
        }

        if (historyLogs.length > 0) {
          await logActivityBatch(historyLogs, transaction);
        }
      });

      results.created += chunkStats.created;
      results.updated += chunkStats.updated;
      results.unchanged += chunkStats.unchanged;
      results.failed += chunkStats.failed;
      results.errors.push(...chunkStats.errors);
    } catch (err) {
      for (let j = 0; j < chunk.length; j++) {
        if (rowFailed.has(j)) continue;
        const row = chunk[j];
        chunkStats.failed++;
        chunkStats.errors.push({
          row: i + j,
          clientName: row.clientName,
          error: err.message,
        });
      }
      results.failed += chunkStats.failed;
      results.errors.push(...chunkStats.errors);
      logger.error({ err, batch: i / BATCH_SIZE }, "Batch transaction failed");
    }
  }

  // Map results for legacy frontend compatibility
  return {
    ...results,
    success: results.created + results.updated + results.unchanged,
  };
};

export const getWorkloadSummary = async () => {
  // Use aggregation to avoid fetching all records
  const counts = await TaxTrack.findAll({
    attributes: [
      "pic_id",
      "status",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    where: {
      status: { [Op.ne]: "COMPLETED" },
    },
    group: ["pic_id", "status"],
    raw: true,
  });

  const users = await User.findAll({
    attributes: ["id", "name", "email", "role"],
    where: { role: ROLES.STAFF },
  });

  return {
    data: users.map((user) => {
      const userCounts = counts.filter((c) => c.pic_id === user.id);
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        openTaskCount: userCounts.reduce(
          (acc, curr) => acc + parseInt(curr.count),
          0,
        ),
        blockedTaskCount: userCounts
          .filter((c) => c.status === "BLOCKED")
          .reduce((acc, curr) => acc + parseInt(curr.count), 0),
        waitingTaskCount: userCounts
          .filter((c) => c.status.startsWith("WAITING"))
          .reduce((acc, curr) => acc + parseInt(curr.count), 0),
      };
    }),
  };
};

export const getClientTaxOverview = async ({
  page = 1,
  limit = 20,
  search = "",
  currentUser,
} = {}) => {
  const where = {};
  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  const offset = (page - 1) * limit;

  const taxWhere = {};
  // For non-admin users, filter tax tracks to only their assigned ones
  if (currentUser.role !== ROLES.ADMIN) {
    taxWhere.pic_id = currentUser.id;
  }

  const { count, rows } = await Client.findAndCountAll({
    where,
    include: [
      {
        model: TaxTrack,
        where: Object.keys(taxWhere).length > 0 ? taxWhere : undefined,
        include: [{ model: User, attributes: ["id", "name", "email"] }],
        required: false,
      },
    ],
    order: [["name", "ASC"]],
    limit: parseInt(limit),
    offset: parseInt(offset),
    distinct: true, // Required for correct count with joins
  });

  return {
    total: count,
    page: parseInt(page),
    totalPages: Math.ceil(count / limit),
    data: rows.map((client) => ({
      id: client.id,
      name: client.name,
      taxIdNumber: client.taxIdNumber,
      status: client.status,
      openTaskCount: client.TaxTracks.filter(
        (task) => task.status !== "COMPLETED",
      ).length,
      totalTaskCount: client.TaxTracks.length,
      tasks: client.TaxTracks, // Kembalikan array tasks agar frontend matrix bisa render per cell
    })),
  };
};


