/**
 * backend/models/TaxObligation.js
 *
 * Represents the fact that a Client owes a specific TaxType.
 * One row per (clientId, taxType) — NOT per month.
 *
 * This is the entity that was missing from the old flat TaxTrack model.
 * PIC assignment lives here (per client PER tax type), not on the period,
 * because a client's PPh 21 and PPN can have different PICs but the same
 * person handles every month of that one tax type.
 *
 * frequency determines how TaxMatrixView renders periods:
 *   MONTHLY -> 12 period columns per year (PPN, PPH 21, UNIFIKASI, etc.)
 *   ANNUAL  -> 1 period per year, labeled "TAHUNAN <year>" (1770 OP, 1771 BADAN)
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const TaxObligation = sequelize.define(
  "TaxObligation",
  {
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    taxType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    frequency: {
      type: DataTypes.ENUM("MONTHLY", "ANNUAL"),
      allowNull: false,
      defaultValue: "MONTHLY",
    },
    pic_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      // INACTIVE lets you stop tracking a tax type for a client without deleting history
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
  },
  {
    tableName: "tax_obligations",
    timestamps: true,
    version: true,
    indexes: [
      { fields: ["clientId"] },
      { fields: ["taxType"] },
      { fields: ["pic_id"] },
      { fields: ["status"] },
      // A client can only have ONE obligation per tax type — this is the
      // constraint that kills duplicate-client-rows at the schema level.
      { unique: true, fields: ["clientId", "taxType"] },
    ],
  },
);

export default TaxObligation;
