import {
  getCurrentWorkload as getCurrentWorkloadService,
  getWorkloadBreakdown as getWorkloadBreakdownService,
  getHistoricalPerformance as getHistoricalPerformanceService,
} from "../services/workloadService.js";
import logger from "../utils/logger.js";

export const getCurrentWorkload = async (req, res) => {
  try {
    const { userId } = req.query;
    
    // Scoping for Staff
    const targetUserId = req.user.role === "Admin" ? userId : req.user.id;
    
    const result = await getCurrentWorkloadService({ targetUserId });
    res.status(200).json(result);
  } catch (error) {
    logger.error(error, "Error in getCurrentWorkload");
    res.status(500).json({ error: "Gagal mengambil data beban kerja aktif" });
  }
};

export const getWorkloadBreakdown = async (req, res) => {
  try {
    const { userId } = req.params;

    // Ownership check
    if (req.user.role !== "Admin" && Number(userId) !== req.user.id) {
      return res.status(403).json({ error: "Akses Ditolak" });
    }

    const result = await getWorkloadBreakdownService({ userId: Number(userId) });
    res.status(200).json(result);
  } catch (error) {
    logger.error(error, "Error in getWorkloadBreakdown");
    res.status(500).json({ error: "Gagal mengambil rincian beban kerja" });
  }
};

export const getHistoricalPerformance = async (req, res) => {
  try {
    const { userId, dateFrom, dateTo } = req.query;

    // Scoping for Staff
    const targetUserId = req.user.role === "Admin" ? userId : req.user.id;

    const result = await getHistoricalPerformanceService({
      targetUserId,
      dateFrom,
      dateTo,
    });
    res.status(200).json(result);
  } catch (error) {
    logger.error(error, "Error in getHistoricalPerformance");
    res.status(500).json({ error: "Gagal mengambil histori performa" });
  }
};
