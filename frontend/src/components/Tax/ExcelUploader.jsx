import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import * as xlsx from "xlsx";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const ExcelUploader = ({ activeTab, onUpload }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const processExcel = useCallback(async (file) => {
    setIsProcessing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 3) {
        throw new Error("Format file tidak valid. Baris terlalu sedikit.");
      }

      // Find the header row (contains 202X)
      let header1Index = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const rowStr = rows[i].join(" ").toUpperCase();
        if (/202\d/.test(rowStr)) {
          header1Index = i;
          break;
        }
      }

      if (header1Index === -1 || header1Index + 1 >= rows.length) {
        throw new Error("Gagal mendeteksi baris Tahun (202X).");
      }

      const header1 = rows[header1Index];
      const header2 = rows[header1Index + 1];
      
      let currentPeriodHeader = "";
      const periods = [];
      for (let i = 0; i < header1.length; i++) {
        if (header1[i] && typeof header1[i] === "string" && header1[i].trim() !== "") {
          currentPeriodHeader = header1[i].trim();
        } else if (header1[i] && typeof header1[i] === "number") {
          currentPeriodHeader = header1[i].toString();
        }
        periods[i] = currentPeriodHeader;
      }

      const statusHierarchy = {
        DIBUAT: { level: 1, dbValue: "NOT_STARTED" },
        REVIEW: { level: 2, dbValue: "WAITING_REVIEW" },
        TTD: { level: 3, dbValue: "WAITING_SIGNATURE" },
        DIKIRIM: { level: 4, dbValue: "WAITING_CLIENT" },
        BAYAR: { level: 5, dbValue: "PAID" },
        DIBAYAR: { level: 5, dbValue: "PAID" },
        LAPOR: { level: 6, dbValue: "FILED" },
        OK: { level: 7, dbValue: "COMPLETED" },
      };

      const bulkDataMap = {};

      for (let r = header1Index + 2; r < rows.length; r++) {
        const row = rows[r];
        const clientName = row[1]?.toString().trim();
        if (!clientName || clientName === "KARYAWAN" || clientName === "UMKM") continue;

        for (let c = 4; c < row.length; c++) {
          const cellValue = row[c]?.toString().trim().toUpperCase();
          let period = periods[c];
          const excelStage = header2[c]?.toString().trim().toUpperCase();

          if (!period || !excelStage) continue;
          period = period.toString().replace(/\s+/g, " ").trim().toUpperCase();

          if (!/202\d/.test(period)) continue;

          const key = `${clientName}-${period}`;
          if (!bulkDataMap[key]) {
            bulkDataMap[key] = {
              clientName,
              period,
              status: "NOT_STARTED",
              amount: 0,
            };
          }

          if (cellValue === "OK") {
            const incomingStage = statusHierarchy[excelStage];
            if (incomingStage) {
              const currentLevel = Object.values(statusHierarchy).find((s) => s.dbValue === bulkDataMap[key].status)?.level || 0;
              if (incomingStage.level > currentLevel) {
                bulkDataMap[key].status = incomingStage.dbValue;
              }
            }
          } else if (cellValue && cellValue !== "" && !isNaN(Number(cellValue))) {
            bulkDataMap[key].amount = Number(cellValue);
          }
        }
      }

      const finalBulkData = Object.values(bulkDataMap).filter(
        (data) => data.status !== "NOT_STARTED" || data.amount > 0,
      );

      if (finalBulkData.length === 0) {
        throw new Error("Tidak ada data valid ditemukan dari file Excel.");
      }

      await onUpload(finalBulkData);
      setSuccessMsg(`Berhasil memproses ${finalBulkData.length} baris data.`);
    } catch (err) {
      setError(err.message || "Gagal memproses file.");
    } finally {
      setIsProcessing(false);
    }
  }, [onUpload]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      processExcel(acceptedFiles[0]);
    }
  }, [processExcel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  return (
    <div className="w-full">
      <h4 className="text-sm font-bold text-slate-800 mb-1">
        Smart Upload <span className="text-blue-600">[{activeTab}]</span>
      </h4>
      <p className="text-xs text-slate-500 mb-3">
        Drag & Drop file Excel Laporan Bulanan di sini.
      </p>

      <div
        {...getRootProps()}
        className={`w-full h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200
          ${
            isDragActive
              ? "border-blue-500 bg-blue-50 shadow-inner"
              : "border-slate-300 bg-slate-50 hover:bg-slate-100"
          }
          ${isProcessing ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
        ) : (
          <UploadCloud className={`w-6 h-6 mb-2 ${isDragActive ? "text-blue-500" : "text-slate-400"}`} />
        )}
        <p className="text-xs font-semibold text-slate-600">
          {isProcessing ? "Memproses Data..." : isDragActive ? "Lepaskan file di sini" : "Klik atau Drag file .xlsx kesini"}
        </p>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      
      {successMsg && (
        <div className="mt-3 flex items-start gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
};

export default ExcelUploader;
