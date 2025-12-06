import { state, createNotifier, createRouter, refreshStorage, formatDate, formatCurrency } from './utils.js';
import { initMovimientos, renderMovimientos, obtenerMovimientosDelMes } from './movimientos.js';
import { initCuentas } from './cuentas.js';
import { initPrestamos } from './prestamos.js';
import { initPresupuesto } from './presupuesto.js';
import { initDashboard, refreshDashboard } from './dashboard.js';

const notify = createNotifier();

function setupRouter() {
  const secciones = {
    dashboard: document.getElementById('seccion-dashboard'),
    registrar: document.getElementById('seccion-registrar'),
    movimientos: document.getElementById('seccion-movimientos'),
    cuentas: document.getElementById('seccion-cuentas'),
    prestamos: document.getElementById('seccion-prestamos'),
    calendario: document.getElementById('seccion-calendario'),
    presupuesto: document.getElementById('seccion-presupuesto'),
    exportar: document.getElementById('seccion-exportar')
  };
  const botones = {
    dashboard: document.getElementById('btnDashboard'),
    registrar: document.getElementById('btnRegistrar'),
    movimientos: document.getElementById('btnMovimientos'),
    cuentas: document.getElementById('btnCuentas'),
    prestamos: document.getElementById('btnPrestamos'),
    calendario: document.getElementById('btnCalendario'),
    presupuesto: document.getElementById('btnPresupuesto'),
    exportar: document.getElementById('btnExportar')
  };
  const change = createRouter(secciones, botones);
  Object.entries(botones).forEach(([key, btn]) => {
    btn.addEventListener('click', () => change(key));
  });
}

function onDataChange() {
  refreshStorage();
  renderMovimientos();
  refreshDashboard();
}

function initApp() {
  setupRouter();
  initCuentas({ notify });
  initPrestamos({ notify });
  initMovimientos({ notify, onChange: onDataChange });
  initPresupuesto({ notify });
  initDashboard();
  setupExport();
}

function movimientosMesActual() {
  return obtenerMovimientosDelMes().map((m) => ({ ...m }));
}

function descargarArchivo(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarCSV() {
  const movimientos = movimientosMesActual();
  const header = ['Fecha', 'Tipo', 'Monto', 'Categoría', 'Cuenta', '50/30/20', 'Nota'];
  const rows = movimientos.map((m) => [
    formatDate(m.fecha),
    m.tipo,
    m.monto,
    m.categoria || '',
    m.cuentaId || '',
    m.tipo503020,
    (m.nota || '').replace(/\n/g, ' ')
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  descargarArchivo('movimientos-mes.csv', csv, 'text/csv');
}

function exportarJSON() {
  const movimientos = movimientosMesActual();
  descargarArchivo('movimientos-mes.json', JSON.stringify(movimientos, null, 2), 'application/json');
}

function construirLineaPdf(texto) {
  return texto.replace(/[()\\]/g, '\\$&');
}

function crearPdfBasico(titulo, lineas) {
  const header = `%PDF-1.4\n`;
  const bodyText = [titulo, '', ...lineas].map((l) => `${construirLineaPdf(l)} Tj\n0 -16 Td`).join('\n');
  const stream = `BT /F1 12 Tf 50 780 Td\n${bodyText}\nET`;
  const contenido = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;

  const objetos = [];
  objetos.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj');
  objetos.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj');
  objetos.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj'
  );
  objetos.push(`4 0 obj${contenido}endobj`);
  objetos.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj');

  let offset = header.length;
  const xref = ['xref', `0 ${objetos.length + 1}`, '0000000000 65535 f '];
  const secciones = [header];
  objetos.forEach((obj, idx) => {
    xref.push(String(offset).padStart(10, '0') + ' 00000 n ');
    secciones.push(obj + '\n');
    offset += obj.length + 1;
  });
  const startxref = offset;
  const trailer = `trailer<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;
  const pdfString = secciones.join('') + xref.join('\n') + '\n' + trailer;
  return new Blob([pdfString], { type: 'application/pdf' });
}

let ultimoArchivo = null;

function registrarUltimoArchivo(nombre, blob) {
  ultimoArchivo = { nombre, blob };
  const shareBtn = document.getElementById('btn-share-whatsapp');
  const hint = document.getElementById('share-hint');
  if (shareBtn) {
    shareBtn.disabled = false;
    if (hint) hint.textContent = `${nombre} listo para compartir.`;
  }
}

function exportarPDFMes() {
  const movimientos = movimientosMesActual();
  const lineas = movimientos.map(
    (m) => `${formatDate(m.fecha)} · ${m.categoria || ''} · ${m.tipo} · ${formatCurrency(m.monto)} · ${m.nota || ''}`
  );
  const blob = crearPdfBasico('Movimientos del mes', lineas);
  descargarArchivo('movimientos-mes.pdf', blob, 'application/pdf');
  registrarUltimoArchivo('movimientos-mes.pdf', blob);
}

function exportarPDFHistorial() {
  const select = document.getElementById('historial-meses');
  const mesSeleccionado = select?.value;
  const lista = mesSeleccionado ? state.historial[mesSeleccionado] || [] : [];
  const lineas = lista.map((m) => `${formatDate(m.fecha)} · ${m.categoria || ''} · ${m.tipo} · ${formatCurrency(m.monto)} · ${m.nota || ''}`);
  const blob = crearPdfBasico(`Historial ${mesSeleccionado || ''}`.trim(), lineas);
  descargarArchivo(`historial-${mesSeleccionado || 'mes'}.pdf`, blob, 'application/pdf');
  registrarUltimoArchivo(`historial-${mesSeleccionado || 'mes'}.pdf`, blob);
}

function exportarPDFDashboard() {
  const movimientos = movimientosMesActual();
  const ingresos = movimientos.filter((m) => m.tipo === 'Ingreso').reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
  const gastos = movimientos.filter((m) => m.tipo === 'Gasto').reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
  const balance = ingresos - gastos;
  const lineas = [
    `Ingresos: ${formatCurrency(ingresos)}`,
    `Gastos: ${formatCurrency(gastos)}`,
    `Balance: ${formatCurrency(balance)}`,
    '',
    'KPIs rápidos:',
    `Movimientos del mes: ${movimientos.length}`
  ];
  const blob = crearPdfBasico('Resumen dashboard', lineas);
  descargarArchivo('dashboard-resumen.pdf', blob, 'application/pdf');
  registrarUltimoArchivo('dashboard-resumen.pdf', blob);
}

function exportarXLSX() {
  const movimientos = movimientosMesActual();
  const header = ['Fecha', 'Categoría', 'Tipo', 'Nota', 'Monto'];
  const rows = movimientos.map((m) => [formatDate(m.fecha), m.categoria || '', m.tipo, m.nota || '', Number(m.monto) || 0]);
  const totalesPorCategoria = movimientos.reduce((acc, m) => {
    const key = m.categoria || 'Sin categoría';
    acc[key] = (acc[key] || 0) + (Number(m.monto) || 0);
    return acc;
  }, {});
  const totales = Object.entries(totalesPorCategoria).map(([cat, total]) => [cat, '', '', 'Total', total]);
  const contenido = [header, ...rows, ['', '', '', '', ''], ['Totales por categoría', '', '', '', ''], ...totales]
    .map((r) => r.join(','))
    .join('\n');
  const blob = new Blob([contenido], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  descargarArchivo('finanzas_mes.xlsx', blob, blob.type);
  registrarUltimoArchivo('finanzas_mes.xlsx', blob);
}

async function compartirWhatsApp() {
  const shareBtn = document.getElementById('btn-share-whatsapp');
  if (!ultimoArchivo || !shareBtn) return;
  const files = [new File([ultimoArchivo.blob], ultimoArchivo.nombre, { type: ultimoArchivo.blob.type })];
  if (navigator.share && navigator.canShare?.({ files })) {
    await navigator.share({
      title: 'Finanzas del mes',
      text: 'Resumen generado desde Finanzas del Hogar',
      files
    });
    return;
  }
  descargarArchivo(ultimoArchivo.nombre, ultimoArchivo.blob, ultimoArchivo.blob.type);
  const hint = document.getElementById('share-hint');
  if (hint) hint.textContent = 'Descarga completada. Comparte manualmente por WhatsApp.';
}

function setupExport() {
  const btnCSV = document.getElementById('btn-exportar');
  const btnJSON = document.getElementById('btn-exportar-json');
  const btnPDFMes = document.getElementById('btn-exportar-pdf-mes');
  const btnPDFHist = document.getElementById('btn-exportar-pdf-historial');
  const btnPDFDash = document.getElementById('btn-exportar-pdf-dashboard');
  const btnXLSX = document.getElementById('btn-exportar-xlsx');
  const btnShare = document.getElementById('btn-share-whatsapp');

  btnCSV?.addEventListener('click', exportarCSV);
  btnJSON?.addEventListener('click', exportarJSON);
  btnPDFMes?.addEventListener('click', exportarPDFMes);
  btnPDFHist?.addEventListener('click', exportarPDFHistorial);
  btnPDFDash?.addEventListener('click', exportarPDFDashboard);
  btnXLSX?.addEventListener('click', exportarXLSX);
  btnShare?.addEventListener('click', compartirWhatsApp);
}

document.addEventListener('DOMContentLoaded', initApp);
