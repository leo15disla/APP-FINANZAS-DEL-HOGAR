import { state, formatCurrency, ensureDefaultAccount, refreshStorage } from './utils.js';

let notifyCb = () => {};

function diasRestantes(diaMes) {
  if (!diaMes) return null;
  const hoy = new Date();
  const objetivo = new Date(hoy.getFullYear(), hoy.getMonth(), diaMes);
  if (objetivo < hoy) objetivo.setMonth(objetivo.getMonth() + 1);
  return Math.ceil((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

export function renderCuentas() {
  const contenedor = document.getElementById('lista-cuentas');
  contenedor.innerHTML = state.cuentas
    .map((c) => {
      const isCard = c.tipo === 'Tarjeta de crédito';
      const limite = Number(c.limite) || 0;
      const uso = Math.max(0, Math.min(100, limite ? Math.round(((Number(c.saldo) || 0) / limite) * 100) : 0));
      const diasCorte = diasRestantes(c.diaCorte);
      const diasPago = diasRestantes(c.diaPago);
      const minimo = Number(c.minimo) || 0;
      const interes = Number(c.interes) || 0;
      const pagoMinimo = minimo ? (Number(c.saldo) || 0) * (minimo / 100) : 0;
      const interesMes = interes ? (Number(c.saldo) || 0) * (interes / 100) : 0;

      return `
      <div class="cuenta-card" style="--cuenta-color:${c.color}">
        <div class="cuenta-nombre">${c.nombre}</div>
        <div class="cuenta-numero">${c.numero || '----'}</div>
        <div class="cuenta-saldo">${formatCurrency(c.saldo || 0)}</div>
        <div class="cuenta-tipo">${c.tipo}</div>
        ${
          isCard
            ? `<div class="detalle-tarjeta">
                Límite: ${limite ? formatCurrency(limite) : '—'} · Uso: ${uso}%
                <div class="barra-uso"><span style="width:${uso}%"></span></div>
                ${pagoMinimo ? `Pago mínimo: ${formatCurrency(pagoMinimo)} · Interés estimado: ${formatCurrency(interesMes)}` : ''}
                ${diasCorte ? `<div>Día de corte en ${diasCorte} días</div>` : ''}
                ${diasPago ? `<div>Día de pago en ${diasPago} días</div>` : ''}
              </div>`
            : ''
        }
      </div>
    `;
    })
    .join('');

  const select = document.getElementById('mov-cuenta');
  select.innerHTML = ['<option value="">Sin cuenta</option>',
    ...state.cuentas.map((c) => `<option value="${c.id}">${c.nombre}</option>`)
  ].join('');
}

function guardarCuenta(form) {
  const existe = form['cuenta-id'].value;
  const payload = {
    id: existe ? Number(existe) : Date.now(),
    nombre: form['cuenta-nombre'].value,
    tipo: form['cuenta-tipo'].value,
    numero: form['cuenta-numero'].value,
    saldo: Number(form['cuenta-saldo'].value) || 0,
    limite: Number(form['cuenta-limite'].value) || 0,
    minimo: Number(form['cuenta-minimo'].value) || 0,
    interes: Number(form['cuenta-interes'].value) || 0,
    color: form['cuenta-color'].value,
    nota: form['cuenta-nota'].value,
    diaCorte: form['cuenta-dia-corte'].value,
    diaPago: form['cuenta-dia-pago'].value
  };

  const idx = state.cuentas.findIndex((c) => c.id === payload.id);
  if (idx >= 0) state.cuentas[idx] = payload;
  else state.cuentas.push(payload);
  refreshStorage();
  renderCuentas();
  notifyCb('Cuenta guardada');
  form.reset();
}

export function initCuentas({ notify }) {
  notifyCb = notify;
  ensureDefaultAccount();
  const form = document.getElementById('form-cuenta');
  renderCuentas();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    guardarCuenta(form);
  });
}
