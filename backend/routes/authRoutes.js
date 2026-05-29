import express from 'express';
import { register, login } from '../controllers/authController.js';

const router = express.Router();

// Endpoint untuk mendaftar: POST /api/auth/register
router.post('/register', register);

// Endpoint untuk login: POST /api/auth/login
router.post('/login', login);

export default router;