import { useCallback, useEffect, useState, useContext, useRef } from "react";
import api from "../services/api";
import { socket } from "../services/socket";
import { AuthContext } from "../context/AuthContext";
import { ROLES } from "../constants/roles";

const ToDoList = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === ROLES.ADMIN;
  const [todos, setTodos] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTodo, setNewTodo] = useState({
    clientName: "",
    jobType: "",
    startDate: "",
    deadline: "",
    pic_id: undefined,
  });

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/todo");
      setTodos(response.data.data);
      setError("");
    } catch {
      setError("Gagal memuat data tugas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStaffList = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/todo/staff");
      setStaffList(response.data.data);
    } catch (err) {
      console.error("Error loading staff list:", err);
    }
  }, [isAdmin]);

  const fetchTodosRef = useRef(fetchTodos);
  fetchTodosRef.current = fetchTodos;

  useEffect(() => {
    fetchTodos();
    fetchStaffList();
  }, [fetchTodos, fetchStaffList]);

  useEffect(() => {
    const handleConnect = () => {
      fetchTodosRef.current();
    };

    const handleTodoUpdate = (payload) => {
      let needsRefresh = false;

      setTodos((old) => {
        const exists = old.some((t) => String(t.id) === String(payload.id));
        if (!exists) {
          if (
            isAdmin ||
            String(payload.pic_id) === String(user?.profile?.id)
          ) {
            needsRefresh = true;
          }
          return old;
        }

        if (
          !isAdmin &&
          String(payload.pic_id) !== String(user?.profile?.id)
        ) {
          return old.filter((t) => String(t.id) !== String(payload.id));
        }

        return old.map((t) =>
          String(t.id) === String(payload.id)
            ? { ...t, status: payload.status, pic_id: payload.pic_id }
            : t,
        );
      });

      if (needsRefresh) {
        fetchTodosRef.current();
      }
    };

    socket.on("connect", handleConnect);
    socket.on("TODO_UPDATED", handleTodoUpdate);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("TODO_UPDATED", handleTodoUpdate);
    };
  }, [isAdmin, user?.profile?.id]);

  const handleStatusChange = async (todoId, newStatus) => {
    try {
      await api.put(`/todo/${todoId}/status`, { newStatus });
      alert("Status tugas berhasil diperbarui!");
      fetchTodos();
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Gagal memperbarui status tugas";
      alert(`Error: ${errorMessage}`);
      fetchTodos();
    }
  };

  const handleAssignTodo = async (todoId, toUserId) => {
    try {
      await api.put(`/todo/${todoId}/assign`, { toUserId, reason: "Assign by admin" });
      alert("PIC tugas berhasil diperbarui!");
      fetchTodos();
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Gagal memperbarui PIC tugas";
      alert(`Error: ${errorMessage}`);
      fetchTodos();
    }
  };

  const handleCreateTodo = async (e) => {
    e.preventDefault();
    try {
      await api.post("/todo", newTodo);
      alert("Tugas berhasil ditambahkan!");
      setNewTodo({ clientName: "", jobType: "", startDate: "", deadline: "", pic_id: undefined });
      fetchTodos();
    } catch {
      alert("Gagal menambahkan tugas. Pastikan form terisi dengan benar.");
    }
  };

  if (loading)
    return (
      <div className="text-gray-600 animate-pulse font-medium">
        Memuat data tugas...
      </div>
    );
  if (error)
    return (
      <div className="text-red-600 font-bold p-4 bg-red-50 rounded-md">
        {error}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Form Input Data Baru */}
      <form
        onSubmit={handleCreateTodo}
        className="bg-gray-50 border border-gray-200 p-5 rounded-lg shadow-sm"
      >
        <h4 className="text-md font-semibold text-gray-700 mb-3">
          Tambah Tugas Baru
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Nama Klien</label>
            <input
              type="text"
              required
              value={newTodo.clientName}
              onChange={(e) =>
                setNewTodo({ ...newTodo, clientName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Pekerjaan</label>
            <input
              type="text"
              required
              value={newTodo.jobType}
              onChange={(e) =>
                setNewTodo({ ...newTodo, jobType: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Tanggal Mulai</label>
            <input
              type="date"
              required
              value={newTodo.startDate}
              onChange={(e) =>
                setNewTodo({ ...newTodo, startDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Tenggat Waktu</label>
            <input
              type="date"
              required
              value={newTodo.deadline}
              onChange={(e) =>
                setNewTodo({ ...newTodo, deadline: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          {isAdmin && (
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">PIC</label>
              <select
                value={newTodo.pic_id || ""}
                onChange={(e) =>
                  setNewTodo({ ...newTodo, pic_id: e.target.value ? Number(e.target.value) : undefined })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Pilih PIC</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded transition-colors h-[42px]"
          >
            Tambah Tugas
          </button>
        </div>
      </form>

      {/* Tabel Data Tugas */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="w-full border-collapse bg-white text-left text-sm text-gray-500">
          <thead className="bg-gray-100 text-xs font-semibold uppercase text-gray-700 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">Klien</th>
              <th className="px-6 py-4">Pekerjaan</th>
              <th className="px-6 py-4">Mulai</th>
              <th className="px-6 py-4">Tenggat</th>
              <th className="px-6 py-4">PIC</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {todos.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="px-6 py-10 text-center text-gray-400"
                >
                  Belum ada tugas.
                </td>
              </tr>
            ) : (
              todos.map((todo) => (
                <tr
                  key={todo.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {todo.clientName}
                  </td>
                  <td className="px-6 py-4">{todo.jobType}</td>
                  <td className="px-6 py-4">{todo.startDate}</td>
                  <td className="px-6 py-4 text-red-600 font-medium">
                    {todo.deadline}
                  </td>
                  <td className="px-6 py-4">
                    {isAdmin ? (
                      <select
                        value={todo.pic_id || ""}
                        onChange={(e) => handleAssignTodo(todo.id, Number(e.target.value))}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 p-1.5"
                      >
                        <option value="" disabled>Pilih PIC</option>
                        {staffList.map((staff) => (
                          <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">
                        {todo.User?.name || "No PIC"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={todo.status}
                      onChange={(e) =>
                        handleStatusChange(todo.id, e.target.value)
                      }
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 p-1.5 font-semibold"
                    >
                      <option value="TODO">TODO</option>
                      <option value="ONGOING">ONGOING</option>
                      <option value="DONE">DONE</option>
                      <option value="APPROVED">APPROVED</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ToDoList;
