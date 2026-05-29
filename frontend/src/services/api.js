import axios from "axios";

// Bikin instance axios dengan base URL backend lu
const api = axios.create({
  baseURL: "http://localhost:5000/api", // Sesuaikan dengan port backend
});

// Interceptor: Satpam yang ngecek setiap request SEBELUM dikirim ke backend
api.interceptors.request.use(
  (config) => {
    // Ambil token dari localStorage
    const token = localStorage.getItem("token");

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
