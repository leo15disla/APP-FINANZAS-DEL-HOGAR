import { state, formatCurrency } from './utils.js';
import { obtenerMovimientosDelMes } from './movimientos.js';
import { obtenerTotalPrestamos, obtenerDeudaMensual } from './prestamos.js';

let chart503020;
let chartIngGastos;
let kpiCache = {};
let chartModo = 'mes';
let mesOffset = 0;
let resizeObservers = [];

function totalPorTipo(movs, tipo) {
  return movs
    .filter((m) => m.tipo === tipo)
    .reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
}

function total503020(movs) {
  return movs.reduce(
    (acc, m) => {
      acc[m.tipo503020] = (acc[m.tipo503020] || 0) + (Number(m.monto) || 0);
      return acc;
    },
    { Necesidad: 0, Deseo: 0, Ahorro: 0 }
  );
}

function animateKpi(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  const start = kpiCache[id] ?? 0;
  const duration = 600;
  const startTime = performance.now();
  const formatter = formatCurrency;

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const current = start + (value - start) * progress;
    element.textContent = formatter(current);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      kpiCache[id] = value;
    }
  }
  requestAnimationFrame(step);
}

function renderChart503020(ctx, data) {
  const values = [data.Necesidad || 0, data.Deseo || 0, data.Ahorro || 0];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const porcentajes = values.map((v) => Math.round((v / total) * 100));
  document.getElementById('texto-503020').textContent = `50/30/20 actual: ${porcentajes[0]}% / ${porcentajes[1]}% / ${porcentajes[2]}%`;

  if (chart503020) {
    chart503020.data.datasets[0].data = values;
    chart503020.update();
    return;
  }
  chart503020 = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Necesidad', 'Deseo', 'Ahorro'],
      datasets: [
        {
          data: values,
          backgroundColor: ['#0ea5e9', '#f97316', '#22c55e']
        }
      ]
    },
    options: {
      responsive: true,
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 900,
        easing: 'easeOutQuad'
      }
    }
  });
  attachResize(ctx, chart503020);
}

function agruparPorSemana(movs) {
  const ingresos = [0, 0, 0, 0, 0];
  const gastos = [0, 0, 0, 0, 0];
  movs.forEach((m) => {
    const fecha = new Date(m.fecha);
    const indice = Math.min(Math.floor((fecha.getDate() - 1) / 7), 4);
    if (m.tipo === 'Ingreso') ingresos[indice] += Number(m.monto) || 0;
    if (m.tipo === 'Gasto') gastos[indice] += Number(m.monto) || 0;
  });
  const labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];
  return { labels, ingresos, gastos };
}

function renderChartIngGastos(ctx, ingresosData, gastosData, labels, balanceData) {
  if (chartIngGastos) {
    chartIngGastos.data.labels = labels;
    chartIngGastos.data.datasets[0].data = ingresosData;
    chartIngGastos.data.datasets[1].data = gastosData;
    chartIngGastos.data.datasets[2].data = balanceData;
    chartIngGastos.update();
    return;
  }
  chartIngGastos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Ingresos', data: ingresosData, backgroundColor: '#22c55e' },
        { label: 'Gastos', data: gastosData, backgroundColor: '#ef4444' },
        {
          label: 'Balance acumulado',
          data: balanceData,
          type: 'line',
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          tension: 0.35,
          fill: false,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { beginAtZero: true }
      },
      animation: { duration: 650, easing: 'easeOutQuad' }
    }
  });
  attachResize(ctx, chartIngGastos);
}

function attachResize(canvas, chart) {
  if (!canvas) return;
  const observer = new ResizeObserver(() => chart?.resize());
  observer.observe(canvas.parentElement);
  resizeObservers.push(observer);
}

function porcentajeVariacion(actual, anterior) {
  if (!anterior) return null;
  return (((actual - anterior) / anterior) * 100).toFixed(1);
}

function actualizarComparacion(elementId, actual, anterior) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const variacion = porcentajeVariacion(actual, anterior);
  if (variacion === null) {
    element.textContent = 'Sin datos del mes anterior';
    element.className = 'kpi-extra';
    return;
  }
  const signo = variacion >= 0 ? '+' : '';
  element.textContent = `${signo}${variacion}% vs mes anterior`;
  element.className = variacion >= 0 ? 'kpi-extra kpi-extra-up' : 'kpi-extra kpi-extra-down';
}

function actualizarAlertaGastos(ingresos, gastos) {
  const tag = document.getElementById('kpi-gastos-alerta');
  if (!tag) return;
  const ratio = ingresos > 0 ? gastos / ingresos : 0;
  tag.classList.remove('kpi-tag-alert-verde', 'kpi-tag-alert-amarillo', 'kpi-tag-alert-rojo');
  if (ratio <= 0.6) {
    tag.textContent = 'Gasto saludable (verde)';
    tag.classList.add('kpi-tag-alert-verde');
  } else if (ratio <= 0.9) {
    tag.textContent = 'Gasto moderado (amarillo)';
    tag.classList.add('kpi-tag-alert-amarillo');
  } else {
    tag.textContent = 'Gasto alto (rojo)';
    tag.classList.add('kpi-tag-alert-rojo');
  }
}

function actualizarSemaforoBalance(balance, ingresos) {
  const badge = document.getElementById('kpi-estado');
  if (!badge) return;
  badge.classList.remove('estado-verde', 'estado-amarillo', 'estado-rojo');
  if (balance > ingresos * 0.05) {
    badge.textContent = 'Positivo';
    badge.classList.add('estado-verde');
  } else if (balance < ingresos * -0.05) {
    badge.textContent = 'Negativo';
    badge.classList.add('estado-rojo');
  } else {
    badge.textContent = 'En equilibrio';
    badge.classList.add('estado-amarillo');
  }
}

function actualizarMesBadge(offset) {
  const badge = document.getElementById('dashboard-mes');
  const hoy = new Date();
  hoy.setMonth(hoy.getMonth() + offset);
  badge.textContent = hoy.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
  badge.setAttribute('data-offset', offset);
}

function buildChartData(movimientosActual, movimientosAnterior) {
  if (chartModo === 'semana') {
    const agrupado = agruparPorSemana(movimientosActual);
    const balanceData = agrupado.ingresos.map((ing, idx) => ing - agrupado.gastos[idx]);
    renderChartIngGastos(
      document.getElementById('chart-ing-gastos'),
      agrupado.ingresos,
      agrupado.gastos,
      agrupado.labels,
      balanceData
    );
  } else {
    const ingresosActual = totalPorTipo(movimientosActual, 'Ingreso');
    const gastosActual = totalPorTipo(movimientosActual, 'Gasto');
    const ingresosPrev = totalPorTipo(movimientosAnterior, 'Ingreso');
    const gastosPrev = totalPorTipo(movimientosAnterior, 'Gasto');
    const labels = ['Mes actual', 'Mes anterior'];
    const balanceData = [ingresosActual - gastosActual, ingresosPrev - gastosPrev];
    renderChartIngGastos(
      document.getElementById('chart-ing-gastos'),
      [ingresosActual, ingresosPrev],
      [gastosActual, gastosPrev],
      labels,
      balanceData
    );
  }
}

export function refreshDashboard() {
  const movimientosMes = obtenerMovimientosDelMes(mesOffset);
  const movimientosPrev = obtenerMovimientosDelMes(mesOffset - 1);
  const ingresos = totalPorTipo(movimientosMes, 'Ingreso');
  const gastos = totalPorTipo(movimientosMes, 'Gasto');
  const balance = ingresos - gastos;
  const totalPrestamos = obtenerTotalPrestamos();
  const deudaMes = obtenerDeudaMensual();
  const totalCuentas = state.cuentas.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);
  const liquidez = totalCuentas - deudaMes;
  const total503 = total503020(movimientosMes);

  animateKpi('kpi-ingresos', ingresos);
  animateKpi('kpi-gastos', gastos);
  animateKpi('kpi-balance', balance);
  document.getElementById('kpi-prestamos').textContent = formatCurrency(totalPrestamos);
  document.getElementById('kpi-total-cuentas').textContent = formatCurrency(totalCuentas);
  document.getElementById('kpi-liquidez').textContent = formatCurrency(liquidez);
  document.getElementById('kpi-deuda-mes').textContent = formatCurrency(deudaMes);
  document.getElementById('kpi-deuda-texto').textContent = deudaMes
    ? `Tienes ${formatCurrency(deudaMes)} que pagar este mes.`
    : 'Sin deudas registradas para este mes.';

  actualizarComparacion('kpi-ingresos-variacion', ingresos, totalPorTipo(movimientosPrev, 'Ingreso'));
  actualizarComparacion('kpi-gastos-variacion', gastos, totalPorTipo(movimientosPrev, 'Gasto'));
  actualizarComparacion('kpi-balance-tendencia', balance, totalPorTipo(movimientosPrev, 'Ingreso') - totalPorTipo(movimientosPrev, 'Gasto'));
  actualizarAlertaGastos(ingresos, gastos);
  actualizarSemaforoBalance(balance, ingresos);

  renderChart503020(document.getElementById('chart-503020'), total503);
  buildChartData(movimientosMes, movimientosPrev);
}

export function initDashboard() {
  const toggleMes = document.getElementById('btn-resumen-anterior');
  const chartToggles = document.querySelectorAll('.chart-toggle-btn');

  toggleMes.addEventListener('click', () => {
    mesOffset = mesOffset === 0 ? -1 : 0;
    toggleMes.textContent = mesOffset === 0 ? 'Ver resumen del mes anterior' : 'Volver al mes actual';
    actualizarMesBadge(mesOffset);
    refreshDashboard();
  });

  chartToggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      chartToggles.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      chartModo = btn.dataset.modo;
      refreshDashboard();
    });
  });

  actualizarMesBadge(mesOffset);
  refreshDashboard();
}
