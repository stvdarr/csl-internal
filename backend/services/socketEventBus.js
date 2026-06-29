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

  // Handle both TaxPeriod (with TaxObligation) and TaxObligation itself
  const obligation = taxData.TaxObligation || taxData;
  const pic_id = obligation.pic_id;
  const obligationId = obligation.id;
  const taxType = obligation.taxType;

  const basePayload = {
    id: taxData.id, // could be periodId or obligationId
    status: taxData.status,
    updatedAt: taxData.updatedAt,
    obligationId,
    taxType,
  };

  if (pic_id) {
    const picRoom = `user_${pic_id}`;
    io.to(picRoom).emit("TAX_UPDATED", basePayload);
  }

  io.to("admin_room").emit("TAX_UPDATED", {
    ...basePayload,
    pic_id,
  });

  logger.info(
    { taxId: taxData.id, obligationId, taxType },
    "📣 Emitted TAX_UPDATED event"
  );
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

export const emitWorkloadUpdated = (userId) => {
  if (!io) {
    logger.warn("Socket Event Bus not initialized, skipping emit");
    return;
  }
  
  if (!userId) return;

  const payload = { userId, timestamp: new Date().toISOString() };
  io.to(`user_${userId}`).emit("WORKLOAD_UPDATED", payload);
  io.to("admin_room").emit("WORKLOAD_UPDATED", payload);

  logger.info({ userId }, "📣 Emitted WORKLOAD_UPDATED event");
};
