// server/migrate.js
import Database from "better-sqlite3";

const db = new Database("./data/db.sqlite");

// 1) Crear tabla clientes si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    rol TEXT DEFAULT 'cliente',
    telefono TEXT,
    direccion TEXT
  )
`).run();

// 2) Agregar columna clienteId a bodegas si no existe
// SQLite no soporta IF NOT EXISTS para columnas. Intentamos y si existe, ignoramos error.
try {
  db.prepare(`ALTER TABLE bodegas ADD COLUMN clienteId TEXT`).run();
} catch (e) {
  if (!String(e.message).includes("duplicate column name")) {
    throw e;
  }
}

// 3) (Opcional) Insertar un admin si no existe
const admin = db.prepare(`SELECT id FROM clientes WHERE email = ?`).get("admin@vbodegas.com");
if (!admin) {
  db.prepare(`
    INSERT INTO clientes (id, nombre, email, rol, telefono, direccion)
    VALUES ('admin1', 'Administrador', 'admin@vbodegas.com', 'admin', '555-999-8888', 'Oficina Central')
  `).run();
}

console.log("✅ Migración aplicada sin borrar datos.");