import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret"

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" })
}
export function authRequired(role) {
  return (req, res, next) => {
    const h = req.headers.authorization || ""
    const token = h.startsWith("Bearer ") ? h.slice(7) : null
    if(!token) return res.status(401).json({error:"no token"})
    try {
      const data = jwt.verify(token, JWT_SECRET)
      if (role && data.role !== role) return res.status(403).json({error:"forbidden"})
      req.user = data
      next()
    } catch(e) {
      return res.status(401).json({error:"invalid token"})
    }
  }
}