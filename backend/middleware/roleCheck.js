export const checkApprovalAccess = (req, res, next) => {
    const { newStatus } = req.body; // Status yang mau di-update dari frontend
    const userRole = req.user.role; // Diambil dari token JWT di authCheck

    // Kalau ada yang nyoba ngubah status jadi OK atau APPROVED...
    if (newStatus === 'OK' || newStatus === 'APPROVED') {
        // ...kita cek, apakah dia Admin? Kalau bukan, tendang.
        if (userRole !== 'Admin') {
            return res.status(403).json({ 
                error: 'Akses Ditolak. Hanya Atasan yang bisa memberikan final approval (OK/APPROVED).' 
            });
        }
    }

    // Kalau statusnya cuma 'DIKIRIM' atau 'DIBAYAR', atau yang ngubah emang Admin, loloskan.
    next();
};