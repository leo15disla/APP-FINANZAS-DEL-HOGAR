import { state, formatCurrency, refreshStorage } from './utils.js';

let notifyCb = () => {};

export function actualizarCalendario() {
  // Placeholder para futuras funcionalidades.
}

function renderPrestamos() {
  const contenedor = document.getElementById('tabla-prestamos');
  if (!contenedor) return;
  contenedor.innerHTML = state.prestamos
    .map(
      (p) => `
        <tr>
          <td>${p.nombre}</td>
          <td>${p.tipo}</td>
          <td>${formatCurrency(p.monto)}</td>
          <td>-</td>
          <td>${p.plazo || '-'} meses</td>
          <td>—</td>
          <td><button class="btn-danger" data-delete="${p.id}">Eliminar</button></td>
        </tr>
      `
    )
    .join('');
}

function guardarPrestamo(form) {
  const nuevo = {
    id: Date.now(),
    nombre: form['prestamo-nombre'].value,
    tipo: form['prestamo-tipo'].value,
    monto: Number(form['prestamo-monto'].value) || 0,
    tasa: Number(form['prestamo-tasa'].value) || 0,
    plazo: Number(form['prestamo-plazo'].value) || 0,
    fechaInicio: form['prestamo-fecha-inicio'].value,
    fechaPrimerPago: form['prestamo-fecha-primer-pago'].value
  };
  state.prestamos.push(nuevo);
  refreshStorage();
  notifyCb('Préstamo registrado');
  renderPrestamos();
}

export function initPrestamos({ notify }) {
  notifyCb = notify;
  const form = document.getElementById('form-prestamo');
  renderPrestamos();
  document.getElementById('tabla-prestamos').addEventListener('click', (e) => {
    const id = e.target.dataset.delete;
    if (id) {
      state.prestamos = state.prestamos.filter((p) => p.id !== Number(id));
      refreshStorage();
      renderPrestamos();
      notifyCb('Préstamo eliminado', 'warning');
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    guardarPrestamo(form);
    form.reset();
  });
}

export function obtenerTotalPrestamos() {
  return state.prestamos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
}
