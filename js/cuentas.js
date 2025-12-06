

import { state, formatCurrency, ensureDefaultAccount, refreshStorage } from './utils.js';

let notifyCb = () => {};

export function renderCuentas() {
  const contenedor = document.getElementById('lista-cuentas');
  contenedor.innerHTML = state.cuentas
    .map(
      (c) => `
      <div class="cuenta-card" style="--cuenta-color:${c.color}">
        <div class="cuenta-nombre">${c.nombre}</div>
        <div class="cuenta-numero">${c.numero || '----'}</div>
        <div class="cuenta-saldo">${formatCurrency(c.saldo || 0)}</div>
        <div class="cuenta-tipo">${c.tipo}</div>
      </div>
    `
    )
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
