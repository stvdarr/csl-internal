import express from "express";
import {
  getHealth,
  getDatabaseHealth,
  getSocketHealth,
} from "../controllers/healthController.js";
import { verifyToken } from "../middleware/authCheck.js";
import { requireAdmin } from "../middleware/roleCheck.js";

const router = express.Router();

router.get("/", getHealth);
router.get("/database", verifyToken, requireAdmin, getDatabaseHealth);
router.get("/socket", verifyToken, requireAdmin, getSocketHealth);

export default router;
