// server/fix-svg-ids.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "data", "bodegas.csv");
const BAJA_SVG = path.join(__dirname, "../app/public/baja.svg");
const ALTA_SVG = path.join(__dirname, "../app/public/alta.svg");

// Leer CSV
const csv = fs.readFileSync(CSV_PATH, "utf8");
const rows = parse(csv, { columns: true, skip_empty_lines: true });

// IDs de bodegas según CSV
const ids = rows.map(r => r.NUMBER.trim());

// Función para renombrar IDs de polígonos
function fixSVG(filePath, ids) {
  let svg = fs.readFileSync(filePath, "utf8");

  let i = 0;
  svg = svg.replace(/<polygon([^>]+)id="([^"]+)"([^>]*)>/g, (match, pre, oldId, post) => {
    if (i < ids.length) {
      const newId = ids[i++];
      return `<polygon${pre}id="${newId}"${post}>`;
    }
    return match;
  });

  const outPath = filePath.replace(".svg", ".fixed.svg");
  fs.writeFileSync(outPath, svg, "utf8");
  console.log(`✅ SVG corregido: ${outPath}`);
}

// Procesar ambos SVG
fixSVG(BAJA_SVG, ids);
fixSVG(ALTA_SVG, ids);