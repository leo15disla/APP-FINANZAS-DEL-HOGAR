import { state, formatCurrency, refreshStorage } from './utils.js';

let notifyCb = () => {};
let chartPrestamo;

function calcularCuotaPMT(monto, tasaAnual, plazoMeses) {
  const tasaMensual = (Number(tasaAnual) || 0) / 100 / 12;
  if (!tasaMensual) return (Number(monto) || 0) / plazoMeses;
  const factor = Math.pow(1 + tasaMensual, plazoMeses);
  return (monto * tasaMensual * factor) / (factor - 1);
}

function construirAmortizacion(prestamo) {
  const monto = Number(prestamo.monto) || 0;
  const tasa = Number(prestamo.tasa) || 0;
  const plazo = Number(prestamo.plazo) || 1;
  const cuota = calcularCuotaPMT(monto, tasa, plazo);
  const tabla = [];
  let saldo = monto;
  for (let i = 1; i <= plazo; i++) {
    const interes = saldo * ((tasa / 100) / 12);
    const capital = cuota - interes;
    saldo = Math.max(0, saldo - capital);
    const fecha = new Date(prestamo.fechaPrimerPago || prestamo.fechaInicio || Date.now());
    fecha.setMonth(fecha.getMonth() + (i - 1));
    tabla.push({
      numero: i,
      fecha: fecha.toISOString().substring(0, 10),
      cuota,
      capital,
      interes,
      saldo
    });
  }
  const interesTotal = tabla.reduce((acc, r) => acc + r.interes, 0);
  return { cuota, tabla, interesTotal, capitalTotal: monto, saldoRestante: saldo };
}

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
          <td>${p.cuota ? formatCurrency(p.cuota) : '-'}</td>
          <td>${p.plazo || '-'} meses</td>
          <td><button class="btn-secondary" data-detalle="${p.id}">Ver detalle</button></td>
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
  const calculo = construirAmortizacion(nuevo);
  nuevo.cuota = calculo.cuota;
  nuevo.interesTotal = calculo.interesTotal;
  nuevo.saldoRestante = calculo.saldoRestante;
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
    const detalle = e.target.dataset.detalle;
    if (id) {
      state.prestamos = state.prestamos.filter((p) => p.id !== Number(id));
      refreshStorage();
      renderPrestamos();
      notifyCb('Préstamo eliminado', 'warning');
    }
    if (detalle) {
      const prestamo = state.prestamos.find((p) => p.id === Number(detalle));
      if (prestamo) renderDetallePrestamo(prestamo);
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

export function obtenerDeudaMensual() {
  return state.prestamos.reduce((acc, p) => {
    const plazo = Number(p.plazo) || 0;
    if (plazo <= 0) return acc;
    const cuota = p.cuota || calcularCuotaPMT(Number(p.monto) || 0, Number(p.tasa) || 0, plazo);
    return acc + cuota;
  }, 0);
}

export function capacidadPagoMensual() {
  return obtenerDeudaMensual();
}

function renderDetallePrestamo(prestamo) {
  const detalleCard = document.getElementById('card-detalle-prestamo');
  const tabla = document.getElementById('tabla-detalle-prestamo');
  const titulo = document.getElementById('detalle-prestamo-titulo');
  const subtitulo = document.getElementById('detalle-prestamo-subtitulo');
  const resumen = document.getElementById('detalle-prestamo-resumen');
  if (!detalleCard || !tabla) return;

  const calculo = construirAmortizacion(prestamo);
  titulo.textContent = prestamo.nombre;
  subtitulo.textContent = `Cuota mensual aproximada ${formatCurrency(calculo.cuota)} · Plazo ${prestamo.plazo} meses`;

  tabla.innerHTML = calculo.tabla
    .map(
      (r) => `
      <tr>
        <td>${r.numero}</td>
        <td>${r.fecha}</td>
        <td>${formatCurrency(r.cuota)}</td>
        <td>${formatCurrency(r.capital)}</td>
        <td>${formatCurrency(r.interes)}</td>
        <td>${formatCurrency(r.saldo)}</td>
      </tr>`
    )
    .join('');

  if (resumen) {
    resumen.innerHTML = `
      <div class="item"><div class="label">Interés total</div><div class="value">${formatCurrency(calculo.interesTotal)}</div></div>
      <div class="item"><div class="label">Capital</div><div class="value">${formatCurrency(calculo.capitalTotal)}</div></div>
      <div class="item"><div class="label">Saldo al cierre</div><div class="value">${formatCurrency(calculo.saldoRestante)}</div></div>
    `;
  }

  renderChart(calculo);
  detalleCard.style.display = 'block';
}

function renderChart(calculo) {
  const ctx = document.getElementById('chart-prestamo');
  if (!ctx) return;
  const labels = calculo.tabla.map((r) => `M${r.numero}`);
  const capital = calculo.tabla.map((r) => r.capital);
  const interes = calculo.tabla.map((r) => r.interes);
  if (chartPrestamo) {
    chartPrestamo.data.labels = labels;
    chartPrestamo.data.datasets[0].data = capital;
    chartPrestamo.data.datasets[1].data = interes;
    chartPrestamo.update();
    return;
  }
  chartPrestamo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Capital', data: capital, backgroundColor: '#7A4DFF', hoverBackgroundColor: 'rgba(122,77,255,0.9)' },
        { label: 'Interés', data: interes, backgroundColor: '#FF4F9A', hoverBackgroundColor: 'rgba(255,79,154,0.9)' }
      ]
    },
    options: { responsive: true, interaction: { mode: 'index', intersect: false } }
  });
}
