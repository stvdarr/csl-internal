import { useState, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Download, FileSpreadsheet } from "lucide-react";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";
import ClientList from "./ClientList";
import ClientForm from "./ClientForm";
import ClientDetailModal from "./ClientDetailModal";

const ClientManager = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === ROLES.ADMIN;

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [clientType, setClientType] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [viewingClient, setViewingClient] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["clients", { search, clientType, statusFilter, page }],
    queryFn: () =>
      api
        .get("/clients", {
          params: {
            search: search || undefined,
            client_type: clientType || undefined,
            status: statusFilter || undefined,
            page,
            limit: 20,
          },
        })
        .then((r) => r.data),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/clients/export", {
        params: {
          client_type: clientType || undefined,
          status: statusFilter || undefined,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      // Get filename from Content-Disposition if possible, fallback to default
      const contentDisposition = res.headers["content-disposition"];
      let filename = `Data_Klien_CSL_${Date.now()}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
      alert("Gagal mengekspor data");
    }
  };

  const handleCreateNew = () => {
    setEditingClient(null);
    setShowForm(true);
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleView = (client) => {
    setViewingClient(client.id);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Data Klien</h2>
          <p className="text-sm text-slate-500">
            Manajemen profil, kredensial, dan tanggungan klien
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          {isAdmin && (
            <button
              onClick={handleCreateNew}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Klien</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4 items-end">
        <form onSubmit={handleSearch} className="flex-1 w-full relative">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
            Pencarian
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, NPWP, NIK..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
            />
          </div>
        </form>

        <div className="w-full lg:w-48">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
            Tipe Klien
          </label>
          <select
            value={clientType}
            onChange={(e) => {
              setClientType(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
          >
            <option value="">Semua Tipe</option>
            <option value="ORANG_PRIBADI">Orang Pribadi</option>
            <option value="BADAN">Badan</option>
          </select>
        </div>

        <div className="w-full lg:w-48">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Non-Aktif</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      <ClientList
        clients={data?.data || []}
        isLoading={isLoading}
        onView={handleView}
        onEdit={handleEdit}
        isAdmin={isAdmin}
      />

      {/* Pagination */}
      {data?.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm text-slate-500">
            Halaman <span className="font-semibold text-slate-900">{data.page}</span> dari{" "}
            <span className="font-semibold text-slate-900">{data.totalPages}</span>
            {" "} ({data.total} total data)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <ClientForm
          client={editingClient}
          onSuccess={handleFormSuccess}
          onClose={() => setShowForm(false)}
          isAdmin={isAdmin}
        />
      )}

      {viewingClient && (
        <ClientDetailModal
          clientId={viewingClient}
          onClose={() => setViewingClient(null)}
          onEdit={(c) => {
            setViewingClient(null);
            handleEdit(c);
          }}
          isAdmin={isAdmin}
          onRefresh={refetch}
        />
      )}
    </div>
  );
};

export default ClientManager;
