import { calculateDueDate } from "../services/taxReminderService.js";

const testCases = [
  { taxType: "PPN", period: "JANUARI 2026" },
  { taxType: "PPH 21", period: "DESEMBER 2025" },
  { taxType: "1771 BADAN", period: "TAHUNAN 2025" },
  { taxType: "1770 OP", period: "TAHUNAN 2025" },
];

console.log("--- Testing calculateDueDate ---");
testCases.forEach(tc => {
  const date = calculateDueDate(tc.taxType, tc.period);
  console.log(`[${tc.taxType}] ${tc.period} => Due: ${date ? date.toISOString() : 'NULL'}`);
});
console.log("--- Done ---");
