// server/check-points.js
import Database from "better-sqlite3";

// 📍 Conectar a la BD
const db = new Database("./data/db.sqlite");

// 📍 Consultar todas las bodegas
const bodegas = db.prepare(`
  SELECT id, planta, medidas, area_m2, price, points
  FROM bodegas
`).all();

let conCoords = 0;
let sinCoords = 0;
const sinLista = [];

for (const b of bodegas) {
  if (b.points && b.points.trim() !== "[]" && b.points.trim() !== "") {
    conCoords++;
  } else {
    sinCoords++;
    sinLista.push(b.id);
  }
}

// 📊 Reporte
console.log(`✅ Total en BD: ${bodegas.length}`);
console.log(`📌 Con coordenadas: ${conCoords}`);
console.log(`⚠️  Sin coordenadas: ${sinCoords}`);

if (sinCoords > 0) {
  console.log("👉 Ejemplo IDs sin coordenadas:", sinLista.slice(0, 30));
}