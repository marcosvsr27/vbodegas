import Database from "better-sqlite3"

const dbPath = "./data/db.sqlite"
const db = new Database(dbPath)

// Total de registros
const total = db.prepare("SELECT COUNT(*) as n FROM bodegas").get().n

// Cuántas tienen puntos cargados
const conPuntos = db.prepare(`
  SELECT COUNT(*) as n FROM bodegas
  WHERE points IS NOT NULL AND length(points) > 5
`).get().n

// Ejemplos (primeras 5 bodegas con puntos)
const sample = db.prepare(`
  SELECT id, planta, status, json_array_length(points) as n
  FROM bodegas
  LIMIT 5
`).all()

console.log("📊 Total bodegas:", total)
console.log("📍 Con puntos:", conPuntos)
console.log("🔎 Ejemplos:", sample)