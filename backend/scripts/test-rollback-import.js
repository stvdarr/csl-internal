import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { ClientProfile, ClientFamilyMember, Client } from '../models/index.js';

const BASE_URL = 'http://localhost:5000/api';

async function run() {
  const log = (phase, method, url, status, resBody) => {
    console.log(`\n=== ${phase} ===`);
    console.log(`REQ: ${method} ${url}`);
    console.log(`STATUS: ${status}`);
    console.log(`RES BODY:`, typeof resBody === 'string' ? resBody.slice(0, 150) : JSON.stringify(resBody).slice(0, 150));
  };

  try {
    // 1. Login
    let res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@csl.local', password: 'password123' })
    });
    let data = await res.json();
    const token = data.token;
    const headers = { 'Authorization': `Bearer ${token}` };

    // Create an OP client for family test
    res = await fetch(`${BASE_URL}/clients`, { 
      method: 'POST', 
      headers: { ...headers, 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ client_type: 'ORANG_PRIBADI', name: `TEST OP ${Date.now()}` }) 
    });
    data = await res.json();
    const clientId = data.data.id;

    // ==========================================
    // PHASE 2: TRANSACTION ROLLBACK VERIFICATION
    // ==========================================
    const familyPayload = { name: 'TEST_ROLLBACK', relationship: 'ANAK' };
    res = await fetch(`${BASE_URL}/clients/${clientId}/family`, { 
      method: 'POST', 
      headers: { ...headers, 'Content-Type': 'application/json' }, 
      body: JSON.stringify(familyPayload) 
    });
    data = await res.json();
    log('Phase 2 - Inject Throw', 'POST', `/clients/${clientId}/family`, res.status, data);

    // Verify record does not exist
    const membersCount = await ClientFamilyMember.count({ where: { client_profile_id: clientId } });
    console.log(`Verify: Members in DB for client ${clientId} = ${membersCount} (Expected: 0)`);

    // ==========================================
    // PHASE 3: IMPORT TRANSACTION VERIFICATION
    // ==========================================
    
    // Create an XLSX file using xlsx package
    const wb = xlsx.utils.book_new();
    const opRows = [
      { "Nama": `Valid Row 1 - ${Date.now()}`, "Status": "ACTIVE" },
      { "Nama": `Valid Row 2 - ${Date.now()}`, "Status": "ACTIVE" },
      { "Nama": "", "Status": "ACTIVE" } // Intentional failure: name is required
    ];
    const wsOP = xlsx.utils.json_to_sheet(opRows);
    xlsx.utils.book_append_sheet(wb, wsOP, "Orang Pribadi");
    
    // Save to temp file
    const filePath = path.join(process.cwd(), 'tmp', 'test_import.xlsx');
    if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath));
    xlsx.writeFile(wb, filePath);

    // Node 18+ fetch with FormData and Blob/File requires some workarounds, 
    // but we can use the native FormData by reading the file to a Blob.
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const formData = new FormData();
    formData.append("file", blob, "test_import.xlsx");

    // Execute Import
    res = await fetch(`${BASE_URL}/clients/import`, {
      method: 'POST',
      headers: headers, // Do NOT set Content-Type, let fetch generate the boundary
      body: formData
    });
    data = await res.json();
    log('Phase 3 - Import Batch (3 rows, 1 invalid)', 'POST', '/clients/import', res.status, data);

    // Verify rollback
    const countRow1 = await ClientProfile.count({ where: { name: opRows[0]["Nama"] } });
    const countRow2 = await ClientProfile.count({ where: { name: opRows[1]["Nama"] } });
    console.log(`Verify: Row 1 in DB = ${countRow1} (Expected: 0)`);
    console.log(`Verify: Row 2 in DB = ${countRow2} (Expected: 0)`);

  } catch (err) {
    console.error("TEST FAILED", err);
  }
}

run();
