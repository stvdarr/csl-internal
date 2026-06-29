import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { List, Grid, Trash2 } from "lucide-react";
import api from "../../services/api";
import { socket } from "../../services/socket";

import MasterWorkbookUploader from "./MasterWorkbookUploader";
import TaxMatrixView from "./TaxMatrixView";
import TaxListView from "./TaxListView";
import ManualObligationModal from "./ManualObligationModal";
import TaxReminderBanner from "./TaxReminderBanner";
import { CLEAR_ALL_TAX_CONFIRMATION } from "../../constants/destructiveActions";

const TAX_FETCH_LIMIT = 100;

const fetchTaxesForType = async (taxType, year) => {
  const all = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const { data } = await api.get("/tax", {
      params: { taxType, year, page, limit: TAX_FETCH_LIMIT },
    });
    all.push(...data.data);
    totalPages = data.totalPages;
    page++;
  }

  return all;
};

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
  const [viewMode, setViewMode] = useState("MATRIX");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [highlightedCell, setHighlightedCell] = useState(null); // { obligationId, period }

  const queryClient = useQueryClient();

  useEffect(() => {
    const handleConnect = () => {
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
      queryClient.invalidateQueries({ queryKey: ["tax-obligations"] });
    };

    const handleTaxUpdate = (payload) => {
      queryClient.setQueriesData({ queryKey: ["taxes"] }, (oldTaxes) => {
        if (!oldTaxes) return oldTaxes;

        return oldTaxes.map((tax) =>
          String(tax.id) === String(payload.id)
            ? { ...tax, status: payload.status }
            : tax,
        );
      });

      // Also invalidate obligations query, because PIC assignment affects it
      queryClient.invalidateQueries({ queryKey: ["tax-obligations"] });
    };

    socket.on("connect", handleConnect);
    socket.on("TAX_UPDATED", handleTaxUpdate);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("TAX_UPDATED", handleTaxUpdate);
    };
  }, [queryClient]);

  const { data: taxes = [], isLoading: taxesLoading } = useQuery({
    queryKey: ["taxes", activeTab, selectedYear],
    queryFn: () => fetchTaxesForType(activeTab, selectedYear),
  });

  const { data: obligations = [], isLoading: obligationsLoading } = useQuery({
    queryKey: ["tax-obligations", activeTab, selectedYear],
    queryFn: async () => {
      const { data } = await api.get("/tax/obligations", {
        params: { taxType: activeTab, year: selectedYear },
      });
      return data.data;
    },
  });

  const isLoading = taxesLoading || obligationsLoading;

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      await api.put(`/tax/periods/${id}/status`, { newStatus });
    },
    onMutate: async ({ id, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["taxes"] });
      const previousTaxes = queryClient.getQueryData(["taxes", activeTab, selectedYear]);
      queryClient.setQueryData(["taxes", activeTab, selectedYear], (old) =>
        old.map((tax) => (tax.id === id ? { ...tax, status: newStatus } : tax)),
      );
      return { previousTaxes };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(["taxes", activeTab, selectedYear], context.previousTaxes);
      alert(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await api.delete("/tax/clear-all", {
        data: { confirmation: CLEAR_ALL_TAX_CONFIRMATION },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
      queryClient.invalidateQueries({ queryKey: ["tax-obligations"] });
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
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
      queryClient.invalidateQueries({ queryKey: ["tax-obligations"] });
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

  const handleNavigateToCell = (taxType, obligationId, period) => {
    setActiveTab(taxType);
    setViewMode("MATRIX");
    setHighlightedCell({ obligationId, period });
    
    const yearMatch = period.match(/\d{4}/);
    if (yearMatch) {
      setSelectedYear(Number(yearMatch[0]));
    }
  };

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
      <TaxReminderBanner onNavigateToCell={handleNavigateToCell} />
      
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

      <div className="p-5 bg-white border shadow-sm border-slate-200 rounded-2xl">
        <MasterWorkbookUploader
          onPreview={(file) => previewWorkbookMutation.mutateAsync(file)}
          onConfirm={(rows) => confirmWorkbookMutation.mutateAsync(rows)}
        />
      </div>

      <div className="flex flex-col justify-between gap-4 p-3 bg-white border shadow-sm sm:flex-row sm:items-center rounded-xl border-slate-200">
        <div className="flex items-center gap-4 px-2">
          <h3 className="text-lg font-black tracking-tight uppercase text-slate-800">
            Laporan {activeTab}
          </h3>
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold transition-colors text-xs shadow-sm border border-blue-100"
          >
            + Klien Manual
          </button>
          <button
            onClick={handleClearAllData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg font-bold transition-colors text-xs shadow-sm border border-red-100"
          >
            <Trash2 className="w-3.5 h-3.5" /> Reset Data
          </button>
        </div>

        <div className="flex p-1 border rounded-lg bg-slate-100 border-slate-200">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-white border-r border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 outline-none rounded-l-md"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
          <button
            onClick={() => setViewMode("LIST")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold transition-all ${
              viewMode === "LIST"
                ? "bg-white shadow-sm text-blue-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setViewMode("MATRIX")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-r-md transition-all ${
              viewMode === "MATRIX"
                ? "bg-blue-600 shadow-sm text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> Matrix
          </button>
        </div>
      </div>

      <div className="pb-10">
        {viewMode === "MATRIX" ? (
          <TaxMatrixView
            taxes={taxes}
            obligations={obligations}
            activeTab={activeTab}
            selectedYear={selectedYear}
            onStatusChange={updateStatusMutation.mutate}
            highlightedCell={highlightedCell}
            clearHighlightedCell={() => setHighlightedCell(null)}
          />
        ) : (
          <TaxListView
            taxes={taxes}
            activeTab={activeTab}
            onStatusChange={updateStatusMutation.mutate}
          />
          )}
      </div>

      <ManualObligationModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        activeTab={activeTab}
        taxCategories={TAX_CATEGORIES}
      />
    </div>
  );
};

export default TaxTracker;
