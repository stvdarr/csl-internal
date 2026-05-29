import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// PrivateRoute: Penjaga komponen. Kalau belum login, tendang balik ke /login
const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  // Jangan langsung nendang kalau context lagi proses loading cek token
  if (loading) return <div>Memuat sistem...</div>;

  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;