import { ROLES } from "./roles.js";

export const TODO_STATUSES = ["TODO", "ONGOING", "DONE", "APPROVED"];

export const TODO_VALID_TRANSITIONS = {
  TODO: ["ONGOING"],
  ONGOING: ["DONE", "TODO"],
  DONE: ["ONGOING"],
  APPROVED: [],
};

export const validateTodoTransition = (currentStatus, newStatus, role = ROLES.STAFF) => {
  if (currentStatus === newStatus) return true;

  if (newStatus === "APPROVED" && role !== ROLES.ADMIN) {
    const error = new Error("Hanya Admin yang dapat menyetujui tugas");
    error.statusCode = 403;
    throw error;
  }

  if (role === ROLES.ADMIN) {
    if (newStatus === "TODO") return true;
    if (newStatus === "APPROVED" && currentStatus === "DONE") return true;
  }

  const allowed = TODO_VALID_TRANSITIONS[currentStatus];
  if (!allowed?.includes(newStatus)) {
    const error = new Error(
      `Transisi status tidak valid: ${currentStatus} → ${newStatus}`,
    );
    error.statusCode = 400;
    throw error;
  }

  return true;
};
