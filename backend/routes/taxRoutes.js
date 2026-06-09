import express from "express";
// Tambahkan uploadBulkTaxes pada import
import {
  assignTax,
  confirmTaxWorkbookImport,
  getAllTaxes,
  getTaxClients,
  getTaxWorkload,
  createTax,
  previewTaxWorkbook,
  updateTaxStatus,
  uploadBulkTaxes,
} from "../controllers/taxController.js";
import { verifyToken } from "../middleware/authCheck.js";
import { checkApprovalAccess, requireAdmin } from "../middleware/roleCheck.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  assignTaxSchema,
  bulkTaxUploadSchema,
  confirmWorkbookImportSchema,
  createTaxSchema,
  listTaxesSchema,
  updateTaxStatusSchema,
} from "../validators/taxSchemas.js";
import { uploadWorkbook } from "../middleware/uploadWorkbook.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", validateRequest(listTaxesSchema), getAllTaxes);
router.get("/clients", getTaxClients);
router.get("/workload", getTaxWorkload);
router.post("/", validateRequest(createTaxSchema), requireAdmin, createTax); // Hanya Admin yang bisa create individual manual
router.post("/bulk", validateRequest(bulkTaxUploadSchema), requireAdmin, uploadBulkTaxes);
router.post("/workbook/preview", uploadWorkbook.single("file"), requireAdmin, previewTaxWorkbook);
router.post("/workbook/confirm", validateRequest(confirmWorkbookImportSchema), requireAdmin, confirmTaxWorkbookImport);
router.put("/:id/status", validateRequest(updateTaxStatusSchema), checkApprovalAccess, updateTaxStatus);
router.put("/:id/assign", validateRequest(assignTaxSchema), requireAdmin, assignTax);

export default router;
