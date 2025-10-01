// app/src/utils/verifyBodegas.ts
import type { Bodega } from "../types";

export function verifyBodegas(bodegas: Bodega[]) {
  const resumen: Record<string, { total: number; sinPoints: string[] }> = {
    baja: { total: 0, sinPoints: [] },
    alta: { total: 0, sinPoints: [] },
  };

  bodegas.forEach((b) => {
    resumen[b.planta].total++;
    if (!b.points || b.points.length === 0) {
      resumen[b.planta].sinPoints.push(b.number);
    }
  });

  console.log("📊 Resumen bodegas:");
  console.log(`- Planta baja: ${resumen.baja.total} bodegas`);
  if (resumen.baja.sinPoints.length > 0) {
    console.warn("⚠️ Sin points en baja:", resumen.baja.sinPoints);
  }

  console.log(`- Planta alta: ${resumen.alta.total} bodegas`);
  if (resumen.alta.sinPoints.length > 0) {
    console.warn("⚠️ Sin points en alta:", resumen.alta.sinPoints);
  }
}