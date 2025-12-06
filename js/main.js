import { state, createNotifier, createRouter, refreshStorage, formatDate } from './utils.js';
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

function setupExport() {
  const btnCSV = document.getElementById('btn-exportar');
  const btnJSON = document.getElementById('btn-exportar-json');
  btnCSV?.addEventListener('click', exportarCSV);
  btnJSON?.addEventListener('click', exportarJSON);
}

document.addEventListener('DOMContentLoaded', initApp);
