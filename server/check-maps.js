// server/check-maps.js
import fs from "fs";
import Database from "better-sqlite3";

// 📍 Conectar a la BD
const db = new Database("./data/db.sqlite");

// 📍 Cargar coordenadas JSON
const coordsAlta = JSON.parse(fs.readFileSync("./data/coordenadas_alta_final.json", "utf8"));
const coordsBaja = JSON.parse(fs.readFileSync("./data/coordenadas_baja_final.json", "utf8"));
const coords = [...coordsAlta, ...coordsBaja];

// 📍 Map de coordenadas por ID
const coordMap = new Map(coords.map(c => [c.id.trim(), c]));

// 📍 Consultar todas las bodegas en la BD (usa los nombres reales de columnas)
const bodegas = db.prepare(`
  SELECT id, planta, medidas, area_m2, price, cualitativos, status, points
  FROM bodegas
`).all();

const sinCoords = [];
const conCoords = [];

for (const b of bodegas) {
  if (!coordMap.has(b.id.trim())) {
    sinCoords.push(b.id);
  } else {
    conCoords.push(b.id);
  }
}

// 📍 Reporte
console.log(`✅ Total en BD: ${bodegas.length}`);
console.log(`✅ Con coordenadas: ${conCoords.length}`);
console.log(`❌ Sin coordenadas: ${sinCoords.length}`);
if (sinCoords.length > 0) {
  console.log("IDs sin coordenadas:", sinCoords.slice(0, 50), "..."); // muestra los primeros 50
}