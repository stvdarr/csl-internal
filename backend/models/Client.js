import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Client = sequelize.define(
  "Client",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    normalizedName: {
      type: DataTypes.STRING,
      allowNull: true,
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
    hooks: {
      beforeValidate: (client) => {
        if (client.name) {
          client.normalizedName = client.name.toLowerCase().replace(/\s+/g, "");
        }
      },
    },
  }
);


export default Client;
