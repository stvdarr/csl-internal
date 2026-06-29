import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import { Calendar, Loader2 } from "lucide-react";

const PerformanceHistory = ({ currentUser }) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["workload-history", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      
      const { data } = await api.get(`/workload/history?${params.toString()}`);
      return data.data;
    },
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Riwayat Performa</h2>
          <p className="text-sm text-slate-500">
            Total pekerjaan yang berhasil diselesaikan berdasarkan rentang waktu.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <Calendar size={16} className="text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-xs p-1 border border-slate-200 rounded outline-none focus:border-blue-400"
          />
          <span className="text-slate-400 text-xs">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-xs p-1 border border-slate-200 rounded outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-6 py-4 border-b border-slate-200">PIC</th>
              <th className="px-6 py-4 border-b border-slate-200 text-center">Tax Selesai (Completed)</th>
              <th className="px-6 py-4 border-b border-slate-200 text-center">ToDo Disetujui (Approved)</th>
              <th className="px-6 py-4 border-b border-slate-200 text-center font-black">Total Prestasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                </td>
              </tr>
            ) : historyData?.length > 0 ? (
              historyData.map((row) => (
                <tr key={row.user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{row.user.name}</div>
                    <div className="text-xs text-slate-500">{row.user.role}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-slate-700">
                    {row.taxCompleted}
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-slate-700">
                    {row.todoApproved}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 text-sm font-black text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
                      {row.totalCompleted}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center text-slate-500 italic">
                  Tidak ada data penyelesaian tugas pada rentang waktu ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PerformanceHistory;
