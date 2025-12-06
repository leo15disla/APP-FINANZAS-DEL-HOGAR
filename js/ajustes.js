import { state, snapshotState, refreshStorage, downloadFile, ensureDefaultAccount } from './utils.js';
import { syncToBackend, syncFromBackend } from './sync.js';

let notifyCb = () => {};
let onChangeCb = () => {};

function marcarEstado(texto, tipo = 'info') {
  const estado = document.getElementById('backup-estado');
  if (estado) {
    estado.textContent = texto;
    estado.className = `section-subtitle estado-${tipo}`;
  }
  notifyCb(texto, tipo);
}

async function exportarBackup() {
  const data = snapshotState();
  downloadFile('backup-finanzas.json', JSON.stringify(data, null, 2), 'application/json');
  marcarEstado('Backup generado correctamente.');
  // Futuro: syncToBackend(data) cuando exista API
  void syncToBackend;
}

function datosEjemplo() {
  const hoy = new Date();
  const baseFecha = hoy.toISOString().split('T')[0];
  return {
    movimientos: [
      { id: Date.now() - 5, tipo: 'Ingreso', monto: 45000, fecha: baseFecha, categoria: 'Salario', nota: 'Pago mensual', tipo503020: 'Ahorro', cuentaId: 'cta-demo-1' },
      { id: Date.now() - 4, tipo: 'Gasto', monto: 3500, fecha: baseFecha, categoria: 'Comida', nota: 'supermercado', tipo503020: 'Necesidad', cuentaId: 'cta-demo-1' },
      { id: Date.now() - 3, tipo: 'Gasto', monto: 1800, fecha: baseFecha, categoria: 'Transporte', nota: 'combustible', tipo503020: 'Necesidad', cuentaId: 'cta-demo-2' },
      { id: Date.now() - 2, tipo: 'Gasto', monto: 1200, fecha: baseFecha, categoria: 'Entretenimiento', nota: 'cine', tipo503020: 'Deseo', cuentaId: 'cta-demo-1' }
    ],
    cuentas: [
      { id: 'cta-demo-1', nombre: 'BHD Nómina', tipo: 'Banco', numero: '0012', saldo: 42000, color: '#2563eb', banco: 'BHD', diaCorte: 25, diaPago: 5 },
      { id: 'cta-demo-2', nombre: 'Popular Ahorros', tipo: 'Banco', numero: '0456', saldo: 12000, color: '#16a34a', banco: 'Popular', diaCorte: 15, diaPago: 28 }
    ],
    presupuesto: { necesidad: 20000, deseo: 10000, ahorro: 8000, categorias: [] },
    prestamos: [],
    settings: { sonido: true, tema: 'auto' }
  };
}

export function cargarDatosPrueba() {
  const ejemplo = datosEjemplo();
  state.movimientos = ejemplo.movimientos;
  state.cuentas = ejemplo.cuentas;
  state.presupuesto = ejemplo.presupuesto;
  state.prestamos = ejemplo.prestamos;
  state.settings = ejemplo.settings;
  refreshStorage();
  ensureDefaultAccount();
  onChangeCb();
  marcarEstado('Datos de prueba cargados.', 'info');
}

export function resetearDatos() {
  const confirmar = window.confirm('¿Seguro que deseas borrar todos los datos? Esta acción no se puede deshacer.');
  if (!confirmar) return;
  state.movimientos = [];
  state.historial = {};
  state.presupuesto = { necesidad: 0, deseo: 0, ahorro: 0, categorias: [] };
  state.prestamos = [];
  state.cuentas = [];
  state.settings = { sonido: true, tema: 'auto' };
  refreshStorage();
  ensureDefaultAccount();
  onChangeCb();
  marcarEstado('Datos reiniciados correctamente.', 'warning');
}

function esBackupValido(data) {
  return data && Array.isArray(data.movimientos) && Array.isArray(data.prestamos) && Array.isArray(data.cuentas);
}

function aplicarBackup(data) {
  state.movimientos = data.movimientos || [];
  state.historial = data.historial || {};
  state.presupuesto = data.presupuesto || { necesidad: 0, deseo: 0, ahorro: 0, categorias: [] };
  state.prestamos = data.prestamos || [];
  state.cuentas = data.cuentas || [];
  state.settings = data.settings || { sonido: true, tema: 'auto' };
  refreshStorage();
  onChangeCb();
}

function importarBackup(archivo) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!esBackupValido(data)) {
        marcarEstado('El archivo no parece un backup válido.', 'warning');
        return;
      }
      aplicarBackup(data);
      marcarEstado('Backup importado correctamente.');
    } catch (error) {
      marcarEstado('No se pudo importar el backup.', 'error');
      console.error(error);
    }
  };
  reader.readAsText(archivo);
}

export function initAjustes({ notify, onChange }) {
  notifyCb = notify;
  onChangeCb = onChange;
  const btnExport = document.getElementById('btn-backup-export');
  const inputBackup = document.getElementById('input-backup');
  const btnDemo = document.getElementById('btn-demo-data');
  const btnReset = document.getElementById('btn-reset-total');
  if (btnExport) btnExport.addEventListener('click', exportarBackup);
  if (inputBackup) {
    inputBackup.addEventListener('change', (e) => {
      const archivo = e.target.files?.[0];
      if (archivo) importarBackup(archivo);
      e.target.value = '';
    });
  }
  btnDemo?.addEventListener('click', cargarDatosPrueba);
  btnReset?.addEventListener('click', resetearDatos);

  // Futuro: restaurar desde backend
  void syncFromBackend;
}
