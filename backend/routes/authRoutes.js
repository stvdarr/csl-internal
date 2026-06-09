import express from 'express';
import { register, login } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema, registerSchema } from '../validators/authSchemas.js';

const router = express.Router();

// Endpoint untuk mendaftar: POST /api/auth/register
router.post('/register', validateRequest(registerSchema), register);

// Endpoint untuk login: POST /api/auth/login
router.post('/login', validateRequest(loginSchema), login);

export default router;
