import { listActivity } from "../services/taxService.js";

export const getHistoryLogs = async (req, res) => {
  try {
    const logs = await listActivity();
    res.status(200).json({ data: logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil riwayat perubahan." });
  }
};
