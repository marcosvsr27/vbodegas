// server/export-svg.js
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "server", "data", "db.sqlite");
const db = new Database(DB_PATH);

function exportSVG(planta, outFile) {
  const rows = db.prepare("SELECT id, points FROM bodegas WHERE planta = ?").all(planta);

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
  <rect width="100%" height="100%" fill="white"/>
`;

  for (const row of rows) {
    if (!row.points) continue;
    const pts = JSON.parse(row.points).map(([x,y]) => `${x*1200},${y*800}`).join(" ");
    svg += `  <polygon id="${row.id}" points="${pts}" fill="rgba(0,200,0,0.3)" stroke="green" stroke-width="1"/>\n`;
  }

  svg += `</svg>`;

  fs.writeFileSync(outFile, svg, "utf8");
  console.log(`✅ Exportado ${rows.length} polígonos a ${outFile}`);
}

exportSVG("baja", "app/public/baja.fixed.svg");
exportSVG("alta", "app/public/alta.fixed.svg");

