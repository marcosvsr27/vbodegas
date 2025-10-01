// server/seed-postgres.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { parse } from "csv-parse/sync";

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const CSV_PATH = path.join(DATA_DIR, "bodegas.csv");
const COORDS_ALTA = path.join(DATA_DIR, "coordenadas_alta_final.json");
const COORDS_BAJA = path.join(DATA_DIR, "coordenadas_baja_final.json");

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log("Conectado a PostgreSQL");

  try {
    // Limpiar tablas existentes
    await client.query("DELETE FROM clientes");
    await client.query("DELETE FROM bodegas");
    console.log("Tablas limpiadas");

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

    console.log(`Insertando ${records.length} bodegas...`);

    // Insertar bodegas
    for (const r of records) {
      const id = r.NUMBER.trim();
      const coords = coordMap.get(id);

      await client.query(`
        INSERT INTO bodegas (id, number, planta, medidas, area_m2, price, cualitativos, status, points)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        id,
        id,
        coords ? coords.planta : "",
        r.MEDIDAS || "",
        parseFloat(r.M2) || 0,
        parseFloat((r["PRECIO RENTA"] || "").replace(/[^0-9.]/g, "")) || 0,
        r.CUALITATIVOS || "",
        "disponible",
        coords ? JSON.stringify(coords.points) : "[]"
      ]);
    }

    console.log(`✅ Seed completado: ${records.length} bodegas insertadas`);
  } catch (error) {
    console.error("❌ Error durante el seed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch(console.error);