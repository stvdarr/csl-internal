import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const TaxTrack = sequelize.define(
  "TaxTrack",
  {
    clientName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // TAMBAHAN BARU: Kategori Jenis Pajak
    taxType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "UMUM", // Contoh: PPN, 21, 25, 1771, dll
    },
    period: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    status: {
      // PERLUASAN ENUM: Mengakomodasi alur Bulanan DAN Tahunan
      type: DataTypes.ENUM(
        "DIBUAT",
        "REVIEW",
        "TTD",
        "DIKIRIM",
        "DIBAYAR",
        "LAPOR",
        "OK",
      ),
      defaultValue: "DIBUAT",
    },
  },
  {
    tableName: "tax_tracks",
    timestamps: true,
  },
);

export default TaxTrack;
