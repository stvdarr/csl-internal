import { HistoryLog, User } from "../models/index.js";

export const getHistoryLogs = async (req, res) => {
  try {
    // Tarik semua log, gabungkan dengan tabel User untuk mendapatkan nama pelaku,
    // urutkan berdasarkan waktu pembuatan dari yang paling baru
    const logs = await HistoryLog.findAll({
      include: [
        {
          model: User,
          attributes: ["name"], // Kita cuma butuh nama, ga perlu email/password
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({ data: logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil riwayat perubahan." });
  }
};
