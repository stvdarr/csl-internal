export const TASK_STATUSES = [
  { value: "NOT_STARTED", label: "Belum mulai", hotkey: "d" },
  { value: "IN_PROGRESS", label: "Dikerjakan", hotkey: "p" },
  { value: "WAITING_REVIEW", label: "Review", hotkey: "r" },
  { value: "WAITING_SIGNATURE", label: "Tunggu TTD", hotkey: "t" },
  { value: "WAITING_CLIENT", label: "Tunggu Klien", hotkey: "k" },
  { value: "READY_TO_FILE", label: "Siap Lapor", hotkey: "s" },
  { value: "FILED", label: "Dilapor", hotkey: "l" },
  { value: "PAID", label: "Dibayar", hotkey: "b" },
  { value: "COMPLETED", label: "Selesai", hotkey: "o" },
  { value: "BLOCKED", label: "Blocked", hotkey: "x" },
];

export const TASK_STATUS_VALUES = [
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

export const STATUS_LABELS = TASK_STATUSES.reduce((labels, status) => {
  labels[status.value] = status.label;
  return labels;
}, {});

export const STATUS_HOTKEYS = TASK_STATUSES.reduce((hotkeys, status) => {
  hotkeys[status.hotkey] = status.value;
  return hotkeys;
}, {});

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
  COMPLETED: [],
};
