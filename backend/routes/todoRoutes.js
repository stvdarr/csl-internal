import express from 'express';
import { getAllToDos, createToDo, updateToDoStatus, assignTodo, getAllStaff } from '../controllers/todoController.js';
import { verifyToken } from '../middleware/authCheck.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { listTodosSchema, createTodoSchema, updateTodoStatusSchema } from '../validators/todoSchemas.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', validateRequest(listTodosSchema), getAllToDos);
router.post('/', validateRequest(createTodoSchema), createToDo);
router.put('/:id/status', validateRequest(updateTodoStatusSchema), updateToDoStatus);

// Admin-only endpoints
router.get('/staff', requireAdmin, getAllStaff);
router.put('/:id/assign', requireAdmin, assignTodo);

export default router;