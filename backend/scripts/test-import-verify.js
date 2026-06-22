import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

const BASE_URL = 'http://localhost:5000/api';
const UNIQUE = Date.now();

// ── Build a test XLSX with both valid and invalid rows ──────────────────────
const wb = xlsx.utils.book_new();

// Sheet "Orang Pribadi": 2 valid rows + 1 row with blank Nama (row 4)
const opRows = [
  { "Nama": `Import Test OP-A ${UNIQUE}`, "Status": "ACTIVE", "NPWP 16": "1234567890123401" },
  { "Nama": `Import Test OP-B ${UNIQUE}`, "Status": "ACTIVE", "NPWP 16": "1234567890123402" },
  { "Nama": "",                           "Status": "ACTIVE" }, // Intentional failure
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(opRows), "Orang Pribadi");

// Sheet "Badan": 1 valid row
const badanRows = [
  { "Nama": `Import Test Badan-A ${UNIQUE}`, "Status": "ACTIVE", "NPWP 16": "9876543210987654" },
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(badanRows), "Badan");

// Write to disk
const filePath = path.join(process.cwd(), 'tmp', `test_import_${UNIQUE}.xlsx`);
if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) fs.mkdirSync(path.join(process.cwd(), 'tmp'));
xlsx.writeFile(wb, filePath);
console.log(`\nTest XLSX written to: ${filePath}`);
console.log(`Rows: OP×3 (1 blank name), Badan×1 = 4 total, expected: success=3, failed=1`);

// ── Login ────────────────────────────────────────────────────────────────────
let res = await fetch(`${BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@csl.local', password: 'password123' }),
});
const { token } = await res.json();
if (!token) throw new Error('Login failed');
console.log('\nLOGIN: OK');

// ── Upload XLSX via multipart/form-data ──────────────────────────────────────
const fileBuffer = fs.readFileSync(filePath);
const blob = new Blob([fileBuffer], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});
const formData = new FormData();
formData.append('file', blob, `test_import_${UNIQUE}.xlsx`);

res = await fetch(`${BASE_URL}/clients/import`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

const data = await res.json();
console.log(`\n=== IMPORT RESPONSE ===`);
console.log(`HTTP STATUS : ${res.status}`);
console.log(`MESSAGE     : ${data.message}`);
console.log(`SUCCESS     : ${data.data?.success}`);
console.log(`FAILED      : ${data.data?.failed}`);
console.log(`ERRORS      : ${JSON.stringify(data.data?.errors, null, 2)}`);

// ── Verify rows exist in DB ──────────────────────────────────────────────────
const verifyRes = await fetch(`${BASE_URL}/clients?search=Import+Test+OP-A+${UNIQUE}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const verifyData = await verifyRes.json();
console.log(`\n=== DB VERIFY: OP-A row ===`);
console.log(`Found in DB : ${verifyData.total === 1 ? 'YES' : 'NO'} (expected 1, got ${verifyData.total})`);

// ── Verify blank-name row was NOT committed ──────────────────────────────────
const blankRes = await fetch(`${BASE_URL}/clients?search=BLANK_NAME_SHOULD_NOT_EXIST_${UNIQUE}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const blankData = await blankRes.json();
console.log(`\n=== DB VERIFY: blank-name row ===`);
console.log(`Not in DB   : ${blankData.total === 0 ? 'PASS' : 'FAIL'} (expected 0, got ${blankData.total})`);

// Cleanup test file
fs.unlinkSync(filePath);
console.log(`\nTest XLSX cleaned up.`);
