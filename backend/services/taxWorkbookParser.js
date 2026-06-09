import xlsx from "xlsx";
import { LEGACY_STATUS_MAP, normalizeTaskStatus } from "../constants/taskStatus.js";

const SHEET_TAX_TYPES = {
  "21": "PPH 21",
  "25": "PPH 25",
  UNIFIKASI: "UNIFIKASI",
  PPN: "PPN",
  PHR: "PHR",
  LKPM: "LKPM",
  "BRUTO PP55": "BRUTO PP55",
  "1771 BADAN": "1771 BADAN",
  "1770 OP": "1770 OP",
};

const SKIPPED_SHEET_REASONS = {
  "EFIN OP": "Berisi data credential/EFIN, bukan task pajak bulanan.",
  "EFIN BADAN": "Berisi data credential/EFIN, bukan task pajak bulanan.",
  "EFIN NA": "Berisi data credential/EFIN, bukan task pajak bulanan.",
  "EFIN BACKUP": "Berisi data credential/EFIN, bukan task pajak bulanan.",
  PT: "Sheet referensi lama, bukan workflow task tracker.",
  OP: "Sheet referensi lama, bukan workflow task tracker.",
};

const STAGE_LEVELS = {
  NOT_STARTED: 1,
  IN_PROGRESS: 2,
  WAITING_REVIEW: 3,
  WAITING_SIGNATURE: 4,
  WAITING_CLIENT: 5,
  READY_TO_FILE: 6,
  PAID: 7,
  FILED: 8,
  COMPLETED: 9,
  BLOCKED: 10,
};

const normalizeCellText = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const isPeriodValue = (value) => {
  if (value instanceof Date) return true;
  return /\b20\d{2}\b/.test(normalizeCellText(value));
};

const normalizePeriod = (value) => {
  if (value instanceof Date) {
    return value.toLocaleDateString("id-ID", { month: "long", year: "numeric" }).toUpperCase();
  }

  return normalizeCellText(value);
};

const normalizeStage = (value) => {
  const text = normalizeCellText(value);
  if (!text) return null;
  if (LEGACY_STATUS_MAP[text]) return normalizeTaskStatus(LEGACY_STATUS_MAP[text]);

  try {
    return normalizeTaskStatus(text);
  } catch {
    return null;
  }
};

const isDataRow = (row) => {
  const ordinal = row[0];
  const clientName = normalizeCellText(row[1]);
  return (typeof ordinal === "number" || /^\d+$/.test(String(ordinal ?? ""))) && clientName;
};

const getHigherStatus = (currentStatus, incomingStatus) => {
  if (!currentStatus) return incomingStatus;
  const currentLevel = STAGE_LEVELS[currentStatus] || 0;
  const incomingLevel = STAGE_LEVELS[incomingStatus] || 0;
  return incomingLevel > currentLevel ? incomingStatus : currentStatus;
};

const summarizeRows = (rows, skippedSheets) => {
  const bySheet = {};
  const byTaxType = {};

  for (const row of rows) {
    bySheet[row.sourceSheet] = (bySheet[row.sourceSheet] || 0) + 1;
    byTaxType[row.taxType] = (byTaxType[row.taxType] || 0) + 1;
  }

  return {
    totalRows: rows.length,
    bySheet,
    byTaxType,
    skippedSheets,
    sampleRows: rows.slice(0, 20),
  };
};

const parseTaskSheet = (rows, sourceSheet, taxType) => {
  const parsed = new Map();
  const periodByColumn = {};
  const statusByColumn = {};

  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const nextRow = rows[r + 1] || [];

    if (row.some(isPeriodValue)) {
      let currentPeriod = "";

      for (let c = 0; c < row.length; c += 1) {
        if (isPeriodValue(row[c])) {
          currentPeriod = normalizePeriod(row[c]);
        }
        if (currentPeriod) {
          periodByColumn[c] = currentPeriod;
        }

        const detectedStage = normalizeStage(nextRow[c]);
        if (detectedStage) {
          statusByColumn[c] = detectedStage;
        }
      }
      continue;
    }

    if (!isDataRow(row)) continue;

    const clientName = String(row[1]).trim().replace(/\s+/g, " ");
    const picName = typeof row[2] === "string" ? row[2].trim().replace(/\s+/g, " ") : "";

    for (let c = 2; c < row.length; c += 1) {
      const period = periodByColumn[c];
      const stageStatus = statusByColumn[c];
      if (!period || !stageStatus) continue;

      const cellValue = row[c];
      const cellText = normalizeCellText(cellValue);
      const hasOkMarker = cellText === "OK";
      const amount = typeof cellValue === "number" ? cellValue : null;
      if (!hasOkMarker && amount === null) continue;

      const key = `${taxType}::${clientName.toUpperCase()}::${period}`;
      const existing = parsed.get(key) || {
        clientName,
        picName,
        taxType,
        period,
        status: "NOT_STARTED",
        amount: 0,
        sourceSheet,
        sourceRow: r + 1,
        sourceColumn: c + 1,
      };

      if (hasOkMarker) {
        existing.status = getHigherStatus(existing.status, stageStatus);
      }
      if (amount !== null) {
        existing.amount = Math.max(Number(existing.amount || 0), amount);
      }

      parsed.set(key, existing);
    }
  }

  return Array.from(parsed.values());
};

export const parseTaxWorkbookBuffer = (buffer) => {
  const workbook = xlsx.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const parsedRows = [];
  const skippedSheets = [];

  for (const sheetName of workbook.SheetNames) {
    const taxType = SHEET_TAX_TYPES[sheetName];
    if (!taxType) {
      skippedSheets.push({
        sheet: sheetName,
        reason: SKIPPED_SHEET_REASONS[sheetName] || "Sheet tidak termasuk whitelist pajak operasional.",
      });
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: true,
    });

    parsedRows.push(...parseTaskSheet(rows, sheetName, taxType));
  }

  return {
    rows: parsedRows,
    summary: summarizeRows(parsedRows, skippedSheets),
  };
};
