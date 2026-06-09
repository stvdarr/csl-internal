import multer from "multer";

const storage = multer.memoryStorage();

export const uploadWorkbook = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const name = file.originalname.toLowerCase();
    const isExcel =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls");

    if (!isExcel) {
      return callback(new Error("File harus berupa .xlsx atau .xls"));
    }

    return callback(null, true);
  },
});
