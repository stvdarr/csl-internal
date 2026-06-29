import { useState } from "react";
import {
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import api from "../../services/api";

const PasswordField = ({ label, name, value, onChange }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="ml-1 text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value || ""}
          onChange={onChange}
          className="w-full px-4 py-2.5 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
        >
          {visible ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};

// InputField sekarang ada di luar supaya nggak kena re-mount tiap form ngetik
const InputField = ({
  label,
  name,
  type = "text",
  required = false,
  isTextarea = false,
  disabled = false,
  value,
  onChange,
  error,
}) => {
  const hasError = !!error;
  const Component = isTextarea ? "textarea" : "input";
  return (
    <div className="space-y-1.5">
      <label className="ml-1 text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Component
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        required={required}
        disabled={disabled}
        rows={isTextarea ? 3 : undefined}
        className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all ${
          hasError
            ? "border-red-300 focus:border-red-500 focus:ring-red-500/10 bg-red-50/50"
            : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/10"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      />
      {hasError && <p className="mt-1 ml-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

const ClientForm = ({ client, onSuccess, onClose, isAdmin }) => {
  const isEdit = !!client;
  const [activeTab, setActiveTab] = useState("DATA_POKOK");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  const [formData, setFormData] = useState({
    client_type: client?.client_type || "ORANG_PRIBADI",
    name: client?.name || "",
    npwp_15: client?.npwp_15 || "",
    npwp_16: client?.npwp_16 || "",
    nik: client?.nik || "",
    efin: client?.efin || "",
    phone: client?.phone || "",
    address: client?.address || "",
    group_affiliation: client?.group_affiliation || "",
    npwp_status: client?.npwp_status || "AKTIF",
    notes: client?.notes || "",
    registered_date: client?.registered_date || "",
    activation_date: client?.activation_date || "",
    pkp_status: client?.pkp_status || false,
    pkp_date: client?.pkp_date || "",
    klu_code: client?.klu_code || "",
    klu_description: client?.klu_description || "",
    kanwil: client?.kanwil || "",
    kpp: client?.kpp || "",
    supervision_section: client?.supervision_section || "",
    djp_password: client?.djp_password || "",
    coretax_password: client?.coretax_password || "",
    passphrase: client?.passphrase || "",
    pin_djp: client?.pin_djp || "",
    email1: client?.email1 || "",
    email1_password: client?.email1_password || "",
    email2: client?.email2 || "",
    email2_password: client?.email2_password || "",
    oss_username: client?.oss_username || "",
    oss_password: client?.oss_password || "",
    accurate_email: client?.accurate_email || "",
    accurate_password: client?.accurate_password || "",
    bpjs_kes_number: client?.bpjs_kes_number || "",
    bpjs_kes_password: client?.bpjs_kes_password || "",
  });

  const isOP = formData.client_type === "ORANG_PRIBADI";

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setIsDirty(true);
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (
        !window.confirm(
          "Ada perubahan yang belum disimpan. Yakin ingin menutup?",
        )
      ) {
        return;
      }
    }
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = { ...formData };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "") payload[k] = undefined;
      });

      if (isEdit) {
        delete payload.client_type;
        await api.put(`/clients/${client.id}`, payload);
      } else {
        await api.post("/clients", payload);
      }
      onSuccess();
    } catch (err) {
      if (err.response?.data?.details?.fieldErrors) {
        setFieldErrors(err.response.data.details.fieldErrors);
        setErrorMsg("Validasi gagal, silakan periksa kembali input Anda.");
      } else {
        setErrorMsg(err.response?.data?.error || "Gagal menyimpan data klien.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-xl font-bold text-slate-900">
            {isEdit ? "Edit Profil Klien" : "Tambah Klien Baru"}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 transition-colors rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex flex-col flex-1 overflow-hidden md:flex-row">
          {/* Vertical Tabs */}
          <div className="flex-shrink-0 hidden w-full p-4 space-y-1 overflow-y-auto border-r md:w-64 bg-slate-50 border-slate-100 md:block">
            {[
              { id: "DATA_POKOK", label: "Data Pokok" },
              { id: "DJP", label: "Profil DJP" },
              { id: "KRED_DJP", label: "Kredensial DJP" },
              { id: "KRED_EMAIL", label: "Kredensial Email" },
              { id: "KRED_LAIN", label: "Kredensial Lainnya" },
            ]
              .map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === tab.id
                      ? "bg-blue-100 text-blue-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-200/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
          </div>

          {/* Mobile Tabs */}
          <div className="flex p-4 space-x-2 overflow-x-auto border-b md:hidden bg-slate-50 border-slate-100">
            {[
              { id: "DATA_POKOK", label: "Data Pokok" },
              { id: "DJP", label: "Profil DJP" },
              { id: "KRED_DJP", label: "Kredensial DJP" },
              { id: "KRED_EMAIL", label: "Kredensial Email" },
              { id: "KRED_LAIN", label: "Lainnya" },
            ]
              .map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold ${
                    activeTab === tab.id
                      ? "bg-blue-100 text-blue-700"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
          </div>

          {/* Form Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {errorMsg && (
              <div className="flex items-start gap-3 px-4 py-3 mb-6 text-red-600 border border-red-200 bg-red-50 rounded-xl">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{errorMsg}</p>
              </div>
            )}

            <form
              id="client-form"
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {/* TAB 1: DATA POKOK */}
              {activeTab === "DATA_POKOK" && (
                <div className="space-y-6 duration-300 animate-in fade-in slide-in-from-right-4">
                  <div className="space-y-1.5">
                    <label className="ml-1 text-sm font-semibold text-slate-700">
                      Tipe Klien <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label
                        className={`flex items-center gap-2 p-3 rounded-xl border flex-1 cursor-pointer transition-colors ${formData.client_type === "ORANG_PRIBADI" ? "border-blue-500 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50"} ${isEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="radio"
                          name="client_type"
                          value="ORANG_PRIBADI"
                          checked={formData.client_type === "ORANG_PRIBADI"}
                          onChange={handleChange}
                          disabled={isEdit}
                          className="text-blue-600"
                        />
                        <span className="text-sm font-medium">
                          Orang Pribadi
                        </span>
                      </label>
                      <label
                        className={`flex items-center gap-2 p-3 rounded-xl border flex-1 cursor-pointer transition-colors ${formData.client_type === "BADAN" ? "border-purple-500 bg-purple-50/50" : "border-slate-200 hover:bg-slate-50"} ${isEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="radio"
                          name="client_type"
                          value="BADAN"
                          checked={formData.client_type === "BADAN"}
                          onChange={handleChange}
                          disabled={isEdit}
                          className="text-purple-600"
                        />
                        <span className="text-sm font-medium">Badan</span>
                      </label>
                    </div>
                  </div>

                  <InputField
                    label="Nama Klien"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    error={fieldErrors.name?.[0]}
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <InputField
                      label="NPWP 15 Digit"
                      name="npwp_15"
                      value={formData.npwp_15}
                      onChange={handleChange}
                      error={fieldErrors.npwp_15?.[0]}
                    />
                    <InputField
                      label="NPWP 16 Digit"
                      name="npwp_16"
                      value={formData.npwp_16}
                      onChange={handleChange}
                      error={fieldErrors.npwp_16?.[0]}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {isOP && (
                      <InputField
                        label="NIK"
                        name="nik"
                        value={formData.nik}
                        onChange={handleChange}
                        error={fieldErrors.nik?.[0]}
                      />
                    )}
                    <InputField
                      label="EFIN"
                      name="efin"
                      value={formData.efin}
                      onChange={handleChange}
                      error={fieldErrors.efin?.[0]}
                    />
                    <InputField
                      label="Telepon/HP"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      error={fieldErrors.phone?.[0]}
                    />
                    {isOP && (
                      <InputField
                        label="Afiliasi/Grup"
                        name="group_affiliation"
                        value={formData.group_affiliation}
                        onChange={handleChange}
                        error={fieldErrors.group_affiliation?.[0]}
                      />
                    )}
                  </div>

                  <InputField
                    label="Alamat"
                    name="address"
                    isTextarea
                    value={formData.address}
                    onChange={handleChange}
                    error={fieldErrors.address?.[0]}
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="ml-1 text-sm font-semibold text-slate-700">
                        Status NPWP
                      </label>
                      <select
                        name="npwp_status"
                        value={formData.npwp_status}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="AKTIF">Aktif</option>
                        <option value="NON_AKTIF">Non-Aktif</option>
                        <option value="HAPUS">Hapus</option>
                      </select>
                    </div>
                  </div>

                  <InputField
                    label="Catatan"
                    name="notes"
                    isTextarea
                    value={formData.notes}
                    onChange={handleChange}
                    error={fieldErrors.notes?.[0]}
                  />
                </div>
              )}

              {/* TAB 2: PROFIL DJP */}
              {activeTab === "DJP" && (
                <div className="space-y-6 duration-300 animate-in fade-in slide-in-from-right-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <InputField
                      label="Tanggal Terdaftar"
                      name="registered_date"
                      type="date"
                      value={formData.registered_date}
                      onChange={handleChange}
                      error={fieldErrors.registered_date?.[0]}
                    />
                    <InputField
                      label="Tanggal Aktivasi"
                      name="activation_date"
                      type="date"
                      value={formData.activation_date}
                      onChange={handleChange}
                      error={fieldErrors.activation_date?.[0]}
                    />
                  </div>

                  <div className="p-4 space-y-4 border bg-slate-50 rounded-xl border-slate-100">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="pkp_status"
                        checked={formData.pkp_status}
                        onChange={handleChange}
                        className="w-5 h-5 text-blue-600 rounded border-slate-300"
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        Status PKP
                      </span>
                    </label>
                    {formData.pkp_status && (
                      <InputField
                        label="Tanggal PKP"
                        name="pkp_date"
                        type="date"
                        value={formData.pkp_date}
                        onChange={handleChange}
                        error={fieldErrors.pkp_date?.[0]}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <InputField
                      label="Kode KLU"
                      name="klu_code"
                      value={formData.klu_code}
                      onChange={handleChange}
                      error={fieldErrors.klu_code?.[0]}
                    />
                    <InputField
                      label="Deskripsi KLU"
                      name="klu_description"
                      value={formData.klu_description}
                      onChange={handleChange}
                      error={fieldErrors.klu_description?.[0]}
                    />
                    <InputField
                      label="Kantor Wilayah"
                      name="kanwil"
                      value={formData.kanwil}
                      onChange={handleChange}
                      error={fieldErrors.kanwil?.[0]}
                    />
                    <InputField
                      label="KPP"
                      name="kpp"
                      value={formData.kpp}
                      onChange={handleChange}
                      error={fieldErrors.kpp?.[0]}
                    />
                    <InputField
                      label="Seksi Pengawasan"
                      name="supervision_section"
                      value={formData.supervision_section}
                      onChange={handleChange}
                      error={fieldErrors.supervision_section?.[0]}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: KREDENSIAL DJP */}
              {activeTab === "KRED_DJP" && (
                <div className="space-y-6 duration-300 animate-in fade-in slide-in-from-right-4">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <PasswordField
                      label="Password DJP Online"
                      name="djp_password"
                      value={formData.djp_password}
                      onChange={handleChange}
                    />
                    <PasswordField
                      label="Password Coretax"
                      name="coretax_password"
                      value={formData.coretax_password}
                      onChange={handleChange}
                    />
                    <PasswordField
                      label="Passphrase"
                      name="passphrase"
                      value={formData.passphrase}
                      onChange={handleChange}
                    />
                    <PasswordField
                      label="PIN DJP"
                      name="pin_djp"
                      value={formData.pin_djp}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: KREDENSIAL EMAIL */}
              {activeTab === "KRED_EMAIL" && (
                <div className="space-y-8 duration-300 animate-in fade-in slide-in-from-right-4">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold tracking-wider uppercase text-slate-400">
                      Email Utama
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <InputField
                        label="Alamat Email"
                        name="email1"
                        type="email"
                        value={formData.email1}
                        onChange={handleChange}
                        error={fieldErrors.email1?.[0]}
                      />
                      <PasswordField
                        label="Password Email"
                        name="email1_password"
                        value={formData.email1_password}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold tracking-wider uppercase text-slate-400">
                      Email Kedua (Opsional)
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <InputField
                        label="Alamat Email 2"
                        name="email2"
                        type="email"
                        value={formData.email2}
                        onChange={handleChange}
                        error={fieldErrors.email2?.[0]}
                      />
                      <PasswordField
                        label="Password Email 2"
                        name="email2_password"
                        value={formData.email2_password}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: KREDENSIAL LAINNYA */}
              {activeTab === "KRED_LAIN" && (
                <div className="space-y-8 duration-300 animate-in fade-in slide-in-from-right-4">
                  {/* Info about dynamic credentials */}
                  <div className="p-4 border border-blue-200 bg-blue-50 rounded-xl">
                    <h4 className="text-sm font-bold tracking-wider uppercase text-blue-700 mb-2">
                      ✨ Kredensial Dinamis
                    </h4>
                    <p className="text-sm text-blue-800">
                      {isEdit
                        ? "Untuk menambahkan kredensial baru, simpan perubahan terlebih dahulu kemudian buka detail klien."
                        : "Untuk menambahkan kredensial baru, simpan klien terlebih dahulu kemudian buka detail klien."}
                    </p>
                  </div>

                  {/* Legacy fields (Data Lama) */}
                  {!isOP && (
                    <div className="space-y-6">
                      <h4 className="text-sm font-bold tracking-wider uppercase text-slate-400">
                        Data Lama (Kredensial Statis)
                      </h4>

                      <div className="space-y-4">
                        <h5 className="text-xs font-bold tracking-wider uppercase text-slate-400">
                          OSS
                        </h5>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <InputField
                            label="Username OSS"
                            name="oss_username"
                            value={formData.oss_username}
                            onChange={handleChange}
                            error={fieldErrors.oss_username?.[0]}
                          />
                          <PasswordField
                            label="Password OSS"
                            name="oss_password"
                            value={formData.oss_password}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h5 className="text-xs font-bold tracking-wider uppercase text-slate-400">
                          Accurate
                        </h5>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <InputField
                            label="Email Accurate"
                            name="accurate_email"
                            type="email"
                            value={formData.accurate_email}
                            onChange={handleChange}
                            error={fieldErrors.accurate_email?.[0]}
                          />
                          <PasswordField
                            label="Password Accurate"
                            name="accurate_password"
                            value={formData.accurate_password}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h5 className="text-xs font-bold tracking-wider uppercase text-slate-400">
                          BPJS Kesehatan
                        </h5>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <InputField
                            label="No. BPJS"
                            name="bpjs_kes_number"
                            value={formData.bpjs_kes_number}
                            onChange={handleChange}
                            error={fieldErrors.bpjs_kes_number?.[0]}
                          />
                          <PasswordField
                            label="Password BPJS"
                            name="bpjs_kes_password"
                            value={formData.bpjs_kes_password}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl shadow-sm transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="client-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting
              ? "Menyimpan..."
              : isEdit
                ? "Simpan Perubahan"
                : "Simpan Klien Baru"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientForm;