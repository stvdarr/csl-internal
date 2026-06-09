import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { List, Grid, Trash2 } from "lucide-react";
import api from "../../services/api";
import { socket } from "../../services/socket";

import ExcelUploader from "./ExcelUploader";
import MasterWorkbookUploader from "./MasterWorkbookUploader";
import TaxMatrixView from "./TaxMatrixView";
import TaxListView from "./TaxListView";

const TAX_CATEGORIES = [
  "PPN",
  "PPH 21",
  "PPH 25",
  "UNIFIKASI",
  "PHR",
  "LKPM",
  "BRUTO PP55",
  "1771 BADAN",
  "1770 OP",
];

const TaxTracker = () => {
  const [activeTab, setActiveTab] = useState("PPN");
  const [viewMode, setViewMode] = useState("MATRIX"); // "LIST" | "MATRIX"

  const queryClient = useQueryClient();

  useEffect(() => {
    const handleConnect = () => {
      console.log(
        "🔌 Terhubung ke Real-Time Engine (Socket.id:",
        socket.id,
        ")",
      );
      // REFACTOR: Paksa sinkronisasi total SATU KALI saat koneksi baru pulih (Misal: laptop bangun dari Sleep mode)
      queryClient.invalidateQueries(["taxes"]); 
    };

    // 2. DENGARKAN SINYAL "TAX_UPDATED"
    const handleTaxUpdate = (payload) => {
      console.log("🔔 Sinyal perubahan diterima dari user lain!", payload);

      // REFACTOR: Zero Network Fetch! Gunakan Optimistic Cache Injection untuk mencegah 
      // 50 browser menembak API (DDoS) secara bersamaan saat 1 orang update status.
      queryClient.setQueryData(["taxes"], (oldTaxes) => {
        if (!oldTaxes) return oldTaxes;
        
        // Injeksi perubahan langsung ke dalam memori
        return oldTaxes.map((tax) =>
          // Gunakan String(id) untuk memastikan tipe data cocok (String vs Number safe)
          String(tax.id) === String(payload.id) 
            ? { ...tax, status: payload.newStatus } 
            : tax
        );
      });
    };

    socket.on("connect", handleConnect);
    socket.on("TAX_UPDATED", handleTaxUpdate);

    // Matikan pendengar hanya saat komponen benar-benar hancur
    return () => {
      socket.off("connect", handleConnect);
      socket.off("TAX_UPDATED", handleTaxUpdate);
    };
  }, [queryClient]);

  // Fetch Taxes
  const { data: taxes = [], isLoading } = useQuery({
    queryKey: ["taxes"],
    queryFn: async () => {
      const { data } = await api.get("/tax");
      return data.data;
    },
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      await api.put(`/tax/${id}/status`, { newStatus });
    },
    onMutate: async ({ id, newStatus }) => {
      await queryClient.cancelQueries(["taxes"]);
      const previousTaxes = queryClient.getQueryData(["taxes"]);
      queryClient.setQueryData(["taxes"], (old) =>
        old.map((tax) => (tax.id === id ? { ...tax, status: newStatus } : tax)),
      );
      return { previousTaxes };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(["taxes"], context.previousTaxes);
      alert(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries(["taxes"]);
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await api.delete("/tax/clear-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["taxes"]);
    },
  });

  const uploadBulkMutation = useMutation({
    mutationFn: async (data) => {
      await api.post("/tax/bulk", {
        data,
        uploadedTaxType: activeTab,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["taxes"]);
    },
  });

  const previewWorkbookMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/tax/workbook/preview", formData);
      return data.data;
    },
  });

  const confirmWorkbookMutation = useMutation({
    mutationFn: async (rows) => {
      const { data } = await api.post("/tax/workbook/confirm", { rows });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["taxes"]);
    },
  });

  const handleClearAllData = async () => {
    if (
      window.confirm(
        "💥 PERINGATAN NUKLIR! Seluruh 9 jenis pajak akan DIHAPUS PERMANEN. Lanjutkan?",
      )
    ) {
      clearAllMutation.mutate();
    }
  };

  const filteredTaxes = taxes.filter((t) => t.taxType === activeTab);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        <p className="font-semibold">Memuat Data Pajak...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 p-2 bg-white border shadow-sm rounded-xl border-slate-200">
        {TAX_CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setActiveTab(category)}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200
              ${
                activeTab === category
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Uploader Section */}
      <div className="p-5 bg-white border shadow-sm border-slate-200 rounded-2xl">
        <MasterWorkbookUploader
          onPreview={(file) => previewWorkbookMutation.mutateAsync(file)}
          onConfirm={(rows) => confirmWorkbookMutation.mutateAsync(rows)}
        />
      </div>

      <div className="p-5 bg-white border shadow-sm border-slate-200 rounded-2xl">
        <ExcelUploader
          activeTab={activeTab}
          onUpload={(data) => uploadBulkMutation.mutateAsync(data)}
        />
      </div>

      {/* Action Bar */}
      <div className="flex flex-col justify-between gap-4 p-3 bg-white border shadow-sm sm:flex-row sm:items-center rounded-xl border-slate-200">
        <div className="flex items-center gap-4 px-2">
          <h3 className="text-lg font-black tracking-tight uppercase text-slate-800">
            Laporan {activeTab}
          </h3>
          <button
            onClick={handleClearAllData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg font-bold transition-colors text-xs shadow-sm border border-red-100"
          >
            <Trash2 className="w-3.5 h-3.5" /> Reset Data
          </button>
        </div>

        <div className="flex p-1 border rounded-lg bg-slate-100 border-slate-200">
          <button
            onClick={() => setViewMode("LIST")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === "LIST"
                ? "bg-white shadow-sm text-blue-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setViewMode("MATRIX")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === "MATRIX"
                ? "bg-blue-600 shadow-sm text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> Matrix
          </button>
        </div>
      </div>

      {/* Data Views */}
      <div className="pb-10">
        {viewMode === "MATRIX" ? (
          <TaxMatrixView
            taxes={filteredTaxes}
            activeTab={activeTab}
            onStatusChange={updateStatusMutation.mutate}
          />
        ) : (
          <TaxListView
            taxes={filteredTaxes}
            activeTab={activeTab}
            onStatusChange={updateStatusMutation.mutate}
          />
        )}
      </div>
    </div>
  );
};

export default TaxTracker;
