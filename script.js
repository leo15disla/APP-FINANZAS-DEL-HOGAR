/* ============================
      VARIABLES GLOBALES
============================ */
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let historial = JSON.parse(localStorage.getItem("historial")) || {};
let presupuesto = JSON.parse(localStorage.getItem("presupuesto")) || {
  necesidad: 0, deseo: 0, ahorro: 0
};
let prestamos = JSON.parse(localStorage.getItem("prestamos")) || [];
let cuentas = JSON.parse(localStorage.getItem("cuentas")) || [];

/* Para animaciones y modo de gráfico */
let ultimoIngresos = 0;
let ultimoGastos = 0;
let ultimoBalance = 0;
let chart503020, chartIngGastos;
let modoGraficoIngGastos = "mes";

/* Si no hay cuentas, crear una de ejemplo (efectivo) solo la primera vez */
if (cuentas.length === 0) {
  cuentas = [
    {
      id: Date.now(),
      nombre: "Efectivo",
      tipo: "Efectivo",
      numero: "----",
      saldo: 0,
      color: "#0f172a",
      nota: "Dinero físico disponible.",
      diaCorte: "",
      diaPago: ""
    }
  ];
  localStorage.setItem("cuentas", JSON.stringify(cuentas));
}

/* ============================
      FUNCIÓN: FORMATEAR RD$
============================ */
function formatoRD(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return "RD$ 0.00";
  return "RD$ " + Number(valor).toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* FORMATEAR MIENTRAS ESCRIBE (Monto de movimientos) */
const inputMonto = document.getElementById("monto");
inputMonto.addEventListener("input", () => {
  let val = inputMonto.value.replace(/[^0-9]/g, ""); 
  if (!val) {
    inputMonto.value = "";
    return;
  }
  inputMonto.value = Number(val).toLocaleString("es-DO");
});

/* AL GUARDAR → convertir a número real sin comas */
function limpiarMonto(valor) {
  if (!valor) return 0;
  return Number(valor.replace(/\./g, "").replace(/,/g, ""));
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    const notificacion = document.getElementById('notificacion');
    notificacion.textContent = mensaje;
    notificacion.style.backgroundColor = tipo === 'success' ? '#4CAF50' : '#f44336';
    notificacion.style.display = 'block';

    setTimeout(() => {
        notificacion.style.display = 'none';
    }, 3000);
}

/* ============================
      REINICIO AUTOMÁTICO DEL MES
============================ */
function verificarCambioMes() {
  const hoy = new Date();
  const mesActual = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0");

  let ultimoMesGuardado = localStorage.getItem("mesActual");

  if (!ultimoMesGuardado) {
    localStorage.setItem("mesActual", mesActual);
    return;
  }

  if (ultimoMesGuardado !== mesActual) {
    historial[ultimoMesGuardado] = movimientos;
    localStorage.setItem("historial", JSON.stringify(historial));

    movimientos = [];
    localStorage.setItem("movimientos", JSON.stringify(movimientos));

    localStorage.setItem("mesActual", mesActual);
  }
}
verificarCambioMes();

/* ============================
      NAVEGACIÓN ENTRE PESTAÑAS
============================ */
const secciones = {
  dashboard: document.getElementById("seccion-dashboard"),
  registrar: document.getElementById("seccion-registrar"),
  movimientos: document.getElementById("seccion-movimientos"),
  cuentas: document.getElementById("seccion-cuentas"),
  prestamos: document.getElementById("seccion-prestamos"),
  calendario: document.getElementById("seccion-calendario"),
  presupuesto: document.getElementById("seccion-presupuesto"),
  exportar: document.getElementById("seccion-exportar")
};

const botones = {
  dashboard: document.getElementById("btnDashboard"),
  registrar: document.getElementById("btnRegistrar"),
  movimientos: document.getElementById("btnMovimientos"),
  cuentas: document.getElementById("btnCuentas"),
  prestamos: document.getElementById("btnPrestamos"),
  calendario: document.getElementById("btnCalendario"),
  presupuesto: document.getElementById("btnPresupuesto"),
  exportar: document.getElementById("btnExportar")
};

function mostrarSeccion(nombre) {
  Object.values(secciones).forEach(s => s.classList.add("hidden"));
  Object.values(botones).forEach(b => b.classList.remove("active"));

  secciones[nombre].classList.remove("hidden");
  botones[nombre].classList.add("active");
}

botones.dashboard.onclick = () => mostrarSeccion("dashboard");
botones.registrar.onclick = () => mostrarSeccion("registrar");
botones.movimientos.onclick = () => mostrarSeccion("movimientos");
botones.cuentas.onclick = () => mostrarSeccion("cuentas");
botones.prestamos.onclick = () => mostrarSeccion("prestamos");
botones.calendario.onclick = () => mostrarSeccion("calendario");
botones.presupuesto.onclick = () => mostrarSeccion("presupuesto");
botones.exportar.onclick = () => mostrarSeccion("exportar");

mostrarSeccion("dashboard");

/* ============================
      AYUDAS CUENTAS ←→ MOVIMIENTOS
============================ */
function obtenerNombreCuenta(cuentaId) {
  if (!cuentaId) return "-";
  const c = cuentas.find(c => String(c.id) === String(cuentaId));
  return c ? c.nombre : "-";
}

function aplicarMovimientoEnCuenta(mov, modo) {
  // modo: +1 = aplicar, -1 = revertir
  if (!mov || !mov.cuentaId) return;
  const cuenta = cuentas.find(c => String(c.id) === String(mov.cuentaId));
  if (!cuenta) return;

  const factor = modo === -1 ? -1 : 1;
  const monto = Number(mov.monto) || 0;
  const saldoActual = Number(cuenta.saldo) || 0;

  if (mov.tipo === "Ingreso") {
    cuenta.saldo = saldoActual + factor * monto;
  } else if (mov.tipo === "Gasto") {
    cuenta.saldo = saldoActual - factor * monto;
  }

  guardarCuentasLS();
  renderCuentas();
  actualizarCalendario();
}

/* ============================
      REGISTRAR MOVIMIENTO
============================ */
document.getElementById("fecha").value = new Date().toISOString().slice(0,10);

document.getElementById("form-mov").addEventListener("submit", e => {
  e.preventDefault();

  const cuentaIdSeleccionada = document.getElementById("mov-cuenta").value;

  const mov = {
    id: Date.now(),
    tipo: document.getElementById("tipo").value,
    fecha: document.getElementById("fecha").value,
    monto: limpiarMonto(document.getElementById("monto").value),
    categoria: document.getElementById("categoria").value,
    tipo503020: document.getElementById("tipo503020").value,
    nota: document.getElementById("nota").value,
    cuentaId: cuentaIdSeleccionada ? Number(cuentaIdSeleccionada) : null
  };

  movimientos.push(mov);

  // Aplicar efecto en la cuenta seleccionada
  aplicarMovimientoEnCuenta(mov, +1);

  localStorage.setItem("movimientos", JSON.stringify(movimientos));

  mostrarMovimientos();
  actualizarDashboard();

  document.getElementById("form-mov").reset();
  document.getElementById("fecha").value = new Date().toISOString().slice(0,10);
  mostrarNotificacion("Movimiento guardado con éxito");
});

/* ============================
      MOSTRAR MOVIMIENTOS (con BUSCADOR + FILTROS)
============================ */
function mostrarMovimientos() {
  const tabla = document.getElementById("tabla-actual");
  const resumen = document.getElementById("resumen-mov");

  const termino = (document.getElementById("buscar").value || "").toLowerCase().trim();
  const filtroTipo = document.getElementById("filtro-tipo").value;
  const filtro503020 = document.getElementById("filtro503020").value;

  let lista = movimientos.slice(); // copia

  lista = lista.filter(m => {
    if (filtroTipo !== "Todos" && m.tipo !== filtroTipo) return false;
    if (filtro503020 !== "Todos" && m.tipo503020 !== filtro503020) return false;

    if (termino) {
      const texto = `${m.fecha} ${m.tipo} ${m.monto} ${m.categoria} ${obtenerNombreCuenta(m.cuentaId)} ${m.tipo503020} ${m.nota || ""}`.toLowerCase();
      if (!texto.includes(termino)) return false;
    }
    return true;
  });

  // Ordenar por fecha descendente
  lista.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  tabla.innerHTML = "";

  let totalIng = 0;
  let totalGas = 0;

  lista.forEach(m => {
    if (m.tipo === "Ingreso") totalIng += m.monto;
    if (m.tipo === "Gasto") totalGas += m.monto;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.fecha}</td>
      <td>${m.tipo}</td>
      <td>${formatoRD(m.monto)}</td>
      <td>${m.categoria}</td>
      <td>${obtenerNombreCuenta(m.cuentaId)}</td>
      <td>${m.tipo503020}</td>
      <td>${m.nota || ""}</td>
      <td><button class="btn-small btn-edit" onclick="editar(${m.id})">Editar</button></td>
      <td><button class="btn-small btn-delete" onclick="eliminar(${m.id})">Eliminar</button></td>
    `;
    tabla.appendChild(tr);
  });

  if (resumen) {
    const cant = lista.length;
    resumen.textContent = `${cant} movimiento${cant === 1 ? "" : "s"} • Ingresos filtrados: ${formatoRD(totalIng)} • Gastos filtrados: ${formatoRD(totalGas)}`;
  }
}

/* Eventos para búsqueda y filtros */
document.getElementById("buscar").addEventListener("input", mostrarMovimientos);
document.getElementById("filtro-tipo").addEventListener("change", mostrarMovimientos);
document.getElementById("filtro503020").addEventListener("change", mostrarMovimientos);

/* ============================
      EDITAR MOVIMIENTO
============================ */
function editar(id) {
  const mov = movimientos.find(x => x.id === id);
  if (!mov) return;

  document.getElementById("tipo").value = mov.tipo;
  document.getElementById("fecha").value = mov.fecha;
  document.getElementById("monto").value = mov.monto;
  document.getElementById("categoria").value = mov.categoria;
  document.getElementById("tipo503020").value = mov.tipo503020;
  document.getElementById("nota").value = mov.nota;

  const selCuenta = document.getElementById("mov-cuenta");
  if (selCuenta) {
    selCuenta.value = mov.cuentaId ? String(mov.cuentaId) : "";
  }

  // Eliminar el movimiento original (también revierte su efecto en la cuenta)
  eliminar(id);
  mostrarSeccion("registrar");
}

/* ============================
      ELIMINAR MOVIMIENTO
============================ */
function eliminar(id) {
  const mov = movimientos.find(m => m.id === id);
  if (!mov) return;

  // Revertir efecto en cuenta antes de eliminar
  aplicarMovimientoEnCuenta(mov, -1);

  movimientos = movimientos.filter(m => m.id !== id);
  localStorage.setItem("movimientos", JSON.stringify(movimientos));
  mostrarMovimientos();
  actualizarDashboard();
}

/* ============================
      CARGAR CATEGORÍAS
============================ */
const categorias = [
  "Alimentos", "Transporte", "Luz", "Agua", "Internet", "Renta",
  "Salud", "Educación", "Entretenimiento", "Otros"
];

function cargarCategorias() {
  const select = document.getElementById("categoria");
  categorias.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
}
cargarCategorias();

/* ============================
      RESUMEN MES ANTERIOR
============================ */
function obtenerClaveMesAnterior() {
  const hoy = new Date();
  let anio = hoy.getFullYear();
  let mes = hoy.getMonth(); // 0-11 actual
  mes -= 1;
  if (mes < 0) {
    mes = 11;
    anio -= 1;
  }
  return anio + "-" + String(mes + 1).padStart(2, "0");
}

function obtenerResumenMesAnterior() {
  const clave = obtenerClaveMesAnterior();
  const lista = historial[clave] || [];
  const ingresos = lista.filter(m => m.tipo === "Ingreso").reduce((a,b)=>a+b.monto, 0);
  const gastos = lista.filter(m => m.tipo === "Gasto").reduce((a,b)=>a+b.monto, 0);
  const balance = ingresos - gastos;
  return {
    clave,
    ingresosMesAnterior: ingresos,
    gastosMesAnterior: gastos,
    balanceMesAnterior: balance
  };
}

/* ============================
      TENDENCIA SEMANAL BALANCE
============================ */
function calcularTendenciaSemanal() {
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const msDia = 24 * 60 * 60 * 1000;
  const hace7 = new Date(hoy.getTime() - 7 * msDia);
  const hace14 = new Date(hoy.getTime() - 14 * msDia);

  let balAct = 0;
  let balAnt = 0;

  movimientos.forEach(m => {
    if (!m.fecha) return;
    const d = new Date(m.fecha + "T00:00:00");
    if (isNaN(d)) return;

    if (d > hace7 && d <= hoy) {
      if (m.tipo === "Ingreso") balAct += m.monto;
      else if (m.tipo === "Gasto") balAct -= m.monto;
    } else if (d > hace14 && d <= hace7) {
      if (m.tipo === "Ingreso") balAnt += m.monto;
      else if (m.tipo === "Gasto") balAnt -= m.monto;
    }
  });

  return {
    balanceSemanaActual: balAct,
    balanceSemanaAnterior: balAnt
  };
}

/* ============================
      DEUDA DEL MES ACTUAL
============================ */
function calcularDeudaDelMesActual() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth(); // 0-11
  let total = 0;

  prestamos.forEach(p => {
    if (Array.isArray(p.cuotas)) {
      p.cuotas.forEach(c => {
        const d = new Date(c.fecha);
        if (!isNaN(d) && d.getFullYear() === anio && d.getMonth() === mes) {
          total += c.cuota;
        }
      });
    }
  });

  return total;
}

/* ============================
      GRÁFICO INGRESOS vs GASTOS (Mes / Semanas)
============================ */
function obtenerDatosIngresosGastosPorSemana() {
  const semanas = ["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5"];
  const ingresosSem = [0,0,0,0,0];
  const gastosSem = [0,0,0,0,0];

  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();

  movimientos.forEach(m => {
    if (!m.fecha) return;
    const d = new Date(m.fecha + "T00:00:00");
    if (isNaN(d)) return;
    if (d.getFullYear() === anio && d.getMonth() === mes) {
      const dia = d.getDate();
      const idx = Math.min(4, Math.floor((dia - 1) / 7));
      if (m.tipo === "Ingreso") ingresosSem[idx] += m.monto;
      else if (m.tipo === "Gasto") gastosSem[idx] += m.monto;
    }
  });

  const balanceSem = ingresosSem.map((v, i) => v - gastosSem[i]);
  return { etiquetas: semanas, ingresosSem, gastosSem, balanceSem };
}

function actualizarGraficoIngGastos(ingresosTotales, gastosTotales) {
  const canvas = document.getElementById("chart-ing-gastos");
  if (!canvas) return;
  const ctx2 = canvas.getContext("2d");

  if (chartIngGastos) chartIngGastos.destroy();

  let labels, dataIngresos, dataGastos, dataBalance;

  if (modoGraficoIngGastos === "semana") {
    const datos = obtenerDatosIngresosGastosPorSemana();
    labels = datos.etiquetas;
    dataIngresos = datos.ingresosSem;
    dataGastos = datos.gastosSem;
    dataBalance = datos.balanceSem;
  } else {
    labels = ["Mes actual"];
    dataIngresos = [ingresosTotales];
    dataGastos = [gastosTotales];
    dataBalance = [ingresosTotales - gastosTotales];
  }

  chartIngGastos = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Ingresos",
          data: dataIngresos,
          backgroundColor: "#e06a7b"
        },
        {
          label: "Gastos",
          data: dataGastos,
          backgroundColor: "#4b5563"
        },
        {
          label: "Balance",
          data: dataBalance,
          backgroundColor: "#a855f7"
        }
      ]
    },
    options: {
      animation: {
        duration: 800,
        easing: "easeOutQuad"
      },
      responsive: true,
      scales: {
        x: { beginAtZero: true },
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: true }
      }
    }
  });
}

/* ============================
      DASHBOARD
============================ */
function actualizarDashboard() {
  /* === DATOS DEL MES ACTUAL === */
  const ingresos = movimientos.filter(m => m.tipo === "Ingreso")
    .reduce((a, b) => a + b.monto, 0);

  const gastos = movimientos.filter(m => m.tipo === "Gasto")
    .reduce((a, b) => a + b.monto, 0);

  const balance = ingresos - gastos;

  /* === MOSTRAR KPIs BÁSICOS === */
  const kpiIng = document.getElementById("kpi-ingresos");
  const kpiGas = document.getElementById("kpi-gastos");
  const kpiBal = document.getElementById("kpi-balance");
  const kpiEstado = document.getElementById("kpi-estado");

  /* ============================================================
        1️⃣ MINI-ANIMACIÓN CUANDO INGRESOS/GASTOS SUBEN O BAJAN
     ============================================================ */

  function animarCambio(elemento, nuevoValor) {
    if (!elemento) return;
    const viejoValor = parseFloat(elemento.dataset.valor || "0");

    elemento.innerText = formatoRD(nuevoValor);
    elemento.dataset.valor = nuevoValor;

    if (viejoValor !== nuevoValor) {
      elemento.classList.add("kpi-anim");
      setTimeout(() => elemento.classList.remove("kpi-anim"), 500);
    }
  }

  animarCambio(kpiIng, ingresos);
  animarCambio(kpiGas, gastos);
  animarCambio(kpiBal, balance);

  /* ============================================================
        2️⃣ COMPARACIÓN INGRESOS/GASTOS CON EL MES PASADO
     ============================================================ */
  const { clave: mesAnteriorKey, ingresosMesAnterior, gastosMesAnterior } = obtenerResumenMesAnterior();
  
  const kpiIngresosVar = document.getElementById("kpi-ingresos-variacion");
  if (ingresosMesAnterior > 0) {
      const variacion = ((ingresos - ingresosMesAnterior) / ingresosMesAnterior) * 100;
      kpiIngresosVar.textContent = `${variacion >= 0 ? '▲' : '▼'} ${variacion.toFixed(1)}% vs mes anterior`;
  } else {
      kpiIngresosVar.textContent = "Sin datos del mes anterior";
  }

  const kpiGastosAlerta = document.getElementById("kpi-gastos-alerta");
  const presupuestoNecesidad = presupuesto.necesidad || 0;
  if (presupuestoNecesidad > 0 && gastos > presupuestoNecesidad) {
    kpiGastosAlerta.textContent = "⚠️ Gastos por encima de lo presupuestado";
    kpiGastosAlerta.style.color = "#ef4444";
  } else {
    kpiGastosAlerta.textContent = "Gastos bajo control";
    kpiGastosAlerta.style.color = "";
  }

  /* ============================================================
        3️⃣ TENDENCIA SEMANAL DEL BALANCE
     ============================================================ */
  const { balanceSemanaActual, balanceSemanaAnterior } = calcularTendenciaSemanal();

  const tendencia = balanceSemanaAnterior
    ? ((balanceSemanaActual - balanceSemanaAnterior) / (Math.abs(balanceSemanaAnterior) || 1) * 100)
    : (balanceSemanaActual > 0 ? 100 : 0);

  let tendenciaTexto = "Sin datos suficientes para comparar la semana.";
  if (balanceSemanaAnterior !== 0 || balanceSemanaActual !== 0) {
      tendenciaTexto = tendencia >= 0
        ? `📈 Tu balance va ${tendencia.toFixed(1)}% mejor que la semana pasada`
        : `📉 Tu balance va ${Math.abs(tendencia).toFixed(1)}% peor que la semana pasada`;
  }
  
  const kpiBalanceTendencia = document.getElementById("kpi-balance-tendencia");
  if(kpiBalanceTendencia) kpiBalanceTendencia.innerText = tendenciaTexto;

  /* ============================================================
        4️⃣ SEMÁFORO DEL ESTADO DEL BALANCE
     ============================================================ */
  if (kpiEstado) {
      kpiEstado.classList.remove("estado-verde", "estado-amarillo", "estado-rojo");
      if (balance > 0) {
        kpiEstado.innerHTML = `Positivo`;
        kpiEstado.classList.add("estado-verde");
      } else if (balance === 0) {
        kpiEstado.innerHTML = `Equilibrado`;
        kpiEstado.classList.add("estado-amarillo");
      } else {
        kpiEstado.innerHTML = `Negativo`;
        kpiEstado.classList.add("estado-rojo");
      }
  }

  /* ============================================================
        5️⃣ KPIs ADICIONALES (RESTAURADOS)
     ============================================================ */
  const capitalPrestamos = prestamos.reduce((total, p) => total + p.monto, 0);
  document.getElementById("kpi-prestamos").textContent = formatoRD(capitalPrestamos);

  const totalCuentas = cuentas.reduce((total, c) => total + (c.saldo || 0), 0);
  document.getElementById("kpi-total-cuentas").textContent = formatoRD(totalCuentas);

  const deudaMes = calcularDeudaDelMesActual();
  document.getElementById("kpi-deuda-mes").textContent = formatoRD(deudaMes);

  const liquidez = ingresos - gastos - deudaMes;
  document.getElementById("kpi-liquidez").textContent = formatoRD(liquidez);

  /* ============================================================
        Gráficos (se mantienen igual)
     ============================================================ */
    const necesidad = movimientos.filter(m => m.tipo503020 === "Necesidad")
                                 .reduce((a,b) => a + b.monto, 0);
  
    const deseo = movimientos.filter(m => m.tipo503020 === "Deseo")
                             .reduce((a,b) => a + b.monto, 0);
  
    const ahorro = movimientos.filter(m => m.tipo503020 === "Ahorro")
                              .reduce((a,b) => a + b.monto, 0);
  
    const ctx1El = document.getElementById("chart-503020");
    if (ctx1El) {
      const ctx1 = ctx1El.getContext("2d");
      if (chart503020) chart503020.destroy();
  
      chart503020 = new Chart(ctx1, {
        type: "pie",
        data: {
          labels: ["Necesidad", "Deseo", "Ahorro"],
          datasets: [{
            data: [necesidad, deseo, ahorro],
            backgroundColor: ["#e06a7b", "#ffb3c2", "#ffd7df"]
          }]
        },
        options: {
          animation: {
            duration: 800,
            easing: "easeOutQuad"
          },
          plugins: {
            legend: { position: "bottom" }
          }
        }
      });
    }
  
    const texto503020 = document.getElementById("texto-503020");
    if (texto503020) {
      const totPresu = (presupuesto.necesidad || 0) + (presupuesto.deseo || 0) + (presupuesto.ahorro || 0);
      if (totPresu === 0) {
        texto503020.textContent = "Configura tu presupuesto en la pestaña Presupuesto para ver cuánto te falta en cada parte.";
      } else {
        const partes = [];
        function frase(nombre, gastado, limite) {
          if (!limite || limite <= 0) return null;
          const diff = limite - gastado;
          if (diff > 0) return `Te faltan ${formatoRD(diff)} en ${nombre}.`;
          if (diff < 0) return `Te has pasado ${formatoRD(Math.abs(diff))} en ${nombre}.`;
          return `${nombre}: justo en el límite.`;
        }
        const f1 = frase("Necesidades", necesidad, presupuesto.necesidad);
        const f2 = frase("Deseos", deseo, presupuesto.deseo);
        const f3 = frase("Ahorro", ahorro, presupuesto.ahorro);
        [f1, f2, f3].forEach(f => { if (f) partes.push(f); });
        texto503020.textContent = partes.join(" ");
      }
    }
  
    actualizarGraficoIngGastos(ingresos, gastos);
}

actualizarDashboard();
mostrarMovimientos();

/* Botón "Ver resumen del mes anterior" */
const btnResumenAnterior = document.getElementById("btn-resumen-anterior");
if (btnResumenAnterior) {
  btnResumenAnterior.addEventListener("click", () => {
    const { clave, ingresosMesAnterior, gastosMesAnterior, balanceMesAnterior } = obtenerResumenMesAnterior();
    if (!historial[clave] || historial[clave].length === 0) {
      mostrarNotificacion("No hay datos guardados del mes anterior todavía.", "error");
      return;
    }
    const mensaje =
      "Resumen de " + clave + "\n\n" +
      "Ingresos: " + formatoRD(ingresosMesAnterior) + "\n" +
      "Gastos: " + formatoRD(gastosMesAnterior) + "\n" +
      "Balance: " + formatoRD(balanceMesAnterior);
    mostrarNotificacion(mensaje);
  });
}

/* Toggle de gráfico Mes / Semanas */
document.querySelectorAll(".chart-toggle-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chart-toggle-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    modoGraficoIngGastos = btn.dataset.modo || "mes";
    actualizarDashboard();
  });
});

/* ============================
      SUBTABS (Movimientos / Historial)
============================ */
document.querySelectorAll(".subtab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".subtab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".subtab-content").forEach(c => c.classList.remove("active"));
    document.getElementById("subtab-" + btn.dataset.subtab).classList.add("active");

    if (btn.dataset.subtab === "historial") {
      cargarHistorialMeses();
    } else {
      mostrarMovimientos();
    }
  });
});

/* ============================
      HISTORIAL MENSUAL
============================ */
function cargarHistorialMeses() {
  const select = document.getElementById("historial-meses");
  select.innerHTML = "";

  const claves = Object.keys(historial).sort().reverse(); 

  claves.forEach(mes => {
    const opt = document.createElement("option");
    opt.value = mes;
    opt.textContent = mes;
    select.appendChild(opt);
  });

  if (claves.length > 0) {
    mostrarHistorial(claves[0]);
  }

  select.onchange = () => mostrarHistorial(select.value);
}

function mostrarHistorial(mes) {
  const tabla = document.getElementById("tabla-historial");
  tabla.innerHTML = "";

  if (!historial[mes]) return;

  historial[mes].forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.fecha}</td>
      <td>${m.tipo}</td>
      <td>${formatoRD(m.monto)}</td>
      <td>${m.categoria}</td>
      <td>${m.tipo503020}</td>
      <td>${m.nota || ""}</td>
    `;
    tabla.appendChild(tr);
  });
}

/* ============================
      PRESUPUESTO
============================ */
document.getElementById("btn-presu").addEventListener("click", () => {
  presupuesto.necesidad = Number(document.getElementById("presu-nec").value) || 0;
  presupuesto.deseo = Number(document.getElementById("presu-des").value) || 0;
  presupuesto.ahorro = Number(document.getElementById("presu-aho").value) || 0;

  localStorage.setItem("presupuesto", JSON.stringify(presupuesto));
  mostrarNotificacion("Presupuesto guardado correctamente.");
  actualizarDashboard();
});

/* ============================
      EXPORTAR CSV
============================ */
document.getElementById("btn-exportar").onclick = () => {
  let csv = "Fecha,Tipo,Monto,Categoría,503020,Nota\n";
  movimientos.forEach(m => {
    csv += `${m.fecha},${m.tipo},${m.monto},${m.categoria},${m.tipo503020},${(m.nota || "").replace(/,/g, " ")}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "movimientos_mes.csv";
  a.click();
};

/* ============================
      CUENTAS – LÓGICA
============================ */
const colorInput = document.getElementById("cuenta-color");
const colorPreview = document.getElementById("cuenta-color-preview");
colorPreview.style.backgroundColor = colorInput.value;

colorInput.addEventListener("input", () => {
  colorPreview.style.backgroundColor = colorInput.value;
});

function guardarCuentasLS() {
  localStorage.setItem("cuentas", JSON.stringify(cuentas));
  cargarCuentasEnSelectMovimientos();
}

function renderCuentas() {
  const contenedor = document.getElementById("lista-cuentas");
  contenedor.innerHTML = "";

  if (cuentas.length === 0) {
    contenedor.innerHTML = "<p style='font-size:13px;color:#6b7280;'>Aún no has registrado cuentas. Agrega tu primera cuenta bancaria o tarjeta.</p>";
    document.getElementById("card-detalle-cuenta").style.display = "none";
    return;
  }

  cuentas.forEach(c => {
    const div = document.createElement("div");
    const baseColor = c.color || "#0f172a";
    div.className = "cuenta-card";
    div.style.background = `linear-gradient(135deg, ${baseColor}, #020617)`;

    div.innerHTML = `
      <div class="cuenta-superior">
        <div class="cuenta-nombre">${c.nombre}</div>
        <div class="cuenta-tipo-pill">${c.tipo}</div>
      </div>
      <div class="cuenta-saldo">${formatoRD(c.saldo || 0)}</div>
      <div class="cuenta-numero">•••• ${c.numero && c.numero.trim() ? c.numero : "----"}</div>
      <div class="cuenta-acciones">
        <button class="btn-small" onclick="verDetalleCuenta(${c.id})">Ver detalle</button>
        <button class="btn-small btn-edit" onclick="editarCuenta(${c.id})">Editar</button>
        <button class="btn-small btn-delete" onclick="eliminarCuenta(${c.id})">Eliminar</button>
      </div>
    `;
    contenedor.appendChild(div);
  });
}

/* Llenar el select de "Cuenta asociada" en Registrar movimiento */
function cargarCuentasEnSelectMovimientos() {
  const select = document.getElementById("mov-cuenta");
  if (!select) return;

  select.innerHTML = "";

  if (cuentas.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hay cuentas registradas";
    select.appendChild(opt);
    select.disabled = true;
    return;
  }

  select.disabled = false;

  const optDef = document.createElement("option");
  optDef.value = "";
  optDef.textContent = "Selecciona una cuenta (opcional)";
  select.appendChild(optDef);

  cuentas.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre;
    select.appendChild(opt);
  });
}

function verDetalleCuenta(id) {
  const c = cuentas.find(x => x.id === id);
  if (!c) return;

  const card = document.getElementById("card-detalle-cuenta");
  const titulo = document.getElementById("detalle-cuenta-titulo");
  const subtitulo = document.getElementById("detalle-cuenta-subtitulo");
  const notaEl = document.getElementById("detalle-cuenta-nota");

  titulo.innerText = c.nombre;
  const ultimos = c.numero && c.numero.trim() ? c.numero : "----";

  let extraTarjeta = "";
  if (c.tipo === "Tarjeta de crédito") {
    const corte = c.diaCorte ? ` • Corte: día ${c.diaCorte}` : "";
    const pago = c.diaPago ? ` • Pago: día ${c.diaPago}` : "";
    extraTarjeta = corte + pago;
  }

  subtitulo.innerText = `${c.tipo} • Saldo: ${formatoRD(c.saldo || 0)} • **** ${ultimos}${extraTarjeta}`;
  notaEl.innerText = c.nota && c.nota.trim() ? c.nota : "Sin nota adicional.";

  card.style.display = "block";
}

function editarCuenta(id) {
  const c = cuentas.find(x => x.id === id);
  if (!c) return;

  document.getElementById("cuenta-id").value = c.id;
  document.getElementById("cuenta-nombre").value = c.nombre;
  document.getElementById("cuenta-tipo").value = c.tipo;
  document.getElementById("cuenta-numero").value = c.numero || "";
  document.getElementById("cuenta-saldo").value = c.saldo || 0;
  document.getElementById("cuenta-nota").value = c.nota || "";
  document.getElementById("cuenta-color").value = c.color || "#0f172a";
  document.getElementById("cuenta-dia-corte").value = c.diaCorte || "";
  document.getElementById("cuenta-dia-pago").value = c.diaPago || "";
  colorPreview.style.backgroundColor = c.color || "#0f172a";

  mostrarSeccion("cuentas");
}

function eliminarCuenta(id) {
  if (!confirm("¿Seguro que deseas eliminar esta cuenta?")) return;
  cuentas = cuentas.filter(c => c.id !== id);
  guardarCuentasLS();
  renderCuentas();
  document.getElementById("card-detalle-cuenta").style.display = "none";
  actualizarCalendario();
}

/* Guardar cuenta (nuevo / edición) */
const formCuenta = document.getElementById("form-cuenta");
formCuenta.addEventListener("submit", (e) => {
  e.preventDefault();

  const idExistente = document.getElementById("cuenta-id").value;
  const nombre = document.getElementById("cuenta-nombre").value.trim();
  const tipo = document.getElementById("cuenta-tipo").value;
  const numero = document.getElementById("cuenta-numero").value.trim();
  const saldo = Number(document.getElementById("cuenta-saldo").value) || 0;
  const color = document.getElementById("cuenta-color").value || "#0f172a";
  const nota = document.getElementById("cuenta-nota").value.trim();
  const diaCorte = document.getElementById("cuenta-dia-corte").value.trim();
  const diaPago = document.getElementById("cuenta-dia-pago").value.trim();

  if (!nombre) {
    mostrarNotificacion("Ponle un nombre a la cuenta.", "error");
    return;
  }

  if (idExistente) {
    // Editar
    const idx = cuentas.findIndex(c => String(c.id) === String(idExistente));
    if (idx !== -1) {
      cuentas[idx].nombre = nombre;
      cuentas[idx].tipo = tipo;
      cuentas[idx].numero = numero;
      cuentas[idx].saldo = saldo;
      cuentas[idx].color = color;
      cuentas[idx].nota = nota;
      cuentas[idx].diaCorte = diaCorte;
      cuentas[idx].diaPago = diaPago;
    }
  } else {
    // Nueva
    const nueva = {
      id: Date.now(),
      nombre,
      tipo,
      numero,
      saldo,
      color,
      nota,
      diaCorte,
      diaPago
    };
    cuentas.push(nueva);
  }

  guardarCuentasLS();
  renderCuentas();
  actualizarCalendario();
  actualizarDashboard();

  formCuenta.reset();
  document.getElementById("cuenta-id").value = "";
  document.getElementById("cuenta-color").value = "#0f172a";
  colorPreview.style.backgroundColor = "#0f172a";
  document.getElementById("cuenta-dia-corte").value = "";
  document.getElementById("cuenta-dia-pago").value = "";
});

/* ============================
      PRÉSTAMOS – LÓGICA
============================ */
function guardarPrestamosLS() {
  localStorage.setItem("prestamos", JSON.stringify(prestamos));
}

/* Generar fechas de pago mensuales */
function generarFechaPago(fechaInicial, numeroCuota) {
  const fecha = new Date(fechaInicial);
  fecha.setMonth(fecha.getMonth() + (numeroCuota - 1));
  return fecha.toISOString().slice(0,10);
}

/* Generar cuadro de amortización según tipo */
function generarCuotasPrestamo(p) {
  const cuotas = [];
  const n = p.plazoMeses;
  let saldo = p.monto;
  const tasaAnual = p.tasaAnual / 100;

  let tasaMensual;
  if (p.tipo === "compuesto-diario") {
    const tasaDiaria = tasaAnual / 365;
    tasaMensual = Math.pow(1 + tasaDiaria, 30) - 1;
  } else {
    tasaMensual = tasaAnual / 12;
  }

  let cuota = 0;

  if (p.tipo === "francesa" || p.tipo === "compuesto-diario") {
    if (tasaMensual > 0) {
      cuota = p.monto * (tasaMensual * Math.pow(1 + tasaMensual, n)) / (Math.pow(1 + tasaMensual, n) - 1);
    } else {
      cuota = p.monto / n;
    }
  } else if (p.tipo === "americana") {
    cuota = saldo * tasaMensual;
  }

  cuota = Math.round(cuota * 100) / 100;

  for (let i = 1; i <= n; i++) {
    let interes = 0;
    let capital = 0;
    let cuotaActual = cuota;

    if (p.tipo === "francesa" || p.tipo === "compuesto-diario") {
      interes = saldo * tasaMensual;
      capital = cuotaActual - interes;

      interes = Math.round(interes * 100) / 100;
      capital = Math.round(capital * 100) / 100;

      if (i === n) {
        capital = saldo;
        cuotaActual = capital + interes;
      }

      saldo = saldo - capital;
    } else if (p.tipo === "americana") {
      interes = saldo * tasaMensual;
      interes = Math.round(interes * 100) / 100;

      if (i === n) {
        capital = saldo;
        cuotaActual = capital + interes;
        saldo = 0;
      } else {
        capital = 0;
      }
    }

    saldo = Math.round(saldo * 100) / 100;

    const fechaPago = generarFechaPago(p.fechaPrimerPago || p.fechaInicio || new Date().toISOString().slice(0,10), i);

    cuotas.push({
      numero: i,
      fecha: fechaPago,
      cuota: cuotaActual,
      capital: capital,
      interes: interes,
      saldo: saldo
    });
  }

  return cuotas;
}

/* Registrar préstamo */
const formPrestamo = document.getElementById("form-prestamo");
const hoyISO = new Date().toISOString().slice(0,10);
document.getElementById("prestamo-fecha-inicio").value = hoyISO;
document.getElementById("prestamo-fecha-primer-pago").value = hoyISO;

formPrestamo.addEventListener("submit", (e) => {
  e.preventDefault();

  const nombre = document.getElementById("prestamo-nombre").value.trim();
  const tipo = document.getElementById("prestamo-tipo").value;
  const monto = Number(document.getElementById("prestamo-monto").value) || 0;
  const tasa = Number(document.getElementById("prestamo-tasa").value) || 0;
  const plazo = Number(document.getElementById("prestamo-plazo").value) || 0;
  const fechaInicio = document.getElementById("prestamo-fecha-inicio").value || hoyISO;
  const fechaPrimerPago = document.getElementById("prestamo-fecha-primer-pago").value || fechaInicio;
  const nota = document.getElementById("prestamo-nota").value.trim();

  if (!nombre || !monto || !plazo) {
    mostrarNotificacion("Completa al menos nombre, monto y plazo.", "error");
    return;
  }

  const prestamo = {
    id: Date.now(),
    nombre,
    tipo,
    monto,
    tasaAnual: tasa,
    plazoMeses: plazo,
    fechaInicio,
    fechaPrimerPago,
    nota
  };

  prestamo.cuotas = generarCuotasPrestamo(prestamo);

  prestamos.push(prestamo);
  guardarPrestamosLS();
  mostrarPrestamos();
  actualizarDashboard();
  actualizarCalendario();

  formPrestamo.reset();
  document.getElementById("prestamo-fecha-inicio").value = hoyISO;
  document.getElementById("prestamo-fecha-primer-pago").value = hoyISO;
});

/* Mostrar lista de préstamos */
function mostrarPrestamos() {
  const tbody = document.getElementById("tabla-prestamos");
  tbody.innerHTML = "";

  prestamos.forEach(p => {
    const tr = document.createElement("tr");

    const cuotaEjemplo = p.cuotas && p.cuotas.length > 0 ? p.cuotas[0].cuota : 0;

    let etiquetaTipo = "";
    if (p.tipo === "francesa") etiquetaTipo = "Francesa";
    else if (p.tipo === "compuesto-diario") etiquetaTipo = "Compuesto diario";
    else if (p.tipo === "americana") etiquetaTipo = "Americana";

    tr.innerHTML = `
      <td>${p.nombre}</td>
      <td><span class="tag-tipo">${etiquetaTipo}</span></td>
      <td>${formatoRD(p.monto)}</td>
      <td>${formatoRD(cuotaEjemplo)}</td>
      <td>${p.plazoMeses} meses</td>
      <td><button class="btn-small btn-edit" onclick="verDetallePrestamo(${p.id})">Ver detalle</button></td>
      <td><button class="btn-small btn-delete" onclick="eliminarPrestamo(${p.id})">Eliminar</button></td>
    `;
    tbody.appendChild(tr);
  });

  if (prestamos.length === 0) {
    document.getElementById("card-detalle-prestamo").style.display = "none";
  }

  actualizarCalendario();
  actualizarDashboard();
}

function verDetallePrestamo(id) {
  const p = prestamos.find(x => x.id === id);
  if (!p) return;

  const card = document.getElementById("card-detalle-prestamo");
  const titulo = document.getElementById("detalle-prestamo-titulo");
  const subtitulo = document.getElementById("detalle-prestamo-subtitulo");
  const tbody = document.getElementById("tabla-detalle-prestamo");

  titulo.innerText = `Detalle de: ${p.nombre}`;
  subtitulo.innerText = `Tipo: ${p.tipo.toUpperCase()} • Monto: ${formatoRD(p.monto)} • Plazo: ${p.plazoMeses} meses`;

  tbody.innerHTML = "";
  p.cuotas.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.numero}</td>
      <td>${c.fecha}</td>
      <td>${formatoRD(c.cuota)}</td>
      <td>${formatoRD(c.capital)}</td>
      <td>${formatoRD(c.interes)}</td>
      <td>${formatoRD(c.saldo)}</td>
    `;
    tbody.appendChild(tr);
  });

  card.style.display = "block";
}

function eliminarPrestamo(id) {
  if (!confirm("¿Seguro que deseas eliminar este préstamo?")) return;
  prestamos = prestamos.filter(p => p.id !== id);
  guardarPrestamosLS();
  mostrarPrestamos();
  actualizarDashboard();
  actualizarCalendario();
}

/* ============================
      CALENDARIO – LÓGICA
============================ */
let calAnioActual;
let calMesActual; // 0-11

function obtenerEventosMes(anio, mes) {
  const eventos = [];

  // Eventos de préstamos (cuotas)
  prestamos.forEach(p => {
    if (Array.isArray(p.cuotas)) {
      p.cuotas.forEach(c => {
        const d = new Date(c.fecha);
        if (!isNaN(d) && d.getFullYear() === anio && d.getMonth() === mes) {
          eventos.push({
            fecha: d,
            tipo: "prestamo",
            titulo: `Cuota ${c.numero} – ${p.nombre}`,
            monto: c.cuota
          });
        }
      });
    }
  });

  // Eventos de tarjetas (corte / pago)
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  cuentas.forEach(c => {
    if (c.tipo === "Tarjeta de crédito") {
      const diaCorte = parseInt(c.diaCorte);
      const diaPago = parseInt(c.diaPago);

      if (diaCorte && diaCorte >= 1 && diaCorte <= 31) {
        const diaRealCorte = Math.min(diaCorte, diasEnMes);
        const fechaCorte = new Date(anio, mes, diaRealCorte);
        eventos.push({
          fecha: fechaCorte,
          tipo: "tarjeta-corte",
          titulo: `Corte ${c.nombre}`,
          monto: null
        });
      }

      if (diaPago && diaPago >= 1 && diaPago <= 31) {
        const diaRealPago = Math.min(diaPago, diasEnMes);
        const fechaPago = new Date(anio, mes, diaRealPago);
        eventos.push({
          fecha: fechaPago,
          tipo: "tarjeta-pago",
          titulo: `Pago ${c.nombre}`,
          monto: null
        });
      }
    }
  });

  return eventos;
}

function nombreMesES(mesIndex) {
  const nombres = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  return nombres[mesIndex] || "";
}

function initCalendario() {
  const hoy = new Date();
  calAnioActual = hoy.getFullYear();
  calMesActual = hoy.getMonth();
  renderCalendario();
}

function cambiarMes(delta) {
  calMesActual += delta;
  if (calMesActual < 0) {
    calMesActual = 11;
    calAnioActual -= 1;
  } else if (calMesActual > 11) {
    calMesActual = 0;
    calAnioActual += 1;
  }
  renderCalendario();
}

function renderCalendario() {
  const anio = calAnioActual;
  const mes = calMesActual;

  const tituloMes = document.getElementById("calendario-mes-actual");
  tituloMes.innerText = `${nombreMesES(mes)} ${anio}`;

  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";

  const eventos = obtenerEventosMes(anio, mes);

  // Agrupar por día
  const eventosPorDia = {};
  eventos.forEach(ev => {
    const dia = ev.fecha.getDate();
    if (!eventosPorDia[dia]) eventosPorDia[dia] = [];
    eventosPorDia[dia].push(ev);
  });

  const primerDiaMes = new Date(anio, mes, 1);
  // getDay(): 0 Domingo ... 6 Sábado → queremos lunes=0
  let diaSemana = (primerDiaMes.getDay() + 6) % 7;
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  // Celdas vacías antes del 1
  for (let i = 0; i < diaSemana; i++) {
    const cell = document.createElement("div");
    cell.className = "cal-dia cal-dia-vacio";
    grid.appendChild(cell);
  }

  const hoy = new Date();

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const cell = document.createElement("div");
    cell.className = "cal-dia";
    if (
      hoy.getFullYear() === anio &&
      hoy.getMonth() === mes &&
      hoy.getDate() === dia
    ) {
      cell.classList.add("cal-dia-hoy");
    }
    cell.dataset.dia = dia;

    const num = document.createElement("div");
    num.className = "cal-dia-num";
    num.innerText = dia;
    cell.appendChild(num);

    const eventosDia = eventosPorDia[dia] || [];
    if (eventosDia.length > 0) {
      const dots = document.createElement("div");
      dots.className = "cal-dia-dots";
      eventosDia.slice(0, 3).forEach(ev => {
        const dot = document.createElement("span");
        let tipoClase = "";
        if (ev.tipo === "prestamo") tipoClase = "event-prestamo";
        else if (ev.tipo === "tarjeta-corte") tipoClase = "event-tarjeta-corte";
        else if (ev.tipo === "tarjeta-pago") tipoClase = "event-tarjeta-pago";
        dot.className = "event-dot " + tipoClase;
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
    }

    cell.addEventListener("click", () => {
      mostrarDetalleDia(dia, eventosDia, anio, mes);
    });

    grid.appendChild(cell);
  }

  // Actualizar agenda
  renderAgenda(anio, mes);
}

function formatearFechaCorta(d) {
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

function mostrarDetalleDia(dia, eventosDia, anio, mes) {
  const cont = document.getElementById("cal-detalle-dia");
  if (!eventosDia || eventosDia.length === 0) {
    cont.innerHTML = `
      <div style="font-size:12px;">
        <strong>${dia} de ${nombreMesES(mes)} ${anio}</strong><br>
        <span style="color:#6b7280;">No hay pagos asignados para este día.</span>
      </div>
    `;
    return;
  }

  let html = `
    <div class="cal-detalle-lista">
      <strong>${dia} de ${nombreMesES(mes)} ${anio}</strong>
  `;

  eventosDia.forEach(ev => {
    let tagClass = "event-tag-prestamo";
    let tagText = "Préstamo";

    if (ev.tipo === "tarjeta-corte") {
      tagClass = "event-tag-tarjeta-corte";
      tagText = "Corte tarjeta";
    } else if (ev.tipo === "tarjeta-pago") {
      tagClass = "event-tag-tarjeta-pago";
      tagText = "Pago tarjeta";
    }

    html += `
      <div class="cal-detalle-item">
        <span class="event-tag ${tagClass}">${tagText}</span>
        ${ev.titulo}
        ${ev.monto !== null && ev.monto !== undefined ? `<div>${formatoRD(ev.monto)}</div>` : ""}
      </div>
    `;
  });

  html += `</div>`;
  cont.innerHTML = html;
}

function renderAgenda(anio, mes) {
  const cont = document.getElementById("cal-agenda-lista");
  cont.innerHTML = "";

  const eventos = obtenerEventosMes(anio, mes).sort((a, b) => a.fecha - b.fecha);

  if (eventos.length === 0) {
    cont.innerHTML = `<p style="font-size:12px;color:#6b7280;">No hay pagos registrados para este mes.</p>`;
    return;
  }

  let html = "";
  eventos.forEach(ev => {
    let tagClass = "event-tag-prestamo";
    let tagText = "Préstamo";

    if (ev.tipo === "tarjeta-corte") {
      tagClass = "event-tag-tarjeta-corte";
      tagText = "Corte tarjeta";
    } else if (ev.tipo === "tarjeta-pago") {
      tagClass = "event-tag-tarjeta-pago";
      tagText = "Pago tarjeta";
    }

    html += `
      <div class="cal-agenda-item">
        <div class="cal-agenda-fecha">${formatearFechaCorta(ev.fecha)}</div>
        <div class="cal-agenda-titulo">
          <span class="event-tag ${tagClass}">${tagText}</span> ${ev.titulo}
        </div>
        ${ev.monto !== null && ev.monto !== undefined ? `<div class="cal-agenda-monto">${formatoRD(ev.monto)}</div>` : ""}
      </div>
    `;
  });

  cont.innerHTML = html;
}

function actualizarCalendario() {
  if (typeof calAnioActual === "undefined" || typeof calMesActual === "undefined") {
    initCalendario();
  } else {
    renderCalendario();
  }
}

/* Tabs del calendario (mes / agenda) */
document.querySelectorAll(".cal-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cal-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const vista = btn.dataset.calvista;
    document.querySelectorAll(".cal-tab-content").forEach(c => c.classList.remove("active"));

    if (vista === "mes") {
      document.getElementById("vista-cal-mes").classList.add("active");
    } else {
      document.getElementById("vista-cal-agenda").classList.add("active");
    }
  });
});

/* Botones anterior / siguiente mes */
document.getElementById("cal-prev").addEventListener("click", () => cambiarMes(-1));
document.getElementById("cal-next").addEventListener("click", () => cambiarMes(1));

/* Inicializar sección de préstamos, cuentas y calendario */
mostrarPrestamos();
renderCuentas();
initCalendario();
cargarCuentasEnSelectMovimientos();
/* ============================
      FORMULARIO DINÁMICO
============================ */
/* Título dinámico */
const tituloForm = document.querySelector('[data-role="titulo-form"]');
const formMovimiento = document.querySelector('[data-form="movimiento"]');

if (tituloForm && formMovimiento) {
  const campoTipo = formMovimiento.querySelector("#tipo");
  
  function actualizarTitulo() {
    const esIngreso = campoTipo.value === "Ingreso";
    tituloForm.textContent = esIngreso ? "Registrar Ingreso" : "Registrar Gasto";
  }

  campoTipo.addEventListener("change", actualizarTitulo);
  actualizarTitulo(); // Inicial
}

/* Botones rápidos de gastos */
const quickButtonsContainer = document.createElement("div");
quickButtonsContainer.className = "quick-buttons-row";

const gastosRapidos = [
  { icon: "🛒", label: "Supermercado", cat: "Alimentos" },
  { icon: "⛽️", label: "Gasolina", cat: "Transporte" },
  { icon: "🍔", label: "Comida", cat: "Alimentos" },
  { icon: "💊", label: "Farmacia", cat: "Salud" }
];

const quickLabel = document.createElement("span");
quickLabel.className = "quick-label";
quickLabel.textContent = "Gasto rápido:";
quickButtonsContainer.appendChild(quickLabel);

gastosRapidos.forEach(g => {
  const btn = document.createElement("button");
  btn.className = "quick-btn";
  btn.type = "button";
  btn.innerHTML = `${g.icon} ${g.label}`;
  btn.onclick = () => {
    formMovimiento.querySelector("#tipo").value = "Gasto";
    formMovimiento.querySelector("#categoria").value = g.cat;
    formMovimiento.querySelector("#nota").value = g.label;
    
    // Simular evento "change" para que se actualice el título
    const changeEvent = new Event('change');
    formMovimiento.querySelector("#tipo").dispatchEvent(changeEvent);

    formMovimiento.querySelector("#monto").focus();
  };
  quickButtonsContainer.appendChild(btn);
});

// Insertar antes del primer .form-row
const primerFormRow = formMovimiento.querySelector(".form-row");
if (primerFormRow) {
  formMovimiento.insertBefore(quickButtonsContainer, primerFormRow);
}

/* Fecha por defecto */
const campoFecha = formMovimiento.querySelector("#fecha");
if (!campoFecha.value) {
    campoFecha.value = new Date().toISOString().slice(0, 10);
}

/* Sugerencias de notas al cambiar categoría */
const campoCategoria = formMovimiento.querySelector("#categoria");
const campoNota = formMovimiento.querySelector("#nota");

const sugerencias = {
    "Transporte": ["Uber", "Didi", "Gasolina", "Pasaje"],
    "Alimentos": ["Supermercado", "Restaurante", "Colmado"],
    "Entretenimiento": ["Cine", "Concierto", "Bar"]
};

campoCategoria.addEventListener("change", () => {
    const cat = campoCategoria.value;
    if (sugerencias[cat]) {
        campoNota.placeholder = "Ej: " + sugerencias[cat].join(", ");
    } else {
        campoNota.placeholder = "Descripción (opcional)";
    }
});
