import sequelize from '../config/database.js';
import User from './User.js';
import Client from './Client.js';
import TaxTrack from './TaxTrack.js';
import ToDo from './ToDo.js';
import HistoryLog from './HistoryLog.js';
import TaskAssignment from './TaskAssignment.js';

User.hasMany(TaxTrack, { foreignKey: 'pic_id' });
TaxTrack.belongsTo(User, { foreignKey: 'pic_id' });

User.hasMany(ToDo, { foreignKey: 'pic_id' });
ToDo.belongsTo(User, { foreignKey: 'pic_id' });

Client.hasMany(TaxTrack, { foreignKey: 'clientId' });
TaxTrack.belongsTo(Client, { foreignKey: 'clientId' });

User.hasMany(HistoryLog, { foreignKey: 'actorId' });
HistoryLog.belongsTo(User, { foreignKey: 'actorId' });

User.hasMany(TaskAssignment, { as: 'AssignmentsReceived', foreignKey: 'toUserId' });
User.hasMany(TaskAssignment, { as: 'AssignmentsMade', foreignKey: 'assignedById' });
TaskAssignment.belongsTo(User, { as: 'Assignee', foreignKey: 'toUserId' });
TaskAssignment.belongsTo(User, { as: 'AssignedBy', foreignKey: 'assignedById' });
TaskAssignment.belongsTo(User, { as: 'PreviousAssignee', foreignKey: 'fromUserId' });

export { sequelize, User, Client, TaxTrack, ToDo, HistoryLog, TaskAssignment };
