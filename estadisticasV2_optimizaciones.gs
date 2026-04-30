/**
 * Optimizaciones (no integradas) para Estadísticas V2.
 *
 * IMPORTANTE:
 * - No modifica el flujo principal.
 * - Mantiene el formato de clave: "anio||semana".
 * - Reutiliza utilidades existentes: convertirAFecha, obtenerAnioYSemana, ultimoDiaSemana.
 * - Esta función pretende producir EXACTAMENTE el mismo resultado que:
 *     contarTareasAbiertasPorSemana()
 */

/**
 * Devuelve la semana ISO siguiente a la (anio, semana) dada.
 * Mantiene el mismo criterio ISO que `obtenerSemanaISO()` (UTC, jueves de referencia).
 *
 * @param {number} anio
 * @param {number} semana
 * @returns {{anno:number, semana:number}}
 */
function siguienteSemanaISO(anio, semana) {
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
 * Versión optimizada usando técnica de deltas + suma prefija.
 *
 * Resultado:
 * - Mismo Map("anio||semana" -> count) que la versión original.
 * - Cuenta tareas "abiertas" con la misma regla: fechaFin vacío (columna 6).
 *
 * Complejidad:
 * - O(n + R) donde R es el número de semanas entre la tarea más antigua y la semana actual.
 *
 * @returns {Map<string, number>}
 */
function contarTareasAbiertasPorSemana_OPT() {
  // Índices del modelo de datos (filas leídas con getDisplayValues)
  const IDX_FECHA_INICIO = 0;
  const IDX_FECHA_FIN = 6;

  const deltas = new Map(); // claveSemana -> delta (+1 inicio, -1 fin+1)

  const addDelta = (clave, delta) => {
    const v = deltas.get(clave) ?? 0;
    deltas.set(clave, v + delta);
  };

  // Semana actual (idéntico criterio que la versión original: hasta último día de la semana actual)
  const hoy = new Date();
  const ultimoDiaSemanaHoy = ultimoDiaSemana(hoy);

  // La versión original calcula el año/semana dentro del bucle usando fechas concretas.
  // Aquí calculamos una clave de "semana actual" a partir del mismo límite (domingo de la semana actual).
  const ywActual = obtenerAnioYSemana(ultimoDiaSemanaHoy);
  const claveSemanaActual = `${ywActual.anno}||${ywActual.semana}`;

  // Clave "semana siguiente" (para apagar el intervalo en el prefijo).
  const ywSiguiente = siguienteSemanaISO(ywActual.anno, ywActual.semana);
  const claveSemanaSiguiente = `${ywSiguiente.anno}||${ywSiguiente.semana}`;

  // Para construir la secuencia de semanas continuas, necesitamos la semana ISO mínima de inicio válida.
  // NOTA: no usamos `setDate(+7)` para enumerar semanas porque:
  // - las semanas ISO no están definidas por "cada 7 días desde una fecha arbitraria"
  // - en límites de año ISO (semana 52/53 -> 1) y con efectos de zona/DST, esa enumeración puede omitir o duplicar semanas
  // En su lugar, iteramos por (año ISO, semana ISO) usando `siguienteSemanaISO`.
  let ywMin = null;

  const isoWeekToDateMondayUTC_ = (y, w) => {
    // Algoritmo estándar: la semana 1 ISO es la que contiene el 4 de enero.
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const dayNum = jan4.getUTCDay() || 7; // 1..7 (lunes..domingo)
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayNum - 1));

    const mondayTarget = new Date(mondayWeek1);
    mondayTarget.setUTCDate(mondayWeek1.getUTCDate() + (w - 1) * 7);
    return mondayTarget;
  };

  const ywToAbs_ = (yw) => {
    const d = isoWeekToDateMondayUTC_(Number(yw.anno), Number(yw.semana));
    return d.getTime();
  };

  // 1) Registrar intervalos [semanaInicio..semanaActual] con deltas (+1, -1 en semana siguiente)
  for (const tarea of tareas) {
    const fechaInicioStr = tarea[IDX_FECHA_INICIO];
    const fechaFin = tarea[IDX_FECHA_FIN];

    // Solo procesar tareas abiertas (misma condición que la versión original)
    if (!fechaFin || fechaFin === "") {
      const fechaInicio = convertirAFecha(fechaInicioStr);

      // Equivalencia funcional con la versión original:
      // si la fecha es inválida, el while original no ejecuta ninguna iteración.
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

  // Si no hay tareas abiertas válidas, devolver Map vacío (igual que la versión original)
  if (ywMin === null) return new Map();

  // 2) Recorrer semanas ISO desde la mínima hasta la actual y acumular prefijo.
  // Enumeración canónica: avanzar por (año ISO, semana ISO) con `siguienteSemanaISO`.
  const resultado = new Map();
  let acumulado = 0;

  let ywCursor = { anno: ywMin.anno, semana: ywMin.semana };
  const absActual = ywToAbs_(ywActual);

  // Bucle defensivo: como máximo 6000 semanas (~115 años), evita bucles infinitos por datos corruptos.
  for (let guard = 0; guard < 6000; guard++) {
    const clave = `${ywCursor.anno}||${ywCursor.semana}`;
    acumulado += deltas.get(clave) ?? 0;
    resultado.set(clave, acumulado);

    if (ywToAbs_(ywCursor) >= absActual) break;
    ywCursor = siguienteSemanaISO(ywCursor.anno, ywCursor.semana);
  }

  return resultado;
}

