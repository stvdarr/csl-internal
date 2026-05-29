import sequelize from '../config/database.js';
import User from './User.js';
import TaxTrack from './TaxTrack.js';
import ToDo from './ToDo.js';
import HistoryLog from './HistoryLog.js';

// 1. Relasi User dengan TaxTrack (1 User bisa punya banyak TaxTrack)
User.hasMany(TaxTrack, { foreignKey: 'pic_id' });
TaxTrack.belongsTo(User, { foreignKey: 'pic_id' });

// 2. Relasi User dengan ToDo (1 User bisa punya banyak ToDo)
User.hasMany(ToDo, { foreignKey: 'pic_id' });
ToDo.belongsTo(User, { foreignKey: 'pic_id' });

// 3. Relasi User dengan HistoryLog (Mencatat User mana yang mengubah status)
User.hasMany(HistoryLog, { foreignKey: 'updated_by' });
HistoryLog.belongsTo(User, { foreignKey: 'updated_by' });

// Export semua agar mudah dipanggil di controller dan server
export { sequelize, User, TaxTrack, ToDo, HistoryLog };