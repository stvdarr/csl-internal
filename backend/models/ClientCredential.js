
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ClientCredential = sequelize.define(
  "ClientCredential",
  {
    client_profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    field_type: {
      type: DataTypes.ENUM("text", "password", "email", "number"),
      allowNull: false,
      defaultValue: "text",
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "client_credentials",
    timestamps: true,
    indexes: [
      { fields: ["client_profile_id"] },
      { fields: ["sort_order"] },
    ],
  }
);

export default ClientCredential;
