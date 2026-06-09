import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContextValue";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(
        result.message || "Gagal masuk. Periksa kembali kredensial Anda.",
      );
    }
    setIsLoading(false);
  };

  // Konfigurasi Animasi Framer Motion (Staggered Waterfall)
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100"
      >
        {/* Header Section */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-8 text-center"
        >
          <motion.div
            variants={itemVariants}
            className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200"
          >
            {/* Logo Placeholder (Ganti dengan Logo Asli PT) */}
            <span className="text-2xl font-black text-white tracking-tighter">
              CSL
            </span>
          </motion.div>
          <motion.h2
            variants={itemVariants}
            className="text-2xl font-bold text-slate-800 mb-2"
          >
            Selamat Datang Kembali
          </motion.h2>
          <motion.p variants={itemVariants} className="text-slate-500 text-sm">
            Masuk ke portal pajak PT Catat Susun Lapor
          </motion.p>
        </motion.div>

        {/* Error Handling UI yang Elegan */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Section */}
        <motion.form
          variants={containerVariants}
          initial="hidden"
          animate="show"
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Input Email */}
          <motion.div variants={itemVariants} className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nama@perusahaan.com"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
            </div>
          </motion.div>

          {/* Input Password */}
          <motion.div variants={itemVariants} className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
              {/* Toggle Show/Hide Password */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </motion.div>

          {/* Submit Button */}
          <motion.div variants={itemVariants} className="pt-2">
            <motion.button
              whileHover={{ scale: 1.01, translateY: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm transition-all duration-200 shadow-lg ${
                isLoading
                  ? "bg-blue-400 cursor-not-allowed shadow-none"
                  : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-600/25 shadow-blue-600/20"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                "Masuk ke Dashboard"
              )}
            </motion.button>
          </motion.div>
        </motion.form>

        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="show"
          className="mt-8 text-center"
        >
          <p className="text-xs text-slate-400">
            Sistem Internal &copy; {new Date().getFullYear()} PT Catat Susun
            Lapor
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
