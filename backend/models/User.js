import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import { ROLES, ROLE_VALUES } from "../constants/roles.js";

const User = sequelize.define(
  "User",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(...ROLE_VALUES),
      defaultValue: ROLES.STAFF,
    },
  },
  {
    tableName: "users",
    timestamps: true, // Otomatis membuat kolom createdAt dan updatedAt
    version: true,
    indexes: [{ fields: ["role"] }],
  }
);

export default User;
