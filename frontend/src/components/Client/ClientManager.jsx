import { useState, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Download, FileSpreadsheet, List, Grid } from "lucide-react";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";
import ClientList from "./ClientList";
import ClientMatrixView from "./ClientMatrixView";
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
  const [viewMode, setViewMode] = useState("LIST");

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

  const handleDelete = async (clientId) => {
    if (!window.confirm("Yakin ingin menghapus klien ini? Data tidak dapat dikembalikan.")) {
      return;
    }

    try {
      await api.delete(`/clients/${clientId}`);
      refetch();
      alert("Klien berhasil dihapus");
    } catch (error) {
      console.error("Delete failed", error);
      alert("Gagal menghapus klien: " + (error.response?.data?.error || error.message));
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col gap-4 justify-between items-start sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Data Klien</h2>
          <p className="text-sm text-slate-500">
            Manajemen profil, kredensial, dan tanggungan klien
          </p>
        </div>
        <div className="flex gap-3 items-center w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex flex-1 gap-2 justify-center items-center px-4 py-2 text-sm font-semibold bg-white rounded-xl border shadow-sm transition-colors sm:flex-none border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          <button
            onClick={handleCreateNew}
            className="flex flex-1 gap-2 justify-center items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl shadow-sm transition-colors sm:flex-none hover:bg-blue-700 shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Klien</span>
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="flex flex-col gap-4 items-end p-4 bg-white rounded-2xl border shadow-sm border-slate-200 lg:flex-row">
        <form onSubmit={handleSearch} className="relative flex-1 w-full">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
            Pencarian
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
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

        <div className="flex p-1 border rounded-xl bg-slate-100 border-slate-200">
          <button
            onClick={() => setViewMode("LIST")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === "LIST"
                ? "bg-white shadow-sm text-blue-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <List className="w-4 h-4" />
            <span>List</span>
          </button>
          <button
            onClick={() => setViewMode("MATRIX")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === "MATRIX"
                ? "bg-blue-600 shadow-sm text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Matrix</span>
          </button>
        </div>
      </div>

      {/* Main View */}
      {viewMode === "MATRIX" ? (
        <ClientMatrixView clients={data?.data || []} />
      ) : (
        <ClientList
          clients={data?.data || []}
          isLoading={isLoading}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isAdmin={isAdmin}
        />
      )}

      {/* Pagination */}
      {data?.totalPages > 1 && (
        <div className="flex justify-between items-center px-4 py-3 bg-white rounded-xl border shadow-sm border-slate-200">
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
          onDelete={handleDelete}
          isAdmin={isAdmin}
          onRefresh={refetch}
        />
      )}
    </div>
  );
};

export default ClientManager;
