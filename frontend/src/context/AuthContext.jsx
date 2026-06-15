import { useState, useEffect, useRef, createContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { socket } from "../services/socket";
import { getStoredSession, setAuthData, clearAuthData, getToken } from "../utils/storage";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const sessionEpochRef = useRef(0);

  useEffect(() => {
    const epoch = sessionEpochRef.current;
    let cancelled = false;

    const restoreSession = async () => {
      const cached = getStoredSession();
      if (cached && !cancelled) {
        setUser({
          token: cached.token,
          role: cached.role,
          profile: cached.profile,
        });
      }

      try {
        const { data } = await api.get("/auth/me");
        if (cancelled || epoch !== sessionEpochRef.current) return;

        const activeToken = getToken();
        if (!activeToken) {
          clearAuthData();
          setUser(null);
          return;
        }

        setAuthData(activeToken, data.role, data.user);
        setUser({
          token: activeToken,
          role: data.role,
          profile: data.user,
        });
      } catch {
        if (cancelled || epoch !== sessionEpochRef.current) return;
        clearAuthData();
        setUser(null);
      } finally {
        if (!cancelled && epoch === sessionEpochRef.current) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const userId = user?.profile?.id;
  const token = user?.token;

  useEffect(() => {
    if (!userId || !token) {
      socket.disconnect();
      return;
    }

    socket.auth = { token };

    const joinPrivateRoom = () => {
      socket.emit("join_private_room", userId);
    };

    socket.on("connect", joinPrivateRoom);

    if (socket.connected) {
      joinPrivateRoom();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", joinPrivateRoom);
    };
  }, [userId, token]);

  const login = async (email, password) => {
    try {
      sessionEpochRef.current += 1;

      const response = await api.post("/auth/login", { email, password });
      const { token, role, user: profile } = response.data;

      if (!token || !role || !profile) {
        return {
          success: false,
          message: "Respons login tidak lengkap dari server",
        };
      }

      setAuthData(token, role, profile);
      setUser({ token, role, profile });
      setLoading(false);
      navigate("/");

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || error.toString(),
      };
    }
  };

  const logout = async () => {
    sessionEpochRef.current += 1;

    try {
      await api.post("/auth/logout");
    } catch {
      // Clear local session even if logout request fails.
    } finally {
      clearAuthData();
      setUser(null);
      socket.disconnect();
      navigate("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
