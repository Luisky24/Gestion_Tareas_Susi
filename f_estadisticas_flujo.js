/**
 * Módulo: Estadísticas de flujo (operativas)
 *
 * **Propósito**
 * - Generar métricas operativas semanales para seguimiento del flujo de trabajo.
 *
 * **Métricas que genera (salida principal)**
 * - Hoja `Estadisticas` con agregación por semana ISO:
 *   - Tareas Nuevas
 *   - Tareas Abiertas
 *   - Tareas Cerradas
 *   - Tareas Abiertas Históricas (abierta en W si alta antes del lunes siguiente ISO UTC y fin ausente o no antes de ese límite)
 *   - SemanaLabel (`WW/YYYY`) y gráfico de líneas en la misma hoja (tras cada escritura)
 *   - Orden filas configurable (`ScriptProperties` `ESTADISTICAS_ORDEN`: `ASC`|`DESC`, defecto `DESC`); menú «alternar orden»
 *
 * **Relación con el sistema analítico (legacy)**
 * - Este módulo prioriza un agregado simple y estable (operación/monitorización).
 * - El módulo analítico (`f_estadisticas_analitico.js`) genera un reporte distinto (`Resumen Semanal`)
 *   con segmentaciones y cálculos adicionales.
 *
 * **ADVERTENCIA (NO equivalencia)**
 * - Este módulo y el analítico NO son equivalentes ni intercambiables:
 *   - No producen la misma hoja de salida.
 *   - No calculan las mismas métricas ni usan las mismas dimensiones de agrupación.
 * - No asumir que “V2 reemplaza al analítico” sin validar requisitos de reporting.
 */
/**
 * MOTOR DE ESTADÍSTICAS (ÚNICO)
 *
 * - Prohibido crear versiones paralelas (V3, V4, etc.)
 * - Todas las mejoras deben integrarse en este módulo
 * - Validaciones se hacen mediante flags, no mediante duplicación
 *
 * Nota: Apps Script no soporta privacidad real; se usa convención:
 * - API pública: `ejecutarEstadisticasFlujo()`
 * - Funciones internas: prefijo `_`
 */

function log(...args) {
  // Compatibilidad: se mantiene el nombre, pero se centraliza el destino.
  APP.LOG.log('[APP] ' + args.map(String).join(' '));
}

function error(...args) {
  // Compatibilidad: se mantiene el nombre, pero se centraliza el destino.
  APP.LOG.error('[APP ERROR] ' + args.map(String).join(' '));
}

function _statsV2_buildCtx_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const nombreHoja = "Estadisticas";
  return {
    libro,
    nombreHoja,
    hoja: libro.getSheetByName(nombreHoja),
    cabeceras: [
      "Año",
      "Semana",
      "Tareas Nuevas",
      "Tareas Abiertas",
      "Tareas Cerradas",
      "Tareas Abiertas Históricas",
      "SemanaLabel",
    ],
    tareas: [],
    hechos: [],
  };
}

// Único motor de estadísticas soportado actualmente.
// Prohibido crear V3/V4 en paralelo: cualquier evolución debe hacerse sobre este motor o mediante feature flags.
const MOTOR_ESTADISTICAS = "V2";

/** ScriptProperties: orden filas hoja Estadísticas (`ASC` | `DESC`). Por defecto `DESC` si no existe. */
const ESTADISTICAS_ORDEN_KEY = "ESTADISTICAS_ORDEN";

function _obtenerOrdenEstadisticas() {
  const v = PropertiesService.getScriptProperties().getProperty(ESTADISTICAS_ORDEN_KEY);
  return v === "ASC" ? "ASC" : "DESC";
}

/**
 * Alterna orden ASC/DESC por año+semana, guarda en ScriptProperties y regenera estadísticas V2.
 * Menú: Lista Tareas → Estadísticas: alternar orden ASC/DESC
 */
function toggleOrdenEstadisticas() {
  const props = PropertiesService.getScriptProperties();
  const siguiente = _obtenerOrdenEstadisticas() === "ASC" ? "DESC" : "ASC";
  props.setProperty(ESTADISTICAS_ORDEN_KEY, siguiente);
  ejecutarEstadisticasFlujo();
  SpreadsheetApp.getUi().alert(
    "Orden tabla Estadísticas: " +
      siguiente +
      " (año y semana ISO).\nSe ha vuelto a generar la hoja y el gráfico."
  );
}

/**
 * Punto único de entrada para estadísticas.
 * Ningún módulo externo debe llamar directamente a funciones internas (`_estadisticasV2`, etc.).
 */
function ejecutarEstadisticasFlujo() {
  switch (MOTOR_ESTADISTICAS) {
    case "V2":
      return _estadisticasV2();
    default:
      throw new Error("Motor de estadísticas no válido");
  }
}

function _estadisticasV2() {

  try {
    const ctx = _statsV2_buildCtx_();

    // Borramos y creamos la hoja
    // Obtenemos la información para los cálculos
    prepararHojaEstadisticas(ctx);

    // Versión optimizada (una sola pasada). Validada contra funciones originales.
    const resultado = _contarTareasNuevasYCerradas(ctx);
    let contadorNuevas = resultado.nuevas;
    let contadorCerradas = resultado.cerradas;

    // Versión optimizada (deltas + prefijo). Validada contra versión original.
    let contadorAbiertas = _contarTareasAbiertasPorSemana(ctx);

    let contadorAbiertasHistoricas = _contarTareasAbiertasHistoricasPorSemana(ctx);

    let nuevasAbiertasCerradas = _unirNuevasAbiertasCerradas(
      contadorNuevas,
      contadorCerradas,
      contadorAbiertas,
      contadorAbiertasHistoricas
    );

    nuevasAbiertasCerradas = _ordenarAbiertasCerradas(nuevasAbiertasCerradas);

    const valores = _formatearDatos(nuevasAbiertasCerradas);

    grabarEnHjEstadisticas(ctx, valores);

    APP.LOG.log("Proceso estadísticas finalizado de forma correcta");

  } catch (error) {
    registrarError("estadisticasV2", error);
  }

}

/**
 * Lunes 00:00 UTC del inicio de la semana ISO (año ISO `anio`, número `semana`).
 * Misma construcción que antes en `_siguienteSemanaISO` / `_contarTareasAbiertasPorSemana`.
 *
 * @param {number} anio
 * @param {number} semana
 * @returns {Date}
 */
function _isoWeekToMondayUTC(anio, semana) {
  const y = Number(anio);
  const w = Number(semana);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayNum - 1));

  const mondayTarget = new Date(mondayWeek1);
  mondayTarget.setUTCDate(mondayWeek1.getUTCDate() + (w - 1) * 7);
  return mondayTarget;
}

/**
 * Devuelve la semana ISO siguiente a la (anio, semana) dada.
 * Mantiene el mismo criterio ISO que `obtenerSemanaISO()` (UTC, jueves de referencia).
 *
 * @param {number} anio
 * @param {number} semana
 * @returns {{anno:number, semana:number}}
 */
function _siguienteSemanaISO(anio, semana) {
  const monday = _isoWeekToMondayUTC(anio, semana);
  const next = new Date(monday);
  next.setUTCDate(monday.getUTCDate() + 7);

  return obtenerAnioYSemana(next);
}

/**
 * «Abiertas históricas»: para cada semana ISO W (clave anno||semana), número de tareas en Tareas∪Hecho abiertas
 * durante W según: fechaAlta estrictamente antes del lunes 00:00 UTC de la semana ISO siguiente a W, y
 * (sin fecha fin real o fecha fin real en o después de ese mismo instante).
 * Rango: desde la primera semana con alguna fecha válida (alta o fin) hasta la misma semana actual que V2 abiertas.
 *
 * @param {object} ctx contexto V2 (`prepararHojaEstadisticas` ya cargó `tareas` y `hechos`)
 * @returns {Map<string, number>}
 */
function _contarTareasAbiertasHistoricasPorSemana(ctx) {
  const IDX_FECHA_INICIO = TASK_COLUMNS.FECHA_ALTA.idx;
  const IDX_FECHA_FIN = TASK_COLUMNS.FECHA_FIN_REAL.idx;

  const fechaParaISO = (valor) => (typeof valor === "string" ? convertirAFecha(valor) : valor);

  const ywToAbs_ = (yw) => _isoWeekToMondayUTC(yw.anno, yw.semana).getTime();

  const union = [...ctx.tareas, ...ctx.hechos];
  /** @type {{ altaUtc: number, finUtc: number|null }[]} */
  const parsed = [];
  let ywMin = null;

  for (const row of union) {
    const alta = fechaParaISO(row[IDX_FECHA_INICIO]);
    if (!(alta instanceof Date) || isNaN(alta.getTime())) continue;

    const finRaw = row[IDX_FECHA_FIN];
    let finUtc = null;
    let finDate = null;
    if (finRaw != null && finRaw.toString().trim() !== "") {
      finDate = fechaParaISO(finRaw);
      if (!(finDate instanceof Date) || isNaN(finDate.getTime())) continue;
      finUtc = Date.UTC(finDate.getFullYear(), finDate.getMonth(), finDate.getDate());
    }

    const altaUtc = Date.UTC(alta.getFullYear(), alta.getMonth(), alta.getDate());
    parsed.push({ altaUtc, finUtc });

    const ywAlta = obtenerAnioYSemana(alta);
    if (ywMin === null || ywToAbs_(ywAlta) < ywToAbs_(ywMin)) {
      ywMin = { anno: ywAlta.anno, semana: ywAlta.semana };
    }
    if (finUtc !== null && finDate) {
      const ywFin = obtenerAnioYSemana(finDate);
      if (ywMin === null || ywToAbs_(ywFin) < ywToAbs_(ywMin)) {
        ywMin = { anno: ywFin.anno, semana: ywFin.semana };
      }
    }
  }

  if (ywMin === null || parsed.length === 0) return new Map();

  const hoy = new Date();
  const ultimoDiaSemanaHoy = ultimoDiaSemana(hoy);
  const ywActual = obtenerAnioYSemana(ultimoDiaSemanaHoy);
  const absActual = ywToAbs_(ywActual);

  const resultado = new Map();
  let ywCursor = { anno: ywMin.anno, semana: ywMin.semana };

  for (let guard = 0; guard < 6000; guard++) {
    const ywSig = _siguienteSemanaISO(ywCursor.anno, ywCursor.semana);
    const inicioSemanaSiguienteMs = _isoWeekToMondayUTC(ywSig.anno, ywSig.semana).getTime();
    let cnt = 0;
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      if (
        p.altaUtc < inicioSemanaSiguienteMs &&
        (p.finUtc === null || p.finUtc >= inicioSemanaSiguienteMs)
      ) {
        cnt++;
      }
    }
    resultado.set(`${ywCursor.anno}||${ywCursor.semana}`, cnt);

    if (ywToAbs_(ywCursor) >= absActual) break;
    ywCursor = _siguienteSemanaISO(ywCursor.anno, ywCursor.semana);
  }

  return resultado;
}

/**
 * Implementación final (optimizada) de abiertas por semana.
 * Usa deltas + suma prefija enumerando semanas ISO explícitas (evita setDate(+7)).
 *
 * Regla V2:
 * - Una tarea está "abierta" si la fecha fin real (TASK_COLUMNS.FECHA_FIN_REAL) está vacía.
 *
 * @returns {Map<string, number>}
 */
function _contarTareasAbiertasPorSemana(ctx) {
  // Índices del modelo de datos (filas leídas con getDisplayValues)
  const IDX_FECHA_INICIO = TASK_COLUMNS.FECHA_ALTA.idx;
  const IDX_FECHA_FIN = TASK_COLUMNS.FECHA_FIN_REAL.idx;

  const deltas = new Map(); // claveSemana -> delta (+1 inicio, -1 fin+1)

  const addDelta = (clave, delta) => {
    const v = deltas.get(clave) ?? 0;
    deltas.set(clave, v + delta);
  };

  // Semana actual (idéntico criterio que V2 legacy: hasta último día de la semana actual)
  const hoy = new Date();
  const ultimoDiaSemanaHoy = ultimoDiaSemana(hoy);
  const ywActual = obtenerAnioYSemana(ultimoDiaSemanaHoy);

  const ywSiguiente = _siguienteSemanaISO(ywActual.anno, ywActual.semana);
  const claveSemanaSiguiente = `${ywSiguiente.anno}||${ywSiguiente.semana}`;

  // Para construir la secuencia de semanas continuas, necesitamos la semana ISO mínima de inicio válida.
  let ywMin = null;

  const ywToAbs_ = (yw) => _isoWeekToMondayUTC(yw.anno, yw.semana).getTime();

  for (const tarea of ctx.tareas) {
    const fechaInicioStr = tarea[IDX_FECHA_INICIO];
    const fechaFin = tarea[IDX_FECHA_FIN];

    if (!fechaFin || fechaFin === "") {
      const fechaInicio = convertirAFecha(fechaInicioStr);

      // Equivalencia funcional con la versión legacy: fechas inválidas no aportan semanas.
      if (!(fechaInicio instanceof Date) || isNaN(fechaInicio.getTime())) continue;

      const ywInicio = obtenerAnioYSemana(fechaInicio);
      const claveInicio = `${ywInicio.anno}||${ywInicio.semana}`;

      if (ywMin === null || ywToAbs_(ywInicio) < ywToAbs_(ywMin)) {
        ywMin = { anno: ywInicio.anno, semana: ywInicio.semana };
      }

      addDelta(claveInicio, 1);
      addDelta(claveSemanaSiguiente, -1);
    }
  }

  if (ywMin === null) return new Map();

  const resultado = new Map();
  let acumulado = 0;

  let ywCursor = { anno: ywMin.anno, semana: ywMin.semana };
  const absActual = ywToAbs_(ywActual);

  for (let guard = 0; guard < 6000; guard++) {
    const clave = `${ywCursor.anno}||${ywCursor.semana}`;
    acumulado += deltas.get(clave) ?? 0;
    resultado.set(clave, acumulado);

    if (ywToAbs_(ywCursor) >= absActual) break;
    ywCursor = _siguienteSemanaISO(ywCursor.anno, ywCursor.semana);
  }

  return resultado;
}

/**
 * Implementación final (optimizada) de nuevas/cerradas.
 * Mantiene equivalencia exacta con funciones originales (tareas vs hechos).
 *
 * @returns {{nuevas: Map<string, number>, cerradas: Map<string, number>}}
 */
function _contarTareasNuevasYCerradas(ctx) {
  // Índices del modelo de datos (filas leídas con getDisplayValues)
  const IDX_FECHA_INICIO = TASK_COLUMNS.FECHA_ALTA.idx;
  const IDX_FECHA_FIN = TASK_COLUMNS.FECHA_FIN_REAL.idx;

  const nuevas = new Map();
  const cerradas = new Map();

  const inc = (mapa, clave) => {
    const v = mapa.get(clave) ?? 0;
    mapa.set(clave, v + 1);
  };

  const fechaParaISO = (valor) => (typeof valor === "string" ? convertirAFecha(valor) : valor);

  const procesarFilaNuevas = (row) => {
    const fecha = fechaParaISO(row[IDX_FECHA_INICIO]);
    const yw = obtenerAnioYSemana(fecha);
    inc(nuevas, `${yw.anno}||${yw.semana}`);
  };

  const procesarFilaCerradasSiAplica = (row) => {
    const fin = row[IDX_FECHA_FIN];
    if (fin != null && fin.toString().trim() !== "") {
      const fecha = fechaParaISO(fin);
      const yw = obtenerAnioYSemana(fecha);
      inc(cerradas, `${yw.anno}||${yw.semana}`);
    }
  };

  // Equivalente a `let union = [...tareas, ...hechos]; contarXTipo(..., union, 'N');`
  for (const row of ctx.tareas) procesarFilaNuevas(row);
  for (const row of ctx.hechos) procesarFilaNuevas(row);

  // Equivalente a filtrar union por fechaFin no vacía y `contarXTipo(..., 'C')`.
  for (const row of ctx.tareas) procesarFilaCerradasSiAplica(row);
  for (const row of ctx.hechos) procesarFilaCerradasSiAplica(row);

  return { nuevas, cerradas };
}

function _formatearDatos(nuevasAbiertasCerradas) {
  // Formatear datos

  try {
    const valores = nuevasAbiertasCerradas.map(obj => {
      try {
        const [anio, semana] = obj.CampoClave.split('||');
        const y = Number(anio);
        const w = Number(semana);
        const semanaLabel = `${String(w).padStart(2, '0')}/${y}`;
        return [
          y,
          w,
          obj.Nuevas || 0,
          obj.Abiertas || 0,
          obj.Cerradas || 0,
          obj.AbiertasHistoricas || 0,
          semanaLabel,
        ];
      } catch (error) {
        registrarError("estadisticasV2.map", error);
        return [0, 0, 0, 0, 0, 0, ''];
      }
    });

    return valores;

  } catch (error) {
    registrarError("formatearDatos", error);
    throw error; // detiene proceso si falla esta parte crítica
  }

}

function _ordenarAbiertasCerradas(nuevasAbiertasCerradas) {

  const orden = _obtenerOrdenEstadisticas();
  const factor = orden === "ASC" ? 1 : -1;

  nuevasAbiertasCerradas.sort((a, b) => {
    const [ay, am] = a.CampoClave.split("||").map((x) => Number(x.trim()));
    const [by, bm] = b.CampoClave.split("||").map((x) => Number(x.trim()));

    if (ay !== by) return factor * (ay - by);

    return factor * (am - bm);
  });

  return nuevasAbiertasCerradas;

}


function _unirNuevasAbiertasCerradas(nuevas, cerradas, abiertas, abiertasHistoricas) {

  // Unimos y obtenemos una sola clave para ambas estructuras
  let claves = new Set([
    ...nuevas.keys(),
    ...cerradas.keys(),
    ...abiertas.keys(),
    ...(abiertasHistoricas ? abiertasHistoricas.keys() : []),
  ]);

  // Por cada clave verificamos si existe en abiertas y cerradas y si existe añadimos o ponemos cerro en un
  // array que porcada elmento tiene la estructura clave, vloa abiertas, valor cerradas
  let resultado = []
  for (clave of claves) {
    const valorNuevas = nuevas.get(clave) ?? 0;
    const valorCerrada = cerradas.get(clave) ?? 0;
    const valorAbiertas = abiertas.get(clave) ?? 0;
    const valorAbiertasHistoricas = abiertasHistoricas ? (abiertasHistoricas.get(clave) ?? 0) : 0;

    resultado.push({
      ['CampoClave']: clave,
      ['Nuevas']: valorNuevas,
      ['Abiertas']: valorAbiertas,
      ['Cerradas']: valorCerrada,
      ['AbiertasHistoricas']: valorAbiertasHistoricas,
    });

  }

  //console.log("Parada");

  return resultado;

}

function _contarTareasCerradas() {
  // Índice del modelo de datos (fecha fin real)
  const IDX_FECHA_FIN = TASK_COLUMNS.FECHA_FIN_REAL.idx;

  let mapa1 = new Map();

  // Compatibilidad: esta función legacy sigue existiendo.
  // Para evitar dependencia implícita, se construye ctx localmente.
  const ctx = _statsV2_buildCtx_();
  ctx.tareas = obtenerDatosHoja(ctx, "Tareas");
  ctx.hechos = obtenerDatosHoja(ctx, "Hecho");

  let union = [...ctx.tareas, ...ctx.hechos];

  const unionConFechaFin = union.filter(ele => {
    const fin = ele[IDX_FECHA_FIN];
    return fin != null && fin.toString().trim() !== "";
  });

  mapa1 = _contarXTipo(mapa1, unionConFechaFin, 'C');

  //return Array.from(mapa1, ([grupo, suma]) => ({grupo,suma}));
  return mapa1;

}

function _contarTareasNuevas() {

  let mapa = new Map;

  // Compatibilidad: esta función legacy sigue existiendo.
  // Para evitar dependencia implícita, se construye ctx localmente.
  const ctx = _statsV2_buildCtx_();
  ctx.tareas = obtenerDatosHoja(ctx, "Tareas");
  ctx.hechos = obtenerDatosHoja(ctx, "Hecho");

  let union = [...ctx.tareas, ...ctx.hechos];

  mapa = _contarXTipo(mapa, union, 'N');

  // console.log("Parada");

  //return Array.from(mapa, ([grupo,suma]) => ({grupo, suma}));
  return mapa;

}

// Cuenta el número de elmentos de un array que cumple unas condiciones
// El contaje se hace sobre un Map que se recibe y un los elementos se reciben
// en array donde ada elemento es otro array

function _contarXTipo(mapa, valores, tipo) {
  // Índices del modelo de datos (fecha alta / fecha fin real)
  const IDX_FECHA_INICIO = TASK_COLUMNS.FECHA_ALTA.idx;
  const IDX_FECHA_FIN = TASK_COLUMNS.FECHA_FIN_REAL.idx;

  valores.forEach(ele => {

    // Obtener año y semana de una fecha
    let fecha = ele[IDX_FECHA_INICIO];

    if (tipo == 'C') {
      fecha = ele[IDX_FECHA_FIN];
    }

    let annoSemana = obtenerAnioYSemana(fecha);
    
    let clave = annoSemana.anno + '||' + annoSemana.semana;
    let valorActualContador = mapa.get(clave) ?? 0;
    mapa.set(clave, valorActualContador + 1);

  })

  //console.log("Parada");

  return mapa;

}
