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

export const STATUS_LABELS = TASK_STATUSES.reduce((labels, status) => {
  labels[status.value] = status.label;
  return labels;
}, {});

export const STATUS_HOTKEYS = TASK_STATUSES.reduce((hotkeys, status) => {
  hotkeys[status.hotkey] = status.value;
  return hotkeys;
}, {});
