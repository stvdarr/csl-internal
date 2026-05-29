import express from 'express';
import { getAllToDos, createToDo, updateToDoStatus } from '../controllers/todoController.js';
import { verifyToken } from '../middleware/authCheck.js';
import { checkApprovalAccess } from '../middleware/roleCheck.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getAllToDos);
router.post('/', createToDo);
router.put('/:id/status', checkApprovalAccess, updateToDoStatus); // Pengecekan role Atasan (Admin)

export default router;