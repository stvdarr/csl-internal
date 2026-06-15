import { listActivity } from "../services/activityService.js";
import logger from "../utils/logger.js";

export const getHistoryLogs = async (req, res) => {
  try {
    const result = await listActivity(req.query);
    res.status(200).json(result);
  } catch (error) {
    logger.error(error, "Error fetching history logs");
    res.status(500).json({ error: "Gagal mengambil riwayat perubahan." });
  }
};
