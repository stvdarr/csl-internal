import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const HistoryLog = sequelize.define('HistoryLog', {
    recordType: {
        type: DataTypes.ENUM('TAX', 'TODO'),
        allowNull: false
    },
    recordId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    oldStatus: {
        type: DataTypes.STRING,
        allowNull: false
    },
    newStatus: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'history_logs',
    timestamps: true
});

export default HistoryLog;