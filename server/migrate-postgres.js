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
    console.log("🔄 Conectado a PostgreSQL. Migrando...\n");

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

    // Agregar sort_order si no existe
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

    // TABLA: clientes (con TODOS los campos)
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
        permisos VARCHAR(50),
        tipo_contrato VARCHAR(100),
        vencido_hoy DECIMAL(10,2),
        saldo DECIMAL(10,2),
        abonos DECIMAL(10,2),
        cargos DECIMAL(10,2),
        fecha_emision DATE,
        descripcion TEXT,
        factura VARCHAR(50),
        comentarios TEXT,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ Tabla clientes");

    // Agregar columnas nuevas si la tabla ya existía
    const columnasNuevas = [
      { nombre: 'tipo_contrato', tipo: 'VARCHAR(100)' },
      { nombre: 'vencido_hoy', tipo: 'DECIMAL(10,2)' },
      { nombre: 'saldo', tipo: 'DECIMAL(10,2)' },
      { nombre: 'abonos', tipo: 'DECIMAL(10,2)' },
      { nombre: 'cargos', tipo: 'DECIMAL(10,2)' },
      { nombre: 'fecha_emision', tipo: 'DATE' },
      { nombre: 'descripcion', tipo: 'TEXT' },
      { nombre: 'factura', tipo: 'VARCHAR(50)' },
      { nombre: 'comentarios', tipo: 'TEXT' }
    ];

    for (const col of columnasNuevas) {
      try {
        await client.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ${col.nombre} ${col.tipo}`);
        console.log(`✓ Columna ${col.nombre} verificada`);
      } catch (e) {
        console.log(`ℹ Columna ${col.nombre} ya existe`);
      }
    }

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
    console.log("\n📋 Próximos pasos:");
    console.log("  1. Ejecuta el servidor en producción");
    console.log("  2. Ve a Admin Panel → Clientes");
    console.log("  3. Usa el botón 'Importar CSV'\n");

  } catch (error) {
    console.error("❌ Error en migración:", error);
    throw error;
  } finally {
    await client.end();
  }
}

migrate();