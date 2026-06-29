import { Op, Sequelize } from "sequelize";
import {
  User,
  TaxObligation,
  TaxPeriod,
  ToDo,
  TaskAssignment,
  HistoryLog,
  Client,
} from "../models/index.js";
import { ROLES } from "../constants/roles.js";

export const classifyCapacity = (activeCount) => {
  if (activeCount <= 4) return "Low";
  if (activeCount <= 10) return "Normal";
  if (activeCount <= 15) return "High";
  return "Overloaded";
};

export const getCurrentWorkload = async ({ targetUserId } = {}) => {
  const wherePic = targetUserId ? { pic_id: targetUserId } : {};

  // Fetch active TaxPeriods
  const activeTaxes = await TaxPeriod.findAll({
    where: {
      status: { [Op.ne]: "COMPLETED" },
    },
    include: [
      {
        model: TaxObligation,
        where: wherePic,
        include: [{ model: User, attributes: ["id", "name", "email", "role"] }],
      },
    ],
  });

  // Fetch active ToDos
  const activeTodos = await ToDo.findAll({
    where: {
      status: { [Op.ne]: "APPROVED" },
      ...wherePic,
    },
    include: [{ model: User, attributes: ["id", "name", "email", "role"] }],
  });

  const userMap = new Map();

  // Helper to ensure user entry
  const getOrCreateUserEntry = (pic_id, userObj) => {
    const key = pic_id || "unassigned";
    if (!userMap.has(key)) {
      userMap.set(key, {
        user: userObj || null,
        taxCount: 0,
        todoCount: 0,
        totalActive: 0,
        capacity: "Low",
      });
    }
    return userMap.get(key);
  };

  // Process taxes
  for (const period of activeTaxes) {
    const obligation = period.TaxObligation;
    const entry = getOrCreateUserEntry(obligation.pic_id, obligation.User);
    entry.taxCount++;
    entry.totalActive++;
  }

  // Process todos
  for (const todo of activeTodos) {
    const entry = getOrCreateUserEntry(todo.pic_id, todo.User);
    entry.todoCount++;
    entry.totalActive++;
  }

  // Also ensure we list all Staff and Admin even if they have 0 workload (if targetUserId is not specified)
  if (!targetUserId) {
    const allEligibleUsers = await User.findAll({
      where: {
        role: { [Op.in]: [ROLES.ADMIN, ROLES.STAFF] },
      },
      attributes: ["id", "name", "email", "role"],
    });

    for (const user of allEligibleUsers) {
      getOrCreateUserEntry(user.id, user);
    }
  }

  const results = Array.from(userMap.values()).map((entry) => ({
    ...entry,
    capacity: classifyCapacity(entry.totalActive),
  }));

  // Sort: Unassigned first, then by name
  results.sort((a, b) => {
    if (!a.user) return -1;
    if (!b.user) return 1;
    return a.user.name.localeCompare(b.user.name);
  });

  return { data: results };
};

export const getWorkloadBreakdown = async ({ userId }) => {
  if (!userId) {
    throw new Error("userId is required for breakdown");
  }

  // Fetch Taxes
  const activeTaxes = await TaxPeriod.findAll({
    where: { status: { [Op.ne]: "COMPLETED" } },
    include: [
      {
        model: TaxObligation,
        where: { pic_id: userId },
        include: [{ model: Client, attributes: ["id", "name"] }],
      },
    ],
    order: [["updatedAt", "DESC"]],
  });

  // Fetch ToDos
  const activeTodos = await ToDo.findAll({
    where: {
      status: { [Op.ne]: "APPROVED" },
      pic_id: userId,
    },
    order: [["updatedAt", "DESC"]],
  });

  return {
    data: {
      taxes: activeTaxes.map((t) => ({
        id: t.id,
        period: t.period,
        status: t.status,
        taxType: t.TaxObligation.taxType,
        clientName: t.TaxObligation.Client.name,
        updatedAt: t.updatedAt,
      })),
      todos: activeTodos.map((t) => ({
        id: t.id,
        jobType: t.jobType,
        clientName: t.clientName,
        status: t.status,
        deadline: t.deadline,
        updatedAt: t.updatedAt,
      })),
    },
  };
};

export const getHistoricalPerformance = async ({ targetUserId, dateFrom, dateTo }) => {
  const whereLog = {
    actionType: "UPDATED_STATUS", // We log completion on status update
  };

  if (dateFrom || dateTo) {
    whereLog.createdAt = {};
    if (dateFrom) whereLog.createdAt[Op.gte] = new Date(dateFrom);
    if (dateTo) whereLog.createdAt[Op.lte] = new Date(dateTo);
  }

  // Get terminal status logs for TAX
  const taxLogs = await HistoryLog.findAll({
    where: {
      ...whereLog,
      targetType: "TAX",
      "metadata.newStatus": "COMPLETED",
    },
    order: [["createdAt", "DESC"]],
  });

  // Get terminal status logs for TODO
  const todoLogs = await HistoryLog.findAll({
    where: {
      ...whereLog,
      targetType: "TODO",
      "metadata.newStatus": "APPROVED",
    },
    order: [["createdAt", "DESC"]],
  });

  // Combine and process
  const allLogs = [...taxLogs, ...todoLogs];
  const userCreditMap = new Map();

  for (const log of allLogs) {
    let picId = log.metadata?.picIdAtCompletion;

    if (!picId) {
      // Fallback logic for legacy data: correlated subquery to TaskAssignment
      const assignment = await TaskAssignment.findOne({
        where: {
          targetType: log.targetType,
          targetId: log.targetId,
          createdAt: { [Op.lte]: log.createdAt },
        },
        order: [["createdAt", "DESC"]],
      });
      picId = assignment ? assignment.toUserId : null;
    }

    if (picId) {
      if (targetUserId && picId !== targetUserId) {
        continue; // filter by target user if requested
      }

      if (!userCreditMap.has(picId)) {
        userCreditMap.set(picId, {
          taxCompleted: 0,
          todoApproved: 0,
          totalCompleted: 0,
        });
      }

      const credit = userCreditMap.get(picId);
      if (log.targetType === "TAX") credit.taxCompleted++;
      if (log.targetType === "TODO") credit.todoApproved++;
      credit.totalCompleted++;
    }
  }

  // Enrich with user info
  const result = [];
  for (const [picId, stats] of userCreditMap.entries()) {
    const user = await User.findByPk(picId, { attributes: ["id", "name", "email", "role"] });
    if (user) {
      result.push({
        user,
        ...stats,
      });
    }
  }

  result.sort((a, b) => b.totalCompleted - a.totalCompleted);

  return { data: result };
};
