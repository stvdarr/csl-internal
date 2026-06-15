import { Sequelize } from 'sequelize';
import { env } from './env.js';
import logger from '../utils/logger.js';

// Membuat instance Sequelize (Koneksi ke MySQL)
const sequelize = new Sequelize(
    env.DB_NAME,
    env.DB_USER,
    env.DB_PASSWORD,
    {
        host: env.DB_HOST,
        dialect: 'mysql',
        logging: (sql, timing) => {
            if (timing > 100) {
                logger.warn({ sql, duration: `${timing}ms` }, "Slow Query Detected");
            } else {
                logger.debug({ sql, duration: `${timing}ms` }, "Database Query");
            }
        },
        benchmark: true, // Required to get 'timing' in logging function
        pool: {
            max: 30,       // Maksimal 30 koneksi bersamaan
            min: 2,
            acquire: 30000,
            idle: 10000
        }
    }
);

export default sequelize;