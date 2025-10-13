// server/migrate.js
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const db = new Database("./data/db.sqlite");

console.log("🔄 Iniciando migración SQLite...\n");

try {
  // 1) Crear tabla administradores
  db.prepare(`
    CREATE TABLE IF NOT EXISTS administradores (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      email TEXT UNIQUE,
      telefono TEXT,
      rol TEXT DEFAULT 'editor',
      permisos TEXT DEFAULT 'completo',
      hash TEXT
    )
  `).run();
  console.log("✓ Tabla administradores");

  // 2) Crear tabla bodegas
  db.prepare(`
    CREATE TABLE IF NOT EXISTS bodegas (
      id TEXT PRIMARY KEY,
      number TEXT,
      planta TEXT,
      medidas TEXT,
      area_m2 REAL,
      price REAL,
      cualitativos TEXT,
      status TEXT,
      points TEXT,
      clienteId TEXT
    )
  `).run();
  console.log("✓ Tabla bodegas");

  // 3) Crear tabla clientes con TODOS los campos
  db.prepare(`
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      apellidos TEXT,
      email TEXT UNIQUE NOT NULL,
      telefono TEXT,
      hash TEXT,
      rol TEXT DEFAULT 'cliente',
      regimen_fiscal TEXT,
      bodega_id TEXT,
      modulo TEXT,
      planta TEXT,
      medidas TEXT,
      metros REAL,
      fecha_inicio TEXT,
      duracion_meses INTEGER DEFAULT 1,
      fecha_expiracion TEXT,
      pago_mensual REAL DEFAULT 0,
      fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP,
      estado_contrato TEXT DEFAULT 'activo',
      permisos TEXT,
      tipo_contrato TEXT,
      vencido_hoy REAL,
      saldo REAL,
      abonos REAL,
      cargos REAL,
      fecha_emision TEXT,
      descripcion TEXT,
      factura TEXT,
      comentarios TEXT
    )
  `).run();
  console.log("✓ Tabla clientes");

  // 4) Agregar columnas nuevas si no existen (para bases existentes)
  const columnasNuevas = [
    'tipo_contrato TEXT',
    'vencido_hoy REAL',
    'saldo REAL', 
    'abonos REAL',
    'cargos REAL',
    'fecha_emision TEXT',
    'descripcion TEXT',
    'factura TEXT',
    'comentarios TEXT'
  ];

  for (const col of columnasNuevas) {
    const [nombre] = col.split(' ');
    try {
      db.prepare(`ALTER TABLE clientes ADD COLUMN ${col}`).run();
      console.log(`✓ Columna ${nombre} agregada`);
    } catch (e) {
      if (!String(e.message).includes("duplicate column name")) {
        console.log(`ℹ Columna ${nombre} ya existe`);
      }
    }
  }

  // 5) Agregar columna clienteId a bodegas si no existe
  try {
    db.prepare(`ALTER TABLE bodegas ADD COLUMN clienteId TEXT`).run();
    console.log("✓ Columna clienteId en bodegas agregada");
  } catch (e) {
    if (!String(e.message).includes("duplicate column name")) {
      console.log("ℹ Columna clienteId ya existe en bodegas");
    }
  }

  // 6) Insertar admin si no existe
  const admin = db.prepare(`SELECT id FROM administradores WHERE email = ?`).get("admin@vbodegas.com");
  if (!admin) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare(`
      INSERT INTO administradores (id, nombre, email, telefono, rol, permisos, hash)
      VALUES ('admin-1', 'Administrador', 'admin@vbodegas.com', '0000000000', 'superadmin', 'completo', ?)
    `).run(hash);
    console.log("✓ Admin creado: admin@vbodegas.com / admin123");
  } else {
    console.log("ℹ Admin ya existe");
  }

  console.log("\n✅ Migración completada exitosamente");
  console.log("\n📋 Próximos pasos:");
  console.log("  1. Ejecuta: npm run dev (en /server)");
  console.log("  2. Ejecuta: npm run dev (en /app)");
  console.log("  3. Ve a Admin Panel → Clientes");
  console.log("  4. Usa el botón 'Importar CSV'\n");

} catch (error) {
  console.error("\n❌ Error en migración:", error);
  throw error;
} finally {
  db.close();
}