import express from "express";
import { getHistoryLogs } from "../controllers/historyController.js";
import { verifyToken } from "../middleware/authCheck.js";
import { requireAdmin } from "../middleware/roleCheck.js";

const router = express.Router();

// Wajib login dan harus Admin untuk melihat global history log
router.use(verifyToken);
router.get("/", requireAdmin, getHistoryLogs);

export default router;
