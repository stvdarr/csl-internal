/**
 * backend/models/TaxPeriod.js
 *
 * One row per (obligationId, period). This replaces the period-bearing
 * columns of the old flat TaxTrack. status/amount live here because they're
 * genuinely per-period — a client's March PPN status and April PPN status
 * are independent, but they share the same PIC and tax type via the parent
 * TaxObligation.
 *
 * For ANNUAL obligations (1770 OP, 1771 BADAN), `period` is the literal
 * string "TAHUNAN <year>" e.g. "TAHUNAN 2026" — one row per year, not per month.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const TaxPeriod = sequelize.define(
  "TaxPeriod",
  {
    obligationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    tableName: "tax_periods",
    timestamps: true,
    version: true,
    indexes: [
      { fields: ["obligationId"] },
      { fields: ["status"] },
      { fields: ["period"] },
      { fields: ["updatedAt"] },
      // A given obligation can't have two rows for the same period
      { unique: true, fields: ["obligationId", "period"] },
    ],
  },
);

export default TaxPeriod;