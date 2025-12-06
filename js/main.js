import { state, createNotifier, createRouter, refreshStorage } from './utils.js';
import { initMovimientos, renderMovimientos } from './movimientos.js';
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
}

document.addEventListener('DOMContentLoaded', initApp);
