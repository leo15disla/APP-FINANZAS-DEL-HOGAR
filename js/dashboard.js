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

function animateKpi(id, value, options = {}) {
  const element = document.getElementById(id);
  if (!element) return;
  const start = kpiCache[id] ?? 0;
  const duration = 600;
  const startTime = performance.now();
  const formatter = formatCurrency;
  const diff = value - start;

  if (options.showDirection) {
    element.classList.remove('kpi-pulse-up', 'kpi-pulse-down');
    if (diff > 0) element.classList.add('kpi-pulse-up');
    if (diff < 0) element.classList.add('kpi-pulse-down');
    setTimeout(() => element.classList.remove('kpi-pulse-up', 'kpi-pulse-down'), 700);
  }

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

function calcularBalanceSemana(offsetMes = 0, offsetSemana = 0) {
  const hoy = new Date();
  hoy.setMonth(hoy.getMonth() + offsetMes);
  hoy.setDate(hoy.getDate() + offsetSemana * 7);
  const fin = new Date(hoy);
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - 6);

  const balance = state.movimientos.reduce((acc, mov) => {
    const fecha = new Date(mov.fecha);
    if (fecha >= inicio && fecha <= fin) {
      return acc + (mov.tipo === 'Ingreso' ? Number(mov.monto) || 0 : -(Number(mov.monto) || 0));
    }
    return acc;
  }, 0);

  return { balance, inicio, fin };
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

function balanceAcumulado(ingresosArr, gastosArr) {
  let acumulado = 0;
  return ingresosArr.map((ing, idx) => {
    acumulado += (ing || 0) - (gastosArr[idx] || 0);
    return acumulado;
  });
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
  const valor = document.getElementById('kpi-gastos');
  if (!tag) return;
  const ratio = ingresos > 0 ? gastos / ingresos : 0;
  tag.classList.remove('kpi-tag-alert-verde', 'kpi-tag-alert-amarillo', 'kpi-tag-alert-rojo');
  valor?.classList.remove('kpi-gasto-alertado');
  if (ratio <= 0.6) {
    tag.textContent = 'Gasto saludable (verde)';
    tag.classList.add('kpi-tag-alert-verde');
  } else if (ratio <= 0.9) {
    tag.textContent = 'Gasto moderado (amarillo)';
    tag.classList.add('kpi-tag-alert-amarillo');
  } else {
    tag.textContent = 'Gasto alto (rojo)';
    tag.classList.add('kpi-tag-alert-rojo');
    valor?.classList.add('kpi-gasto-alertado');
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

function actualizarTendenciaSemanal() {
  const elemento = document.getElementById('kpi-balance-tendencia');
  if (!elemento) return;
  const actual = calcularBalanceSemana(mesOffset, 0).balance;
  const previo = calcularBalanceSemana(mesOffset, -1).balance;

  if (!previo) {
    elemento.textContent = 'Sin datos de la semana pasada.';
    elemento.className = 'kpi-extra';
    return;
  }

  const variacion = porcentajeVariacion(actual, previo);
  if (variacion === null) {
    elemento.textContent = 'Sin datos de la semana pasada.';
    elemento.className = 'kpi-extra';
    return;
  }

  const signo = variacion >= 0 ? '+' : '';
  elemento.textContent = `Tu balance va ${signo}${variacion}% mejor que la semana pasada`;
  elemento.className = variacion >= 0 ? 'kpi-extra kpi-extra-up' : 'kpi-extra kpi-extra-down';
}

function actualizarLimites503020(ingresos, totales) {
  const texto = document.getElementById('limite-503020');
  if (!texto) return;
  if (!ingresos) {
    texto.textContent = 'Agrega ingresos para calcular tus límites 50/30/20.';
    return;
  }

  const limites = {
    Necesidad: ingresos * 0.5,
    Deseo: ingresos * 0.3,
    Ahorro: ingresos * 0.2
  };

  const partes = Object.keys(limites).map((key) => {
    const restante = (limites[key] - (totales[key] || 0)).toFixed(2);
    const prefijo = restante >= 0 ? 'Te quedan' : 'Te pasaste por';
    return `${key}: ${prefijo} ${formatCurrency(Math.abs(restante))}`;
  });

  texto.textContent = partes.join(' | ');
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
    const balanceData = balanceAcumulado(agrupado.ingresos, agrupado.gastos);
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
    const labels = ['Mes anterior', 'Mes actual'];
    const ingresosData = [ingresosPrev, ingresosActual];
    const gastosData = [gastosPrev, gastosActual];
    const balanceData = balanceAcumulado(ingresosData, gastosData);
    renderChartIngGastos(
      document.getElementById('chart-ing-gastos'),
      ingresosData,
      gastosData,
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
  const ingresosPrev = totalPorTipo(movimientosPrev, 'Ingreso');
  const gastosPrev = totalPorTipo(movimientosPrev, 'Gasto');
  const totalPrestamos = obtenerTotalPrestamos();
  const deudaMes = obtenerDeudaMensual();
  const totalCuentas = state.cuentas.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);
  const liquidez = totalCuentas - deudaMes;
  const total503 = total503020(movimientosMes);

  animateKpi('kpi-ingresos', ingresos, { showDirection: true });
  animateKpi('kpi-gastos', gastos, { showDirection: true });
  animateKpi('kpi-balance', balance, { showDirection: true });
  document.getElementById('kpi-prestamos').textContent = formatCurrency(totalPrestamos);
  animateKpi('kpi-total-cuentas', totalCuentas, { showDirection: true });
  animateKpi('kpi-liquidez', liquidez, { showDirection: true });
  document.getElementById('kpi-mes-anterior-ing').textContent = formatCurrency(ingresosPrev);
  document.getElementById('kpi-mes-anterior-gas').textContent = formatCurrency(gastosPrev);
  document.getElementById('kpi-mes-anterior-bal').textContent = formatCurrency(ingresosPrev - gastosPrev);
  document.getElementById('kpi-deuda-mes').textContent = formatCurrency(deudaMes);
  document.getElementById('kpi-deuda-texto').textContent = deudaMes
    ? `Tienes ${formatCurrency(deudaMes)} que pagar este mes.`
    : 'Sin deudas registradas para este mes.';
  const progresoDeuda = totalPrestamos ? Math.min(100, Math.round((deudaMes / totalPrestamos) * 100)) : deudaMes ? 100 : 0;
  const barraDeuda = document.getElementById('deuda-progress');
  if (barraDeuda) barraDeuda.style.width = `${progresoDeuda}%`;

  actualizarComparacion('kpi-ingresos-variacion', ingresos, ingresosPrev);
  actualizarComparacion('kpi-gastos-variacion', gastos, gastosPrev);
  actualizarAlertaGastos(ingresos, gastos);
  actualizarSemaforoBalance(balance, ingresos);
  actualizarTendenciaSemanal();
  actualizarLimites503020(ingresos, total503);

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
