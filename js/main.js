console.log("FH v2 — Sistema cargado correctamente.");

/* =========================================================
   SISTEMA BASE V2 (LIMPIO) — Opción B (sin datos previos)
   =========================================================
*/

// Inicializar estructura limpia en localStorage
const FH = {
  datos: {
    movimientos: [],
    cuentas: [],
    prestamos: [],
    presupuesto: {
      necesidad: 0,
      deseo: 0,
      ahorro: 0
    }
  }
};

// Guardar la base inicial
localStorage.setItem("FH_DATA", JSON.stringify(FH));

/* =========================================================
   FUNCIONES BASE PARA GUARDAR Y CARGAR
   ========================================================= */

function guardar() {
  localStorage.setItem("FH_DATA", JSON.stringify(FH));
}

function cargar() {
  const data = localStorage.getItem("FH_DATA");
  if (data) {
    return JSON.parse(data);
  }
  return FH;
}

console.log("Estructura limpia cargada.");

/* =========================================================
   NAVEGACIÓN ENTRE SECCIONES
   ========================================================= */

const secciones = document.querySelectorAll("section");
const botones = document.querySelectorAll("nav button");

function mostrarSeccion(id) {
  secciones.forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  botones.forEach(b => b.classList.remove("active"));
}

document.getElementById("btnDashboard").addEventListener("click", () => {
  mostrarSeccion("seccion-dashboard");
});

document.getElementById("btnRegistrar").addEventListener("click", () => {
  mostrarSeccion("seccion-registrar");
});

document.getElementById("btnMovimientos").addEventListener("click", () => {
  mostrarSeccion("seccion-movimientos");
});

document.getElementById("btnCuentas").addEventListener("click", () => {
  mostrarSeccion("seccion-cuentas");
});

document.getElementById("btnPrestamos").addEventListener("click", () => {
  mostrarSeccion("seccion-prestamos");
});

document.getElementById("btnCalendario").addEventListener("click", () => {
  mostrarSeccion("seccion-calendario");
});

document.getElementById("btnPresupuesto").addEventListener("click", () => {
  mostrarSeccion("seccion-presupuesto");
});

document.getElementById("btnExportar").addEventListener("click", () => {
  mostrarSeccion("seccion-exportar");
});

document.getElementById("btnAjustes").addEventListener("click", () => {
  mostrarSeccion("seccion-ajustes");
});

// Mostrar primero el Dashboard
mostrarSeccion("seccion-dashboard");

/* =========================================================
   RENDER BÁSICO DE KPI (VALORES INICIALES)
   ========================================================= */

document.getElementById("kpi-ingresos").innerText = "RD$ 0";
document.getElementById("kpi-gastos").innerText = "RD$ 0";
document.getElementById("kpi-balance").innerText = "RD$ 0";
document.getElementById("kpi-total-cuentas").innerText = "RD$ 0";
document.getElementById("kpi-deuda-mes").innerText = "RD$ 0";

console.log("KPIs iniciales establecidos.");

/* =========================================================
   SISTEMA LISTO PARA V2 (CARGA DE FUNCIONES EN SIGUIENTES ETAPAS)
   ========================================================= */

console.log("Sistema V2 cargado. Listo para integrar los módulos nuevos.");
