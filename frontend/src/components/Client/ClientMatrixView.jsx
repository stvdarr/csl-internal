import { useState } from "react";
import { Eye, EyeOff, Copy, CheckCircle2, Lock, TableProperties } from "lucide-react";

// All possible columns in order.
// isPassword: field is a credential → toggled by show/hide button.
const ALL_COLUMNS = [
  { key: "name",               label: "Nama Klien",          isPassword: false, alwaysShow: true },
  { key: "npwp_15",            label: "NPWP 15",             isPassword: false },
  { key: "npwp_16",            label: "NPWP 16",             isPassword: false },
  { key: "nik",                label: "NIK",                 isPassword: false },
  { key: "efin",               label: "EFIN",                isPassword: false },
  { key: "djp_password",       label: "Password DJP",        isPassword: true },
  { key: "coretax_password",   label: "Password Coretax",    isPassword: true },
  { key: "passphrase",         label: "Passphrase",          isPassword: true },
  { key: "pin_djp",            label: "PIN DJP",             isPassword: true },
  { key: "email1",             label: "Email 1",             isPassword: false },
  { key: "email1_password",    label: "Password Email 1",    isPassword: true },
  { key: "email2",             label: "Email 2",             isPassword: false },
  { key: "email2_password",    label: "Password Email 2",    isPassword: true },
  { key: "oss_username",       label: "Username OSS",        isPassword: false },
  { key: "oss_password",       label: "Password OSS",        isPassword: true },
  { key: "accurate_email",     label: "Email Accurate",      isPassword: false },
  { key: "accurate_password",  label: "Password Accurate",   isPassword: true },
  { key: "bpjs_kes_number",    label: "No. BPJS Kesehatan",  isPassword: false },
  { key: "bpjs_kes_password",  label: "Password BPJS Kes",   isPassword: true },
  { key: "phone",              label: "Telepon",             isPassword: false },
  { key: "address",            label: "Alamat",              isPassword: false },
  { key: "notes",              label: "Catatan",             isPassword: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonMatrix = () => (
  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white">
    <table className="w-full border-collapse min-w-max">
      <thead className="bg-slate-50">
        <tr>
          {Array.from({ length: 8 }).map((_, i) => (
            <th key={i} className="px-4 py-3 border-b border-slate-200">
              <div className="h-3 bg-slate-200 rounded animate-pulse w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {Array.from({ length: 6 }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: 8 }).map((_, c) => (
              <td key={c} className="px-4 py-3 border-r border-slate-100">
                <div
                  className="h-3 bg-slate-100 rounded animate-pulse"
                  style={{ width: `${50 + ((r * 7 + c * 13) % 50)}%` }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const ClientMatrixView = ({ clients = [], isLoading = false, isAdmin = false }) => {
  const [showPasswords, setShowPasswords] = useState(false);
  const [copiedCell, setCopiedCell]       = useState(null); // { clientId, columnKey }

  // ── Copy handler ─────────────────────────────────────────────────────────
  // Uses Clipboard API when available (HTTPS), falls back to execCommand for
  // HTTP dev environments where clipboard API is blocked.
  const copyToClipboard = (text) => {
    // Modern API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => {
        // Silently fall through to execCommand fallback
        legacyCopy(text);
      });
    }
    legacyCopy(text);
    return Promise.resolve();
  };

  const legacyCopy = (text) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    document.body.removeChild(ta);
  };

  const handleCellClick = (rawValue, clientId, columnKey) => {
    if (rawValue == null || rawValue === "") return;
    copyToClipboard(String(rawValue));
    setCopiedCell({ clientId, columnKey });
    setTimeout(() => setCopiedCell(null), 1500);
  };

  // ── Compute visible columns ──────────────────────────────────────────────
  // Hide a column only when every single client has a null/empty value for it.
  // Password columns are hidden if the user is not Admin (backend won't return them anyway).
  const visibleColumns = ALL_COLUMNS.filter((col) => {
    if (col.isPassword && !isAdmin) return false;
    if (col.alwaysShow) return true;
    return clients.some((c) => c[col.key] != null && c[col.key] !== "");
  });

  // ── Render ───────────────────────────────────────────────────────────────
  if (isLoading) return <SkeletonMatrix />;

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-400">
        <TableProperties className="w-10 h-10 mb-3 text-slate-300" />
        <p className="font-semibold text-slate-500">Tidak ada data klien</p>
        <p className="text-sm mt-1">Coba ubah filter atau tambahkan klien baru</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-sm text-slate-500">
          Menampilkan{" "}
          <span className="font-semibold text-slate-800">{clients.length}</span> klien
          {" · "}
          <span className="text-slate-400">Klik sel untuk menyalin</span>
        </p>

        {/* Show/hide passwords — Admin only */}
        {isAdmin && (
          <button
            onClick={() => setShowPasswords((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl shadow-sm border transition-all ${
              showPasswords
                ? "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {showPasswords ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Sembunyikan Password</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Tampilkan Password</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white">
        <table className="w-full border-collapse min-w-max">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 whitespace-nowrap ${
                    col.isPassword ? "text-orange-600" : "text-slate-600"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {col.isPassword && <Lock className="w-3 h-3 inline-block opacity-70" />}
                    {col.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-slate-50/60 transition-colors group">
                {visibleColumns.map((col) => {
                  const rawValue   = client[col.key];
                  const isEmpty    = rawValue == null || rawValue === "";
                  const isCopied   = copiedCell?.clientId === client.id && copiedCell?.columnKey === col.key;
                  const isHidden   = col.isPassword && !showPasswords;

                  // Display value: masked if password hidden
                  const displayValue = isEmpty
                    ? null
                    : isHidden
                    ? "••••••••"
                    : String(rawValue);

                  return (
                    <td
                      key={col.key}
                      title={isEmpty ? undefined : isHidden ? "Klik untuk menyalin (password tersembunyi)" : String(rawValue)}
                      onClick={() => handleCellClick(rawValue, client.id, col.key)}
                      className={`px-4 py-2.5 text-xs border-r border-slate-100 transition-all relative select-none max-w-40 truncate ${
                        isEmpty
                          ? "cursor-default"
                          : "cursor-pointer"
                      } ${
                        isCopied
                          ? "bg-green-50 text-green-700"
                          : isEmpty
                          ? "text-slate-300"
                          : col.isPassword
                          ? "text-orange-700 hover:bg-orange-50"
                          : "text-slate-800 hover:bg-blue-50"
                      }`}
                    >
                      {isEmpty ? (
                        <span className="select-none">—</span>
                      ) : isCopied ? (
                        <span className="flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Tersalin!
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {displayValue}
                          {/* Copy icon appears on hover */}
                          {!isEmpty && (
                            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />
                          )}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-right">
        {visibleColumns.length} kolom ditampilkan
        {isAdmin && !showPasswords && " · Password disembunyikan"}
      </p>
    </div>
  );
};

export default ClientMatrixView;
