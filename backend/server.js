import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "http"; // 1. IMPORT MODULE HTTP BAWAAN NODE.JS
import { Server } from "socket.io"; // 2. IMPORT SOCKET.IO

import { sequelize } from "./models/index.js";
import authRoutes from "./routes/authRoutes.js";
import taxRoutes from "./routes/taxRoutes.js";
import todoRoutes from "./routes/todoRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import { backfillTaxClients } from "./services/bootstrapService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// REFACTOR: Matikan alter schema untuk mencegah ER_TOO_MANY_KEYS pada production
const shouldAlterSchema = false;

const server = http.createServer(app); // Bungkus app Express ke dalam HTTP Server

const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:5173,http://192.168.0.120:5173"
)
  .split(",")
  .map((origin) => origin.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("🟢 Klien Frontend terhubung ke WebSocket:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Klien Frontend terputus:", socket.id);
  });
});

// REFACTOR: Tambahkan Trust Proxy sebelum rateLimit agar IP user tidak terbaca sebagai IP Load Balancer (Mencegah Internal DDoS)
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    limit: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin tidak diizinkan oleh CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "2mb" }));

// --- ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/tax", taxRoutes);
app.use("/api/todo", todoRoutes);
app.use("/api/history", historyRoutes);

app.get("/", (req, res) => {
  res.send("Server PT Catat Susun Lapor berjalan dengan mulus!");
});

// --- GLOBAL ERROR HANDLER (Wajib di bawah semua route!) ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// --- DATABASE & SERVER START ---
const startServer = async () => {
  try {
    // 1. Check database connection
    await sequelize.authenticate();
    console.log("✅ Koneksi ke MySQL berhasil dibangun!");

    // 2. Sync semua model.
    // Karena tabel 'clients' udah lu hapus, ini bakal bikin tabel baru yang fresh
    // sesuai dengan yang ada di file models/client.js lu.
    await sequelize.sync({ alter: shouldAlterSchema, force: false });
    console.log("✅ Semua model telah berhasil disinkronisasi ke database!");

    // 3. Jalankan backfill jika ada data lama yang perlu diurus
    const backfilledClients = await backfillTaxClients();
    if (backfilledClients > 0) {
      console.log(
        `✅ Backfill klien selesai untuk ${backfilledClients} data pajak lama.`,
      );
    }

    server.listen(PORT, () => {
      console.log(
        `🚀 Server Backend & WebSocket nyala di http://localhost:${PORT}`,
      );
    });
  } catch (error) {
    console.error("❌ Gagal terkoneksi atau sinkronisasi database:", error);
    process.exit(1);
  }
};

startServer();
