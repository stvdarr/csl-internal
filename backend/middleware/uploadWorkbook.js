import multer from "multer";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "tmp/uploads");
await fs.mkdir(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const XLS_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const isZipBasedWorkbook = (buffer) =>
  buffer.length >= 4 &&
  buffer[0] === 0x50 &&
  buffer[1] === 0x4b &&
  (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
  (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08);

const isOleWorkbook = (buffer) =>
  buffer.length >= XLS_SIGNATURE.length &&
  buffer.subarray(0, XLS_SIGNATURE.length).equals(XLS_SIGNATURE);

export const isValidWorkbookBuffer = (buffer) =>
  isZipBasedWorkbook(buffer) || isOleWorkbook(buffer);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const uploadWorkbook = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(new Error("File harus berupa .xlsx atau .xls"));
    }

    return callback(null, true);
  },
});

export const validateWorkbookMagicBytes = async (req, res, next) => {
  if (!req.file?.path) {
    return res.status(400).json({ error: "File workbook wajib diunggah" });
  }

  let handle;
  try {
    handle = await fs.open(req.file.path, "r");
    const buffer = Buffer.alloc(8);
    await handle.read(buffer, 0, 8, 0);

    if (!isValidWorkbookBuffer(buffer)) {
      await cleanupTempFile(req.file.path);
      return res.status(400).json({ error: "File bukan format Excel yang valid" });
    }

    return next();
  } catch (err) {
    await cleanupTempFile(req.file.path);
    return next(err);
  } finally {
    if (handle) await handle.close();
  }
};

export const cleanupTempFile = async (filePath) => {
  try {
    if (filePath) {
      await fs.unlink(filePath);
    }
  } catch (err) {
    console.error("Failed to cleanup temp file:", err);
  }
};
