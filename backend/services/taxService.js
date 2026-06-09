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
import { findOrCreateClientByName } from "./clientService.js";
import { logActivity } from "./activityService.js";
import { normalizeName } from "../utils/normalize.js";

const taxInclude = [
  { model: User, attributes: ["id", "name", "email"] },
  { model: Client, attributes: ["id", "name", "taxIdNumber", "status"] },
];

export const listTaxes = async ({ assigneeId, status, clientId } = {}) => {
  const where = {};
  if (assigneeId) where.pic_id = assigneeId;
  if (status) where.status = normalizeTaskStatus(status);
  if (clientId) where.clientId = clientId;

  return TaxTrack.findAll({
    where,
    include: taxInclude,
    order: [["updatedAt", "DESC"]],
  });
};

export const createTaxTask = async (payload, actor) => {
  return sequelize.transaction(async (transaction) => {
    const client = await findOrCreateClientByName(
      payload.clientName,
      transaction,
    );
    const picId =
      actor.role === "Admin" && payload.pic_id ? payload.pic_id : actor.id;
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
  return sequelize.transaction(async (transaction) => {
    const normalizedStatus = normalizeTaskStatus(newStatus);
    const tax = await TaxTrack.findByPk(id, { transaction });

    if (!tax) {
      const error = new Error("Data pajak tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    // Task 2: Cek Kepemilikan (Ownership Check)
    // Hanya penanggung jawab (PIC) atau Admin yang boleh mengubah status
    if (tax.pic_id !== actor.id && actor.role !== "Admin") {
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

    return TaxTrack.findByPk(tax.id, { include: taxInclude, transaction });
  });
};

export const assignTaxTask = async (id, toUserId, actor, reason) => {
  return sequelize.transaction(async (transaction) => {
    const [tax, assignee] = await Promise.all([
      TaxTrack.findByPk(id, { transaction }),
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

    return TaxTrack.findByPk(tax.id, { include: taxInclude, transaction });
  });
};

export const bulkCreateTaxTasks = async (rows, uploadedTaxType, actor) => {
  return await sequelize.transaction(async (transaction) => {
    // 1. Resolve Unique Clients (Batch)
    const clientNames = [...new Set(rows.map(row => row["NAMA WP"] || row.clientName || "Tanpa Nama"))];
    const clientMap = {};
    for (const name of clientNames) {
      const client = await findOrCreateClientByName(name, transaction);
      clientMap[normalizeName(name)] = client;
    }

    const picId = actor.id;
    const assignmentsToInsert = [];
    const logsToInsert = [];
    const createdTaxes = [];

    // 2. Sequential Creates (Only 1 query per row instead of 6)
    for (const row of rows) {
      const clientName = row["NAMA WP"] || row.clientName || "Tanpa Nama";
      const client = clientMap[normalizeName(clientName)];
      const period = row["MASA"] || row.period || "Tidak Diketahui";

      const tax = await TaxTrack.create(
        {
          clientId: client.id,
          clientName: client.name,
          taxType: uploadedTaxType || "UNIFIKASI",
          period,
          amount: 0,
          status: "NOT_STARTED",
          pic_id: picId,
        },
        { transaction }
      );
      createdTaxes.push(tax);

      assignmentsToInsert.push({
        targetType: "TAX",
        targetId: tax.id,
        fromUserId: null,
        toUserId: picId,
        assignedById: actor.id,
        reason: "Initial assignment"
      });

      logsToInsert.push({
        recordType: "TAX",
        recordId: tax.id,
        actionType: "CREATED_TASK",
        actorId: actor.id,
        newStatus: tax.status,
        metadata: JSON.stringify({
          clientId: client.id,
          clientName: client.name,
          taxType: tax.taxType,
          period: tax.period,
        })
      });

      logsToInsert.push({
        recordType: "TAX",
        recordId: tax.id,
        actionType: "ASSIGNED_TASK",
        actorId: actor.id,
        metadata: JSON.stringify({ fromUserId: null, toUserId: picId })
      });
    }

    // 3. Bulk Insert Audit Logs & Assignments
    if (assignmentsToInsert.length > 0) {
      await TaskAssignment.bulkCreate(assignmentsToInsert, { transaction });
    }
    if (logsToInsert.length > 0) {
      await HistoryLog.bulkCreate(logsToInsert, { transaction });
    }

    return createdTaxes;
  });
};

const buildUserLookup = async (transaction) => {
  const users = await User.findAll({
    attributes: ["id", "name", "email"],
    transaction,
  });

  return users.reduce((lookup, user) => {
    lookup[normalizeName(user.name)] = user;
    return lookup;
  }, {});
};

export const importTaxWorkbookRows = async (rows, actor) => {
  return sequelize.transaction(async (transaction) => {
    const userByName = await buildUserLookup(transaction);

    // --- PERBAIKAN FILTER DUPLIKAT: Normalisasi dulu baru saring lewat Set ---
    const seenNormalizedNames = new Set();
    const uniqueClientsToProcess = [];

    for (const row of rows) {
      const originalName = row.clientName;
      if (!originalName) continue;

      const cleanName = String(originalName).trim().replace(/\s+/g, " ");
      const normName = normalizeName(cleanName);

      // Jika belum pernah diproses, masukkan ke daftar eksekusi
      if (normName && !seenNormalizedNames.has(normName)) {
        seenNormalizedNames.add(normName);
        uniqueClientsToProcess.push({ cleanName, normName });
      }
    }

    const clientMap = {};
    for (const item of uniqueClientsToProcess) {
      const [client] = await Client.findOrCreate({
        where: { normalizedName: item.normName },
        defaults: {
          name: item.cleanName,
          normalizedName: item.normName,
        },
        transaction,
      });
      clientMap[item.normName] = client;
    }

    const result = {
      created: 0,
      updated: 0,
      unchanged: 0,
      assignedByFallback: 0,
      rows: [],
    };

    // CHUNKED PROCESSING
    const CHUNK_SIZE = 1000;
    
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);

      // BULK FETCH EXISTING
      const orConditions = chunk.map(r => {
        const norm = normalizeName(String(r.clientName || "").trim());
        const client = clientMap[norm];
        if (!client) return null;
        return { clientId: client.id, taxType: r.taxType, period: r.period };
      }).filter(Boolean);

      let existingTaxes = [];
      if (orConditions.length > 0) {
        existingTaxes = await TaxTrack.findAll({
          where: { [Op.or]: orConditions },
          transaction
        });
      }

      const existingTaxMap = new Map();
      existingTaxes.forEach(t => existingTaxMap.set(`${t.clientId}-${t.taxType}-${t.period}`, t));

      const taxesToCreate = [];
      const taxesToUpdate = [];
      const assignmentsToInsert = [];
      const logsToInsert = [];
      
      // Array pendukung untuk memetakan row payload mentah dengan record
      const creationPayloadsMap = new Map();

      for (const row of chunk) {
        if (!row.clientName) continue;
        const normName = normalizeName(String(row.clientName).trim().replace(/\s+/g, " "));
        const client = clientMap[normName];
        if (!client) continue;

        const normalizedStatus = normalizeTaskStatus(row.status || "NOT_STARTED");
        const matchedPic = row.picName ? userByName[normalizeName(row.picName)] : null;
        const picId = matchedPic?.id || actor.id;

        if (!matchedPic && row.picName) result.assignedByFallback += 1;

        const key = `${client.id}-${row.taxType}-${row.period}`;
        const existing = existingTaxMap.get(key);

        if (!existing) {
          const payload = {
            clientId: client.id,
            clientName: client.name,
            taxType: row.taxType,
            period: row.period,
            amount: row.amount ?? 0,
            status: normalizedStatus,
            pic_id: picId,
          };
          taxesToCreate.push(payload);
          creationPayloadsMap.set(key, { row, picId, matchedPic, normalizedStatus, client });
          continue;
        }

        const changes = {};
        if (existing.status !== normalizedStatus) changes.status = normalizedStatus;
        if (Number(existing.amount || 0) !== Number(row.amount || 0)) changes.amount = row.amount ?? 0;
        if (existing.pic_id !== picId) changes.pic_id = picId;
        if (existing.clientName !== client.name) changes.clientName = client.name;

        if (Object.keys(changes).length === 0) {
          result.unchanged += 1;
          result.rows.push({ id: existing.id, action: "unchanged" });
          continue;
        }

        // BATCH UPDATE PAYLOAD
        const oldStatus = existing.status;
        const oldPicId = existing.pic_id || null;
        
        taxesToUpdate.push({
          id: existing.id, // Mandatory for updateOnDuplicate logic if available
          clientId: existing.clientId,
          taxType: existing.taxType,
          period: existing.period,
          status: changes.status !== undefined ? changes.status : existing.status,
          amount: changes.amount !== undefined ? changes.amount : existing.amount,
          pic_id: changes.pic_id !== undefined ? changes.pic_id : existing.pic_id,
          clientName: changes.clientName !== undefined ? changes.clientName : existing.clientName,
        });

        if (oldPicId !== picId) {
          assignmentsToInsert.push({
            targetType: "TAX",
            targetId: existing.id,
            fromUserId: oldPicId,
            toUserId: picId,
            assignedById: actor.id,
            reason: "Workbook import reassignment",
          });
        }

        logsToInsert.push({
          actionType: "UPDATED_FROM_WORKBOOK_IMPORT",
          actorId: actor.id,
          targetType: "TAX",
          targetId: existing.id,
          metadata: JSON.stringify({
            changes,
            sourceSheet: row.sourceSheet,
            sourceRow: row.sourceRow,
            sourceColumn: row.sourceColumn,
            picName: row.picName || null,
            matchedPicId: matchedPic?.id || null,
          }),
          legacy: JSON.stringify({
            recordType: "TAX",
            recordId: existing.id,
            oldStatus,
            newStatus: changes.status || existing.status,
          })
        });

        result.updated += 1;
        result.rows.push({ id: existing.id, action: "updated" });
      }

      // EXECUTE BATCH UPDATES
      if (taxesToUpdate.length > 0) {
        await TaxTrack.bulkCreate(taxesToUpdate, {
          updateOnDuplicate: ["status", "amount", "pic_id", "clientName"],
          transaction
        });
      }

      // EXECUTE BULK INSERTS
      if (taxesToCreate.length > 0) {
        await TaxTrack.bulkCreate(taxesToCreate, { transaction });
        
        // Fetch newly created IDs
        const newOrConditions = taxesToCreate.map(t => ({
          clientId: t.clientId, taxType: t.taxType, period: t.period
        }));
        
        const newTaxes = await TaxTrack.findAll({
          where: { [Op.or]: newOrConditions },
          transaction
        });

        newTaxes.forEach(tax => {
          const key = `${tax.clientId}-${tax.taxType}-${tax.period}`;
          const rawPayload = creationPayloadsMap.get(key);
          if (!rawPayload) return;

          const { row, picId, matchedPic, normalizedStatus, client } = rawPayload;

          assignmentsToInsert.push({
            targetType: "TAX",
            targetId: tax.id,
            fromUserId: null,
            toUserId: picId,
            assignedById: actor.id,
            reason: "Workbook import",
          });

          logsToInsert.push({
            actionType: "IMPORTED_TASK",
            actorId: actor.id,
            targetType: "TAX",
            targetId: tax.id,
            metadata: JSON.stringify({
              clientId: client.id,
              clientName: client.name,
              taxType: row.taxType,
              period: row.period,
              sourceSheet: row.sourceSheet,
              sourceRow: row.sourceRow,
              sourceColumn: row.sourceColumn,
              picName: row.picName || null,
              matchedPicId: matchedPic?.id || null,
            }),
            legacy: JSON.stringify({
              recordType: "TAX",
              recordId: tax.id,
              newStatus: normalizedStatus,
            })
          });

          result.created += 1;
          result.rows.push({ id: tax.id, action: "created" });
        });
      }

      // EXECUTE BULK AUDIT LOGS & ASSIGNMENTS
      if (assignmentsToInsert.length > 0) {
        await TaskAssignment.bulkCreate(assignmentsToInsert, { transaction });
      }
      if (logsToInsert.length > 0) {
        await HistoryLog.bulkCreate(logsToInsert, { transaction });
      }
    }

    return result;
  });
};

export const getWorkloadSummary = async () => {
  const users = await User.findAll({
    attributes: ["id", "name", "email", "role"],
    include: [
      {
        model: TaxTrack,
        attributes: ["id", "status"],
        required: false,
        where: {
          status: {
            [Op.ne]: "COMPLETED",
          },
        },
      },
    ],
  });

  return users.map((user) => {
    const tasks = user.TaxTracks || [];
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      openTaskCount: tasks.length,
      blockedTaskCount: tasks.filter((task) => task.status === "BLOCKED")
        .length,
      waitingTaskCount: tasks.filter((task) =>
        task.status.startsWith("WAITING"),
      ).length,
    };
  });
};

export const getClientTaxOverview = async () => {
  const clients = await Client.findAll({
    include: [
      {
        model: TaxTrack,
        include: [{ model: User, attributes: ["id", "name", "email"] }],
      },
    ],
    order: [["name", "ASC"]],
  });

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    taxIdNumber: client.taxIdNumber,
    status: client.status,
    openTaskCount: client.TaxTracks.filter(
      (task) => task.status !== "COMPLETED",
    ).length,
    tasks: client.TaxTracks,
  }));
};

export const listActivity = async () => {
  return HistoryLog.findAll({
    include: [{ model: User, attributes: ["id", "name", "email"] }],
    order: [["createdAt", "DESC"]],
  });
};
