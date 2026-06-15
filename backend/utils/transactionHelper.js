import { sequelize } from "../models/index.js";
import logger from "./logger.js";

/**
 * Standardized Transaction Wrapper
 * Ensures consistent transaction management, logging, and error handling.
 * 
 * @param {Function} work - Async function containing the database operations.
 * @returns {Promise<any>} - The result of the work function.
 */
export const runInTransaction = async (work) => {
  const transaction = await sequelize.transaction();
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    if (transaction) {
      logger.error({ error: error.message, stack: error.stack }, "Transaction rollback initiated");
      await transaction.rollback();
    }
    throw error;
  }
};
