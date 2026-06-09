import { ToDo, HistoryLog, User } from '../models/index.js';

export const getAllToDos = async (req, res) => {
    try {
        const todos = await ToDo.findAll({ include: [{ model: User, attributes: ['name'] }] });
        res.status(200).json({ data: todos });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil data tugas' });
    }
};

export const createToDo = async (req, res) => {
    try {
        const { clientName, jobType, description, startDate, deadline } = req.body;
        const pic_id = req.user.id;

        const newTodo = await ToDo.create({ clientName, jobType, description, startDate, deadline, pic_id });
        res.status(201).json({ message: 'Tugas berhasil dibuat', data: newTodo });
    } catch (error) {
        res.status(500).json({ error: 'Gagal membuat tugas' });
    }
};

export const updateToDoStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { newStatus } = req.body;
        const userId = req.user.id;

        const todoData = await ToDo.findByPk(id);
        if (!todoData) return res.status(404).json({ error: 'Tugas tidak ditemukan' });

        // Tambahkan Ownership Check
        if (todoData.pic_id !== userId && req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Akses Ditolak. Anda bukan penanggung jawab untuk tugas ini.' });
        }

        const oldStatus = todoData.status;
        if (oldStatus === newStatus) return res.status(400).json({ error: 'Status tidak ada perubahan' });

        todoData.status = newStatus;
        await todoData.save();

        await HistoryLog.create({
            recordType: 'TODO',
            recordId: id,
            oldStatus: oldStatus,
            newStatus: newStatus,
            updated_by: userId
        });

        res.status(200).json({ message: 'Status tugas diperbarui dan log dicatat!' });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengupdate status tugas' });
    }
};