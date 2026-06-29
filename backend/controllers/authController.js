import { registerUser, loginUser, listAllStaff, listAllUsers } from "../services/authService.js";
import { User } from "../models/index.js";
import logger from "../utils/logger.js";
import { setAuthCookie, clearAuthCookie } from "../utils/cookieAuth.js";

export const getStaffList = async (req, res) => {
  try {
    const staff = await listAllStaff();
    res.status(200).json({ data: staff });
  } catch (error) {
    logger.error(error, "Error in getStaffList");
    res.status(500).json({ error: "Gagal mengambil daftar staff" });
  }
};

export const getUserList = async (req, res) => {
  try {
    const users = await listAllUsers();
    res.status(200).json({ data: users });
  } catch (error) {
    logger.error(error, "Error in getUserList");
    res.status(500).json({ error: "Gagal mengambil daftar user" });
  }
};

export const getMe = async (req, res) => {
  try {
    const profile = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "email", "role"],
    });

    if (!profile) {
      return res.status(401).json({ error: "Sesi tidak valid" });
    }

    res.status(200).json({
      role: profile.role,
      user: profile.get({ plain: true }),
    });
  } catch (error) {
    logger.error(error, "Error in getMe");
    res.status(500).json({ error: "Gagal memverifikasi sesi" });
  }
};

export const register = async (req, res) => {
  try {
    const safeUser = await registerUser(req.body);
    res
      .status(201)
      .json({ message: "User berhasil didaftarkan!", data: safeUser });
  } catch (error) {
    logger.error(error, "Error in register");
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Gagal mendaftarkan user" });
  }
};

export const login = async (req, res) => {
  try {
    const loginData = await loginUser(req.body);
    setAuthCookie(res, loginData.token);

    res.status(200).json({
      message: "Login berhasil!",
      token: loginData.token,
      role: loginData.role,
      user: loginData.user,
    });
  } catch (error) {
    logger.error(error, "Error in login");
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Terjadi kesalahan saat login" });
  }
};

export const logout = async (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ message: "Logout berhasil" });
};
