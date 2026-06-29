import express from "express";
import {
  getCurrentWorkload,
  getWorkloadBreakdown,
  getHistoricalPerformance,
} from "../controllers/workloadController.js";
import { verifyToken } from "../middleware/authCheck.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  getWorkloadQuerySchema,
  getWorkloadBreakdownSchema,
  getHistoricalPerformanceSchema,
} from "../validators/workloadSchemas.js";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/current",
  validateRequest(getWorkloadQuerySchema),
  getCurrentWorkload
);

router.get(
  "/current/:userId/breakdown",
  validateRequest(getWorkloadBreakdownSchema),
  getWorkloadBreakdown
);

router.get(
  "/history",
  validateRequest(getHistoricalPerformanceSchema),
  getHistoricalPerformance
);

export default router;
