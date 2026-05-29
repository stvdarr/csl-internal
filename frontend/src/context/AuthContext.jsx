import { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Cek apakah ada token setiap kali web di-refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (token && role) {
      setUser({ token, role });
    }
    setLoading(false);
  }, []);

  // Fungsi Login
  const login = async (email, password) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, role } = response.data;

      // Simpan ke brankas browser
      localStorage.setItem("token", token);
      localStorage.setItem("role", role);

      // Update state React
      setUser({ token, role });
      navigate("/"); // Lempar ke halaman utama setelah sukses login

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || "Gagal login bro",
      };
    }
  };

  // Fungsi Logout
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
