import { Eye, Edit2, Building2, User2, Trash2 } from "lucide-react";

const ClientList = ({ clients, isLoading, onView, onEdit, onDelete, isAdmin }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Tidak ada data</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          {isAdmin
            ? "Belum ada klien terdaftar. Klik 'Tambah Klien' untuk mulai."
            : "Belum ada data klien yang dapat ditampilkan."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama & Tipe</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">NPWP</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Kontak</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => {
              const isOP = client.client_type === "ORANG_PRIBADI";
              return (
                <tr
                  key={client.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${isOP ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                        {isOP ? <User2 className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 line-clamp-1">{client.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${isOP ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                            {isOP ? "OP" : "Badan"}
                          </span>
                          {client.group_affiliation && (
                            <span className="text-xs font-medium text-slate-500 line-clamp-1 border-l border-slate-300 pl-2">
                              {client.group_affiliation}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-700 font-mono">
                      {client.npwp_16 || client.npwp_15 || "-"}
                    </div>
                    {client.nik && isOP && (
                      <div className="text-xs text-slate-500 mt-1">NIK: <span className="font-mono">{client.nik}</span></div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                      {client.email1 || "-"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">
                      {client.phone || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                      ${client.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}
                    >
                      {client.status === "ACTIVE" ? "AKTIF" : "NON-AKTIF"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onView(client)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(client)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {onDelete && (
                        <button
                          onClick={() => onDelete(client.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientList;
