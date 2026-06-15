import logger from "../utils/logger.js";

// Note: For production scaling across multiple server instances, use socket.io-redis adapter
// To enable scaling, install @socket.io/redis-adapter and redis, then uncomment the section below:
// import { createAdapter } from "@socket.io/redis-adapter";
// import { createClient } from "redis";

let io = null;

export const initializeSocketEventBus = (socketIoInstance) => {
  io = socketIoInstance;
  
  // Uncomment this section to enable Redis-based scaling
  // const pubClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
  // const subClient = pubClient.duplicate();
  // await Promise.all([pubClient.connect(), subClient.connect()]);
  // io.adapter(createAdapter(pubClient, subClient));
  
  logger.info("Socket Event Bus initialized");
};

export const emitTaxUpdated = (taxData) => {
  if (!io) {
    logger.warn("Socket Event Bus not initialized, skipping emit");
    return;
  }

  const picRoom = `user_${taxData.pic_id}`;
  io.to(picRoom).emit("TAX_UPDATED", {
    id: taxData.id,
    status: taxData.status,
    updatedAt: taxData.updatedAt,
  });

  io.to("admin_room").emit("TAX_UPDATED", {
    id: taxData.id,
    status: taxData.status,
    pic_id: taxData.pic_id,
    updatedAt: taxData.updatedAt,
  });

  logger.info({ taxId: taxData.id }, "📣 Emitted TAX_UPDATED event");
};

export const emitTodoUpdated = (todoData, { notifyUserIds = [] } = {}) => {
  if (!io) {
    logger.warn("Socket Event Bus not initialized, skipping emit");
    return;
  }

  const payload = {
    id: todoData.id,
    status: todoData.status,
    pic_id: todoData.pic_id,
    updatedAt: todoData.updatedAt,
  };

  const rooms = new Set(
    notifyUserIds
      .filter(Boolean)
      .map((id) => `user_${id}`),
  );

  if (todoData.pic_id) {
    rooms.add(`user_${todoData.pic_id}`);
  }

  for (const room of rooms) {
    io.to(room).emit("TODO_UPDATED", payload);
  }

  io.to("admin_room").emit("TODO_UPDATED", payload);

  logger.info({ todoId: todoData.id }, "📣 Emitted TODO_UPDATED event");
};
