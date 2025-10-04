// server/utils/contratos.js
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * CONFIGURACIÓN CENTRALIZADA DE CAMPOS Y COORDENADAS
 * - page: índice 0-based (página 1 = 0)
 * - x, y: coordenadas en puntos PDF (origen inferior-izquierdo)
 * - size: tamaño de letra
 * - maxWidth (opcional): recorta o salta de línea si excede
 * - align: "left" | "center" | "right"
 *
 * IMPORTANTE: Estas coordenadas debes calibrarlas una vez con /api/admin/contratos/coords-grid
 * Quedan inicializadas con valores "placeholder" para que ajustes rápido.
 */
export const COORDS = {
  // === PORTADA / CUERPO PRINCIPAL ===
  arrendatario_nombre:     { page: 0, x: 72,  y: 710, size: 10 },
  arrendatario_rep:        { page: 0, x: 72,  y: 695, size: 10 },
  arrendatario_constit:    { page: 0, x: 72,  y: 680, size: 10, maxWidth: 450 },
  arrendatario_domicilio:  { page: 0, x: 72,  y: 665, size: 10, maxWidth: 450 },
  arrendatario_contacto:   { page: 0, x: 72,  y: 650, size: 10, maxWidth: 450 },
  bienes_declaracion:      { page: 0, x: 72,  y: 635, size: 10, maxWidth: 450 },

  bodega_ident:            { page: 1, x: 72,  y: 720, size: 10 }, // “Módulo D No. D-110…”
  bodega_superficie:       { page: 1, x: 72,  y: 705, size: 10 },

  vigencia_inicio:         { page: 1, x: 72,  y: 650, size: 10 },
  vigencia_fin:            { page: 1, x: 230, y: 650, size: 10 },

  renta_mensual:           { page: 1, x: 72,  y: 595, size: 10 },
  deposito_monto:          { page: 3, x: 72,  y: 690, size: 10 },

  banco_nombre:            { page: 2, x: 72,  y: 635, size: 10 },
  banco_cuenta:            { page: 2, x: 72,  y: 620, size: 10 },
  banco_clabe:             { page: 2, x: 72,  y: 605, size: 10 },

  // === ANEXO 1 (inventario entrega) ===
  anexo1_bodega:           { page: 6, x: 72,  y: 710, size: 10 },
  anexo1_superficie:       { page: 6, x: 72,  y: 695, size: 10 },
  anexo1_fecha_hora:       { page: 6, x: 72,  y: 610, size: 10 },

  // === ANEXO 2 (autorizaciones) - filas 1-3
  anexo2_fecha1:           { page: 7, x: 90,  y: 675, size: 10 },
  anexo2_nombre1:          { page: 7, x: 190, y: 675, size: 10, maxWidth: 320 },
  anexo2_tipo1:            { page: 7, x: 460, y: 675, size: 10 },

  anexo2_fecha2:           { page: 7, x: 90,  y: 660, size: 10 },
  anexo2_nombre2:          { page: 7, x: 190, y: 660, size: 10, maxWidth: 320 },
  anexo2_tipo2:            { page: 7, x: 460, y: 660, size: 10 },

  anexo2_fecha3:           { page: 7, x: 90,  y: 645, size: 10 },
  anexo2_nombre3:          { page: 7, x: 190, y: 645, size: 10, maxWidth: 320 },
  anexo2_tipo3:            { page: 7, x: 460, y: 645, size: 10 },

  // === ANEXO 3 (datos personales - referencia bodega)
  anexo3_bodega:           { page: 8, x: 72,  y: 710, size: 10 },

  // === ANEXO 4 (inventario bienes) - 8 filas ejemplo
  anexo4_filas: [
    { page: 9, y: 660 }, { page: 9, y: 645 }, { page: 9, y: 630 }, { page: 9, y: 615 },
    { page: 9, y: 600 }, { page: 9, y: 585 }, { page: 9, y: 570 }, { page: 9, y: 555 },
  ],
  anexo4_cols: { no: 72, cant: 120, desc: 200, val: 500 },

  // === ANEXO 5 (resumen prenda/identificación)
  anexo5_bodega:           { page: 10, x: 200, y: 705, size: 10 },
  anexo5_inicio:           { page: 10, x: 250, y: 690, size: 10 },
  anexo5_periodo:          { page: 10, x: 250, y: 675, size: 10 },

  // === ANEXO 6 (reglamento) - fecha
  anexo6_fecha:            { page: 11, x: 72, y: 710, size: 10 },

  // === FIRMAS (portada final o donde estén)
  firma_arrendador:        { page: 5, x: 200, y: 150, size: 10 },
  firma_arrendatario:      { page: 5, x: 380, y: 150, size: 10 },
};

/** Dibuja texto con opciones básicas (alineado y maxWidth) */
function drawTextWithOptions(page, text, { x, y, size = 10, font, color = rgb(0,0,0), align = "left", maxWidth }) {
  let drawX = x;
  const measured = font.widthOfTextAtSize(text, size);
  if (align === "center") drawX = x - measured / 2;
  if (align === "right")  drawX = x - measured;

  // Salto simple si excede maxWidth (división ingenua por palabras)
  if (maxWidth && measured > maxWidth) {
    const words = (text || "").toString().split(" ");
    let line = "", yy = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        page.drawText(line, { x, y: yy, size, font, color });
        yy -= size + 3; // interlineado
        line = w;
      } else {
        line = test;
      }
    }
    if (line) page.drawText(line, { x, y: yy, size, font, color });
    return;
  }

  page.drawText((text ?? "").toString(), { x: drawX, y, size, font, color });
}

/**
 * Genera el contrato en PDF manteniendo el diseño original.
 * @param {Object} data - Datos variables para el contrato
 * @param {string} templatePath - Ruta al PDF base
 * @param {string} outPath - Ruta de salida del PDF generado
 */
export async function generarContratoPDF(data, templatePath, outPath) {
  const bytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const getPage = (i) => pages[i];

  // === CUERPO PRINCIPAL (solo rellenamos “huecos” de datos) ===
  drawTextWithOptions(getPage(COORDS.arrendatario_nombre.page), data.arrendatario?.nombre, COORDS.arrendatario_nombre);
  drawTextWithOptions(getPage(COORDS.arrendatario_rep.page), data.arrendatario?.representante, COORDS.arrendatario_rep);
  drawTextWithOptions(getPage(COORDS.arrendatario_constit.page), data.arrendatario?.constitucion, { ...COORDS.arrendatario_constit, font });
  drawTextWithOptions(getPage(COORDS.arrendatario_domicilio.page), data.arrendatario?.domicilio, { ...COORDS.arrendatario_domicilio, font });
  drawTextWithOptions(getPage(COORDS.arrendatario_contacto.page), data.arrendatario?.contacto, { ...COORDS.arrendatario_contacto, font });
  drawTextWithOptions(getPage(COORDS.bienes_declaracion.page), data.arrendatario?.bienes, { ...COORDS.bienes_declaracion, font });

  drawTextWithOptions(getPage(COORDS.bodega_ident.page), data.bodega?.ident, COORDS.bodega_ident);
  drawTextWithOptions(getPage(COORDS.bodega_superficie.page), data.bodega?.superficie, COORDS.bodega_superficie);

  drawTextWithOptions(getPage(COORDS.vigencia_inicio.page), data.vigencia?.inicio, COORDS.vigencia_inicio);
  drawTextWithOptions(getPage(COORDS.vigencia_fin.page), data.vigencia?.fin, COORDS.vigencia_fin);

  drawTextWithOptions(getPage(COORDS.renta_mensual.page), data.pagos?.renta_mensual, COORDS.renta_mensual);
  drawTextWithOptions(getPage(COORDS.deposito_monto.page), data.pagos?.deposito, COORDS.deposito_monto);

  drawTextWithOptions(getPage(COORDS.banco_nombre.page), data.pagos?.banco, COORDS.banco_nombre);
  drawTextWithOptions(getPage(COORDS.banco_cuenta.page), data.pagos?.cuenta, COORDS.banco_cuenta);
  drawTextWithOptions(getPage(COORDS.banco_clabe.page), data.pagos?.clabe, COORDS.banco_clabe);

  // === ANEXO 1 ===
  drawTextWithOptions(getPage(COORDS.anexo1_bodega.page), data.anexo1?.bodega_linea, COORDS.anexo1_bodega);
  drawTextWithOptions(getPage(COORDS.anexo1_superficie.page), data.anexo1?.superficie_linea, COORDS.anexo1_superficie);
  drawTextWithOptions(getPage(COORDS.anexo1_fecha_hora.page), data.anexo1?.fecha_hora, COORDS.anexo1_fecha_hora);

  // === ANEXO 2 (hasta 3 filas) ===
  const a2 = data.anexo2 || [];
  const a2coords = [
    ["anexo2_fecha1", "anexo2_nombre1", "anexo2_tipo1"],
    ["anexo2_fecha2", "anexo2_nombre2", "anexo2_tipo2"],
    ["anexo2_fecha3", "anexo2_nombre3", "anexo2_tipo3"],
  ];
  a2.slice(0, 3).forEach((row, i) => {
    const [kF, kN, kT] = a2coords[i];
    drawTextWithOptions(getPage(COORDS[kF].page), row.fecha || "", COORDS[kF]);
    drawTextWithOptions(getPage(COORDS[kN].page), row.nombre || "", { ...COORDS[kN], font });
    drawTextWithOptions(getPage(COORDS[kT].page), row.tipo || "", COORDS[kT]);
  });

  // === ANEXO 3 ===
  drawTextWithOptions(getPage(COORDS.anexo3_bodega.page), data.anexo3?.bodega_linea, COORDS.anexo3_bodega);

  // === ANEXO 4 (tabla de bienes) ===
  const filas = data.anexo4 || [];
  for (let i = 0; i < Math.min(filas.length, COORDS.anexo4_filas.length); i++) {
    const f = filas[i];
    const row = COORDS.anexo4_filas[i];
    const page = getPage(row.page);
    drawTextWithOptions(page, String(f.no ?? i + 1), { x: COORDS.anexo4_cols.no,  y: row.y, size: 10, font });
    drawTextWithOptions(page, String(f.cantidad ?? ""), { x: COORDS.anexo4_cols.cant, y: row.y, size: 10, font });
    drawTextWithOptions(page, String(f.descripcion ?? ""), { x: COORDS.anexo4_cols.desc, y: row.y, size: 10, font, maxWidth: 280 });
    drawTextWithOptions(page, String(f.valor ?? ""), { x: COORDS.anexo4_cols.val, y: row.y, size: 10, font });
  }

  // === ANEXO 5 ===
  drawTextWithOptions(getPage(COORDS.anexo5_bodega.page), data.anexo5?.bodega, COORDS.anexo5_bodega);
  drawTextWithOptions(getPage(COORDS.anexo5_inicio.page), data.anexo5?.inicio, COORDS.anexo5_inicio);
  drawTextWithOptions(getPage(COORDS.anexo5_periodo.page), data.anexo5?.periodo, COORDS.anexo5_periodo);

  // === ANEXO 6 ===
  drawTextWithOptions(getPage(COORDS.anexo6_fecha.page), data.anexo6?.fecha, COORDS.anexo6_fecha);

  // === FIRMAS === (opcionalmente podrías estampar nombre debajo)
  drawTextWithOptions(getPage(COORDS.firma_arrendador.page), data.firmas?.arrendador || "", COORDS.firma_arrendador);
  drawTextWithOptions(getPage(COORDS.firma_arrendatario.page), data.firmas?.arrendatario || "", COORDS.firma_arrendatario);

  const outBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, outBytes);
}

/** PDF de GRID para calibración de coordenadas (opcional) */
export async function generarGridCalibracion(templatePath, outPath, step = 20) {
  const bytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);

  pages.forEach((p) => {
    const { width, height } = p.getSize();
    // Ejes X
    for (let x = 0; x < width; x += step) {
      p.drawText(String(x), { x, y: height - 10, size: 6, font, color: rgb(0.4, 0.4, 0.4) });
    }
    // Ejes Y
    for (let y = 0; y < height; y += step) {
      p.drawText(String(y), { x: 2, y, size: 6, font, color: rgb(0.4, 0.4, 0.4) });
    }
  });

  const outBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, outBytes);
}