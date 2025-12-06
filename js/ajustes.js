import { state, snapshotState, refreshStorage } from './utils.js';
import { syncToBackend, syncFromBackend } from './sync.js';

let notifyCb = () => {};
let onChangeCb = () => {};

function descargar(nombre, contenido) {
  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

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
  descargar('backup-finanzas.json', JSON.stringify(data, null, 2));
  marcarEstado('Backup generado correctamente.');
  // Futuro: syncToBackend(data) cuando exista API
  void syncToBackend;
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
  if (btnExport) btnExport.addEventListener('click', exportarBackup);
  if (inputBackup) {
    inputBackup.addEventListener('change', (e) => {
      const archivo = e.target.files?.[0];
      if (archivo) importarBackup(archivo);
      e.target.value = '';
    });
  }

  // Futuro: restaurar desde backend
  void syncFromBackend;
}
