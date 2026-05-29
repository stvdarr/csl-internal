import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ToDo = sequelize.define('ToDo', {
    clientName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    jobType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    startDate: {
        type: DataTypes.DATEONLY // DATEONLY hanya menyimpan tanggal (YYYY-MM-DD) tanpa jam
    },
    deadline: {
        type: DataTypes.DATEONLY
    },
    status: {
        type: DataTypes.ENUM('TODO', 'ONGOING', 'DONE', 'APPROVED'),
        defaultValue: 'TODO'
    }
}, {
    tableName: 'todos',
    timestamps: true
});

export default ToDo;