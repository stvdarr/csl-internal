import { ROLES } from "../constants/roles.js";

export const checkApprovalAccess = (req, res, next) => {
  const { newStatus } = req.body;
  const userRole = req.user.role;

  if (newStatus === 'COMPLETED' || newStatus === 'APPROVED') {
    if (userRole !== ROLES.ADMIN) {
      return res.status(403).json({ 
        error: 'Akses Ditolak. Hanya Admin yang bisa memberikan final approval.' 
      });
    }
  }

  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({
      error: 'Akses Ditolak. Hanya Admin yang bisa melakukan aksi ini.'
    });
  }

  next();
};

export const requireAdminOrStaff = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.STAFF) {
    return res.status(403).json({
      error: 'Akses Ditolak. Hanya Admin atau Staff yang bisa melakukan aksi ini.'
    });
  }

  next();
};
