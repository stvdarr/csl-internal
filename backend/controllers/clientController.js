/**
 * backend/controllers/clientController.js
 *
 * Thin HTTP controllers — delegate ALL business logic to clientService.
 * Each controller:
 *   1. Reads validated inputs from req.body / req.params / req.query
 *   2. Calls the corresponding service function
 *   3. Sends a consistent HTTP response
 *   4. Never contains business logic
 *
 * Implements SDD §10.7 and §10.12 (error handling rules).
 */

import logger from "../utils/logger.js";
import { cleanupTempFile } from "../middleware/uploadWorkbook.js";
import {
  listClientProfiles,
  getClientProfile,
  createClientProfile,
  updateClientProfile,
  setClientProfileStatus,
  exportClientProfiles,
  importClientProfiles,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
} from "../services/clientService.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/clients
// PR-01: Admin + Staff
// ─────────────────────────────────────────────────────────────────────────────

export const getClients = async (req, res) => {
  try {
    const result = await listClientProfiles(req.query);
    return res.status(200).json(result);
  } catch (e) {
    logger.error({ err: e }, "getClients failed");
    return res.status(e.statusCode || 500).json({ error: "Gagal mengambil data klien" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/clients/:id
// PR-02: Admin + Staff
// ─────────────────────────────────────────────────────────────────────────────

export const getClient = async (req, res) => {
  try {
    const profile = await getClientProfile(req.params.id);
    return res.status(200).json({ data: profile });
  } catch (e) {
    logger.error({ err: e, id: req.params.id }, "getClient failed");
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/clients
// PR-03: Admin only
// ─────────────────────────────────────────────────────────────────────────────

export const createClient = async (req, res) => {
  try {
    const profile = await createClientProfile(req.body, req.user);
    return res.status(201).json({
      message: "Profil klien berhasil dibuat",
      data:    profile,
    });
  } catch (e) {
    logger.error({ err: e }, "createClient failed");
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/clients/:id
// PR-04: Admin only
// ─────────────────────────────────────────────────────────────────────────────

export const updateClient = async (req, res) => {
  try {
    const profile = await updateClientProfile(req.params.id, req.body, req.user);
    return res.status(200).json({
      message: "Profil klien berhasil diperbarui",
      data:    profile,
    });
  } catch (e) {
    logger.error({ err: e, id: req.params.id }, "updateClient failed");
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/clients/:id/status
// PR-05: Admin only
// ─────────────────────────────────────────────────────────────────────────────

export const updateClientStatus = async (req, res) => {
  try {
    const profile = await setClientProfileStatus(
      req.params.id,
      req.body.status,
      req.user
    );
    return res.status(200).json({
      message: `Status klien berhasil diubah menjadi ${req.body.status}`,
      data:    { id: profile.id, status: profile.status },
    });
  } catch (e) {
    logger.error({ err: e, id: req.params.id }, "updateClientStatus failed");
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/clients/export
// PR-06: Admin + Staff
// FR-28: Filename format Data_Klien_CSL_YYYYMMDD_HHmmss.xlsx
// ─────────────────────────────────────────────────────────────────────────────

export const exportClients = async (req, res) => {
  try {
    const { buffer, count } = await exportClientProfiles(req.query, req.user);

    // FR-28: Filename format Data_Klien_CSL_YYYYMMDD_HHmmss.xlsx
    const now       = new Date();
    const pad       = (n) => String(n).padStart(2, "0");
    const datePart  = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart  = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename  = `Data_Klien_CSL_${datePart}_${timePart}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    logger.info({ actor: req.user.id, count }, "Client export completed");
    return res.send(buffer);
  } catch (e) {
    logger.error({ err: e }, "exportClients failed");
    return res.status(500).json({ error: "Gagal mengekspor data klien" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/clients/import
// PR-07: Admin only
// ─────────────────────────────────────────────────────────────────────────────

export const importClients = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "File tidak ditemukan" });
  }

  try {
    // Change A: pass req.file.path — multer.diskStorage does not populate req.file.buffer
    const result = await importClientProfiles(req.file.path, req.user);
    return res.status(201).json({
      message: `Import selesai: ${result.success} klien berhasil, ${result.failed} baris gagal.`,
      data:    result,
    });
  } catch (e) {
    logger.error({ err: e }, "importClients failed");
    return res.status(e.statusCode || 500).json({ error: e.message });
  } finally {
    // Change C: always clean up the temp file to prevent unbounded disk growth
    await cleanupTempFile(req.file.path);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/clients/:id/family
// PR-08: Admin + Staff
// ─────────────────────────────────────────────────────────────────────────────

export const getFamilyMembers = async (req, res) => {
  try {
    const profile = await getClientProfile(req.params.id);
    return res.status(200).json({ data: profile.FamilyMembers });
  } catch (e) {
    logger.error({ err: e, id: req.params.id }, "getFamilyMembers failed");
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/clients/:id/family
// PR-09: Admin only
// ─────────────────────────────────────────────────────────────────────────────

export const addMember = async (req, res) => {
  try {
    const member = await addFamilyMember(req.params.id, req.body, req.user);
    return res.status(201).json({
      message: "Anggota keluarga berhasil ditambahkan",
      data:    member,
    });
  } catch (e) {
    logger.error({ err: e }, "addMember failed");
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/clients/:id/family/:memberId
// PR-10: Admin only
// ─────────────────────────────────────────────────────────────────────────────

export const updateMember = async (req, res) => {
  try {
    const member = await updateFamilyMember(
      req.params.id,
      req.params.memberId,
      req.body,
      req.user
    );
    return res.status(200).json({
      message: "Anggota keluarga berhasil diperbarui",
      data:    member,
    });
  } catch (e) {
    logger.error({ err: e }, "updateMember failed");
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/clients/:id/family/:memberId
// PR-11: Admin only
// ─────────────────────────────────────────────────────────────────────────────

export const deleteMember = async (req, res) => {
  try {
    await removeFamilyMember(req.params.id, req.params.memberId, req.user);
    return res.status(200).json({ message: "Anggota keluarga berhasil dihapus" });
  } catch (e) {
    logger.error({ err: e }, "deleteMember failed");
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
