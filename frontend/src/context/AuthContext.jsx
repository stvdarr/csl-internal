import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { AuthContext } from "./AuthContextValue";

const getStoredUser = () => {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  const role = sessionStorage.getItem("role") || localStorage.getItem("role");
  const storedUser = sessionStorage.getItem("user");

  if (!token || !role) return null;

  return {
    token,
    role,
    profile: storedUser ? JSON.parse(storedUser) : null,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);
  const navigate = useNavigate();

  const login = async (email, password) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, role, user: profile } = response.data;

      sessionStorage.setItem("token", token);
      sessionStorage.setItem("role", role);
      sessionStorage.setItem("user", JSON.stringify(profile));
      localStorage.removeItem("token");
      localStorage.removeItem("role");

      setUser({ token, role, profile });
      navigate("/");

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.toString(),
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
