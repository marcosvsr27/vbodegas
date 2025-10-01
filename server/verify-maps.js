// server/verify-maps.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "data", "bodegas.csv");
const BAJA_SVG = path.join(__dirname, "../app/public/baja.fixed.svg");
const ALTA_SVG = path.join(__dirname, "../app/public/alta.fixed.svg");

// Leer CSV
const csv = fs.readFileSync(CSV_PATH, "utf8");
const rows = parse(csv, { columns: true, skip_empty_lines: true });
const csvIds = rows.map(r => r.NUMBER.trim());

// Extraer IDs de <polygon> en SVG
function extractIds(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const svg = fs.readFileSync(filePath, "utf8");
  const ids = [...svg.matchAll(/<polygon[^>]+id="([^"]+)"/g)].map(m => m[1]);
  return ids;
}

const bajaIds = extractIds(BAJA_SVG);
const altaIds = extractIds(ALTA_SVG);
const svgIds = [...bajaIds, ...altaIds];

// 🔎 Comparaciones
const missingInSVG = csvIds.filter(id => !svgIds.includes(id));
const extraInSVG = svgIds.filter(id => !csvIds.includes(id));

console.log("✅ Total CSV:", csvIds.length);
console.log("✅ Total en SVGs:", svgIds.length);
console.log("🔎 Faltan en SVG:", missingInSVG);
console.log("🔎 Sobrantes en SVG:", extraInSVG);