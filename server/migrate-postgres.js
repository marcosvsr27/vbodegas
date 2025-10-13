// server/migrate-postgres.js
import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log("📄 Conectado a PostgreSQL. Migrando...");

    // TABLA: administradores
    await client.query(`
      CREATE TABLE IF NOT EXISTS administradores (
        id VARCHAR(255) PRIMARY KEY,
        nombre VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        telefono VARCHAR(50),
        hash TEXT NOT NULL,
        rol VARCHAR(50) DEFAULT 'editor',
        permisos VARCHAR(50) DEFAULT 'completo'
      );
    `);
    console.log("✓ Tabla administradores");

    // TABLA: bodegas (CON sort_order)
    await client.query(`
      CREATE TABLE IF NOT EXISTS bodegas (
        id VARCHAR(255) PRIMARY KEY,
        number VARCHAR(50),
        planta VARCHAR(50),
        medidas VARCHAR(100),
        area_m2 DECIMAL(10,2),
        price DECIMAL(10,2),
        cualitativos TEXT,
        status VARCHAR(50) DEFAULT 'disponible',
        points TEXT,
        sort_order INTEGER
      );
    `);
    console.log("✓ Tabla bodegas");

    // Agregar sort_order si no existe (para bases existentes)
    try {
      await client.query(`
        ALTER TABLE bodegas 
        ADD COLUMN IF NOT EXISTS sort_order INTEGER;
      `);
      console.log("✓ Columna sort_order verificada");
    } catch (e) {
      console.log("ℹ sort_order ya existe o no se pudo agregar");
    }

    // Crear índice
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bodegas_sort 
      ON bodegas(planta, sort_order);
    `);
    console.log("✓ Índice creado");

    // TABLA: clientes
    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id VARCHAR(255) PRIMARY KEY,
        nombre VARCHAR(255),
        apellidos VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        telefono VARCHAR(50),
        hash TEXT,
        rol VARCHAR(50) DEFAULT 'cliente',
        regimen_fiscal VARCHAR(100),
        bodega_id VARCHAR(255),
        modulo VARCHAR(50),
        planta VARCHAR(50),
        medidas VARCHAR(100),
        metros DECIMAL(10,2),
        fecha_inicio DATE,
        duracion_meses INTEGER DEFAULT 1,
        fecha_expiracion DATE,
        pago_mensual DECIMAL(10,2) DEFAULT 0,
        estado_contrato VARCHAR(50) DEFAULT 'activo',
        permisos VARCHAR(50)
      );
    `);
    console.log("✓ Tabla clientes");

    // INSERTAR ADMIN POR DEFECTO
    const adminCheck = await client.query(
      "SELECT * FROM administradores WHERE email=$1",
      ["admin@vbodegas.com"]
    );

    if (adminCheck.rows.length === 0) {
      const hash = bcrypt.hashSync("admin123", 10);
      await client.query(
        `INSERT INTO administradores (id, nombre, email, telefono, hash, rol, permisos) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          Date.now().toString(),
          "Super Admin",
          "admin@vbodegas.com",
          "",
          hash,
          "superadmin",
          "completo"
        ]
      );
      console.log("✓ Admin creado: admin@vbodegas.com / admin123");
    } else {
      console.log("✓ Admin ya existe");
    }

    console.log("\n✅ Migración completada exitosamente");
  } catch (error) {
    console.error("❌ Error en migración:", error);
    throw error;
  } finally {
    await client.end();
  }
}

migrate();
