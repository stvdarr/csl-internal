/**
 * backend/routes/clientRoutes.js
 *
 * Express router for all client profile endpoints.
 *
 * CRITICAL ROUTE ORDER: /export MUST be registered BEFORE /:id
 * Otherwise Express matches "export" as an :id parameter.
 * (SDD §10.8 documents this explicitly.)
 *
 * Auth policy:
 *   - All routes: verifyToken (both Admin and Staff)
 *   - Write routes (POST, PUT, PATCH, DELETE): requireAdmin
 *   - Export: verifyToken only (Staff can export — PR-06)
 *   - Import: requireAdmin (PR-07)
 *
 * Implements API-01 through API-11 (SDD §7.1–7.8, §5.4)
 */

import express from "express";
import { verifyToken }      from "../middleware/authCheck.js";
import { requireAdmin, requireAdminOrStaff }     from "../middleware/roleCheck.js";
import { validateRequest }  from "../middleware/validateRequest.js";
import { uploadWorkbook }   from "../middleware/uploadWorkbook.js";
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  updateClientStatus,
  exportClients,
  importClients,
  getFamilyMembers,
  addMember,
  updateMember,
  deleteMember,
  addClientCredential,
  updateClientCredential,
  deleteClientCredential,
  deleteClient,
} from "../controllers/clientController.js";
import {
  listClientProfilesSchema,
  createClientSchema,
  updateClientSchema,
  clientIdParamSchema,
  clientStatusSchema,
  exportClientsSchema,
  addFamilyMemberSchema,
  updateFamilyMemberSchema,
  deleteFamilyMemberSchema,
  addCredentialSchema,
  updateCredentialSchema,
  deleteCredentialSchema,
  deleteClientSchema,
} from "../validators/clientSchemas.js";

const router = express.Router();

// All client routes require authentication
router.use(verifyToken);

// ─── Client Profile CRUD ─────────────────────────────────────────────────────

// GET /api/clients/export  (BEFORE /:id — critical route ordering)
// PR-06: Admin + Staff
router.get(
  "/export",
  validateRequest(exportClientsSchema),
  exportClients
);

// GET /api/clients
// PR-01: Admin + Staff
router.get(
  "/",
  validateRequest(listClientProfilesSchema),
  getClients
);

// POST /api/clients
// PR-03: Admin + Staff
router.post(
  "/",
  requireAdminOrStaff,
  validateRequest(createClientSchema),
  createClient
);

// POST /api/clients/import
// PR-07: Admin only — must be before /:id
router.post(
  "/import",
  requireAdmin,
  uploadWorkbook.single("file"),
  importClients
);

// GET /api/clients/:id
// PR-02: Admin + Staff
router.get(
  "/:id",
  validateRequest(clientIdParamSchema),
  getClient
);

// PUT /api/clients/:id
// PR-04: Admin + Staff
router.put(
  "/:id",
  requireAdminOrStaff,
  validateRequest(updateClientSchema),
  updateClient
);

// PATCH /api/clients/:id/status
// PR-05: Admin only
router.patch(
  "/:id/status",
  requireAdmin,
  validateRequest(clientStatusSchema),
  updateClientStatus
);

// DELETE /api/clients/:id
// PR-xx: Admin + Staff
router.delete(
  "/:id",
  requireAdminOrStaff,
  validateRequest(deleteClientSchema),
  deleteClient
);

// ─── Family Member Sub-routes ─────────────────────────────────────────────────
  
// GET /api/clients/:id/family
// PR-08: Admin + Staff
router.get(
  "/:id/family",
  validateRequest(clientIdParamSchema),
  getFamilyMembers
);

// POST /api/clients/:id/family
// PR-09: Admin only
router.post(
  "/:id/family",
  requireAdmin,
  validateRequest(addFamilyMemberSchema),
  addMember
);

// PUT /api/clients/:id/family/:memberId
// PR-10: Admin only
router.put(
  "/:id/family/:memberId",
  requireAdmin,
  validateRequest(updateFamilyMemberSchema),
  updateMember
);

// DELETE /api/clients/:id/family/:memberId
// PR-11: Admin only
router.delete(
  "/:id/family/:memberId",
  requireAdmin,
  validateRequest(deleteFamilyMemberSchema),
  deleteMember
);

// ─── Credential Sub-routes ───────────────────────────────────────────────────

// POST /api/clients/:id/credentials
// PR: Admin + Staff
router.post(
  "/:id/credentials",
  requireAdminOrStaff,
  validateRequest(addCredentialSchema),
  addClientCredential
);

// PUT /api/clients/:id/credentials/:credId
// PR: Admin + Staff
router.put(
  "/:id/credentials/:credId",
  requireAdminOrStaff,
  validateRequest(updateCredentialSchema),
  updateClientCredential
);

// DELETE /api/clients/:id/credentials/:credId
// PR: Admin + Staff
router.delete(
  "/:id/credentials/:credId",
  requireAdminOrStaff,
  validateRequest(deleteCredentialSchema),
  deleteClientCredential
);

export default router;
