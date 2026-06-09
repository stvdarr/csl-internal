import axios from "axios";

// Bikin instance axios dengan base URL backend lu
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Interceptor: Satpam yang ngecek setiap request SEBELUM dikirim ke backend
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");

    // Kalau tokennya ada, tempelin di header Authorization
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default api;
