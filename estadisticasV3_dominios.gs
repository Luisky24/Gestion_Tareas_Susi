/**
 * Estadísticas V3 - Dominios
 * Lógica de negocio (funciones puras, sin SpreadsheetApp).
 *
 * Incluye:
 * - resumen
 * - evolución
 * - validación
 * - reglas de negocio
 */

// =====================
// Reglas de negocio (puro)
// =====================

/**
 * Indica si el estado representa una tarea hecha/cerrada/finalizada.
 * @param {any} estado
 * @returns {boolean}
 */
function tec_esTareaHecha(estado) {
  return tec_tipoEstado(estado) === "HECHO";
}

/**
 * Indica si el estado representa una tarea abierta.
 * @param {any} estado
 * @returns {boolean}
 */
function tec_esTareaAbierta(estado) {
  return tec_tipoEstado(estado) === "ABIERTO";
}

// =====================
// Validación (puro)
// =====================

/**
 * Valida tareas normalizadas.
 *
 * Detecta:
 * - fechas inválidas (fechaAlta ausente; fechaFinReal inválida ya viene como null)
 * - fechaFin < fechaAlta
 * - estado vacío
 * - prioridad no numérica (prioridad === null)
 *
 * @param {ReturnType<typeof tec_normalizarTareas>} tareas
 * @returns {{tareasValidas: any[], errores: {fuente:string, fila:number, mensaje:string}[]}}
 */
function tec_validarTareas(tareas) {
  const tareasEntrada = Array.isArray(tareas) ? tareas : [];
  const errores = [];
  const tareasValidas = [];

  for (const tarea of tareasEntrada) {
    const fuente = tarea && tarea.fuente ? String(tarea.fuente) : "";
    const fila = tarea && typeof tarea.fila === "number" ? tarea.fila : -1;

    const addError = (mensaje) => {
      errores.push({ fuente, fila, mensaje });
    };

    let ok = true;

    if (!tarea || !tarea.fechaAlta || !(tarea.fechaAlta instanceof Date) || isNaN(tarea.fechaAlta.getTime())) {
      addError("Fecha alta inválida o ausente");
      ok = false;
    }

    if (tarea && tarea.fechaFinReal) {
      if (!(tarea.fechaFinReal instanceof Date) || isNaN(tarea.fechaFinReal.getTime())) {
        addError("Fecha fin real inválida");
        ok = false;
      }
    }

    if (tarea && tarea.fechaAlta && tarea.fechaFinReal) {
      if (tarea.fechaFinReal.getTime() < tarea.fechaAlta.getTime()) {
        addError("Inconsistencia: fechaFinReal < fechaAlta");
        ok = false;
      }
    }

    const estado = tec_normalizarEstado(tarea && tarea.estado);
    if (!estado) {
      addError("Estado vacío");
      ok = false;
    }

    if (tarea && tarea.prioridad === null) {
      addError("Prioridad no numérica");
      ok = false;
    }

    if (ok) tareasValidas.push(tarea);
  }

  return { tareasValidas, errores };
}

// =====================
// Dominio Resumen Semanal (puro)
// =====================

/**
 * Genera una tabla 2D lista para escribir en una hoja.
 * @param {ReturnType<typeof tec_normalizarTareas>} tareas
 * @returns {any[][]}
 */
function dom_generarResumenSemanal(tareas) {
  const tareasEntrada = Array.isArray(tareas) ? tareas : [];

  const encabezado = [
    "Año",
    "Semana",
    "Estado",
    "Prioridad",
    "Número de Tareas",
    "Media Días desde Inicio",
    "Desviación Media en Días",
    "Tareas nuevas semana",
    "Total tareas no hechas",
    "Tipo Estado"
  ];

  const acumuladosHechas = new Map(); // clave -> {anio, semana, estado, prioridad, n, sumaDias, sumaDesv}
  const acumuladosNoHechas = new Map(); // clave -> {anio, semana, estado, prioridad, nuevas, total}

  for (const tarea of tareasEntrada) {
    // Estado = única fuente de verdad (no inferimos estado por fechas).
    const estadoNormalizado = tec_normalizarEstado(tarea && tarea.estado);
    const prioridad = (tarea && tarea.prioridad !== null && tarea.prioridad !== undefined) ? tarea.prioridad : "Sin Prioridad";

    const tipoEstado = tec_tipoEstado(tarea && tarea.estado);
    if (tipoEstado === "IGNORADO" || tipoEstado === "DESCONOCIDO") continue;

    if (tipoEstado === "HECHO") {
      // Hechas: semana por fecha fin real
      if (!tarea || !tarea.fechaAlta || !tarea.fechaFinReal || tarea.anioFin === null || tarea.semanaFin === null) continue;

      const clave = `${tarea.anioFin}|${tarea.semanaFin}|${estadoNormalizado}|${prioridad}`;
      if (!acumuladosHechas.has(clave)) {
        acumuladosHechas.set(clave, {
          anio: tarea.anioFin,
          semana: tarea.semanaFin,
          estado: estadoNormalizado,
          prioridad,
          tipoEstado,
          n: 0,
          sumaDias: 0,
          sumaDesv: 0
        });
      }

      const fechaFinEst = tarea.fechaFinEstimada || tarea.fechaFinReal;
      const dias = Math.round((tarea.fechaFinReal.getTime() - tarea.fechaAlta.getTime()) / 86400000);
      const desv = Math.round((tarea.fechaFinReal.getTime() - fechaFinEst.getTime()) / 86400000);

      const acumulador = acumuladosHechas.get(clave);
      acumulador.n += 1;
      acumulador.sumaDias += dias;
      acumulador.sumaDesv += desv;
    } else if (tipoEstado === "ABIERTO") {
      // No hechas: semana por fecha alta
      if (!tarea || !tarea.fechaAlta || tarea.anioAlta === null || tarea.semanaAlta === null) continue;

      const clave = `${tarea.anioAlta}|${tarea.semanaAlta}|${estadoNormalizado}|${prioridad}`;
      if (!acumuladosNoHechas.has(clave)) {
        acumuladosNoHechas.set(clave, {
          anio: tarea.anioAlta,
          semana: tarea.semanaAlta,
          estado: estadoNormalizado,
          prioridad,
          tipoEstado,
          nuevas: 0,
          total: 0
        });
      }

      const acumulador = acumuladosNoHechas.get(clave);
      acumulador.nuevas += 1;
      acumulador.total += 1;
    }
  }

  const filas = [];

  for (const acumulador of acumuladosHechas.values()) {
    filas.push([
      acumulador.anio,
      acumulador.semana,
      acumulador.estado,
      acumulador.prioridad,
      acumulador.n,
      acumulador.n ? Math.round(acumulador.sumaDias / acumulador.n) : 0,
      acumulador.n ? Math.round(acumulador.sumaDesv / acumulador.n) : 0,
      "",
      "",
      acumulador.tipoEstado
    ]);
  }

  for (const acumulador of acumuladosNoHechas.values()) {
    filas.push([
      acumulador.anio,
      acumulador.semana,
      acumulador.estado,
      acumulador.prioridad,
      "",
      "",
      "",
      acumulador.nuevas,
      acumulador.total,
      acumulador.tipoEstado
    ]);
  }

  // Ordenar por Año desc, Semana desc, Estado asc, Prioridad asc (estable y legible)
  filas.sort((a, b) => {
    if (a[0] !== b[0]) return b[0] - a[0];
    if (a[1] !== b[1]) return b[1] - a[1];
    if (a[2] !== b[2]) return String(a[2]).localeCompare(String(b[2]));
    return String(a[3]).localeCompare(String(b[3]));
  });

  return [encabezado, ...filas];
}

// =====================
// Dominio Evolución Semanal (puro)
// =====================

/**
 * Devuelve una tabla 2D lista para hoja "Estadisticas V3".
 * @param {ReturnType<typeof tec_normalizarTareas>} tareas
 * @returns {any[][]}
 */
function dom_generarEvolucionSemanal(tareas) {
  const tareasEntrada = Array.isArray(tareas) ? tareas : [];

  const encabezado = ["Año", "Semana", "Tareas Nuevas", "Tareas Abiertas", "Tareas Cerradas", "Total HECHO", "Total ABIERTO"];

  const mapaNuevas = new Map();   // "anio||semana" -> count
  const mapaCerradas = new Map(); // "anio||semana" -> count

  // Abiertas por semana (intervalos):
  // - Se cuenta solo si el estado es ABIERTO (el estado es la única fuente de verdad).
  // - Cada tarea abierta aporta +1 desde su semana de alta hasta la semana actual (inclusive).
  // - Implementación con deltas (+1 en inicio, -1 en fin+1) y suma prefija para evitar O(n*semanas).
  const deltasPorIndiceSemana = new Map(); // absIndex -> delta

  const sumarEnMapa = (mapaConteos, clave, delta) => {
    const v = mapaConteos.get(clave) || 0;
    mapaConteos.set(clave, v + delta);
  };

  // Semana actual (ISO) para acotar abiertas si siguen abiertas
  const anioSemanaActual = tec_obtenerAnioSemanaISO(new Date());
  const anioActual = anioSemanaActual.anio;
  const semanaActual = anioSemanaActual.semana;

  // Determinar rango de años a considerar (para offsets)
  let minAnio = anioActual;
  let maxAnio = anioActual;
  for (const tarea of tareasEntrada) {
    if (!tarea) continue;
    if (tarea.anioAlta !== null && tarea.anioAlta !== undefined) {
      if (tarea.anioAlta < minAnio) minAnio = tarea.anioAlta;
      if (tarea.anioAlta > maxAnio) maxAnio = tarea.anioAlta;
    }
    if (tarea.anioFin !== null && tarea.anioFin !== undefined) {
      if (tarea.anioFin < minAnio) minAnio = tarea.anioFin;
      if (tarea.anioFin > maxAnio) maxAnio = tarea.anioFin;
    }
  }

  const { offsetPorAnio, totalSemanas } = tec_construirOffsetsSemanas(minAnio, maxAnio);
  const toAbsSemana = (anio, semana) => {
    const off = offsetPorAnio.get(anio);
    if (off === undefined) return null;
    return off + (semana - 1);
  };

  const absSemanaActual = toAbsSemana(anioActual, semanaActual);
  const lookupAbsAAnioSemana = tec_construirLookupAbsAAnioSemana(minAnio, maxAnio, offsetPorAnio, totalSemanas);

  for (const tarea of tareasEntrada) {
    if (!tarea) continue;

    // Estado = única fuente de verdad (no inferimos estado por fechas).
    const tipoEstado = tec_tipoEstado(tarea.estado);
    if (tipoEstado === "IGNORADO" || tipoEstado === "DESCONOCIDO") continue;

    // Nuevas: por semana de alta
    if (tarea.anioAlta !== null && tarea.semanaAlta !== null) {
      const clave = `${tarea.anioAlta}||${tarea.semanaAlta}`;
      sumarEnMapa(mapaNuevas, clave, 1);
    }

    // Cerradas: por semana de fin real
    if (tipoEstado === "HECHO" && tarea.anioFin !== null && tarea.semanaFin !== null) {
      const clave = `${tarea.anioFin}||${tarea.semanaFin}`;
      sumarEnMapa(mapaCerradas, clave, 1);
    }

    // Abiertas por semana (intervalos):
    // Desde semana de alta hasta semana de fin (si existe) o semana actual (si sigue abierta).
    if (tipoEstado === "ABIERTO" && tarea.anioAlta !== null && tarea.semanaAlta !== null) {
      const inicioAbs = toAbsSemana(tarea.anioAlta, tarea.semanaAlta);
      if (inicioAbs === null) continue;

      const fin = absSemanaActual;
      if (fin === null) continue;

      // Intervalo inclusivo: [ini..fin]
      if (fin < inicioAbs) continue; // validación lo marcará; aquí solo evitamos romper

      sumarEnMapa(deltasPorIndiceSemana, inicioAbs, 1);
      if (fin + 1 < totalSemanas) sumarEnMapa(deltasPorIndiceSemana, fin + 1, -1);
    }
  }

  // Construir mapa de abiertas por semana a partir de deltas (prefijos)
  let minAbs = null;
  let maxAbs = null;
  for (const k of deltasPorIndiceSemana.keys()) {
    if (minAbs === null || k < minAbs) minAbs = k;
    if (maxAbs === null || k > maxAbs) maxAbs = k;
  }
  if (minAbs === null) {
    minAbs = absSemanaActual;
    maxAbs = absSemanaActual;
  }

  const mapaAbiertas = new Map(); // "anio||semana" -> count
  let acumulado = 0;
  for (let i = minAbs; i <= maxAbs; i++) {
    acumulado += deltasPorIndiceSemana.get(i) || 0;
    const yw = lookupAbsAAnioSemana[i] || { anio: minAnio, semana: 1 };
    mapaAbiertas.set(`${yw.anio}||${yw.semana}`, acumulado);
  }

  // Unificar claves (incluye semanas que solo aparecen por abiertas)
  const claves = new Set([...mapaNuevas.keys(), ...mapaAbiertas.keys(), ...mapaCerradas.keys()]);
  const filas = [];
  for (const clave of claves) {
    const parts = clave.split("||");
    const anio = Number(parts[0]);
    const semana = Number(parts[1]);
    const cerradas = mapaCerradas.get(clave) || 0;
    const abiertas = mapaAbiertas.get(clave) || 0;
    filas.push([
      anio,
      semana,
      mapaNuevas.get(clave) || 0,
      abiertas,
      cerradas,
      cerradas, // Total HECHO (coincide con "Tareas Cerradas")
      abiertas  // Total ABIERTO (coincide con "Tareas Abiertas")
    ]);
  }

  // Orden por año desc y semana desc
  filas.sort((a, b) => {
    if (a[0] !== b[0]) return b[0] - a[0];
    return b[1] - a[1];
  });

  return [encabezado, ...filas];
}

