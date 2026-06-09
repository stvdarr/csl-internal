import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

// Fungsi Register (Bikin Akun Baru)
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body; // Abaikan 'role' dari payload untuk mencegah Privilege Escalation

        // 1. Enkripsi password menggunakan bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 2. Simpan user ke database (Default role dipaksa menjadi Staff)
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'Staff'
        });

        const safeUser = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        };

        res.status(201).json({ message: 'User berhasil didaftarkan!', data: safeUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal mendaftarkan user' });
    }
};

// Fungsi Login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Cari user berdasarkan email
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'User tidak ditemukan!' });
        }

        // 2. Cocokkan password yang diinput dengan password di database
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Password salah!' });
        }

        // 3. Jika cocok, cetak tiket JWT
        // Tiket ini menyimpan id dan role user, berlaku selama 1 hari (24 jam)
        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({ 
            message: 'Login berhasil!', 
            token, 
            role: user.role,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Terjadi kesalahan saat login' });
    }
};
