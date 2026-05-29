import { TaxTrack, HistoryLog, User } from "../models/index.js";

// 1. Fungsi untuk mengambil semua data pajak
export const getAllTaxes = async (req, res) => {
  try {
    // Mengambil data pajak dan menyertakan nama PIC-nya (dari tabel User)
    const taxes = await TaxTrack.findAll({
      include: [{ model: User, attributes: ["name", "email"] }],
    });
    res.status(200).json({ data: taxes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil data pajak" });
  }
};


export const createTax = async (req, res) => {
  try {
    const { clientName, taxType, period, amount } = req.body; // Tambah taxType
    const pic_id = req.user.id;

    const newTax = await TaxTrack.create({
      clientName,
      taxType,
      period,
      amount,
      pic_id,
    });
    res
      .status(201)
      .json({ message: "Data pajak berhasil dibuat", data: newTax });
  } catch (error) {
    res.status(500).json({ error: "Gagal membuat data pajak" });
  }
};

export const updateTaxStatus = async (req, res) => {
  try {
    const { id } = req.params; // ID pajak dari URL (contoh: /api/tax/5)
    const { newStatus } = req.body; // Status baru yang dikirim frontend
    const userId = req.user.id; // ID pegawai yang sedang login

    // Cari data pajak yang lama
    const taxData = await TaxTrack.findByPk(id);
    if (!taxData) {
      return res.status(404).json({ error: "Data pajak tidak ditemukan" });
    }

    const oldStatus = taxData.status;

    // Cegah update jika status barunya sama dengan yang lama
    if (oldStatus === newStatus) {
      return res
        .status(400)
        .json({ error: "Status sudah sama, tidak ada perubahan" });
    }

    // Simpan status baru
    taxData.status = newStatus;
    await taxData.save();

    // Catat ke buku sejarah (History Log)
    await HistoryLog.create({
      recordType: "TAX",
      recordId: id,
      oldStatus: oldStatus,
      newStatus: newStatus,
      updated_by: userId,
    });

    res
      .status(200)
      .json({ message: "Status pajak berhasil diperbarui dan log dicatat!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengupdate status pajak" });
  }
};

export const uploadBulkTaxes = async (req, res) => {
  try {
    const { data, uploadedTaxType } = req.body; // Menerima taxType dari frontend saat upload
    const pic_id = req.user.id;

    const formattedData = data.map((row) => ({
      clientName: row["NAMA WP"] || row.clientName || "Tanpa Nama",
      taxType: uploadedTaxType || "UNIFIKASI", // Gunakan jenis pajak yang dipilih user
      period: row["MASA"] || row.period || "Tidak Diketahui",
      amount: 0,
      status: "DIBUAT",
      pic_id: pic_id,
    }));

    await TaxTrack.bulkCreate(formattedData);
    res
      .status(201)
      .json({
        message: `${formattedData.length} data pajak berhasil diimpor!`,
      });
  } catch (error) {
    res.status(500).json({ error: "Gagal melakukan upload data massal" });
  }
};