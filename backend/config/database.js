import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Membaca file .env
dotenv.config();

// Membuat instance Sequelize (Koneksi ke MySQL)
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false, // Diset false agar terminal tidak spam log query SQL
        pool: {
            max: 10,       // Maksimal 10 koneksi bersamaan
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

export default sequelize;