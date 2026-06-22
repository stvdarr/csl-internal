
import assert from 'assert';
import { env } from '../config/env.js';

const BASE_URL = `http://localhost:${env.PORT || 5000}/api`;
const ADMIN_EMAIL = 'admin@csl.local';
const ADMIN_PASSWORD = 'password123';

async function runTests() {
  console.log('--- E2E Tax Obligation Tests ---');

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Login should succeed');
  const token = loginData.token;
  console.log('✅ Login successful');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // 2. Create Client First (if doesn't exist)
  const clientRes = await fetch(`${BASE_URL}/clients`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `Test Client ${Date.now()}`, client_type: 'ORANG_PRIBADI' })
  });
  const clientData = await clientRes.json();
  const clientId = clientData.data?.id;
  const clientName = clientData.data?.name;
  console.log(`✅ Client created: ${clientName}`);

  // 3. Create Manual Obligation
  const createObligationRes = await fetch(`${BASE_URL}/tax/obligations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clientName, taxType: 'PPN' })
  });
  const obligationData = await createObligationRes.json();
  assert.strictEqual(createObligationRes.status, 201, 'Should create manual obligation');
  console.log('✅ Manual Obligation created');

  // 4. Fetch Client Overview
  const overviewRes = await fetch(`${BASE_URL}/tax/clients?search=${encodeURIComponent(clientName)}`, { headers });
  assert.strictEqual(overviewRes.status, 200, 'Should fetch client tax overview');
  const overviewData = await overviewRes.json();
  const foundClient = overviewData.data.find(c => c.name === clientName);
  if (!foundClient) {
    console.error('Clients found:', overviewData.data.map(c => c.name));
    assert(foundClient, 'Client should be present in the overview');
  }
  assert(foundClient.obligations.some(t => t.taxType === 'PPN'), 'Client should have PPN obligation');
  console.log('✅ Client Overview fetched and verified');

  console.log('--- All E2E Tests Passed! ---');
}

runTests().catch(err => {
  console.error('❌ E2E Tests failed:', err.message);
  process.exit(1);
});
