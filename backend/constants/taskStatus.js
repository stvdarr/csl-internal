export const TASK_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "WAITING_REVIEW",
  "WAITING_SIGNATURE",
  "WAITING_CLIENT",
  "READY_TO_FILE",
  "FILED",
  "PAID",
  "COMPLETED",
  "BLOCKED",
];

export const LEGACY_STATUS_MAP = {
  DIBUAT: "NOT_STARTED",
  REVIEW: "WAITING_REVIEW",
  TTD: "WAITING_SIGNATURE",
  DIKIRIM: "WAITING_CLIENT",
  BAYAR: "PAID",
  DIBAYAR: "PAID",
  LAPOR: "FILED",
  DILAPOR: "FILED",
  OK: "COMPLETED",
};

export const normalizeTaskStatus = (status) => {
  const normalized = LEGACY_STATUS_MAP[status] || status;
  if (!TASK_STATUSES.includes(normalized)) {
    const error = new Error(`Unsupported task status: ${status}`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

// Workflow Engine State Machine
export const VALID_TRANSITIONS = {
  NOT_STARTED: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["WAITING_REVIEW", "WAITING_CLIENT", "WAITING_SIGNATURE", "READY_TO_FILE", "COMPLETED", "BLOCKED"],
  WAITING_REVIEW: ["IN_PROGRESS", "WAITING_SIGNATURE", "WAITING_CLIENT", "BLOCKED"],
  WAITING_SIGNATURE: ["WAITING_CLIENT", "READY_TO_FILE", "IN_PROGRESS", "BLOCKED"],
  WAITING_CLIENT: ["IN_PROGRESS", "READY_TO_FILE", "WAITING_SIGNATURE", "BLOCKED"],
  READY_TO_FILE: ["FILED", "WAITING_CLIENT", "IN_PROGRESS", "BLOCKED"],
  FILED: ["PAID", "COMPLETED", "BLOCKED", "IN_PROGRESS"],
  PAID: ["FILED", "COMPLETED", "BLOCKED", "IN_PROGRESS"],
  BLOCKED: ["NOT_STARTED", "IN_PROGRESS", "WAITING_REVIEW", "WAITING_CLIENT", "WAITING_SIGNATURE", "READY_TO_FILE", "FILED", "PAID"],
  COMPLETED: [], // Terminal state, no exit unless restored by admin
};

export const validateStateTransition = (currentStatus, newStatus, role = "User") => {
  // Admins might bypass some rules, but standard flow should strictly follow state machine
  if (currentStatus === newStatus) return true;
  if (role === "Admin" && newStatus === "NOT_STARTED") return true; // Admin reset
  
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed?.includes(newStatus)) {
    const error = new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    error.statusCode = 400;
    throw error;
  }
  return true;
};

