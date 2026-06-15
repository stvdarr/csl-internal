import bcrypt from "bcrypt";
import { env } from "../config/env.js";
import { sequelize, User } from "../models/index.js";
import { ROLES } from "../constants/roles.js";

const name = env.SEED_ADMIN_NAME ?? "Administrator";
const email = env.SEED_ADMIN_EMAIL ?? "admin@csl.local";
const password = env.SEED_ADMIN_PASSWORD;

if (!password) {
  console.error(
    "❌ SEED_ADMIN_PASSWORD harus di-set di environment sebelum menjalankan seed.",
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("❌ SEED_ADMIN_PASSWORD minimal 8 karakter.");
  process.exit(1);
}

try {
  await sequelize.authenticate();

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    console.log(`ℹ️  User dengan email ${email} sudah ada (role: ${existing.role}).`);
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = await User.create({
    name,
    email,
    password: hashedPassword,
    role: ROLES.ADMIN,
  });

  console.log(`✅ Admin berhasil dibuat: ${admin.name} <${admin.email}>`);
} catch (error) {
  console.error("❌ Gagal membuat admin:", error.message);
  process.exit(1);
} finally {
  await sequelize.close();
}
