import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('Staff', 'Admin'),
        defaultValue: 'Staff'
    }
}, {
    tableName: 'users',
    timestamps: true // Otomatis membuat kolom createdAt dan updatedAt
});

export default User;