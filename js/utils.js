const STORAGE_VERSION = 1;
let isCompressing = false;

export const storage = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.error('Error leyendo storage', key, error);
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (isCompressing) return;
      console.warn('Storage lleno, intentando comprimir...', error);
      if (compressStorage()) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
          console.error('No se pudo guardar después de comprimir', e);
        }
      }
    }
  }
};

export function downloadFile(nombre, contenido, tipo = 'application/octet-stream') {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function readState() {
  const version = Number(localStorage.getItem('storageVersion') || 0);
  if (version !== STORAGE_VERSION) {
    localStorage.setItem('storageVersion', STORAGE_VERSION);
    return {
      movimientos: [],
      historial: {},
      presupuesto: { necesidad: 0, deseo: 0, ahorro: 0, categorias: [] },
      prestamos: [],
      cuentas: [],
      settings: { sonido: true, tema: 'auto' }
    };
  }
  return {
    movimientos: storage.read('movimientos', []),
    historial: storage.read('historial', {}),
    presupuesto: storage.read('presupuesto', { necesidad: 0, deseo: 0, ahorro: 0, categorias: [] }),
    prestamos: storage.read('prestamos', []),
    cuentas: storage.read('cuentas', []),
    settings: storage.read('settings', { sonido: true, tema: 'auto' })
  };
}

export const state = readState();

function compressStorage() {
  try {
    isCompressing = true;
    const maxMovs = 500;
    if (state.movimientos.length > maxMovs) {
      state.movimientos = state.movimientos.slice(-maxMovs);
    }

    const historialKeys = Object.keys(state.historial);
    if (historialKeys.length > 12) {
      const ordenados = historialKeys.sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
      );
      ordenados.slice(12).forEach((key) => delete state.historial[key]);
    }

    refreshStorage();
    isCompressing = false;
    return true;
  } catch (error) {
    console.error('Error al comprimir storage', error);
    isCompressing = false;
    return false;
  }
}

export function ensureDefaultAccount() {
  if (state.cuentas.length === 0) {
    state.cuentas.push({
      id: Date.now(),
      nombre: 'Efectivo',
      tipo: 'Efectivo',
      numero: '----',
      saldo: 0,
      color: '#0f172a',
      nota: 'Dinero físico disponible.',
      diaCorte: '',
      diaPago: ''
    });
    storage.write('cuentas', state.cuentas);
  }
}

export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return 'RD$ 0.00';
  return 'RD$ ' + Number(value).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function parseAmount(raw) {
  if (!raw) return 0;
  return Number(String(raw).replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(/,/g, '')) || 0;
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatMonthKey(date) {
  return date.toLocaleDateString('es-DO', { year: 'numeric', month: 'long' });
}

export function monthlyBudgetLimit() {
  const base = state.presupuesto || {};
  const baseTotal = ['necesidad', 'deseo', 'ahorro'].reduce(
    (acc, key) => acc + (Number(base[key]) || 0),
    0
  );
  const categoriasTotal = (base.categorias || []).reduce(
    (acc, cat) => acc + (Number(cat.limite) || 0),
    0
  );

  return baseTotal + categoriasTotal;
}

export function createNotifier() {
  const container = document.createElement('div');
  container.id = 'notificaciones-stack';
  document.body.appendChild(container);

  const active = [];
  const maxVisible = 4;

  return function notify(message, type = 'info') {
    if (active.length >= maxVisible) {
      const oldest = active.shift();
      oldest?.remove();
    }
    const item = document.createElement('div');
    item.className = `toast toast-${type}`;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.innerHTML = '&times;';
    close.addEventListener('click', () => {
      item.classList.remove('visible');
      setTimeout(() => item.remove(), 200);
    });

    const text = document.createElement('span');
    text.textContent = message;

    item.appendChild(text);
    item.appendChild(close);
    container.appendChild(item);
    active.push(item);

    const hide = () => {
      item.classList.remove('visible');
      setTimeout(() => item.remove(), 300);
    };

    setTimeout(() => item.classList.add('visible'), 10);
    const timer = setTimeout(hide, 4000);

    item.addEventListener('mouseenter', () => clearTimeout(timer));
    item.addEventListener('mouseleave', () => item.classList.contains('visible') && hide());
  };
}

export function createRouter(secciones, botones) {
  const persistKey = 'app-last-section';

  const changeSection = (name, silent = false) => {
    Object.values(secciones).forEach((s) => {
      s.classList.add('hidden');
      s.classList.remove('section-enter');
    });
    Object.values(botones).forEach((b) => b.classList.remove('active'));
    secciones[name]?.classList.remove('hidden');
    secciones[name]?.classList.add('section-enter');
    setTimeout(() => secciones[name]?.classList.remove('section-enter'), 400);
    botones[name]?.classList.add('active');
    if (!silent) {
      window.location.hash = name;
      localStorage.setItem(persistKey, name);
    }
  };

  window.addEventListener('hashchange', () => {
    const name = window.location.hash.replace('#', '');
    if (secciones[name]) changeSection(name, true);
  });

  const stored = localStorage.getItem(persistKey);
  const hash = window.location.hash.replace('#', '');
  if (hash && secciones[hash]) changeSection(hash, true);
  else if (stored && secciones[stored]) changeSection(stored, true);
  else changeSection('dashboard', true);

  return changeSection;
}

export function softRefresh(element, className = 'card-refresh') {
  if (!element) return;
  element.classList.remove(className);
  // trigger reflow to restart animation
  void element.offsetWidth;
  element.classList.add(className);
}

export function balanceStatus(balance, limite = 0) {
  const monto = Number(balance) || 0;
  const threshold = limite ? limite * 0.2 : 2000;
  if (monto <= 0) return { nivel: 'critico', clase: 'estado-rojo' };
  if (monto <= threshold) return { nivel: 'moderado', clase: 'estado-amarillo' };
  return { nivel: 'saludable', clase: 'estado-verde' };
}

export function refreshStorage() {
  storage.write('movimientos', state.movimientos);
  storage.write('historial', state.historial);
  storage.write('presupuesto', state.presupuesto);
  storage.write('prestamos', state.prestamos);
  storage.write('cuentas', state.cuentas);
  storage.write('settings', state.settings || { sonido: true, tema: 'auto' });
}

export function snapshotState() {
  return {
    movimientos: [...(state.movimientos || [])],
    historial: { ...(state.historial || {}) },
    presupuesto: { ...(state.presupuesto || {}) },
    prestamos: [...(state.prestamos || [])],
    cuentas: [...(state.cuentas || [])],
    settings: { ...(state.settings || {}) }
  };
}
