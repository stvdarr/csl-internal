/**
 * backend/models/ClientProfile.js
 *
 * Sequelize model for the `client_profiles` table.
 *
 * Design rationale (SDD §6.1):
 *   The existing `clients` table is kept as a thin identity record referenced
 *   by `tax_tracks.clientId`. This new table holds the rich profile data
 *   (credentials, DJP profile, contact info) without touching the existing FK
 *   relationship, ensuring zero regression risk on TaxTrack operations.
 *
 * DB Requirements: DB-01 through DB-07 (SDD §6.2, §6.5)
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ClientProfile = sequelize.define(
  "ClientProfile",
  {
    // === LINK TO EXISTING clients TABLE ===
    // Nullable: a profile may exist before a Client (TaxTrack anchor) record is created.
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // === IDENTITY ===
    client_type: {
      type: DataTypes.ENUM("ORANG_PRIBADI", "BADAN"),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // Uppercased, whitespace-normalized — computed by normalizeName() utility.
    // Unique constraint enforced here and at DB level.
    normalized_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },

    // === TAX IDENTITY ===
    npwp_15: { type: DataTypes.STRING(20), allowNull: true },   // Old 15-digit NPWP
    npwp_16: { type: DataTypes.STRING(20), allowNull: true },   // New 16-digit Coretax NPWP
    nik:     { type: DataTypes.STRING(20), allowNull: true },   // NIK — OP primary use
    efin:    { type: DataTypes.STRING(20), allowNull: true },   // EFIN (10 digits)

    // === DJP PROFILE (from Ikhtisar Profil — DJP Online screenshots) ===
    taxpayer_type:       { type: DataTypes.STRING(100), allowNull: true },
    taxpayer_category:   { type: DataTypes.STRING(100), allowNull: true },
    npwp_status: {
      type: DataTypes.ENUM("AKTIF", "NON_AKTIF", "HAPUS"),
      allowNull: true,
      defaultValue: "AKTIF",
    },
    registered_date:    { type: DataTypes.DATEONLY, allowNull: true },
    activation_date:    { type: DataTypes.DATEONLY, allowNull: true },
    pkp_status:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    pkp_date:           { type: DataTypes.DATEONLY, allowNull: true },
    klu_code:           { type: DataTypes.STRING(10), allowNull: true },
    klu_description:    { type: DataTypes.TEXT, allowNull: true },
    kanwil:             { type: DataTypes.STRING(255), allowNull: true },
    kpp:                { type: DataTypes.STRING(255), allowNull: true },
    supervision_section:{ type: DataTypes.STRING(100), allowNull: true },

    // === CONTACT ===
    phone:             { type: DataTypes.STRING(30), allowNull: true },
    address:           { type: DataTypes.TEXT, allowNull: true },
    group_affiliation: { type: DataTypes.STRING(255), allowNull: true }, // OP only

    // === CREDENTIALS: DJP ===
    djp_password:     { type: DataTypes.STRING(255), allowNull: true },
    coretax_password: { type: DataTypes.STRING(255), allowNull: true },
    passphrase:       { type: DataTypes.STRING(255), allowNull: true },
    pin_djp:          { type: DataTypes.STRING(20),  allowNull: true },

    // === CREDENTIALS: EMAIL PRIMARY ===
    email1:          { type: DataTypes.STRING(255), allowNull: true },
    email1_password: { type: DataTypes.STRING(255), allowNull: true },

    // === CREDENTIALS: EMAIL SECONDARY ===
    email2:          { type: DataTypes.STRING(255), allowNull: true },
    email2_password: { type: DataTypes.STRING(255), allowNull: true },

    // === CREDENTIALS: OSS (Badan only) ===
    oss_username: { type: DataTypes.STRING(255), allowNull: true },
    oss_password: { type: DataTypes.STRING(255), allowNull: true },

    // === CREDENTIALS: ACCURATE (Badan only) ===
    accurate_email:    { type: DataTypes.STRING(255), allowNull: true },
    accurate_password: { type: DataTypes.STRING(255), allowNull: true },

    // === CREDENTIALS: BPJS (Badan only) ===
    bpjs_kes_number:   { type: DataTypes.STRING(50),  allowNull: true },
    bpjs_kes_password: { type: DataTypes.STRING(255), allowNull: true },

    // === STATUS & NOTES ===
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    notes: { type: DataTypes.TEXT, allowNull: true },

    // === METADATA ===
    // created_by / updated_by: FK to users.id — set at service layer, not at DB level here
    // because Sequelize handles FK enforcement via associations in models/index.js.
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "client_profiles",
    timestamps: true,   // Sequelize auto-manages createdAt / updatedAt
    version: true,      // Adds `version` INT column for optimistic locking (DB-06)
    indexes: [
      // DB-07: All required indexes
      { fields: ["client_id"] },
      { fields: ["client_type"] },
      { fields: ["status"] },
      { fields: ["npwp_15"] },
      { fields: ["npwp_16"] },
      { fields: ["nik"] },
      { fields: ["name"] },
      { fields: ["created_by"] },
      { fields: ["updated_by"] },
    ],
  }
);

export default ClientProfile;
