import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import pinoHTTP from "pino-http";
import * as Sentry from "@sentry/node";
import client from "prom-client";
import jwt from "jsonwebtoken";

import { env } from "./config/env.js";
import logger from "./utils/logger.js";
import { extractTokenFromSocket } from "./utils/cookieAuth.js";
import { sequelize } from "./models/index.js";
import authRoutes from "./routes/authRoutes.js";
import taxRoutes from "./routes/taxRoutes.js";
import todoRoutes from "./routes/todoRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import workloadRoutes from "./routes/workloadRoutes.js";
import { verifyToken } from "./middleware/authCheck.js";
import { requireAdmin } from "./middleware/roleCheck.js";
import { initializeSocketEventBus } from "./services/socketEventBus.js";

// Sentry Initialization
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
  });
}

const app = express();
const PORT = env.PORT;

// Prometheus Metrics Setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

app.use(pinoHTTP({ logger }));

// REFACTOR: Schema synchronization logic
// In development, we use 'alter: true' to keep DB in sync with models.
// In production, this should be 'false' to avoid accidental data loss or performance issues.
const shouldAlterSchema = env.NODE_ENV !== "production";

const server = http.createServer(app); // Bungkus app Express ke dalam HTTP Server

const allowedOrigins = env.CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// JWT Verification for Socket.IO
io.use((socket, next) => {
  const token = extractTokenFromSocket(socket);

  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    return next(new Error("Authentication error: Invalid or expired token"));
  }
});

app.set("io", io);

// Initialize Socket Event Bus for decoupled event emission
initializeSocketEventBus(io);

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id, userId: socket.user.id, role: socket.user.role }, "🟢 Klien Frontend terhubung ke WebSocket");

  // Join admin room if user is Admin
  if (socket.user.role === "Admin") {
    socket.join("admin_room");
    logger.info({ socketId: socket.id, userId: socket.user.id }, "👑 Admin bergabung ke admin room");
  }

  // WS4: Join user to a private room based on their ID (verified token)
  socket.on("join_private_room", (userId) => {
    // Verify that the userId matches the token's user id
    if (userId && String(userId) === String(socket.user.id)) {
      const room = `user_${userId}`;
      socket.join(room);
      logger.info({ socketId: socket.id, room }, "👤 User bergabung ke room privat");
    }
  });

  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id, userId: socket.user.id }, "🔴 Klien Frontend terputus");
  });
});

app.set('trust proxy', 1);

app.use(helmet());
// Global rate limiter
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
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

app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

// --- ROUTES ---
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tax", taxRoutes);
app.use("/api/todo", todoRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/workload", workloadRoutes);

app.get("/metrics", verifyToken, requireAdmin, async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/", (req, res) => {
  res.send("Server PT Catat Susun Lapor berjalan dengan mulus!");
});

// --- GLOBAL ERROR HANDLER (Wajib di bawah semua route!) ---
app.use((err, req, res, next) => {
  logger.error(err, "Global Error Handler caught an error");
  res.status(500).json({ error: "Something went wrong!" });
});

// --- DATABASE & SERVER START ---
const startServer = async () => {
  try {
    // 1. Check database connection
    await sequelize.authenticate();
    logger.info("✅ Koneksi ke MySQL berhasil dibangun!");

    // 2. Sync semua model.
    // Karena tabel 'clients' udah lu hapus, ini bakal bikin tabel baru yang fresh
    // sesuai dengan yang ada di file models/client.js lu.
    await sequelize.sync({ alter: shouldAlterSchema, force: false });
    logger.info("✅ Semua model telah berhasil disinkronisasi ke database!");

    server.listen(PORT, () => {
      logger.info(
        { port: PORT },
        `🚀 Server Backend & WebSocket nyala di http://localhost:${PORT}`,
      );
    });
  } catch (error) {
    logger.error(error, "❌ Gagal terkoneksi atau sinkronisasi database");
    process.exit(1);
  }
};

startServer();
