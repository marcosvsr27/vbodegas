// server/index.js
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const { Pool } = pg;
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret";
const IS_PRODUCTION = process.env.DATABASE_URL ? true : false;

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
  "https://vbodegasf.onrender.com"
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
    const rows = await query.all("SELECT * FROM bodegas", []);

    const bodegas = rows.map((r) => {
      const estado = (() => {
        const v = String(r.status || "").toLowerCase().trim();
        if (["disponible", "available"].includes(v)) return "disponible";
        if (["apartada", "reserved"].includes(v)) return "apartada";
        if (["vendida", "sold", "ocupada"].includes(v)) return "vendida";
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
    const vendidasRow = await query.get("SELECT COUNT(*) as c FROM bodegas WHERE status='vendida'", []);
    
    res.json({ 
      total: totalRow.c, 
      disponibles: disponiblesRow.c, 
      apartadas: apartadasRow.c, 
      vendidas: vendidasRow.c 
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
cat > /tmp/validate-fix.txt << 'EOF'
app.post("/api/admin/validate-superadmin", authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    console.log("🔍 1. Password recibida:", password ? "SÍ" : "NO");
    console.log("🔍 2. Usuario del token:", JSON.stringify(req.user));

    const yo = await query.get("SELECT * FROM administradores WHERE id=?", [req.user.id]);
    console.log("🔍 3. Admin encontrado:", yo ? JSON.stringify({id: yo.id, email: yo.email, rol: yo.rol, hasHash: !!yo.hash}) : "NULL");
    
    if (!yo) {
      console.log("❌ 4. Admin no existe");
      return res.status(401).json({ error: "No encontrado" });
    }
    
    console.log("🔍 5. Rol:", yo.rol, "| Normalizado:", (yo.rol || "").toLowerCase());
    if ((yo.rol || "").toLowerCase() !== "superadmin") {
      console.log("❌ 6. Rol incorrecto");
      return res.status(403).json({ error: "Se requiere rol superadmin" });
    }

    console.log("🔍 7. Hash existe:", !!yo.hash);
    if (!yo.hash) {
      console.log("❌ 8. No hay hash en BD");
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const match = bcrypt.compareSync(password, yo.hash);
    console.log("🔍 9. Password match:", match);
    
    if (!match) {
      console.log("❌ 10. Contraseña no coincide");
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    console.log("✅ 11. Validación exitosa");
    return res.json({ ok: true });
  } catch (e) {
    console.error("❌ Error validando superadmin:", e);
    res.status(500).json({ error: "Error validando contraseña" });
  }
});
EOF

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
    
    const { nombre, apellidos, email, telefono, regimen_fiscal, bodega_id, fecha_inicio, duracion_meses, pago_mensual } = req.body;
    
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
          bodega_id=?, fecha_inicio=?, duracion_meses=?, fecha_expiracion=?, pago_mensual=? 
      WHERE id=?
    `, [
      nombre, apellidos || "", email, telefono || "", regimen_fiscal || "", 
      bodega_id || null, fecha_inicio || null, duracion_meses || 1, 
      fecha_expiracion, pago_mensual || 0, req.params.id
    ]);
    
    res.json({ ok: true });
  } catch (e) {
    console.error("Error actualizando cliente:", e);
    res.status(500).json({ error: "Error actualizando cliente: " + e.message });
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

app.post("/api/admin/clientes/:id/generar-contrato", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin", "editor"].includes(req.user.rol)) {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    const clienteId = req.params.id;
    const cliente = await query.get("SELECT * FROM clientes WHERE id=?", [clienteId]);
    
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const bodega = await query.get("SELECT * FROM bodegas WHERE id=?", [cliente.bodega_id]);
    
    broadcast("log", {
      type: "contrato_generado",
      clienteId: clienteId,
      bodegaId: cliente.bodega_id,
      user: req.user?.email || "admin",
      timestamp: new Date().toISOString()
    });

    res.json({ 
      ok: true, 
      mensaje: "Contrato generado exitosamente",
      data: { cliente, bodega }
    });
  } catch (e) {
    console.error("Error generando contrato:", e);
    res.status(500).json({ error: "Error generando contrato" });
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

// -------------------- Server -----------------
app.listen(PORT, () => {
  console.log(`✅ API lista en http://localhost:${PORT}`);
});





