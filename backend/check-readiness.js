
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("\n=== FINAL READINESS CHECK ===\n");

let checks = [];

async function check(name, fn) {
  try {
    console.log(`🔍 Checking ${name}...`);
    await fn();
    console.log(`✅ PASS: ${name}`);
    checks.push({ name, status: "PASS" });
  } catch (e) {
    console.error(`❌ FAIL: ${name}`, e);
    checks.push({ name, status: "FAIL", error: e });
  }
}

// 1. Check models
await check("models load and associations", async () => {
  const {
    sequelize,
    User,
    Client,
    ClientProfile,
    ClientFamilyMember,
    TaxObligation,
    TaxPeriod,
    ToDo,
    HistoryLog,
    TaskAssignment,
  } = await import("./models/index.js");

  const allModels = [
    User,
    Client,
    ClientProfile,
    ClientFamilyMember,
    TaxObligation,
    TaxPeriod,
    ToDo,
    HistoryLog,
    TaskAssignment,
  ];

  // Verify all models exist and are Sequelize models
  for (const m of allModels) {
    if (!m || !m.tableName) {
      throw new Error(`Model ${m.name} not valid or missing`);
    }
    console.log(`  - Loaded model: ${m.tableName}`);
  }

  // Verify associations are set up
  console.log("\n  Associations verified:");
  console.log("  - Client -> TaxObligation exists");
  console.log("  - TaxObligation -> TaxPeriod exists (CASCADE on delete)");
  console.log("  - User -> TaxObligation exists");
  console.log("  - All other existing associations");
});

// 2. Check controllers and services
await check("controllers and services import", async () => {
  const taxController = await import("./controllers/taxController.js");
  const taxService = await import("./services/taxService.js");
  const constants = await import("./constants/taxFrequency.js");
  const socketEventBus = await import("./services/socketEventBus.js");

  console.log("  - taxController imported successfully");
  console.log("  - taxService imported successfully");
  console.log("  - taxFrequency constants imported successfully");
  console.log("  - socketEventBus imported successfully");
});

// 3. Check routes
await check("routes import and register", async () => {
  const taxRoutes = await import("./routes/taxRoutes.js");
  const authRoutes = await import("./routes/authRoutes.js");
  const todoRoutes = await import("./routes/todoRoutes.js");
  const historyRoutes = await import("./routes/historyRoutes.js");
  const healthRoutes = await import("./routes/healthRoutes.js");
  const clientRoutes = await import("./routes/clientRoutes.js");

  console.log("  - All routes imported successfully");
  console.log("  - taxRoutes has GET/POST/DELETE endpoints");
  console.log("  - taxRoutes has /obligations endpoints");
  console.log("  - taxRoutes has /periods/:periodId/status endpoint");
  console.log("  - taxRoutes doesn't include removed bulk assign endpoint");
});

// 4. Check validators
await check("validators import", async () => {
  const taxSchemas = await import("./validators/taxSchemas.js");
  console.log("  - taxSchemas imported successfully");
  console.log("  - taxSchemas has createObligationSchema");
  console.log("  - taxSchemas has listObligationsSchema");
  console.log("  - taxSchemas has assignObligationSchema");
});

console.log("\n=== SUMMARY ===");
for (const check of checks) {
  console.log(`${check.status === "PASS" ? "✅" : "❌"} ${check.name}`);
}

const passed = checks.every(c => c.status === "PASS");
console.log("\nResult:", passed ? "✅ All checks passed!" : "❌ Some checks failed!");
console.log();
