import { Op } from "sequelize";
import { ToDo, User, TaskAssignment } from "../models/index.js";
import { logActivity } from "./activityService.js";
import { runInTransaction } from "../utils/transactionHelper.js";
import { ROLES } from "../constants/roles.js";
import { validateTodoTransition } from "../constants/todoStatus.js";
import { emitTodoUpdated, emitWorkloadUpdated } from "./socketEventBus.js";

/**
 * List todos with pagination and filtering
 */
export const listTodos = async ({ page = 1, limit = 20, status, assigneeId, currentUser } = {}) => {
  const where = {};
  
  // Enforce access control at service layer
  if (currentUser.role !== ROLES.ADMIN) {
    where.pic_id = currentUser.id;
  } else if (assigneeId) {
    where.pic_id = assigneeId;
  }
  
  if (status) where.status = status;

  const offset = (page - 1) * limit;

  const { count, rows } = await ToDo.findAndCountAll({
    where,
    include: [{ model: User, attributes: ["id", "name", "email"] }],
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

/**
 * Create a new todo task
 */
export const createTodoTask = async (payload, actor) => {
  return runInTransaction(async (transaction) => {
    // Only admin can set pic_id, others default to themselves
    const pic_id = actor.role === ROLES.ADMIN && payload.pic_id ? payload.pic_id : actor.id;
    const assignee = await User.findByPk(pic_id, {
      attributes: ["id"],
      transaction,
    });

    if (!assignee) {
      const error = new Error("PIC tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const todo = await ToDo.create(
      {
        ...payload,
        pic_id,
      },
      { transaction },
    );

    await logActivity({
      actionType: "CREATED_TASK",
      actorId: actor.id,
      targetType: "TODO",
      targetId: todo.id,
      metadata: {
        ...payload,
        ...(todo.status === "APPROVED" ? { picIdAtCompletion: todo.pic_id } : {})
      },
      legacy: { recordType: "TODO", recordId: todo.id, newStatus: todo.status },
      transaction,
    });

    emitTodoUpdated(todo);

    return todo;
  });
};

/**
 * Update todo status with transaction and locking
 */
export const updateTodoTaskStatus = async (id, newStatus, actor) => {
  return runInTransaction(async (transaction) => {
    // WS2: Row-level locking
    const todo = await ToDo.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!todo) {
      const error = new Error("Tugas tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    // Ownership check
    if (todo.pic_id !== actor.id && actor.role !== ROLES.ADMIN) {
      const error = new Error(
        "Akses Ditolak. Anda bukan penanggung jawab untuk tugas ini.",
      );
      error.statusCode = 403;
      throw error;
    }

    const oldStatus = todo.status;
    if (oldStatus === newStatus) {
      const error = new Error("Status tidak ada perubahan");
      error.statusCode = 400;
      throw error;
    }

    validateTodoTransition(oldStatus, newStatus, actor.role);

    todo.status = newStatus;
    await todo.save({ transaction });

    await logActivity({
      actionType: "UPDATED_STATUS",
      actorId: actor.id,
      targetType: "TODO",
      targetId: todo.id,
      metadata: { 
        oldStatus, 
        newStatus,
        ...(newStatus === "APPROVED" ? { picIdAtCompletion: todo.pic_id } : {})
      },
      legacy: {
        recordType: "TODO",
        recordId: todo.id,
        oldStatus,
        newStatus,
      },
      transaction,
    });

    emitTodoUpdated(todo);
    if (newStatus === "APPROVED" || oldStatus === "APPROVED") {
      emitWorkloadUpdated(todo.pic_id);
    }

    return todo;
  });
};

/**
 * Assign todo task to a specific user (admin only)
 */
export const assignTodoTask = async (id, toUserId, actor, reason) => {
  return runInTransaction(async (transaction) => {
    const [todo, assignee] = await Promise.all([
      ToDo.findByPk(id, { 
        transaction, lock: transaction.LOCK.UPDATE }),
      User.findByPk(toUserId, {
        attributes: ["id", "name", "email"],
        transaction,
      }),
    ]);

    if (!todo) {
      const error = new Error("Tugas tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    if (!assignee) {
      const error = new Error("User tujuan assignment tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const fromUserId = todo.pic_id;
    if (fromUserId === toUserId) {
      return { count: 0 };
    }

    todo.pic_id = toUserId;
    await todo.save({ transaction });

    await TaskAssignment.create(
      {
        targetType: "TODO",
        targetId: todo.id,
        fromUserId,
        toUserId,
        assignedById: actor.id,
        reason: reason || "Assign via admin",
      },
      { transaction },
    );

    await logActivity({
      actionType: "ASSIGNED_TASK",
      actorId: actor.id,
      targetType: "TODO",
      targetId: todo.id,
      metadata: { fromUserId, toUserId, reason },
      transaction,
    });

    emitTodoUpdated(todo, { notifyUserIds: [fromUserId] });
    emitWorkloadUpdated(fromUserId);
    emitWorkloadUpdated(toUserId);

    return todo;
  });
};

/**
 * List all staff users
 */
export const listAllStaff = async () => {
  return User.findAll({
    where: {
      [Op.or]: [{ role: ROLES.ADMIN }, { role: ROLES.STAFF }],
    },
    attributes: ["id", "name", "email", "role"],
    order: [["name", "ASC"]],
  });
};
