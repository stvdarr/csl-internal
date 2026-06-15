import express from "express";
import rateLimit from "express-rate-limit";
import {
  assignTax,
  bulkAssignClientTaxes,
  clearAllTaxes,
  confirmTaxWorkbookImport,
  getAllTaxes,
  getTaxClients,
  getTaxWorkload,
  createTax,
  previewTaxWorkbook,
  updateTaxStatus,
} from "../controllers/taxController.js";
import { verifyToken } from "../middleware/authCheck.js";
import { checkApprovalAccess, requireAdmin } from "../middleware/roleCheck.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  assignTaxSchema,
  bulkAssignTaxSchema,
  clearAllTaxesSchema,
  confirmWorkbookImportSchema,
  createTaxSchema,
  listTaxesSchema,
  listClientsSchema,
  updateTaxStatusSchema,
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

router.get("/", validateRequest(listTaxesSchema), getAllTaxes);
router.get("/clients", validateRequest(listClientsSchema), getTaxClients);
router.get("/workload", getTaxWorkload);
router.delete(
  "/clear-all",
  clearAllLimiter,
  requireAdmin,
  validateRequest(clearAllTaxesSchema),
  clearAllTaxes,
);
router.post("/", validateRequest(createTaxSchema), requireAdmin, createTax);
router.post(
  "/workbook/preview",
  requireAdmin,
  uploadWorkbook.single("file"),
  validateWorkbookMagicBytes,
  previewTaxWorkbook,
);
router.post("/workbook/confirm", validateRequest(confirmWorkbookImportSchema), requireAdmin, confirmTaxWorkbookImport);
router.put("/:id/status", validateRequest(updateTaxStatusSchema), checkApprovalAccess, updateTaxStatus);
router.put("/:id/assign", validateRequest(assignTaxSchema), requireAdmin, assignTax);
router.put("/client/:clientId/assign", validateRequest(bulkAssignTaxSchema), requireAdmin, bulkAssignClientTaxes);

export default router;
