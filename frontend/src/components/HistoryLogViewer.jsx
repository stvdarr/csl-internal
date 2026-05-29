import { useState, useEffect } from "react";
import api from "../services/api";

const HistoryLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await api.get("/history");
        setLogs(response.data.data);
      } catch (err) {
        setError("Gagal memuat log riwayat.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading)
    return (
      <div className="text-gray-600 animate-pulse font-medium">
        Memuat jejak rekam...
      </div>
    );
  if (error)
    return (
      <div className="text-red-600 font-bold p-4 bg-red-50 rounded-md">
        {error}
      </div>
    );

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm mt-4">
      <table className="w-full border-collapse bg-white text-left text-sm text-gray-600">
        <thead className="bg-gray-800 text-xs font-semibold uppercase text-white border-b border-gray-700">
          <tr>
            <th className="px-6 py-4">Waktu</th>
            <th className="px-6 py-4">Tipe Data</th>
            <th className="px-6 py-4">ID Data</th>
            <th className="px-6 py-4">Diubah Oleh</th>
            <th className="px-6 py-4">Perubahan Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {logs.length === 0 ? (
            <tr>
              <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                Belum ada aktivitas terekam.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  {new Date(log.createdAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ${
                      log.recordType === "TAX"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {log.recordType}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono text-gray-500">
                  #{log.recordId}
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">
                  {log.User?.name || "Sistem"}
                </td>
                <td className="px-6 py-4 flex items-center gap-2">
                  <span className="line-through text-gray-400">
                    {log.oldStatus}
                  </span>
                  <span className="text-gray-400">➔</span>
                  <strong className="text-green-600">{log.newStatus}</strong>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryLogViewer;
