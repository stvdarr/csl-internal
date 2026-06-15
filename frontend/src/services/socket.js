import { io } from "socket.io-client";
import api from "./api";
import { getToken } from "../utils/storage";

const resolveSocketUrl = () => {
  const baseURL = api.defaults.baseURL || "/api";

  if (baseURL.startsWith("/")) {
    return window.location.origin;
  }

  return baseURL.replace(/\/api\/?$/, "");
};

export const socket = io(resolveSocketUrl(), {
  withCredentials: true,
  transports: ["websocket", "polling"],
  autoConnect: false,
  auth: (cb) => {
    cb({ token: getToken() });
  },
});

socket.on("connect", () => {
  console.log("✅ FRONTEND TERHUBUNG KE REAL-TIME ENGINE! (ID:", socket.id, ")");
});

socket.on("connect_error", (err) => {
  console.error("❌ FRONTEND GAGAL KONEK SOCKET:", err.message);
});
