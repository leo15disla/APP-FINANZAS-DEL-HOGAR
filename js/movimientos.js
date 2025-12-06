import { state, parseAmount, formatCurrency, formatDate, refreshStorage } from './utils.js';
import { renderCuentas } from './cuentas.js';
import { actualizarCalendario } from './prestamos.js';

let onDataChange = () => {};

function aplicarMovimientoEnCuenta(mov, factor = 1) {
  if (!mov.cuentaId) return;
  const cuenta = state.cuentas.find((c) => String(c.id) === String(mov.cuentaId));
  if (!cuenta) return;
  const monto = Number(mov.monto) || 0;
  cuenta.saldo = Number(cuenta.saldo || 0) + (mov.tipo === 'Ingreso' ? factor * monto : -factor * monto);
  refreshStorage();
  renderCuentas();
  actualizarCalendario();
}

function agregarMovimiento(inputs) {
  const mov = {
    id: Date.now(),
    tipo: inputs.tipo.value,
    fecha: inputs.fecha.value,
    monto: parseAmount(inputs.monto.value),
    categoria: inputs.categoria.value,
    tipo503020: inputs.tipo503020.value,
    nota: inputs.nota.value,
    cuentaId: inputs.cuenta.value ? Number(inputs.cuenta.value) : null
  };
  state.movimientos.push(mov);
  aplicarMovimientoEnCuenta(mov, 1);
  refreshStorage();
  onDataChange();
}

function eliminarMovimiento(id) {
  const idx = state.movimientos.findIndex((m) => m.id === id);
  if (idx === -1) return;
  aplicarMovimientoEnCuenta(state.movimientos[idx], -1);
  state.movimientos.splice(idx, 1);
  refreshStorage();
  onDataChange();
}

function movimientosDelMesActual() {
  const hoy = new Date();
  const mes = hoy.getMonth();
  const year = hoy.getFullYear();
  return state.movimientos.filter((m) => {
    const fecha = new Date(m.fecha);
    return fecha.getMonth() === mes && fecha.getFullYear() === year;
  });
}

function renderTablaActual(container) {
  const movimientosMes = movimientosDelMesActual();
  container.innerHTML = movimientosMes
    .map(
      (m) => `
        <tr>
          <td>${formatDate(m.fecha)}</td>
          <td>${m.tipo}</td>
          <td>${formatCurrency(m.monto)}</td>
          <td>${m.categoria || ''}</td>
          <td>${m.cuentaId || '-'}</td>
          <td>${m.tipo503020}</td>
          <td>${m.nota || ''}</td>
          <td><button class="btn-link-small" data-edit="${m.id}">Editar</button></td>
          <td><button class="btn-danger" data-delete="${m.id}">Eliminar</button></td>
        </tr>
      `
    )
    .join('');
}

function renderHistorial(select, container) {
  const meses = Object.keys(state.historial).sort().reverse();
  select.innerHTML = meses.map((m) => `<option value="${m}">${m}</option>`).join('');
  const mesSeleccionado = select.value;
  const lista = state.historial[mesSeleccionado] || [];
  container.innerHTML = lista
    .map(
      (m) => `
        <tr>
          <td>${formatDate(m.fecha)}</td>
          <td>${m.tipo}</td>
          <td>${formatCurrency(m.monto)}</td>
          <td>${m.categoria || ''}</td>
          <td>${m.tipo503020}</td>
          <td>${m.nota || ''}</td>
        </tr>
      `
    )
    .join('');
}

export function initMovimientos({ notify, onChange }) {
  onDataChange = onChange;
  const form = document.getElementById('form-mov');
  const inputs = {
    tipo: document.getElementById('tipo'),
    fecha: document.getElementById('fecha'),
    monto: document.getElementById('monto'),
    categoria: document.getElementById('categoria'),
    tipo503020: document.getElementById('tipo503020'),
    nota: document.getElementById('nota'),
    cuenta: document.getElementById('mov-cuenta')
  };
  const tablaActual = document.getElementById('tabla-actual');
  const tablaHistorial = document.getElementById('tabla-historial');
  const historialSelect = document.getElementById('historial-meses');

  inputs.fecha.value = new Date().toISOString().slice(0, 10);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    agregarMovimiento(inputs);
    notify('Movimiento guardado');
    form.reset();
  });

  tablaActual.addEventListener('click', (e) => {
    const id = e.target.dataset.delete;
    if (id) {
      eliminarMovimiento(Number(id));
      notify('Movimiento eliminado', 'warning');
    }
  });

  historialSelect.addEventListener('change', () => renderHistorial(historialSelect, tablaHistorial));

  renderTablaActual(tablaActual);
  renderHistorial(historialSelect, tablaHistorial);
}

export function renderMovimientos() {
  const tablaActual = document.getElementById('tabla-actual');
  const tablaHistorial = document.getElementById('tabla-historial');
  const historialSelect = document.getElementById('historial-meses');
  renderTablaActual(tablaActual);
  renderHistorial(historialSelect, tablaHistorial);
}

export function obtenerMovimientosDelMes() {
  return movimientosDelMesActual();
}
