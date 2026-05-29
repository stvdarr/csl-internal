import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
    // Ambil tiket dari header Authorization
    const authHeader = req.headers['authorization'];
    
    // Format tiket yang benar adalah: "Bearer <token_jwt_disini>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Akses ditolak! Token tidak ditemukan.' });
    }

    try {
        // Cek keaslian tiket menggunakan JWT_SECRET
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Simpan data id dan role dari tiket ke dalam req.user
        req.user = decoded; 
        
        // Lanjutkan perjalanan ke Controller
        next(); 
    } catch (error) {
        res.status(403).json({ error: 'Token tidak valid atau sudah kedaluwarsa!' });
    }
};