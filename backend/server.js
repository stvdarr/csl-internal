import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { sequelize } from "./models/index.js";
import authRoutes from "./routes/authRoutes.js";
import taxRoutes from "./routes/taxRoutes.js";
import todoRoutes from "./routes/todoRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tax", taxRoutes);
app.use("/api/todo", todoRoutes);
app.use("/api/history", historyRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.get("/", (req, res) => {
  res.send("Server PT Catat Susun Lapor berjalan dengan mulus!");
});

const startServer = async () => {
  try {
    // Cek koneksi ke database
    await sequelize.authenticate();
    console.log("✅ Koneksi ke MySQL berhasil dibangun!");

    // AUTO-SYNC TABEL: Akan mengecek dan membuat tabel jika belum ada
    // Hati-hati: jangan gunakan alter: true di production database yang sudah besar
    await sequelize.sync();
    console.log("✅ Semua model telah berhasil disinkronisasi ke database!");

    app.listen(PORT, () => {
      console.log(`🚀 Server backend nyala di http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Gagal terkoneksi atau sinkronisasi database:", error);
    process.exit(1);
  }
};

startServer();
