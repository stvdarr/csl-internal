import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { runInTransaction } from "../utils/transactionHelper.js";
import { env } from "../config/env.js";
import { ROLES } from "../constants/roles.js";

/**
 * Register a new user
 */
export const registerUser = async ({ name, email, password }) => {
  return runInTransaction(async (transaction) => {
    // 1. Enkripsi password menggunakan bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 2. Simpan user ke database (Default role dipaksa menjadi Staff)
    const newUser = await User.create(
      {
        name,
        email,
        password: hashedPassword,
        role: ROLES.STAFF,
      },
      { transaction },
    );

    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };
  });
};

/**
 * Login user and generate JWT
 */
export const loginUser = async ({ email, password }) => {
  // Login is read-only (mostly), no transaction needed unless we track login attempts
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const error = new Error("User tidak ditemukan!");
    error.statusCode = 404;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    const error = new Error("Password salah!");
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    env.JWT_SECRET,
    { expiresIn: "1d" },
  );

  return {
    token,
    role: user.role,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

/**
 * List all users with Staff role
 */
export const listAllStaff = async () => {
  return User.findAll({
    where: { role: ROLES.STAFF },
    attributes: ["id", "name", "email"],
    order: [["name", "ASC"]],
  });
};
