import { state, parseAmount, formatCurrency, formatDate, refreshStorage } from './utils.js';
import { renderCuentas } from './cuentas.js';
import { actualizarCalendario } from './prestamos.js';

let onDataChange = () => {};
let notifier = () => {};
let chipTipo = 'Todos';
let chipTiempo = 'mes';

function normalizarTexto(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function nombreCuenta(id) {
  if (!id) return '-';
  const cuenta = state.cuentas.find((c) => String(c.id) === String(id));
  return cuenta?.nombre || id;
}

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

function validarMovimiento(inputs) {
  const errores = [];
  if (!inputs.fecha.value) errores.push('La fecha es obligatoria.');
  const monto = parseAmount(inputs.monto.value);
  if (monto <= 0) errores.push('Ingresa un monto válido mayor a cero.');
  if (!inputs.categoria.value) errores.push('Selecciona una categoría.');
  return { esValido: errores.length === 0, monto, errores };
}

function agregarMovimiento(inputs) {
  const { esValido, monto, errores } = validarMovimiento(inputs);
  if (!esValido) {
    errores.forEach((msg) => notifier(msg, 'warning'));
    return false;
  }
  const mov = {
    id: Date.now(),
    tipo: inputs.tipo.value,
    fecha: inputs.fecha.value,
    monto,
    categoria: inputs.categoria.value,
    tipo503020: inputs.tipo503020.value,
    nota: inputs.nota.value,
    cuentaId: inputs.cuenta.value ? Number(inputs.cuenta.value) : null
  };
  state.movimientos.push(mov);
  aplicarMovimientoEnCuenta(mov, 1);
  refreshStorage();
  onDataChange();
  return true;
}

function eliminarMovimiento(id) {
  const idx = state.movimientos.findIndex((m) => m.id === id);
  if (idx === -1) return;
  aplicarMovimientoEnCuenta(state.movimientos[idx], -1);
  state.movimientos.splice(idx, 1);
  refreshStorage();
  onDataChange();
}

function movimientosDelMesActual(offset = 0) {
  const hoy = new Date();
  hoy.setMonth(hoy.getMonth() + offset);
  const mes = hoy.getMonth();
  const year = hoy.getFullYear();
  return state.movimientos.filter((m) => {
    const fecha = new Date(m.fecha);
    return fecha.getMonth() === mes && fecha.getFullYear() === year;
  });
}

function filtrarMovimientos(movimientosMes) {
  const buscar = normalizarTexto(document.getElementById('buscar').value);
  const filtro503020 = document.getElementById('filtro503020').value;

  return movimientosMes.filter((m) => {
    if (chipTipo !== 'Todos' && m.tipo !== chipTipo) return false;
    if (chipTiempo === 'hoy') {
      const hoy = new Date();
      const fecha = new Date(m.fecha);
      if (
        fecha.getFullYear() !== hoy.getFullYear() ||
        fecha.getMonth() !== hoy.getMonth() ||
        fecha.getDate() !== hoy.getDate()
      )
        return false;
    }
    if (chipTiempo === 'semana') {
      const hoy = new Date();
      const fecha = new Date(m.fecha);
      const diff = (hoy - fecha) / (1000 * 60 * 60 * 24);
      if (diff < 0 || diff > 7) return false;
    }
    if (chipTiempo === 'mes') {
      const hoy = new Date();
      const fecha = new Date(m.fecha);
      if (fecha.getMonth() !== hoy.getMonth() || fecha.getFullYear() !== hoy.getFullYear()) return false;
    }
    if (filtro503020 !== 'Todos' && m.tipo503020 !== filtro503020) return false;
    if (!buscar) return true;
    const texto = normalizarTexto(`${m.categoria} ${m.nota} ${m.monto} ${nombreCuenta(m.cuentaId)}`);
    const tokens = buscar.split(/\s+/).filter(Boolean);
    return tokens.every((token) => texto.includes(token));
  });
}

function renderResumenMovimientos(movs) {
  const resumen = document.getElementById('resumen-mov');
  if (!resumen) return;
  if (!movs.length) {
    resumen.textContent = 'Sin resultados para los filtros seleccionados.';
    return;
  }
  const ingresos = movs
    .filter((m) => m.tipo === 'Ingreso')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const gastos = movs
    .filter((m) => m.tipo === 'Gasto')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  resumen.textContent = `Ingresos: ${formatCurrency(ingresos)} | Gastos: ${formatCurrency(gastos)} | Balance: ${formatCurrency(
    ingresos - gastos
  )}`;
}

function renderTablaActual(container) {
  const movimientosMes = filtrarMovimientos(movimientosDelMesActual());
  renderResumenMovimientos(movimientosMes);
  if (!movimientosMes.length) {
    container.innerHTML = '<tr><td colspan="9" class="mov-empty">Aún no tienes movimientos este mes ✨</td></tr>';
    return;
  }

  container.innerHTML = movimientosMes
    .map((m) => {
      const tipoClass = m.tipo?.toLowerCase() || '';
      return `
        <tr class="mov-row tipo-${tipoClass}">
          <td data-label="Fecha">${formatDate(m.fecha)}</td>
          <td data-label="Tipo"><span class="mov-chip ${tipoClass}">${m.tipo}</span></td>
          <td data-label="Monto">${formatCurrency(m.monto)}</td>
          <td data-label="Categoría">${m.categoria || ''}</td>
          <td data-label="Cuenta">${nombreCuenta(m.cuentaId)}</td>
          <td data-label="50/30/20">${m.tipo503020}</td>
          <td data-label="Nota">${m.nota || ''}</td>
          <td data-label="Editar"><button class="btn-link-small" data-edit="${m.id}">Editar</button></td>
          <td data-label="Eliminar"><button class="btn-danger" data-delete="${m.id}">Eliminar</button></td>
        </tr>`;
    })
    .join('');
}

function renderHistorial(select, container) {
  const meses = Object.keys(state.historial).sort().reverse();
  select.innerHTML = meses.map((m) => `<option value="${m}">${m}</option>`).join('');
  if (!meses.length) {
    container.innerHTML = '<tr><td colspan="6" class="mov-empty">Sin historial registrado.</td></tr>';
    renderResumenHistorial();
    return;
  }
  const mesSeleccionado = select.value;
  const lista = state.historial[mesSeleccionado] || [];
  container.innerHTML = lista
    .map((m) => {
      const tipoClass = m.tipo?.toLowerCase() || '';
      return `
        <tr class="mov-row tipo-${tipoClass}">
          <td data-label="Fecha">${formatDate(m.fecha)}</td>
          <td data-label="Tipo"><span class="mov-chip ${tipoClass}">${m.tipo}</span></td>
          <td data-label="Monto">${formatCurrency(m.monto)}</td>
          <td data-label="Categoría">${m.categoria || ''}</td>
          <td data-label="50/30/20">${m.tipo503020}</td>
          <td data-label="Nota">${m.nota || ''}</td>
        </tr>
      `;
    })
    .join('');

  renderResumenHistorial();
}

function renderResumenHistorial() {
  const items = Object.entries(state.historial || {}).map(([mes, lista]) => {
    const gasto = lista
      .filter((m) => m.tipo === 'Gasto')
      .reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
    return { mes, gasto };
  });

  const caro = items.reduce((max, item) => (item.gasto > (max?.gasto ?? -Infinity) ? item : max), null);
  const barato = items.reduce((min, item) => (item.gasto < (min?.gasto ?? Infinity) ? item : min), null);
  const promedio = items.length
    ? items.reduce((acc, item) => acc + item.gasto, 0) / items.length
    : 0;

  document.getElementById('hist-mes-caro').textContent = caro ? `${caro.mes} · ${formatCurrency(caro.gasto)}` : 'Sin datos';
  document.getElementById('hist-mes-barato').textContent = barato
    ? `${barato.mes} · ${formatCurrency(barato.gasto)}`
    : 'Sin datos';
  document.getElementById('hist-mes-promedio').textContent = items.length
    ? formatCurrency(promedio)
    : 'Sin datos';
}

export function initMovimientos({ notify, onChange }) {
  notifier = notify;
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
  const chips = Array.from(document.querySelectorAll('.chip'));

  inputs.fecha.value = new Date().toISOString().slice(0, 10);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const guardado = agregarMovimiento(inputs);
    if (guardado) {
      notify('Movimiento guardado');
      form.reset();
      inputs.fecha.value = new Date().toISOString().slice(0, 10);
    }
  });

  inputs.monto.addEventListener('blur', () => {
    const monto = parseAmount(inputs.monto.value);
    if (monto) inputs.monto.value = formatCurrency(monto);
  });

  ['buscar', 'filtro503020'].forEach((id) => {
    const control = document.getElementById(id);
    control.addEventListener('input', () => renderMovimientos());
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const group = chip.dataset.chip;
      const value = chip.dataset.value;
      if (group === 'tipo') chipTipo = value;
      if (group === 'tiempo') chipTiempo = value;
      chips
        .filter((c) => c.dataset.chip === group)
        .forEach((c) => c.classList.toggle('active', c === chip));
      renderMovimientos();
    });
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

export function obtenerMovimientosDelMes(offset = 0) {
  return movimientosDelMesActual(offset);
}
