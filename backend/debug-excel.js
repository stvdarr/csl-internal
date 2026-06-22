/**
 * debug-excel.js
 *
 * Diagnostic-only script. Does NOT touch the database.
 * Run from inside the backend/ folder:
 *
 *   node debug-excel.js "D:/User/Documents/Code/CSL-Internal/Salinan dari PAJAK BULANAN.xlsx"
 *
 * Prints the first 5 raw rows of each sheet exactly as the xlsx library
 * sees them, so we can see precisely where the header row and data rows
 * actually are.
 */

import xlsx from "xlsx";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node debug-excel.js <path-to-xlsx>");
  process.exit(1);
}

const wb = xlsx.readFile(filePath, { cellDates: true });

console.log("=== SHEET NAMES FOUND IN WORKBOOK ===");
console.log(wb.SheetNames);
console.log("");

for (const sheetName of wb.SheetNames) {
  const upper = sheetName.trim().toUpperCase();
  const isRelevant =
    upper.includes("OP") || upper.includes("BADAN") || upper.includes("EFIN");

  if (!isRelevant) continue;

  console.log(`\n=== SHEET: "${sheetName}" ===`);
  const sheet = wb.Sheets[sheetName];

  const rows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });

  console.log(`Total non-blank rows read: ${rows.length}`);
  console.log("--- First 5 rows (raw arrays) ---");
  for (let i = 0; i < Math.min(5, rows.length); i += 1) {
    console.log(`Row index ${i}:`, JSON.stringify(rows[i]));
  }
}
