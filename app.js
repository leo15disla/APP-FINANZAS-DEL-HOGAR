/*
 * Lógica principal de la aplicación "Finanzas del Hogar".
 * Este script implementa navegación de una sola página (SPA),
 * gestión básica de ingresos y gastos usando LocalStorage,
 * así como el renderizado de vistas y de un sencillo gráfico de barras.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos de navegación y vistas
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  // Clave de almacenamiento para movimientos en LocalStorage.
  const LOCAL_KEY = 'movimientos';
  // Cargar movimientos desde LocalStorage. Si no existe "movimientos",
  // se hace una migración desde "transactions" para mantener compatibilidad.
  let movimientos = JSON.parse(localStorage.getItem(LOCAL_KEY)) || JSON.parse(localStorage.getItem('transactions')) || [];

  // Cuentas almacenadas en LocalStorage
  let cuentas = JSON.parse(localStorage.getItem('cuentas')) || [];

  // Préstamos almacenados en LocalStorage
  let prestamos = JSON.parse(localStorage.getItem('prestamos')) || [];
  // Presupuestos (categorías de gasto) almacenados en LocalStorage
  let presupuestos = JSON.parse(localStorage.getItem('presupuestos')) || [];

  // ======================= MÓDULO SOBRES =====================
  // Sobres almacenados en LocalStorage
  let sobres = JSON.parse(localStorage.getItem('sobres')) || [];

  /**
   * Ordena un arreglo de sobres por su nivel de prioridad (alta, media, baja).
   * Si una prioridad no está definida se asume como 'baja'.
   * @param {Array} sobresArr Arreglo de sobres a ordenar
   * @returns {Array} Arreglo ordenado
   */
  function ordenarPorPrioridad(sobresArr) {
    const ranking = { alta: 1, media: 2, baja: 3 };
    return sobresArr
      .slice()
      .sort((a, b) => (ranking[a.prioridadNivel] || 3) - (ranking[b.prioridadNivel] || 3));
  }

  /**
   * Genera un código corto para un sobre según su índice. Ejemplo: S01, S02, ...
   * Si ya existen sobres, se basa en la longitud actual para generar un código único.
   * @param {number} index Índice del sobre (0-based)
   * @returns {string} Código generado
   */
  function generarCodigoSobre(index) {
    // Pad con ceros hasta dos dígitos. Ej: index=0 => S01
    return `S${String(index + 1).padStart(2, '0')}`;
  }

  /**
   * Carga los sobres desde LocalStorage en la variable sobres.
   */
  function cargarSobres() {
    sobres = JSON.parse(localStorage.getItem('sobres')) || [];
    // Garantizar que cada sobre tenga un código único; si falta, asignar en base a su posición
    sobres.forEach((s, idx) => {
      if (!s.codigo) {
        s.codigo = generarCodigoSobre(idx);
      }
      // Asignar valores por defecto para nuevas propiedades
      if (!s.prioridadNivel) {
        s.prioridadNivel = 'alta';
      }
      if (!s.categoriaDistribucion) {
        s.categoriaDistribucion = 'necesidad';
      }
      // diaPago debe ser null si no existe
      if (s.diaPago === undefined) {
        s.diaPago = null;
      }
    });
    // Guardar nuevamente si algún código fue asignado
    localStorage.setItem('sobres', JSON.stringify(sobres));
  }

  /**
   * Guarda el arreglo de sobres en LocalStorage.
   */
  function guardarSobres() {
    localStorage.setItem('sobres', JSON.stringify(sobres));
  }

  /**
   * Crea un nuevo sobre y lo añade a la colección.
   * @param {object} data Objeto con las propiedades del sobre
   */
  function crearSobre(data) {
    const nuevo = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      nombre: data.nombre,
      tipo: data.tipo,
      limite: data.tipo === 'fijo' ? parseFloat(data.limite || 0) : 0,
      saldo: parseFloat(data.saldo || 0) || 0,
      gastado: 0,
      // Sistema de prioridad simple: alta | media | baja
      prioridadNivel: data.prioridadNivel || 'alta',
      // Categoría de distribución para el Dashboard: necesidad | deseo | ahorro
      categoriaDistribucion: data.categoriaDistribucion || 'necesidad',
      // Día de pago para sobres fijos (1–31) o null
      diaPago: data.tipo === 'fijo' ? (data.diaPago ? parseInt(data.diaPago) : null) : null,
      // Categoría vinculada para restar gastos (si corresponde)
      categoriaVinculada: data.categoriaVinculada || ''
    };
    // Generar código si no se proporciona
    nuevo.codigo = data.codigo || generarCodigoSobre(sobres.length);
    sobres.push(nuevo);
    guardarSobres();
    return nuevo;
  }

  /**
   * Actualiza un sobre existente por id.
   * @param {string} id
   * @param {object} data
   */
  function actualizarSobre(id, data) {
    const idx = sobres.findIndex((s) => s.id === id);
    if (idx !== -1) {
      sobres[idx] = {
        ...sobres[idx],
        ...data,
        limite: sobres[idx].tipo === 'fijo' ? parseFloat(data.limite || sobres[idx].limite) : 0,
        // Actualizar prioridad de nivel si se proporciona
        prioridadNivel: data.prioridadNivel || sobres[idx].prioridadNivel || 'alta',
        categoriaDistribucion: data.categoriaDistribucion || sobres[idx].categoriaDistribucion || 'necesidad',
        diaPago:
          sobres[idx].tipo === 'fijo'
            ? data.diaPago
              ? parseInt(data.diaPago)
              : sobres[idx].diaPago || null
            : null
      };
      guardarSobres();
    }
  }

  /**
   * Elimina un sobre por id.
   * @param {string} id
   */
  function eliminarSobre(id) {
    sobres = sobres.filter((s) => s.id !== id);
    guardarSobres();
  }

  // ======================= SOBRES (Sistema de Envelopes) =======================
  // Método de distribución de sobres almacenado en LocalStorage (valor por defecto: 'prioridad').
  let metodoDistribucionSobres = localStorage.getItem('metodoDistribucionSobres') || 'prioridad';

  /**
   * Actualiza la vista de sobres mostrando un resumen general y la lista de sobres.
   */
  function actualizarVistaSobres() {
    cargarSobres();
    const resumenEl = document.getElementById('sobres-resumen');
    const listEl = document.getElementById('sobres-list');
    if (!resumenEl || !listEl) return;
    let totalAsignado = 0;
    let totalGastado = 0;
    sobres.forEach((s) => {
      totalAsignado += parseFloat(s.saldo) || 0;
      totalGastado += parseFloat(s.gastado) || 0;
    });
    let totalIngresos = 0;
    let totalGastos = 0;
    movimientos.forEach((m) => {
      if (m.tipo === 'ingreso') totalIngresos += parseFloat(m.monto);
      else totalGastos += parseFloat(m.monto);
    });
    const saldoLibre = totalIngresos - totalGastos - totalAsignado;
    resumenEl.innerHTML = '';
    const summaryGrid = document.createElement('div');
    summaryGrid.classList.add('sobres-summary-grid');
    function crearResumen(titulo, valor) {
      const div = document.createElement('div');
      div.classList.add('summary-card-sobres');
      const h3 = document.createElement('h3');
      h3.textContent = titulo;
      const p = document.createElement('p');
      p.classList.add('summary-value');
      p.textContent = formatCurrency(valor);
      div.appendChild(h3);
      div.appendChild(p);
      return div;
    }
    summaryGrid.appendChild(crearResumen('Asignado', totalAsignado));
    summaryGrid.appendChild(crearResumen('Gastado', totalGastado));
    summaryGrid.appendChild(crearResumen('Libre', saldoLibre));
    resumenEl.appendChild(summaryGrid);
    listEl.innerHTML = '';
    if (sobres.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No hay sobres definidos.';
      empty.style.textAlign = 'center';
      listEl.appendChild(empty);
      return;
    }
    // Ordenar por nivel de prioridad (alta -> media -> baja)
    const ranking = { alta: 1, media: 2, baja: 3 };
    const sorted = [...sobres].sort((a, b) => (ranking[a.prioridadNivel] || 0) - (ranking[b.prioridadNivel] || 0));
    sorted.forEach((s) => {
      const card = document.createElement('div');
      card.classList.add('sobre-card');
      card.classList.add(s.tipo);
      card.setAttribute('data-sobre-id', s.id);
      const header = document.createElement('div');
      header.classList.add('sobre-header');
      // Código corto
      const codeEl = document.createElement('span');
      codeEl.classList.add('sobre-codigo');
      codeEl.textContent = s.codigo || generarCodigoSobre(0);
      // Nombre
      const nameEl = document.createElement('span');
      nameEl.classList.add('sobre-nombre');
      nameEl.textContent = s.nombre;
      // Tipo
      const typeEl = document.createElement('span');
      typeEl.classList.add('sobre-tipo');
      typeEl.textContent = s.tipo.charAt(0).toUpperCase() + s.tipo.slice(1);
      header.appendChild(codeEl);
      header.appendChild(nameEl);
      header.appendChild(typeEl);
      const badge = document.createElement('span');
      badge.classList.add('sobre-status');
      let estado = '';
      if (s.tipo === 'fijo') {
        estado = s.saldo >= s.limite ? 'LLENO' : 'ACTIVO';
      } else {
        estado = s.saldo <= 0 ? 'AGOTADO' : 'ACTIVO';
      }
      badge.textContent = estado;
      header.appendChild(badge);
      card.appendChild(header);
      const progress = document.createElement('div');
      progress.classList.add('sobre-progress');
      const bar = document.createElement('span');
      let porcentaje = 0;
      if (s.tipo === 'fijo' && s.limite > 0) {
        porcentaje = s.saldo / s.limite;
      } else {
        const total = s.saldo + s.gastado;
        porcentaje = total > 0 ? s.gastado / total : 0;
      }
      bar.style.width = `${Math.min(100, porcentaje * 100)}%`;
      if (porcentaje < 0.7) progress.classList.add('green');
      else if (porcentaje <= 1) progress.classList.add('yellow');
      else progress.classList.add('red');
      progress.appendChild(bar);
      card.appendChild(progress);
      const metrics = document.createElement('div');
      metrics.classList.add('sobre-metrics');
      const saldoEl = document.createElement('span');
      saldoEl.textContent = 'Saldo: ' + formatCurrency(s.saldo);
      const gastadoEl = document.createElement('span');
      gastadoEl.textContent = 'Gastado: ' + formatCurrency(s.gastado);
      metrics.appendChild(saldoEl);
      metrics.appendChild(gastadoEl);
      if (s.tipo === 'fijo') {
        const limiteEl = document.createElement('span');
        limiteEl.textContent = 'Límite: ' + formatCurrency(s.limite);
        metrics.appendChild(limiteEl);
      }
      card.appendChild(metrics);
      // Información adicional: prioridad, distribución y día de pago
      const info = document.createElement('div');
      info.classList.add('sobre-info');
      const prioritySpan = document.createElement('span');
      prioritySpan.classList.add('sobre-prioridad-info');
      // Capitalizar primera letra
      const priorityText = s.prioridadNivel
        ? s.prioridadNivel.charAt(0).toUpperCase() + s.prioridadNivel.slice(1)
        : '';
      prioritySpan.textContent = `Prioridad: ${priorityText}`;
      const distSpan = document.createElement('span');
      distSpan.classList.add('sobre-distribucion-info');
      const distText = s.categoriaDistribucion
        ? s.categoriaDistribucion.charAt(0).toUpperCase() + s.categoriaDistribucion.slice(1)
        : '';
      distSpan.textContent = distText;
      info.appendChild(prioritySpan);
      info.appendChild(distSpan);
      if (s.tipo === 'fijo' && s.diaPago) {
        const pagoSpan = document.createElement('span');
        pagoSpan.classList.add('sobre-dia-pago-info');
        pagoSpan.textContent = `Paga el día ${s.diaPago}`;
        info.appendChild(pagoSpan);
      }
      card.appendChild(info);
      // Capa para chips de animación
      const animLayer = document.createElement('div');
      animLayer.classList.add('sobre-anim-layer');
      card.appendChild(animLayer);
      card.addEventListener('click', () => {
        editarSobre(s.id);
      });
      listEl.appendChild(card);
    });
  }

  /**
   * Distribuye un ingreso entre los sobres.
   */
  function distribuirIngresoEnSobres(montoTotal, fecha, fuente) {
    cargarSobres();
    let restante = parseFloat(montoTotal) || 0;
    // Ordenar sobres fijos que aún no han alcanzado su límite por prioridad (alta -> media -> baja)
    const fijos = ordenarPorPrioridad(
      sobres.filter((s) => s.tipo === 'fijo' && s.saldo < s.limite)
    );
    fijos.forEach((s) => {
      if (restante <= 0) return;
      const necesario = s.limite - s.saldo;
      const asignar = Math.min(necesario, restante);
      if (asignar > 0) {
        s.saldo += asignar;
        // animación de ingreso
        animarIngresoSobre(s.id, asignar);
      }
      restante -= asignar;
    });
    // Ordenar sobres variables por prioridad para una distribución coherente
    const variables = ordenarPorPrioridad(sobres.filter((s) => s.tipo === 'variable'));
    if (restante > 0 && variables.length > 0) {
      const metodo = localStorage.getItem('metodoDistribucionSobres') || metodoDistribucionSobres || 'prioridad';
      if (metodo === 'prioridad' || metodo === 'equitativa') {
        const parte = restante / variables.length;
        variables.forEach((s) => {
          s.saldo += parte;
          animarIngresoSobre(s.id, parte);
        });
        restante = 0;
      } else if (metodo === 'proporcional') {
        let totalRef = variables.reduce((sum, s) => sum + (s.limite || 1), 0);
        variables.forEach((s) => {
          const ref = s.limite || 1;
          const asignar = (ref / totalRef) * restante;
          s.saldo += asignar;
          animarIngresoSobre(s.id, asignar);
        });
        restante = 0;
      } else {
        const parte = restante / variables.length;
        variables.forEach((s) => {
          s.saldo += parte;
          animarIngresoSobre(s.id, parte);
        });
        restante = 0;
      }
    }
    guardarSobres();
    // Actualizar la distribución en el dashboard tras asignar ingresos
    actualizarDistribucionSobresEnDashboard();
  }

  /**
   * Descuenta un gasto del sobre vinculado a una categoría.
   */
  function descontarDeSobrePorCategoria(categoria, monto) {
    cargarSobres();
    const sobre = sobres.find((s) => s.categoriaVinculada && s.categoriaVinculada === categoria);
    if (sobre) {
      sobre.saldo = (parseFloat(sobre.saldo) || 0) - (parseFloat(monto) || 0);
      sobre.gastado = (parseFloat(sobre.gastado) || 0) + (parseFloat(monto) || 0);
      guardarSobres();
      // Animación de gasto
      animarGastoSobre(sobre.id, monto);
    }
  }

  /**
   * Descuenta un gasto directamente de un sobre por su ID.
   * @param {string} sobreId
   * @param {number} monto
   */
  function descontarDeSobre(sobreId, monto) {
    cargarSobres();
    const sobre = sobres.find((s) => s.id === sobreId);
    if (sobre) {
      sobre.saldo = (parseFloat(sobre.saldo) || 0) - (parseFloat(monto) || 0);
      sobre.gastado = (parseFloat(sobre.gastado) || 0) + (parseFloat(monto) || 0);
      guardarSobres();
      animarGastoSobre(sobre.id, monto);
    }
  }

  /**
   * Aplica un movimiento de gasto a los sobres.
   */
  function aplicarMovimientoAGastosYSobres(mov) {
    if (!mov || !mov.tipo) return;
    if (mov.tipo === 'gasto') {
      descontarDeSobrePorCategoria(mov.categoria, parseFloat(mov.monto));
    }
  }

  /**
   * Aplica animación de ingreso a un sobre, mostrando un chip flotante y un pulso.
   * @param {string} sobreId
   * @param {number} monto
   */
  function animarIngresoSobre(sobreId, monto) {
    const card = document.querySelector(`.sobre-card[data-sobre-id="${sobreId}"]`);
    if (!card) return;
    // Pulso
    card.classList.add('sobre-income-anim');
    setTimeout(() => card.classList.remove('sobre-income-anim'), 900);
    // Chip flotante
    const layer = card.querySelector('.sobre-anim-layer');
    if (layer) {
      const chip = document.createElement('div');
      chip.className = 'sobre-chip ingreso';
      chip.textContent = `+${formatCurrency(monto)}`;
      layer.appendChild(chip);
      setTimeout(() => {
        if (chip && chip.parentNode) chip.remove();
      }, 1000);
    }
  }

  /**
   * Aplica animación de gasto a un sobre, mostrando un chip flotante y un efecto de temblor.
   * @param {string} sobreId
   * @param {number} monto
   */
  function animarGastoSobre(sobreId, monto) {
    const card = document.querySelector(`.sobre-card[data-sobre-id="${sobreId}"]`);
    if (!card) return;
    // Temblor
    card.classList.add('sobre-expense-anim');
    setTimeout(() => card.classList.remove('sobre-expense-anim'), 500);
    // Chip flotante
    const layer = card.querySelector('.sobre-anim-layer');
    if (layer) {
      const chip = document.createElement('div');
      chip.className = 'sobre-chip gasto';
      chip.textContent = `-${formatCurrency(monto)}`;
      layer.appendChild(chip);
      setTimeout(() => {
        if (chip && chip.parentNode) chip.remove();
      }, 1000);
    }
  }

  /**
   * Carga las opciones de sobres en el selector de movimiento (mov-sobre)
   * Mostrará como "S01 – Renta". Si no hay sobres, queda vacío.
   */
  function cargarSelectorSobres() {
    const select = document.querySelector('#mov-sobre');
    if (!select) return;
    cargarSobres();
    select.innerHTML = '';
    sobres.forEach((sobre) => {
      const option = document.createElement('option');
      option.value = sobre.id;
      option.textContent = `${sobre.codigo || ''} – ${sobre.nombre}`;
      select.appendChild(option);
    });
  }

  // Variable global para editar sobres
  let editingSobreId = null;

  /**
   * Muestra el formulario para editar un sobre existente.
   */
  function editarSobre(id) {
    cargarSobres();
    const sobre = sobres.find((s) => s.id === id);
    if (!sobre) return;
    editingSobreId = id;
    const formContainer = document.getElementById('sobre-form-container');
    const formTitle = document.getElementById('sobre-form-title');
    const nombreInput = document.getElementById('sobre-nombre');
    const tipoSelect = document.getElementById('sobre-tipo');
    const limiteInput = document.getElementById('sobre-limite');
    const prioridadInput = document.getElementById('sobre-prioridad');
    const categoriaSelect = document.getElementById('sobre-categoria');
    const metodoSelect = document.getElementById('sobre-metodo');
    const categoriaDistSelect = document.getElementById('sobre-categoria-distribucion');
    const diaPagoInput = document.getElementById('sobre-dia-pago');
    if (formContainer && formTitle && nombreInput && tipoSelect && limiteInput && prioridadInput && categoriaSelect && metodoSelect) {
      formTitle.textContent = 'Editar sobre';
      nombreInput.value = sobre.nombre || '';
      tipoSelect.value = sobre.tipo || 'fijo';
      limiteInput.value = sobre.limite || '';
      // Establecer nivel de prioridad (alta, media, baja)
      if (prioridadInput) prioridadInput.value = sobre.prioridadNivel || 'alta';
      // Establecer categoría de distribución (necesidad, deseo, ahorro)
      if (categoriaDistSelect) categoriaDistSelect.value = sobre.categoriaDistribucion || 'necesidad';
      // Establecer día de pago si corresponde
      if (diaPagoInput) diaPagoInput.value = sobre.diaPago || '';
      // Categoría vinculada para gastos
      categoriaSelect.value = sobre.categoriaVinculada || '';
      // Método de distribución global
      metodoSelect.value = localStorage.getItem('metodoDistribucionSobres') || metodoDistribucionSobres;
      const limiteGroup = document.getElementById('sobre-limite-group');
      if (limiteGroup) {
        limiteGroup.style.display = sobre.tipo === 'fijo' ? '' : 'none';
      }
      const diaPagoGroup = document.getElementById('grupo-dia-pago');
      if (diaPagoGroup) {
        diaPagoGroup.style.display = sobre.tipo === 'fijo' ? '' : 'none';
      }
      formContainer.classList.remove('hidden');
    }
  }
  // Ajustes de usuario almacenados en LocalStorage
  let ajustes = JSON.parse(localStorage.getItem('ajustes')) || {
    userName: '',
    currency: 'USD',
    darkMode: false,
    animations: true,
    fontSize: 'med', // valores: small, med, large
    contrast: false  // modo visión amigable
  };

  // Función para cambiar de vista
  function showView(viewId) {
    views.forEach((view) => {
      if (view.id === viewId) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });
    navItems.forEach((item) => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Cuando se muestra una vista, actualizar sus datos dinámicos si corresponde
    switch (viewId) {
      case 'movimientos':
        actualizarVistaMovimientos();
        break;
      case 'cuentas':
        actualizarVistaCuentas();
        break;
      case 'prestamos':
        actualizarVistaPrestamos();
        break;
      case 'calendario':
        actualizarVistaCalendario();
        break;
      case 'presupuesto':
        actualizarVistaSobres();
        break;
      case 'exportar':
        // exportar view doesn’t need dynamic update yet
        break;
      case 'ajustes':
        cargarAjustes();
        break;
    }
  }

  // Event listeners para navegación
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      showView(targetView);
      // Cuando se entra a movimientos, renderizar la tabla
      if (targetView === 'movimientos') {
        actualizarVistaMovimientos();
      }
      if (targetView === 'cuentas') {
        actualizarVistaCuentas();
      }
    });
  });

  // ==================== Ajuste del formulario de movimiento para sobres ====================
  const tipoMovimientoInput = document.querySelector('#mov-tipo');
  const grupoSobre = document.querySelector('#grupo-sobre');
  if (tipoMovimientoInput && grupoSobre) {
    tipoMovimientoInput.addEventListener('change', () => {
      const val = tipoMovimientoInput.value.toLowerCase();
      if (val === 'gasto') {
        grupoSobre.style.display = 'block';
        cargarSelectorSobres();
      } else {
        grupoSobre.style.display = 'none';
      }
    });
    // Inicializar la visibilidad al cargar la página
    const initVal = tipoMovimientoInput.value.toLowerCase();
    if (initVal === 'gasto') {
      grupoSobre.style.display = 'block';
      cargarSelectorSobres();
    } else {
      grupoSobre.style.display = 'none';
    }
  }

  /**
   * Obtiene el nombre del mes en español a partir del número del mes.
   * @param {number} monthIndex - 0 para enero, 11 para diciembre.
   */
  function getMonthName(monthIndex) {
    const months = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre'
    ];
    return months[monthIndex];
  }

  /**
   * Guarda las transacciones en LocalStorage.
   */
  function saveMovimientos() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(movimientos));
  }

  /**
   * Actualiza las tarjetas de resumen en el dashboard (ingresos, gastos y balance).
   */
  function updateDashboard() {
    // Elementos del nuevo dashboard
    const incomeEl = document.getElementById('income-summary-value');
    const expenseEl = document.getElementById('expense-summary-value');
    const balanceEl = document.getElementById('balance-summary-value');
    const differenceEl = document.getElementById('difference-summary-value');

    // Determinar el mes actual (respectando la zona horaria del usuario)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filtrar transacciones del mes actual
    let incomeTotal = 0;
    let expenseTotal = 0;
    movimientos.forEach((mov) => {
      const txDate = new Date(mov.fecha);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (mov.tipo === 'ingreso') {
          incomeTotal += parseFloat(mov.monto);
        } else {
          expenseTotal += parseFloat(mov.monto);
        }
      }
    });

    const balance = incomeTotal - expenseTotal;
    // Calcular diferencia vs mes anterior
    let prevIncome = 0;
    let prevExpense = 0;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    movimientos.forEach((mov) => {
      const txDate = new Date(mov.fecha);
      if (txDate.getMonth() === prevMonth && txDate.getFullYear() === prevYear) {
        if (mov.tipo === 'ingreso') prevIncome += parseFloat(mov.monto);
        else prevExpense += parseFloat(mov.monto);
      }
    });
    const prevBalance = prevIncome - prevExpense;
    const diff = balance - prevBalance;
    // Actualizar elementos del DOM
    incomeEl.textContent = formatCurrency(incomeTotal);
    expenseEl.textContent = formatCurrency(expenseTotal);
    balanceEl.textContent = formatCurrency(balance);
    if (prevIncome === 0 && prevExpense === 0) {
      differenceEl.textContent = '–';
    } else {
      // Agregar signo positivo para valores positivos
      const sign = diff > 0 ? '+' : '';
      differenceEl.textContent = `${sign}${formatCurrency(diff)}`;
    }

    // Actualizar métricas de cuentas bancarias en el dashboard a partir de las cuentas registradas
    const accountsTotalEl = document.getElementById('accounts-total');
    const accountsLiquidEl = document.getElementById('accounts-liquid');
    const accountsDebtEl = document.getElementById('accounts-debt');
    if (accountsTotalEl && accountsLiquidEl && accountsDebtEl) {
      // Sumar saldos de todas las cuentas
      const totalCuentas = cuentas.reduce((sum, c) => sum + parseFloat(c.saldo || 0), 0);
      accountsTotalEl.textContent = formatCurrency(totalCuentas);
      accountsLiquidEl.textContent = formatCurrency(totalCuentas);
      // Placeholder para deudas (0 por ahora)
      accountsDebtEl.textContent = formatCurrency(0);
    }
    // Actualizar gráfico
    updateBarChart(incomeTotal, expenseTotal);

    // Actualizar distribución de sobres en el dashboard
    actualizarDistribucionSobresEnDashboard();
  }

  /**
   * Formatea un número a moneda local en dólares con dos decimales.
   * @param {number} value
   */
  function formatCurrency(value) {
    // Utiliza la moneda configurada en ajustes o USD por defecto
    const ajustesCurrency = JSON.parse(localStorage.getItem('ajustes'))?.currency || 'USD';
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: ajustesCurrency }).format(value);
  }

  /**
   * Formatea una cantidad utilizando moneda dominicana por defecto (DOP).
   * @param {number} valor
   * @returns {string}
   */
  function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(valor || 0);
  }

  /**
   * Devuelve el número de días que tiene un mes determinado.
   * @param {number} mes Índice del mes (0 = enero)
   * @param {number} anio Año completo (ej. 2025)
   * @returns {number} Número de días del mes
   */
  function diasDelMes(mes, anio) {
    return new Date(anio, mes + 1, 0).getDate();
  }

  /**
   * Genera eventos de pagos fijos para sobres tipo 'fijo' con día de pago establecido.
   * Devuelve un arreglo de objetos { tipo, fecha, titulo, sobreId, montoEstimado }.
   * @param {number} mes Índice del mes (0 = enero)
   * @param {number} anio Año completo
   */
  function generarEventosPagosFijosParaCalendario(mes, anio) {
    cargarSobres();
    const eventos = [];
    sobres
      .filter((s) => s.tipo === 'fijo' && s.diaPago)
      .forEach((sobre) => {
        // Determinar día válido para el mes (por si sobre.diaPago > número de días del mes)
        const dia = Math.min(sobre.diaPago, diasDelMes(mes, anio));
        const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        eventos.push({
          tipo: 'pagoFijo',
          fecha: fechaStr,
          titulo: `Pagar ${sobre.nombre}`,
          sobreId: sobre.id,
          montoEstimado: sobre.limite || sobre.saldo || 0
        });
      });
    return eventos;
  }

  /**
   * Obtiene el mes y año actualmente seleccionados en el calendario.
   * @returns {{mes: number, anio: number}}
   */
  function obtenerMesYAnioSeleccionados() {
    // calMonth y calYear son variables globales que controlan la vista del calendario
    return { mes: calMonth, anio: calYear };
  }

  /**
   * Genera la lista de eventos financieros del mes combinando pagos fijos de sobres
   * y cuotas de préstamos para el mes y año dados.
   * @param {number} mes Índice del mes (0 = enero)
   * @param {number} anio Año completo
   * @returns {Array} Lista de eventos [{tipo, nombre, fecha, monto, estado}]
   */
  function generarAgendaFinanciera(mes, anio) {
    // Cargar sobres y préstamos desde LocalStorage para asegurar datos actualizados
    cargarSobres();
    const prestamosData = JSON.parse(localStorage.getItem('prestamos')) || prestamos || [];
    const agenda = [];
    // Sobres fijos con día de pago
    sobres
      .filter((s) => s.tipo === 'fijo' && s.diaPago)
      .forEach((s) => {
        const dia = Math.min(s.diaPago, diasDelMes(mes, anio));
        const fecha = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const monto = s.limite || s.saldo || 0;
        agenda.push({
          tipo: 'sobreFijo',
          nombre: `Pagar ${s.nombre}`,
          fecha: fecha,
          monto: parseFloat(monto),
          estado: 'pendiente'
        });
      });
    // Cuotas de préstamos en el mes
    if (prestamosData && prestamosData.length) {
      prestamosData.forEach((p) => {
        if (!p.cronograma || !Array.isArray(p.cronograma)) return;
        const pagadasList = p.pagadas || [];
        p.cronograma.forEach((c, idx) => {
          const d = new Date(c.fecha);
          if (d.getFullYear() === anio && d.getMonth() === mes) {
            const estaPagada = pagadasList.includes(idx + 1);
            agenda.push({
              tipo: 'prestamo',
              nombre: `Cuota préstamo: ${p.nombre}`,
              fecha: c.fecha,
              monto: parseFloat(c.cuota_total || c.cuota_total === 0 ? c.cuota_total : c.interes + c.capital),
              estado: estaPagada ? 'ok' : 'pendiente'
            });
          }
        });
      });
    }
    // Ordenar por fecha ascendente
    agenda.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return agenda;
  }

  /**
   * Muestra en pantalla la agenda financiera del mes y año seleccionados, calculando
   * totales pagados y pendientes y aplicando clases visuales según el estado.
   * @param {number} mes Índice del mes (0 = enero)
   * @param {number} anio Año completo
   */
  function mostrarAgendaFinanciera(mes, anio) {
    const lista = document.querySelector('#agenda-lista');
    const totalEl = document.querySelector('#agenda-total');
    const pagadoEl = document.querySelector('#agenda-pagado');
    const pendienteEl = document.querySelector('#agenda-pendiente');
    if (!lista || !totalEl || !pagadoEl || !pendienteEl) return;
    const agenda = generarAgendaFinanciera(mes, anio);
    lista.innerHTML = '';
    let total = 0;
    let pagadoTotal = 0;
    const now = new Date();
    agenda.forEach((e) => {
      total += parseFloat(e.monto) || 0;
      if (e.estado === 'ok') pagadoTotal += parseFloat(e.monto) || 0;
      // Determinar clase de estado: ok (verde), proximo (amarillo) o pendiente (rojo)
      let estadoClase = e.estado;
      if (e.estado !== 'ok') {
        const fechaEvento = new Date(e.fecha);
        estadoClase = fechaEvento > now ? 'proximo' : 'pendiente';
      }
      const div = document.createElement('div');
      div.className = `agenda-item ${estadoClase}`;
      div.innerHTML = `
        <div class="texto">
          <strong>${e.nombre}</strong><br>
          <small>${e.fecha}</small>
        </div>
        <div class="monto">${typeof formatearMoneda === 'function' ? formatearMoneda(e.monto) : e.monto}</div>
      `;
      lista.appendChild(div);
    });
    totalEl.textContent = typeof formatearMoneda === 'function' ? formatearMoneda(total) : total;
    pagadoEl.textContent = typeof formatearMoneda === 'function' ? formatearMoneda(pagadoTotal) : pagadoTotal;
    pendienteEl.textContent = typeof formatearMoneda === 'function' ? formatearMoneda(total - pagadoTotal) : total - pagadoTotal;
  }

  /**
   * Actualiza el gráfico de barras del dashboard. Muestra dos barras: ingresos y gastos
   * del mes actual, ajustando la altura relativa según el máximo.
   * @param {number} incomeTotal
   * @param {number} expenseTotal
   */
  function updateBarChart(incomeTotal, expenseTotal) {
    const chart = document.getElementById('bar-chart');
    chart.innerHTML = '';
    const maxVal = Math.max(incomeTotal, expenseTotal, 1);
    // Crear barra de ingresos
    const incomeBar = document.createElement('div');
    incomeBar.classList.add('bar', 'income');
    incomeBar.style.height = `${(incomeTotal / maxVal) * 100}%`;
    const incomeLabel = document.createElement('span');
    incomeLabel.classList.add('bar-label');
    incomeLabel.textContent = 'Ingresos';
    incomeBar.appendChild(incomeLabel);
    // Crear barra de gastos
    const expenseBar = document.createElement('div');
    expenseBar.classList.add('bar', 'expense');
    expenseBar.style.height = `${(expenseTotal / maxVal) * 100}%`;
    const expenseLabel = document.createElement('span');
    expenseLabel.classList.add('bar-label');
    expenseLabel.textContent = 'Gastos';
    expenseBar.appendChild(expenseLabel);
    // Añadir a la gráfica
    chart.appendChild(incomeBar);
    chart.appendChild(expenseBar);
  }

  /**
   * Calcula la distribución porcentual de los sobres según su categoría de distribución
   * (necesidad, deseo, ahorro) y actualiza las barras del dashboard.
   */
  function actualizarDistribucionSobresEnDashboard() {
    const needBar = document.querySelector('.distribution-bar.need');
    const wantBar = document.querySelector('.distribution-bar.want');
    const savingBar = document.querySelector('.distribution-bar.saving');
    if (!needBar || !wantBar || !savingBar) return;
    cargarSobres();
    if (!sobres || sobres.length === 0) {
      // Restablecer a 0 si no hay sobres
      needBar.style.width = '0%';
      wantBar.style.width = '0%';
      savingBar.style.width = '0%';
      needBar.querySelector('span').textContent = '0% Necesidades';
      wantBar.querySelector('span').textContent = '0% Deseos';
      savingBar.querySelector('span').textContent = '0% Ahorro';
      return;
    }
    // Calcular totales; usar saldo para variables y fijos, o límite si el sobre está fijo y su saldo supera el límite.
    let totalNecesidades = 0;
    let totalDeseos = 0;
    let totalAhorro = 0;
    sobres.forEach((s) => {
      // Tomar saldo asignado para determinar la distribución
      const valor = parseFloat(s.saldo) || 0;
      if (s.categoriaDistribucion === 'necesidad') totalNecesidades += valor;
      else if (s.categoriaDistribucion === 'deseo') totalDeseos += valor;
      else if (s.categoriaDistribucion === 'ahorro') totalAhorro += valor;
    });
    const totalGeneral = totalNecesidades + totalDeseos + totalAhorro;
    if (totalGeneral === 0) {
      // Evitar división entre cero
      needBar.style.width = '0%';
      wantBar.style.width = '0%';
      savingBar.style.width = '0%';
      needBar.querySelector('span').textContent = '0% Necesidades';
      wantBar.querySelector('span').textContent = '0% Deseos';
      savingBar.querySelector('span').textContent = '0% Ahorro';
      return;
    }
    const pctNec = (totalNecesidades / totalGeneral) * 100;
    const pctDes = (totalDeseos / totalGeneral) * 100;
    const pctAh = (totalAhorro / totalGeneral) * 100;
    needBar.style.width = `${pctNec}%`;
    wantBar.style.width = `${pctDes}%`;
    savingBar.style.width = `${pctAh}%`;
    needBar.querySelector('span').textContent = `${Math.round(pctNec)}% Necesidades`;
    wantBar.querySelector('span').textContent = `${Math.round(pctDes)}% Deseos`;
    savingBar.querySelector('span').textContent = `${Math.round(pctAh)}% Ahorro`;
  }


  /**
   * Nota: Las funciones `populateMonthFilter` y `renderTransactions` y los filtros
   * de la versión anterior han sido eliminados en favor del nuevo módulo de
   * movimientos con tarjetas y filtros avanzados. Las referencias a
   * `#filter-type`, `#filter-month` y la antigua tabla han sido retiradas.
   */

  /**
   * Muestra un mensaje de confirmación tipo iOS (toast).
   * @param {string} message
   */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    // Permitir que CSS capte el cambio de clase para la animación
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  /**
   * Cargar los movimientos desde LocalStorage en la variable movimientos.
   */
  function cargarMovimientos() {
    movimientos = JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  }

  /**
   * Filtra la lista de movimientos según los filtros avanzados y la búsqueda.
   * @returns {Array} lista filtrada de movimientos
   */
  function filtrarMovimientos() {
    // Cargar filtro de tipo, rango, categoría y búsqueda
    const typeSelect = document.getElementById('mov-filter-type');
    const rangeSelect = document.getElementById('mov-filter-range');
    const categorySelect = document.getElementById('mov-filter-category');
    const searchInput = document.getElementById('mov-search');
    const typeFilter = typeSelect ? typeSelect.value : 'todos';
    const rangeFilter = rangeSelect ? rangeSelect.value : 'todos';
    const categoryFilter = categorySelect ? categorySelect.value : 'todas';
    const searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const now = new Date();
    // Definir inicio y fin según el rango seleccionado
    let startDate = null;
    let endDate = null;
    if (rangeFilter === 'hoy') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (rangeFilter === 'semana') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (rangeFilter === 'mes') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    return movimientos.filter((mov) => {
      // Tipo
      if (typeFilter !== 'todos' && mov.tipo !== typeFilter) {
        return false;
      }
      // Categoría
      if (categoryFilter !== 'todas' && mov.categoria !== categoryFilter) {
        return false;
      }
      // Rango de fecha
      if (startDate && endDate) {
        const movDate = new Date(mov.fecha);
        if (!(movDate >= startDate && movDate < endDate)) {
          return false;
        }
      }
      // Búsqueda por texto libre en nota, categoría o monto
      if (searchText) {
        const amountString = parseFloat(mov.monto).toFixed(2);
        const composite = `${mov.categoria} ${mov.nota} ${amountString}`.toLowerCase();
        if (!composite.includes(searchText)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  /**
   * Actualiza la vista de movimientos: filtros, lista y resumen.
   */
  function actualizarVistaMovimientos() {
    cargarMovimientos();
    // Obtener select de categorías y poblar opciones dinámicamente
    const categorySelect = document.getElementById('mov-filter-category');
    if (categorySelect) {
      // Guardar valor actual para mantener la selección
      const currentValue = categorySelect.value || 'todas';
      // Obtener categorías únicas
      const categories = Array.from(new Set(movimientos.map((m) => m.categoria))).filter(Boolean);
      // Resetear opciones
      categorySelect.innerHTML = '';
      const optTodas = document.createElement('option');
      optTodas.value = 'todas';
      optTodas.textContent = 'Todas';
      categorySelect.appendChild(optTodas);
      categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
      });
      // Restaurar selección si todavía existe
      if (Array.from(categorySelect.options).some((o) => o.value === currentValue)) {
        categorySelect.value = currentValue;
      }
    }
    const filtered = filtrarMovimientos();
    // Resumen: ingresos, gastos y balance
    let totalIngreso = 0;
    let totalGasto = 0;
    filtered.forEach((m) => {
      if (m.tipo === 'ingreso') totalIngreso += parseFloat(m.monto);
      else totalGasto += parseFloat(m.monto);
    });
    const movIngresosTotalEl = document.getElementById('mov-ingresos-total');
    const movGastosTotalEl = document.getElementById('mov-gastos-total');
    const movBalanceTotalEl = document.getElementById('mov-balance-total');
    if (movIngresosTotalEl) movIngresosTotalEl.textContent = formatCurrency(totalIngreso);
    if (movGastosTotalEl) movGastosTotalEl.textContent = formatCurrency(totalGasto);
    if (movBalanceTotalEl) movBalanceTotalEl.textContent = formatCurrency(totalIngreso - totalGasto);
    // Renderizar lista
    const listEl = document.getElementById('movimientos-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No hay movimientos para mostrar.';
      empty.style.textAlign = 'center';
      listEl.appendChild(empty);
      return;
    }
    filtered.forEach((mov) => {
      const card = document.createElement('div');
      card.classList.add('mov-card');
      card.classList.add(mov.tipo); // clase ingreso o gasto
      // Header
      const header = document.createElement('div');
      header.classList.add('mov-card-header');
      const typeSpan = document.createElement('span');
      typeSpan.classList.add('mov-card-type');
      typeSpan.textContent = mov.tipo === 'ingreso' ? 'Ingreso' : 'Gasto';
      const amountSpan = document.createElement('span');
      amountSpan.classList.add('mov-card-amount');
      const sign = mov.tipo === 'ingreso' ? '+' : '-';
      amountSpan.textContent = `${sign}${formatCurrency(parseFloat(mov.monto))}`;
      header.appendChild(typeSpan);
      header.appendChild(amountSpan);
      // Body
      const body = document.createElement('div');
      body.classList.add('mov-card-body');
      const catP = document.createElement('p');
      catP.classList.add('mov-category');
      catP.textContent = mov.categoria || '-';
      const noteP = document.createElement('p');
      noteP.classList.add('mov-note');
      noteP.textContent = mov.nota || '';
      body.appendChild(catP);
      body.appendChild(noteP);
      // Footer
      const footer = document.createElement('div');
      footer.classList.add('mov-card-footer');
      const dateSpan = document.createElement('span');
      dateSpan.classList.add('mov-date');
      dateSpan.textContent = new Date(mov.fecha).toLocaleDateString('es-DO');
      footer.appendChild(dateSpan);
      // Compose card
      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(footer);
      listEl.appendChild(card);
    });
  }

  /**
   * Cargar cuentas desde LocalStorage
   */
  function cargarCuentas() {
    cuentas = JSON.parse(localStorage.getItem('cuentas')) || [];
  }

  /**
   * Guardar el arreglo de cuentas en LocalStorage
   */
  function guardarCuentas() {
    localStorage.setItem('cuentas', JSON.stringify(cuentas));
  }

  /**
   * Actualizar la vista de cuentas: resumen y tarjetas.
   */
  function actualizarVistaCuentas() {
    cargarCuentas();
    // Calcular totales
    const totalSaldo = cuentas.reduce((sum, c) => sum + parseFloat(c.saldo || 0), 0);
    const liquidez = totalSaldo; // simplificación
    const deuda = 0; // placeholder
    const totalEl = document.getElementById('cuentas-total-saldo');
    const liquidezEl = document.getElementById('cuentas-liquidez');
    const deudaEl = document.getElementById('cuentas-deuda');
    if (totalEl) totalEl.textContent = formatCurrency(totalSaldo);
    if (liquidezEl) liquidezEl.textContent = formatCurrency(liquidez);
    if (deudaEl) deudaEl.textContent = formatCurrency(deuda);
    // Renderizar tarjetas
    const listEl = document.getElementById('cuentas-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    // Ordenar para que las más recientes aparezcan arriba
    cuentas.slice().reverse().forEach((cuenta) => {
      const card = document.createElement('div');
      card.classList.add('account-card');
      card.setAttribute('data-id', cuenta.id);
      const nameEl = document.createElement('div');
      nameEl.classList.add('account-name');
      nameEl.textContent = cuenta.nombre;
      const typeEl = document.createElement('div');
      typeEl.classList.add('account-type');
      typeEl.textContent = cuenta.tipo.charAt(0).toUpperCase() + cuenta.tipo.slice(1);
      const balanceEl = document.createElement('div');
      balanceEl.classList.add('account-balance');
      balanceEl.textContent = formatCurrency(parseFloat(cuenta.saldo));
      const updatedEl = document.createElement('div');
      updatedEl.classList.add('account-updated');
      updatedEl.textContent = cuenta.actualizacion ? new Date(cuenta.actualizacion).toLocaleDateString('es-DO') : '';
      card.appendChild(nameEl);
      card.appendChild(typeEl);
      card.appendChild(balanceEl);
      card.appendChild(updatedEl);
      // Click para editar
      card.addEventListener('click', () => {
        // Encontrar la cuenta y cargar datos en el formulario
        const cuentaId = cuenta.id;
        editarCuenta(cuentaId);
      });
      listEl.appendChild(card);
    });
  }

  // Estado actual de edición de cuenta (null para nueva)
  let cuentaEditId = null;

  /**
   * Llenar el formulario de cuentas para editar una existente
   * @param {string} id
   */
  function editarCuenta(id) {
    cargarCuentas();
    const cuenta = cuentas.find((c) => c.id === id);
    if (!cuenta) return;
    cuentaEditId = id;
    const nombreEl = document.getElementById('cuenta-nombre');
    const tipoEl = document.getElementById('cuenta-tipo');
    const saldoEl = document.getElementById('cuenta-saldo');
    const notaEl = document.getElementById('cuenta-nota');
    if (nombreEl) nombreEl.value = cuenta.nombre;
    if (tipoEl) tipoEl.value = cuenta.tipo;
    if (saldoEl) saldoEl.value = parseFloat(cuenta.saldo);
    if (notaEl) notaEl.value = cuenta.nota || '';
    const titleEl = document.getElementById('cuenta-form-title');
    if (titleEl) titleEl.textContent = 'Editar cuenta';
  }

  /**
   * Manejar envío del formulario de cuentas para agregar o editar
   */
  const cuentaForm = document.getElementById('cuenta-form');
  if (cuentaForm) {
    cuentaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('cuenta-nombre').value.trim();
      const tipo = document.getElementById('cuenta-tipo').value;
      const saldoVal = document.getElementById('cuenta-saldo').value;
      const nota = document.getElementById('cuenta-nota').value.trim();
      if (!nombre) {
        showToast('Introduce un nombre para la cuenta');
        return;
      }
      if (!tipo) {
        showToast('Selecciona un tipo de cuenta');
        return;
      }
      if (!saldoVal || isNaN(saldoVal)) {
        showToast('Introduce un saldo válido');
        return;
      }
      const saldo = parseFloat(saldoVal).toFixed(2);
      cargarCuentas();
      if (cuentaEditId) {
        // Editar existente
        const idx = cuentas.findIndex((c) => c.id === cuentaEditId);
        if (idx !== -1) {
          cuentas[idx] = {
            ...cuentas[idx],
            nombre,
            tipo,
            saldo,
            nota,
            actualizacion: new Date().toISOString()
          };
        }
      } else {
        // Agregar nueva
        const nuevaCuenta = {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          nombre,
          tipo,
          saldo,
          nota,
          actualizacion: new Date().toISOString()
        };
        cuentas.push(nuevaCuenta);
      }
      guardarCuentas();
      // Resetear formulario
      cuentaForm.reset();
      cuentaEditId = null;
      const titleEl = document.getElementById('cuenta-form-title');
      if (titleEl) titleEl.textContent = 'Agregar cuenta';
      actualizarVistaCuentas();
      updateDashboard();
      showToast('Cuenta guardada');
    });
  }

  /**
   * Eventos para filtros y búsqueda de movimientos
   */
  const filterTypeSelect = document.getElementById('mov-filter-type');
  const filterRangeSelect = document.getElementById('mov-filter-range');
  const filterCategorySelect = document.getElementById('mov-filter-category');
  const searchInput = document.getElementById('mov-search');
  if (filterTypeSelect) {
    filterTypeSelect.addEventListener('change', actualizarVistaMovimientos);
  }
  if (filterRangeSelect) {
    filterRangeSelect.addEventListener('change', actualizarVistaMovimientos);
  }
  if (filterCategorySelect) {
    filterCategorySelect.addEventListener('change', actualizarVistaMovimientos);
  }
  if (searchInput) {
    searchInput.addEventListener('input', actualizarVistaMovimientos);
  }

  // Botones de historial mensual
  const btnMesActual = document.getElementById('btn-mes-actual');
  const btnHistorial = document.getElementById('btn-historial');
  if (btnMesActual) {
    btnMesActual.addEventListener('click', () => {
      const rangeSelect = document.getElementById('mov-filter-range');
      if (rangeSelect) {
        rangeSelect.value = 'mes';
        actualizarVistaMovimientos();
      }
    });
  }
  if (btnHistorial) {
    btnHistorial.addEventListener('click', () => {
      const rangeSelect = document.getElementById('mov-filter-range');
      if (rangeSelect) {
        rangeSelect.value = 'todos';
        actualizarVistaMovimientos();
      }
    });
  }

  /* ===================================================================== */
  /* ======================= MÓDULO DE PRÉSTAMOS ========================= */

  /**
   * Guarda el arreglo de préstamos en LocalStorage.
   */
  function guardarPrestamos() {
    localStorage.setItem('prestamos', JSON.stringify(prestamos));
  }

  /**
   * Calcula el cronograma de un préstamo con método francés (amortización
   * constante). Retorna un arreglo de objetos de cuota.
   * @param {number} principal Monto del préstamo
   * @param {number} annualRate Porcentaje anual (ej. 15 para 15%)
   * @param {number} months Número de cuotas mensuales
   * @param {string} startDate Fecha del primer pago (YYYY-MM-DD)
   */
  function calcularFrancesa(principal, annualRate, months, startDate) {
    const schedule = [];
    const r = (annualRate / 100) / 12;
    const cuota = principal * r / (1 - Math.pow(1 + r, -months));
    let saldo = principal;
    let fecha = new Date(startDate);
    for (let i = 1; i <= months; i++) {
      const interes = saldo * r;
      const capital = cuota - interes;
      saldo = saldo - capital;
      schedule.push({
        cuota: i,
        fecha: fecha.toISOString().split('T')[0],
        interes: parseFloat(interes.toFixed(2)),
        capital: parseFloat(capital.toFixed(2)),
        cuota_total: parseFloat(cuota.toFixed(2)),
        saldo_restante: parseFloat(saldo.toFixed(2))
      });
      // avanzar un mes
      fecha.setMonth(fecha.getMonth() + 1);
    }
    return schedule;
  }

  /**
   * Calcula el cronograma de un préstamo con método americano (solo intereses
   * hasta el último pago). Devuelve arreglo de cuotas.
   */
  function calcularAmericana(principal, annualRate, months, startDate) {
    const schedule = [];
    const r = (annualRate / 100) / 12;
    let saldo = principal;
    let fecha = new Date(startDate);
    for (let i = 1; i <= months; i++) {
      const interes = saldo * r;
      let capital = 0;
      let cuotaTotal = interes;
      if (i === months) {
        capital = principal;
        cuotaTotal = interes + principal;
        saldo = 0;
      }
      schedule.push({
        cuota: i,
        fecha: fecha.toISOString().split('T')[0],
        interes: parseFloat(interes.toFixed(2)),
        capital: parseFloat(capital.toFixed(2)),
        cuota_total: parseFloat(cuotaTotal.toFixed(2)),
        saldo_restante: parseFloat(saldo.toFixed(2))
      });
      fecha.setMonth(fecha.getMonth() + 1);
    }
    return schedule;
  }

  /**
   * Calcula un cronograma aproximado para un préstamo con interés compuesto
   * diario. Se calcula una tasa efectiva mensual basada en un mes de 30 días.
   */
  function calcularInteresCompuestoDiario(principal, annualRate, months, startDate) {
    const schedule = [];
    const dailyRate = (annualRate / 100) / 365;
    // Usar mes de 30 días para tasa efectiva
    const effectiveMonthlyRate = Math.pow(1 + dailyRate, 30) - 1;
    const cuota = principal * effectiveMonthlyRate / (1 - Math.pow(1 + effectiveMonthlyRate, -months));
    let saldo = principal;
    let fecha = new Date(startDate);
    for (let i = 1; i <= months; i++) {
      const interes = saldo * effectiveMonthlyRate;
      const capital = cuota - interes;
      saldo = saldo - capital;
      schedule.push({
        cuota: i,
        fecha: fecha.toISOString().split('T')[0],
        interes: parseFloat(interes.toFixed(2)),
        capital: parseFloat(capital.toFixed(2)),
        cuota_total: parseFloat(cuota.toFixed(2)),
        saldo_restante: parseFloat(saldo.toFixed(2))
      });
      fecha.setMonth(fecha.getMonth() + 1);
    }
    return schedule;
  }

  /**
   * Actualiza la vista de préstamos, mostrando la lista de préstamos activos
   * con progreso y resúmenes.
   */
  function actualizarVistaPrestamos() {
    const listEl = document.getElementById('prestamos-list');
    const formContainer = document.getElementById('prestamo-form-container');
    if (!listEl) return;
    listEl.innerHTML = '';
    // Cerrar detalle
    const detalleContainer = document.getElementById('prestamo-detalle-container');
    if (detalleContainer) {
      detalleContainer.classList.add('hidden');
      detalleContainer.innerHTML = '';
    }
    if (prestamos.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No hay préstamos registrados.';
      empty.style.textAlign = 'center';
      listEl.appendChild(empty);
      return;
    }
    // Ordenar por fecha de inicio descendente
    prestamos.slice().reverse().forEach((p) => {
      const card = document.createElement('div');
      card.classList.add('loan-card');
      card.setAttribute('data-id', p.id);
      // Nombre y tipo
      const nameEl = document.createElement('div');
      nameEl.classList.add('loan-name');
      nameEl.textContent = p.nombre;
      const infoEl = document.createElement('div');
      infoEl.classList.add('loan-info');
      infoEl.textContent = `${p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)} • Monto: ${formatCurrency(parseFloat(p.monto))}`;
      // Progreso de pagos
      const progressEl = document.createElement('div');
      progressEl.classList.add('loan-progress');
      const progressBar = document.createElement('span');
      // calcular progreso (número de cuotas pagadas vs total)
      const totalCuotas = p.cronograma.length;
      const pagadas = p.pagadas ? p.pagadas.length : 0;
      const porcentaje = totalCuotas ? Math.min(100, (pagadas / totalCuotas) * 100) : 0;
      progressBar.style.width = `${porcentaje}%`;
      progressEl.appendChild(progressBar);
      // Métricas: próximo pago y capital pendiente
      const metricsEl = document.createElement('div');
      metricsEl.classList.add('loan-metrics');
      // Encontrar próxima cuota pendiente
      let proxima = p.cronograma.find((c, idx) => !(p.pagadas || []).includes(idx + 1));
      const proximaFecha = proxima ? new Date(proxima.fecha).toLocaleDateString('es-DO') : '-';
      // capital pendiente = saldo restante de última cuota pendiente
      const saldoPend = proxima ? proxima.saldo_restante + proxima.capital : 0;
      const nextEl = document.createElement('span');
      nextEl.textContent = `Próximo: ${proximaFecha}`;
      const saldoEl = document.createElement('span');
      saldoEl.textContent = `Pendiente: ${formatCurrency(parseFloat(saldoPend || p.monto))}`;
      metricsEl.appendChild(nextEl);
      metricsEl.appendChild(saldoEl);
      card.appendChild(nameEl);
      card.appendChild(infoEl);
      card.appendChild(progressEl);
      card.appendChild(metricsEl);
      // Click para mostrar detalle
      card.addEventListener('click', () => {
        mostrarDetallePrestamo(p.id);
      });
      listEl.appendChild(card);
    });
  }

  /**
   * Muestra el detalle de un préstamo seleccionado: resumen y cronograma.
   * @param {string} id
   */
  function mostrarDetallePrestamo(id) {
    const detalleContainer = document.getElementById('prestamo-detalle-container');
    if (!detalleContainer) return;
    const p = prestamos.find((pl) => pl.id === id);
    if (!p) return;
    detalleContainer.classList.remove('hidden');
    detalleContainer.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = `Detalle de ${p.nombre}`;
    detalleContainer.appendChild(title);
    // Resumen básico
    const resumen = document.createElement('p');
    resumen.textContent = `Monto: ${formatCurrency(parseFloat(p.monto))} • Tasa anual: ${p.tasa}% • Plazo: ${p.plazo} meses`;
    detalleContainer.appendChild(resumen);
    // Tabla de cronograma
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>#</th><th>Fecha</th><th>Interés</th><th>Capital</th><th>Cuota</th><th>Saldo</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    p.cronograma.forEach((c) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${c.cuota}</td><td>${new Date(c.fecha).toLocaleDateString('es-DO')}</td><td>${formatCurrency(c.interes)}</td><td>${formatCurrency(c.capital)}</td><td>${formatCurrency(c.cuota_total)}</td><td>${formatCurrency(c.saldo_restante)}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    detalleContainer.appendChild(table);
  }

  // Mostrar/ocultar formulario de préstamo
  const btnNuevoPrestamo = document.getElementById('btn-nuevo-prestamo');
  const prestamoFormContainer = document.getElementById('prestamo-form-container');
  const prestamoForm = document.getElementById('prestamo-form');
  if (btnNuevoPrestamo) {
    btnNuevoPrestamo.addEventListener('click', () => {
      if (prestamoFormContainer) {
        prestamoFormContainer.classList.toggle('hidden');
        // Resetear formulario al mostrar
        if (!prestamoFormContainer.classList.contains('hidden') && prestamoForm) {
          prestamoForm.reset();
          // Reiniciar texto del título
          const title = document.getElementById('prestamo-form-title');
          if (title) title.textContent = 'Registrar préstamo';
          currentPrestamoEditId = null;
        }
      }
    });
  }

  // Estado actual de edición de préstamo
  let currentPrestamoEditId = null;

  // Manejo de envío del formulario de préstamos
  if (prestamoForm) {
    prestamoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('prestamo-nombre').value.trim();
      const tipo = document.getElementById('prestamo-tipo').value;
      const montoVal = document.getElementById('prestamo-monto').value;
      const tasaVal = document.getElementById('prestamo-tasa').value;
      const plazoVal = document.getElementById('prestamo-plazo').value;
      const fechaInicio = document.getElementById('prestamo-fecha-inicio').value;
      const fechaPrimer = document.getElementById('prestamo-fecha-primer-pago').value;
      if (!nombre || !montoVal || !tasaVal || !plazoVal || !fechaInicio || !fechaPrimer) {
        showToast('Completa todos los campos');
        return;
      }
      const monto = parseFloat(montoVal);
      const tasa = parseFloat(tasaVal);
      const plazo = parseInt(plazoVal);
      // Determinar cronograma según tipo
      let cronograma = [];
      if (tipo === 'francesa') {
        cronograma = calcularFrancesa(monto, tasa, plazo, fechaPrimer);
      } else if (tipo === 'americana') {
        cronograma = calcularAmericana(monto, tasa, plazo, fechaPrimer);
      } else {
        cronograma = calcularInteresCompuestoDiario(monto, tasa, plazo, fechaPrimer);
      }
      // Si estamos editando
      if (currentPrestamoEditId) {
        const idx = prestamos.findIndex((pr) => pr.id === currentPrestamoEditId);
        if (idx !== -1) {
          prestamos[idx] = {
            ...prestamos[idx],
            nombre,
            tipo,
            monto: monto.toFixed(2),
            tasa: tasa.toFixed(2),
            plazo,
            fechaInicio,
            fechaPrimer,
            cronograma
          };
        }
      } else {
        const nuevo = {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          nombre,
          tipo,
          monto: monto.toFixed(2),
          tasa: tasa.toFixed(2),
          plazo,
          fechaInicio,
          fechaPrimer,
          cronograma,
          pagadas: []
        };
        prestamos.push(nuevo);
      }
      guardarPrestamos();
      prestamoForm.reset();
      currentPrestamoEditId = null;
      if (prestamoFormContainer) prestamoFormContainer.classList.add('hidden');
      showToast('Préstamo guardado');
      actualizarVistaPrestamos();
    });
  }

  /* ===================================================================== */
  /* ======================= MÓDULO CALENDARIO ========================= */

  // Variables para calendario
  let calYear, calMonth;

  /**
   * Convierte una fecha a cadena YYYY-MM-DD en zona local.
   */
  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Genera las celdas del calendario para el mes y año actuales.
   */
  function generarCalendario() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    // Obtener primer día y número de días en el mes
    const firstDay = new Date(calYear, calMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    // Dias del mes anterior a mostrar para completar la semana
    const prevDays = startWeekday === 0 ? 6 : startWeekday - 1;
    const totalCells = prevDays + daysInMonth;
    // Eventos por día
    const eventsByDate = {};
    // Agrupar movimientos del mes
    movimientos.forEach((m) => {
      const d = new Date(m.fecha);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const key = formatDateKey(d);
        eventsByDate[key] = eventsByDate[key] || { mov: 0, prest: 0, pago: 0 };
        eventsByDate[key].mov += 1;
      }
    });
    // Agrupar cuotas de préstamos
    prestamos.forEach((p) => {
      p.cronograma.forEach((c) => {
        const d = new Date(c.fecha);
        if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
          const key = formatDateKey(d);
          eventsByDate[key] = eventsByDate[key] || { mov: 0, prest: 0, pago: 0 };
          eventsByDate[key].prest += 1;
        }
      });
    });

    // Eventos de pagos fijos de sobres
    const pagosFijos = generarEventosPagosFijosParaCalendario(calMonth, calYear);
    pagosFijos.forEach((evt) => {
      const key = evt.fecha;
      eventsByDate[key] = eventsByDate[key] || { mov: 0, prest: 0, pago: 0 };
      eventsByDate[key].pago += 1;
    });
    // Generar celdas
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      cell.classList.add('calendar-cell');
      let cellDate = new Date(calYear, calMonth, 1 - prevDays + i);
      const currentMonth = cellDate.getMonth() === calMonth;
      if (!currentMonth) {
        cell.classList.add('disabled');
      }
      const numberEl = document.createElement('div');
      numberEl.classList.add('day-number');
      numberEl.textContent = cellDate.getDate();
      cell.appendChild(numberEl);
      // Event dots
      const key = formatDateKey(cellDate);
      const ev = eventsByDate[key];
      if (ev) {
        const dots = document.createElement('div');
        dots.classList.add('event-dots');
        if (ev.mov) {
          const dot = document.createElement('span');
          dot.classList.add('event-dot', 'event-movimiento');
          dots.appendChild(dot);
        }
        if (ev.prest) {
          const dot = document.createElement('span');
          dot.classList.add('event-dot', 'event-prestamo');
          dots.appendChild(dot);
        }
        if (ev.pago) {
          const dot = document.createElement('span');
          dot.classList.add('event-dot', 'event-pago-fijo');
          dots.appendChild(dot);
        }
        cell.appendChild(dots);
      }
      // Click event
      cell.addEventListener('click', () => {
        mostrarDetallesDia(cellDate);
      });
      grid.appendChild(cell);
    }
    // Actualizar título
    const titleEl = document.getElementById('calendar-title');
    if (titleEl) {
      titleEl.textContent = `${getMonthName(calMonth)} ${calYear}`;
    }
  }

  /**
   * Muestra los detalles de un día seleccionado (movimientos y cuotas).
   */
  function mostrarDetallesDia(date) {
    const detailsEl = document.getElementById('calendar-details');
    if (!detailsEl) return;
    detailsEl.classList.remove('hidden');
    detailsEl.innerHTML = '';
    const dateStr = date.toLocaleDateString('es-DO');
    const title = document.createElement('h3');
    title.textContent = `Detalles del ${dateStr}`;
    detailsEl.appendChild(title);
    // Movimientos del día
    const movs = movimientos.filter((m) => {
      const d = new Date(m.fecha);
      return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
    });
    const prestamosCuotas = [];
    prestamos.forEach((p) => {
      p.cronograma.forEach((c, idx) => {
        const d = new Date(c.fecha);
        if (d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate()) {
          prestamosCuotas.push({ prestamo: p.nombre, cuota: idx + 1, importe: c.cuota_total });
        }
      });
    });
    // Obtener pagos fijos para el día
    const eventosFijos = generarEventosPagosFijosParaCalendario(date.getMonth(), date.getFullYear()) || [];
    const pagosPendientes = eventosFijos.filter((evt) => evt.fecha === formatDateKey(date));

    if (movs.length === 0 && prestamosCuotas.length === 0 && pagosPendientes.length === 0) {
      const none = document.createElement('p');
      none.textContent = 'No hay eventos para este día.';
      detailsEl.appendChild(none);
      return;
    }
    if (movs.length > 0) {
      const movTitle = document.createElement('h4');
      movTitle.textContent = 'Movimientos';
      detailsEl.appendChild(movTitle);
      const list = document.createElement('ul');
      list.classList.add('detail-list');
      let movTotal = 0;
      movs.forEach((m) => {
        const item = document.createElement('li');
        item.classList.add('detail-item');
        const desc = `${m.tipo === 'ingreso' ? '+' : '-'} ${m.categoria}`;
        item.innerHTML = `<span>${desc}</span><span>${formatCurrency(parseFloat(m.monto))}</span>`;
        list.appendChild(item);
        if (m.tipo === 'ingreso') movTotal += parseFloat(m.monto);
        else movTotal -= parseFloat(m.monto);
      });
      detailsEl.appendChild(list);
      const totalEl = document.createElement('p');
      totalEl.style.fontWeight = 'bold';
      totalEl.textContent = `Total movimientos: ${formatCurrency(movTotal)}`;
      detailsEl.appendChild(totalEl);
    }
    if (prestamosCuotas.length > 0) {
      const loanTitle = document.createElement('h4');
      loanTitle.textContent = 'Cuotas de préstamos';
      detailsEl.appendChild(loanTitle);
      const list2 = document.createElement('ul');
      list2.classList.add('detail-list');
      let cuotaTotal = 0;
      prestamosCuotas.forEach((c) => {
        const item = document.createElement('li');
        item.classList.add('detail-item');
        item.innerHTML = `<span>${c.prestamo} (cuota ${c.cuota})</span><span>${formatCurrency(c.importe)}</span>`;
        list2.appendChild(item);
        cuotaTotal += c.importe;
      });
      detailsEl.appendChild(list2);
      const totalEl2 = document.createElement('p');
      totalEl2.style.fontWeight = 'bold';
      totalEl2.textContent = `Total cuotas: ${formatCurrency(cuotaTotal)}`;
      detailsEl.appendChild(totalEl2);
    }

    // Mostrar pagos fijos pendientes
    if (pagosPendientes.length > 0) {
      const pagosTitle = document.createElement('h4');
      pagosTitle.textContent = 'Pagos fijos';
      detailsEl.appendChild(pagosTitle);
      const list3 = document.createElement('ul');
      list3.classList.add('detail-list');
      let totalPagos = 0;
      // Asegurarse de tener sobres cargados para obtener nombres
      cargarSobres();
      pagosPendientes.forEach((evt) => {
        const s = sobres.find((sob) => sob.id === evt.sobreId);
        const nombreSobre = s ? s.nombre : evt.titulo;
        const monto = parseFloat(evt.montoEstimado) || 0;
        const item = document.createElement('li');
        item.classList.add('detail-item');
        item.innerHTML = `<span>Pago fijo pendiente: ${nombreSobre}</span><span>${formatCurrency(monto)}</span>`;
        list3.appendChild(item);
        totalPagos += monto;
      });
      detailsEl.appendChild(list3);
      const totalEl3 = document.createElement('p');
      totalEl3.style.fontWeight = 'bold';
      totalEl3.textContent = `Total pagos fijos: ${formatCurrency(totalPagos)}`;
      detailsEl.appendChild(totalEl3);
    }
  }

  /**
   * Actualiza la vista del calendario. Si aún no se han inicializado las
   * variables de año y mes, las establece al mes actual.
   */
  function actualizarVistaCalendario() {
    const now = new Date();
    if (calYear === undefined || calMonth === undefined) {
      calYear = now.getFullYear();
      calMonth = now.getMonth();
    }
    generarCalendario();
  }

  // Navegación de calendario
  const calPrevBtn = document.getElementById('cal-prev');
  const calNextBtn = document.getElementById('cal-next');
  if (calPrevBtn) {
    calPrevBtn.addEventListener('click', () => {
      if (calMonth === 0) {
        calMonth = 11;
        calYear -= 1;
      } else {
        calMonth -= 1;
      }
      generarCalendario();
    });
  }
  if (calNextBtn) {
    calNextBtn.addEventListener('click', () => {
      if (calMonth === 11) {
        calMonth = 0;
        calYear += 1;
      } else {
        calMonth += 1;
      }
      generarCalendario();
    });
  }

  // =================== Pestañas de calendario vs agenda ===================
  const btnCalendarioTab = document.getElementById('btn-vista-calendario');
  const btnAgendaTab = document.getElementById('btn-vista-agenda');
  const vistaCalendarioEl = document.getElementById('vista-calendario');
  const vistaAgendaEl = document.getElementById('vista-agenda');
  if (btnCalendarioTab && btnAgendaTab && vistaCalendarioEl && vistaAgendaEl) {
    btnCalendarioTab.addEventListener('click', () => {
      // Mostrar calendario y ocultar agenda
      vistaCalendarioEl.style.display = 'block';
      vistaAgendaEl.style.display = 'none';
      btnCalendarioTab.classList.add('tab-activa');
      btnAgendaTab.classList.remove('tab-activa');
    });
    btnAgendaTab.addEventListener('click', () => {
      vistaCalendarioEl.style.display = 'none';
      vistaAgendaEl.style.display = 'block';
      btnAgendaTab.classList.add('tab-activa');
      btnCalendarioTab.classList.remove('tab-activa');
      // Obtener mes y año actuales del calendario y mostrar la agenda
      const { mes, anio } = obtenerMesYAnioSeleccionados();
      mostrarAgendaFinanciera(mes, anio);
    });
  }

  /* ===================================================================== */
  /* ======================= MÓDULO PRESUPUESTO ========================= */

  /**
   * Guarda los presupuestos en LocalStorage.
   */
  function guardarPresupuestos() {
    localStorage.setItem('presupuestos', JSON.stringify(presupuestos));
  }

  /**
   * Calcula y actualiza la vista del presupuesto: resumen y categorías.
   */
  function actualizarVistaPresupuesto() {
    actualizarResumenPresupuesto();
    const listEl = document.getElementById('presupuesto-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (presupuestos.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No hay categorías de presupuesto.';
      empty.style.textAlign = 'center';
      listEl.appendChild(empty);
      return;
    }
    // Calcular gastos por categoría para el mes actual
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    // Map de gastos por categoría
    const gastosPorCat = {};
    movimientos.forEach((m) => {
      const d = new Date(m.fecha);
      if (m.tipo === 'gasto' && d.getMonth() === curMonth && d.getFullYear() === curYear) {
        gastosPorCat[m.categoria] = (gastosPorCat[m.categoria] || 0) + parseFloat(m.monto);
      }
    });
    presupuestos.forEach((cat) => {
      const card = document.createElement('div');
      card.classList.add('budget-card');
      // Header: nombre y tipo
      const header = document.createElement('div');
      header.classList.add('budget-header');
      const nameEl = document.createElement('div');
      nameEl.classList.add('budget-name');
      nameEl.textContent = cat.nombre;
      const typeEl = document.createElement('div');
      typeEl.classList.add('budget-type');
      typeEl.textContent = cat.tipo.charAt(0).toUpperCase() + cat.tipo.slice(1);
      header.appendChild(nameEl);
      header.appendChild(typeEl);
      card.appendChild(header);
      // Progress bar
      const progress = document.createElement('div');
      progress.classList.add('budget-progress');
      const progressBar = document.createElement('span');
      const gastado = gastosPorCat[cat.nombre] || 0;
      const porcentaje = cat.limite > 0 ? (gastado / cat.limite) : 0;
      progressBar.style.width = `${Math.min(100, porcentaje * 100)}%`;
      // Color según porcentaje
      if (porcentaje < 0.5) progress.classList.add('green');
      else if (porcentaje <= 1) progress.classList.add('yellow');
      else progress.classList.add('red');
      progress.appendChild(progressBar);
      card.appendChild(progress);
      // Metrics
      const metrics = document.createElement('div');
      metrics.classList.add('budget-metrics');
      const gastadoEl = document.createElement('span');
      gastadoEl.textContent = `${formatCurrency(gastado)}/${formatCurrency(parseFloat(cat.limite))}`;
      const restanteEl = document.createElement('span');
      const restante = cat.limite - gastado;
      restanteEl.textContent = restante >= 0 ? `Restante: ${formatCurrency(restante)}` : `Exceso: ${formatCurrency(Math.abs(restante))}`;
      metrics.appendChild(gastadoEl);
      metrics.appendChild(restanteEl);
      card.appendChild(metrics);
      listEl.appendChild(card);
    });
  }

  /**
   * Calcula la distribución 50/30/20 y muestra resumen general en presupuesto.
   */
  function actualizarResumenPresupuesto() {
    const summaryEl = document.getElementById('presupuesto-summary');
    if (!summaryEl) return;
    summaryEl.innerHTML = '';
    // Calcular totales del mes
    let totalIngresos = 0;
    let totalGastos = 0;
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    movimientos.forEach((m) => {
      const d = new Date(m.fecha);
      if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
        if (m.tipo === 'ingreso') totalIngresos += parseFloat(m.monto);
        else totalGastos += parseFloat(m.monto);
      }
    });
    const balance = totalIngresos - totalGastos;
    if (totalIngresos === 0) {
      const info = document.createElement('p');
      info.textContent = 'Sin ingresos registrados este mes para calcular la distribución 50/30/20.';
      info.style.textAlign = 'center';
      summaryEl.appendChild(info);
      return;
    }
    // Distribución 50/30/20
    const needs = totalIngresos * 0.5;
    const wants = totalIngresos * 0.3;
    const savings = totalIngresos * 0.2;
    const container = document.createElement('div');
    container.classList.add('distribution-card', 'card');
    const title = document.createElement('h3');
    title.textContent = 'Distribución 50/30/20';
    container.appendChild(title);
    const bars = document.createElement('div');
    bars.classList.add('distribution-bars');
    const barN = document.createElement('div');
    barN.classList.add('distribution-bar', 'need');
    barN.style.width = '50%';
    barN.innerHTML = `<span>${formatCurrency(needs)}</span>`;
    const barW = document.createElement('div');
    barW.classList.add('distribution-bar', 'want');
    barW.style.width = '30%';
    barW.innerHTML = `<span>${formatCurrency(wants)}</span>`;
    const barS = document.createElement('div');
    barS.classList.add('distribution-bar', 'saving');
    barS.style.width = '20%';
    barS.innerHTML = `<span>${formatCurrency(savings)}</span>`;
    bars.appendChild(barN);
    bars.appendChild(barW);
    bars.appendChild(barS);
    container.appendChild(bars);
    summaryEl.appendChild(container);
  }

  // Mostrar/ocultar formulario de presupuesto
  const btnNuevoPresupuesto = document.getElementById('btn-nuevo-presupuesto');
  const presupuestoFormContainer = document.getElementById('presupuesto-form-container');
  const presupuestoForm = document.getElementById('presupuesto-form');
  if (btnNuevoPresupuesto) {
    btnNuevoPresupuesto.addEventListener('click', () => {
      if (presupuestoFormContainer) {
        presupuestoFormContainer.classList.toggle('hidden');
        if (!presupuestoFormContainer.classList.contains('hidden') && presupuestoForm) {
          presupuestoForm.reset();
        }
      }
    });
  }

  // Manejo de envío de nueva categoría de presupuesto
  if (presupuestoForm) {
    presupuestoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('budget-nombre').value.trim();
      const tipo = document.getElementById('budget-tipo').value;
      const limiteVal = document.getElementById('budget-limite').value;
      if (!nombre || !limiteVal) {
        showToast('Completa todos los campos');
        return;
      }
      const limite = parseFloat(limiteVal);
      presupuestos.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        nombre,
        tipo,
        limite
      });
      guardarPresupuestos();
      presupuestoForm.reset();
      if (presupuestoFormContainer) presupuestoFormContainer.classList.add('hidden');
      showToast('Categoría guardada');
      actualizarVistaPresupuesto();
    });
  }

  /* ===================================================================== */
  /* ======================= MÓDULO EXPORTAR ========================= */

  function exportDataset(data, format, filename) {
    let content = '';
    let mime = 'text/plain';
    if (format === 'json') {
      mime = 'application/json';
      content = JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      // data puede ser array de objetos o array de arrays
      if (Array.isArray(data) && data.length > 0) {
        const keys = Object.keys(data[0]);
        const rows = [keys.join(',')];
        data.forEach((item) => {
          const row = keys.map((k) => {
            const val = item[k];
            return typeof val === 'string' ? '"' + val.replace(/"/g, '""') + '"' : val;
          });
          rows.push(row.join(','));
        });
        content = rows.join('\n');
        mime = 'text/csv';
      }
    } else if (format === 'txt') {
      content = Array.isArray(data) ? data.map((i) => JSON.stringify(i)).join('\n') : JSON.stringify(data);
      mime = 'text/plain';
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, 0);
  }

  // Evento de exportar
  const btnExportar = document.getElementById('btn-exportar');
  if (btnExportar) {
    btnExportar.addEventListener('click', () => {
      const fmt = document.getElementById('export-format').value;
      const toExport = [];
      if (document.getElementById('export-movimientos').checked) {
        toExport.push({ name: 'movimientos', data: movimientos });
      }
      if (document.getElementById('export-cuentas').checked) {
        toExport.push({ name: 'cuentas', data: cuentas });
      }
      if (document.getElementById('export-prestamos').checked) {
        // Para préstamos exportar también cronograma en formato plano
        const prestamosData = [];
        prestamos.forEach((p) => {
          p.cronograma.forEach((c) => {
            prestamosData.push({
              prestamo: p.nombre,
              cuota: c.cuota,
              fecha: c.fecha,
              interes: c.interes,
              capital: c.capital,
              cuota_total: c.cuota_total,
              saldo_restante: c.saldo_restante
            });
          });
        });
        toExport.push({ name: 'prestamos', data: prestamosData });
      }
      // Exportar sobres (nuevo presupuesto basado en sobres)
      const exportSobresEl = document.getElementById('export-sobres');
      if (exportSobresEl && exportSobresEl.checked) {
        // Asegurarnos de cargar los sobres más recientes
        cargarSobres();
        toExport.push({ name: 'sobres', data: sobres });
      }
      if (toExport.length === 0) {
        showToast('Selecciona al menos un tipo de datos');
        return;
      }
      toExport.forEach((item) => {
        const filename = `${item.name}.${fmt}`;
        exportDataset(item.data, fmt, filename);
      });
      showToast('Exportación completada');
    });
  }

  // Generar informe PDF
  const btnExportarPdf = document.getElementById('btn-exportar-pdf');
  if (btnExportarPdf) {
    btnExportarPdf.addEventListener('click', () => {
      showToast('Generando PDF...');
      try {
        // Resolver constructor de jsPDF de manera robusta
        let JSCls = null;
        if (window.jspdf && window.jspdf.jsPDF) {
          JSCls = window.jspdf.jsPDF;
        } else if (window.jsPDF) {
          JSCls = window.jsPDF;
        } else if (typeof jsPDF !== 'undefined') {
          JSCls = jsPDF;
        }
        if (!JSCls) {
          throw new Error('jsPDF no disponible');
        }
        const doc = new JSCls({ orientation: 'p', unit: 'pt', format: 'a4' });
        let y = 40;
        doc.setFontSize(18);
        doc.text('Informe financiero del mes', 40, y);
        y += 30;
        doc.setFontSize(12);
        // Totales ingresos y gastos del mes actual
        let totalIngresos = 0;
        let totalGastos = 0;
        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        movimientos.forEach((m) => {
          const d = new Date(m.fecha);
          if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
            if (m.tipo === 'ingreso') totalIngresos += parseFloat(m.monto);
            else totalGastos += parseFloat(m.monto);
          }
        });
        const balance = totalIngresos - totalGastos;
        doc.text(`Ingresos: ${formatCurrency(totalIngresos)}`, 40, y);
        y += 20;
        doc.text(`Gastos: ${formatCurrency(totalGastos)}`, 40, y);
        y += 20;
        doc.text(`Balance: ${formatCurrency(balance)}`, 40, y);
        y += 30;
        // Resumen de sobres (nuevo sistema de presupuesto)
        doc.setFontSize(14);
        doc.text('Resumen de sobres', 40, y);
        y += 20;
        doc.setFontSize(12);
        cargarSobres();
        if (!sobres || sobres.length === 0) {
          doc.text('No hay sobres definidos.', 40, y);
          y += 20;
        } else {
          sobres.forEach((s) => {
            if (s.tipo === 'fijo') {
              doc.text(`${s.nombre}: saldo ${formatCurrency(s.saldo)} de ${formatCurrency(s.limite)}`, 40, y);
            } else {
              doc.text(`${s.nombre}: saldo ${formatCurrency(s.saldo)}, gastado ${formatCurrency(s.gastado)}`, 40, y);
            }
            y += 15;
          });
          y += 10;
        }
        // Resumen de préstamos
        doc.setFontSize(14);
        doc.text('Resumen de préstamos', 40, y);
        y += 20;
        doc.setFontSize(12);
        if (prestamos.length === 0) {
          doc.text('No hay préstamos registrados.', 40, y);
          y += 20;
        } else {
          prestamos.forEach((p) => {
            const cuota0 = p.cronograma && p.cronograma[0] ? p.cronograma[0].cuota_total : 0;
            doc.text(`${p.nombre}: cuota mensual aprox. ${formatCurrency(cuota0)}`, 40, y);
            y += 15;
          });
          y += 10;
        }
        doc.save('informe_financiero.pdf');
        showToast('PDF generado');
      } catch (err) {
        console.error(err);
        showToast('Error al generar PDF');
      }
    });
  }

  /* ===================================================================== */
  /* ======================= MÓDULO AJUSTES ========================= */

  /**
   * Carga los ajustes en el formulario y aplica el modo oscuro si corresponde.
   */
  function cargarAjustes() {
    const nameEl = document.getElementById('user-name');
    const currencyEl = document.getElementById('user-currency');
    const darkEl = document.getElementById('dark-mode-toggle');
    const animEl = document.getElementById('animations-toggle');
    const fontEl = document.getElementById('font-size-select');
    const contrastEl = document.getElementById('contrast-toggle');
    if (nameEl) nameEl.value = ajustes.userName || '';
    if (currencyEl) currencyEl.value = ajustes.currency || 'USD';
    if (darkEl) darkEl.checked = ajustes.darkMode || false;
    if (animEl) animEl.checked = ajustes.animations || false;
    if (fontEl) fontEl.value = ajustes.fontSize || 'med';
    if (contrastEl) contrastEl.checked = ajustes.contrast || false;
    // Aplicar tema oscuro
    if (ajustes.darkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    // Aplicar tamaño de fuente
    document.documentElement.classList.remove('font-small', 'font-med', 'font-large');
    if (ajustes.fontSize === 'small') document.documentElement.classList.add('font-small');
    else if (ajustes.fontSize === 'large') document.documentElement.classList.add('font-large');
    else document.documentElement.classList.add('font-med');
    // Aplicar contraste alto
    if (ajustes.contrast) document.documentElement.classList.add('contrast-high');
    else document.documentElement.classList.remove('contrast-high');
  }

  /**
   * Guarda los ajustes modificados por el usuario y aplica el modo oscuro.
   */
  function guardarAjustes() {
    const nameEl = document.getElementById('user-name');
    const currencyEl = document.getElementById('user-currency');
    const darkEl = document.getElementById('dark-mode-toggle');
    const animEl = document.getElementById('animations-toggle');
    ajustes.userName = nameEl ? nameEl.value.trim() : '';
    ajustes.currency = currencyEl ? currencyEl.value : 'USD';
    ajustes.darkMode = darkEl ? darkEl.checked : false;
    ajustes.animations = animEl ? animEl.checked : true;
    // Leer tamaño de fuente y contraste
    const fontEl = document.getElementById('font-size-select');
    const contrastEl = document.getElementById('contrast-toggle');
    ajustes.fontSize = fontEl ? fontEl.value : 'med';
    ajustes.contrast = contrastEl ? contrastEl.checked : false;
    localStorage.setItem('ajustes', JSON.stringify(ajustes));
    // Aplicar tema oscuro
    if (ajustes.darkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    // Aplicar tamaño de fuente
    document.documentElement.classList.remove('font-small', 'font-med', 'font-large');
    if (ajustes.fontSize === 'small') document.documentElement.classList.add('font-small');
    else if (ajustes.fontSize === 'large') document.documentElement.classList.add('font-large');
    else document.documentElement.classList.add('font-med');
    // Aplicar contraste
    if (ajustes.contrast) document.documentElement.classList.add('contrast-high');
    else document.documentElement.classList.remove('contrast-high');
    showToast('Ajustes guardados');
  }

  const btnGuardarAjustes = document.getElementById('btn-guardar-ajustes');
  if (btnGuardarAjustes) {
    btnGuardarAjustes.addEventListener('click', guardarAjustes);
  }
  const btnResetData = document.getElementById('btn-reset-data');
  if (btnResetData) {
    btnResetData.addEventListener('click', () => {
      if (confirm('¿Seguro que deseas borrar todos los datos?')) {
        localStorage.clear();
        location.reload();
      }
    });
  }

  // =================== Sistema de backups y optimización ===================
  const btnExportBackup = document.getElementById('btn-export-backup');
  if (btnExportBackup) {
    btnExportBackup.addEventListener('click', () => {
      const backup = {
        movimientos,
        cuentas,
        prestamos,
        sobres,
        ajustes
      };
      // Crear archivo JSON del backup y descargarlo
      exportDataset(backup, 'json', 'backup_finanzas.json');
      showToast('Backup exportado');
    });
  }

  const btnImportBackup = document.getElementById('btn-import-backup');
  const importBackupInput = document.getElementById('import-backup-input');
  if (btnImportBackup && importBackupInput) {
    btnImportBackup.addEventListener('click', () => {
      importBackupInput.click();
    });
    importBackupInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.movimientos) {
            movimientos = data.movimientos;
            saveMovimientos();
          }
          if (data.cuentas) {
            cuentas = data.cuentas;
            guardarCuentas();
          }
          if (data.prestamos) {
            prestamos = data.prestamos;
            guardarPrestamos();
          }
          if (data.sobres) {
            sobres = data.sobres;
            guardarSobres();
          }
          if (data.ajustes) {
            ajustes = { ...ajustes, ...data.ajustes };
            localStorage.setItem('ajustes', JSON.stringify(ajustes));
          }
          showToast('Backup importado');
          // Recargar vistas para reflejar datos importados
          updateDashboard();
          actualizarVistaMovimientos();
          actualizarVistaCuentas();
          actualizarVistaPrestamos();
          actualizarVistaSobres();
          actualizarVistaCalendario();
          cargarAjustes();
        } catch (err) {
          console.error(err);
          showToast('Archivo de backup inválido');
        }
      };
      reader.readAsText(file);
      importBackupInput.value = '';
    });
  }

  const btnOptimize = document.getElementById('btn-optimize-app');
  if (btnOptimize) {
    btnOptimize.addEventListener('click', () => {
      // Eliminar cachés dinámicas para liberar espacio y cargar nuevos recursos
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key.includes('dynamic')) {
              caches.delete(key);
            }
          });
        });
      }
      showToast('Optimización completada');
    });
  }

  // =================== Eventos para sobres ===================
  const btnNuevoSobre = document.getElementById('btn-nuevo-sobre');
  const sobreFormContainer = document.getElementById('sobre-form-container');
  const sobreForm = document.getElementById('sobre-form');
  const sobreTipoSelect = document.getElementById('sobre-tipo');
  if (btnNuevoSobre) {
    btnNuevoSobre.addEventListener('click', () => {
      if (sobreFormContainer) {
        // Si está oculto, al mostrarlo reiniciar para nuevo
        if (sobreFormContainer.classList.contains('hidden')) {
          editingSobreId = null;
          const formTitle = document.getElementById('sobre-form-title');
          if (formTitle) formTitle.textContent = 'Nuevo sobre';
          if (sobreForm) sobreForm.reset();
          const limiteGroup = document.getElementById('sobre-limite-group');
          if (limiteGroup) limiteGroup.style.display = '';
        }
        sobreFormContainer.classList.toggle('hidden');
      }
    });
  }
  // Mostrar u ocultar campo de límite según tipo
  if (sobreTipoSelect) {
    sobreTipoSelect.addEventListener('change', () => {
      const limiteGroup = document.getElementById('sobre-limite-group');
      const diaPagoGroup = document.getElementById('grupo-dia-pago');
      if (sobreTipoSelect.value === 'fijo') {
        if (limiteGroup) limiteGroup.style.display = '';
        if (diaPagoGroup) diaPagoGroup.style.display = '';
      } else {
        if (limiteGroup) limiteGroup.style.display = 'none';
        if (diaPagoGroup) diaPagoGroup.style.display = 'none';
      }
    });
    // Inicializar visibilidad de grupos según valor actual
    const initVal = sobreTipoSelect.value;
    const limiteGroupInit = document.getElementById('sobre-limite-group');
    const diaPagoGroupInit = document.getElementById('grupo-dia-pago');
    if (initVal === 'fijo') {
      if (limiteGroupInit) limiteGroupInit.style.display = '';
      if (diaPagoGroupInit) diaPagoGroupInit.style.display = '';
    } else {
      if (limiteGroupInit) limiteGroupInit.style.display = 'none';
      if (diaPagoGroupInit) diaPagoGroupInit.style.display = 'none';
    }
  }
  // Envío del formulario de sobres
  if (sobreForm) {
    sobreForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombreVal = document.getElementById('sobre-nombre').value.trim();
      const tipoVal = document.getElementById('sobre-tipo').value;
      const limiteVal = document.getElementById('sobre-limite').value;
      const prioridadNivelVal = document.getElementById('sobre-prioridad').value;
      const categoriaDistVal = document.getElementById('sobre-categoria-distribucion').value;
      const diaPagoVal = document.getElementById('sobre-dia-pago').value;
      const categoriaVal = document.getElementById('sobre-categoria').value;
      const metodoVal = document.getElementById('sobre-metodo').value;
      // Guardar método de distribución
      localStorage.setItem('metodoDistribucionSobres', metodoVal);
      metodoDistribucionSobres = metodoVal;
      if (!nombreVal) {
        showToast('Introduce un nombre de sobre');
        return;
      }
      if (tipoVal === 'fijo' && (!limiteVal || parseFloat(limiteVal) <= 0)) {
        showToast('Introduce un límite válido');
        return;
      }
      const data = {
        nombre: nombreVal,
        tipo: tipoVal,
        limite: tipoVal === 'fijo' ? parseFloat(limiteVal) : 0,
        saldo: 0,
        gastado: 0,
        prioridadNivel: prioridadNivelVal || 'alta',
        categoriaDistribucion: categoriaDistVal || 'necesidad',
        diaPago: tipoVal === 'fijo' ? (diaPagoVal ? parseInt(diaPagoVal) : null) : null,
        categoriaVinculada: categoriaVal
      };
      if (editingSobreId) {
        actualizarSobre(editingSobreId, data);
        showToast('Sobre actualizado');
        editingSobreId = null;
      } else {
        crearSobre(data);
        showToast('Sobre creado');
      }
      if (sobreForm) sobreForm.reset();
      const limiteGroup = document.getElementById('sobre-limite-group');
      if (limiteGroup) limiteGroup.style.display = 'none';
      const diaPagoGroup = document.getElementById('grupo-dia-pago');
      if (diaPagoGroup) diaPagoGroup.style.display = 'none';
      if (sobreFormContainer) sobreFormContainer.classList.add('hidden');
      actualizarVistaSobres();
      // Recalcular la distribución en el dashboard al crear/editar sobres
      actualizarDistribucionSobresEnDashboard();
    });
  }

  /**
   * Manejo del envío del formulario de nuevo movimiento.
   */
  const movimientoForm = document.getElementById('movimiento-form');
  if (movimientoForm) {
    movimientoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const tipoInput = document.getElementById('mov-tipo');
      const tipo = tipoInput ? tipoInput.value.toLowerCase() : '';
      const montoVal = document.getElementById('mov-monto').value;
      const nota = document.getElementById('mov-nota').value;
      // Validar monto
      if (!montoVal || isNaN(montoVal) || parseFloat(montoVal) <= 0) {
        showToast('Introduce un monto válido.');
        return;
      }
      // Obtener fecha actual en formato AAAA-MM-DD
      const hoy = new Date();
      const fecha = hoy.toISOString().split('T')[0];
      let sobreId = '';
      if (tipo === 'gasto') {
        const selectSobre = document.getElementById('mov-sobre');
        sobreId = selectSobre ? selectSobre.value : '';
        if (!sobreId) {
          alert('Debe seleccionar un sobre.');
          return;
        }
      }
      const movimiento = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        tipo,
        monto: parseFloat(montoVal).toFixed(2),
        categoria: '',
        fecha,
        nota: nota.trim()
      };
      movimientos.push(movimiento);
      saveMovimientos();

      // Procesar según tipo
      if (tipo === 'ingreso') {
        distribuirIngresoEnSobres(parseFloat(montoVal), fecha, 'ingreso');
      } else if (tipo === 'gasto') {
        descontarDeSobre(sobreId, parseFloat(montoVal));
      }

      actualizarVistaSobres();
      // Resetear formulario y selección de sobres
      movimientoForm.reset();
      // Ocultar grupo de sobres al resetear
      const grupo = document.getElementById('grupo-sobre');
      if (grupo) grupo.style.display = 'none';
      // Actualizar dashboard y movimientos
      updateDashboard();
      actualizarVistaMovimientos();
      showToast('Movimiento guardado');
      // Redirigir a la vista de movimientos
      showView('movimientos');
    });
  }

  // Asignar eventos a los chips de categoría para selección rápida
  const categoryChips = document.querySelectorAll('.category-chip');
  categoryChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const value = chip.getAttribute('data-value');
      const select = document.getElementById('mov-categoria');
      if (select) {
        select.value = value;
      }
      // Marcar chip seleccionado y desmarcar otros
      categoryChips.forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  // Cargar valores iniciales al arrancar
  updateDashboard();
    // Aplicar ajustes de usuario al cargar (tema, tamaño de fuente, contraste)
    cargarAjustes();
});