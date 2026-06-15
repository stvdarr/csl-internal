import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const TaskAssignment = sequelize.define(
  "TaskAssignment",
  {
    targetType: {
      type: DataTypes.ENUM("TAX", "TODO"),
      allowNull: false,
    },
    targetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fromUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    toUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assignedById: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "task_assignments",
    timestamps: true,
    indexes: [
      { fields: ["targetType", "targetId"] },
      { fields: ["toUserId"] },
      { fields: ["assignedById"] },
      { fields: ["createdAt"] },
    ],
  },
);

export default TaskAssignment;
