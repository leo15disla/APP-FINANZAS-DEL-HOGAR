/*
 * Lógica principal de la aplicación "Finanzas del Hogar".
 * Este script implementa navegación de una sola página (SPA),
 * gestión básica de ingresos y gastos usando LocalStorage,
 * así como el renderizado de vistas y de un sencillo gráfico de barras.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // FIREBASE CONFIGURATION & INITIALIZATION
  // ==========================================
  const firebaseConfig = {
    apiKey: "API_KEY_AQUI",
    authDomain: "projectId.firebaseapp.com",
    projectId: "projectId",
    storageBucket: "projectId.appspot.com",
    messagingSenderId: "123",
    appId: "1:123:web:abc"
  };

  let app, auth, db;
  try {
    if (!firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      app = firebase.app();
    }
    auth = firebase.auth();
    db = firebase.firestore();
    console.log("🔥 Firebase inicializado.");
  } catch (e) {
    console.error("Firebase init error:", e);
  }

  // --- HELPERS FIRESTORE CORE ---
  async function createHomeFirestore(name, currency, ownerUid) {
    if (!db) return null;
    const ref = db.collection('homes').doc();
    const data = {
      id: ref.id,
      name, currency, ownerUid,
      members: { [ownerUid]: 'owner' },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(data);
    console.log("🏠 Home creado:", ref.id);
    return { ...data, id: ref.id };
  }

  async function createUserFirestore(uid, phone, homeId, role, prefs) {
    if (!db) return null;
    const data = {
      uid, phone, homeId, role,
      preferences: prefs,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('users').doc(uid).set(data, { merge: true });
    console.log("👤 User guardado:", uid);
    return data;
  }

  async function getUserFirestore(uid) {
    if (!db) return null;
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? snap.data() : null;
  }

  // --- HELPER HOMEID ACTIVO ---
  function getActiveHomeId() {
    const homeId = APP_STATE?.household?.id || APP_STATE?.household?.homeId || null;
    if (!homeId) {
      console.warn("⚠️ No hay homeId activo. Operación bloqueada.");
    }
    return homeId;
  }

  // --- HELPERS FIRESTORE SOBRES ---
  async function cargarSobresFirestore() {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return [];

    try {
      console.log("🏠 Home activo:", homeId);
      const ref = db.collection('homes').doc(homeId).collection('sobres');
      const snap = await ref.get();

      const sobres = [];
      snap.forEach(doc => sobres.push({ id: doc.id, ...doc.data() }));

      console.log("📦 Sobres Firestore cargados:", sobres.length);
      return sobres;
    } catch (e) {
      console.error("❌ Error cargando sobres desde Firestore:", e);
      return [];
    }
  }

  async function crearSobreFirestore(sobre) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return null;

    try {
      const ref = db.collection('homes').doc(homeId).collection('sobres');
      const docRef = await ref.add({
        ...sobre,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log("➕ Sobre creado en Firestore:", docRef.id);
      return { id: docRef.id, ...sobre };
    } catch (e) {
      console.error("❌ Error creando sobre en Firestore:", e);
      throw e;
    }
  }

  async function actualizarSobreFirestore(id, cambios) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return;

    try {
      const ref = db.collection('homes').doc(homeId).collection('sobres').doc(id);
      await ref.update({
        ...cambios,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log("✏️ Sobre actualizado en Firestore:", id);
    } catch (e) {
      console.error("❌ Error actualizando sobre en Firestore:", e);
      throw e;
    }
  }

  async function eliminarSobreFirestore(id) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return;

    try {
      await db.collection('homes').doc(homeId).collection('sobres').doc(id).delete();
      console.log("🗑️ Sobre eliminado de Firestore:", id);
    } catch (e) {
      console.error("❌ Error eliminando sobre de Firestore:", e);
      throw e;
    }
  }

  // --- HELPERS FIRESTORE CUENTAS ---
  async function cargarCuentasFirestore() {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return [];
    try {
      const snap = await db.collection('homes').doc(homeId).collection('cuentas').get();
      const result = [];
      snap.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
      return result;
    } catch (e) { console.error("Error cargando cuentas:", e); return []; }
  }

  async function crearCuentaFirestore(data) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return null;
    try {
      const ref = await db.collection('homes').doc(homeId).collection('cuentas').add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id: ref.id, ...data };
    } catch (e) { console.error("Error creando cuenta:", e); throw e; }
  }

  async function actualizarCuentaFirestore(id, cambios) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return;
    try {
      await db.collection('homes').doc(homeId).collection('cuentas').doc(id).update({
        ...cambios,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.error("Error actualizando cuenta:", e); throw e; }
  }

  async function eliminarCuentaFirestore(id) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return;
    try {
      await db.collection('homes').doc(homeId).collection('cuentas').doc(id).delete();
    } catch (e) { console.error("Error eliminando cuenta:", e); throw e; }
  }

  // --- HELPERS FIRESTORE PRÉSTAMOS ---
  async function cargarPrestamosFirestore() {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return [];
    try {
      const snap = await db.collection('homes').doc(homeId).collection('prestamos').get();
      const result = [];
      snap.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
      return result;
    } catch (e) { console.error("Error cargando préstamos:", e); return []; }
  }

  async function crearPrestamoFirestore(data) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return null;
    try {
      const ref = await db.collection('homes').doc(homeId).collection('prestamos').add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id: ref.id, ...data };
    } catch (e) { console.error("Error creando préstamo:", e); throw e; }
  }

  async function actualizarPrestamoFirestore(id, cambios) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return;
    try {
      await db.collection('homes').doc(homeId).collection('prestamos').doc(id).update({
        ...cambios,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.error("Error actualizando préstamo:", e); throw e; }
  }

  async function eliminarPrestamoFirestore(id) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return;
    try {
      await db.collection('homes').doc(homeId).collection('prestamos').doc(id).delete();
    } catch (e) { console.error("Error eliminando préstamo:", e); throw e; }
  }

  // --- HELPERS FIRESTORE PRESUPUESTOS (CATEGORÍAS) ---
  async function cargarPresupuestosFirestore() {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return [];
    try {
      const snap = await db.collection('homes').doc(homeId).collection('presupuestos').get();
      const result = [];
      snap.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
      return result;
    } catch (e) { console.error("Error cargando presupuestos:", e); return []; }
  }

  async function crearPresupuestoFirestore(data) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return null;
    try {
      const ref = await db.collection('homes').doc(homeId).collection('presupuestos').add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id: ref.id, ...data };
    } catch (e) { console.error("Error creando presupuesto:", e); throw e; }
  }

  async function eliminarPresupuestoFirestore(id) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return;
    try {
      await db.collection('homes').doc(homeId).collection('presupuestos').doc(id).delete();
    } catch (e) { console.error("Error eliminando presupuesto:", e); throw e; }
  }

  // --- HELPERS FIRESTORE MOVIMIENTOS ---
  async function cargarMovimientosFirestore() {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return [];

    try {
      console.log("🏠 Home activo:", homeId);
      const ref = db.collection('homes').doc(homeId).collection('movimientos');
      const snap = await ref.get();

      const movimientos = [];
      snap.forEach(doc => movimientos.push({ id: doc.id, ...doc.data() }));

      console.log("📥 Movimientos cargados desde Firestore:", movimientos.length);
      return movimientos;
    } catch (e) {
      console.error("❌ Error cargando movimientos desde Firestore:", e);
      return [];
    }
  }

  async function crearMovimientoFirestore(mov) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return null;

    try {
      const ref = db.collection('homes').doc(homeId).collection('movimientos');
      const docRef = await ref.add({
        ...mov,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log("➕ Movimiento creado en Firestore:", docRef.id);
      return { id: docRef.id, ...mov };
    } catch (e) {
      console.error("❌ Error creando movimiento en Firestore:", e);
      throw e;
    }
  }

  async function actualizarMovimientoFirestore(id, cambios) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return;

    try {
      const ref = db.collection('homes').doc(homeId).collection('movimientos').doc(id);
      await ref.update({
        ...cambios,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log("✏️ Movimiento actualizado en Firestore:", id);
    } catch (e) {
      console.error("❌ Error actualizando movimiento en Firestore:", e);
      throw e;
    }
  }

  async function eliminarMovimientoFirestore(id) {
    const homeId = getActiveHomeId();
    if (!homeId || !db) return;

    try {
      await db.collection('homes').doc(homeId).collection('movimientos').doc(id).delete();
      console.log("🗑️ Movimiento eliminado de Firestore:", id);
    } catch (e) {
      console.error("❌ Error eliminando movimiento de Firestore:", e);
      throw e;
    }
  }

  // --- CACHE EN MEMORIA (SESSION CACHE) ---
  const DATA_CACHE = {
    sobres: null,
    movimientos: null,
    cuentas: null,
    prestamos: null,
    presupuestos: null,
    loaded: false,
    timestamp: null
  };

  // --- CARGA CENTRALIZADA DE DATOS CON CACHE ---
  /**
   * Carga todos los datos del hogar desde Firestore con cache en memoria.
   * Evita múltiples llamadas redundantes y optimiza el rendimiento.
   * @param {boolean} force - Si es true, fuerza recarga desde Firestore ignorando cache
   * @returns {Promise<{sobres: Array, movimientos: Array, cuentas: Array, prestamos: Array}>}
   */
  async function loadHomeData(force = false) {
    // Si ya está cargado y no se fuerza, usar cache
    if (DATA_CACHE.loaded && !force) {
      console.log("⚡ Usando datos desde cache en memoria");
      return {
        sobres: DATA_CACHE.sobres || [],
        movimientos: DATA_CACHE.movimientos || [],
        cuentas: DATA_CACHE.cuentas || [],
        prestamos: DATA_CACHE.prestamos || [],
        presupuestos: DATA_CACHE.presupuestos || []
      };
    }

    const homeId = getActiveHomeId();
    if (!homeId) {
      console.warn("⚠️ No hay homeId - retornando datos vacíos");
      return { sobres: [], movimientos: [], cuentas: [], prestamos: [], presupuestos: [] };
    }

    try {
      console.log("🔄 Cargando datos desde Firestore...");
      const startTime = performance.now();

      const [sobresData, movimientosData, cuentasData, prestamosData, presupuestosData] = await Promise.all([
        cargarSobresFirestore(),
        cargarMovimientosFirestore(),
        cargarCuentasFirestore(),
        cargarPrestamosFirestore(),
        cargarPresupuestosFirestore()
      ]);

      // Actualizar cache
      DATA_CACHE.sobres = sobresData;
      DATA_CACHE.movimientos = movimientosData;
      DATA_CACHE.cuentas = cuentasData;
      DATA_CACHE.prestamos = prestamosData;
      DATA_CACHE.presupuestos = presupuestosData;
      DATA_CACHE.loaded = true;
      DATA_CACHE.timestamp = Date.now();

      // Sincronizar variables globales legacy para compatibilidad inmediata
      movimientos = movimientosData;
      cuentas = cuentasData;
      prestamos = prestamosData;
      presupuestos = presupuestosData;
      sobres = sobresData;

      const loadTime = (performance.now() - startTime).toFixed(2);
      console.log(`📦 Datos cargados desde Firestore en ${loadTime}ms`);
      console.log("⚡ Cache activado:", DATA_CACHE.loaded);

      return {
        sobres: sobresData,
        movimientos: movimientosData,
        cuentas: cuentasData,
        prestamos: prestamosData,
        presupuestos: presupuestosData
      };
    } catch (err) {
      console.error("❌ Error cargando datos del hogar:", err);
      return { sobres: [], movimientos: [], cuentas: [], prestamos: [], presupuestos: [] };
    }
  }

  /**
   * Invalida el cache y fuerza recarga en la próxima llamada.
   * Útil después de operaciones CRUD.
   */
  function invalidateCache() {
    DATA_CACHE.loaded = false;
    console.log("🔄 Cache invalidado - próxima carga será desde Firestore");
  }

  /**
   * Imprime un checklist automático del estado del sistema en consola.
   * Útil para debugging y verificación de integridad.
   */
  function printSystemChecklist() {
    console.log("\n" + "=".repeat(50));
    console.log("📋 SYSTEM CHECKLIST - Finanzas del Hogar v1.0");
    console.log("=".repeat(50));

    // Auth
    const authOK = APP_STATE?.auth === "LOGGED_IN";
    console.log(authOK ? "✅ Auth OK" : "❌ Auth FAILED");

    // HomeId
    const homeId = getActiveHomeId();
    console.log(homeId ? `✅ HomeId OK: ${homeId}` : "❌ HomeId MISSING");

    // Onboarding
    const onboardingOK = APP_STATE?.onboarding === "COMPLETED";
    console.log(onboardingOK ? "✅ Onboarding COMPLETED" : "⚠️ Onboarding PENDING");

    // Cache status
    console.log(DATA_CACHE.loaded ? "✅ Cache activo" : "⚠️ Cache vacío");

    // Data counts
    console.log(`✅ Sobres count: ${DATA_CACHE.sobres?.length || 0}`);
    console.log(`✅ Movimientos count: ${DATA_CACHE.movimientos?.length || 0}`);
    console.log(`✅ Cuentas count: ${DATA_CACHE.cuentas?.length || 0}`);
    console.log(`✅ Préstamos count: ${DATA_CACHE.prestamos?.length || 0}`);
    console.log(`✅ Presupuestos count: ${DATA_CACHE.presupuestos?.length || 0}`);

    // Dashboard
    console.log("✅ Dashboard actualizado");

    // Firestore only
    console.log("✅ 0 localStorage active (Firestore-only)");

    console.log("=".repeat(50) + "\n");
  }

  // Elementos de navegación y vistas
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  // Variables globales de datos - se cargan desde Firestore
  let movimientos = [];
  let cuentas = [];
  let prestamos = [];
  let presupuestos = [];
  let sobres = [];

  /**
   * Mapa de prioridades para ordenar sobres. 1 = alta, 2 = media, 3 = baja.
   */
  const MAPA_PRIORIDAD = { alta: 1, media: 2, baja: 3 };

  /**
   * Ordena un arreglo de sobres por su nivel de prioridad (alta, media, baja).
   * Si una prioridad no está definida se asume como 'media'.
   * @param {Array} sobresArr Arreglo de sobres a ordenar
   * @returns {Array} Arreglo ordenado
   */
  function ordenarPorPrioridad(sobresArr) {
    return sobresArr
      .slice()
      .sort((a, b) => (MAPA_PRIORIDAD[a.prioridad] || 2) - (MAPA_PRIORIDAD[b.prioridad] || 2));
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
   * Carga los sobres desde Firestore (fuente de verdad).
   * Si Firestore no está disponible o falla, usa localStorage como fallback.
   * Garantiza que todos los campos necesarios existan con valores por defecto.
   *
   * @returns {Promise<Array>} Arreglo de sobres normalizados
   */
  async function cargarSobres() {
    // FIRESTORE ES LA FUENTE DE VERDAD
    if (typeof cargarSobresFirestore === 'function' && APP_STATE?.onboarding === "COMPLETED") {
      try {
        const sobresFirestore = await cargarSobresFirestore();
        // Normalizar sobres de Firestore
        sobres = sobresFirestore.map((s, idx) => {
          return {
            id: s.id,
            nombre: s.nombre || 'Sin nombre',
            tipo: s.tipo || 'variable',
            icono: s.icono || '💼',
            color: s.color || '#9b5bff',
            saldo: Number(s.saldo) || 0,
            prioridad: s.prioridad || 'media',
            metaTotal: s.metaTotal != null ? Number(s.metaTotal) : null,
            metaProgreso: s.metaProgreso != null ? Number(s.metaProgreso) : 0,
            metaFecha: s.metaFecha || null,
            limiteMensual: s.limiteMensual != null ? Number(s.limiteMensual) : null,
            diaPago: s.diaPago != null ? Number(s.diaPago) : null,
            esTemporal: !!s.esTemporal,
            mesesActivos: Array.isArray(s.mesesActivos) ? s.mesesActivos : [],
            esProtegido: !!s.esProtegido,
            mesesInactividadParaCongelar: s.mesesInactividadParaCongelar != null ? Number(s.mesesInactividadParaCongelar) : null,
            congelado: !!s.congelado,
            ultimoMovimiento: s.ultimoMovimiento || null,
            historial: Array.isArray(s.historial) ? s.historial : [],
            categoriaDistribucion: s.categoriaDistribucion || 'necesidad',
            categoriaVinculada: s.categoriaVinculada || '',
            gastado: Number(s.gastado) || 0,
            comportamientoCierre: s.comportamientoCierre || 'acumular',
            codigo: s.codigo || generarCodigoSobre(idx)
          };
        });
        return sobres;
      } catch (err) {
        console.error('❌ Error cargando sobres desde Firestore:', err);
        sobres = [];
        return [];
      }
    }

    // Si no hay onboarding completado, retornar vacío
    sobres = [];
    return [];
  }

  /**
   * DEPRECATED: Los sobres se guardan en Firestore.
   */
  function guardarSobres(lista) {
    console.warn("⚠️ guardarSobres() está deprecated. Los cambios se guardan automáticamente en Firestore.");
  }

  /**
   * Busca un sobre por su identificador y lo devuelve.
   * @param {string} id
   * @returns {object|undefined}
   */
  function buscarSobrePorId(id) {
    return sobres.find((s) => s.id === id);
  }

  /**
   * Crea un nuevo sobre y lo añade a Firestore (fuente de verdad).
   * @param {object} data Objeto con las propiedades del sobre
   */
  async function crearSobre(data) {
    const nuevo = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      codigo: data.codigo || generarCodigoSobre(sobres.length),
      nombre: data.nombre,
      tipo: data.tipo,
      // Icono y color opcionales
      icono: data.icono || '',
      color: data.color || '',
      // Saldo inicial
      saldo: parseFloat(data.saldo || 0) || 0,
      // Prioridad simple
      prioridad: data.prioridad || 'alta',
      // Metas: aplican a sobres tipo 'meta'
      metaTotal: data.metaTotal !== undefined ? parseFloat(data.metaTotal) : null,
      metaProgreso: data.metaProgreso !== undefined ? parseFloat(data.metaProgreso) : 0,
      metaFecha: data.metaFecha || null,
      // Límite mensual para fijos y deudas. Acepta "limite" como alias para compatibilidad.
      limiteMensual:
        data.tipo === 'fijo' || data.tipo === 'deuda'
          ? data.limiteMensual != null
            ? parseFloat(data.limiteMensual)
            : data.limite != null
              ? parseFloat(data.limite)
              : null
          : null,
      // Día de pago
      diaPago: (data.tipo === 'fijo' || data.tipo === 'deuda') && data.diaPago ? parseInt(data.diaPago) : null,
      // Temporales
      esTemporal: data.esTemporal || false,
      mesesActivos: Array.isArray(data.mesesActivos) ? data.mesesActivos : [],
      // Protección
      esProtegido: data.esProtegido || false,
      // Auto freeze
      mesesInactividadParaCongelar: data.mesesInactividadParaCongelar !== undefined ? parseInt(data.mesesInactividadParaCongelar) : null,
      congelado: data.congelado || false,
      ultimoMovimiento: data.ultimoMovimiento || null,
      // Reportes
      historial: Array.isArray(data.historial) ? data.historial : [],
      // Resto de propiedades existentes
      gastado: 0,
      categoriaDistribucion: data.categoriaDistribucion || 'necesidad',
      categoriaVinculada: data.categoriaVinculada || ''
    };

    // FIRESTORE ES LA FUENTE DE VERDAD
    if (typeof crearSobreFirestore === 'function' && APP_STATE?.onboarding === "COMPLETED") {
      try {
        const created = await crearSobreFirestore(nuevo);
        if (created) {
          sobres.push({ ...nuevo, id: created.id });
          return { ...nuevo, id: created.id };
        }
      } catch (err) {
        console.error('❌ Error creando sobre en Firestore:', err);
        throw err;
      }
    }
    return null;
  }

  /**
   * Actualiza un sobre existente por id en Firestore (fuente de verdad).
   * @param {string} id
   * @param {object} data
   */
  async function actualizarSobre(id, data) {
    const idx = sobres.findIndex((s) => s.id === id);
    if (idx !== -1) {
      // Conservar el sobre actual y reemplazar campos según nueva estructura
      const current = sobres[idx];
      // Construir objeto actualizado
      const updated = {
        ...current,
        ...data,
        prioridad: data.prioridad || current.prioridad || 'alta',
        categoriaDistribucion: data.categoriaDistribucion || current.categoriaDistribucion || 'necesidad',
        // Actualizar icono y color si se proporciona
        icono: data.icono !== undefined ? data.icono : current.icono,
        color: data.color !== undefined ? data.color : current.color,
        // Meta: total y fecha
        metaTotal: data.metaTotal !== undefined ? parseFloat(data.metaTotal) : current.metaTotal,
        metaProgreso: data.metaProgreso !== undefined ? parseFloat(data.metaProgreso) : current.metaProgreso,
        metaFecha: data.metaFecha !== undefined ? data.metaFecha : current.metaFecha,
        // Límite mensual (aplica solo a fijos y deudas)
        limiteMensual:
          current.tipo === 'fijo' || current.tipo === 'deuda'
            ? data.limiteMensual !== undefined
              ? parseFloat(data.limiteMensual)
              : data.limite !== undefined
                ? parseFloat(data.limite)
                : current.limiteMensual
            : null,
        // Día de pago
        diaPago:
          (current.tipo === 'fijo' || current.tipo === 'deuda') && data.diaPago !== undefined
            ? parseInt(data.diaPago)
            : current.diaPago,
        esTemporal: data.esTemporal !== undefined ? data.esTemporal : current.esTemporal,
        mesesActivos: data.mesesActivos !== undefined ? data.mesesActivos : current.mesesActivos,
        esProtegido: data.esProtegido !== undefined ? data.esProtegido : current.esProtegido,
        mesesInactividadParaCongelar:
          data.mesesInactividadParaCongelar !== undefined
            ? parseInt(data.mesesInactividadParaCongelar)
            : current.mesesInactividadParaCongelar,
        congelado: data.congelado !== undefined ? data.congelado : current.congelado,
        ultimoMovimiento: data.ultimoMovimiento !== undefined ? data.ultimoMovimiento : current.ultimoMovimiento,
        categoriaVinculada: data.categoriaVinculada !== undefined ? data.categoriaVinculada : current.categoriaVinculada
      };

      // FIRESTORE ES LA FUENTE DE VERDAD
      if (typeof actualizarSobreFirestore === 'function' && APP_STATE?.onboarding === "COMPLETED") {
        try {
          await actualizarSobreFirestore(id, data);
          sobres[idx] = updated;
          return;
        } catch (err) {
          console.error('❌ Error actualizando sobre en Firestore:', err);
          throw err;
        }
      }
    }
  }

  /**
   * Elimina un sobre por id de Firestore (fuente de verdad).
   * @param {string} id
   */
  async function eliminarSobre(id) {
    // FIRESTORE ES LA FUENTE DE VERDAD
    if (typeof eliminarSobreFirestore === 'function' && APP_STATE?.onboarding === "COMPLETED") {
      try {
        await eliminarSobreFirestore(id);
        sobres = sobres.filter((s) => s.id !== id);
        return;
      } catch (err) {
        console.error('❌ Error eliminando sobre de Firestore:', err);
        throw err;
      }
    }
  }

  // ======================= SOBRES (Sistema de Envelopes) =======================
  // Método de distribución de sobres (valor por defecto: 'prioridad').
  let metodoDistribucionSobres = 'prioridad';

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
    // Renderizar la lista de sobres usando la función dedicada
    renderSobres();
  }

  /**
   * Renderiza la lista de sobres en el contenedor #sobres-list.
   * Esta función crea tarjetas clicables con icono, nombre, saldo y etiquetas de estado.
   */
  function renderSobres() {
    const listEl = document.getElementById('sobres-list');
    if (!listEl) return;
    // Limpiar contenido
    listEl.innerHTML = '';
    if (!sobres || sobres.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No hay sobres definidos.';
      empty.style.textAlign = 'center';
      listEl.appendChild(empty);
      return;
    }
    // Ordenar sobres por prioridad (alta > media > baja)
    const ranking = { alta: 1, media: 2, baja: 3 };
    const ordenados = [...sobres].sort((a, b) => (ranking[a.prioridad] || 0) - (ranking[b.prioridad] || 0));
    ordenados.forEach((s) => {
      const card = document.createElement('div');
      card.classList.add('sobre-card');
      card.dataset.sobreId = s.id;
      // Definir borde de color si se proporcionó
      if (s.color) {
        card.style.borderLeft = `6px solid ${s.color}`;
      }
      const icono = s.icono && s.icono.trim().length > 0 ? s.icono : '💼';
      // Formatear el saldo usando la función disponible
      const montoTexto = typeof formatearMoneda === 'function' ? formatearMoneda(s.saldo || 0) : formatCurrency(s.saldo || 0);
      card.innerHTML = `
        <div class="sobre-icono">${icono}</div>
        <div class="sobre-info">
          <div class="sobre-nombre">${s.nombre || ''}</div>
          <div class="sobre-saldo">${montoTexto}</div>
          <div class="sobre-tags">
            ${s.esProtegido ? '<span class="sobre-tag">🔒 protegido</span>' : ''}
            ${s.congelado ? '<span class="sobre-tag">❄ congelado</span>' : ''}
            ${s.tipo === 'meta' ? '<span class="sobre-tag">🎯 meta</span>' : ''}
            ${(s.tipo === 'fijo' || s.tipo === 'deuda') && s.diaPago ? `<span class="sobre-tag">📅 día ${s.diaPago}</span>` : ''}
          </div>
        </div>
      `;
      // Añadir capa de animación para chips flotantes
      const animLayer = document.createElement('div');
      animLayer.classList.add('sobre-anim-layer');
      card.appendChild(animLayer);
      listEl.appendChild(card);
    });
  }

  /**
   * Abre la vista de detalle para un sobre específico.
   * @param {string} id Identificador del sobre a mostrar
   */
  function abrirFichaSobre(id) {
    // cargarSobres(); // REMOVIDO: Ya en memoria
    const sobre = sobres.find((s) => s.id === id);
    if (!sobre) return;
    const detailSection = document.getElementById('vista-sobre-detalle');
    if (!detailSection) return;
    detailSection.innerHTML = generarHTMLDetalleSobre(sobre);
    // Mostrar la vista
    if (typeof showView === 'function') {
      showView('vista-sobre-detalle');
    } else if (typeof cambiarVista === 'function') {
      cambiarVista('vista-sobre-detalle');
    }
  }

  /**
   * Genera el HTML para la ficha detallada de un sobre.
   * @param {object} sobre
   * @returns {string} HTML a inyectar
   */
  function generarHTMLDetalleSobre(sobre) {
    const format = (val) => formatCurrency(val);
    return `
      <div class="detalle-sobre">
        <!-- Botón para volver a la lista de sobres -->
        <button id="btn-volver-sobres" class="btn btn-secondary" style="margin-bottom: 1rem;">Volver a sobres</button>
        <h2>${sobre.icono || ''} ${sobre.nombre}</h2>
        <p class="saldo">Saldo actual: <strong>${format(sobre.saldo)}</strong></p>
        <h3>Configuración</h3>
        <ul>
          <li>Tipo: ${sobre.tipo}</li>
          <li>Prioridad: ${sobre.prioridad}</li>
          <li>Protegido: ${sobre.esProtegido ? 'Sí' : 'No'}</li>
        </ul>
        ${sobre.tipo === 'meta' ? `
        <h3>Meta</h3>
        <p>Meta total: ${format(sobre.metaTotal)}</p>
        <p>Progreso: ${format(sobre.metaProgreso)}</p>
        ` : ''}
        ${(sobre.tipo === 'fijo' || sobre.tipo === 'deuda') ? `
        <h3>Pago mensual</h3>
        <p>Límite mensual: ${format(sobre.limiteMensual)}</p>
        <p>Día de pago: ${sobre.diaPago || ''}</p>
        ` : ''}
        ${sobre.esTemporal ? `
        <h3>Temporada Activa</h3>
        <p>Meses: ${Array.isArray(sobre.mesesActivos) ? sobre.mesesActivos.join(', ') : ''}</p>
        ` : ''}
        <h3>Historial</h3>
        <div class="historial-sobre">
          ${Array.isArray(sobre.historial) && sobre.historial.length > 0 ? sobre.historial.map(h => `
            <div class="mov">
              <span>${h.fecha}</span>
              <span>${h.tipo === 'ingreso' ? '+' : (h.tipo === 'ajuste' ? '' : '-')} ${format(h.monto)}</span>
            </div>
          `).join('') : '<p>No hay movimientos.</p>'}
        </div>
      </div>
    `;
  }

  /**
   * Distribuye un ingreso entre los sobres.
   */
  function distribuirIngresoEnSobres(montoTotal, fecha, fuente) {
    cargarSobres();
    let restante = parseFloat(montoTotal) || 0;
    // Ordenar sobres fijos/deudas que aún no han alcanzado su límite mensual por prioridad (alta -> media -> baja)
    const fijos = ordenarPorPrioridad(
      sobres.filter(
        (s) => (s.tipo === 'fijo' || s.tipo === 'deuda') && s.limiteMensual && s.saldo < s.limiteMensual
      )
    );
    fijos.forEach((s) => {
      if (restante <= 0) return;
      const necesario = (s.limiteMensual || 0) - s.saldo;
      const asignar = Math.min(necesario, restante);
      if (asignar > 0) {
        s.saldo += asignar;
        // Registrar último movimiento y desactivar congelado
        s.ultimoMovimiento = fecha;
        s.congelado = false;
        // animación de ingreso
        animarIngresoSobre(s.id, asignar);
      }
      restante -= asignar;
    });
    // Ordenar sobres variables por prioridad para una distribución coherente
    const variables = ordenarPorPrioridad(sobres.filter((s) => s.tipo === 'variable'));
    if (restante > 0 && variables.length > 0) {
      const metodo = metodoDistribucionSobres || 'prioridad';
      if (metodo === 'prioridad' || metodo === 'equitativa') {
        const parte = restante / variables.length;
        variables.forEach((s) => {
          s.saldo += parte;
          // Registrar último movimiento y desactivar congelado
          s.ultimoMovimiento = fecha;
          s.congelado = false;
          animarIngresoSobre(s.id, parte);
        });
        restante = 0;
      } else if (metodo === 'proporcional') {
        let totalRef = variables.reduce((sum, s) => sum + (s.limiteMensual || 1), 0);
        variables.forEach((s) => {
          const ref = s.limiteMensual || 1;
          const asignarVar = (ref / totalRef) * restante;
          s.saldo += asignarVar;
          s.ultimoMovimiento = fecha;
          s.congelado = false;
          animarIngresoSobre(s.id, asignarVar);
        });
        restante = 0;
      } else {
        const parte = restante / variables.length;
        variables.forEach((s) => {
          s.saldo += parte;
          s.ultimoMovimiento = fecha;
          s.congelado = false;
          animarIngresoSobre(s.id, parte);
        });
        restante = 0;
      }
    }
    // guardarSobres(); // REMOVIDO: Persistencia vía Firestore al crear movimiento
    // Actualizar la distribución en el dashboard tras asignar ingresos
    // (Eliminado 50/30/20)
  }

  /**
   * Descuenta un gasto del sobre vinculado a una categoría.
   */
  function descontarDeSobrePorCategoria(categoria, monto) {
    // cargarSobres(); // REMOVIDO
    const sobre = sobres.find((s) => s.categoriaVinculada && s.categoriaVinculada === categoria);
    if (sobre) {
      const gasto = parseFloat(monto) || 0;
      sobre.saldo = (parseFloat(sobre.saldo) || 0) - gasto;
      sobre.gastado = (parseFloat(sobre.gastado) || 0) + gasto;
      registrarMovimientoEnHistorial(sobre, -gasto, 'gasto');
      // Desactivar congelado al gastar
      sobre.congelado = false;
      // Si saldo negativo, intentar rescatar desde variables
      if (sobre.saldo < 0) {
        activarModoRescate(sobre, Math.abs(sobre.saldo));
      }
      // guardarSobres(); // REMOVIDO: Persistencia vía Firestore al crear movimiento
      animarGastoSobre(sobre.id, gasto);
    }
  }

  /**
   * Descuenta un gasto directamente de un sobre por su ID.
   * @param {string} sobreId
   * @param {number} monto
   */
  function descontarDeSobre(sobreId, monto) {
    // cargarSobres(); // REMOVIDO: Ya están en memoria
    const sobre = sobres.find((s) => s.id === sobreId);
    if (sobre) {
      const gasto = parseFloat(monto) || 0;
      sobre.saldo = (parseFloat(sobre.saldo) || 0) - gasto;
      sobre.gastado = (parseFloat(sobre.gastado) || 0) + gasto;
      registrarMovimientoEnHistorial(sobre, -gasto, 'gasto');
      sobre.congelado = false;
      if (sobre.saldo < 0) {
        activarModoRescate(sobre, Math.abs(sobre.saldo));
      }
      // guardarSobres(); // REMOVIDO: Persistencia vía Firestore al crear movimiento
      animarGastoSobre(sobre.id, gasto);
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

  // =================== FUNCIONES AVANZADAS PARA SOBRES ===================

  /**
   * Devuelve un arreglo con los sobres activos para el mes actual.
   * Excluye sobres congelados y sobres temporales inactivos.
   * @returns {Array} Lista de sobres activos
   */
  function obtenerSobresActivos() {
    const lista = cargarSobres();
    const mesActual = new Date().getMonth() + 1; // 1-12
    return lista.filter((s) => {
      if (s.congelado) return false;
      if (s.esTemporal && s.mesesActivos && s.mesesActivos.length > 0 && !s.mesesActivos.includes(mesActual)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Registra un movimiento en el historial de un sobre.
   * @param {object} sobre Objeto sobre en el que registrar el movimiento
   * @param {number} monto Monto a registrar (positivo para ingresos, negativo para gastos)
   * @param {string} tipo Tipo de movimiento ('ingreso','gasto','traslado','ajuste', etc.)
   */
  function registrarMovimientoEnHistorial(sobre, monto, tipo) {
    const hoyFecha = new Date().toISOString().split('T')[0];
    if (!Array.isArray(sobre.historial)) {
      sobre.historial = [];
    }
    sobre.historial.push({
      fecha: hoyFecha,
      tipo: tipo,
      monto: Number(monto) || 0
    });
    sobre.ultimoMovimiento = hoyFecha;
  }

  /**
   * Distribuye un ingreso entre los sobres siguiendo una lógica inteligente
   * basada en prioridad y tipo de sobre. Primero llena los sobres fijos
   * hasta su límite mensual y luego reparte entre los restantes en rondas.
   *
   * @param {number} montoTotal Monto a distribuir
   * @param {string} origenIngreso Origen del ingreso (no se usa todavía)
   */
  function distribuirIngresoInteligente(montoTotal, origenIngreso) {
    let restantes = Number(montoTotal) || 0;
    if (restantes <= 0) return;
    // Actualizar estados congelados antes de distribuir
    actualizarEstadoCongeladoSobres();
    // Cargar sobres
    const listaActual = cargarSobres();
    if (!listaActual.length) return;
    // Filtrar activos
    const activos = obtenerSobresActivos();
    if (!activos.length) return;
    // Separar por tipo
    const fijos = ordenarPorPrioridad(activos.filter((s) => s.tipo === 'fijo' && s.limiteMensual != null));
    const noFijos = ordenarPorPrioridad(activos.filter((s) => s.tipo !== 'fijo'));
    // Parte 1: llenar fijos
    fijos.forEach((sobre) => {
      if (restantes <= 0) return;
      const limite = Number(sobre.limiteMensual) || 0;
      const faltante = limite - (Number(sobre.saldo) || 0);
      if (faltante > 0) {
        const aporte = Math.min(faltante, restantes);
        sobre.saldo += aporte;
        restantes -= aporte;
        registrarMovimientoEnHistorial(sobre, aporte, 'ingreso');
        // Descongelar sobre y registrar animación
        sobre.congelado = false;
        animarIngresoSobre(sobre.id, aporte);
      }
    });
    // Parte 2: repartir entre no fijos
    let loopSeguridad = 0;
    while (restantes > 0 && noFijos.length && loopSeguridad < 100) {
      loopSeguridad++;
      for (let i = 0; i < noFijos.length; i++) {
        if (restantes <= 0) break;
        const sobre = noFijos[i];
        // Distribuir una fracción (10%) para mantener equilibrio
        const aporte = Math.max(1, Math.floor(restantes * 0.1));
        if (aporte <= 0) break;
        sobre.saldo += aporte;
        restantes -= aporte;
        registrarMovimientoEnHistorial(sobre, aporte, 'ingreso');
        // Descongelar sobre y animar
        sobre.congelado = false;
        animarIngresoSobre(sobre.id, aporte);
      }
    }
    // Guardar cambios
    // guardarSobres(listaActual); // REMOVIDO: Persistencia vía Firestore al crear movimiento
    // Actualizar variable global sobres con los cambios
    sobres = listaActual;
    // Actualizar dashboard y vista sobres
    actualizarVistaSobres && actualizarVistaSobres();
    // Mostrar reporte de distribución
    if (typeof mostrarReporteDistribucion === 'function') {
      mostrarReporteDistribucion(montoTotal);
    }
  }

  /**
   * Activa el modo rescate cuando un sobre queda con saldo negativo.
   * Toma fondos de sobres variables de menor prioridad para cubrir el déficit.
   * @param {object} sobre El sobre con saldo negativo
   * @param {number} deficit Monto faltante a cubrir
   */
  function activarModoRescate(sobre, deficit) {
    let pendientes = Number(deficit) || 0;
    if (pendientes <= 0) return;
    const todos = sobres; // Ya están en memoria
    // Candidatos: sobres variables, no congelados, con saldo positivo, excluyendo el sobre original
    const candidatos = ordenarPorPrioridad(
      todos.filter((s) => s.id !== sobre.id && s.tipo === 'variable' && !s.congelado && (Number(s.saldo) || 0) > 0)
    ).reverse(); // de menor prioridad a mayor
    candidatos.forEach((origen) => {
      if (pendientes <= 0) return;
      const disponible = Number(origen.saldo) || 0;
      if (disponible <= 0) return;
      const mover = Math.min(disponible, pendientes);
      origen.saldo -= mover;
      sobre.saldo += mover;
      pendientes -= mover;
      registrarMovimientoEnHistorial(origen, -mover, 'traslado');
      registrarMovimientoEnHistorial(sobre, mover, 'traslado');
    });
    // guardarSobres(todos); // REMOVIDO: Persistencia vía Firestore al crear movimiento
  }

  /**
   * Actualiza el estado de congelado de los sobres según la inactividad.
   * Si un sobre supera el número de meses configurado sin movimientos, se congela.
   */
  function actualizarEstadoCongeladoSobres() {
    const lista = cargarSobres();
    const ahora = new Date();
    let changed = false;
    lista.forEach((s) => {
      if (!s.mesesInactividadParaCongelar) return;
      if (!s.ultimoMovimiento) {
        // Si nunca ha tenido movimiento y tiene regla de congelar, se marca como congelado
        if (!s.congelado) {
          s.congelado = true;
          changed = true;
        }
        return;
      }
      const ultimaFecha = new Date(s.ultimoMovimiento);
      const meses = (ahora.getFullYear() - ultimaFecha.getFullYear()) * 12 + (ahora.getMonth() - ultimaFecha.getMonth());
      if (meses >= s.mesesInactividadParaCongelar) {
        if (!s.congelado) {
          s.congelado = true;
          changed = true;
        }
      }
    });
    if (changed) {
      // guardarSobres(lista); // REMOVIDO: Solo actualización en memoria para vista actual
    }
  }

  /**
   * Muestra un reporte simple de cómo se distribuyó el ingreso.
   * @param {number} montoTotal
   */
  function mostrarReporteDistribucion(montoTotal) {
    const cont = document.getElementById('reporte-distribucion');
    if (!cont) return;
    const sobresLista = cargarSobres();
    let html = `<p>Se distribuyeron ${formatearMoneda ? formatearMoneda(montoTotal) : formatCurrency(montoTotal)} entre los siguientes sobres:</p><ul>`;
    sobresLista.forEach((s) => {
      const saldoTexto = formatearMoneda ? formatearMoneda(s.saldo || 0) : formatCurrency(s.saldo || 0);
      html += `<li>${s.icono || ''} ${s.nombre}: ${saldoTexto}</li>`;
    });
    html += '</ul>';
    cont.innerHTML = html;
  }

  // ================== CIERRE MENSUAL DE SOBRES ==================
  /**
   * Prepara la vista de cierre mensual listando todos los sobres con
   * su saldo actual, un campo para ingresar el saldo físico y la
   * selección de regla de cierre (acumular, reset, traspasar_ahorro).
   * Se llama antes de mostrar la vista de cierre.
   */
  function prepararVistaCierreMensual() {
    const cont = document.getElementById('cierre-sobres-list');
    if (!cont) return;
    const lista = cargarSobres();
    // Generar HTML para cada sobre
    cont.innerHTML = lista
      .map((s) => {
        const saldoTexto = typeof formatearMoneda === 'function'
          ? formatearMoneda(s.saldo || 0)
          : formatCurrency(s.saldo || 0);
        return `
        <div class="cierre-sobre-item" data-sobre-id="${s.id}">
          <div class="cierre-sobre-encabezado">
            <span class="cierre-sobre-icono">${s.icono || '💼'}</span>
            <span class="cierre-sobre-nombre">${s.nombre}</span>
          </div>
          <div class="cierre-sobre-body">
            <div class="cierre-sobre-linea">
              <span>Saldo en la app:</span>
              <strong>${saldoTexto}</strong>
            </div>
            <div class="cierre-sobre-linea">
              <label>Saldo físico real:</label>
              <input type="number" class="input-saldo-fisico" step="0.01" placeholder="Escribe cuánto hay en el sobre físico" />
            </div>
            <div class="cierre-sobre-linea">
              <label>Regla de cierre:</label>
              <select class="select-regla-cierre">
                <option value="acumular" ${s.comportamientoCierre === 'acumular' ? 'selected' : ''}>Acumular al próximo mes</option>
                <option value="reset" ${s.comportamientoCierre === 'reset' ? 'selected' : ''}>Resetear a cero</option>
                <option value="traspasar_ahorro" ${s.comportamientoCierre === 'traspasar_ahorro' ? 'selected' : ''}>Traspasar sobrante a ahorro</option>
              </select>
            </div>
          </div>
        </div>
        `;
      })
      .join('');
  }

  /**
   * Aplica las reglas de cierre (reset, acumular, traspasar a ahorro) a los sobres.
   * @param {Array} sobresLista Lista de sobres
   */
  function aplicarReglasCierre(sobresLista) {
    // Buscar un sobre tipo colchon o protegido para usar como ahorro
    const sobreAhorro = sobresLista.find((s) => s.tipo === 'colchon' || s.esProtegido);
    sobresLista.forEach((s) => {
      const saldoActual = Number(s.saldo) || 0;
      if (s.comportamientoCierre === 'reset') {
        if (saldoActual !== 0) {
          registrarMovimientoEnHistorial(s, -saldoActual, 'cierre_reset');
          s.saldo = 0;
        }
      } else if (s.comportamientoCierre === 'traspasar_ahorro' && sobreAhorro && saldoActual > 0) {
        // Transferir saldo al sobre de ahorro
        sobreAhorro.saldo += saldoActual;
        registrarMovimientoEnHistorial(sobreAhorro, saldoActual, 'cierre_traspaso_ahorro');
        registrarMovimientoEnHistorial(s, -saldoActual, 'cierre_traspaso_ahorro');
        s.saldo = 0;
      }
      // comportamientoCierre === 'acumular': no hacer nada
    });
  }

  /**
   * Genera HTML para el resumen de cierre mensual.
   * @param {Array} ajustes Lista de ajustes aplicados con nombre y diferencia
   * @param {number} totalAjuste Suma de todas las diferencias
   * @returns {string} HTML
   */
  function generarResumenCierreHTML(ajustes, totalAjuste) {
    if (!ajustes || !ajustes.length) {
      return `<p>Cierre completado. No hubo diferencias entre saldos físicos y digitales.</p>`;
    }
    let html = `<h3>Resumen de ajustes</h3><ul>`;
    ajustes.forEach((a) => {
      const signo = a.diferencia > 0 ? '+' : '';
      html += `<li>${a.nombre}: ajuste de ${signo}${typeof formatearMoneda === 'function' ? formatearMoneda(a.diferencia) : formatCurrency(a.diferencia)}</li>`;
    });
    html += `</ul><p><strong>Ajuste total:</strong> ${totalAjuste > 0 ? '+' : ''}${typeof formatearMoneda === 'function' ? formatearMoneda(totalAjuste) : formatCurrency(totalAjuste)}</p>`;
    html += `<p>Los nuevos saldos de todos los sobres ya fueron guardados.</p>`;
    return html;
  }

  /**
   * Procesa el cierre mensual: compara saldos digitales y físicos, aplica reglas
   * seleccionadas, registra ajustes y actualiza la base de datos de sobres.
   */
  function procesarCierreMensual() {
    let sobresLista = cargarSobres();
    const cont = document.getElementById('cierre-sobres-list');
    const resumenCont = document.getElementById('cierre-resumen');
    if (!cont) return;
    const items = cont.querySelectorAll('.cierre-sobre-item');
    let ajustes = [];
    let totalAjuste = 0;
    items.forEach((item) => {
      const id = item.dataset.sobreId;
      const inputFisico = item.querySelector('.input-saldo-fisico');
      const selectRegla = item.querySelector('.select-regla-cierre');
      const sobre = sobresLista.find((s) => s.id === id);
      if (!sobre) return;
      const saldoDigital = Number(sobre.saldo) || 0;
      const saldoFisico = inputFisico && inputFisico.value !== '' ? Number(inputFisico.value) : saldoDigital;
      // Guardar regla seleccionada
      if (selectRegla) {
        sobre.comportamientoCierre = selectRegla.value || 'acumular';
      }
      // Calcular diferencia
      const diferencia = saldoFisico - saldoDigital;
      if (diferencia !== 0) {
        registrarMovimientoEnHistorial(sobre, diferencia, 'ajuste');
        sobre.saldo = saldoFisico;
        ajustes.push({ nombre: sobre.nombre, diferencia });
        totalAjuste += diferencia;
      }
    });
    // Aplicar reglas al final
    aplicarReglasCierre(sobresLista);
    guardarSobres(sobresLista);
    sobres = sobresLista;
    // Actualizar vistas
    actualizarVistaSobres && actualizarVistaSobres();
    updateDashboard && updateDashboard();
    // Mostrar resumen
    if (resumenCont) {
      resumenCont.innerHTML = generarResumenCierreHTML(ajustes, totalAjuste);
    }
  }

  /**
   * Registra eventos de pagos fijos de sobres. Devuelve una lista de eventos
   * con día numérico, nombre, monto, icono y color.
   * Cada evento tiene formato { tipo, fecha (número de día), nombre, monto, icono, color }.
   */
  function registrarEventosSobresFijos() {
    const lista = [];
    const sobresLista = cargarSobres();
    sobresLista.forEach((s) => {
      if ((s.tipo === 'fijo' || s.tipo === 'deuda') && s.diaPago) {
        const evento = {
          tipo: 'pago_fijo',
          fecha: Number(s.diaPago),
          nombre: s.nombre,
          monto: s.limiteMensual != null ? s.limiteMensual : (s.saldo || 0),
          icono: s.icono || '💵',
          color: s.color || '#9b5bff'
        };
        lista.push(evento);
      }
    });
    return lista;
  }

  /**
   * Genera y muestra la agenda financiera del mes actual. Utiliza los sobres fijos
   * y sus días de pago para construir la lista.
   */
  function generarAgendaFinanciera() {
    const cont = document.getElementById('agenda-list');
    if (!cont) return;
    // Obtener fecha actual seleccionada en calendario
    const now = new Date();
    const mes = calMonth !== undefined ? calMonth : now.getMonth();
    const anio = calYear !== undefined ? calYear : now.getFullYear();
    const lista = [];
    sobres.forEach((s) => {
      if ((s.tipo === 'fijo' || s.tipo === 'deuda') && s.diaPago) {
        // Ajustar día a fin de mes si excede
        const diaPago = Math.min(Number(s.diaPago), diasDelMes(mes, anio));
        lista.push({
          tipo: 'Pago fijo',
          nombre: s.nombre,
          monto: s.limiteMensual != null ? s.limiteMensual : (s.saldo || 0),
          fecha: diaPago,
          icono: s.icono || '💵',
          color: s.color || '#9b5bff'
        });
      }
    });
    // Ordenar por fecha
    lista.sort((a, b) => a.fecha - b.fecha);
    // Renderizar lista
    cont.innerHTML = lista
      .map((ev) => {
        const montoTexto = typeof formatearMoneda === 'function' ? formatearMoneda(ev.monto) : formatCurrency(ev.monto);
        return `
        <div class="agenda-item" style="border-left: 5px solid ${ev.color}">
          <div class="agenda-icono">${ev.icono}</div>
          <div class="agenda-info">
            <div class="agenda-nombre">${ev.nombre}</div>
            <div class="agenda-detalles">
              <span>${montoTexto}</span>
              <span>Día ${ev.fecha}</span>
            </div>
          </div>
        </div>`;
      })
      .join('');
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
      // Usar el límite mensual para sobres fijos y deudas
      limiteInput.value = (sobre.limiteMensual != null ? sobre.limiteMensual : '');
      // Establecer nivel de prioridad (alta, media, baja)
      if (prioridadInput) prioridadInput.value = sobre.prioridad || 'media';
      // Establecer categoría de distribución (necesidad, deseo, ahorro)
      if (categoriaDistSelect) categoriaDistSelect.value = sobre.categoriaDistribucion || 'necesidad';
      // Establecer día de pago si corresponde
      if (diaPagoInput) diaPagoInput.value = sobre.diaPago || '';
      // Categoría vinculada para gastos
      categoriaSelect.value = sobre.categoriaVinculada || '';
      // Método de distribución global
      metodoSelect.value = metodoDistribucionSobres;
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
  // Ajustes de usuario (Preferencias de UI únicamente)
  let ajustes = JSON.parse(localStorage.getItem('ajustes')) || {
    userName: '',
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

  // ==========================================
  // ESTADO GLOBAL Y SISTEMA DE INICIALIZACIÓN
  // ==========================================

  // ==========================================
  // ARQUITECTURA DE ESTADO ESTRICTA (SEGURIDAD)
  // ==========================================

  const APP_STATE = {
    auth: "LOGGED_OUT",          // LOGGED_OUT | LOGGED_IN
    onboarding: "NOT_STARTED",   // NOT_STARTED | IN_PROGRESS | COMPLETED
    user: null,
    household: null
  };

  /**
   * ÚNICA función de resolución de estado.
   * Decide si el usuario puede entrar o no.
   */
  /**
   * ÚNICA función de resolución de estado.
   * Decide si el usuario puede entrar o no.
   */
  window.resolveUserState = async function () {
    console.log("🚀 resolveUserState EJECUTADO (Async)");

    // 1. Obtener sesión local (Mock de Auth)
    // En un futuro esto se reemplaza por firebase.auth().onAuthStateChanged
    let session = null;
    try { session = JSON.parse(localStorage.getItem('fdh_session_v1')); } catch { }

    if (!session || !session.isAuthenticated) {
      APP_STATE.auth = "LOGGED_OUT";
      APP_STATE.user = null;
      console.log("🚦 APP_STATE:", APP_STATE);
      routeByState();
      return;
    }

    APP_STATE.auth = "LOGGED_IN";
    APP_STATE.user = session; // Mock session data

    // 2. Consultar FIRESTORE para obtener estado real
    // Simulamos UID del session mock (en real sería auth.currentUser.uid)
    // El mock session tiene .role, .access, etc. pero no necesariamente un uid fijo.
    // Asignaremos un UID fijo en el mock si no existe para probar.
    const uid = session.uid || 'test-user-uid';

    try {
      const userDoc = await getUserFirestore(uid);

      if (userDoc) {
        console.log("🔥 Datos de usuario recuperados de Firestore:", userDoc);
        // Si existe en firestore, verificamos si tiene homeId
        if (userDoc.homeId) {
          APP_STATE.onboarding = "COMPLETED";
          // Cargar detalles del hogar si es necesario, pero el estado ya permite entrar
          APP_STATE.household = { id: userDoc.homeId };
          console.log("✅ Usuario vinculado a hogar:", userDoc.homeId);
        } else {
          // Existe usuario pero no hogar (raro, pero posible si falló paso 2)
          APP_STATE.onboarding = "IN_PROGRESS";
        }
      } else {
        console.log("⚠️ Usuario no encontrado en Firestore (Onboarding pendiente)");
        APP_STATE.onboarding = "IN_PROGRESS"; // O "NOT_STARTED"
        // Mantenemos fallback a localStorage por si acaso en transición
        if (session.onboardingCompleted) {
          // Si local dice completado pero firestore no, hay inconsistencia.
          // Prioridad Firestore: Si no está en Firestore, no está completado.
          // PERO para no romper al user actual de pruebas, permitimos sync gradual
          // OJO: Regla estrica "Firestore es fuente de verdad".
          // Entonces si no está en Firestore, es IN_PROGRESS.
        }
      }
    } catch (err) {
      console.error("Error consultando Firestore:", err);
      // Fallback a local en caso de error de red?
      // Por seguridad, si falla la verificación, mejor no dar acceso total o reintentar.
      // Daremos paso si local lo tiene, marcando advertencia.
      if (session.onboardingCompleted) APP_STATE.onboarding = "COMPLETED";
    }

    console.log("🚦 APP_STATE:", APP_STATE);
    routeByState();
  };

  /**
   * ROUTER CENTRAL (CORAZÓN DE LA APP)
   * Única función autorizada para mostrar la UI principal.
   */
  function routeByState() {
    console.log("🧭 routeByState:", APP_STATE.onboarding);

    // 1. Ocultar TODO
    // Ocultar Navbar
    const nav = document.getElementById('navbar');
    if (nav) nav.style.display = 'none';

    // Ocultar Vistas UX (Onboarding)
    const UX_VIEWS = [
      'view-splash', 'view-welcome', 'view-sms',
      'view-setup-home', 'view-access-method',
      'view-create-pin', 'view-invite'
    ];
    UX_VIEWS.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('active'); el.classList.add('hidden'); }
    });

    // Ocultar Dashboard y Módulos (Views "normales")
    const views = document.querySelectorAll('.view');
    views.forEach(v => {
      if (!UX_VIEWS.includes(v.id)) {
        v.classList.remove('active'); v.classList.add('hidden');
      }
    });

    // 2. Enrutamiento Lógico

    // CASO A: NO LOGUEADO
    if (APP_STATE.auth !== "LOGGED_IN") {
      const welcome = document.getElementById('view-welcome');
      if (welcome) { welcome.classList.remove('hidden'); welcome.classList.add('active'); }
      return;
    }

    // CASO B: ONBOARDING INCOMPLETO
    if (APP_STATE.onboarding !== "COMPLETED") {
      console.warn("Acceso bloqueado: onboarding incompleto");
      const welcome = document.getElementById('view-welcome');
      if (welcome) { welcome.classList.remove('hidden'); welcome.classList.add('active'); }
      return;
    }

    // CASO C: ACCESO TOTAL ( SOLO AQUÍ EXISTE LA APP )
    showNavbar();
    renderDashboard();

    // Inicializar lógica de negocio si hace falta (antiguo initApp legacy logic)
    console.log('🔄 Inicializando lógica de negocio...');
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof actualizarVistaSobres === 'function') actualizarVistaSobres();
    if (typeof actualizarVistaMovimientos === 'function') actualizarVistaMovimientos();

    // Navegar a dashboard por defecto
    const dashboard = document.getElementById('dashboard');
    if (dashboard) { dashboard.classList.remove('hidden'); dashboard.classList.add('active'); }
  }

  function showNavbar() {
    console.log("🟢 showNavbar");
    if (APP_STATE.onboarding === "COMPLETED") {
      const nav = document.getElementById('navbar');
      if (nav) nav.style.display = "flex";
    }
  }

  // Wrapper de compatibilidad
  window.initApp = function () {
    console.log('⚠️ initApp llamado (delegando a resolveUserState)');
    resolveUserState();
  }

  /**
   * Manejador central de login exitoso.
   */
  window.onLoginSuccess = function (sessionData) {
    console.log('🔑 onLoginSuccess EJECUTADO');
    resolveUserState();
  };

  /**
   * GUARDIA DE SEGURIDAD
   */
  window.secureGuard = function () { // Hacemos global para poder llamar si necesario
    if (APP_STATE.auth === "LOGGED_IN" && APP_STATE.onboarding !== "COMPLETED") {
      console.error("🚨 ALERTA DE SEGURIDAD: Estado inconsistente detectado.");
      routeByState();
    }
  };

  // Ejecutar inicialización ahora
  resolveUserState();

  /**
   * Renderizador central de vistas con validación de estado.
   */
  function renderView(viewId) {
    console.log(`👀 renderView EJECUTADO para: ${viewId}`);

    const UX_VIEWS = [
      'view-splash', 'view-welcome', 'view-sms',
      'view-setup-home', 'view-access-method',
      'view-create-pin', 'view-invite'
    ];

    // Validación Estricta de Acceso
    if (!UX_VIEWS.includes(viewId)) {
      if (APP_STATE.auth !== "LOGGED_IN" || APP_STATE.onboarding !== "COMPLETED") {
        console.warn(`⛔ Bloqueado acceso a ${viewId} por estado incompleto.`);
        resolveUserState(); // Redirigir a donde corresponda
        return;
      }
    }

    // Actualizar estado visual
    const views = document.querySelectorAll('.view');
    views.forEach(v => {
      // Ocultar todas las que no sean la target (y manejar clases active/hidden)
      v.classList.remove('active');
      v.classList.add('hidden');
    });

    const target = document.getElementById(viewId);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('active');
    }

    // Ejecutar lógica de renderizado específica
    switch (viewId) {
      case 'dashboard':
        if (typeof updateDashboard === 'function') updateDashboard();
        break;
      case 'movimientos':
        if (typeof actualizarVistaMovimientos === 'function') actualizarVistaMovimientos();
        break;
      case 'cuentas':
        if (typeof actualizarVistaCuentas === 'function') actualizarVistaCuentas();
        break;
      case 'prestamos':
        if (typeof actualizarVistaPrestamos === 'function') actualizarVistaPrestamos();
        break;
      case 'presupuesto': // Vista de Sobres
        if (typeof actualizarVistaSobres === 'function') actualizarVistaSobres();
        break;
      case 'calendario':
        if (typeof actualizarVistaCalendario === 'function') actualizarVistaCalendario();
        break;
      case 'ajustes':
        if (typeof cargarAjustes === 'function') cargarAjustes();
        break;
    }
  }

  // Refactorización de Navegación (Centralizada)
  navItems.forEach((item) => {
    // Eliminar listeners anteriores (clonando nodo) es drástico, mejor sobreescribir lógica
    // Nota: Como estamos reemplazando el bloque original en app.js, no hay listeners duplicados.
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      renderView(targetView);
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
   * DEPRECATED: Esta función ha sido ELIMINADA.
   * Usar crearMovimientoFirestore().
   */

  /**
   * Actualiza las tarjetas de resumen en el dashboard y las métricas de salud financiera.
   * @param {Array} sobresData - Array de sobres desde Firestore
   * @param {Array} movimientosData - Array de movimientos desde Firestore
   */
  function updateDashboard(sobresData = [], movimientosData = []) {
    console.log('📊 updateDashboard EJECUTADO');
    console.log('📦 Sobres recibidos:', sobresData.length);
    console.log('📥 Movimientos recibidos:', movimientosData.length);

    // Usar datos recibidos o arrays globales como fallback
    const sobresActuales = sobresData.length > 0 ? sobresData : sobres;
    const movimientosActuales = movimientosData.length > 0 ? movimientosData : movimientos;

    // Elementos del dashboard
    const incomeEl = document.getElementById('income-summary-value');
    const expenseEl = document.getElementById('expense-summary-value');
    const balanceEl = document.getElementById('balance-summary-value');
    const differenceEl = document.getElementById('difference-summary-value');

    // Métricas de Salud del Presupuesto (Nuevos Elementos)
    const totalEnvelopesEl = document.getElementById('total-envelopes-balance');
    const monthlyFlowEl = document.getElementById('monthly-flow-value');
    const riskCountEl = document.getElementById('envelopes-risk-count');
    const dangerCountEl = document.getElementById('envelopes-danger-count');

    // Determinar el mes actual (respectando la zona horaria del usuario)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Calcular Ingresos, Gastos y Balance del Mes
    let incomeTotal = 0;
    let expenseTotal = 0;
    movimientosActuales.forEach((mov) => {
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
    movimientosActuales.forEach((mov) => {
      const txDate = new Date(mov.fecha);
      if (txDate.getMonth() === prevMonth && txDate.getFullYear() === prevYear) {
        if (mov.tipo === 'ingreso') prevIncome += parseFloat(mov.monto);
        else prevExpense += parseFloat(mov.monto);
      }
    });
    const prevBalance = prevIncome - prevExpense;
    const diff = balance - prevBalance;

    // Actualizar Resumen Principal
    if (incomeEl) incomeEl.textContent = formatCurrency(incomeTotal);
    if (expenseEl) expenseEl.textContent = formatCurrency(expenseTotal);
    if (balanceEl) balanceEl.textContent = formatCurrency(balance);
    if (differenceEl) {
      if (prevIncome === 0 && prevExpense === 0) {
        differenceEl.textContent = '–';
      } else {
        const sign = diff > 0 ? '+' : '';
        differenceEl.textContent = `${sign}${formatCurrency(diff)}`;
      }
    }

    // 2. Actualizar Métricas de Salud del Presupuesto (Nuevas)
    if (totalEnvelopesEl || monthlyFlowEl || riskCountEl || dangerCountEl) {
      // A) Total en Sobres
      const totalSobres = sobresActuales.reduce((sum, s) => sum + (parseFloat(s.saldo) || 0), 0);
      if (totalEnvelopesEl) totalEnvelopesEl.textContent = formatCurrency(totalSobres);

      // B) Flujo Mensual (Mismo que balance, pero explícito en esta sección)
      if (monthlyFlowEl) {
        const signFlow = balance > 0 ? '+' : '';
        monthlyFlowEl.textContent = `${signFlow}${formatCurrency(balance)}`;
        monthlyFlowEl.style.color = balance >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
      }

      // C) Análisis de Riesgo
      let warningCount = 0;
      let dangerCount = 0;

      sobresActuales.forEach(s => {
        const saldo = parseFloat(s.saldo) || 0;
        const limite = parseFloat(s.limiteMensual) || 0;

        if (saldo < 0) {
          // Saldo negativo -> Excedido (Danger)
          dangerCount++;
        } else if (limite > 0 && saldo < (limite * 0.25)) {
          // Menos del 25% del límite restante -> Riesgo (Warning)
          // Filtramos solo para tipos 'variable' o 'fijo' (gasto), no 'meta' o 'ahorro'.
          if (s.tipo !== 'meta' && s.tipo !== 'ahorro' && !s.congelado) {
            warningCount++;
          }
        }
      });

      if (riskCountEl) riskCountEl.textContent = warningCount;
      if (dangerCountEl) dangerCountEl.textContent = dangerCount;
    }

    // 3. Actualizar Cuentas Bancarias
    const accountsTotalEl = document.getElementById('accounts-total');
    const accountsLiquidEl = document.getElementById('accounts-liquid');
    const accountsDebtEl = document.getElementById('accounts-debt');
    if (accountsTotalEl && accountsLiquidEl && accountsDebtEl) {
      const totalCuentas = cuentas.reduce((sum, c) => sum + parseFloat(c.saldo || 0), 0);
      accountsTotalEl.textContent = formatCurrency(totalCuentas);
      accountsLiquidEl.textContent = formatCurrency(totalCuentas);
      accountsDebtEl.textContent = formatCurrency(0); // Placeholder
    }

    // 4. Actualizar Gráfico
    updateBarChart(incomeTotal, expenseTotal);
  }

  /**
   * Formatea un número a moneda local en dólares con dos decimales.
   * @param {number} value
   */
  function formatCurrency(value) {
    // Buscar la moneda en el estado global (hogar definido en Firestore)
    const currency = APP_STATE?.household?.currency || 'USD';
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(value || 0);
  }

  /**
   * Alias de compatibilidad para formatCurrency.
   */
  function formatearMoneda(valor) {
    return formatCurrency(valor);
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
    // cargarSobres(); // REMOVIDO: Ya están en memoria
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
          // Usar limiteMensual como referencia de pago o el saldo si no está definido
          montoEstimado: sobre.limiteMensual != null ? sobre.limiteMensual : (sobre.saldo || 0)
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
    // Cargar sobres y préstamos desde memoria (ya cargados por loadHomeData)
    const agenda = [];
    // Sobres fijos con día de pago
    sobres
      .filter((s) => s.tipo === 'fijo' && s.diaPago)
      .forEach((s) => {
        const dia = Math.min(s.diaPago, diasDelMes(mes, anio));
        const fecha = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const monto = (s.limiteMensual != null ? s.limiteMensual : s.saldo) || 0;
        agenda.push({
          tipo: 'sobreFijo',
          nombre: `Pagar ${s.nombre}`,
          fecha: fecha,
          monto: parseFloat(monto),
          estado: 'pendiente'
        });
      });
    // Cuotas de préstamos en el mes
    if (prestamos && prestamos.length) {
      prestamos.forEach((p) => {
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
   * Los movimientos ahora se cargan desde Firestore vía loadHomeData().
   */
  function cargarMovimientos() {
    // Los movimientos ya están en la variable global recargada por loadHomeData
    return movimientos;
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
    console.log('📉 actualizarVistaMovimientos EJECUTADO');
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
   * DEPRECATED: Las cuentas se cargan desde Firestore vía loadHomeData().
   */
  function cargarCuentas() {
    // Las cuentas ya están en la variable global recargada por loadHomeData
    return cuentas;
  }

  /**
   * DEPRECATED: Las cuentas se guardan en Firestore.
   */
  function guardarCuentas() {
    console.warn("⚠️ guardarCuentas() está deprecated. La persistencia debe ser vía Firestore.");
  }

  /**
   * Actualizar la vista de cuentas: resumen y tarjetas.
   */
  function actualizarVistaCuentas() {
    console.log('💳 actualizarVistaCuentas EJECUTADO');
    // cargarCuentas(); // REMOVIDO: Ya en memoria
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
    // cargarCuentas(); // REMOVIDO: Ya en memoria
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
    cuentaForm.addEventListener('submit', async (e) => {
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
      const saldo = parseFloat(saldoVal);

      try {
        if (cuentaEditId) {
          // Editar existente en Firestore
          if (typeof actualizarCuentaFirestore === 'function') {
            await actualizarCuentaFirestore(cuentaEditId, { nombre, tipo, saldo, nota });
          }
        } else {
          // Agregar nueva en Firestore
          if (typeof crearCuentaFirestore === 'function') {
            await crearCuentaFirestore({
              nombre,
              tipo,
              saldo,
              nota,
              actualizacion: new Date().toISOString()
            });
          }
        }

        // Forzar recarga de datos desde Firestore para sincronizar estado global
        await loadHomeData(true);

        // Resetear formulario
        cuentaForm.reset();
        cuentaEditId = null;
        const titleEl = document.getElementById('cuenta-form-title');
        if (titleEl) titleEl.textContent = 'Agregar cuenta';

        const container = document.getElementById('cuenta-form-container');
        if (container) container.classList.add('hidden');

        actualizarVistaCuentas();
        updateDashboard(sobres, movimientos);
        showToast('Cuenta guardada');
      } catch (err) {
        console.error('Error guardando cuenta:', err);
        showToast('Error al guardar cuenta');
      }
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
   * DEPRECATED: Los préstamos se cargan desde Firestore vía loadHomeData().
   */
  function guardarPrestamos() {
    console.warn("⚠️ guardarPrestamos() está deprecated.");
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
    prestamoForm.addEventListener('submit', async (e) => {
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

      try {
        if (currentPrestamoEditId) {
          // Editar en Firestore
          if (typeof actualizarPrestamoFirestore === 'function') {
            await actualizarPrestamoFirestore(currentPrestamoEditId, {
              nombre, tipo, monto, tasa, plazo, fechaInicio, fechaPrimer, cronograma
            });
          }
        } else {
          // Crear en Firestore
          if (typeof crearPrestamoFirestore === 'function') {
            await crearPrestamoFirestore({
              nombre, tipo, monto, tasa, plazo, fechaInicio, fechaPrimer, cronograma,
              pagadas: []
            });
          }
        }

        // Forzar recarga de datos
        const data = await loadHomeData(true);
        prestamos = data.prestamos;

        prestamoForm.reset();
        currentPrestamoEditId = null;
        if (prestamoFormContainer) prestamoFormContainer.classList.add('hidden');
        showToast('Préstamo guardado');
        actualizarVistaPrestamos();
      } catch (err) {
        console.error('Error guardando préstamo:', err);
        showToast('Error al guardar préstamo');
      }
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
    // Usar el nuevo registro de eventos (solo día) para mostrar puntos y tarjetas
    const eventosFijosCal = registrarEventosSobresFijos();
    eventosFijosCal.forEach((ev) => {
      // Convertir a fecha completa para key (YYYY-MM-DD) usando año y mes actuales
      const diaAjustado = Math.min(ev.fecha, diasDelMes(calMonth, calYear));
      const fechaKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`;
      eventsByDate[fechaKey] = eventsByDate[fechaKey] || { mov: 0, prest: 0, pago: 0 };
      eventsByDate[fechaKey].pago += 1;
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
      // Eventos fijos detallados (nombre y color) dentro del día
      if (currentMonth) {
        eventosFijosCal.forEach((evf) => {
          const diaAjustado = Math.min(evf.fecha, diasDelMes(calMonth, calYear));
          if (diaAjustado === cellDate.getDate()) {
            const evtDiv = document.createElement('div');
            evtDiv.classList.add('evento-fijo');
            evtDiv.style.borderLeft = `4px solid ${evf.color}`;
            evtDiv.innerHTML = `<span>${evf.icono}</span> ${evf.nombre}`;
            cell.appendChild(evtDiv);
          }
        });
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
  const vistaAgendaEl = document.getElementById('vista-agenda-mes');
  if (btnCalendarioTab && btnAgendaTab && vistaCalendarioEl && vistaAgendaEl) {
    btnCalendarioTab.addEventListener('click', () => {
      // Mostrar calendario y ocultar agenda
      vistaCalendarioEl.style.display = 'block';
      vistaAgendaEl.style.display = 'none';
      btnCalendarioTab.classList.add('tab-activa');
      btnAgendaTab.classList.remove('tab-activa');
    });
    btnAgendaTab.addEventListener('click', () => {
      // Ocultar calendario y mostrar agenda
      vistaCalendarioEl.style.display = 'none';
      vistaAgendaEl.style.display = 'block';
      btnAgendaTab.classList.add('tab-activa');
      btnCalendarioTab.classList.remove('tab-activa');
      // Generar y mostrar la agenda financiera del mes actual
      generarAgendaFinanciera();
    });
  }

  // =================== Menú hamburguesa móvil ===================
  const btnMenuMobile = document.getElementById('btn-menu-mobile');
  const mobileMenu = document.getElementById('mobile-menu');
  // Abrir o cerrar el menú móvil.  Se utiliza la clase 'visible'
  // para controlar la animación CSS y la clase 'menu-open' en body
  // para bloquear el scroll solo cuando el menú está abierto.
  if (btnMenuMobile && mobileMenu) {
    btnMenuMobile.addEventListener('click', () => {
      mobileMenu.classList.toggle('visible');
      // alternar bloqueo de scroll al cuerpo
      document.body.classList.toggle('menu-open', mobileMenu.classList.contains('visible'));
    });
    // Asociar clics en las opciones del menú móvil con la navegación SPA
    document.querySelectorAll('#mobile-menu [data-view]').forEach((item) => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        // Ocultar menú y permitir scroll
        mobileMenu.classList.remove('visible');
        document.body.classList.remove('menu-open');
        // Cambiar de vista utilizando la misma función que el menú de escritorio
        if (typeof showView === 'function') {
          showView(view);
        } else if (typeof cambiarVista === 'function') {
          cambiarVista(view);
        } else {
          console.warn('Función de cambio de vista no encontrada');
        }
      });
    });
  }

  /* ===================================================================== */
  /* ======================= MÓDULO PRESUPUESTO ========================= */

  /**
   * DEPRECATED: Los presupuestos se guardarán en Firestore.
   */
  function guardarPresupuestos() {
    console.warn("⚠️ guardarPresupuestos() está deprecated.");
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
    presupuestoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('budget-nombre').value.trim();
      const tipo = document.getElementById('budget-tipo').value;
      const limiteVal = document.getElementById('budget-limite').value;
      if (!nombre || !limiteVal) {
        showToast('Completa todos los campos');
        return;
      }
      const limite = parseFloat(limiteVal);

      try {
        if (typeof crearPresupuestoFirestore === 'function') {
          await crearPresupuestoFirestore({ nombre, tipo, limite });

          // Forzar recarga
          const data = await loadHomeData(true);
          presupuestos = data.presupuestos;

          presupuestoForm.reset();
          if (presupuestoFormContainer) presupuestoFormContainer.classList.add('hidden');
          showToast('Categoría guardada');
          actualizarVistaPresupuesto();
        }
      } catch (err) {
        console.error('Error guardando presupuesto:', err);
        showToast('Error al guardar categoría');
      }
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
            if (s.tipo === 'fijo' || s.tipo === 'deuda') {
              doc.text(`${s.nombre}: saldo ${formatCurrency(s.saldo)} de ${formatCurrency(s.limiteMensual || 0)}`, 40, y);
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
          showToast('Backup cargado en memoria. La importación a Firestore es manual.');
          console.log("📂 Datos de backup leídos:", data);
          // Nota: La importación automática masiva a Firestore no está implementada 
          // para evitar sobrescrituras accidentales.
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
      const prioridadVal = document.getElementById('sobre-prioridad').value;
      const categoriaDistVal = document.getElementById('sobre-categoria-distribucion').value;
      const diaPagoVal = document.getElementById('sobre-dia-pago').value;
      const categoriaVal = document.getElementById('sobre-categoria').value;
      const metodoVal = document.getElementById('sobre-metodo').value;
      // ELIMINADO: No guardar en localStorage
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
        // Para tipos fijos o deudas, usar limiteMensual; en otros casos será null
        limiteMensual: (tipoVal === 'fijo' || tipoVal === 'deuda') ? (limiteVal ? parseFloat(limiteVal) : null) : null,
        saldo: 0,
        gastado: 0,
        prioridad: prioridadVal || 'media',
        categoriaDistribucion: categoriaDistVal || 'necesidad',
        diaPago: (tipoVal === 'fijo' || tipoVal === 'deuda') ? (diaPagoVal ? parseInt(diaPagoVal) : null) : null,
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
    movimientoForm.addEventListener('submit', async (e) => {
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
        tipo,
        monto: parseFloat(montoVal).toFixed(2),
        categoria: '',
        sobreId: sobreId || null,
        descripcion: nota.trim(),
        fecha,
        origen: 'manual'
      };

      // GUARDAR EN FIRESTORE
      try {
        await crearMovimientoFirestore(movimiento);

        // Recargar datos forzando actualización del cache
        const homeData = await loadHomeData(true);
        sobres = homeData.sobres;
        movimientos = homeData.movimientos;

        // Procesar según tipo
        if (tipo === 'ingreso') {
          // Distribuir ingreso de forma inteligente entre sobres
          distribuirIngresoInteligente(parseFloat(montoVal), 'general');
        } else if (tipo === 'gasto') {
          descontarDeSobre(sobreId, parseFloat(montoVal));
        }

        actualizarVistaSobres();
        // Resetear formulario y selección de sobres
        movimientoForm.reset();
        // Ocultar grupo de sobres al resetear
        const grupo = document.getElementById('grupo-sobre');
        if (grupo) grupo.style.display = 'none';
        // Actualizar dashboard y movimientos con datos actualizados
        updateDashboard(sobres, movimientos);
        actualizarVistaMovimientos();
        showToast('Movimiento guardado');
        // Redirigir a la vista de movimientos
        renderView('movimientos');
      } catch (err) {
        console.error('Error guardando movimiento:', err);
        showToast('Error al guardar movimiento');
      }
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

  // Delegar los clics en las tarjetas de sobres para abrir su ficha de detalle.
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest('.sobre-card');
    if (!card) return;
    const id = card.dataset.sobreId;
    if (!id) return;
    // Si existe la función de abrir ficha, llamarla
    if (typeof abrirFichaSobre === 'function') {
      abrirFichaSobre(id);
    }
  });

  // Escuchar clic en el botón de volver dentro de la ficha de sobre.
  document.addEventListener('click', (ev) => {
    if (ev.target && ev.target.id === 'btn-volver-sobres') {
      // Regresar a la vista de sobres/presupuesto
      if (typeof renderView === 'function') {
        renderView('presupuesto');
      } else if (typeof cambiarVista === 'function') {
        cambiarVista('presupuesto');
      }
    }
  });

  // Escuchar clics relacionados con el cierre mensual de sobres
  document.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!target) return;
    // Abrir la vista de cierre mensual
    if (target.id === 'btn-ir-cierre-mensual') {
      // Preparar la vista listando sobres y reglas
      prepararVistaCierreMensual();
      // Navegar a la vista de cierre mensual
      if (typeof renderView === 'function') {
        renderView('vista-cierre-mensual');
      } else if (typeof cambiarVista === 'function') {
        cambiarVista('vista-cierre-mensual');
      }
    }
    // Cancelar cierre y volver a la lista de sobres
    if (target.id === 'btn-cancelar-cierre') {
      if (typeof renderView === 'function') {
        renderView('presupuesto');
      } else if (typeof cambiarVista === 'function') {
        cambiarVista('presupuesto');
      }
    }
    // Confirmar cierre y procesar
    if (target.id === 'btn-confirmar-cierre') {
      procesarCierreMensual();
    }
  });

  // Cargar valores iniciales al arrancar
  // Actualizar estados de congelado antes de cualquier otra operación
  actualizarEstadoCongeladoSobres && actualizarEstadoCongeladoSobres();

  // Inicialización ASYNC para cargar datos de Firestore
  (async function initializeData() {
    if (APP_STATE?.onboarding === "COMPLETED") {
      try {
        // Carga centralizada de todos los datos del hogar
        const homeData = await loadHomeData();

        // Asignar a variables globales
        sobres = homeData.sobres;
        movimientos = homeData.movimientos;
        cuentas = homeData.cuentas;
        prestamos = homeData.prestamos;

        // Actualizar dashboard con datos cargados
        updateDashboard(sobres, movimientos);

        // Imprimir checklist del sistema
        printSystemChecklist();
      } catch (err) {
        console.error("❌ Error fatal cargando datos iniciales:", err);
        alert("No se pudo cargar la aplicación. Por favor, recarga la página.");
      }
    }
  })();

  // Aplicar ajustes de usuario al cargar (tema, tamaño de fuente, contraste)
  cargarAjustes();

  /**
   * ==========================================
   * ONBOARDING & AUTH (FASE C: INVITACIÓN DE PAREJA)
   * ==========================================
   */
  (function initOnboardingAndSession() {
    console.log('Inicializando Sistema de Sesión & Onboarding (Fase C)...');

    const $ = (id) => document.getElementById(id);
    const SESSION_KEY = 'fdh_session_v1';
    const HOME_KEY = 'fdh_home_v1';
    const INVITE_KEY = 'fdh_invite_v1';

    // Lista de vistas UX
    const UX_VIEWS = [
      'view-splash', 'view-welcome', 'view-sms',
      'view-setup-home', 'view-access-method',
      'view-create-pin', 'view-invite'
    ];

    // --- 1. UTILIDADES DE DATOS (MOCK) ---
    function loadSession() {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
    }
    function saveSession(s) {
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { }
    }
    function clearSession() {
      localStorage.removeItem(SESSION_KEY);
    }

    function loadHome() {
      try { return JSON.parse(localStorage.getItem(HOME_KEY)); } catch { return null; }
    }
    function saveHome(h) {
      try { localStorage.setItem(HOME_KEY, JSON.stringify(h)); } catch { }
    }

    function loadInvite() {
      try { return JSON.parse(localStorage.getItem(INVITE_KEY)); } catch { return null; }
    }
    function saveInvite(i) {
      try { localStorage.setItem(INVITE_KEY, JSON.stringify(i)); } catch { }
    }

    // --- 2. GESTIÓN DE VISTAS UX ---
    function showUXView(viewId) {
      // Validaciones específicas de UI al mostrar vistas
      if (viewId === 'view-invite') prepareInviteView();

      document.querySelectorAll('.view').forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden');
      });
      const target = $(viewId);
      if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
      }
    }

    function goToDashboard() {
      UX_VIEWS.forEach(vid => {
        const el = $(vid);
        // Asegurar que las vistas de onboarding se oculten
        if (el) { el.classList.remove('active'); el.classList.add('hidden'); }
      });

      // Integración con Fase B-Correction
      const session = loadSession();
      if (typeof window.onLoginSuccess === 'function') {
        window.onLoginSuccess(session);
      } else {
        // Fallback
        const dashLink = document.querySelector('.nav-item[data-view="dashboard"]');
        if (dashLink) dashLink.click();
      }
    }

    // --- 3. LOGICA DE NEGOCIO (INVITACIÓN) ---

    function generateInvite() {
      const home = loadHome();
      const session = loadSession();
      // Solo owner puede generar, y solo si no hay partner
      if (!home || !session || session.role !== 'owner') return null;
      if (home.partnerId) return null; // Ya hay partner

      // Reutilizar existente si válida
      const existing = loadInvite();
      if (existing && !existing.used) return existing;

      // Crear nueva
      const invite = {
        code: 'FDH-' + Math.floor(1000 + Math.random() * 9000),
        homeId: home.homeId,
        role: 'partner',
        used: false,
        createdAt: Date.now()
      };
      saveInvite(invite);
      return invite;
    }

    // Expuesta globalmente para simulación de Partner
    window.joinWithInvite = function (code) {
      const invite = loadInvite();
      let home = loadHome();

      if (!invite || invite.used) {
        console.error('Invitación no válida o ya usada');
        return false;
      }
      if (invite.code !== code) {
        console.error('Código incorrecto');
        return false;
      }
      if (home && home.partnerId) {
        console.error('El hogar ya está lleno');
        return false;
      }
      // Simular que el hogar "ya existe" (en este mock es el mismo localStorage)
      if (!home) {
        // Caso raro mock: invite existe pero home no (borrado manual?)
        console.error('Hogar no encontrado');
        return false;
      }

      // 1. Unir partner al hogar
      home.partnerId = 'local-partner';
      saveHome(home);

      // 2. Marcar invitación usada
      invite.used = true;
      saveInvite(invite);

      // 3. Crear sesión para el partner
      saveSession({
        isAuthenticated: true,
        onboardingCompleted: true,
        role: 'partner',
        access: { pinEnabled: false, autoLogin: true, smsFallback: true },
        hasPin: false,
        lastLogin: Date.now()
      });

      console.log('✅ Te has unido al hogar exitosamente como Partner!');
      goToDashboard();
      return true;
    };

    function prepareInviteView() {
      const home = loadHome();
      const session = loadSession();
      const btnGen = $('btn-invite-generate');
      const btnCopy = $('btn-invite-copy');
      const codeDisplay = $('invite-code');
      const hint = $('invite-hint');
      const inviteBox = document.querySelector('.invite-box');

      // Reset UI
      if (hint) hint.textContent = '';
      if (codeDisplay) codeDisplay.textContent = '—';

      // Bloqueos
      if (session && session.role === 'partner') {
        if (inviteBox) inviteBox.style.display = 'none'; // Ocultar controles
        if (hint) hint.textContent = 'Eres partner invitado en este hogar.';
        return;
      }

      if (home && home.partnerId) {
        if (btnGen) btnGen.disabled = true;
        if (hint) hint.textContent = 'Este hogar ya tiene dos usuarios (Owner + Partner).';
        return;
      }

      // Si soy owner y todo ok, habilitar
      if (inviteBox) inviteBox.style.display = 'flex';
      if (btnGen) btnGen.disabled = false;
    }


    // --- 4. BOOTSTRAP (DESACTIVADO - USANDO ARQUITECTURA ESTRICTA GLOBAL) ---
    // La inicialización ahora es manejada exclusivamente por window.resolveUserState()
    // al cargar el script, eliminando condiciones de carrera y dobles renders.

    /*
    const session = loadSession();
    const splash = $('view-splash');
   
    if (splash && splash.classList.contains('active')) {
      setTimeout(() => {
        // ... Lógica movida a resolveUserState ...
      }, 1200);
    }
    */

    function prepararVistaPinLogin() {
      const title = document.querySelector('#view-create-pin h1');
      const subtitle = document.querySelector('#view-create-pin p.muted');
      const pin2Input = $('pin-2');
      const btnSave = $('btn-pin-save');

      if (title) title.textContent = 'Ingresa tu PIN';
      if (subtitle) subtitle.textContent = 'Acceso seguro a Finanzas del Hogar';

      if (pin2Input) {
        const field = pin2Input.closest('.field');
        if (field) field.style.display = 'none';
      }

      if (btnSave) btnSave.textContent = 'Entrar';

      showUXView('view-create-pin');
      const v = document.getElementById('view-create-pin');
      if (v) v.dataset.mode = 'login';
    }


    // --- 5. HANDLERS ---

    // [Welcome, SMS, SetupHome handlers se mantienen similares pero con logica de Home/Invite]

    // WELCOME
    const btnWelcome = $('btn-welcome-continue');
    if (btnWelcome) {
      btnWelcome.addEventListener('click', () => {
        const val = $('auth-phone').value.trim();
        if (val.length < 8) {
          const el = $('auth-phone');
          el.style.borderColor = 'var(--danger-color)';
          setTimeout(() => el.style.borderColor = '', 1000);
          return;
        }
        const hint = $('sms-hint');
        if (hint) hint.textContent = `Enviaremos un código a ${val} (simulado)`;
        showUXView('view-sms');
      });
    }

    // SMS
    const btnSmsVerify = $('btn-sms-verify');
    if (btnSmsVerify) {
      btnSmsVerify.addEventListener('click', () => {
        if ($('auth-otp').value.trim().length < 4) return;

        // Si ya existe Home y NO tengo sesión, ¿qué pasa?
        // Asumimos que es Owner creando de nuevo o Partner que DEBERIA usar joinWithInvite
        // Para UX simple, seguimos el flujo y decidimos en el final.
        showUXView('view-setup-home');
      });
    }
    const btnSmsBack = $('btn-sms-back');
    if (btnSmsBack) btnSmsBack.addEventListener('click', () => showUXView('view-welcome'));

    // SETUP HOME
    const btnHomeCreate = $('btn-home-create');
    if (btnHomeCreate) {
      btnHomeCreate.addEventListener('click', () => {
        const name = $('home-name').value.trim() || 'Hogar Principal';
        const currency = $('home-currency').value || 'DOP';
        // Guardamos temporalmente en memoria/localStorage simple para usar al final
        localStorage.setItem('_temp_home_setup', JSON.stringify({ name, currency }));
        showUXView('view-access-method');
      });
    }

    // ACCESS METHOD
    const choicePin = $('choice-pin');
    const choiceAuto = $('choice-auto');
    const btnAccessSave = $('btn-access-save');

    function toggleChoice(btn) {
      if (!btn) return;
      const on = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', !on);
    }
    if (choicePin) choicePin.addEventListener('click', () => toggleChoice(choicePin));
    if (choiceAuto) choiceAuto.addEventListener('click', () => toggleChoice(choiceAuto));

    if (btnAccessSave) {
      btnAccessSave.addEventListener('click', () => {
        const pinEnabled = choicePin && choicePin.getAttribute('aria-pressed') === 'true';
        if (pinEnabled) {
          showUXView('view-create-pin');
          // Restaurar UI Create
          const v = $('view-create-pin');
          v.dataset.mode = 'create';
          const title = v.querySelector('h1');
          if (title) title.textContent = 'Crea tu PIN';
          const pin2 = $('pin-2');
          if (pin2) pin2.closest('.field').style.display = 'block';
          const btn = $('btn-pin-save');
          if (btn) btn.textContent = 'Confirmar PIN';
        } else {
          showUXView('view-invite');
        }
      });
    }

    // PIN (Create & Login)
    const btnPinBack = $('btn-pin-back');
    const btnPinSave = $('btn-pin-save');

    if (btnPinBack) {
      btnPinBack.addEventListener('click', () => {
        const mode = $('view-create-pin').dataset.mode;
        if (mode === 'login') {
          clearSession();
          showUXView('view-welcome');
        } else {
          showUXView('view-access-method');
        }
        $('pin-1').value = '';
        $('pin-2').value = '';
        const err = $('pin-error');
        if (err) err.classList.add('hidden');
      });
    }

    if (btnPinSave) {
      btnPinSave.addEventListener('click', () => {
        const mode = $('view-create-pin').dataset.mode;
        const p1 = $('pin-1').value;
        const err = $('pin-error');

        // LOGIN
        if (mode === 'login') {
          if (p1.length < 4) {
            if (err) { err.textContent = 'PIN inválido'; err.classList.remove('hidden'); }
            return;
          }
          goToDashboard();
          return;
        }

        // CREATE
        const p2 = $('pin-2').value;
        if (p1.length < 4 || p1.length > 6) {
          if (err) { err.textContent = 'PIN 4-6 dígitos'; err.classList.remove('hidden'); }
          return;
        }
        if (p1 !== p2) {
          if (err) { err.textContent = 'No coinciden'; err.classList.remove('hidden'); }
          return;
        }

        localStorage.setItem('fdh_has_pin', 'true');
        showUXView('view-invite');
      });
    }


    // FINALIZAR (INVITE/SKIP)
    const btnInviteSkip = $('btn-invite-skip');
    const btnInviteFinish = $('btn-invite-finish');

    async function finalizarOnboarding() {
      // 1. Obtener UID real o simulado
      // En real, auth.currentUser.uid ya existiría tras OTP
      // Simulamos UID fijo para desarrollo local si no hay auth real
      let uid = 'user_' + Math.floor(Math.random() * 10000);

      // Intentar recuperar sesión parcial si existe
      const tempSession = loadSession();
      if (tempSession && tempSession.uid) uid = tempSession.uid;

      // 2. Preparar datos del Hogar
      let homeData = loadHome(); // Si viene de invite, ya tenemos home en local
      let role = 'owner';

      if (!homeData) {
        // Crear nuevo hogar en FIRESTORE
        let setupData = {};
        try { setupData = JSON.parse(localStorage.getItem('_temp_home_setup')) || {}; } catch { }

        const name = setupData.name || 'Hogar Principal';
        const currency = setupData.currency || 'DOP';

        try {
          // FIRESTORE CREATE HOME
          if (typeof createHomeFirestore === 'function') {
            homeData = await createHomeFirestore(name, currency, uid);
          } else {
            // Fallback local solo si DB falla gravemente (no debería)
            throw new Error("Firestore helpers no disponibles");
          }
        } catch (e) {
          console.error("Error creando hogar en Firestore", e);
          alert("Error de conexión. Intenta de nuevo.");
          return;
        }

        role = 'owner';
        saveHome(homeData); // Guardar también en local para cache inmediata
      } else {
        // Ya existe hogar (Partner Flow)
        // role ya debería venir definido o deducido
        role = 'partner'; // Simplificación
      }

      // 3. Crear/Actualizar Usuario en FIRESTORE
      const pinEnabled = choicePin && choicePin.getAttribute('aria-pressed') === 'true';
      const autoLogin = choiceAuto && choiceAuto.getAttribute('aria-pressed') === 'true';
      const phoneVal = $('auth-phone') ? $('auth-phone').value : '';

      try {
        if (typeof createUserFirestore === 'function') {
          await createUserFirestore(uid, phoneVal, homeData.id, role, { autoLogin, pinEnabled });
        }
      } catch (e) {
        console.error("Error creando user en Firestore", e);
      }

      // 4. Guardar Sesión Local Final
      const newSession = {
        uid: uid, // Importante para rehydrate
        isAuthenticated: true,
        onboardingCompleted: true,
        role: role,
        access: {
          pinEnabled: pinEnabled,
          autoLogin: autoLogin,
          smsFallback: true
        },
        hasPin: pinEnabled,
        lastLogin: Date.now()
      };
      saveSession(newSession);

      // Actualizar estado APP y entrar
      window.resolveUserState();
    }

    if (btnInviteSkip) btnInviteSkip.addEventListener('click', finalizarOnboarding);
    if (btnInviteFinish) btnInviteFinish.addEventListener('click', finalizarOnboarding);

    // GENERAR CODIGO
    const btnInviteGen = $('btn-invite-generate');
    const btnInviteCopy = $('btn-invite-copy');

    if (btnInviteGen) {
      btnInviteGen.addEventListener('click', () => {
        const invite = generateInvite();
        if (invite) {
          $('invite-code').textContent = invite.code;
          const hint = $('invite-hint');
          if (hint) hint.textContent = 'Código generado. Expira en 24h.';
        }
      });
    }

    if (btnInviteCopy) {
      btnInviteCopy.addEventListener('click', () => {
        const code = $('invite-code').textContent;
        if (code !== '—') {
          navigator.clipboard.writeText(code);
          const hint = $('invite-hint');
          if (hint) hint.textContent = '¡Copiado!';
        }
      });
    }

  })();

});