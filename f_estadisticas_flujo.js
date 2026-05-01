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
    cabeceras: ["Año", "Semana", "Tareas Nuevas", "Tareas Abiertas", "Tareas Cerradas"],
    tareas: [],
    hechos: [],
  };
}

// Único motor de estadísticas soportado actualmente.
// Prohibido crear V3/V4 en paralelo: cualquier evolución debe hacerse sobre este motor o mediante feature flags.
const MOTOR_ESTADISTICAS = "V2";

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

    let nuevasAbiertasCerradas = _unirNuevasAbiertasCerradas(contadorNuevas, contadorCerradas, contadorAbiertas);

    nuevasAbiertasCerradas = _ordenarAbiertasCerradas(nuevasAbiertasCerradas);

    const valores = _formatearDatos(nuevasAbiertasCerradas);

    grabarEnHjEstadisticas(ctx, valores);

    APP.LOG.log("Proceso estadísticas finalizado de forma correcta");

  } catch (error) {
    registrarError("estadisticasV2", error);
  }

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
  // Convertir (anio, semana ISO) -> fecha (lunes de esa semana), luego +7 días y recalcular ISO.
  const isoWeekToDateMonday = (y, w) => {
    // Algoritmo estándar: la semana 1 ISO es la que contiene el 4 de enero.
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const dayNum = jan4.getUTCDay() || 7; // 1..7 (lunes..domingo)
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayNum - 1));

    const mondayTarget = new Date(mondayWeek1);
    mondayTarget.setUTCDate(mondayWeek1.getUTCDate() + (w - 1) * 7);
    return mondayTarget;
  };

  const monday = isoWeekToDateMonday(Number(anio), Number(semana));
  const next = new Date(monday);
  next.setUTCDate(monday.getUTCDate() + 7);

  return obtenerAnioYSemana(next);
}

/**
 * Implementación final (optimizada) de abiertas por semana.
 * Usa deltas + suma prefija enumerando semanas ISO explícitas (evita setDate(+7)).
 *
 * Regla V2:
 * - Una tarea está "abierta" si `Fecha fin real` (columna G / índice 6) está vacía.
 *
 * @returns {Map<string, number>}
 */
function _contarTareasAbiertasPorSemana(ctx) {
  // Índices del modelo de datos (filas leídas con getDisplayValues)
  const IDX_FECHA_INICIO = 0;
  const IDX_FECHA_FIN = 6;

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

  const isoWeekToDateMondayUTC_ = (y, w) => {
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const dayNum = jan4.getUTCDay() || 7;
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayNum - 1));

    const mondayTarget = new Date(mondayWeek1);
    mondayTarget.setUTCDate(mondayWeek1.getUTCDate() + (w - 1) * 7);
    return mondayTarget;
  };

  const ywToAbs_ = (yw) => isoWeekToDateMondayUTC_(Number(yw.anno), Number(yw.semana)).getTime();

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
  const IDX_FECHA_INICIO = 0;
  const IDX_FECHA_FIN = 6;

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
        return [
          Number(anio),
          Number(semana),
          obj.Nuevas || 0,
          obj.Abiertas || 0,
          obj.Cerradas || 0
        ];
      } catch (error) {
        registrarError("estadisticasV2.map", error);
        return [0, 0, 0, 0, 0];
      }
    });

    return valores;

  } catch (error) {
    registrarError("formatearDatos", error);
    throw error; // detiene proceso si falla esta parte crítica
  }

}

function _ordenarAbiertasCerradas(nuevasAbiertasCerradas) {

  nuevasAbiertasCerradas.sort((a,b)=>{
    
    const [ay, am] = a.CampoClave.split("||").map(x => Number(x.trim()));
    const [by, bm] = b.CampoClave.split("||").map(x => Number(x.trim()));

    // Primero por año descendente
    if (ay !== by) return by - ay;

    // Luego por mes/semana descendente
    return bm - am;

  });

  return nuevasAbiertasCerradas;

}


function _unirNuevasAbiertasCerradas(nuevas, cerradas, abiertas) {

  // Unimos y obtenemos una sola clave para ambas estructuras
  let claves = new Set([...nuevas.keys(), ...cerradas.keys(), ...abiertas.keys()]);

  // Por cada clave verificamos si existe en abiertas y cerradas y si existe añadimos o ponemos cerro en un
  // array que porcada elmento tiene la estructura clave, vloa abiertas, valor cerradas
  let resultado = []
  for (clave of claves) {
    const valorNuevas = nuevas.get(clave) ?? 0;
    const valorCerrada = cerradas.get(clave) ?? 0;
    const valorAbiertas = abiertas.get(clave) ?? 0;

    resultado.push({ ['CampoClave']: clave, ['Nuevas']: valorNuevas, ['Abiertas']: valorAbiertas, ['Cerradas']: valorCerrada });

  }

  //console.log("Parada");

  return resultado;

}

function _contarTareasCerradas() {
  // Índice del modelo de datos (fecha fin real)
  const IDX_FECHA_FIN = 6;

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
  const IDX_FECHA_INICIO = 0;
  const IDX_FECHA_FIN = 6;

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
