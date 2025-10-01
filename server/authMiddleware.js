import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secretito";

export function authMiddleware(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // guardamos info del usuario en la request
    next();
  } catch (err) {
    console.error("❌ authMiddleware error:", err);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

