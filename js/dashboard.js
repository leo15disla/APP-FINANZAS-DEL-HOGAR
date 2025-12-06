

import { state, formatCurrency } from './utils.js';
import { obtenerMovimientosDelMes } from './movimientos.js';
import { obtenerTotalPrestamos } from './prestamos.js';

let chart503020;
let chartIngGastos;

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

function renderChart503020(ctx, data) {
  const values = [data.Necesidad || 0, data.Deseo || 0, data.Ahorro || 0];
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
    options: { responsive: true }
  });
}

function renderChartIngGastos(ctx, ingresos, gastos) {
  const labels = ['Mes actual'];
  const ingresosData = [ingresos];
  const gastosData = [gastos];
  if (chartIngGastos) {
    chartIngGastos.data.labels = labels;
    chartIngGastos.data.datasets[0].data = ingresosData;
    chartIngGastos.data.datasets[1].data = gastosData;
    chartIngGastos.update();
    return;
  }
  chartIngGastos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Ingresos', data: ingresosData, backgroundColor: '#22c55e' },
        { label: 'Gastos', data: gastosData, backgroundColor: '#ef4444' }
      ]
    },
    options: { responsive: true }
  });
}

export function refreshDashboard() {
  const movimientosMes = obtenerMovimientosDelMes();
  const ingresos = totalPorTipo(movimientosMes, 'Ingreso');
  const gastos = totalPorTipo(movimientosMes, 'Gasto');
  const balance = ingresos - gastos;
  const totalPrestamos = obtenerTotalPrestamos();
  const totalCuentas = state.cuentas.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);
  const total503 = total503020(movimientosMes);

  document.getElementById('kpi-ingresos').textContent = formatCurrency(ingresos);
  document.getElementById('kpi-gastos').textContent = formatCurrency(gastos);
  document.getElementById('kpi-balance').textContent = formatCurrency(balance);
  document.getElementById('kpi-prestamos').textContent = formatCurrency(totalPrestamos);
  document.getElementById('kpi-total-cuentas').textContent = formatCurrency(totalCuentas);
  document.getElementById('kpi-liquidez').textContent = formatCurrency(balance - totalPrestamos);

  renderChart503020(document.getElementById('chart-503020'), total503);
  renderChartIngGastos(document.getElementById('chart-ing-gastos'), ingresos, gastos);
}

export function initDashboard() {
  const mes = new Date();
  const badge = document.getElementById('dashboard-mes');
  badge.textContent = mes.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
  refreshDashboard();
}
