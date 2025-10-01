// server/seed.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import bcrypt from "bcryptjs";

// Rutas
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.sqlite");
const CSV_PATH = path.join(DATA_DIR, "bodegas.csv");
const COORDS_ALTA = path.join(DATA_DIR, "coordenadas_alta_final.json");
const COORDS_BAJA = path.join(DATA_DIR, "coordenadas_baja_final.json");

// Asegurar que la carpeta data existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Borrar base anterior
if (fs.existsSync(DB_PATH)) {
  try {
    fs.unlinkSync(DB_PATH);
    console.log("DB anterior eliminada.");
  } catch (e) {
    console.error("Error eliminando DB. Cierra el servidor primero.");
    process.exit(1);
  }
}

// Crear base y tablas
const db = new Database(DB_PATH);

try {
  // Tabla administradores
  db.prepare(`
    CREATE TABLE administradores (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      email TEXT UNIQUE,
      telefono TEXT,
      rol TEXT DEFAULT 'editor',
      permisos TEXT DEFAULT 'completo',
      hash TEXT
    )
  `).run();

  // Tabla clientes
  db.prepare(`
    CREATE TABLE clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      apellidos TEXT,
      email TEXT UNIQUE,
      telefono TEXT,
      regimen_fiscal TEXT,
      bodega_id TEXT,
      modulo TEXT,
      planta TEXT,
      medidas TEXT,
      metros REAL,
      fecha_inicio TEXT,
      duracion_meses INTEGER,
      fecha_expiracion TEXT,
      pago_mensual REAL,
      fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP,
      estado_contrato TEXT DEFAULT 'activo'
    )
  `).run();

  // Tabla bodegas
  db.prepare(`
    CREATE TABLE bodegas (
      id TEXT PRIMARY KEY,
      number TEXT,
      planta TEXT,
      medidas TEXT,
      area_m2 REAL,
      price REAL,
      cualitativos TEXT,
      status TEXT,
      points TEXT,
      clienteId TEXT,
      clienteNombre TEXT
    )
  `).run();

  console.log("Tablas creadas correctamente");

  // Insertar admin inicial
  const hashed = bcrypt.hashSync("admin123", 10);
  db.prepare(`
    INSERT INTO administradores (id, nombre, email, telefono, rol, permisos, hash)
    VALUES ('admin-1', 'Administrador', 'admin@vbodegas.com', '0000000000', 'superadmin', 'completo', ?)
  `).run(hashed);

  console.log("Admin inicial creado: admin@vbodegas.com / admin123");

  // Cargar coordenadas
  const coordsAlta = JSON.parse(fs.readFileSync(COORDS_ALTA, "utf8"));
  const coordsBaja = JSON.parse(fs.readFileSync(COORDS_BAJA, "utf8"));
  const coordMap = new Map([
    ...coordsAlta.map(c => [c.id.trim(), { ...c, planta: "alta" }]),
    ...coordsBaja.map(c => [c.id.trim(), { ...c, planta: "baja" }]),
  ]);

  // Leer CSV
  const csvData = fs.readFileSync(CSV_PATH, "utf8");
  const records = parse(csvData, { columns: true, skip_empty_lines: true });

  // Insert bodegas
  const insert = db.prepare(`
    INSERT INTO bodegas (id, number, planta, medidas, area_m2, price, cualitativos, status, points)
    VALUES (@id, @number, @planta, @medidas, @area_m2, @price, @cualitativos, @status, @points)
  `);

  const insertMany = db.transaction((rows) => {
    for (const r of rows) {
      const id = r.NUMBER.trim();
      const coords = coordMap.get(id);

      insert.run({
        id,
        number: id,
        planta: coords ? coords.planta : "",
        medidas: r.MEDIDAS || "",
        area_m2: parseFloat(r.M2) || 0,
        price: parseFloat((r["PRECIO RENTA"] || "").replace(/[^0-9.]/g, "")) || 0,
        cualitativos: r.CUALITATIVOS || "",
        status: "disponible",
        points: coords ? JSON.stringify(coords.points) : "[]"
      });
    }
  });

  insertMany(records);
  console.log(`Seed completado: ${records.length} bodegas insertadas.`);

} catch (error) {
  console.error("Error durante el seed:", error);
  process.exit(1);
} finally {
  db.close();
}