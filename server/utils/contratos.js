// server/utils/contratos.js
import fs from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * ⚠️ IMPORTANTE: Coordenadas del PDF
 * - Origen (0,0) está en ESQUINA INFERIOR IZQUIERDA
 * - X aumenta hacia la derecha
 * - Y aumenta hacia ARRIBA
 * 
 * Para encontrar coordenadas:
 * 1. Llama /api/admin/contratos/calibrar
 * 2. Descarga el PDF con la grilla
 * 3. Identifica las coordenadas donde quieres el texto
 */

export const COORDS = {
  // === PORTADA (Página 1) ===
  arrendatario_nombre:     { page: 0, x: 150, y: 580, size: 10 },
  arrendatario_rep:        { page: 0, x: 150, y: 565, size: 10 },
  
  // === CLÁUSULAS (Página 2) ===
  bodega_ident:            { page: 1, x: 200, y: 680, size: 10 },
  bodega_superficie:       { page: 1, x: 200, y: 665, size: 10 },
  vigencia_inicio:         { page: 1, x: 200, y: 560, size: 10 },
  vigencia_fin:            { page: 1, x: 350, y: 560, size: 10 },

  // === PAGOS (Página 3) ===
  renta_mensual:           { page: 2, x: 200, y: 650, size: 10, bold: true },
  deposito_monto:          { page: 2, x: 200, y: 580, size: 10 },
  banco_nombre:            { page: 2, x: 150, y: 400, size: 9 },
  banco_cuenta:            { page: 2, x: 150, y: 385, size: 9 },
  banco_clabe:             { page: 2, x: 150, y: 370, size: 9 },

  // === FIRMAS (Página 6) ===
  firma_fecha:             { page: 5, x: 400, y: 200, size: 10 },
  firma_arrendador:        { page: 5, x: 150, y: 150, size: 9 },
  firma_arrendatario:      { page: 5, x: 350, y: 150, size: 9 },

  // === ANEXO 1 (Página 7) ===
  anexo1_bodega:           { page: 6, x: 200, y: 650, size: 10 },
  anexo1_superficie:       { page: 6, x: 200, y: 635, size: 10 },
  anexo1_fecha_hora:       { page: 6, x: 200, y: 280, size: 9 },

  // === ANEXO 2 (Página 8) ===
  anexo2_fecha1:           { page: 7, x: 90,  y: 450, size: 9 },
  anexo2_nombre1:          { page: 7, x: 180, y: 450, size: 9, maxWidth: 280 },
  
  // === ANEXO 3 (Página 9) ===
  anexo3_bodega:           { page: 8, x: 200, y: 600, size: 10 },

  // === ANEXO 4 (Página 10) ===
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

  // === ANEXO 5 (Página 11) ===
  anexo5_bodega:           { page: 10, x: 200, y: 600, size: 10 },
  anexo5_inicio:           { page: 10, x: 200, y: 580, size: 10 },
  anexo5_periodo:          { page: 10, x: 200, y: 560, size: 10 },

  // === ANEXO 6 (Página 12) ===
  anexo6_fecha:            { page: 11, x: 200, y: 680, size: 10 },
};

/**
 * Dibuja un rectángulo blanco para "limpiar" el área antes de escribir
 */
function limpiarArea(page, x, y, width, height) {
  page.drawRectangle({
    x: x - 2,
    y: y - 2,
    width: width + 4,
    height: height + 4,
    color: rgb(1, 1, 1), // Blanco
    borderWidth: 0,
  });
}

/**
 * Dibuja texto con opciones avanzadas y limpieza previa
 */
function drawTextWithOptions(page, text, config) {
  const { 
    x, 
    y, 
    size = 10, 
    font, 
    color = rgb(0, 0, 0), 
    align = "left", 
    maxWidth, 
    limpiar = false // Nueva opción
  } = config;
  
  if (!text) return;
  
  const textStr = String(text);
  let drawX = x;
  const textWidth = font.widthOfTextAtSize(textStr, size);
  
  // Limpiar área si está habilitado
  if (limpiar) {
    const cleanWidth = maxWidth || textWidth;
    limpiarArea(page, x, y, cleanWidth, size + 4);
  }
  
  // Alineación
  if (align === "center") drawX = x - textWidth / 2;
  if (align === "right") drawX = x - textWidth;

  // Manejo de texto largo con word wrap
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
    const bytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();
    
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const getPage = (i) => pages[i];

    // ============ CUERPO PRINCIPAL ============
    
    // Datos del Arrendatario
    if (data.arrendatario) {
      drawTextWithOptions(getPage(0), data.arrendatario.nombre, { 
        ...COORDS.arrendatario_nombre, 
        font: fontBold,
        limpiar: true 
      });
      drawTextWithOptions(getPage(0), data.arrendatario.representante, { 
        ...COORDS.arrendatario_rep, 
        font,
        limpiar: true 
      });
    }

    // Bodega
    if (data.bodega) {
      drawTextWithOptions(getPage(1), data.bodega.ident, { 
        ...COORDS.bodega_ident, 
        font: fontBold,
        limpiar: true 
      });
      drawTextWithOptions(getPage(1), data.bodega.superficie, { 
        ...COORDS.bodega_superficie, 
        font,
        limpiar: true 
      });
    }

    // Vigencia
    if (data.vigencia) {
      drawTextWithOptions(getPage(1), data.vigencia.inicio, { 
        ...COORDS.vigencia_inicio, 
        font: fontBold,
        limpiar: true 
      });
      drawTextWithOptions(getPage(1), data.vigencia.fin, { 
        ...COORDS.vigencia_fin, 
        font: fontBold,
        limpiar: true 
      });
    }

    // Pagos
    if (data.pagos) {
      drawTextWithOptions(getPage(2), data.pagos.renta_mensual, { 
        ...COORDS.renta_mensual, 
        font: fontBold,
        limpiar: true 
      });
      drawTextWithOptions(getPage(2), data.pagos.deposito, { 
        ...COORDS.deposito_monto, 
        font: fontBold,
        limpiar: true 
      });
    }

    // ============ ANEXOS ============
    
    // ANEXO 1
    if (data.anexo1) {
      drawTextWithOptions(getPage(6), data.anexo1.bodega_linea, { 
        ...COORDS.anexo1_bodega, 
        font: fontBold,
        limpiar: true 
      });
      drawTextWithOptions(getPage(6), data.anexo1.fecha_hora, { 
        ...COORDS.anexo1_fecha_hora, 
        font,
        limpiar: true 
      });
    }

    // ANEXO 4 - Inventario
    if (data.anexo4 && Array.isArray(data.anexo4)) {
      const maxRows = Math.min(data.anexo4.length, COORDS.anexo4_filas.length);
      
      for (let i = 0; i < maxRows; i++) {
        const item = data.anexo4[i];
        const row = COORDS.anexo4_filas[i];
        const page = getPage(row.page);
        
        drawTextWithOptions(page, item.no || (i + 1), { 
          x: COORDS.anexo4_cols.no, 
          y: row.y, 
          size: 9, 
          font 
        });
        drawTextWithOptions(page, item.cantidad || "", { 
          x: COORDS.anexo4_cols.cant, 
          y: row.y, 
          size: 9, 
          font 
        });
        drawTextWithOptions(page, item.descripcion || "", { 
          x: COORDS.anexo4_cols.desc, 
          y: row.y, 
          size: 9, 
          font, 
          maxWidth: 260 
        });
        drawTextWithOptions(page, item.valor || "", { 
          x: COORDS.anexo4_cols.val, 
          y: row.y, 
          size: 9, 
          font 
        });
      }
    }

    // ============ FIRMAS ============
    if (data.firmas) {
      drawTextWithOptions(getPage(5), data.vigencia?.inicio || "", { 
        ...COORDS.firma_fecha, 
        font,
        limpiar: true 
      });
      drawTextWithOptions(getPage(5), data.firmas.arrendador, { 
        ...COORDS.firma_arrendador, 
        font,
        limpiar: true 
      });
      drawTextWithOptions(getPage(5), data.firmas.arrendatario, { 
        ...COORDS.firma_arrendatario, 
        font,
        limpiar: true 
      });
    }

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
export async function generarGridCalibracion(templatePath, outPath, step = 50) {
  const bytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);

  pages.forEach((page, pageIndex) => {
    const { width, height } = page.getSize();
    
    // Líneas verticales y números X
    for (let x = 0; x < width; x += step) {
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: height },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
      
      page.drawText(String(Math.round(x)), { 
        x: x + 2, 
        y: height - 15, 
        size: 8, 
        font, 
        color: rgb(1, 0, 0) 
      });
    }
    
    // Líneas horizontales y números Y
    for (let y = 0; y < height; y += step) {
      page.drawLine({
        start: { x: 0, y },
        end: { x: width, y },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
      
      page.drawText(String(Math.round(y)), { 
        x: 5, 
        y: y + 2, 
        size: 8, 
        font, 
        color: rgb(0, 0, 1) 
      });
    }
    
    // Número de página
    page.drawText(`Página ${pageIndex + 1}`, {
      x: width / 2 - 40,
      y: height - 30,
      size: 14,
      font,
      color: rgb(0, 0, 0)
    });
    
    // Leyenda
    page.drawText(`ROJO = Coordenada X | AZUL = Coordenada Y | Grid cada ${step}px`, {
      x: 20,
      y: 20,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
  });

  const outBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, outBytes);
  console.log(`✅ Grid de calibración generado: ${outPath}`);
}