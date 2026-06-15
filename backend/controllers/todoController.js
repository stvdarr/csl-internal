import {
  createTodoTask,
  listTodos,
  updateTodoTaskStatus,
  assignTodoTask,
  listAllStaff,
} from "../services/todoService.js";
import logger from "../utils/logger.js";

export const getAllToDos = async (req, res) => {
  try {
    const result = await listTodos({ ...req.query, currentUser: req.user });
    res.status(200).json(result);
  } catch (error) {
    logger.error(error, "Error in getAllToDos");
    res.status(500).json({ error: "Gagal mengambil data tugas" });
  }
};

export const createToDo = async (req, res) => {
  try {
    const newTodo = await createTodoTask(req.body, req.user);
    res.status(201).json({ message: "Tugas berhasil dibuat", data: newTodo });
  } catch (error) {
    logger.error(error, "Error in createToDo");
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Gagal membuat tugas" });
  }
};

export const updateToDoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body;

    const todoData = await updateTodoTaskStatus(id, newStatus, req.user);

    res.status(200).json({
      message: "Status tugas diperbarui dan log dicatat!",
      data: todoData,
    });
  } catch (error) {
    logger.error(error, "Error in updateToDoStatus");
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Gagal mengupdate status tugas" });
  }
};

export const assignTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { toUserId, reason } = req.body;

    const result = await assignTodoTask(id, toUserId, req.user, reason);

    res.status(200).json({
      message: "PIC tugas berhasil diperbarui",
      data: result,
    });
  } catch (error) {
    logger.error(error, "Error in assignTodo");
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Gagal memperbarui PIC tugas" });
  }
};

export const getAllStaff = async (req, res) => {
  try {
    const users = await listAllStaff();
    res.status(200).json({ data: users });
  } catch (error) {
    logger.error(error, "Error in getAllStaff");
    res.status(500).json({ error: "Gagal mengambil daftar pengguna" });
  }
};