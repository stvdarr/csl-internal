import sequelize from '../config/database.js';
import User from './User.js';
import Client from './Client.js';
import ClientProfile from './ClientProfile.js';
import ClientFamilyMember from './ClientFamilyMember.js';
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

// === CLIENT PROFILE ASSOCIATIONS (SDD §6.4, §10.4) ===
// Bi-directional link: Client (thin identity) ↔ ClientProfile (rich profile)
Client.hasOne(ClientProfile, { foreignKey: 'client_id' });
ClientProfile.belongsTo(Client, { foreignKey: 'client_id' });

// Family members cascade-delete when profile is deleted
ClientProfile.hasMany(ClientFamilyMember, { as: 'FamilyMembers', foreignKey: 'client_profile_id' });
ClientFamilyMember.belongsTo(ClientProfile, { foreignKey: 'client_profile_id' });

// Track which User created / last updated each profile
User.hasMany(ClientProfile, { as: 'CreatedProfiles', foreignKey: 'created_by' });
User.hasMany(ClientProfile, { as: 'UpdatedProfiles', foreignKey: 'updated_by' });
ClientProfile.belongsTo(User, { as: 'CreatedBy', foreignKey: 'created_by' });
ClientProfile.belongsTo(User, { as: 'UpdatedBy', foreignKey: 'updated_by' });

export { sequelize, User, Client, ClientProfile, ClientFamilyMember, TaxTrack, ToDo, HistoryLog, TaskAssignment };
