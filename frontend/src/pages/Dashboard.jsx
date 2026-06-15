import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import TaxTracker from "../components/Tax/TaxTracker";
import ToDoList from "../components/ToDoList";
import HistoryLogViewer from "../components/HistoryLogViewer";
import { LogOut, LayoutDashboard, CheckSquare, History, Users, UserPlus, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import api from "../services/api";
import { ROLES } from "../constants/roles";

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("TAX");
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Register form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Check if user is admin
  const isAdmin = user?.role === ROLES.ADMIN;

  const tabs = [
    { id: "TAX", label: "Tracking Pajak", icon: LayoutDashboard },
    { id: "TODO", label: "To-Do List", icon: CheckSquare },
    { id: "HISTORY", label: "Audit Log", icon: History },
    ...(isAdmin ? [{ id: "ADMIN", label: "Admin Panel", icon: Users }] : []),
  ];

  // Fetch staff list
  const fetchStaff = async () => {
    if (!isAdmin) return;
    try {
      setStaffLoading(true);
      const response = await api.get("/auth/staff");
      setStaff(response.data.data);
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setStaffLoading(false);
    }
  };

  // Handle register form change
  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle register form submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError("");
    setRegisterSuccess(false);
    
    if (formData.password !== formData.confirmPassword) {
      return setRegisterError("Konfirmasi password tidak cocok.");
    }

    if (formData.password.length < 8) {
      return setRegisterError("Password minimal harus 8 karakter.");
    }

    setIsRegistering(true);

    try {
      await api.post("/auth/register", {
        name: formData.name,
        email: formData.email,
        password: formData.password
      });

      setRegisterSuccess(true);
      setFormData({ name: "", email: "", password: "", confirmPassword: "" });
      
      // Refresh staff list
      await fetchStaff();
      
      // Reset success state after 3 seconds
      setTimeout(() => setRegisterSuccess(false), 3000);
    } catch (err) {
      setRegisterError(
        err.response?.data?.error || "Gagal mendaftarkan akun. Silakan coba lagi."
      );
    } finally {
      setIsRegistering(false);
    }
  };

  // Fetch staff when active tab is ADMIN
  useEffect(() => {
    if (activeTab === "ADMIN") {
      fetchStaff();
    }
  }, [activeTab]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-slate-50 font-sans text-slate-800"
    >
      {/* 1. HEADER: Penambahan efek Glassmorphism (bg-white/80 + backdrop-blur-md) */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-200">
              C
            </div>
            {/* Disembunyikan di HP agar header tidak sesak */}
            <h1 className="text-xl font-bold tracking-tight text-slate-900 hidden sm:block">
              Catat Susun Lapor
            </h1>
          </motion.div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-900">
                {user.profile.name || "User"}
              </span>
              {/* Desain badge role yang lebih premium */}
              <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full mt-0.5">
                {user?.role || "GUEST"}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

            {/* Micro-interaction pada tombol logout */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors outline-none"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 2. TABS: Responsif untuk mobile (overflow-x-auto, no-scrollbar, flex-shrink-0) */}
        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-full sm:w-fit mb-8 shadow-inner overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center whitespace-nowrap flex-shrink-0 gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ease-out outline-none
                  ${
                    isActive
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }
                `}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-400"}`}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 3. CONTENT AREA: Transisi super smooth dengan AnimatePresence */}
        <div className="mt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {activeTab === "TAX" && <TaxTracker />}
              {activeTab === "TODO" && <ToDoList />}
              {activeTab === "HISTORY" && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-900">
                      Jejak Rekam Sistem
                    </h3>
                    <p className="text-sm text-slate-500">
                      Memantau semua perubahan status yang dilakukan oleh staf
                      dan atasan.
                    </p>
                  </div>
                  <HistoryLogViewer />
                </div>
              )}
              {activeTab === "ADMIN" && isAdmin && (
                <div className="space-y-6">
                  {/* Register Staff Section */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          Daftarkan Staff Baru
                        </h3>
                        <p className="text-sm text-slate-500">
                          Tambahkan akun staff baru ke sistem
                        </p>
                      </div>
                      <button
                        onClick={() => setShowRegisterForm(!showRegisterForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        {showRegisterForm ? "Tutup Form" : "Daftarkan Staff"}
                      </button>
                    </div>

                    {/* Register Form */}
                    <AnimatePresence>
                      {showRegisterForm && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          {/* Feedback UI */}
                          <AnimatePresence mode="wait">
                            {registerError && (
                              <motion.div
                                key="error"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-start gap-3"
                              >
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p className="text-sm font-medium">{registerError}</p>
                              </motion.div>
                            )}
                            {registerSuccess && (
                              <motion.div
                                key="success"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl mb-6 flex items-start gap-3"
                              >
                                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                                <p className="text-sm font-medium">Staff berhasil didaftarkan!</p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <form onSubmit={handleRegisterSubmit} className="space-y-4 max-w-2xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700 ml-1">
                                  Nama Lengkap
                                </label>
                                <input
                                  name="name"
                                  type="text"
                                  value={formData.name}
                                  onChange={handleFormChange}
                                  required
                                  placeholder="Nama Staff"
                                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700 ml-1">
                                  Email
                                </label>
                                <input
                                  name="email"
                                  type="email"
                                  value={formData.email}
                                  onChange={handleFormChange}
                                  required
                                  placeholder="staff@perusahaan.com"
                                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700 ml-1">
                                  Password
                                </label>
                                <div className="relative">
                                  <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={handleFormChange}
                                    required
                                    placeholder="Minimal 8 karakter"
                                    className="w-full px-4 py-2.5 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                  >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700 ml-1">
                                  Konfirmasi Password
                                </label>
                                <input
                                  name="confirmPassword"
                                  type={showPassword ? "text" : "password"}
                                  value={formData.confirmPassword}
                                  onChange={handleFormChange}
                                  required
                                  placeholder="Ulangi password"
                                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                />
                              </div>
                            </div>
                            <button
                              type="submit"
                              disabled={isRegistering}
                              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 shadow-lg ${
                                isRegistering
                                  ? "bg-blue-400 cursor-not-allowed shadow-none"
                                  : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-600/25 shadow-blue-600/20"
                              }`}
                            >
                              {isRegistering ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Mendaftarkan...
                                </>
                              ) : (
                                "Daftarkan Staff"
                              )}
                            </button>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Staff List Section */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-slate-900">
                        Daftar Staff
                      </h3>
                      <p className="text-sm text-slate-500">
                        Semua akun staff yang terdaftar di sistem
                      </p>
                    </div>

                    {staffLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      </div>
                    ) : staff.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        Belum ada staff yang terdaftar
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                Nama
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                Email
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                Role
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {staff.map((member) => (
                              <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                  {member.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {member.email}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">
                                    {member.role}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </motion.div>
  );
};

export default Dashboard;