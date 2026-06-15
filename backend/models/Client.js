import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Client = sequelize.define(
  "Client",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    normalizedName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    taxIdNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      defaultValue: "ACTIVE",
    },
  },
  {
    tableName: "clients",
    timestamps: true,
    version: true,
    indexes: [
      { fields: ["name"] },
      { fields: ["status"] },
    ],
  }
);


export default Client;
