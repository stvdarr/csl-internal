import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const TaxTrack = sequelize.define(
  "TaxTrack",
  {
    clientName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    taxType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "UMUM",
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
      type: DataTypes.STRING,
      defaultValue: "NOT_STARTED",
    },
  },
  {
    tableName: "tax_tracks",
    timestamps: true,
    version: true,
    indexes: [
      { fields: ["pic_id"] },
      { fields: ["clientId"] },
      { fields: ["status"] },
      { fields: ["period"] },
      { fields: ["updatedAt"] },
    ],
  },
);

export default TaxTrack;
