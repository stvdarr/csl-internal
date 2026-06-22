import { useState } from "react";
import { Users, Plus, Trash2, Edit2, X, Check } from "lucide-react";
import api from "../../services/api";

const ClientFamilyTable = ({ clientId, familyMembers = [], isAdmin, onRefresh }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleEdit = (member) => {
    setFormData(member);
    setEditingId(member.id);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.relationship) {
      alert("Nama dan Hubungan wajib diisi");
      return;
    }

    const payload = { ...formData };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = undefined;
    });

    try {
      if (editingId) {
        await api.put(`/clients/${clientId}/family/${editingId}`, payload);
      } else {
        await api.post(`/clients/${clientId}/family`, payload);
      }
      onRefresh();
      resetForm();
    } catch (err) {
      alert("Gagal menyimpan data tanggungan: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus tanggungan ini? (Data tidak dapat dikembalikan)")) return;

    try {
      await api.delete(`/clients/${clientId}/family/${id}`);
      onRefresh();
    } catch (err) {
      alert("Gagal menghapus data: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Daftar Tanggungan</h3>
            <p className="text-xs text-slate-500">Anggota keluarga yang masuk dalam PTKP</p>
          </div>
        </div>
        {isAdmin && !isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Tanggungan
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              <th className="px-4 py-3 font-semibold text-slate-600">NIK</th>
              <th className="px-4 py-3 font-semibold text-slate-600">NPWP</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Nama</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Tgl Lahir</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Hubungan</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Pekerjaan</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status PTKP</th>
              {isAdmin && <th className="px-4 py-3 font-semibold text-slate-600 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            
            {/* Inline Form Row (Add / Edit) */}
            {(isAdding || editingId) && (
              <tr className="bg-blue-50/30">
                <td className="px-2 py-2"><input name="nik" value={formData.nik || ""} onChange={handleChange} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500 font-mono" placeholder="NIK" /></td>
                <td className="px-2 py-2"><input name="npwp" value={formData.npwp || ""} onChange={handleChange} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500 font-mono" placeholder="NPWP" /></td>
                <td className="px-2 py-2"><input name="name" value={formData.name || ""} onChange={handleChange} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500" placeholder="Nama Lengkap" /></td>
                <td className="px-2 py-2"><input type="date" name="birth_date" value={formData.birth_date || ""} onChange={handleChange} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500" /></td>
                <td className="px-2 py-2">
                  <select name="relationship" value={formData.relationship || ""} onChange={handleChange} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500 bg-white">
                    <option value="">Pilih...</option>
                    <option value="SUAMI">Suami</option>
                    <option value="ISTRI">Istri</option>
                    <option value="ANAK">Anak</option>
                    <option value="TANGGUNGAN_LAIN">Lainnya</option>
                  </select>
                </td>
                <td className="px-2 py-2"><input name="occupation" value={formData.occupation || ""} onChange={handleChange} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500" placeholder="Pekerjaan" /></td>
                <td className="px-2 py-2"><input name="ptkp_status" value={formData.ptkp_status || ""} onChange={handleChange} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500" placeholder="TK/0" /></td>
                <td className="px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={handleSave} className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={resetForm} className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            )}

            {familyMembers.length === 0 && !isAdding && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-sm text-slate-500 italic">
                  Belum ada data tanggungan.
                </td>
              </tr>
            )}

            {familyMembers.map((member) => {
              if (member.id === editingId) return null; // Handled by inline form row
              
              return (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-700">{member.nik || "-"}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{member.npwp || "-"}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{member.name}</td>
                  <td className="px-4 py-3 text-slate-600">{member.birth_date || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                      {member.relationship}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{member.occupation || "-"}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{member.ptkp_status || "-"}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(member)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(member.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientFamilyTable;
