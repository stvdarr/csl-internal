import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  logout,
  getMe,
  getStaffList,
  getUserList,
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/authCheck.js";
import { requireAdmin } from "../middleware/roleCheck.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { loginSchema, registerSchema } from "../validators/authSchemas.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/me", verifyToken, getMe);
router.post("/logout", verifyToken, logout);
router.get("/staff", verifyToken, requireAdmin, getStaffList);
router.get("/user", verifyToken, requireAdmin, getUserList);
router.post(
  "/register",
  verifyToken,
  requireAdmin,
  validateRequest(registerSchema),
  register,
);
router.post("/login", loginLimiter, validateRequest(loginSchema), login);

export default router;
