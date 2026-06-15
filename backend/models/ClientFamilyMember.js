/**
 * backend/models/ClientFamilyMember.js
 *
 * Sequelize model for the `client_family_members` table.
 *
 * Stores tanggungan (family members / dependents) for Orang Pribadi clients.
 * Used for PPh 21 / PTKP calculations.
 *
 * Relationship: ClientProfile hasMany ClientFamilyMember (ON DELETE CASCADE).
 *
 * DB Requirements: DB-08 through DB-10 (SDD §6.3)
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ClientFamilyMember = sequelize.define(
  "ClientFamilyMember",
  {
    // FK to client_profiles.id — enforced via association in models/index.js
    client_profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    nik:       { type: DataTypes.STRING(20),  allowNull: true },
    npwp:      { type: DataTypes.STRING(20),  allowNull: true },
    name:      { type: DataTypes.STRING(255), allowNull: false },
    birth_date:{ type: DataTypes.DATEONLY,    allowNull: true },

    relationship: {
      type: DataTypes.ENUM("SUAMI", "ISTRI", "ANAK", "TANGGUNGAN_LAIN"),
      allowNull: false,
    },

    occupation:  { type: DataTypes.STRING(255), allowNull: true },
    ptkp_status: { type: DataTypes.STRING(50),  allowNull: true },
    notes:       { type: DataTypes.TEXT,        allowNull: true },
  },
  {
    tableName: "client_family_members",
    timestamps: true,
    indexes: [
      // DB-10: Index on FK for efficient joins
      { fields: ["client_profile_id"] },
    ],
  }
);

export default ClientFamilyMember;
