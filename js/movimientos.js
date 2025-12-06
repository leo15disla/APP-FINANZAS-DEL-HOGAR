import { state, parseAmount, formatCurrency, formatDate, refreshStorage } from './utils.js';
import { renderCuentas } from './cuentas.js';
import { actualizarCalendario } from './prestamos.js';

let onDataChange = () => {};
let notifier = () => {};
let chipTipo = 'Todos';
let chipTiempo = 'mes';
let clickAudio;
let calendarDate = new Date();
let selectedDate = new Date();
let viewMode = 'lista';
let filtroCategoria = 'Todas';

const categoriaIconos = {
  Comida: '🍽️',
  Transporte: '🚗',
  Supermercado: '🛒',
  Servicios: '💡',
  Vivienda: '🏠',
  Entretenimiento: '🎉',
  Salud: '🩺',
  Educación: '📚',
  Otros: '✨'
};

const categoriasDisponibles = [
  { nombre: 'Comida', icono: '🍽️', keywords: ['colmado', 'arroz', 'almuerzo', 'cena'] },
  { nombre: 'Transporte', icono: '🚗', keywords: ['transporte', 'taxi', 'uber', 'combustible'] },
  { nombre: 'Supermercado', icono: '🛒', keywords: ['super', 'supermercado', 'compra'] },
  { nombre: 'Servicios', icono: '💡', keywords: ['factura', 'luz', 'agua', 'internet'] },
  { nombre: 'Vivienda', icono: '🏠', keywords: ['alquiler', 'renta', 'casa'] },
  { nombre: 'Entretenimiento', icono: '🎉', keywords: ['cine', 'netflix', 'fiesta'] },
  { nombre: 'Salud', icono: '🩺', keywords: ['farmacia', 'doctor', 'emergencia'] },
  { nombre: 'Educación', icono: '📚', keywords: ['colegio', 'curso', 'libro'] },
  { nombre: 'Otros', icono: '✨', keywords: [] }
];

const sugerenciasPorCategoria = {
  Comida: ['Almuerzo', 'Cena', 'Delivery', 'Snacks'],
  Transporte: ['Combustible', 'Taxi', 'Metro', 'Peaje'],
  Supermercado: ['Verduras', 'Carnes', 'Limpieza del hogar', 'Despensa'],
  Servicios: ['Luz', 'Agua', 'Internet', 'Teléfono'],
  Vivienda: ['Alquiler', 'Mantenimiento', 'Arreglo'],
  Entretenimiento: ['Cine', 'Streaming', 'Salida'],
  Salud: ['Farmacia', 'Consulta', 'Seguro'],
  Educación: ['Libros', 'Curso', 'Colegio'],
  Otros: ['Compra puntual', 'Regalo', 'Imprevisto']
};

function normalizarTexto(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function iconoCategoria(nombre) {
  return `${categoriaIconos[nombre] || '🏷️'} ${nombre}`;
}

function sugerirTipo503(nota, categoria) {
  const texto = normalizarTexto(`${nota} ${categoria}`);
  if (/ahorro|inversion|inversi|emergenc/.test(texto)) return 'Ahorro';
  if (/netflix|cine|salida|cena|ocio|entreten|stream/.test(texto)) return 'Deseo';
  if (/regalo|ropa|viaje/.test(texto)) return 'Deseo';
  if (/colmado|arroz|factura|luz|agua|gas/.test(texto)) return 'Necesidad';
  const categoriaDetectada = categoriasDisponibles.find((c) => c.keywords.some((k) => texto.includes(k)));
  if (categoriaDetectada?.nombre === 'Entretenimiento') return 'Deseo';
  return categoriaDetectada ? 'Necesidad' : 'Necesidad';
}

function poblarSugerencias(categoriaSeleccionada) {
  const data = document.getElementById('sugerencias-nota');
  if (!data) return;
  const lista = sugerenciasPorCategoria[categoriaSeleccionada] || [];
  data.innerHTML = lista.map((item) => `<option value="${item}"></option>`).join('');
}

function poblarCategoriasSelectores() {
  const selectCategoria = document.getElementById('categoria');
  const filtroCat = document.getElementById('filtro-categoria');
  const editCategoria = document.getElementById('edit-categoria');
  if (selectCategoria) {
    selectCategoria.innerHTML = categoriasDisponibles
      .map((c) => `<option value="${c.nombre}">${c.icono} ${c.nombre}</option>`)
      .join('');
  }
  if (filtroCat) {
    filtroCat.innerHTML = ['<option value="Todas">Todas las categorías</option>',
      ...categoriasDisponibles.map((c) => `<option value="${c.nombre}">${c.icono} ${c.nombre}</option>`)];
  }
  if (editCategoria) {
    editCategoria.innerHTML = categoriasDisponibles
      .map((c) => `<option value="${c.nombre}">${c.icono} ${c.nombre}</option>`)
      .join('');
  }
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
  inputs.tipo503020.value = sugerirTipo503(inputs.nota.value, inputs.categoria.value);
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
  const filtroCat = filtroCategoria;

  return movimientosMes.filter((m) => {
    if (chipTipo !== 'Todos' && m.tipo !== chipTipo) return false;
    if (filtroCat !== 'Todas' && m.categoria !== filtroCat) return false;
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

function setFechaSeleccionada(date, input) {
  selectedDate = new Date(date);
  calendarDate = new Date(date);
  input.value = selectedDate.toISOString().slice(0, 10);
}

function renderCalendario(input) {
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-mes');
  if (!grid || !label) return;
  const base = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  label.textContent = base.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
  grid.innerHTML = '';
  const offset = (base.getDay() + 6) % 7;
  const diasMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  for (let i = 0; i < offset; i++) {
    const span = document.createElement('span');
    grid.appendChild(span);
  }
  for (let d = 1; d <= diasMes; d++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = d;
    btn.className = 'calendar-day';
    const current = new Date(base.getFullYear(), base.getMonth(), d);
    if (current.toDateString() === selectedDate.toDateString()) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      setFechaSeleccionada(current, input);
      document.getElementById('calendario-visual')?.classList.add('hidden');
    });
    grid.appendChild(btn);
  }
}

function toggleCalendario(show, input) {
  const cal = document.getElementById('calendario-visual');
  if (!cal) return;
  if (show) {
    cal.classList.remove('hidden');
    renderCalendario(input);
  } else {
    cal.classList.add('hidden');
  }
}

function renderTablaActual(container, movimientosMes) {
  if (!container) return;
  if (!movimientosMes.length) {
    container.innerHTML = '';
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
          <td data-label="Categoría">${m.categoria ? iconoCategoria(m.categoria) : ''}</td>
          <td data-label="Cuenta">${nombreCuenta(m.cuentaId)}</td>
          <td data-label="50/30/20">${m.tipo503020}</td>
          <td data-label="Nota">${m.nota || ''}</td>
          <td data-label="Editar"><button class="btn-link-small" data-edit="${m.id}">Editar</button></td>
          <td data-label="Eliminar"><button class="btn-danger" data-delete="${m.id}">Eliminar</button></td>
        </tr>`;
    })
    .join('');
}

function renderTarjetasActual(container, movimientosMes) {
  if (!container) return;
  if (!movimientosMes.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = movimientosMes
    .map((m) => {
      const tipoClass = m.tipo?.toLowerCase() || '';
      return `
        <div class="mov-card tipo-${tipoClass}" data-id="${m.id}">
          <div class="mov-top">
            <div class="mov-meta">
              <span class="mov-chip ${tipoClass} small">${m.tipo}</span>
              <span>${m.categoria ? iconoCategoria(m.categoria) : ''}</span>
            </div>
            <div class="mov-monto">${formatCurrency(m.monto)}</div>
          </div>
          <div class="mov-meta">
            <span>${formatDate(m.fecha)}</span>
            <span>${nombreCuenta(m.cuentaId)}</span>
            <span class="mov-chip neutral small">${m.tipo503020}</span>
          </div>
          <div class="mov-nota">${m.nota || 'Sin nota'}</div>
          <div class="mov-card-actions">
            <button class="btn-link-small" data-edit-card="${m.id}">Editar</button>
            <button class="btn-danger" data-delete-card="${m.id}">Eliminar</button>
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.mov-card').forEach((card) => {
    attachSwipe(card);
  });
}

function attachSwipe(card) {
  let startX = 0;
  card.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });
  card.addEventListener('touchend', (e) => {
    const delta = e.changedTouches[0].clientX - startX;
    if (delta < -60) {
      eliminarMovimiento(Number(card.dataset.id));
      notifier('Movimiento eliminado', 'warning');
      renderMovimientos();
    }
    if (delta > 60) {
      abrirModalEdicion(Number(card.dataset.id));
      card.classList.add('swipe-right');
      setTimeout(() => card.classList.remove('swipe-right'), 200);
    }
  });

  card.addEventListener('click', (e) => {
    const id = Number(card.dataset.id);
    if (e.target.dataset.deleteCard) {
      eliminarMovimiento(id);
      notifier('Movimiento eliminado', 'warning');
      renderMovimientos();
      return;
    }
    if (e.target.dataset.editCard) {
      abrirModalEdicion(id);
      return;
    }
    abrirModalEdicion(id);
  });
}

function abrirModalEdicion(id) {
  const modal = document.getElementById('modal-editar');
  const form = document.getElementById('form-editar-mov');
  if (!modal || !form) return;
  const mov = state.movimientos.find((m) => m.id === id);
  if (!mov) return;
  form['edit-id'].value = mov.id;
  form['edit-fecha'].value = mov.fecha;
  form['edit-monto'].value = formatCurrency(mov.monto);
  form['edit-categoria'].value = mov.categoria || '';
  form['edit-nota'].value = mov.nota || '';
  modal.classList.remove('hidden');
}

function cerrarModalEdicion() {
  const modal = document.getElementById('modal-editar');
  if (modal) modal.classList.add('hidden');
}

function actualizarMovimiento(id, cambios) {
  const idx = state.movimientos.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  const previo = state.movimientos[idx];
  aplicarMovimientoEnCuenta(previo, -1);
  const actualizado = { ...previo, ...cambios };
  state.movimientos[idx] = actualizado;
  aplicarMovimientoEnCuenta(actualizado, 1);
  refreshStorage();
  onDataChange();
  return true;
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
          <td data-label="Categoría">${m.categoria ? iconoCategoria(m.categoria) : ''}</td>
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
  const quickActions = document.getElementById('acciones-rapidas');
  const datalist = document.getElementById('sugerencias-nota');
  const filtroCat = document.getElementById('filtro-categoria');
  const sonidoToggle = document.getElementById('toggle-sonido');
  const viewButtons = Array.from(document.querySelectorAll('.view-btn'));
  const tarjetasContainer = document.getElementById('tarjetas-actual');
  const tablaWrap = document.getElementById('tabla-wrap');
  const emptyState = document.getElementById('mov-empty');
  const btnEmpty = document.getElementById('btn-empty-registrar');
  const modal = document.getElementById('modal-editar');
  const modalClose = document.querySelector('[data-modal-close]');
  const formEditar = document.getElementById('form-editar-mov');

  clickAudio = new Audio(
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='
  );

  if (!state.settings) state.settings = { sonido: true };
  if (sonidoToggle) {
    sonidoToggle.checked = state.settings.sonido !== false;
    sonidoToggle.addEventListener('change', () => {
      state.settings.sonido = sonidoToggle.checked;
      refreshStorage();
    });
  }

  poblarCategoriasSelectores();
  if (!inputs.categoria.value) inputs.categoria.value = categoriasDisponibles[0]?.nombre || '';
  poblarSugerencias(inputs.categoria.value);
  setFechaSeleccionada(new Date(), inputs.fecha);
  renderCalendario(inputs.fecha);

  inputs.fecha.addEventListener('click', () => toggleCalendario(true, inputs.fecha));
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendario(inputs.fecha);
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendario(inputs.fecha);
  });

  document.addEventListener('click', (e) => {
    const cal = document.getElementById('calendario-visual');
    if (!cal) return;
    if (cal.contains(e.target) || e.target === inputs.fecha) return;
    cal.classList.add('hidden');
  });

  if (inputs.monto.dataset.prefijo) {
    inputs.monto.addEventListener('focus', () => {
      if (!inputs.monto.value.startsWith(inputs.monto.dataset.prefijo)) {
        inputs.monto.value = inputs.monto.dataset.prefijo;
      }
    });
  }

  inputs.monto.addEventListener('input', () => {
    const raw = inputs.monto.value;
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      inputs.monto.value = inputs.monto.dataset.prefijo || '';
      return;
    }
    const monto = parseAmount(raw);
    inputs.monto.value = `${inputs.monto.dataset.prefijo || 'RD$ '}${monto.toLocaleString('es-DO')}`;
  });

  inputs.categoria.addEventListener('change', () => {
    poblarSugerencias(inputs.categoria.value);
    inputs.tipo503020.value = sugerirTipo503(inputs.nota.value, inputs.categoria.value);
  });

  inputs.nota.addEventListener('input', () => {
    inputs.tipo503020.value = sugerirTipo503(inputs.nota.value, inputs.categoria.value);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const guardado = agregarMovimiento(inputs);
    if (guardado) {
      notify('Movimiento guardado');
      if (state.settings.sonido !== false) clickAudio?.play?.();
      form.reset();
      setFechaSeleccionada(new Date(), inputs.fecha);
    }
  });

  inputs.monto.addEventListener('blur', () => {
    const monto = parseAmount(inputs.monto.value);
    if (monto) inputs.monto.value = formatCurrency(monto);
  });

  quickActions?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-accion]');
    if (!btn) return;
    const categoria = btn.dataset.accion;
    const icon = btn.dataset.icon;
    inputs.tipo.value = 'Gasto';
    inputs.categoria.value = categoria;
    inputs.nota.value = `${icon} ${categoria}`;
    poblarSugerencias(categoria);
    inputs.tipo503020.value = sugerirTipo503(inputs.nota.value, categoria);
    inputs.monto.focus();
  });

  if (datalist && inputs.categoria.value) {
    poblarSugerencias(inputs.categoria.value);
  }

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

  filtroCat?.addEventListener('change', (e) => {
    filtroCategoria = e.target.value;
    renderMovimientos();
  });

  tablaActual.addEventListener('click', (e) => {
    const idDelete = e.target.dataset.delete;
    const idEdit = e.target.dataset.edit;
    if (idDelete) {
      eliminarMovimiento(Number(idDelete));
      notify('Movimiento eliminado', 'warning');
    }
    if (idEdit) {
      abrirModalEdicion(Number(idEdit));
    }
  });

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      viewButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      viewMode = btn.dataset.view;
      renderMovimientos();
    });
  });

  btnEmpty?.addEventListener('click', () => {
    document.getElementById('btnRegistrar')?.click();
  });

  modalClose?.addEventListener('click', cerrarModalEdicion);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModalEdicion();
  });

  formEditar?.['edit-monto']?.addEventListener('blur', () => {
    const monto = parseAmount(formEditar['edit-monto'].value);
    if (monto) formEditar['edit-monto'].value = formatCurrency(monto);
  });

  formEditar?.addEventListener('submit', (e) => {
    e.preventDefault();
    const monto = parseAmount(formEditar['edit-monto'].value);
    if (!monto) return notifier('Ingresa un monto válido', 'warning');
    const payload = {
      fecha: formEditar['edit-fecha'].value,
      monto,
      categoria: formEditar['edit-categoria'].value,
      tipo503020: sugerirTipo503(formEditar['edit-nota'].value, formEditar['edit-categoria'].value),
      nota: formEditar['edit-nota'].value
    };
    const actualizado = actualizarMovimiento(Number(formEditar['edit-id'].value), payload);
    if (actualizado) {
      notifier('Movimiento actualizado');
      cerrarModalEdicion();
      renderMovimientos();
    }
  });

  historialSelect.addEventListener('change', () => renderHistorial(historialSelect, tablaHistorial));

  renderMovimientos();
  renderHistorial(historialSelect, tablaHistorial);
}

export function renderMovimientos() {
  const tablaActual = document.getElementById('tabla-actual');
  const tarjetasContainer = document.getElementById('tarjetas-actual');
  const tablaWrap = document.getElementById('tabla-wrap');
  const emptyState = document.getElementById('mov-empty');
  const tablaHistorial = document.getElementById('tabla-historial');
  const historialSelect = document.getElementById('historial-meses');
  const movimientosMes = filtrarMovimientos(movimientosDelMesActual());
  renderResumenMovimientos(movimientosMes);
  const isEmpty = !movimientosMes.length;
  emptyState?.classList.toggle('hidden', !isEmpty);
  tablaWrap?.classList.toggle('hidden', viewMode !== 'lista' || isEmpty);
  tarjetasContainer?.classList.toggle('hidden', viewMode !== 'tarjetas' || isEmpty);
  if (isEmpty) {
    if (tablaActual) tablaActual.innerHTML = '';
    if (tarjetasContainer) tarjetasContainer.innerHTML = '';
  }
  if (!isEmpty && viewMode === 'lista') renderTablaActual(tablaActual, movimientosMes);
  if (!isEmpty && viewMode === 'tarjetas') renderTarjetasActual(tarjetasContainer, movimientosMes);
  renderHistorial(historialSelect, tablaHistorial);
}

export function obtenerMovimientosDelMes(offset = 0) {
  return movimientosDelMesActual(offset);
}
