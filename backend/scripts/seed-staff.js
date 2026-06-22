/**
 * Seed a Staff user for testing.
 * Usage: node scripts/seed-staff.js
 */
import bcrypt from "bcrypt";
import { sequelize, User } from "../models/index.js";
import { ROLES } from "../constants/roles.js";

const email    = "staff@csl.local";
const password = "staffpass123";
const name     = "Staff Test";

try {
  await sequelize.authenticate();

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    console.log(`ℹ️  Staff user already exists: ${email} (role: ${existing.role})`);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 10);
  const staff  = await User.create({ name, email, password: hashed, role: ROLES.STAFF });
  console.log(`✅ Staff created: ${staff.name} <${staff.email}>`);
} catch (err) {
  console.error("❌ Failed:", err.message);
  process.exit(1);
} finally {
  await sequelize.close();
}
