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
    localStorage.setItem(key, JSON.stringify(value));
  }
};

export const state = {
  movimientos: storage.read('movimientos', []),
  historial: storage.read('historial', {}),
  presupuesto: storage.read('presupuesto', { necesidad: 0, deseo: 0, ahorro: 0 }),
  prestamos: storage.read('prestamos', []),
  cuentas: storage.read('cuentas', [])
};

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
  return Number(String(raw).replace(/\./g, '').replace(/,/g, '')) || 0;
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function createNotifier() {
  const container = document.createElement('div');
  container.id = 'notificaciones-stack';
  document.body.appendChild(container);

  return function notify(message, type = 'info') {
    const item = document.createElement('div');
    item.className = `toast toast-${type}`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => item.classList.add('visible'), 10);
    setTimeout(() => {
      item.classList.remove('visible');
      setTimeout(() => item.remove(), 300);
    }, 3200);
  };
}

export function createRouter(secciones, botones) {
  const changeSection = (name) => {
    Object.values(secciones).forEach((s) => s.classList.add('hidden'));
    Object.values(botones).forEach((b) => b.classList.remove('active'));
    secciones[name]?.classList.remove('hidden');
    botones[name]?.classList.add('active');
    window.location.hash = name;
  };

  const hash = window.location.hash.replace('#', '');
  if (hash && secciones[hash]) changeSection(hash);
  else changeSection('dashboard');

  return changeSection;
}

export function refreshStorage() {
  storage.write('movimientos', state.movimientos);
  storage.write('historial', state.historial);
  storage.write('presupuesto', state.presupuesto);
  storage.write('prestamos', state.prestamos);
  storage.write('cuentas', state.cuentas);
}
