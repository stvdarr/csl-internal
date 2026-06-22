
import { Op } from "sequelize";
import {
  sequelize,
  TaxObligation,
  TaxPeriod,
  HistoryLog,
  User,
  Client,
  TaskAssignment,
} from "../models/index.js";
import { normalizeTaskStatus, validateStateTransition } from "../constants/taskStatus.js";
import { resolveFrequency, normalizePeriodLabel } from "../constants/taxFrequency.js";
import { ROLES } from "../constants/roles.js";
import { findOrCreateClientByName } from "./clientService.js";
import { logActivity, logActivityBatch } from "./activityService.js";
import { normalizeName } from "../utils/normalize.js";
import { runInTransaction } from "../utils/transactionHelper.js";
import logger from "../utils/logger.js";
import { emitTaxUpdated } from "./socketEventBus.js";

// --- HELPERS ---
const obligationInclude = [
  { model: User, attributes: ["id", "name", "email"] },
  { model: Client, attributes: ["id", "name", "taxIdNumber", "status"] },
];

const periodInclude = [
  {
    model: TaxObligation,
    include: obligationInclude,
  },
];

/**
 * Find or create tax obligation for a client and tax type
 */
export const findOrCreateObligation = async ({ clientId, taxType, pic_id, transaction }) => {
  const frequency = resolveFrequency(taxType);
  const [obligation, created] = await TaxObligation.findOrCreate({
    where: { clientId, taxType },
    defaults: {
      clientId,
      taxType,
      frequency,
      pic_id: pic_id || null,
      status: "ACTIVE",
    },
    transaction,
  });
  return { obligation, created };
};

// --- TAX OBLIGATION FUNCTIONS ---
export const listTaxObligations = async ({ taxType, clientId, currentUser }) => {
  const where = {};

  if (currentUser.role !== ROLES.ADMIN) {
    where.pic_id = currentUser.id;
  }

  if (taxType) where.taxType = taxType;
  if (clientId) where.clientId = clientId;

  const obligations = await TaxObligation.findAll({
    where,
    include: obligationInclude,
    order: [["updatedAt", "DESC"]],
  });

  return obligations;
};

export const createTaxObligation = async ({ clientName, taxType, pic_id }, actor) => {
  return runInTransaction(async (transaction) => {
    const client = await findOrCreateClientByName(clientName, transaction);
    const frequency = resolveFrequency(taxType);

    // Check if obligation already exists
    const existingObligation = await TaxObligation.findOne({
      where: { clientId: client.id, taxType },
      transaction,
    });

    if (existingObligation) {
      const error = new Error("Obligasi pajak untuk klien dan jenis pajak ini sudah ada");
      error.statusCode = 409;
      throw error;
    }

    const obligation = await TaxObligation.create(
      {
        clientId: client.id,
        taxType,
        frequency,
        pic_id: pic_id || null,
        status: "ACTIVE",
      },
      { transaction },
    );

    if (pic_id) {
      await TaskAssignment.create(
        {
          targetType: "TAX",
          targetId: obligation.id,
          fromUserId: null,
          toUserId: pic_id,
          assignedById: actor.id,
          reason: "Initial assignment for tax obligation",
        },
        { transaction },
      );
    }

    await logActivity({
      actionType: "CREATED_OBLIGATION",
      actorId: actor.id,
      targetType: "TAX",
      targetId: obligation.id,
      metadata: {
        clientId: client.id,
        clientName: client.name,
        taxType,
        frequency,
      },
      transaction,
    });

    return TaxObligation.findByPk(obligation.id, {
      include: obligationInclude,
      transaction,
    });
  });
};

export const assignTaxObligation = async (obligationId, toUserId, actor, reason) => {
  return runInTransaction(async (transaction) => {
    const obligation = await TaxObligation.findByPk(obligationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
      include: obligationInclude,
    });

    if (!obligation) {
      const error = new Error("Obligasi pajak tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const assignee = await User.findByPk(toUserId, {
      attributes: ["id", "name", "email"],
      transaction,
    });

    if (!assignee) {
      const error = new Error("User tujuan tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const fromUserId = obligation.pic_id;
    obligation.pic_id = toUserId;
    await obligation.save({ transaction });

    await TaskAssignment.create(
      {
        targetType: "TAX",
        targetId: obligation.id,
        fromUserId,
        toUserId,
        assignedById: actor.id,
        reason: reason || "Assignment update",
      },
      { transaction },
    );

    await logActivity({
      actionType: "ASSIGNED_OBLIGATION",
      actorId: actor.id,
      targetType: "TAX",
      targetId: obligation.id,
      metadata: { fromUserId, toUserId, reason },
      transaction,
    });

    // Emit update for all periods under this obligation
    const periods = await TaxPeriod.findAll({
      where: { obligationId },
      transaction,
      include: periodInclude,
    });

    for (const period of periods) {
      emitTaxUpdated(period);
    }

    return TaxObligation.findByPk(obligation.id, {
      include: obligationInclude,
      transaction,
    });
  });
};

// --- TAX PERIOD FUNCTIONS ---
export const listTaxes = async ({
  assigneeId,
  status,
  clientId,
  taxType,
  page = 1,
  limit = 20,
  currentUser,
}) => {
  const wherePeriod = {};
  const whereObligation = {};

  // Enforce access control at service level
  if (currentUser.role !== ROLES.ADMIN) {
    whereObligation.pic_id = currentUser.id;
  } else if (assigneeId) {
    // Only admin can filter by assigneeId
    whereObligation.pic_id = assigneeId;
  }

  if (status) wherePeriod.status = normalizeTaskStatus(status);
  if (taxType) whereObligation.taxType = taxType;
  if (clientId) whereObligation.clientId = clientId;

  const offset = (page - 1) * limit;

  const { count, rows } = await TaxPeriod.findAndCountAll({
    where: wherePeriod,
    include: [
      {
        model: TaxObligation,
        where: whereObligation,
        include: obligationInclude,
      },
    ],
    order: [["updatedAt", "DESC"]],
    limit: parseInt(limit),
    offset: parseInt(offset),
    distinct: true,
  });

  return {
    total: count,
    page: parseInt(page),
    totalPages: Math.ceil(count / limit),
    data: rows,
  };
};

export const createTaxTask = async (payload, actor) => {
  return runInTransaction(async (transaction) => {
    const client = await findOrCreateClientByName(
      payload.clientName,
      transaction,
    );

    // Find or create obligation
    const { obligation } = await findOrCreateObligation({
      clientId: client.id,
      taxType: payload.taxType,
      pic_id: payload.pic_id,
      transaction,
    });

    const normalizedPeriod = normalizePeriodLabel(
      payload.period,
      obligation.frequency,
    );

    // Create or update period
    const [period, created] = await TaxPeriod.findOrCreate({
      where: {
        obligationId: obligation.id,
        period: normalizedPeriod,
      },
      defaults: {
        obligationId: obligation.id,
        period: normalizedPeriod,
        amount: payload.amount ?? 0,
        status: normalizeTaskStatus(payload.status || "NOT_STARTED"),
      },
      transaction,
    });

    if (!created) {
      period.amount = payload.amount ?? 0;
      period.status = normalizeTaskStatus(payload.status || "NOT_STARTED");
      await period.save({ transaction });
    }

    await logActivity({
      actionType: created ? "CREATED_TASK" : "UPDATED_TASK",
      actorId: actor.id,
      targetType: "TAX",
      targetId: period.id,
      metadata: {
        clientId: client.id,
        clientName: client.name,
        taxType: obligation.taxType,
        period: normalizedPeriod,
      },
      transaction,
    });

    return TaxPeriod.findByPk(period.id, {
      include: periodInclude,
      transaction,
    });
  });
};

export const updateTaxTaskStatus = async (periodId, newStatus, actor) => {
  return runInTransaction(async (transaction) => {
    const normalizedStatus = normalizeTaskStatus(newStatus);

    const period = await TaxPeriod.findByPk(periodId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
      include: periodInclude,
    });

    if (!period) {
      const error = new Error("Periode pajak tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    // Check ownership
    if (
      period.TaxObligation.pic_id !== actor.id &&
      actor.role !== ROLES.ADMIN
    ) {
      const error = new Error(
        "Akses Ditolak. Anda bukan penanggung jawab untuk pajak ini.",
      );
      error.statusCode = 403;
      throw error;
    }

    const oldStatus = period.status;
    if (oldStatus === normalizedStatus) {
      const error = new Error("Status sudah sama, tidak ada perubahan");
      error.statusCode = 400;
      throw error;
    }

    // Validate state transition
    validateStateTransition(oldStatus, normalizedStatus, actor.role);

    period.status = normalizedStatus;
    await period.save({ transaction });

    await logActivity({
      actionType: "UPDATED_STATUS",
      actorId: actor.id,
      targetType: "TAX",
      targetId: period.id,
      metadata: { oldStatus, newStatus: normalizedStatus },
      transaction,
    });

    const updatedPeriod = await TaxPeriod.findByPk(period.id, {
      include: periodInclude,
      transaction,
    });

    emitTaxUpdated(updatedPeriod);
    return updatedPeriod;
  });
};

// --- WORKBOOK IMPORT ---
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
  let obligationByClientTaxType = {};

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
        // Preload users
        const users = await User.findAll({
          attributes: ["id", "name", "email"],
          transaction,
        });
        userByName = users.reduce((lookup, user) => {
          lookup[normalizeName(user.name)] = user;
          return lookup;
        }, {});

        // Preload clients
        const clients = await Client.findAll({
          attributes: ["id", "name", "normalizedName"],
          transaction,
        });
        clientByName = clients.reduce((lookup, client) => {
          lookup[client.normalizedName] = client;
          return lookup;
        }, {});

        // Preload obligations
        const obligations = await TaxObligation.findAll({
          include: [Client],
          transaction,
        });
        obligationByClientTaxType = {};
        for (const obl of obligations) {
          const key = `${obl.clientId}-${obl.taxType}`;
          obligationByClientTaxType[key] = obl;
        }

        const historyLogs = [];

        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j];
          try {
            const cleanName = String(row.clientName || "").trim().replace(/\s+/g, " ");
            const normalizedClientKey = normalizeName(cleanName);

            let client = clientByName[normalizedClientKey];
            if (!client) {
              client = await findOrCreateClientByName(row.clientName, transaction);
              clientByName[normalizedClientKey] = client;
            }

            const normalizedPicName = row.picName
              ? normalizeName(row.picName)
              : null;
            const pic_id = normalizedPicName
              ? userByName[normalizedPicName]?.id || null
              : null;

            const obligationKey = `${client.id}-${row.taxType}`;
            let obligation = obligationByClientTaxType[obligationKey];

            if (!obligation) {
              const createdObligation = await TaxObligation.create(
                {
                  clientId: client.id,
                  taxType: row.taxType,
                  frequency: resolveFrequency(row.taxType),
                  pic_id,
                  status: "ACTIVE",
                },
                { transaction },
              );
              obligation = createdObligation;
              obligationByClientTaxType[obligationKey] = obligation;
            } else if (pic_id && !obligation.pic_id) {
              // If obligation didn't have a PIC, set it from first row that has one
              obligation.pic_id = pic_id;
              await obligation.save({ transaction });
            }

            const normalizedPeriod = normalizePeriodLabel(
              row.period,
              obligation.frequency,
            );

            const existingPeriod = await TaxPeriod.findOne({
              where: {
                obligationId: obligation.id,
                period: normalizedPeriod,
              },
              transaction,
            });

            if (!existingPeriod) {
              await TaxPeriod.create(
                {
                  obligationId: obligation.id,
                  period: normalizedPeriod,
                  amount: row.amount || 0,
                  status: row.status || "NOT_STARTED",
                },
                { transaction },
              );
              chunkStats.created++;
            } else {
              const hasStatusChange = existingPeriod.status !== row.status;
              const hasAmountChange = Number(existingPeriod.amount) !== Number(row.amount || 0);

              if (hasStatusChange || hasAmountChange) {
                existingPeriod.status = row.status;
                existingPeriod.amount = row.amount || 0;
                await existingPeriod.save({ transaction });
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

  return {
    ...results,
    success: results.created + results.updated + results.unchanged,
  };
};

// --- RESET ALL TAX DATA ---
export const resetAllTaxData = async (actor) => {
  return runInTransaction(async (transaction) => {
    const [obligationCount, periodCount, assignmentCount] = await Promise.all([
      TaxObligation.count({ transaction }),
      TaxPeriod.count({ transaction }),
      TaskAssignment.count({ where: { targetType: "TAX" }, transaction }),
    ]);

    await logActivity({
      actionType: "DELETED_ALL_TAX_DATA",
      actorId: actor.id,
      targetType: "TAX",
      targetId: 0,
      metadata: { obligationCount, periodCount, assignmentCount },
      transaction,
    });

    // Delete periods first because of foreign key constraint
    await TaxPeriod.destroy({ where: {}, transaction });
    await TaxObligation.destroy({ where: {}, transaction });
    await TaskAssignment.destroy({ where: { targetType: "TAX" }, transaction });

    return { obligationCount, periodCount, assignmentCount };
  });
};

// --- WORKLOAD SUMMARY ---
export const getWorkloadSummary = async () => {
  // Aggregate by obligation's pic_id
  const obligations = await TaxObligation.findAll({
    include: [
      {
        model: TaxPeriod,
        where: {
          status: { [Op.ne]: "COMPLETED" },
        },
        required: false,
      },
      {
        model: User,
        attributes: ["id", "name", "email", "role"],
        where: { role: ROLES.STAFF },
        required: true,
      },
    ],
  });

  // Group by user
  const userWorkload = {};

  for (const obl of obligations) {
    if (!userWorkload[obl.pic_id]) {
      userWorkload[obl.pic_id] = {
        user: obl.User,
        openTaskCount: 0,
        blockedTaskCount: 0,
        waitingTaskCount: 0,
      };
    }

    for (const period of obl.TaxPeriods || []) {
      userWorkload[obl.pic_id].openTaskCount++;
      if (period.status === "BLOCKED") {
        userWorkload[obl.pic_id].blockedTaskCount++;
      } else if (period.status.startsWith("WAITING")) {
        userWorkload[obl.pic_id].waitingTaskCount++;
      }
    }
  }

  return { data: Object.values(userWorkload) };
};

// --- CLIENT TAX OVERVIEW ---
export const getClientTaxOverview = async ({
  page = 1,
  limit = 20,
  search = "",
  currentUser,
}) => {
  const whereClient = {};
  const whereObligation = {};

  if (search) {
    whereClient.name = { [Op.like]: `%${search}%` };
  }

  if (currentUser.role !== ROLES.ADMIN) {
    whereObligation.pic_id = currentUser.id;
  }

  const offset = (page - 1) * limit;

  const { count, rows } = await Client.findAndCountAll({
    where: whereClient,
    include: [
      {
        model: TaxObligation,
        where: Object.keys(whereObligation).length > 0 ? whereObligation : undefined,
        required: false,
        include: [
          {
            model: TaxPeriod,
          },
          {
            model: User,
            attributes: ["id", "name", "email"],
          },
        ],
      },
    ],
    order: [["name", "ASC"]],
    limit: parseInt(limit),
    offset: parseInt(offset),
    distinct: true,
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
      obligations: client.TaxObligations || [],
    })),
  };
};
