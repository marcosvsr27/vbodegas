import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("🔍 DIAGNÓSTICO DEL PROBLEMA A-101");
console.log("=====================================\n");

// 1. Verificar archivos
console.log("1️⃣ VERIFICANDO ARCHIVOS:");
const dbPath = path.join(__dirname, "data", "db.sqlite");
const csvPath = path.join(__dirname, "data", "bodegas.csv");
const bajaPath = path.join(__dirname, "data", "coordenadas_baja_final.json");
const altaPath = path.join(__dirname, "data", "coordenadas_alta_final.json");

console.log(`   📂 Base de datos: ${fs.existsSync(dbPath) ? '✅' : '❌'} ${dbPath}`);
console.log(`   📂 CSV: ${fs.existsSync(csvPath) ? '✅' : '❌'} ${csvPath}`);
console.log(`   📂 Coordenadas baja: ${fs.existsSync(bajaPath) ? '✅' : '❌'} ${bajaPath}`);
console.log(`   📂 Coordenadas alta: ${fs.existsSync(altaPath) ? '✅' : '❌'} ${altaPath}`);

if (!fs.existsSync(dbPath)) {
  console.log("\n❌ BASE DE DATOS NO EXISTE");
  console.log("   Ejecuta: node setup-database.js");
  process.exit(1);
}

// 2. Verificar base de datos
console.log("\n2️⃣ VERIFICANDO BASE DE DATOS:");
const db = new Database(dbPath);

try {
  const total = db.prepare("SELECT COUNT(*) as count FROM bodegas").get();
  console.log(`   📊 Total bodegas en DB: ${total.count}`);
  
  if (total.count === 0) {
    console.log("   ❌ Base de datos vacía - Ejecuta: node setup-database.js");
    process.exit(1);
  }
  
  // Verificar distribución de números
  const distintosNumbers = db.prepare("SELECT COUNT(DISTINCT number) as count FROM bodegas").get();
  console.log(`   📊 Números únicos: ${distintosNumbers.count}`);
  
  if (distintosNumbers.count === 1) {
    console.log("   ❌ PROBLEMA ENCONTRADO: Solo hay 1 número único");
    const numero = db.prepare("SELECT number FROM bodegas LIMIT 1").get();
    console.log(`   🔍 Número repetido: ${numero.number}`);
  }
  
  // Mostrar primeras bodegas
  console.log("\n   📋 Primeras 10 bodegas:");
  const samples = db.prepare("SELECT number, planta, price, status FROM bodegas LIMIT 10").all();
  samples.forEach((b, i) => {
    console.log(`   ${i+1}. ${b.number} | ${b.planta} | $${b.price} | ${b.status}`);
  });
  
} catch (error) {
  console.log(`   ❌ Error consultando DB: ${error.message}`);
}

// 3. Verificar coordenadas
console.log("\n3️⃣ VERIFICANDO COORDENADAS:");
if (fs.existsSync(bajaPath) && fs.existsSync(altaPath)) {
  const bajaRaw = JSON.parse(fs.readFileSync(bajaPath, "utf8"));
  const altaRaw = JSON.parse(fs.readFileSync(altaPath, "utf8"));
  
  console.log(`   📊 Coordenadas planta baja: ${bajaRaw.length}`);
  console.log(`   📊 Coordenadas planta alta: ${altaRaw.length}`);
  
  // Mostrar algunos IDs de coordenadas
  console.log("\n   🔍 Primeros IDs en coordenadas baja:");
  bajaRaw.slice(0, 5).forEach((item, i) => {
    console.log(`   ${i+1}. ${item.id} | status: ${item.status} | area: ${item.area_m2}`);
  });
  
  console.log("\n   🔍 Primeros IDs en coordenadas alta:");
  altaRaw.slice(0, 5).forEach((item, i) => {
    console.log(`   ${i+1}. ${item.id} | status: ${item.status} | area: ${item.area_m2}`);
  });
}

// 4. Verificar CSV
console.log("\n4️⃣ VERIFICANDO CSV:");
if (fs.existsSync(csvPath)) {
  const csvData = fs.readFileSync(csvPath, "utf8");
  const lines = csvData.split('\n');
  
  console.log(`   📊 Total líneas en CSV: ${lines.length}`);
  console.log(`   📋 Header: ${lines[0]}`);
  
  // Procesar primeras líneas para mostrar números
  console.log("\n   🔍 Primeras 5 bodegas en CSV:");
  lines.slice(1, 6).forEach((line, i) => {
    if (!line.trim()) return;
    const columns = line.split(',');
    if (columns.length >= 2) {
      const number = columns[1]?.replace(/"/g, '').trim();
      console.log(`   ${i+1}. ${number}`);
    }
  });
}

// 5. Verificar coincidencias
console.log("\n5️⃣ VERIFICANDO COINCIDENCIAS:");
if (fs.existsSync(csvPath) && fs.existsSync(bajaPath) && fs.existsSync(altaPath)) {
  const csvData = fs.readFileSync(csvPath, "utf8");
  const lines = csvData.split('\n').slice(1);
  
  const bajaRaw = JSON.parse(fs.readFileSync(bajaPath, "utf8"));
  const altaRaw = JSON.parse(fs.readFileSync(altaPath, "utf8"));
  
  const coordIds = new Set([
    ...bajaRaw.map(item => item.id),
    ...altaRaw.map(item => item.id)
  ]);
  
  console.log(`   📊 IDs únicos en coordenadas: ${coordIds.size}`);
  
  let coincidencias = 0;
  let csvNumbers = [];
  
  lines.forEach(line => {
    if (!line.trim()) return;
    const columns = line.split(',');
    if (columns.length >= 2) {
      const number = columns[1]?.replace(/"/g, '').trim();
      if (number) {
        csvNumbers.push(number);
        if (coordIds.has(number)) {
          coincidencias++;
        }
      }
    }
  });
  
  console.log(`   📊 Números únicos en CSV: ${new Set(csvNumbers).size}`);
  console.log(`   📊 Coincidencias CSV ↔ Coordenadas: ${coincidencias}`);
  
  if (coincidencias === 0) {
    console.log("   ❌ PROBLEMA: No hay coincidencias entre CSV y coordenadas");
    console.log("\n   🔍 Comparando formatos:");
    console.log(`   CSV (primeros 3): ${csvNumbers.slice(0, 3).join(', ')}`);
    console.log(`   Coordenadas (primeros 3): ${Array.from(coordIds).slice(0, 3).join(', ')}`);
  }
}

// 6. Simular consulta del backend
console.log("\n6️⃣ SIMULANDO CONSULTA DEL BACKEND:");
try {
  const rows = db.prepare(`
    SELECT id, number, planta, medidas, area_m2, price, cualitativos, status
    FROM bodegas 
    ORDER BY number 
    LIMIT 5
  `).all();
  
  console.log("   📋 Datos que devolvería el backend:");
  rows.forEach((r, i) => {
    console.log(`   ${i+1}. ID: ${r.id} | Number: ${r.number} | Planta: ${r.planta} | Precio: ${r.price}`);
  });
  
} catch (error) {
  console.log(`   ❌ Error en consulta: ${error.message}`);
}

db.close();

console.log("\n🎯 RECOMENDACIONES:");
if (total && total.count === 0) {
  console.log("   1. Ejecutar: node setup-database.js");
} else if (distintosNumbers && distintosNumbers.count === 1) {
  console.log("   1. Problema en los datos - verificar CSV y coordenadas");
  console.log("   2. Re-ejecutar: node setup-database.js");
} else {
  console.log("   1. Verificar que el servidor esté usando esta base de datos");
  console.log("   2. Limpiar cache del navegador (Ctrl+F5)");
  console.log("   3. Verificar endpoint: curl http://localhost:8787/api/bodegas");
}

console.log("\n✅ Diagnóstico completado");