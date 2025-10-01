import Database from "better-sqlite3";
import pg from "pg";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

let db;

if (IS_PRODUCTION && process.env.DATABASE_URL) {
  // PostgreSQL en producción
  const { Pool } = pg;
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log("✅ Usando PostgreSQL");
} else {
  // SQLite en desarrollo
  db = new Database("./data/db.sqlite", { fileMustExist: true });
  console.log("✅ Usando SQLite");
}

// Wrapper para unificar la API
export const query = async (sql, params = []) => {
  if (IS_PRODUCTION) {
    const result = await db.query(sql, params);
    return result.rows;
  } else {
    return db.prepare(sql).all(...params);
  }
};

export const get = async (sql, params = []) => {
  if (IS_PRODUCTION) {
    const result = await db.query(sql, params);
    return result.rows[0];
  } else {
    return db.prepare(sql).get(...params);
  }
};

export const run = async (sql, params = []) => {
  if (IS_PRODUCTION) {
    await db.query(sql, params);
  } else {
    db.prepare(sql).run(...params);
  }
};

export default db;