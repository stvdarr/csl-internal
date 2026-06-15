import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { extractTokenFromRequest } from "../utils/cookieAuth.js";

export const verifyToken = (req, res, next) => {
  const token = extractTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: "Akses ditolak! Token tidak ditemukan." });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: "Token tidak valid atau sudah kedaluwarsa!" });
  }
};
