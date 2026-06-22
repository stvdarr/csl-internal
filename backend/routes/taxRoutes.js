
import express from "express";
import rateLimit from "express-rate-limit";
import {
  clearAllTaxes,
  getAllTaxes,
  createTax,
  updateTaxStatus,
  previewTaxWorkbook,
  confirmTaxWorkbookImport,
  getTaxWorkload,
  getTaxClients,
  createObligation,
  getObligations,
  assignObligation,
} from "../controllers/taxController.js";
import { verifyToken } from "../middleware/authCheck.js";
import { checkApprovalAccess, requireAdmin } from "../middleware/roleCheck.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  updateTaxStatusSchema,
  listTaxesSchema,
  listClientsSchema,
  createTaxSchema,
  clearAllTaxesSchema,
  confirmWorkbookImportSchema,
  createObligationSchema,
  listObligationsSchema,
  assignObligationSchema,
} from "../validators/taxSchemas.js";
import {
  uploadWorkbook,
  validateWorkbookMagicBytes,
} from "../middleware/uploadWorkbook.js";

const router = express.Router();

const clearAllLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak permintaan reset data. Coba lagi nanti." },
});

router.use(verifyToken);

// --- OBLIGATION ROUTES ---
router.post(
  "/obligations",
  requireAdmin,
  validateRequest(createObligationSchema),
  createObligation
);
router.get(
  "/obligations",
  validateRequest(listObligationsSchema),
  getObligations
);
router.put(
  "/obligations/:obligationId/assign",
  requireAdmin,
  validateRequest(assignObligationSchema),
  assignObligation
);

// --- PERIOD ROUTES ---
router.get("/", validateRequest(listTaxesSchema), getAllTaxes);
router.post("/", validateRequest(createTaxSchema), requireAdmin, createTax);
router.put(
  "/periods/:periodId/status",
  validateRequest(updateTaxStatusSchema),
  checkApprovalAccess,
  updateTaxStatus
);

// --- OTHER ROUTES ---
router.get("/clients", validateRequest(listClientsSchema), getTaxClients);
router.get("/workload", getTaxWorkload);
router.delete(
  "/clear-all",
  clearAllLimiter,
  requireAdmin,
  validateRequest(clearAllTaxesSchema),
  clearAllTaxes
);
router.post(
  "/workbook/preview",
  requireAdmin,
  uploadWorkbook.single("file"),
  validateWorkbookMagicBytes,
  previewTaxWorkbook
);
router.post(
  "/workbook/confirm",
  validateRequest(confirmWorkbookImportSchema),
  requireAdmin,
  confirmTaxWorkbookImport
);

export default router;
