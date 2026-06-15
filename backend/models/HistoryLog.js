import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const HistoryLog = sequelize.define("HistoryLog", {
    actionType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "UPDATED_STATUS"
    },
    actorId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    targetType: {
        type: DataTypes.ENUM("TAX", "TODO", "CLIENT", "USER"),
        allowNull: false,
        defaultValue: "TAX"
    },
    targetId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    recordType: {
        type: DataTypes.ENUM("TAX", "TODO"),
        allowNull: false
    },
    recordId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    oldStatus: {
        type: DataTypes.STRING,
        allowNull: true
    },
    newStatus: {
        type: DataTypes.STRING,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: "history_logs",
    timestamps: true,
    indexes: [
      { fields: ["targetType", "targetId"] },
      { fields: ["recordType", "recordId"] },
      { fields: ["actorId"] },
      { fields: ["createdAt"] },
    ],
  },
);

export default HistoryLog;
