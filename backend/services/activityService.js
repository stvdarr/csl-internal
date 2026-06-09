import { HistoryLog } from "../models/index.js";

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
