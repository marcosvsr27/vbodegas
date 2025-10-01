// app/src/utils/generarContratoPDF.ts
import jsPDF from 'jspdf';
import { Cliente, Bodega } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

interface DatosEmpresa {
  nombre: string;
  representante: string;
  rfc: string;
  domicilio: string;
}

const EMPRESA: DatosEmpresa = {
  nombre: "PROYECTO Y ESPACIOS RADA, S. DE R.L. DE C.V.",
  representante: "FRANCISCA RODRÍGUEZ DE ANDA",
  rfc: "PER240816IU4",
  domicilio: "Callejón Nacoa No. 29, Col. Guadalupe Victoria, Puerto Vallarta, Jalisco, CP. 48317"
};

function numeroALetras(numero: number): string {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (numero === 0) return 'CERO';
  if (numero === 100) return 'CIEN';

  let resultado = '';
  
  const miles = Math.floor(numero / 1000);
  if (miles > 0) {
    resultado += (miles === 1 ? 'MIL ' : numeroALetras(miles) + ' MIL ');
    numero = numero % 1000;
  }

  const cen = Math.floor(numero / 100);
  if (cen > 0) {
    resultado += centenas[cen] + ' ';
    numero = numero % 100;
  }

  if (numero >= 10 && numero < 20) {
    resultado += especiales[numero - 10];
  } else {
    const dec = Math.floor(numero / 10);
    const uni = numero % 10;
    if (dec > 0) {
      resultado += decenas[dec];
      if (uni > 0) resultado += ' Y ' + unidades[uni];
    } else if (uni > 0) {
      resultado += unidades[uni];
    }
  }

  return resultado.trim();
}

export function generarContratoPDF(cliente: Cliente, bodega: Bodega): void {
  const doc = new jsPDF('p', 'mm', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let y = 20;

  // Función para agregar texto con salto de línea automático
  const addText = (text: string, x: number, fontSize: number = 10, isBold: boolean = false, maxW?: number) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, maxW || maxWidth);
    doc.text(lines, x, y);
    y += lines.length * (fontSize * 0.5);
  };

  const addPageIfNeeded = (spaceNeeded: number = 20) => {
    if (y + spaceNeeded > 260) {
      doc.addPage();
      y = 20;
    }
  };

  const addSpace = (space: number = 5) => {
    y += space;
  };

  // Título
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATO DE ARRENDAMIENTO', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Encabezado del contrato
  addText(
    `CONTRATO DE ARRENDAMIENTO QUE CELEBRAN POR UNA PARTE ${EMPRESA.nombre}, ` +
    `POR CONDUCTO DE SU APODERADO LEGAL PARA ESTE ACTO, ${EMPRESA.representante}. ` +
    `QUIEN EN LO SUCESIVO SE LE DENOMINARÁ COMO "EL ARRENDADOR", Y POR LA OTRA ` +
    `${cliente.nombre} ${cliente.apellidos || ''} A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ ` +
    `"EL ARRENDATARIO" Y CUANDO SE LES NOMBRE EN CONJUNTO SE LES DENOMINARÁ COMO "LAS PARTES" ` +
    `SUJETÁNDOSE A LAS SIGUIENTES DECLARACIONES Y CLÁUSULAS:`,
    margin, 10
  );

  addSpace(8);

  // DECLARACIONES
  addPageIfNeeded();
  addText('DECLARACIONES', margin, 12, true);
  addSpace(5);

  addText('DECLARA "EL ARRENDADOR" QUE:', margin, 11, true);
  addSpace(3);

  addText(
    `I. Es una sociedad de responsabilidad limitada de capital variable, debidamente constituida ` +
    `de conformidad con las leyes mexicanas, con R.F.C. ${EMPRESA.rfc}.`,
    margin, 10
  );
  addSpace(3);

  addText(
    `II. Administra conjunto mini bodegas o selfstorage, comercialmente conocida como VBODEGAS, ` +
    `ubicada en ${EMPRESA.domicilio}, y cuenta con capacidad legal para rentarlas.`,
    margin, 10
  );
  addSpace(5);

  addPageIfNeeded();
  addText('DECLARA "EL ARRENDATARIO" QUE:', margin, 11, true);
  addSpace(3);

  addText(`I. Nombre completo: ${cliente.nombre} ${cliente.apellidos || ''}`, margin, 10);
  addSpace(2);
  addText(`II. Email: ${cliente.email}`, margin, 10);
  addSpace(2);
  addText(`III. Teléfono: ${cliente.telefono || 'No proporcionado'}`, margin, 10);
  addSpace(2);
  addText(`IV. Régimen Fiscal: ${cliente.regimen_fiscal || 'No especificado'}`, margin, 10);
  addSpace(3);

  addText(
    `V. Es su deseo rentar una bodega con el espacio suficiente para guardar bienes que son de su ` +
    `entera propiedad y declara BAJO PROTESTA DE DECIR VERDAD que su actividad es enteramente lícita.`,
    margin, 10
  );
  addSpace(8);

  // CLÁUSULAS
  addPageIfNeeded();
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CLÁUSULAS', margin, y);
  y += 8;

  // PRIMERA - Identificación de la bodega
  addPageIfNeeded();
  addText(
    `PRIMERA. "EL ARRENDADOR" da en arrendamiento el uso de la bodega ubicada e identificada en el ` +
    `Módulo ${cliente.modulo || bodega.number?.split('-')[0]} No. ${bodega.number} con una superficie ` +
    `aproximada de ${bodega.metros || cliente.metros} metros cuadrados (${bodega.medidas}) que se encuentra ` +
    `dentro del conjunto de bodegas ubicado en ${EMPRESA.domicilio}.`,
    margin, 10
  );
  addSpace(5);

  // SEGUNDA - Vigencia
  addPageIfNeeded();
  const fechaInicio = cliente.fecha_inicio ? dayjs(cliente.fecha_inicio).format('DD [de] MMMM [del] YYYY') : '[FECHA INICIO]';
  const fechaFin = cliente.fecha_expiracion ? dayjs(cliente.fecha_expiracion).format('DD [de] MMMM [del] YYYY') : '[FECHA FIN]';
  
  addText(
    `SEGUNDA. VIGENCIA. Ambas partes convienen en que el plazo del presente contrato es forzoso y ` +
    `tendrá una duración de ${cliente.duracion_meses || 1} meses a partir del día ${fechaInicio} ` +
    `y concluirá el día ${fechaFin}.`,
    margin, 10
  );
  addSpace(5);

  // TERCERA - Prórroga
  addPageIfNeeded();
  addText(
    `TERCERA. PRÓRROGA. EL ARRENDATARIO tendrá la obligación de entregar aviso por escrito al ARRENDADOR ` +
    `sobre la prórroga de su contrato o en su caso la terminación definitiva, lo cual deberá realizarlo ` +
    `30 días antes de que este llegue a su término.`,
    margin, 10
  );
  addSpace(5);

  // CUARTA - Renta
  addPageIfNeeded();
  const pagoMensual = cliente.pago_mensual || bodega.precio || 0;
  const pagoEnLetras = numeroALetras(Math.floor(pagoMensual));
  
  addText(
    `CUARTA. DE LA RENTA. "EL ARRENDATARIO" SE OBLIGA INCONDICIONALMENTE a pagar "AL ARRENDADOR", ` +
    `por concepto de renta mensual de la bodega arrendada, la cantidad de $${pagoMensual.toLocaleString()} ` +
    `(${pagoEnLetras} PESOS 00/100 M.N.), tarifa que ya incluye IVA, en mensualidades anticipadas.`,
    margin, 10
  );
  addSpace(5);

  // QUINTA - Mora
  addPageIfNeeded();
  addText(
    `QUINTA. EN LA MORA. En caso de mora en el pago de las rentas "EL ARRENDATARIO" se obliga a pagar ` +
    `la cantidad de $250.00 (doscientos cincuenta pesos) a partir del 6to día de retraso por concepto ` +
    `de reactivación de su tarjeta de acceso más un interés mensual del 6.5% sobre el saldo insoluto.`,
    margin, 10
  );
  addSpace(3);

  addText('Cuenta bancaria para pagos:', margin, 10, true);
  addText('BBVA Bancomer', margin, 9);
  addText('CLABE Interbancaria: 0123 7500 1249 1823 17', margin, 9);
  addText('No. de Cuenta: 0124918231', margin, 9);
  addSpace(5);

  // SEXTA - Incrementos
  addPageIfNeeded();
  addText(
    `SEXTA. INCREMENTOS AL MONTO DE LA RENTA. Las partes convienen en que la renta será incrementada ` +
    `anualmente, en una cantidad proporcional al incremento del Índice Nacional de Precios al Consumidor ` +
    `o de los Salarios Mínimos, el que resulte mayor.`,
    margin, 10
  );
  addSpace(5);

  // SÉPTIMA - Uso y limitaciones
  addPageIfNeeded();
  addText('SÉPTIMA. DEL USO Y LIMITACIONES. Queda estrictamente prohibido a "EL ARRENDATARIO":', margin, 10, true);
  addSpace(3);
  addText('a. Traspasar, subarrendar o ceder la bodega sin autorización', margin + 5, 9);
  addSpace(2);
  addText('b. Efectuar modificaciones o mejoras sin autorización', margin + 5, 9);
  addSpace(2);
  addText('c. Guardar productos peligrosos, explosivos o inflamables', margin + 5, 9);
  addSpace(2);
  addText('d. Guardar plantas, animales o insectos', margin + 5, 9);
  addSpace(2);
  addText('e. Realizar actos ilegales', margin + 5, 9);
  addSpace(5);

  // Nueva página para firmas
  doc.addPage();
  y = 20;

  const fechaHoy = dayjs().format('DD [de] MMMM [del] YYYY');
  addText(
    `Enterados del alcance legal de su contenido, las partes suscriben este contrato por duplicado ` +
    `en la ciudad de Puerto Vallarta el día ${fechaHoy}.`,
    margin, 10
  );
  
  y += 40;

  // Líneas de firma
  doc.line(margin, y, margin + 70, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('EL ARRENDADOR', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(EMPRESA.nombre, margin, y, { maxWidth: 70 });
  y += 5;
  doc.text(`Rep: ${EMPRESA.representante}`, margin, y, { maxWidth: 70 });

  y = y - 20;
  doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('EL ARRENDATARIO', pageWidth - margin - 70, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`${cliente.nombre} ${cliente.apellidos || ''}`, pageWidth - margin - 70, y, { maxWidth: 70 });

  // Agregar anexos
  agregarAnexos(doc, cliente, bodega);

  // Descargar PDF
  const nombreArchivo = `Contrato_${cliente.nombre.replace(/\s/g, '_')}_${bodega.number}.pdf`;
  doc.save(nombreArchivo);
}

function agregarAnexos(doc: jsPDF, cliente: Cliente, bodega: Bodega): void {
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  // ANEXO 1 - Inventario
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO 1 - INVENTARIO', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let y = 35;
  doc.text(`La Mini Bodega número ${bodega.number} fue entregada vacía y en las siguientes condiciones:`, margin, y);
  y += 10;
  doc.text('• CORTINA METALICA DE INGRESO: Pintada, en perfectas condiciones', margin, y);
  y += 7;
  doc.text('• PAREDES DE LAMINA: En perfectas condiciones y sin abolladuras', margin, y);
  y += 7;
  doc.text('• LIMPIEZA: Limpia', margin, y);
  y += 7;
  doc.text('• CHAPA: Funcionando', margin, y);

  // ANEXO 2 - Autorización de entrada
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO 2 - AUTORIZACIÓN DE ENTRADA', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y = 35;
  doc.text('Personas autorizadas para acceder a la bodega:', margin, y);
  y += 15;
  
  // Tabla simple
  doc.rect(margin, y, pageWidth - 2 * margin, 40);
  doc.line(margin, y + 8, pageWidth - margin, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha', margin + 5, y + 6);
  doc.text('Nombre', margin + 40, y + 6);
  doc.text('Autorización', margin + 100, y + 6);

  // ANEXO 3 - Datos personales
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO 3 - TRATAMIENTO DE DATOS PERSONALES', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y = 35;
  const textoDatos = doc.splitTextToSize(
    `El suscrito ${cliente.nombre} ${cliente.apellidos || ''}, de forma voluntaria proporciono a ` +
    `${EMPRESA.nombre}, mis datos personales, los que tienen como finalidad la elaboración del ` +
    `Contrato de Arrendamiento y cumplir con las obligaciones derivadas del alquiler.`,
    pageWidth - 2 * margin
  );
  doc.text(textoDatos, margin, y);

  // ANEXO 4 - Inventario de bienes
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO 4 - INVENTARIO DE BIENES DEPOSITADOS', pageWidth / 2, 20, { align: 'center' });
  
  y = 35;
  doc.rect(margin, y, pageWidth - 2 * margin, 60);
  doc.line(margin, y + 10, pageWidth - margin, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.text('No.', margin + 5, y + 8);
  doc.text('Cantidad', margin + 20, y + 8);
  doc.text('Descripción', margin + 50, y + 8);
  doc.text('Valor Estimado', margin + 120, y + 8);

  // ANEXO 5 - Prenda
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO 5 - CONTRATO DE PRENDA SIN TRANSMISIÓN', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y = 35;
  const textoPrenda = doc.splitTextToSize(
    `Para garantizar el pago de las obligaciones, EL ARRENDATARIO constituye garantía prendaria ` +
    `sin transmisión de posesión sobre todos los bienes muebles contenidos en la bodega ${bodega.number}.`,
    pageWidth - 2 * margin
  );
  doc.text(textoPrenda, margin, y);

  // ANEXO 6 - Reglamento
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO 6 - REGLAMENTO INTERNO', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(11);
  y = 35;
  doc.text('1. HORARIOS Y ACCESO', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y += 7;
  doc.text('Lunes a viernes: 9:00-18:00 hrs, Sábados: 9:00-13:00 hrs', margin, y);
  
  y += 15;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. USO Y CUIDADO', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y += 7;
  doc.text('Se prohíbe dejar basura o realizar modificaciones no autorizadas', margin, y);
  
  y += 15;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. SEGURIDAD', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y += 7;
  doc.text('Respetar señalamientos y normas de seguridad en todo momento', margin, y);
}

// Función auxiliar para previsualizar antes de descargar
export function previsualizarContrato(cliente: Cliente, bodega: Bodega): void {
  // Esta función genera el PDF pero lo abre en nueva ventana en lugar de descargarlo
  const doc = new jsPDF('p', 'mm', 'letter');
  // ... (mismo código que generarContratoPDF pero al final)
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}