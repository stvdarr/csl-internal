import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";

const MasterWorkbookUploader = ({ onPreview, onConfirm }) => {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleFile = useCallback(async (file) => {
    setError("");
    setSuccessMessage("");
    setPreview(null);
    setIsPreviewing(true);

    try {
      const result = await onPreview(file);
      setPreview(result);
    } catch (err) {
      console.error("Error previewing workbook:", err);
      setError(err.response?.data?.error || "Gagal membaca workbook.");
    } finally {
      setIsPreviewing(false);
    }
  }, [onPreview]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      handleFile(acceptedFiles[0]);
    }
  }, [handleFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const handleConfirm = async () => {
    if (!preview?.rows?.length) return;
    setError("");
    setSuccessMessage("");
    setIsImporting(true);

    try {
      const result = await onConfirm(preview.rows);
      setSuccessMessage(result.message);
      setPreview(null);
    } catch (err) {
      setError(err.response?.data?.error || "Gagal import workbook.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Upload Master Workbook</h4>
          <p className="text-xs text-slate-500">
            Upload satu file Excel untuk semua sheet pajak. Sheet EFIN akan dilewati otomatis.
          </p>
        </div>
        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
      </div>

      <div
        {...getRootProps()}
        className={`flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          isDragActive
            ? "border-emerald-500 bg-emerald-50"
            : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        } ${isPreviewing ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        {isPreviewing ? (
          <Loader2 className="w-6 h-6 mb-2 animate-spin text-emerald-600" />
        ) : (
          <UploadCloud className="w-6 h-6 mb-2 text-slate-400" />
        )}
        <p className="text-xs font-semibold text-slate-600">
          {isPreviewing ? "Membaca semua sheet..." : "Klik atau drag workbook .xlsx ke sini"}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 text-xs font-medium text-red-700 border border-red-100 rounded-lg bg-red-50">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-2 p-3 text-xs font-medium border rounded-lg border-emerald-100 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {preview && (
        <div className="p-4 bg-white border rounded-xl border-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Preview Import</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {preview.summary.totalRows.toLocaleString("id-ID")} task terdeteksi
              </p>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isImporting || preview.summary.totalRows === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white transition-colors rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Import
            </button>
          </div>

          <div className="grid gap-3 mt-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">Sheet Pajak</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(preview.summary.bySheet).map(([sheet, count]) => (
                  <span key={sheet} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {sheet}: {count}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">Sheet Dilewati</p>
              <div className="flex flex-wrap gap-2">
                {preview.summary.skippedSheets.map((sheet) => (
                  <span key={sheet.sheet} title={sheet.reason} className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    {sheet.sheet}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-auto border rounded-lg max-h-44 border-slate-200">
            <table className="w-full text-xs text-left text-slate-600">
              <thead className="sticky top-0 font-bold uppercase bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Sheet</th>
                  <th className="px-3 py-2">Klien</th>
                  <th className="px-3 py-2">PIC</th>
                  <th className="px-3 py-2">Periode</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.summary.sampleRows.map((row, index) => (
                  <tr key={`${row.sourceSheet}-${row.sourceRow}-${index}`}>
                    <td className="px-3 py-2 font-semibold">{row.sourceSheet}</td>
                    <td className="px-3 py-2">{row.clientName}</td>
                    <td className="px-3 py-2">{row.picName || "-"}</td>
                    <td className="px-3 py-2">{row.period}</td>
                    <td className="px-3 py-2 font-bold text-slate-800">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterWorkbookUploader;
