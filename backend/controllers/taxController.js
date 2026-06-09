import {
  assignTaxTask,
  bulkCreateTaxTasks,
  createTaxTask,
  getClientTaxOverview,
  getWorkloadSummary,
  importTaxWorkbookRows,
  listTaxes,
  updateTaxTaskStatus,
} from "../services/taxService.js";
import { parseTaxWorkbookBuffer } from "../services/taxWorkbookParser.js";

export const getAllTaxes = async (req, res) => {
  try {
    const taxes = await listTaxes(req.query);
    res.status(200).json({ data: taxes });
  } catch (error) {
    console.error(error);
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
    res.status(500).json({ error: `Gagal membuat data pajak: ${error.message}` });
  }
};

export const updateTaxStatus = async (req, res) => {
  try {
    // 1. Simpan ke database
    const taxData = await updateTaxTaskStatus(
      req.params.id,
      req.body.newStatus,
      req.user,
    );

    // 2. Tiup peluit Socket.io
    const io = req.app.get("io");
    if (io) {
      console.log(
        `📣 [BACKEND] Memancarkan sinyal perubahan untuk Pajak ID: ${req.params.id}`,
      );

      io.emit("TAX_UPDATED", {
        id: req.params.id,
        newStatus: req.body.newStatus,
      });
    } else {
      console.log(
        "❌ [BACKEND] Gagal memancarkan sinyal: Objek 'io' tidak ditemukan!",
      );
    }

    res
      .status(200)
      .json({ message: "Status pajak berhasil diperbarui!", data: taxData });
  } catch (error) {
    console.error(error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Gagal mengupdate status pajak" });
  }
};

export const uploadBulkTaxes = async (req, res) => {
  try {
    const { data, uploadedTaxType } = req.body;
    const created = await bulkCreateTaxTasks(data, uploadedTaxType, req.user);
    res
      .status(201)
      .json({
        message: `${created.length} data pajak berhasil diimpor!`,
        data: created,
      });
  } catch (error) {
    res.status(500).json({ error: `Gagal melakukan upload data massal: ${error.message}` });
  }
};

export const previewTaxWorkbook = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: "File workbook wajib diupload" });
    }

    const preview = parseTaxWorkbookBuffer(req.file.buffer);
    res.status(200).json({
      message: `${preview.summary.totalRows} baris task terdeteksi dari workbook`,
      data: preview,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: `Gagal membaca workbook pajak: ${error.message}` });
  }
};

export const confirmTaxWorkbookImport = async (req, res) => {
  try {
    const result = await importTaxWorkbookRows(req.body.rows, req.user);
    res.status(201).json({
      message: `Import selesai: ${result.created} dibuat, ${result.updated} diperbarui, ${result.unchanged} tanpa perubahan.`,
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: `Gagal import workbook pajak: ${error.message}` });
  }
};

export const assignTax = async (req, res) => {
  try {
    const taxData = await assignTaxTask(req.params.id, req.body.toUserId, req.user, req.body.reason);
    res.status(200).json({ message: "Assignment pajak berhasil diperbarui", data: taxData });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: `Gagal mengubah assignment: ${error.message}` });
  }
};

export const getTaxWorkload = async (req, res) => {
  try {
    const workload = await getWorkloadSummary();
    res.status(200).json({ data: workload });
  } catch (error) {
    res.status(500).json({ error: `Gagal mengambil workload: ${error.message}` });
  }
};

export const getTaxClients = async (req, res) => {
  try {
    const clients = await getClientTaxOverview();
    res.status(200).json({ data: clients });
  } catch (error) {
    res.status(500).json({ error: `Gagal mengambil data klien: ${error.message}` });
  }
};
