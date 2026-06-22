import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Loader2 } from "lucide-react";
import api from "../../services/api";

const ManualObligationModal = ({ isOpen, onClose, activeTab, taxCategories }) => {
  const queryClient = useQueryClient();
  const [clientName, setClientName] = useState("");
  const [taxType, setTaxType] = useState(activeTab);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post("/tax/obligations", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["tax-obligations"]);
      queryClient.invalidateQueries(["taxes"]);
      onClose();
      setClientName("");
    },
    onError: (err) => {
      alert(err.response?.data?.error || err.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    createMutation.mutate({ clientName, taxType });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Tambah Klien ke {activeTab}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 block">Nama Klien</label>
            <input 
              type="text" 
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              placeholder="Masukkan nama klien persis..."
            />
            <p className="text-[10px] text-slate-500">Nama harus sesuai dengan yang ada di master Data Klien agar bisa di-link otomatis.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 block">Jenis Pajak</label>
            <select 
              value={taxType}
              onChange={(e) => setTaxType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
            >
              {taxCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={createMutation.isPending || !clientName.trim()}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualObligationModal;
