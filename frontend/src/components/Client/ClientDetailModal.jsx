import { useQuery } from "@tanstack/react-query";
import { X, Building2, User2, MapPin, Phone, Mail, FileText, CreditCard, Clock, Calendar, Edit2, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import api from "../../services/api";
import ClientFamilyTable from "./ClientFamilyTable";
import ClientCredentialManager from "./ClientCredentialManager";
import { useState } from "react";

const PasswordField = ({ label, value }) => {
  const [visible, setVisible] = useState(false);
  if (!value) return (
    <div className="py-2 border-b border-slate-100 last:border-0">
      <div className="text-xs font-semibold text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm font-medium text-slate-400 italic">Belum diatur</div>
    </div>
  );

  return (
    <div className="py-2 border-b border-slate-100 last:border-0">
      <div className="text-xs font-semibold text-slate-500 mb-0.5">{label}</div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-900 font-mono tracking-wider">
          {visible ? value : "••••••••"}
        </div>
        <button
          onClick={() => setVisible(!visible)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
        >
          {visible ? "Sembunyikan" : "Tampilkan"}
        </button>
      </div>
    </div>
  );
};

const Section = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
      <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <h3 className="font-bold text-slate-900">{title}</h3>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const Field = ({ label, value, isMonospace }) => (
  <div className="py-2 border-b border-slate-100 last:border-0">
    <div className="text-xs font-semibold text-slate-500 mb-0.5">{label}</div>
    <div className={`text-sm font-medium ${!value ? "text-slate-400 italic" : "text-slate-900"} ${isMonospace ? "font-mono" : ""}`}>
      {value || "-"}
    </div>
  </div>
);

const ClientDetailModal = ({ clientId, onClose, onEdit, onDelete, isAdmin, onRefresh }) => {
  const { data: client, isLoading, refetch } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => api.get(`/clients/${clientId}`).then((res) => res.data.data),
  });

  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm("Yakin ingin menghapus klien ini? Data tidak dapat dikembalikan.")) return;

    setIsDeleting(true);
    try {
      await onDelete(clientId);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!isAdmin) return;
    
    const newStatus = client.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const actionText = client.status === "ACTIVE" ? "menonaktifkan" : "mengaktifkan";
    
    if (!window.confirm(`Yakin ingin ${actionText} klien ini?`)) return;

    setIsChangingStatus(true);
    try {
      await api.patch(`/clients/${clientId}/status`, { status: newStatus });
      refetch();
      onRefresh(); // Refresh the list behind the modal too
    } catch (error) {
      alert("Gagal mengubah status: " + (error.response?.data?.error || error.message));
    } finally {
      setIsChangingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 flex items-center gap-4">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium text-slate-700">Memuat profil...</span>
        </div>
      </div>
    );
  }

  if (!client) return null;

  const isOP = client.client_type === "ORANG_PRIBADI";
  const isActive = client.status === "ACTIVE";

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-slate-50 w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{client.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${isOP ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    {isOP ? "Orang Pribadi" : "Badan"}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {isActive ? "Aktif" : "Non-Aktif"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={handleToggleStatus}
                  disabled={isChangingStatus}
                  className={`p-2 rounded-lg border transition-colors ${
                    isActive 
                      ? "text-red-600 hover:bg-red-50 border-red-200 bg-white" 
                      : "text-emerald-600 hover:bg-emerald-50 border-emerald-200 bg-white"
                  } disabled:opacity-50`}
                  title={isActive ? "Non-Aktifkan Klien" : "Aktifkan Klien"}
                >
                  {isActive ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50 bg-white"
                  title="Hapus Klien"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => onEdit(client)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Section title="Data Pokok" icon={isOP ? User2 : Building2}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <Field label="Nama Terdaftar" value={client.name} />
              <Field label="NPWP 15 Digit" value={client.npwp_15} isMonospace />
              <Field label="NPWP 16 Digit" value={client.npwp_16} isMonospace />
              <Field label="EFIN" value={client.efin} isMonospace />
              {isOP && <Field label="NIK" value={client.nik} isMonospace />}
              <Field label="No. Telepon / HP" value={client.phone} />
              {isOP && <Field label="Afiliasi / Grup" value={client.group_affiliation} />}
              <div className="md:col-span-2">
                <Field label="Alamat" value={client.address} />
              </div>
            </div>
          </Section>

          <Section title="Profil DJP" icon={FileText}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <Field label="Status NPWP" value={client.npwp_status} />
              <Field label="Tgl Daftar" value={client.registered_date} />
              <Field label="Tgl Aktivasi" value={client.activation_date} />
              <Field label="Status PKP" value={client.pkp_status ? "PKP" : "Non-PKP"} />
              {client.pkp_status && <Field label="Tgl PKP" value={client.pkp_date} />}
              <Field label="Kode KLU" value={client.klu_code} isMonospace />
              <div className="md:col-span-2"><Field label="Deskripsi KLU" value={client.klu_description} /></div>
              <Field label="Kanwil" value={client.kanwil} />
              <Field label="KPP" value={client.kpp} />
              <Field label="Seksi Pengawasan" value={client.supervision_section} />
            </div>
          </Section>

          <Section title="Kredensial DJP" icon={CreditCard}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <PasswordField label="Password DJP Online" value={client.djp_password} />
              <PasswordField label="Password Coretax" value={client.coretax_password} />
              <PasswordField label="Passphrase" value={client.passphrase} />
              <PasswordField label="PIN DJP" value={client.pin_djp} />
            </div>
          </Section>

          <Section title="Kredensial Email" icon={Mail}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <Field label="Email Utama" value={client.email1} />
              <PasswordField label="Password Email Utama" value={client.email1_password} />
              <Field label="Email Kedua" value={client.email2} />
              <PasswordField label="Password Email Kedua" value={client.email2_password} />
            </div>
          </Section>

          {/* Dynamic Credentials */}
          <ClientCredentialManager
            clientId={client.id}
            credentials={client.Credentials}
            isAdmin={isAdmin}
            onRefresh={refetch}
          />

          {/* Legacy Credentials (Data Lama) */}
          {(client.oss_username || client.oss_password || client.accurate_email || client.accurate_password || client.bpjs_kes_number || client.bpjs_kes_password) && (
            <Section title="Kredensial Lainnya (Data Lama)" icon={Building2}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                <Field label="Username OSS" value={client.oss_username} />
                <PasswordField label="Password OSS" value={client.oss_password} />
                <Field label="Email Accurate" value={client.accurate_email} />
                <PasswordField label="Password Accurate" value={client.accurate_password} />
                <Field label="No. BPJS Kesehatan" value={client.bpjs_kes_number} />
                <PasswordField label="Password BPJS" value={client.bpjs_kes_password} />
              </div>
            </Section>
          )}

          {client.notes && (
            <Section title="Catatan Internal" icon={FileText}>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</p>
            </Section>
          )}

          {isOP && (
            <ClientFamilyTable
              clientId={client.id}
              familyMembers={client.FamilyMembers}
              isAdmin={isAdmin}
              onRefresh={refetch}
            />
          )}

        </div>

        {/* Footer Audit */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between text-[11px] font-medium text-slate-500 uppercase tracking-wide">
          <div>
            Dibuat: {client.CreatedBy?.name || "System"} ({new Date(client.createdAt).toLocaleDateString("id-ID")})
          </div>
          {client.UpdatedBy && (
            <div>
              Diperbarui: {client.UpdatedBy?.name || "System"} ({new Date(client.updatedAt).toLocaleDateString("id-ID")})
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ClientDetailModal;
