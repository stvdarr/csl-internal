import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import { X, Loader2 } from "lucide-react";
import { STATUS_LABELS } from "../../constants/taskStatus";

const WorkloadBreakdown = ({ isOpen, onClose, userId, userName }) => {
  const { data: breakdown, isLoading } = useQuery({
    queryKey: ["workload-breakdown", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await api.get(`/workload/current/${userId}/breakdown`);
      return data.data;
    },
    enabled: !!userId && isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Rincian Beban Kerja
            </h2>
            <p className="text-sm text-slate-500">PIC: {userName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 transition-colors rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* TAX SECTION */}
              <div>
                <h3 className="pb-2 mb-4 text-sm font-bold tracking-wider uppercase border-b text-slate-800 border-slate-200">
                  Tax Obligations Aktif ({breakdown?.taxes?.length || 0})
                </h3>
                {breakdown?.taxes?.length > 0 ? (
                  <div className="grid gap-3">
                    {breakdown.taxes.map((tax) => (
                      <div
                        key={tax.id}
                        className="flex items-center justify-between p-4 bg-white border shadow-sm border-slate-200 rounded-xl"
                      >
                        <div>
                          <div className="font-bold text-slate-800">
                            {tax.clientName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {tax.taxType} • Periode: {tax.period}
                          </div>
                        </div>
                        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-blue-50 text-blue-600 border border-blue-100">
                          {STATUS_LABELS[tax.status] || tax.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm italic text-slate-500">
                    Tidak ada pekerjaan Tax yang aktif.
                  </div>
                )}
              </div>

              {/* TODO SECTION */}
              <div>
                <h3 className="pb-2 mb-4 text-sm font-bold tracking-wider uppercase border-b text-slate-800 border-slate-200">
                  ToDo Aktif ({breakdown?.todos?.length || 0})
                </h3>
                {breakdown?.todos?.length > 0 ? (
                  <div className="grid gap-3">
                    {breakdown.todos.map((todo) => (
                      <div
                        key={todo.id}
                        className="flex items-center justify-between p-4 bg-white border shadow-sm border-slate-200 rounded-xl"
                      >
                        <div>
                          <div className="font-bold text-slate-800">
                            {todo.clientName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {todo.jobType}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {todo.status}
                          </span>
                          {todo.deadline && (
                            <span className="text-[10px] text-slate-400">
                              Deadline:{" "}
                              {new Date(todo.deadline).toLocaleDateString("id-ID")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm italic text-slate-500">
                    Tidak ada ToDo yang aktif.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkloadBreakdown;
