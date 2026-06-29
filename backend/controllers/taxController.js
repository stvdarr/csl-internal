
import {
  createTaxObligation,
  listTaxObligations,
  assignTaxObligation,
  listTaxes,
  createTaxTask,
  updateTaxTaskStatus,
  importTaxWorkbookRows,
  getWorkloadSummary,
  getClientTaxOverview,
  resetAllTaxData,
} from "../services/taxService.js";
import { getTaxReminders as getTaxRemindersService } from "../services/taxReminderService.js";
import { parseTaxWorkbookFile } from "../services/taxWorkbookParser.js";
import { cleanupTempFile } from "../middleware/uploadWorkbook.js";
import logger from "../utils/logger.js";
import { ROLES } from "../constants/roles.js";

export const clearAllTaxes = async (req, res) => {
  try {
    const summary = await resetAllTaxData(req.user);
    logger.warn(
      { actorId: req.user.id, ...summary },
      "All tax data cleared by admin",
    );
    res.status(200).json({
      message: "Semua data pajak berhasil di-reset!",
      data: summary,
    });
  } catch (error) {
    logger.error(error, "Error in clearAllTaxes");
    res.status(500).json({ error: `Gagal mereset data: ${error.message}` });
  }
};

// --- OBLIGATION ENDPOINTS ---
export const createObligation = async (req, res) => {
  try {
    const obligation = await createTaxObligation(req.body, req.user);
    res.status(201).json({
      message: "Obligasi pajak berhasil dibuat",
      data: obligation,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: `Gagal membuat obligasi: ${error.message}`,
    });
  }
};

export const getObligations = async (req, res) => {
  try {
    const obligations = await listTaxObligations({
      ...req.query,
      currentUser: req.user,
    });
    res.status(200).json({ data: obligations });
  } catch (error) {
    logger.error(error, "Error in getObligations");
    res.status(500).json({ error: "Gagal mengambil overview pajak klien" });
  }
};

export const getTaxReminders = async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.daysAhead) || 7;
    const reminders = await getTaxRemindersService(req.user, daysAhead);
    res.status(200).json({ data: reminders });
  } catch (error) {
    logger.error(error, "Error in getTaxReminders");
    res.status(500).json({ error: "Gagal mengambil data reminder pajak" });
  }
};


export const assignObligation = async (req, res) => {
  try {
    const { obligationId } = req.params;
    const { toUserId, reason } = req.body;
    const updatedObligation = await assignTaxObligation(
      obligationId,
      toUserId,
      req.user,
      reason,
    );
    res.status(200).json({
      message: "PIC berhasil diperbarui!",
      data: updatedObligation,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: `Gagal mengubah assignment: ${error.message}`,
    });
  }
};

// --- PERIOD ENDPOINTS ---
export const getAllTaxes = async (req, res) => {
  try {
    const result = await listTaxes({ ...req.query, currentUser: req.user });
    res.status(200).json(result);
  } catch (error) {
    logger.error(error, "Error in getAllTaxes");
    res.status(500).json({ error: "Gagal mengambil data pajak" });
  }
};

export const createTax = async (req, res) => {
  try {
    const newTax = await createTaxTask(req.body, req.user);
    res
      .status(201)
      .json({ message: "Data pajak berhasil dibuat", data: newTax });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ error: `Gagal membuat data pajak: ${error.message}` });
  }
};

export const updateTaxStatus = async (req, res) => {
  try {
    const taxData = await updateTaxTaskStatus(
      req.params.periodId,
      req.body.newStatus,
      req.user,
    );
    res
      .status(200)
      .json({ message: "Status pajak berhasil diperbarui!", data: taxData });
  } catch (error) {
    logger.error(error, "Error in updateTaxStatus");
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Gagal mengupdate status pajak" });
  }
};

// --- WORKBOOK ---
export const previewTaxWorkbook = async (req, res) => {
  try {
    if (!req.file?.path) {
      return res.status(400).json({ error: "File workbook wajib diupload" });
    }

    const preview = parseTaxWorkbookFile(req.file.path);
    res.status(200).json({
      message: `${preview.summary.totalRows} baris task terdeteksi dari workbook`,
      data: preview,
    });
  } catch (error) {
    logger.error(error, "Error in previewTaxWorkbook");
    res
      .status(400)
      .json({ error: `Gagal membaca workbook pajak: ${error.message}` });
  } finally {
    if (req.file?.path) {
      await cleanupTempFile(req.file.path);
    }
  }
};

export const confirmTaxWorkbookImport = async (req, res) => {
  try {
    const result = await importTaxWorkbookRows(req.body.rows, req.user);
    res.status(201).json({
      message: `Import selesai: ${result.success} baris berhasil diproses, ${result.failed} baris gagal.`,
      data: result,
    });
  } catch (error) {
    logger.error(error, "Error in confirmTaxWorkbookImport");
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Gagal import workbook pajak" });
  }
};

// --- OTHERS ---
export const getTaxWorkload = async (req, res) => {
  try {
    const workload = await getWorkloadSummary();
    res.status(200).json({ data: workload });
  } catch (error) {
    res
      .status(500)
      .json({ error: `Gagal mengambil workload: ${error.message}` });
  }
};

export const getTaxClients = async (req, res) => {
  try {
    const result = await getClientTaxOverview({
      ...req.query,
      currentUser: req.user,
    });
    res.status(200).json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: `Gagal mengambil data klien: ${error.message}` });
  }
};
