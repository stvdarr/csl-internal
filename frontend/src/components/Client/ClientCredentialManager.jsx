
import { useState } from "react";
import { Key, Plus, Trash2, Edit2, X, Check, Eye, EyeOff } from "lucide-react";
import api from "../../services/api";

const ClientCredentialManager = ({ clientId, credentials = [], isAdmin, onRefresh }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [showPasswords, setShowPasswords] = useState({});

  const toggleShowPassword = (id) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleEdit = (cred) => {
    setFormData(cred);
    setEditingId(cred.id);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.label || !formData.value) {
      alert("Label dan Value wajib diisi");
      return;
    }

    const payload = { ...formData };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = undefined;
    });

    try {
      if (editingId) {
        await api.put(`/clients/${clientId}/credentials/${editingId}`, payload);
      } else {
        await api.post(`/clients/${clientId}/credentials`, payload);
      }
      onRefresh();
      resetForm();
    } catch (err) {
      alert("Gagal menyimpan kredensial: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus kredensial ini? (Data tidak dapat dikembalikan)")) return;

    try {
      await api.delete(`/clients/${clientId}/credentials/${id}`);
      onRefresh();
    } catch (err) {
      alert("Gagal menghapus data: " + (err.response?.data?.error || err.message));
    }
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error("Gagal menyalin:", err);
    }
  };

  const sortedCredentials = [...credentials].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
            <Key className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Kredensial</h3>
            <p className="text-xs text-slate-500">Kredensial tambahan untuk klien ini</p>
          </div>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Kredensial
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              <th className="px-4 py-3 font-semibold text-slate-600">Label</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Value</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Tipe</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Inline Form Row (Add / Edit) */}
            {(isAdding || editingId) && (
              <tr className="bg-blue-50/30">
                <td className="px-2 py-2">
                  <input
                    name="label"
                    value={formData.label || ""}
                    onChange={handleChange}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500"
                    placeholder="Nama Kredensial"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    name="value"
                    value={formData.value || ""}
                    onChange={handleChange}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500 font-mono"
                    placeholder="Value"
                    type={formData.field_type === "password" ? "password" : "text"}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    name="field_type"
                    value={formData.field_type || "text"}
                    onChange={handleChange}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500 bg-white"
                  >
                    <option value="text">Text</option>
                    <option value="password">Password</option>
                    <option value="email">Email</option>
                    <option value="number">Number</option>
                  </select>
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={handleSave}
                      className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={resetForm}
                      className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {sortedCredentials.length === 0 && !isAdding && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-slate-500 italic"
                >
                  Belum ada kredensial tambahan.
                </td>
              </tr>
            )}

            {sortedCredentials.map((cred) => {
              if (cred.id === editingId) return null; // Handled by inline form row

              const isPassword = cred.field_type === "password";
              const isVisible = showPasswords[cred.id];

              return (
                <tr key={cred.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{cred.label}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono cursor-pointer ${
                          isPassword ? "text-orange-700" : "text-slate-700"
                        }`}
                        onClick={() => handleCopy(cred.value)}
                      >
                        {isPassword && !isVisible ? "••••••••" : cred.value}
                      </span>
                      {isPassword && (
                        <button
                          onClick={() => toggleShowPassword(cred.id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isVisible ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                      {cred.field_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(cred)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

export default ClientCredentialManager;
