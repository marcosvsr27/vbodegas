// server/utils/numeroALetras.js
// Convierte números a letras en español para contratos

const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function numeroMenorMil(num) {
  if (num === 0) return '';
  if (num === 100) return 'CIEN';
  
  const centena = Math.floor(num / 100);
  const resto = num % 100;
  const decena = Math.floor(resto / 10);
  const unidad = resto % 10;
  
  let resultado = '';
  
  if (centena > 0) {
    resultado += centenas[centena];
  }
  
  if (resto >= 10 && resto < 20) {
    resultado += (resultado ? ' ' : '') + especiales[resto - 10];
  } else {
    if (decena === 2 && unidad > 0) {
      resultado += (resultado ? ' ' : '') + 'VEINTI' + unidades[unidad];
    } else {
      if (decena > 0) {
        resultado += (resultado ? ' ' : '') + decenas[decena];
      }
      if (unidad > 0) {
        resultado += (resultado ? (decena > 2 ? ' Y ' : ' ') : '') + unidades[unidad];
      }
    }
  }
  
  return resultado;
}

export function numeroALetras(numero) {
  if (numero === 0) return 'CERO';
  if (numero === 1) return 'UN';
  
  const partes = numero.toString().split('.');
  const entero = parseInt(partes[0]);
  const centavos = partes[1] ? partes[1].padEnd(2, '0').substring(0, 2) : '00';
  
  let resultado = '';
  
  if (entero >= 1000000) {
    const millones = Math.floor(entero / 1000000);
    if (millones === 1) {
      resultado += 'UN MILLÓN';
    } else {
      resultado += numeroMenorMil(millones) + ' MILLONES';
    }
    const restoMillones = entero % 1000000;
    if (restoMillones > 0) {
      resultado += ' ' + numeroALetras(restoMillones).split(' PESOS')[0];
    }
  } else if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    if (miles === 1) {
      resultado += 'MIL';
    } else {
      resultado += numeroMenorMil(miles) + ' MIL';
    }
    const restoMiles = entero % 1000;
    if (restoMiles > 0) {
      resultado += ' ' + numeroMenorMil(restoMiles);
    }
  } else {
    resultado = numeroMenorMil(entero);
  }
  
  return resultado.trim();
}

export function formatearDineroContrato(monto) {
  const numero = parseFloat(monto);
  if (isNaN(numero)) return '';
  
  const numeroFormateado = numero.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  const partes = numero.toFixed(2).split('.');
  const entero = parseInt(partes[0]);
  const centavos = partes[1] || '00';
  
  const letras = numeroALetras(entero);
  
  return `$${numeroFormateado} (${letras} PESOS ${centavos}/100 M.N.)`;
}