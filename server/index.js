// server/index.js
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { generarContratoPDF } from "./utils/contratos.js";
import { parse } from "csv-parse/sync";


const { Pool } = pg;
const PORT = process.env.PORT || 10000 || 8787;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret";
const IS_PRODUCTION = process.env.DATABASE_URL ? true : false;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -------------------- Database Setup --------------------
let db;

if (IS_PRODUCTION) {
  // PostgreSQL para producción
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log("✅ Usando PostgreSQL (Producción)");
} else {
  // SQLite para desarrollo
  db = new Database("./data/db.sqlite", { fileMustExist: true });
  console.log("✅ Usando SQLite (Desarrollo)");
}

// Wrapper para unificar API de base de datos
const query = {
  get: async (sql, params = []) => {
    if (IS_PRODUCTION) {
      let paramIndex = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
      const result = await db.query(pgSql, params);
      return result.rows[0] || null;
    } else {
      return db.prepare(sql).get(...params);
    }
  },

  all: async (sql, params = []) => {
    if (IS_PRODUCTION) {
      let paramIndex = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
      const result = await db.query(pgSql, params);
      return result.rows;
    } else {
      return db.prepare(sql).all(...params);
    }
  },

  run: async (sql, params = []) => {
    if (IS_PRODUCTION) {
      let paramIndex = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
      await db.query(pgSql, params);
    } else {
      db.prepare(sql).run(...params);
    }
  }
};

// -------------------- App --------------------
const app = express();


// -------------------- CORS --------------------
const allowedOrigins = [
  "http://localhost:5173",
  "https://vbodegasf.onrender.com",
  "https://vbodegas.onrender.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Set-Cookie"]
}));

// Importante: middleware ANTES de definir rutas
app.use(express.json());
app.use(cookieParser());

// Responder preflights explícitamente (ayuda en algunos proxies)
app.options("*", cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(cookieParser());

// -------------------- TEST ROUTE --------------------
app.get("/api/ping", (req, res) => {
  res.json({ message: "pong" });
}); 



// -------------------- Helpers ----------------
function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, rol: user.rol }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function authMiddleware(req, res, next) {
  try {
    const bearer = req.headers.authorization?.replace("Bearer ", "");
    const token = bearer || req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: "No token" });
    }

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// -------------------- AUTH -------------------
app.post("/api/auth/email/register", async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Faltan datos" });

    const exists = await query.get("SELECT * FROM clientes WHERE email=?", [email]);
    if (exists) return res.status(400).json({ error: "Email ya registrado" });

    const hash = bcrypt.hashSync(password, 10);
    const id = Date.now().toString();
    await query.run("INSERT INTO clientes (id,nombre,email,hash,rol) VALUES (?,?,?,?,?)", 
      [id, nombre || "", email, hash, "cliente"]);

    const token = createToken({ id, email, rol: "cliente" });
    res.json({ ok: true, token });
  } catch (e) {
    console.error("Error en register:", e);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.post("/api/auth/email/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    let user = await query.get("SELECT * FROM administradores WHERE email=?", [email]);
    let tabla = "administradores";
    
    if (!user) {
      user = await query.get("SELECT * FROM clientes WHERE email=?", [email]);
      tabla = "clientes";
    }

    if (!user) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    if (!user.hash || !bcrypt.compareSync(password, user.hash)) {
      return res.status(400).json({ error: "Credenciales incorrectas" });
    }

    const token = createToken({
      id: user.id,
      email: user.email,
      rol: user.rol || (tabla === "administradores" ? "admin" : "cliente")
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: IS_PRODUCTION ? "none" : "lax",
      secure: IS_PRODUCTION,  // true en producción
      maxAge: 1000 * 60 * 60 * 24,
    });

    res.json({
      ok: true,
      token:token,
      usuario: { 
        id: user.id, 
        email: user.email, 
        rol: user.rol || (tabla === "administradores" ? "admin" : "cliente"),
        nombre: user.nombre
      }
    });
  } catch (e) {
    console.error("Error en login:", e);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    let user = await query.get("SELECT id, nombre, email, rol FROM administradores WHERE id = ?", [decoded.id]);

    if (!user) {
      user = await query.get("SELECT id, nombre, email, rol FROM clientes WHERE id = ?", [decoded.id]);
    }

    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error en /api/me:", err);
    res.status(401).json({ error: "Token inválido o expirado" });
  }
});

app.get("/api/bodegas", async (_req, res) => {
  try {
    const rows = await query.all(`
      SELECT *
      FROM bodegas
      ORDER BY
        CASE WHEN planta = 'baja' THEN 0
             WHEN planta = 'alta' THEN 1
             ELSE 2
        END,
        COALESCE(sort_order, 999999) ASC,
        id ASC
    `, []);

    const bodegas = rows.map((r) => {
      const estado = (() => {
        const v = String(r.status || "").toLowerCase().trim();
        if (["disponible", "available"].includes(v)) return "disponible";
        if (["apartada", "reserved"].includes(v)) return "apartada";
        if (["rentada", "sold", "ocupada"].includes(v)) return "rentada";
        return "disponible";
      })();

      return {
        id: r.id,
        number: r.number,
        planta: r.planta,
        medidas: r.medidas,
        metros: r.area_m2,
        precio: r.price,
        cualitativos: r.cualitativos,
        estado,
        points: r.points ? JSON.parse(r.points) : [],
      };
    });

    res.json(bodegas);
  } catch (err) {
    console.error("Error al obtener bodegas:", err);
    res.status(500).json({ error: "Error interno en la API" });
  }
});

// --- SSE ---
const clients = [];

app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const client = { id: Date.now(), res };
  clients.push(client);

  res.write(`event: ping\ndata: "pong"\n\n`);

  const interval = setInterval(() => {
    res.write(`event: ping\ndata: "pong"\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(interval);
    const idx = clients.findIndex(c => c.id === client.id);
    if (idx !== -1) clients.splice(idx, 1);
  });
});

function broadcast(event, data) {
  clients.forEach((c) => {
    c.res.write(`event: ${event}\n`);
    c.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

app.patch("/api/admin/bodegas/:id", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }

    const { estado, precio, cualitativos } = req.body;
    const id = req.params.id;

    await query.run("UPDATE bodegas SET status=?, price=?, cualitativos=? WHERE id=?",
      [estado, precio || "", cualitativos || "", id]);

    const r = await query.get("SELECT * FROM bodegas WHERE id=?", [id]);
    const normalized = {
      id: r.id,
      number: r.number,
      planta: r.planta,
      medidas: r.medidas,
      metros: r.area_m2,
      precio: r.price,
      cualitativos: r.cualitativos,
      estado: estado,
      points: r.points ? JSON.parse(r.points) : []
    };

    broadcast("bodegaUpdate", normalized);
    broadcast("log", {
      type: "update",
      entity: "bodega",
      id,
      user: req.user?.email || "admin",
      timestamp: new Date().toISOString(),
      changes: { precio, estado, cualitativos }
    });

    res.json({ ok: true, bodega: normalized });
  } catch (e) {
    console.error("Error en PATCH bodegas:", e);
    res.status(500).json({ error: "Error actualizando bodega" });
  }
});

app.patch("/api/admin/admins/:id/permisos", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }
    
    const { permisos } = req.body;
    await query.run("UPDATE clientes SET permisos=? WHERE id=?", [permisos, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error actualizando permisos:", e);
    res.status(500).json({ error: "Error actualizando permisos" });
  }
});

app.post("/api/admin/clientes/:id/recordatorio", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }
    
    const cliente = await query.get("SELECT * FROM clientes WHERE id=?", [req.params.id]);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    
    console.log(`Enviando recordatorio a ${cliente.email}`);
    
    broadcast("log", {
      type: "recordatorio_enviado",
      clienteId: req.params.id,
      user: req.user?.email || "admin",
      timestamp: new Date().toISOString()
    });
    
    res.json({ ok: true, mensaje: "Recordatorio enviado" });
  } catch (e) {
    console.error("Error enviando recordatorio:", e);
    res.status(500).json({ error: "Error enviando recordatorio" });
  }
});

app.get("/api/admin/stats", async (_req, res) => {
  try {
    const totalRow = await query.get("SELECT COUNT(*) as c FROM bodegas", []);
    const disponiblesRow = await query.get("SELECT COUNT(*) as c FROM bodegas WHERE status='disponible'", []);
    const apartadasRow = await query.get("SELECT COUNT(*) as c FROM bodegas WHERE status='apartada'", []);
    const rentadasRow = await query.get("SELECT COUNT(*) as c FROM bodegas WHERE status='rentada'", []);
    
    res.json({ 
      total: totalRow.c, 
      disponibles: disponiblesRow.c, 
      apartadas: apartadasRow.c, 
      rentadas: rentadasRow.c 
    });
  } catch (e) {
    console.error("Error en stats:", e);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

// ---- ADMIN: gestión de administradores ----
app.get("/api/admin/admins", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }
    const rows = await query.all("SELECT id, nombre, email, telefono, rol, permisos FROM administradores", []);
    res.json(rows);
  } catch (e) {
    console.error("Error obteniendo admins:", e);
    res.status(500).json({ error: "Error obteniendo administradores" });
  }
});

app.post("/api/admin/admins", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }

    const { nombre, email, password, telefono, rol, permisos } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son obligatorios" });
    }

    const exists = await query.get("SELECT * FROM administradores WHERE email=?", [email]);
    if (exists) {
      return res.status(400).json({ error: "Email ya registrado" });
    }

    const hash = bcrypt.hashSync(password, 10);
    const id = Date.now().toString();
    
    await query.run("INSERT INTO administradores (id,nombre,email,telefono,hash,rol,permisos) VALUES (?,?,?,?,?,?,?)",
      [id, nombre || "", email, telefono || "", hash, rol || "editor", permisos || "completo"]);

    res.json({ ok: true });
  } catch (e) {
    console.error("Error creando admin:", e);
    res.status(500).json({ error: "Error creando administrador: " + e.message });
  }
});

app.patch("/api/admin/admins/:id", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }

    const { nombre, email, telefono, password, rol, permisos } = req.body;
    
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await query.run("UPDATE administradores SET nombre=?, email=?, telefono=?, hash=?, rol=?, permisos=? WHERE id=?",
        [nombre, email, telefono, hash, rol, permisos, req.params.id]);
    } else {
      await query.run("UPDATE administradores SET nombre=?, email=?, telefono=?, rol=?, permisos=? WHERE id=?",
        [nombre, email, telefono, rol, permisos, req.params.id]);
    }
    
    res.json({ ok: true });
  } catch (e) {
    console.error("Error actualizando admin:", e);
    res.status(500).json({ error: "Error actualizando administrador: " + e.message });
  }
});

app.delete("/api/admin/admins/:id", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }
    await query.run("DELETE FROM administradores WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error eliminando admin:", e);
    res.status(500).json({ error: "Error eliminando administrador" });
  }
});

// handler de validate-superadmin por este:
// 🔐 CONTRASEÑA MAESTRA para acceder a gestión de administradores
// ⚠️ CAMBIAR ESTA CONTRASEÑA EN PRODUCCIÓN
const MASTER_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || "admin123"; // 👈 Cambia esto aquí cuando quieras actualizar la contraseña

app.post("/api/admin/validate-superadmin", authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;

    // Verificar que el usuario tenga permisos de admin
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Se requiere ser administrador" });
    }

    // Comparar con la contraseña maestra
    if (password !== MASTER_PASSWORD) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("Error validando contraseña:", e);
    res.status(500).json({ error: "Error validando contraseña" });
  }
});

// ---- CLIENTES ----
app.get("/api/admin/clientes", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }
    const rows = await query.all(`
      SELECT c.*, b.number as bodega_number, b.planta as bodega_planta 
      FROM clientes c 
      LEFT JOIN bodegas b ON c.bodega_id = b.id
    `, []);
    res.json(rows);
  } catch (e) {
    console.error("Error obteniendo clientes:", e);
    res.status(500).json({ error: "Error obteniendo clientes" });
  }
});

app.post("/api/admin/clientes", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }
    
    const { nombre, apellidos, email, telefono, regimen_fiscal, bodega_id, fecha_inicio, duracion_meses, pago_mensual } = req.body;
    
    if (!nombre || !email) {
      return res.status(400).json({ error: "Nombre y email son obligatorios" });
    }
    
    const exists = await query.get("SELECT * FROM clientes WHERE email=?", [email]);
    if (exists) {
      return res.status(400).json({ error: "Email ya registrado" });
    }
    
    let fecha_expiracion = null;
    if (fecha_inicio && duracion_meses) {
      const inicio = new Date(fecha_inicio);
      const expiracion = new Date(inicio);
      expiracion.setMonth(expiracion.getMonth() + parseInt(duracion_meses));
      fecha_expiracion = expiracion.toISOString().split('T')[0];
    }
    
    let modulo = "", planta = "", medidas = "", metros = 0;
    if (bodega_id) {
      const bodega = await query.get("SELECT * FROM bodegas WHERE id=?", [bodega_id]);
      if (bodega) {
        modulo = (bodega.number || "").split("-")[0] || "";
        planta = bodega.planta || "";
        medidas = bodega.medidas || "";
        metros = bodega.area_m2 || 0;
        await query.run("UPDATE bodegas SET status='apartada' WHERE id=?", [bodega_id]);
      }
    }
    
    const id = Date.now().toString();
    await query.run(`
      INSERT INTO clientes (
        id, nombre, apellidos, email, telefono, regimen_fiscal, bodega_id, 
        modulo, planta, medidas, metros, fecha_inicio, duracion_meses, 
        fecha_expiracion, pago_mensual, estado_contrato
      ) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      id, nombre, apellidos || "", email, telefono || "", regimen_fiscal || "", 
      bodega_id || null, modulo, planta, medidas, metros, fecha_inicio || null, 
      duracion_meses || 1, fecha_expiracion, pago_mensual || 0, "activo"
    ]);
    
    res.json({ ok: true });
  } catch (e) {
    console.error("Error creando cliente:", e);
    res.status(500).json({ error: "Error creando cliente: " + e.message });
  }
});

app.patch("/api/admin/clientes/:id", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }
    
    const { nombre, apellidos, email, telefono, regimen_fiscal, bodega_id, fecha_inicio, duracion_meses, pago_mensual, status, comentarios, descripcion } = req.body;
    

    
    let fecha_expiracion = null;
    if (fecha_inicio && duracion_meses) {
      const inicio = new Date(fecha_inicio);
      const expiracion = new Date(inicio);
      expiracion.setMonth(expiracion.getMonth() + parseInt(duracion_meses));
      fecha_expiracion = expiracion.toISOString().split('T')[0];
    }
    
    await query.run(`
      UPDATE clientes 
      SET nombre=?, apellidos=?, email=?, telefono=?, regimen_fiscal=?, 
          bodega_id=?, fecha_inicio=?, duracion_meses=?, fecha_expiracion=?, pago_mensual=?,
          status=?, comentarios=?, descripcion=?
      WHERE id=?
    `, [
      nombre, apellidos || "", email, telefono || "", regimen_fiscal || "", 
      bodega_id || null, fecha_inicio || null, duracion_meses || 1, 
      fecha_expiracion, pago_mensual || 0, status || "propuesta", 
      comentarios || "", descripcion || "", req.params.id
    ]);
    
    res.json({ ok: true });
  } catch (e) {
    console.error("Error actualizando cliente:", e);
    res.status(500).json({ error: "Error actualizando cliente: " + e.message });
  }
});

// Endpoint específico para actualizar pagos de un cliente
app.patch("/api/admin/clientes/:id/pagos", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins pueden actualizar pagos" });
    }
    const { abonos, saldo, vencido_hoy } = req.body;
    await query.run(`
      UPDATE clientes 
      SET abonos=?, saldo=?, vencido_hoy=?
      WHERE id=?
    `, [abonos || 0, saldo || 0, vencido_hoy || 0, req.params.id]);
    
    // Broadcast del cambio
    broadcast("log", {
      type: "pagos_actualizados",
      clienteId: req.params.id,
      user: req.user?.email || "admin",
      timestamp: new Date().toISOString(),
      cambios: { abonos, saldo, vencido_hoy }
    });
    
    res.json({ ok: true, mensaje: "Pagos actualizados correctamente" });
  } catch (e) {
    console.error("Error actualizando pagos:", e);
    res.status(500).json({ error: "Error actualizando pagos: " + e.message });
  }
});

app.delete("/api/admin/clientes/:id", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }
    
    const cliente = await query.get("SELECT bodega_id FROM clientes WHERE id=?", [req.params.id]);
    if (cliente?.bodega_id) {
      await query.run("UPDATE bodegas SET status='disponible' WHERE id=?", [cliente.bodega_id]);
    }
    
    await query.run("DELETE FROM clientes WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error eliminando cliente:", e);
    res.status(500).json({ error: "Error eliminando cliente" });
  }
});

app.get("/api/admin/stats-real", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }

    // Helper para convertir valores a número de forma segura
    const toNumber = (val) => {
      if (val === null || val === undefined || val === '') return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    const totalBodegasRow = await query.get("SELECT COUNT(*) as count FROM bodegas", []);
    const totalBodegas = toNumber(totalBodegasRow?.count);

    const disponiblesRow = await query.get("SELECT COUNT(*) as count FROM bodegas WHERE status='disponible'", []);
    const disponibles = toNumber(disponiblesRow?.count);

    const ocupadasRow = await query.get("SELECT COUNT(*) as count FROM bodegas WHERE status!='disponible'", []);
    const ocupadas = toNumber(ocupadasRow?.count);

    const totalClientesRow = await query.get("SELECT COUNT(*) as count FROM clientes", []);
    const totalClientes = toNumber(totalClientesRow?.count);

    const ocupacion = totalBodegas > 0 ? ((ocupadas / totalBodegas) * 100).toFixed(1) : "0.0";

    // Ingresos mensuales con manejo robusto de NULL
    const ingresosQuery = IS_PRODUCTION 
      ? "SELECT COALESCE(SUM(pago_mensual),0) as total FROM clientes WHERE estado_contrato='activo'"
      : "SELECT IFNULL(SUM(pago_mensual), 0) as total FROM clientes WHERE estado_contrato='activo'";
    
    const ingresosRow = await query.get(ingresosQuery, []);
    const ingresos = toNumber(ingresosRow?.total);

    // Tiempo promedio con manejo robusto de NULL
    const tiempoQuery = IS_PRODUCTION
      ? "SELECT COALESCE(AVG(duracion_meses),0) as promedio FROM clientes"
      : "SELECT IFNULL(AVG(duracion_meses), 0) as promedio FROM clientes";
    
    const tiempoRow = await query.get(tiempoQuery, []);
    const tiempoPromedio = toNumber(tiempoRow?.promedio);

    res.json({
      ocupacion: `${ocupacion}%`,
      ingresosMensuales: `$${ingresos.toLocaleString("es-MX")} MXN`,
      tiempoPromedio: `${tiempoPromedio.toFixed(1)} meses`,
      tasaConversion: "12.5%",
      totalBodegas,
      disponibles,
      ocupadas,
      totalClientes
    });
  } catch (e) {
    console.error("Error en /api/admin/stats-real:", e);
    res.status(500).json({ error: "Error obteniendo estadísticas: " + (e.message || "Error desconocido") });
  }
});
app.post("/api/admin/clientes/:id/asignar-bodega", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    const { bodega_id } = req.body;
    const clienteId = req.params.id;

    const bodega = await query.get("SELECT * FROM bodegas WHERE id=?", [bodega_id]);
    if (!bodega) {
      return res.status(404).json({ error: "Bodega no encontrada" });
    }

    const modulo = (bodega.number || "").split("-")[0] || "";
    const planta = bodega.planta || "";
    const medidas = bodega.medidas || "";
    const metros = bodega.area_m2 || 0;
    const pago_mensual = bodega.price || 0;

    await query.run(`
      UPDATE clientes 
      SET bodega_id=?, modulo=?, planta=?, medidas=?, metros=?, pago_mensual=?
      WHERE id=?
    `, [bodega_id, modulo, planta, medidas, metros, pago_mensual, clienteId]);

    await query.run("UPDATE bodegas SET status='apartada' WHERE id=?", [bodega_id]);

    const clienteActualizado = await query.get("SELECT * FROM clientes WHERE id=?", [clienteId]);

    broadcast("bodegaUpdate", {
      id: bodega.id,
      number: bodega.number,
      planta: bodega.planta,
      medidas: bodega.medidas,
      metros: bodega.area_m2,
      precio: bodega.price,
      cualitativos: bodega.cualitativos,
      estado: "apartada",
      points: bodega.points ? JSON.parse(bodega.points) : []
    });

    broadcast("log", {
      type: "cliente_asignado",
      bodegaId: bodega_id,
      clienteId: clienteId,
      user: req.user?.email || "admin",
      timestamp: new Date().toISOString()
    });

    res.json({ ok: true, cliente: clienteActualizado });
  } catch (e) {
    console.error("Error asignando cliente:", e);
    res.status(500).json({ error: "Error asignando cliente" });
  }
});

// Crear carpeta para contratos si no existe
const CONTRATOS_DIR = path.join(__dirname, "contratos_generados");
if (!fs.existsSync(CONTRATOS_DIR)) {
  fs.mkdirSync(CONTRATOS_DIR, { recursive: true });
}


// ========== ENDPOINT MEJORADO PARA GENERAR CONTRATO PDF ==========
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { formatearDineroContrato } from './utils/numeroALetras.js';

app.post("/api/admin/clientes/:id/generar-contrato", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    const clienteId = req.params.id;
    const { secciones } = req.body; // Array de secciones a generar
    
    // Obtener datos actualizados del cliente y bodega
    const cliente = await query.get(`
      SELECT c.*, b.number as bodega_number, b.planta as bodega_planta, 
             b.medidas, b.area_m2, b.price
      FROM clientes c 
      LEFT JOIN bodegas b ON c.bodega_id = b.id
      WHERE c.id=?
    `, [clienteId]);
    
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    if (!cliente.bodega_id) {
      return res.status(400).json({ error: "El cliente no tiene bodega asignada" });
    }

    // Cargar el PDF template
    const templatePath = path.join(__dirname, "templates", "contrato_template.pdf");
    
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ 
        error: "Template de contrato no encontrado"
      });
    }

    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    // Parsear autorizados
    let autorizados = [];
    if (cliente.autorizados) {
      try {
        autorizados = typeof cliente.autorizados === 'string' 
          ? JSON.parse(cliente.autorizados) 
          : cliente.autorizados;
      } catch (e) {
        console.error("Error parseando autorizados:", e);
        autorizados = [];
      }
    }

    // Helper para setear campos con autoSize
    const setFieldSafe = (fieldName, value, maxLength = null) => {
      try {
        const field = form.getTextField(fieldName);
        let texto = String(value || '');
        
        // Truncar si excede maxLength
        if (maxLength && texto.length > maxLength) {
          texto = texto.substring(0, maxLength);
        }
        
        field.setText(texto);
        field.enableReadOnly();
      } catch (error) {
        console.log(`Campo no encontrado: ${fieldName}`);
      }
    };

    // Formatear fechas
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    };

    const formatDateShort = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Datos procesados
    const fechaHoy = formatDate(new Date());
    const fechaHoyCorta = formatDateShort(new Date());
    const nombreCompleto = `${cliente.nombre || ''} ${cliente.apellidos || ''}`.trim();
    
    // Formatear precios con letra
    const precioMensual = parseFloat(cliente.pago_mensual || cliente.price || 0);
    const deposito = parseFloat(cliente.deposito || precioMensual);
    
    const precioMensualFormateado = formatearDineroContrato(precioMensual);
    const depositoFormateado = formatearDineroContrato(deposito);

    // ===== PAGE 1 - CONTRATO PRINCIPAL =====
    setFieldSafe('NOMBRE#12', nombreCompleto);
    setFieldSafe('NACIONALIDAD', cliente.nacionalidad || '');
    setFieldSafe('ACTIVIDAD', cliente.actividad || '');
    setFieldSafe('DIRECCION', cliente.direccion || '');
    setFieldSafe('TELEFONO', cliente.telefono || '');
    setFieldSafe('CORREO#1', cliente.email || '');
    setFieldSafe('RFC', cliente.rfc || '');
    setFieldSafe('CURP', cliente.curp || '');
    setFieldSafe('IDENTIFICACION', cliente.tipo_identificacion || '');
    setFieldSafe('NUMERO-IDENTIFICACION', cliente.numero_identificacion || '');
    setFieldSafe('BIENES', cliente.bienes_almacenar || '', 150);
    setFieldSafe('MODULO', (cliente.bodega_number || '').split('-')[0] || cliente.modulo || '');
    setFieldSafe('ID-BODEGA#4', cliente.bodega_number || cliente.bodega_id || '');
    setFieldSafe('M2#1', String(cliente.area_m2 || cliente.metros || ''));

    // ===== PAGE 2 - TÉRMINOS DEL CONTRATO =====
    const duracionTexto = `${cliente.duracion_meses || 12} meses`;
    setFieldSafe('DURACION', duracionTexto);
    setFieldSafe('FECHA-HOY#5', formatDateShort(cliente.fecha_inicio));
    setFieldSafe('FECHA-FIN#1', formatDateShort(cliente.fecha_expiracion));
    setFieldSafe('PRECIO#1', precioMensualFormateado);

    // ===== PAGE 5 - DEPÓSITO Y CORREO =====
    setFieldSafe('PRECIO#0', depositoFormateado);
    setFieldSafe('CORREO#0', cliente.email || '');

    // ===== PAGE 6 - FECHA Y NOMBRE =====
    setFieldSafe('FECHA HOY#1', fechaHoyCorta);
    setFieldSafe('NOMBRE#11', nombreCompleto);

    // ===== PAGE 7 - ANEXO 1 INVENTARIO =====
    setFieldSafe('ID-BODEGA#3', cliente.bodega_number || cliente.bodega_id || '');
    setFieldSafe('M2#0', String(cliente.area_m2 || cliente.metros || ''));
    setFieldSafe('NOMBRE#10', nombreCompleto);
    setFieldSafe('FECHA-HOY#4', fechaHoyCorta);
    setFieldSafe('NOMBRE#9', nombreCompleto);

    // ===== PAGE 8 - ANEXO 2 (AUTORIZADOS) =====
    setFieldSafe('NOMBRE#8', nombreCompleto);
    setFieldSafe('ID-BODEGA#2', cliente.bodega_number || cliente.bodega_id || '');
    
    // Autorizado 1
    if (autorizados[0] && autorizados[0].nombre) {
      setFieldSafe('FECHA1', formatDateShort(autorizados[0].fecha) || '');
      setFieldSafe('NOMBRE DEL AUTORIZADO1', autorizados[0].nombre);
      setFieldSafe('TIPO DE AUTORIZACION temporal_permanente1', autorizados[0].tipo || 'temporal');
    }
    
    // Autorizado 2
    if (autorizados[1] && autorizados[1].nombre) {
      setFieldSafe('FECHA2', formatDateShort(autorizados[1].fecha) || '');
      setFieldSafe('NOMBRE DEL AUTORIZADO2', autorizados[1].nombre);
      setFieldSafe('TIPO DE AUTORIZACION temporal_permanente2', autorizados[1].tipo || 'temporal');
    }
    
    // Autorizado 3
    if (autorizados[2] && autorizados[2].nombre) {
      setFieldSafe('FECHA3', formatDateShort(autorizados[2].fecha) || '');
      setFieldSafe('NOMBRE DEL AUTORIZADO3', autorizados[2].nombre);
      setFieldSafe('TIPO DE AUTORIZACION temporal_permanente3', autorizados[2].tipo || 'temporal');
    }
    
    setFieldSafe('NOMBRE#7', nombreCompleto);

    // ===== PAGE 9 - ANEXO 3 =====
    setFieldSafe('NOMBRE#6', nombreCompleto);
    setFieldSafe('ID-BODEGA#1', cliente.bodega_number || cliente.bodega_id || '');
    setFieldSafe('NOMBRE#5', nombreCompleto);

    // ===== PAGE 10 - ANEXO 4 =====
    setFieldSafe('NOMBRE#4', nombreCompleto);
    setFieldSafe('FECHA HOY#0', fechaHoyCorta);
    setFieldSafe('NOMBRE#3', nombreCompleto);

    // ===== PAGE 11 - ANEXO 5 =====
    setFieldSafe('NOMBRE#2', nombreCompleto);
    setFieldSafe('ID-BODEGA#0', cliente.bodega_number || cliente.bodega_id || '');
    setFieldSafe('FECHA-HOY#2', formatDateShort(cliente.fecha_inicio));
    setFieldSafe('FECHA-HOY#3', formatDateShort(cliente.fecha_inicio));
    setFieldSafe('FECHA-FIN#0', formatDateShort(cliente.fecha_expiracion));
    setFieldSafe('FECHA-HOY#1', fechaHoyCorta);
    setFieldSafe('NOMBRE#1', nombreCompleto);

    // ===== PAGE 14 - ANEXO 6 =====
    setFieldSafe('FECHA-HOY#0', fechaHoyCorta);
    setFieldSafe('NOMBRE#0', nombreCompleto);

    // Filtrar páginas según secciones seleccionadas (si se especificaron)
    let pdfFinal = pdfDoc;
    if (secciones && Array.isArray(secciones) && secciones.length > 0) {
      const pdfFiltrado = await PDFDocument.create();
      
      const paginasPorSeccion = {
        'contrato': [0, 1, 2, 3, 4, 5, 6], // Páginas 1-7 (índice 0-6)
        'anexo1': [7], // Página 8
        'anexo2': [8], // Página 9
        'anexo3': [9], // Página 10
        'anexo4': [10], // Página 11
        'anexo5': [11, 12, 13], // Páginas 12-14
        'anexo6': [14] // Página 15
      };
      
      const paginasAIncluir = new Set();
      secciones.forEach(seccion => {
        const paginas = paginasPorSeccion[seccion] || [];
        paginas.forEach(p => paginasAIncluir.add(p));
      });
      
      const paginasOrdenadas = Array.from(paginasAIncluir).sort((a, b) => a - b);
      const copiedPages = await pdfFiltrado.copyPages(pdfDoc, paginasOrdenadas);
      copiedPages.forEach(page => pdfFiltrado.addPage(page));
      
      pdfFinal = pdfFiltrado;
    }

    // Generar el PDF
    const pdfBytes = await pdfFinal.save();
    
    // Nombre del archivo
    const seccionTexto = secciones && secciones.length > 0 ? `_${secciones.join('_')}` : '_completo';
    const fileName = `Contrato_${cliente.nombre.replace(/\s+/g, '_')}${seccionTexto}_${Date.now()}.pdf`;
    const outputPath = path.join(CONTRATOS_DIR, fileName);
    fs.writeFileSync(outputPath, pdfBytes);

    // Log
    broadcast("log", {
      type: "contrato_generado",
      clienteId: clienteId,
      bodegaId: cliente.bodega_id,
      archivo: fileName,
      secciones: secciones || ['todas'],
      user: req.user?.email || "admin",
      timestamp: new Date().toISOString()
    });

    // Enviar el archivo
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(pdfBytes));

  } catch (e) {
    console.error("Error generando contrato:", e);
    res.status(500).json({ error: "Error generando contrato: " + e.message });
  }
});

// 🆕 NUEVO ENDPOINT: Auto-guardar datos del cliente
app.patch("/api/admin/clientes/:id/actualizar-datos-contrato", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    const { 
      nacionalidad, actividad, direccion, rfc, curp, 
      tipo_identificacion, numero_identificacion, bienes_almacenar,
      deposito, autorizados
    } = req.body;

    await query.run(`
      UPDATE clientes 
      SET nacionalidad=?, actividad=?, direccion=?, rfc=?, curp=?,
          tipo_identificacion=?, numero_identificacion=?, bienes_almacenar=?,
          deposito=?, autorizados=?
      WHERE id=?
    `, [
      nacionalidad || null,
      actividad || null,
      direccion || null,
      rfc || null,
      curp || null,
      tipo_identificacion || null,
      numero_identificacion || null,
      bienes_almacenar || null,
      deposito || 0,
      autorizados ? JSON.stringify(autorizados) : null,
      req.params.id
    ]);

    res.json({ ok: true, mensaje: "Datos guardados" });
  } catch (e) {
    console.error("Error guardando datos:", e);
    res.status(500).json({ error: e.message });
  }
});

// ========== ENDPOINT PARA LISTAR CONTRATOS GENERADOS ==========
app.get("/api/admin/contratos/archivos", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }

    const files = fs.readdirSync(CONTRATOS_DIR)
      .filter(file => file.endsWith('.pdf'))
      .map(file => ({
        nombre: file,
        fecha: fs.statSync(path.join(CONTRATOS_DIR, file)).mtime,
        size: fs.statSync(path.join(CONTRATOS_DIR, file)).size
      }))
      .sort((a, b) => b.fecha - a.fecha);

    res.json({ ok: true, contratos: files });
  } catch (e) {
    console.error("Error listando contratos:", e);
    res.status(500).json({ error: "Error listando contratos" });
  }
});

// ========== ENDPOINT PARA DESCARGAR CONTRATO ESPECÍFICO ==========
app.get("/api/admin/contratos/descargar/:filename", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }

    const filename = req.params.filename;
    const filePath = path.join(CONTRATOS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    res.download(filePath, filename);
  } catch (e) {
    console.error("Error descargando contrato:", e);
    res.status(500).json({ error: "Error descargando contrato" });
  }
});

app.post("/api/admin/clientes/:id/subir-contrato", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    broadcast("log", {
      type: "contrato_subido",
      clienteId: req.params.id,
      user: req.user?.email || "admin",
      timestamp: new Date().toISOString()
    });

    res.json({ 
      ok: true, 
      mensaje: "Contrato escaneado subido exitosamente"
    });
  } catch (e) {
    console.error("Error subiendo contrato:", e);
    res.status(500).json({ error: "Error subiendo contrato" });
  }
});

app.get("/api/admin/clientes/:id/contrato", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }

    const clienteId = req.params.id;
    const cliente = await query.get(`
      SELECT c.*, b.number as bodega_number, b.planta as bodega_planta 
      FROM clientes c 
      LEFT JOIN bodegas b ON c.bodega_id = b.id
      WHERE c.id=?
    `, [clienteId]);

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json({ ok: true, cliente });
  } catch (e) {
    console.error("Error obteniendo contrato:", e);
    res.status(500).json({ error: "Error obteniendo contrato" });
  }
});

app.post("/api/admin/exportar-excel", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor", "viewer"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Solo admins" });
    }

    const { planta, estados, modulos, precioMin, precioMax } = req.body;

    let queryText = `
      SELECT b.*, c.nombre as cliente_nombre, c.apellidos as cliente_apellidos, 
             c.email as cliente_email, c.telefono as cliente_telefono,
             c.pago_mensual, c.fecha_inicio, c.fecha_expiracion
      FROM bodegas b
      LEFT JOIN clientes c ON b.id = c.bodega_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (planta) {
      queryText += ` AND b.planta=${IS_PRODUCTION ? `$${paramCount++}` : '?'}`;
      params.push(planta);
    }

    if (estados && estados.length > 0) {
      const placeholders = estados.map(() => IS_PRODUCTION ? `$${paramCount++}` : '?').join(',');
      queryText += ` AND b.status IN (${placeholders})`;
      params.push(...estados);
    }

    if (modulos && modulos.length > 0) {
      const moduloConditions = modulos.map(() => `b.number LIKE ${IS_PRODUCTION ? `$${paramCount++}` : '?'}`).join(' OR ');
      queryText += ` AND (${moduloConditions})`;
      params.push(...modulos.map(m => `${m}-%`));
    }

    if (precioMin) {
      queryText += ` AND b.price >= ${IS_PRODUCTION ? `$${paramCount++}` : '?'}`;
      params.push(precioMin);
    }

    if (precioMax) {
      queryText += ` AND b.price <= ${IS_PRODUCTION ? `$${paramCount++}` : '?'}`;
      params.push(precioMax);
    }

    const rows = await query.all(queryText, params);

    broadcast("log", {
      type: "exportacion_excel",
      cantidad: rows.length,
      user: req.user?.email || "admin",
      timestamp: new Date().toISOString()
    });

    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("Error exportando a Excel:", e);
    res.status(500).json({ error: "Error exportando datos" });
  }
});

// ENDPOINT TEMPORAL - BORRAR DESPUÉS DE USAR
app.post("/api/setup-superadmin", async (req, res) => {
  try {
    const { secret } = req.body;
    
    if (secret !== "inicializar-vbodegas-2024") {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    // ELIMINAR TODOS los admins con ese email
    await query.run("DELETE FROM administradores WHERE email=?", ["admin@vbodegas.com"]);
    
    // Crear uno nuevo limpio con ID fijo
    const hashed = bcrypt.hashSync("admin123", 10);
    await query.run(`
      INSERT INTO administradores (id, nombre, email, telefono, rol, permisos, hash)
      VALUES (?,?,?,?,?,?,?)
    `, ["superadmin-1", "Super Admin", "admin@vbodegas.com", "0000000000", "superadmin", "completo", hashed]);

    res.json({ ok: true, mensaje: "Superadmin recreado limpiamente" });
  } catch (e) {
    console.error("Error configurando superadmin:", e);
    res.status(500).json({ error: e.message });
  }
});


// ========== ENDPOINT PARA GENERAR GRID DE CALIBRACIÓN ==========
import { generarGridCalibracion } from "./utils/contratos.js";

app.get("/api/admin/contratos/calibrar", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    const templatePath = path.join(__dirname, "templates", "contrato_template.pdf");
    const outputPath = path.join(CONTRATOS_DIR, `Calibracion_${Date.now()}.pdf`);

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: "Template no encontrado" });
    }

    await generarGridCalibracion(templatePath, outputPath, 50); // Grid cada 50px
    
    res.download(outputPath, "Calibracion.pdf");
  } catch (e) {
    console.error("Error generando grid:", e);
    res.status(500).json({ error: "Error generando grid: " + e.message });
  }
});

// ========== 🆕 ENDPOINT PARA IMPORTAR CSV DE CLIENTES ==========
// AGREGAR ESTO AL FINAL de server/index.js, JUSTO ANTES DE app.listen()
// Asegúrate de que ya existe: import { parse } from "csv-parse/sync"; al inicio del archivo

app.post("/api/admin/clientes/importar-csv", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    const { csvData } = req.body;
    
    if (!csvData) {
      return res.status(400).json({ error: "No se proporcionó datos CSV" });
    }

    // Parsear CSV
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_quotes: true
    });

    const resultado = {
      exitosos: 0,
      errores: 0,
      duplicados: 0,
      actualizados: 0,
      detalles: []
    };

    // Procesar cada registro
    for (const record of records) {
      try {
        // Normalizar nombres de columnas (el CSV puede tener nombres variados)
        const propiedad = record.Propiedad || record.propiedad || "";
        const cliente = record.Cliente || record.cliente || "";
        const correo = (record.Correo || record.correo || record.email || "").trim().toLowerCase();
        const telefono = record.Telefono || record.telefono || "";
        
        // Validaciones básicas
        if (!cliente || !correo) {
          resultado.errores++;
          resultado.detalles.push(`⚠️ Fila sin nombre o email: ${JSON.stringify(record)}`);
          continue;
        }

        // Separar nombre y apellidos
        const nombreCompleto = cliente.split(' ');
        const nombre = nombreCompleto[0] || "";
        const apellidos = nombreCompleto.slice(1).join(' ') || "";

        // Parsear fechas
        const fechaInicio = record["F-Inicia"] || record["F.Inicia"] || record.fecha_inicio || "";
        const fechaFin = record.Finaliza || record.finaliza || "";
        const fechaEmision = record["F.Emision"] || record["F Emision"] || record.fecha_emision || "";

        // Parsear valores numéricos
        const vencidoHoy = parseFloat(String(record["Vencido Hoy"] || record.vencido_hoy || 0).replace(/[^0-9.-]/g, '')) || 0;
        const saldo = parseFloat(String(record.Saldo || record.saldo || 0).replace(/[^0-9.-]/g, '')) || 0;
        const abonos = parseFloat(String(record.Abonos || record.abonos || 0).replace(/[^0-9.-]/g, '')) || 0;
        const cargos = parseFloat(String(record.Cargos || record.cargos || 0).replace(/[^0-9.-]/g, '')) || 0;

        // Calcular duración en meses si hay fechas
        let duracionMeses = 12; // valor por defecto
        if (fechaInicio && fechaFin) {
          const inicio = new Date(fechaInicio);
          const fin = new Date(fechaFin);
          if (!isNaN(inicio.getTime()) && !isNaN(fin.getTime())) {
            duracionMeses = Math.round((fin - inicio) / (1000 * 60 * 60 * 24 * 30));
          }
        }

        // Calcular pago mensual si hay cargos y duración
        const pagoMensual = duracionMeses > 0 ? (cargos / duracionMeses) : 0;

        // Buscar la bodega en la base de datos
        let bodegaId = null;
        let modulo = "";
        let planta = "";
        let medidas = "";
        let metros = 0;

        if (propiedad) {
          const bodega = await query.get(
            "SELECT * FROM bodegas WHERE id=? OR number=?", 
            [propiedad.trim(), propiedad.trim()]
          );
          
          if (bodega) {
            bodegaId = bodega.id;
            modulo = (bodega.number || "").split("-")[0] || "";
            planta = bodega.planta || "";
            medidas = bodega.medidas || "";
            metros = bodega.area_m2 || 0;
            
            // Actualizar estado de bodega a apartada si no está rentada
            if (bodega.status !== "rentada") {
              await query.run("UPDATE bodegas SET status='apartada' WHERE id=?", [bodega.id]);
            }
          }
        }

        // Verificar si el cliente ya existe
        const existente = await query.get("SELECT * FROM clientes WHERE email=?", [correo]);

        if (existente) {
          // Actualizar cliente existente
          await query.run(`
            UPDATE clientes SET
              nombre=?, apellidos=?, telefono=?, bodega_id=?, modulo=?, planta=?,
              medidas=?, metros=?, fecha_inicio=?, duracion_meses=?, fecha_expiracion=?,
              pago_mensual=?, tipo_contrato=?, vencido_hoy=?, saldo=?, abonos=?,
              cargos=?, fecha_emision=?, descripcion=?, factura=?, comentarios=?
            WHERE email=?
          `, [
            nombre, apellidos, telefono, bodegaId, modulo, planta, medidas, metros,
            fechaInicio || null, duracionMeses, fechaFin || null, pagoMensual,
            record["Tipo Contrato"] || "Arrendamiento",
            vencidoHoy, saldo, abonos, cargos, fechaEmision || null,
            record.Descripcion || record.descripcion || "",
            record.Factura || record.factura || "",
            record["Comentarios:"] || record.Comentarios || record.comentarios || "",
            correo
          ]);
          
          resultado.actualizados++;
          resultado.detalles.push(`🔄 Actualizado: ${nombre} ${apellidos} (${correo})`);
        } else {
          // Crear nuevo cliente
          const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          
          await query.run(`
            INSERT INTO clientes (
              id, nombre, apellidos, email, telefono, bodega_id, modulo, planta,
              medidas, metros, fecha_inicio, duracion_meses, fecha_expiracion,
              pago_mensual, tipo_contrato, vencido_hoy, saldo, abonos, cargos,
              fecha_emision, descripcion, factura, comentarios, estado_contrato
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `, [
            id, nombre, apellidos, correo, telefono, bodegaId, modulo, planta,
            medidas, metros, fechaInicio || null, duracionMeses, fechaFin || null,
            pagoMensual, record["Tipo Contrato"] || "Arrendamiento",
            vencidoHoy, saldo, abonos, cargos, fechaEmision || null,
            record.Descripcion || record.descripcion || "",
            record.Factura || record.factura || "",
            record["Comentarios:"] || record.Comentarios || record.comentarios || "",
            "activo"
          ]);
          
          resultado.exitosos++;
          resultado.detalles.push(`✅ Creado: ${nombre} ${apellidos} (${correo})`);
        }

      } catch (error) {
        resultado.errores++;
        resultado.detalles.push(`❌ Error procesando: ${error.message}`);
        console.error("Error procesando registro:", error);
      }
    }

    // Broadcast del evento
    broadcast("log", {
      type: "importacion_csv",
      resultado: resultado,
      user: req.user?.email || "admin",
      timestamp: new Date().toISOString()
    });

    res.json({ 
      ok: true, 
      resultado,
      mensaje: `Importación completada: ${resultado.exitosos} creados, ${resultado.actualizados} actualizados, ${resultado.errores} errores`
    });

  } catch (e) {
    console.error("Error en importación CSV:", e);
    res.status(500).json({ 
      error: "Error procesando CSV: " + e.message,
      detalles: e.stack 
    });
  }
});


// -------------------- Server -----------------
app.listen(PORT, () => {
  console.log(`✅ API lista en http://localhost:${PORT}`);
});


