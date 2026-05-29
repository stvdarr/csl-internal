import express from "express";
import { getHistoryLogs } from "../controllers/historyController.js";
import { verifyToken } from "../middleware/authCheck.js";

const router = express.Router();

// Wajib login untuk melihat log
router.use(verifyToken);
router.get("/", getHistoryLogs);

export default router;
