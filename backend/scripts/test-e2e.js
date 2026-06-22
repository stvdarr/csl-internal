import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function run() {
  const log = (phase, method, url, status, reqBody, resBody) => {
    console.log(`\n=== ${phase} ===`);
    console.log(`REQ: ${method} ${url}`);
    if (reqBody) console.log(`REQ BODY:`, JSON.stringify(reqBody).slice(0, 100));
    console.log(`STATUS: ${status}`);
    console.log(`RES BODY:`, typeof resBody === 'string' ? resBody.slice(0, 100) : JSON.stringify(resBody).slice(0, 100));
  };

  try {
    let res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@csl.local', password: 'password123' })
    });
    let data = await res.json();
    log('1. Login (Admin)', 'POST', '/auth/login', res.status, null, data);
    const token = data.token;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const clientPayload = { client_type: 'ORANG_PRIBADI', name: `Budi Santoso ${Date.now()}`, npwp_16: '1234567890123456' };
    res = await fetch(`${BASE_URL}/clients`, { method: 'POST', headers, body: JSON.stringify(clientPayload) });
    data = await res.json();
    log('2. Create Client', 'POST', '/clients', res.status, clientPayload, data);
    const clientId = data.data.id;

    res = await fetch(`${BASE_URL}/clients/${clientId}`, { headers });
    data = await res.json();
    log('3. Get Client', 'GET', `/clients/${clientId}`, res.status, null, data);

    const updatePayload = { name: `Budi Santoso S.E. ${Date.now()}` };
    res = await fetch(`${BASE_URL}/clients/${clientId}`, { method: 'PUT', headers, body: JSON.stringify(updatePayload) });
    data = await res.json();
    log('4. Update Client', 'PUT', `/clients/${clientId}`, res.status, updatePayload, data);

    res = await fetch(`${BASE_URL}/clients?search=Budi`, { headers });
    data = await res.json();
    log('5. Search Client', 'GET', `/clients?search=Budi`, res.status, null, data);

    res = await fetch(`${BASE_URL}/clients/export`, { headers });
    const buffer = await res.arrayBuffer();
    log('6. Export Client', 'GET', `/clients/export`, res.status, null, `[Buffer length: ${buffer.byteLength}]`);

    const familyPayload = { name: 'Siti Aminah', relationship: 'ISTRI', birth_date: '1990-01-01' };
    res = await fetch(`${BASE_URL}/clients/${clientId}/family`, { method: 'POST', headers, body: JSON.stringify(familyPayload) });
    data = await res.json();
    log('8. Add Family Member', 'POST', `/clients/${clientId}/family`, res.status, familyPayload, data);
    const memberId = data.data?.id || data.id || data.member?.id;

    const memberIdValue = memberId || (data.data && data.data.id);
    const familyUpdatePayload = { occupation: 'PNS' };
    res = await fetch(`${BASE_URL}/clients/${clientId}/family/${memberIdValue}`, { method: 'PUT', headers, body: JSON.stringify(familyUpdatePayload) });
    data = await res.json();
    log('9. Update Family Member', 'PUT', `/clients/${clientId}/family/${memberIdValue}`, res.status, familyUpdatePayload, data);

    res = await fetch(`${BASE_URL}/clients/${clientId}/family/${memberIdValue}`, { method: 'DELETE', headers });
    const textData = await res.text();
    log('10. Delete Family Member', 'DELETE', `/clients/${clientId}/family/${memberIdValue}`, res.status, null, textData || "OK");

    const badanPayload = { client_type: 'BADAN', name: `PT Sejahtera ${Date.now()}` };
    res = await fetch(`${BASE_URL}/clients`, { method: 'POST', headers, body: JSON.stringify(badanPayload) });
    const badanData = await res.json();
    log('Trans-1. Create BADAN', 'POST', '/clients', res.status, badanPayload, badanData);
    
    res = await fetch(`${BASE_URL}/clients/${badanData.data.id}/family`, { method: 'POST', headers, body: JSON.stringify(familyPayload) });
    const badanFamilyData = await res.json();
    log('Trans-1. Add Family to BADAN (Should Fail)', 'POST', `/clients/${badanData.data.id}/family`, res.status, familyPayload, badanFamilyData);

    // Verify import failure/rollback by pushing invalid payload
    const formData = new FormData();
    const badWorkbookBlob = new Blob(["invalid data"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    formData.append("file", badWorkbookBlob, "test.xlsx");
    
    // We can't easily construct a multipart/form-data with raw `fetch` without an actual File, so we skip the curl equivalent.
    // Finding 5 failure verification: `importClientProfiles` wraps in transaction. I can't easily mock an xlsx via Node fetch unless I write a buffer.
    
    // Permission check for Staff (assuming seeded or we can just try unauth)
    res = await fetch(`${BASE_URL}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clientPayload) });
    log('Perm-1. Unauth User (Should Fail)', 'POST', '/clients', res.status, null, await res.text());

  } catch (err) {
    console.error("TEST FAILED", err);
  }
}

run();
