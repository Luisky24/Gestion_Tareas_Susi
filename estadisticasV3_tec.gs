/**
 * Estadísticas V3 - Técnico
 * Funciones técnicas puras: configuración, fechas/semana ISO, normalización y utilidades.
 *
 * Restricciones:
 * - No usa SpreadsheetApp.
 */

// =====================
// Configuración (puro)
// =====================

const CONFIG_ESTADISTICAS = {
  HOJAS: {
    TAREAS: "Tareas",
    HECHO: "Hecho",
    RESUMEN: "Resumen Semanal V3",
    EVOLUCION: "Estadisticas V3",
    ERRORES: "Errores Estadisticas V3",
    LOG: "Log Estadisticas V3"
  },

  ESTADOS: {
    HECHO: ["hecho", "cerrado", "finalizado"],
    ABIERTOS: ["pendiente", "en curso", "abierto"],
    IGNORADOS: ["cancelado", "descartado"]
  }
};

// =====================
// Estados (puro)
// =====================

/**
 * Normaliza un estado de tarea a string comparable.
 * @param {any} estado
 * @returns {string}
 */
function tec_normalizarEstado(estado) {
  if (estado === null || estado === undefined) return "";
  return String(estado).trim().toLowerCase();
}

/**
 * Clasifica un estado normalizado en un tipo explícito.
 *
 * Tipos:
 * - HECHO: tarea cerrada
 * - ABIERTO: tarea abierta
 * - IGNORADO: tarea descartada/cancelada (no entra en métricas)
 * - DESCONOCIDO: no entra en ninguna categoría formal
 *
 * @param {any} estado
 * @returns {"HECHO"|"ABIERTO"|"IGNORADO"|"DESCONOCIDO"}
 */
function tec_tipoEstado(estado) {
  const e = tec_normalizarEstado(estado);
  if (!e) return "DESCONOCIDO";

  if (CONFIG_ESTADISTICAS.ESTADOS.IGNORADOS.indexOf(e) !== -1) return "IGNORADO";
  if (CONFIG_ESTADISTICAS.ESTADOS.HECHO.indexOf(e) !== -1) return "HECHO";
  if (CONFIG_ESTADISTICAS.ESTADOS.ABIERTOS.indexOf(e) !== -1) return "ABIERTO";

  return "DESCONOCIDO";
}

// =====================
// Semana ISO (puro)
// =====================

/**
 * Devuelve { anio, semana } ISO para una fecha dada.
 * @param {Date} fecha
 * @returns {{anio:number, semana:number}}
 */
function tec_obtenerAnioSemanaISO(fecha) {
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) {
    throw new Error("tec_obtenerAnioSemanaISO: fecha inválida");
  }

  // Trabajar en UTC para evitar efectos por zona horaria
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));

  // ISO: lunes=1..domingo=7; en JS domingo=0
  const diaSemana = d.getUTCDay() || 7;
  // Mover al jueves de la semana actual
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);

  const anio = d.getUTCFullYear();
  const inicioAnio = new Date(Date.UTC(anio, 0, 1));
  const diffDias = Math.floor((d.getTime() - inicioAnio.getTime()) / 86400000);
  const semana = Math.ceil((diffDias + 1) / 7);

  return { anio, semana };
}

/**
 * Devuelve el número de semanas ISO que tiene un año (52 o 53).
 * ISO define que la semana que contiene el 28 de diciembre siempre es la última del año.
 * @param {number} anio
 * @returns {number}
 */
function tec_semanasISOEnAnio(anio) {
  // Cache por año para evitar recalcular (muy usado en offsets y conversiones)
  if (!tec_semanasISOEnAnio._cache) tec_semanasISOEnAnio._cache = new Map();
  const cache = tec_semanasISOEnAnio._cache;
  if (cache.has(anio)) return cache.get(anio);

  const f = new Date(Date.UTC(anio, 11, 28));
  const semanas = tec_obtenerAnioSemanaISO(new Date(f.getTime())).semana;
  cache.set(anio, semanas);
  return semanas;
}

/**
 * Construye offsets acumulados por año para convertir (anio, semana) en un índice absoluto.
 * @param {number} minAnio
 * @param {number} maxAnio
 * @returns {{offsetPorAnio: Map<number, number>, totalSemanas: number}}
 */
function tec_construirOffsetsSemanas(minAnio, maxAnio) {
  const offsetPorAnio = new Map();
  let acumulado = 0;
  for (let y = minAnio; y <= maxAnio; y++) {
    offsetPorAnio.set(y, acumulado);
    acumulado += tec_semanasISOEnAnio(y);
  }
  return { offsetPorAnio, totalSemanas: acumulado };
}

/**
 * Construye un lookup directo absIndex -> {anio, semana}.
 * Útil para evitar recorrer años o llamar repetidamente a tec_absAAnioSemana.
 *
 * @param {number} minAnio
 * @param {number} maxAnio
 * @param {Map<number, number>} offsetPorAnio
 * @param {number} totalSemanas
 * @returns {{anio:number, semana:number}[]}
 */
function tec_construirLookupAbsAAnioSemana(minAnio, maxAnio, offsetPorAnio, totalSemanas) {
  const lookup = new Array(totalSemanas);
  for (let y = minAnio; y <= maxAnio; y++) {
    const off = offsetPorAnio.get(y);
    if (off === undefined) continue;
    const semanas = tec_semanasISOEnAnio(y);
    for (let w = 1; w <= semanas; w++) {
      lookup[off + (w - 1)] = { anio: y, semana: w };
    }
  }
  return lookup;
}

/**
 * Convierte índice absoluto a {anio, semana} usando offsets precomputados.
 * @param {number} abs
 * @param {number} minAnio
 * @param {number} maxAnio
 * @param {Map<number, number>} offsetPorAnio
 * @returns {{anio:number, semana:number}}
 */
function tec_absAAnioSemana(abs, minAnio, maxAnio, offsetPorAnio) {
  // Rango de años esperado es pequeño; este bucle es O(#años)
  for (let y = minAnio; y <= maxAnio; y++) {
    const off = offsetPorAnio.get(y) || 0;
    const semanas = tec_semanasISOEnAnio(y);
    if (abs >= off && abs < off + semanas) {
      return { anio: y, semana: (abs - off) + 1 };
    }
  }
  // Fallback conservador
  return { anio: minAnio, semana: 1 };
}

// =====================
// Normalizador (puro)
// =====================

/**
 * Normaliza filas crudas a objetos de tarea homogéneos.
 *
 * Recibe campos ya extraídos por el Loader mediante mapeo de columnas.
 *
 * @param {{fuente:string, fila:number, campos:any}[]} datosCrudos
 * @returns {{
 *   fuente:string,
 *   fila:number,
 *   fechaAlta:Date|null,
 *   nombre:string,
 *   prioridad:number|null,
 *   estado:string,
 *   fechaFinEstimada:Date|null,
 *   fechaFinReal:Date|null,
 *   anioAlta:number|null,
 *   semanaAlta:number|null,
 *   anioFin:number|null,
 *   semanaFin:number|null
 * }[]}
 */
function tec_normalizarTareas(datosCrudos) {
  const datosCrudosEntrada = Array.isArray(datosCrudos) ? datosCrudos : [];

  return datosCrudosEntrada.map((registroCrudo) => {
    const campos = (registroCrudo && registroCrudo.campos) ? registroCrudo.campos : {};

    // Normalización de fechas: todas las fechas quedan como Date|null
    const fechaAlta = tec_normalizarFecha(campos.fechaAlta);
    const nombre = (campos.nombre === null || campos.nombre === undefined) ? "" : String(campos.nombre);

    let prioridad = null;
    if (campos.prioridad !== null && campos.prioridad !== undefined && campos.prioridad !== "") {
      const p = Number(campos.prioridad);
      prioridad = Number.isFinite(p) ? p : null;
    }

    const estado = tec_normalizarEstado(campos.estado);

    const fechaFinEstimada = tec_normalizarFecha(campos.fechaFinEstimada);
    const fechaFinReal = tec_normalizarFecha(campos.fechaFinReal);

    let anioAlta = null, semanaAlta = null;
    if (fechaAlta) {
      const aw = tec_obtenerAnioSemanaISO(fechaAlta);
      anioAlta = aw.anio;
      semanaAlta = aw.semana;
    }

    let anioFin = null, semanaFin = null;
    if (fechaFinReal) {
      const fw = tec_obtenerAnioSemanaISO(fechaFinReal);
      anioFin = fw.anio;
      semanaFin = fw.semana;
    }

    return {
      fuente: registroCrudo ? registroCrudo.fuente : "",
      fila: registroCrudo ? registroCrudo.fila : -1,
      fechaAlta,
      nombre,
      prioridad,
      estado,
      fechaFinEstimada,
      fechaFinReal,
      anioAlta,
      semanaAlta,
      anioFin,
      semanaFin
    };
  });
}

/**
 * Convierte un valor potencialmente fecha (Date/string/number) a Date o null.
 * Acepta string en formato dd/MM/yyyy (usado en el proyecto).
 * @param {any} valor
 * @returns {Date|null}
 */
function tec_normalizarFecha(valor) {
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null;
    return new Date(valor.getTime());
  }

  // A veces GAS entrega fechas como número serial o timestamp
  if (typeof valor === "number") {
    const d = new Date(valor);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof valor === "string") {
    const s = valor.trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const y = Number(m[3]);
      const dt = new Date(y, mo - 1, d);
      if (isNaN(dt.getTime())) return null;
      if (dt.getFullYear() !== y || dt.getMonth() !== (mo - 1) || dt.getDate() !== d) return null;
      return dt;
    }

    // Fallback: intentar parseo nativo
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

