import { HistoryLog, User } from "../models/index.js";

export const logActivity = async ({
  actionType,
  actorId,
  targetType,
  targetId,
  metadata = {},
  legacy = {},
  transaction,
}) => {
  return HistoryLog.create(
    {
      actionType,
      actorId,
      targetType,
      targetId,
      recordType: legacy.recordType || targetType,
      recordId: legacy.recordId || targetId,
      oldStatus: legacy.oldStatus || null,
      newStatus: legacy.newStatus || null,
      metadata,
    },
    { transaction },
  );
};

export const logActivityBatch = async (logs, transaction) => {
  const formattedLogs = logs.map((log) => ({
    actionType: log.actionType,
    actorId: log.actorId,
    targetType: log.targetType,
    targetId: log.targetId,
    recordType: log.legacy?.recordType || log.targetType,
    recordId: log.legacy?.recordId || log.targetId,
    oldStatus: log.legacy?.oldStatus || null,
    newStatus: log.legacy?.newStatus || null,
    metadata: log.metadata || {},
  }));

  return HistoryLog.bulkCreate(formattedLogs, { transaction });
};

export const listActivity = async ({ page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;

  const { count, rows } = await HistoryLog.findAndCountAll({
    include: [{ model: User, attributes: ["id", "name", "email"] }],
    order: [["createdAt", "DESC"]],
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
