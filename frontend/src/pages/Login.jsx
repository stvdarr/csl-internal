import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { motion } from "framer-motion";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Tarik fungsi login dari brankas Context
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault(); // Mencegah web reload saat form disubmit
    setError("");
    setIsLoading(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.message); // Tampilkan pesan error dari backend
    }
    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        maxWidth: "400px",
        margin: "100px auto",
        fontFamily: "sans-serif",
      }}
    >
      <h2>Login PT Catat Susun Lapor</h2>

      {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        <div>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div>
          <label>Password</label>
          <br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: "10px",
            backgroundColor: "#333",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          {isLoading ? "Loading..." : "Masuk"}
        </button>
      </form>
    </motion.div>
  );
};

export default Login;
