import { sequelize } from "../models/index.js";

export const getHealth = (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

export const getDatabaseHealth = async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({
      status: "UP",
      database: "MySQL",
      connection: "OK",
    });
  } catch (error) {
    res.status(503).json({
      status: "DOWN",
      database: "MySQL",
      error: "Database connection failed",
    });
  }
};

export const getSocketHealth = (req, res) => {
  const io = req.app.get("io");
  if (io) {
    res.status(200).json({
      status: "UP",
      connections: io.engine.clientsCount,
    });
  } else {
    res.status(503).json({
      status: "DOWN",
      error: "Socket.io instance not found",
    });
  }
};
