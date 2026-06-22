/**
 * Full deployment evidence audit runner.
 * Tests Staff permissions, audit logs, and import verification.
 * No code changes — runtime evidence only.
 */
import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';
import { sequelize } from '../models/index.js';
import { QueryTypes } from 'sequelize';

const BASE = 'http://localhost:5000/api';
const UNIQUE = Date.now();

const report = [];
function log(section, label, method, url, status, expected, body) {
  const pass = status === expected;
  const entry = {
    section,
    label,
    method,
    url,
    status,
    expected,
    pass,
    body: typeof body === 'string' ? body.slice(0, 120) : JSON.stringify(body).slice(0, 120),
  };
  report.push(entry);
  const mark = pass ? '✅' : '❌';
  console.log(`${mark} [${section}] ${label}: ${method} ${url} → ${status} (expected ${expected})`);
  if (!pass) console.log(`   BODY: ${entry.body}`);
}

// ── 1. Login Admin ──────────────────────────────────────────────────────────
let res = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@csl.local', password: 'password123' }),
});
let d = await res.json();
const adminToken = d.token;
const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
log('SETUP', 'Admin Login', 'POST', '/auth/login', res.status, 200, d);

// ── Create known client + family member for test references ─────────────────
res = await fetch(`${BASE}/clients`, {
  method: 'POST', headers: adminHeaders,
  body: JSON.stringify({ client_type: 'ORANG_PRIBADI', name: `Evidence OP ${UNIQUE}` }),
});
d = await res.json();
const testClientId = d.data.id;
log('SETUP', 'Create test client', 'POST', '/clients', res.status, 201, d);

res = await fetch(`${BASE}/clients/${testClientId}/family`, {
  method: 'POST', headers: adminHeaders,
  body: JSON.stringify({ name: 'Evidence Member', relationship: 'ANAK' }),
});
d = await res.json();
const testMemberId = d.data.id;
log('SETUP', 'Create test family member', 'POST', `/clients/${testClientId}/family`, res.status, 201, d);

// ── 2. Login Staff ──────────────────────────────────────────────────────────
res = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'staff@csl.local', password: 'staffpass123' }),
});
d = await res.json();
const staffToken = d.token;
const staffHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` };
log('STAFF', 'Staff Login', 'POST', '/auth/login', res.status, 200, d);

// ── STAFF ALLOWED: GET list ─────────────────────────────────────────────────
res = await fetch(`${BASE}/clients`, { headers: staffHeaders });
d = await res.json();
log('STAFF', 'List Clients (allowed)', 'GET', '/clients', res.status, 200, d);

// ── STAFF ALLOWED: GET single ───────────────────────────────────────────────
res = await fetch(`${BASE}/clients/${testClientId}`, { headers: staffHeaders });
d = await res.json();
log('STAFF', 'Get Client (allowed)', 'GET', `/clients/${testClientId}`, res.status, 200, d);

// ── STAFF ALLOWED: GET family ───────────────────────────────────────────────
res = await fetch(`${BASE}/clients/${testClientId}/family`, { headers: staffHeaders });
d = await res.json();
log('STAFF', 'Get Family Members (allowed)', 'GET', `/clients/${testClientId}/family`, res.status, 200, d);

// ── STAFF ALLOWED: Export ───────────────────────────────────────────────────
res = await fetch(`${BASE}/clients/export`, { headers: staffHeaders });
const buf = await res.arrayBuffer();
log('STAFF', 'Export (allowed)', 'GET', '/clients/export', res.status, 200, `Buffer:${buf.byteLength}`);

// ── STAFF FORBIDDEN: Create client ─────────────────────────────────────────
res = await fetch(`${BASE}/clients`, {
  method: 'POST', headers: staffHeaders,
  body: JSON.stringify({ client_type: 'ORANG_PRIBADI', name: `Staff Create Attempt ${UNIQUE}` }),
});
d = await res.json();
log('STAFF', 'Create Client (FORBIDDEN)', 'POST', '/clients', res.status, 403, d);

// ── STAFF FORBIDDEN: Update client ─────────────────────────────────────────
res = await fetch(`${BASE}/clients/${testClientId}`, {
  method: 'PUT', headers: staffHeaders,
  body: JSON.stringify({ name: 'Staff Tamper' }),
});
d = await res.json();
log('STAFF', 'Update Client (FORBIDDEN)', 'PUT', `/clients/${testClientId}`, res.status, 403, d);

// ── STAFF FORBIDDEN: Status change ─────────────────────────────────────────
res = await fetch(`${BASE}/clients/${testClientId}/status`, {
  method: 'PATCH', headers: staffHeaders,
  body: JSON.stringify({ status: 'INACTIVE' }),
});
d = await res.json();
log('STAFF', 'Status Change (FORBIDDEN)', 'PATCH', `/clients/${testClientId}/status`, res.status, 403, d);

// ── STAFF FORBIDDEN: Import ─────────────────────────────────────────────────
res = await fetch(`${BASE}/clients/import`, {
  method: 'POST', headers: { Authorization: `Bearer ${staffToken}` },
  body: new FormData(),
});
d = await res.json();
log('STAFF', 'Import (FORBIDDEN)', 'POST', '/clients/import', res.status, 403, d);

// ── STAFF FORBIDDEN: Add family member ─────────────────────────────────────
res = await fetch(`${BASE}/clients/${testClientId}/family`, {
  method: 'POST', headers: staffHeaders,
  body: JSON.stringify({ name: 'Unauthorized Member', relationship: 'ANAK' }),
});
d = await res.json();
log('STAFF', 'Add Family Member (FORBIDDEN)', 'POST', `/clients/${testClientId}/family`, res.status, 403, d);

// ── STAFF FORBIDDEN: Update family member ──────────────────────────────────
res = await fetch(`${BASE}/clients/${testClientId}/family/${testMemberId}`, {
  method: 'PUT', headers: staffHeaders,
  body: JSON.stringify({ occupation: 'Tamper' }),
});
d = await res.json();
log('STAFF', 'Update Family Member (FORBIDDEN)', 'PUT', `/clients/${testClientId}/family/${testMemberId}`, res.status, 403, d);

// ── STAFF FORBIDDEN: Delete family member ──────────────────────────────────
res = await fetch(`${BASE}/clients/${testClientId}/family/${testMemberId}`, {
  method: 'DELETE', headers: staffHeaders,
});
d = await res.json();
log('STAFF', 'Delete Family Member (FORBIDDEN)', 'DELETE', `/clients/${testClientId}/family/${testMemberId}`, res.status, 403, d);

// ── UNAUTH: Completely no token ─────────────────────────────────────────────
res = await fetch(`${BASE}/clients`);
d = await res.json();
log('STAFF', 'No Token (UNAUTH)', 'GET', '/clients', res.status, 401, d);

// ── 3. IMPORT TEST (Admin) ──────────────────────────────────────────────────
const wb = xlsx.utils.book_new();
const opRows = [
  { "Nama": `Audit Test OP-1 ${UNIQUE}`, "Status": "ACTIVE" },
  { "Nama": `Audit Test OP-2 ${UNIQUE}`, "Status": "ACTIVE" },
  { "Nama": "",                            "Status": "ACTIVE" }, // intentional blank
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(opRows), "Orang Pribadi");
const tmpFile = path.join(process.cwd(), 'tmp', `evidence_${UNIQUE}.xlsx`);
if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) fs.mkdirSync(path.join(process.cwd(), 'tmp'));
xlsx.writeFile(wb, tmpFile);

const formData = new FormData();
formData.append('file', new Blob([fs.readFileSync(tmpFile)], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}), `evidence_${UNIQUE}.xlsx`);

res = await fetch(`${BASE}/clients/import`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${adminToken}` },
  body: formData,
});
d = await res.json();
log('IMPORT', 'Import 3 rows (1 blank)', 'POST', '/clients/import', res.status, 201, d);
console.log(`   SUCCESS=${d.data?.success} FAILED=${d.data?.failed} ERRORS=${JSON.stringify(d.data?.errors)}`);
fs.unlinkSync(tmpFile);

// ── 4. UPDATE and DELETE for audit trail ────────────────────────────────────
res = await fetch(`${BASE}/clients/${testClientId}`, {
  method: 'PUT', headers: adminHeaders,
  body: JSON.stringify({ notes: 'Evidence audit update' }),
});
d = await res.json();
log('AUDIT', 'Update Client (for audit)', 'PUT', `/clients/${testClientId}`, res.status, 200, d);

res = await fetch(`${BASE}/clients/${testClientId}/family/${testMemberId}`, {
  method: 'DELETE', headers: adminHeaders,
});
d = await res.json();
log('AUDIT', 'Delete Family Member (for audit)', 'DELETE', `/clients/${testClientId}/family/${testMemberId}`, res.status, 200, d);

// ── 5. QUERY AUDIT LOGS DIRECTLY ───────────────────────────────────────────
console.log('\n=== AUDIT LOG QUERY ===');
await sequelize.authenticate();
const logs = await sequelize.query(
  `SELECT actionType, actorId, targetType, targetId, metadata, createdAt
   FROM history_logs
   WHERE targetType = 'CLIENT'
   ORDER BY id DESC
   LIMIT 10`,
  { type: QueryTypes.SELECT }
);
logs.forEach(l => {
  console.log(`  [${l.actionType}] actor=${l.actorId} target=${l.targetType}:${l.targetId} meta=${l.metadata} at=${l.createdAt}`);
});
await sequelize.close();

// ── 6. SUMMARY ──────────────────────────────────────────────────────────────
const passed = report.filter(r => r.pass).length;
const failed = report.filter(r => !r.pass).length;
console.log(`\n=== FINAL RESULT: ${passed} PASSED / ${failed} FAILED ===`);
report.filter(r => !r.pass).forEach(r =>
  console.log(`  FAIL: [${r.section}] ${r.label} → got ${r.status}, expected ${r.expected}`)
);
console.log('\nAUDIT LOGS:');
console.log(JSON.stringify(logs, null, 2));
