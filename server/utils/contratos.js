// server/utils/contratos.js
import fs from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * COORDENADAS CALIBRADAS PARA EL CONTRATO
 * Estas coordenadas están basadas en el PDF original
 * IMPORTANTE: Ajustar según el template real usando el endpoint /api/admin/contratos/coords-grid
 */
export const COORDS = {
  // === PORTADA / CUERPO PRINCIPAL (Página 1) ===
  arrendatario_nombre:     { page: 0, x: 150, y: 580, size: 10 },
  arrendatario_rep:        { page: 0, x: 150, y: 565, size: 10 },
  arrendatario_constit:    { page: 0, x: 72,  y: 550, size: 9, maxWidth: 450 },
  arrendatario_domicilio:  { page: 0, x: 72,  y: 520, size: 9, maxWidth: 450 },
  arrendatario_contacto:   { page: 0, x: 72,  y: 490, size: 9, maxWidth: 450 },
  bienes_declaracion:      { page: 0, x: 72,  y: 460, size: 9, maxWidth: 450 },

  // === CLÁUSULAS (Página 2) ===
  bodega_ident:            { page: 1, x: 200, y: 680, size: 10 },
  bodega_superficie:       { page: 1, x: 200, y: 665, size: 10 },
  vigencia_inicio:         { page: 1, x: 200, y: 560, size: 10 },
  vigencia_fin:            { page: 1, x: 350, y: 560, size: 10 },

  // === PAGOS (Página 3) ===
  renta_mensual:           { page: 2, x: 200, y: 650, size: 10, bold: true },
  deposito_monto:          { page: 3, x: 200, y: 580, size: 10 },
  banco_nombre:            { page: 2, x: 150, y: 400, size: 9 },
  banco_cuenta:            { page: 2, x: 150, y: 385, size: 9 },
  banco_clabe:             { page: 2, x: 150, y: 370, size: 9 },

  // === FIRMAS (Página 6) ===
  firma_fecha:             { page: 5, x: 400, y: 200, size: 10 },
  firma_arrendador:        { page: 5, x: 150, y: 150, size: 9 },
  firma_arrendatario:      { page: 5, x: 350, y: 150, size: 9 },

  // === ANEXO 1 (Página 7) - INVENTARIO ENTREGA ===
  anexo1_bodega:           { page: 6, x: 200, y: 650, size: 10 },
  anexo1_superficie:       { page: 6, x: 200, y: 635, size: 10 },
  anexo1_fecha_hora:       { page: 6, x: 200, y: 280, size: 9 },

  // === ANEXO 2 (Página 8) - AUTORIZACIONES ===
  anexo2_fecha1:           { page: 7, x: 90,  y: 450, size: 9 },
  anexo2_nombre1:          { page: 7, x: 180, y: 450, size: 9, maxWidth: 280 },
  anexo2_tipo1:            { page: 7, x: 470, y: 450, size: 9 },
  
  anexo2_fecha2:           { page: 7, x: 90,  y: 430, size: 9 },
  anexo2_nombre2:          { page: 7, x: 180, y: 430, size: 9, maxWidth: 280 },
  anexo2_tipo2:            { page: 7, x: 470, y: 430, size: 9 },
  
  anexo2_fecha3:           { page: 7, x: 90,  y: 410, size: 9 },
  anexo2_nombre3:          { page: 7, x: 180, y: 410, size: 9, maxWidth: 280 },
  anexo2_tipo3:            { page: 7, x: 470, y: 410, size: 9 },

  // === ANEXO 3 (Página 9) - DATOS PERSONALES ===
  anexo3_bodega:           { page: 8, x: 200, y: 600, size: 10 },

  // === ANEXO 4 (Página 10) - INVENTARIO BIENES ===
  anexo4_filas: [
    { page: 9, y: 480 },
    { page: 9, y: 460 },
    { page: 9, y: 440 },
    { page: 9, y: 420 },
    { page: 9, y: 400 },
    { page: 9, y: 380 },
    { page: 9, y: 360 },
    { page: 9, y: 340 },
  ],
  anexo4_cols: { 
    no: 90, 
    cant: 140, 
    desc: 200, 
    val: 480 
  },

  // === ANEXO 5 (Página 11) - PRENDA ===
  anexo5_bodega:           { page: 10, x: 200, y: 600, size: 10 },
  anexo5_inicio:           { page: 10, x: 200, y: 580, size: 10 },
  anexo5_periodo:          { page: 10, x: 200, y: 560, size: 10 },

  // === ANEXO 6 (Página 12) - REGLAMENTO ===
  anexo6_fecha:            { page: 11, x: 200, y: 680, size: 10 },
};

/**
 * Dibuja texto con opciones avanzadas
 */
function drawTextWithOptions(page, text, config) {
  const { x, y, size = 10, font, color = rgb(0, 0, 0), align = "left", maxWidth, bold = false } = config;
  
  if (!text) return;
  
  const textStr = String(text);
  let drawX = x;
  const textWidth = font.widthOfTextAtSize(textStr, size);
  
  // Alineación
  if (align === "center") drawX = x - textWidth / 2;
  if (align === "right") drawX = x - textWidth;

  // Manejo de texto largo
  if (maxWidth && textWidth > maxWidth) {
    const words = textStr.split(" ");
    let line = "";
    let yPos = y;
    
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      
      if (testWidth > maxWidth && line) {
        page.drawText(line, { x, y: yPos, size, font, color });
        yPos -= size + 3;
        line = word;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      page.drawText(line, { x, y: yPos, size, font, color });
    }
    return;
  }

  page.drawText(textStr, { x: drawX, y, size, font, color });
}

/**
 * Genera el contrato PDF completo
 */
export async function generarContratoPDF(data, templatePath, outPath) {
  try {
    // Cargar el PDF template
    const bytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();
    
    // Cargar fuentes
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const getPage = (i) => pages[i];

    // ============ CUERPO PRINCIPAL ============
    
    // Datos del Arrendatario
    if (data.arrendatario) {
      drawTextWithOptions(getPage(0), data.arrendatario.nombre, { ...COORDS.arrendatario_nombre, font: fontBold });
      drawTextWithOptions(getPage(0), data.arrendatario.representante, { ...COORDS.arrendatario_rep, font });
      drawTextWithOptions(getPage(0), data.arrendatario.constitucion, { ...COORDS.arrendatario_constit, font });
      drawTextWithOptions(getPage(0), data.arrendatario.domicilio, { ...COORDS.arrendatario_domicilio, font });
      drawTextWithOptions(getPage(0), data.arrendatario.contacto, { ...COORDS.arrendatario_contacto, font });
      drawTextWithOptions(getPage(0), data.arrendatario.bienes, { ...COORDS.bienes_declaracion, font });
    }

    // Bodega
    if (data.bodega) {
      drawTextWithOptions(getPage(1), data.bodega.ident, { ...COORDS.bodega_ident, font: fontBold });
      drawTextWithOptions(getPage(1), data.bodega.superficie, { ...COORDS.bodega_superficie, font });
    }

    // Vigencia
    if (data.vigencia) {
      drawTextWithOptions(getPage(1), data.vigencia.inicio, { ...COORDS.vigencia_inicio, font: fontBold });
      drawTextWithOptions(getPage(1), data.vigencia.fin, { ...COORDS.vigencia_fin, font: fontBold });
    }

    // Pagos
    if (data.pagos) {
      drawTextWithOptions(getPage(2), data.pagos.renta_mensual, { ...COORDS.renta_mensual, font: fontBold });
      drawTextWithOptions(getPage(3), data.pagos.deposito, { ...COORDS.deposito_monto, font: fontBold });
      drawTextWithOptions(getPage(2), data.pagos.banco, { ...COORDS.banco_nombre, font });
      drawTextWithOptions(getPage(2), data.pagos.cuenta, { ...COORDS.banco_cuenta, font });
      drawTextWithOptions(getPage(2), data.pagos.clabe, { ...COORDS.banco_clabe, font });
    }

    // ============ ANEXO 1 - INVENTARIO ENTREGA ============
    if (data.anexo1) {
      drawTextWithOptions(getPage(6), data.anexo1.bodega_linea, { ...COORDS.anexo1_bodega, font: fontBold });
      drawTextWithOptions(getPage(6), data.anexo1.superficie_linea, { ...COORDS.anexo1_superficie, font });
      drawTextWithOptions(getPage(6), data.anexo1.fecha_hora, { ...COORDS.anexo1_fecha_hora, font });
    }

    // ============ ANEXO 2 - AUTORIZACIONES ============
    if (data.anexo2 && Array.isArray(data.anexo2)) {
      const coordsKeys = [
        ['anexo2_fecha1', 'anexo2_nombre1', 'anexo2_tipo1'],
        ['anexo2_fecha2', 'anexo2_nombre2', 'anexo2_tipo2'],
        ['anexo2_fecha3', 'anexo2_nombre3', 'anexo2_tipo3'],
      ];
      
      data.anexo2.slice(0, 3).forEach((row, i) => {
        const [kF, kN, kT] = coordsKeys[i];
        if (row.fecha) drawTextWithOptions(getPage(7), row.fecha, { ...COORDS[kF], font });
        if (row.nombre) drawTextWithOptions(getPage(7), row.nombre, { ...COORDS[kN], font });
        if (row.tipo) drawTextWithOptions(getPage(7), row.tipo, { ...COORDS[kT], font });
      });
    }

    // ============ ANEXO 3 - DATOS PERSONALES ============
    if (data.anexo3) {
      drawTextWithOptions(getPage(8), data.anexo3.bodega_linea, { ...COORDS.anexo3_bodega, font: fontBold });
    }

    // ============ ANEXO 4 - INVENTARIO BIENES ============
    if (data.anexo4 && Array.isArray(data.anexo4)) {
      const maxRows = Math.min(data.anexo4.length, COORDS.anexo4_filas.length);
      
      for (let i = 0; i < maxRows; i++) {
        const item = data.anexo4[i];
        const row = COORDS.anexo4_filas[i];
        const page = getPage(row.page);
        
        drawTextWithOptions(page, item.no || (i + 1), { x: COORDS.anexo4_cols.no, y: row.y, size: 9, font });
        drawTextWithOptions(page, item.cantidad || "", { x: COORDS.anexo4_cols.cant, y: row.y, size: 9, font });
        drawTextWithOptions(page, item.descripcion || "", { x: COORDS.anexo4_cols.desc, y: row.y, size: 9, font, maxWidth: 260 });
        drawTextWithOptions(page, item.valor || "", { x: COORDS.anexo4_cols.val, y: row.y, size: 9, font });
      }
    }

    // ============ ANEXO 5 - PRENDA ============
    if (data.anexo5) {
      drawTextWithOptions(getPage(10), data.anexo5.bodega, { ...COORDS.anexo5_bodega, font: fontBold });
      drawTextWithOptions(getPage(10), data.anexo5.inicio, { ...COORDS.anexo5_inicio, font });
      drawTextWithOptions(getPage(10), data.anexo5.periodo, { ...COORDS.anexo5_periodo, font });
    }

    // ============ ANEXO 6 - REGLAMENTO ============
    if (data.anexo6) {
      drawTextWithOptions(getPage(11), data.anexo6.fecha, { ...COORDS.anexo6_fecha, font });
    }

    // ============ FIRMAS ============
    if (data.firmas) {
      drawTextWithOptions(getPage(5), data.vigencia?.inicio || "", { ...COORDS.firma_fecha, font });
      drawTextWithOptions(getPage(5), data.firmas.arrendador, { ...COORDS.firma_arrendador, font });
      drawTextWithOptions(getPage(5), data.firmas.arrendatario, { ...COORDS.firma_arrendatario, font });
    }

    // Guardar el PDF generado
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outPath, pdfBytes);
    
    console.log(`✅ Contrato generado: ${outPath}`);
    return outPath;
    
  } catch (error) {
    console.error("❌ Error generando contrato PDF:", error);
    throw error;
  }
}

/**
 * Genera un PDF con grilla de coordenadas para calibración
 */
export async function generarGridCalibracion(templatePath, outPath, step = 20) {
  const bytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);

  pages.forEach((p, pageIndex) => {
    const { width, height } = p.getSize();
    
    // Líneas verticales y números X
    for (let x = 0; x < width; x += step) {
      p.drawText(String(x), { 
        x, 
        y: height - 15, 
        size: 6, 
        font, 
        color: rgb(0.7, 0, 0) 
      });
    }
    
    // Líneas horizontales y números Y
    for (let y = 0; y < height; y += step) {
      p.drawText(String(y), { 
        x: 5, 
        y, 
        size: 6, 
        font, 
        color: rgb(0, 0, 0.7) 
      });
    }
    
    // Número de página
    p.drawText(`Página ${pageIndex + 1}`, {
      x: width / 2 - 30,
      y: height - 30,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });
  });

  const outBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, outBytes);
  console.log(`✅ Grid de calibración generado: ${outPath}`);
}
