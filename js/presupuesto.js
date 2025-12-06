import { state, formatCurrency, parseAmount, refreshStorage } from './utils.js';

let notifyCb = () => {};

function guardarPresupuestoBase(form) {
  state.presupuesto.necesidad = parseAmount(form['presupuesto-necesidad'].value) || 0;
  state.presupuesto.deseo = parseAmount(form['presupuesto-deseo'].value) || 0;
  state.presupuesto.ahorro = parseAmount(form['presupuesto-ahorro'].value) || 0;
  refreshStorage();
  notifyCb('Presupuesto actualizado');
}

function renderPresupuestoBase() {
  document.getElementById('presupuesto-necesidad').value = state.presupuesto.necesidad;
  document.getElementById('presupuesto-deseo').value = state.presupuesto.deseo;
  document.getElementById('presupuesto-ahorro').value = state.presupuesto.ahorro;
}

function renderCategorias() {
  const lista = document.getElementById('lista-presupuesto-personalizado');
  const categorias = state.presupuesto.categorias || [];
  lista.innerHTML = categorias
    .map(
      (c, index) => `
      <div class="presupuesto-item">
        <div>
          <strong>${c.nombre}</strong>
          <p>${c.tipo}</p>
        </div>
        <div>${formatCurrency(c.limite || 0)}</div>
        <button class="btn-danger" data-remove="${index}">Eliminar</button>
      </div>
    `
    )
    .join('');
}

function agregarCategoria(form) {
  if (!state.presupuesto.categorias) state.presupuesto.categorias = [];
  state.presupuesto.categorias.push({
    nombre: form['categoria-nombre'].value,
    tipo: form['categoria-tipo'].value,
    limite: parseAmount(form['categoria-limite'].value)
  });
  refreshStorage();
  renderCategorias();
  notifyCb('Categoría creada');
  form.reset();
}

export function initPresupuesto({ notify }) {
  notifyCb = notify;
  const formBase = document.getElementById('form-presupuesto');
  const formCat = document.getElementById('form-presupuesto-personalizado');
  renderPresupuestoBase();
  renderCategorias();

  formBase.addEventListener('submit', (e) => {
    e.preventDefault();
    guardarPresupuestoBase(formBase);
  });

  formCat.addEventListener('submit', (e) => {
    e.preventDefault();
    agregarCategoria(formCat);
  });

  document.getElementById('lista-presupuesto-personalizado').addEventListener('click', (e) => {
    const idx = e.target.dataset.remove;
    if (idx !== undefined) {
      state.presupuesto.categorias.splice(Number(idx), 1);
      refreshStorage();
      renderCategorias();
      notifyCb('Categoría eliminada', 'warning');
    }
  });
}
