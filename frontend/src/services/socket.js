import { io } from "socket.io-client";
import api from "./api"; // Mengambil konfigurasi axios milikmu

// Secara otomatis mendeteksi URL Backend (memotong /api di belakangnya)
const rawUrl = api.defaults.baseURL || "http://localhost:5000";
const socketUrl = rawUrl.replace(/\/api\/?$/, "");

console.log("📡 MENGHUBUNGKAN SOCKET KE:", socketUrl);

// Buat koneksi global (hanya 1 koneksi untuk seluruh aplikasi)
export const socket = io(socketUrl, {
  withCredentials: true,
  transports: ["websocket", "polling"],
});

// Pasang pendeteksi log di sini agar langsung terlihat di F12
socket.on("connect", () => {
  console.log(
    "✅ FRONTEND TERHUBUNG KE REAL-TIME ENGINE! (ID:",
    socket.id,
    ")",
  );
});

socket.on("connect_error", (err) => {
  console.error("❌ FRONTEND GAGAL KONEK SOCKET:", err.message);
});
