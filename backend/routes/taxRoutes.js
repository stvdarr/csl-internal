import express from "express";
// Tambahkan uploadBulkTaxes pada import
import {
  getAllTaxes,
  createTax,
  updateTaxStatus,
  uploadBulkTaxes,
} from "../controllers/taxController.js";
import { verifyToken } from "../middleware/authCheck.js";
import { checkApprovalAccess } from "../middleware/roleCheck.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", getAllTaxes);
router.post("/", createTax);
// Tambahkan route POST baru khusus untuk bulk upload
router.post("/bulk", uploadBulkTaxes);
router.put("/:id/status", checkApprovalAccess, updateTaxStatus);

export default router;
