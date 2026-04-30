/**
 * Estadísticas V3 - IO
 * Contiene TODAS las funciones que usan SpreadsheetApp y el mapeo de columnas.
 *
 * Incluye:
 * - loader
 * - writer
 * - logging
 * - columnas
 */

// =====================
// Loader (IO)
// =====================

/**
 * Lee las hojas "Tareas" y "Hecho" (fila 2 en adelante) y devuelve una lista unificada.
 * Cada elemento es un objeto crudo con la fila original y la procedencia.
 *
 * @returns {{datosCrudos: {fuente:string, fila:number, campos:any}[], errores: {fuente:string, fila:number, mensaje:string}[]}}
 */
function io_cargarTareasDesdeHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombres = [CONFIG_ESTADISTICAS.HOJAS.TAREAS, CONFIG_ESTADISTICAS.HOJAS.HECHO];
  const datosCrudos = [];
  const errores = [];

  nombres.forEach((nombre) => {
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) {
      errores.push({ fuente: nombre, fila: 1, mensaje: `No existe la hoja "${nombre}"` });
      return;
    }

    const mapeo = io_obtenerMapaColumnasDesdeHoja(hoja);
    if (!mapeo.mapa || mapeo.faltantes.length > 0) {
      errores.push({
        fuente: nombre,
        fila: 1,
        mensaje: `Estructura inválida: faltan columnas ${mapeo.faltantes.join(", ")}`
      });
      return;
    }

    const lastRow = hoja.getLastRow();
    const lastCol = hoja.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return;

    const numRows = lastRow - 1;
    const rango = hoja.getRange(2, 1, numRows, lastCol);
    const valores = rango.getValues();

    for (let i = 0; i < valores.length; i++) {
      const row = valores[i];
      const idx = mapeo.mapa;
      const campos = {
        fechaAlta: idx.FECHA_ALTA >= 0 ? row[idx.FECHA_ALTA] : null,
        nombre: idx.NOMBRE_TAREA >= 0 ? row[idx.NOMBRE_TAREA] : "",
        prioridad: idx.PRIORIDAD >= 0 ? row[idx.PRIORIDAD] : null,
        estado: idx.ESTADO >= 0 ? row[idx.ESTADO] : "",
        fechaFinEstimada: idx.FECHA_ESTIMADA >= 0 ? row[idx.FECHA_ESTIMADA] : null,
        fechaFinReal: idx.FECHA_FIN >= 0 ? row[idx.FECHA_FIN] : null
      };

      datosCrudos.push({
        fuente: nombre,
        fila: i + 2,
        campos
      });
    }
  });

  return { datosCrudos, errores };
}

// =====================
// Columnas (IO + util)
// =====================

/**
 * Devuelve un mapeo { CAMPO: index } basado en la cabecera de la hoja.
 *
 * Campos requeridos:
 * - FECHA_ALTA
 * - PRIORIDAD
 * - ESTADO
 * - FECHA_FIN
 * - FECHA_ESTIMADA
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @returns {{mapa: {FECHA_ALTA:number, PRIORIDAD:number, ESTADO:number, FECHA_FIN:number, FECHA_ESTIMADA:number, NOMBRE_TAREA:number}, faltantes: string[]}}
 */
function io_obtenerMapaColumnasDesdeHoja(hoja) {
  if (!hoja) return { mapa: null, faltantes: ["HOJA_INEXISTENTE"] };

  const lastCol = hoja.getLastColumn();
  if (lastCol < 1) return { mapa: null, faltantes: ["CABECERA_VACIA"] };

  const cabecera = hoja.getRange(1, 1, 1, lastCol).getValues()[0];
  const idxPorNombre = new Map();
  for (let i = 0; i < cabecera.length; i++) {
    const key = tec_normalizarNombreColumna(cabecera[i]);
    if (key) idxPorNombre.set(key, i);
  }

  // Sinónimos soportados (normalizados)
  const sinonimos = {
    FECHA_ALTA: ["fecha alta", "alta", "fecha inicio", "inicio", "fecha"],
    NOMBRE_TAREA: ["tarea", "nombre tarea", "descripcion", "descripcion tarea", "titulo"],
    PRIORIDAD: ["prioridad", "prio"],
    ESTADO: ["estado", "situacion"],
    FECHA_ESTIMADA: ["fecha fin estimada", "fin estimado", "fecha estimada", "vencimiento", "fecha vencimiento"],
    FECHA_FIN: ["fecha fin", "fin real", "fecha fin real", "cerrada", "fecha cierre", "cierre"]
  };

  const pick = (claves) => {
    for (const c of claves) {
      const i = idxPorNombre.get(c);
      if (i !== undefined) return i;
    }
    return -1;
  };

  const mapa = {
    FECHA_ALTA: pick(sinonimos.FECHA_ALTA),
    NOMBRE_TAREA: pick(sinonimos.NOMBRE_TAREA),
    PRIORIDAD: pick(sinonimos.PRIORIDAD),
    ESTADO: pick(sinonimos.ESTADO),
    FECHA_ESTIMADA: pick(sinonimos.FECHA_ESTIMADA),
    FECHA_FIN: pick(sinonimos.FECHA_FIN)
  };

  const faltantes = [];
  if (mapa.FECHA_ALTA < 0) faltantes.push("FECHA_ALTA");
  if (mapa.PRIORIDAD < 0) faltantes.push("PRIORIDAD");
  if (mapa.ESTADO < 0) faltantes.push("ESTADO");
  if (mapa.FECHA_ESTIMADA < 0) faltantes.push("FECHA_ESTIMADA");
  if (mapa.FECHA_FIN < 0) faltantes.push("FECHA_FIN");

  return { mapa, faltantes };
}

/**
 * Normaliza texto de cabecera para comparación:
 * - lowercase
 * - trim
 * - sin acentos
 * - colapsa espacios
 * @param {any} v
 * @returns {string}
 */
function tec_normalizarNombreColumna(v) {
  const s = (v === null || v === undefined) ? "" : String(v);
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

// =====================
// Writer (IO)
// =====================

/**
 * Escribe `datos` (matriz 2D) en una hoja. Crea la hoja si no existe.
 * Limpia el contenido antes de escribir.
 *
 * @param {string} nombreHoja
 * @param {any[][]} datos
 */
function io_escribirDatosEnHoja(nombreHoja, datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombre = String(nombreHoja || "").trim();
  if (!nombre) throw new Error("io_escribirDatosEnHoja: nombreHoja inválido");

  const tabla = Array.isArray(datos) ? datos : [];

  const hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  hoja.clearContents();

  if (tabla.length === 0) return;
  if (!Array.isArray(tabla[0]) || tabla[0].length === 0) return;

  // Asegurar uniformidad de columnas para evitar error en setValues
  let maxCols = 0;
  for (const fila of tabla) {
    if (Array.isArray(fila) && fila.length > maxCols) maxCols = fila.length;
  }
  const normalizada = tabla.map((fila) => {
    const f = Array.isArray(fila) ? fila.slice() : [];
    while (f.length < maxCols) f.push("");
    return f;
  });

  hoja.getRange(1, 1, normalizada.length, maxCols).setValues(normalizada);
}

/**
 * Escribe errores estructurados en una hoja.
 * Crea la hoja si no existe y limpia antes de escribir.
 *
 * @param {string} nombreHoja
 * @param {{fuente:string, fila:number, mensaje:string}[]} errores
 */
function io_escribirErrores(nombreHoja, errores) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombre = String(nombreHoja || "").trim();
  if (!nombre) throw new Error("io_escribirErrores: nombreHoja inválido");

  const hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  hoja.clearContents();

  const lista = Array.isArray(errores) ? errores : [];
  const filas = [["Fuente", "Fila", "Mensaje"]];

  for (const e of lista) {
    filas.push([
      e && e.fuente !== undefined ? String(e.fuente) : "",
      e && typeof e.fila === "number" ? e.fila : "",
      e && e.mensaje !== undefined ? String(e.mensaje) : ""
    ]);
  }

  hoja.getRange(1, 1, filas.length, filas[0].length).setValues(filas);
}

// =====================
// Logging (IO)
// =====================

/**
 * Registra una ejecución de estadísticas V3.
 *
 * Columnas:
 * - Fecha ejecución
 * - Total tareas leídas
 * - Tareas válidas
 * - Tareas con error
 * - Tiempo ejecución (ms)
 *
 * @param {{
 *   fechaEjecucion?: Date,
 *   totalLeidas: number,
 *   validas: number,
 *   errores: number,
 *   duracionMs: number
 * }} info
 */
function io_registrarLogEjecucion(info) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG_ESTADISTICAS.HOJAS.LOG) || ss.insertSheet(CONFIG_ESTADISTICAS.HOJAS.LOG);

  // Inicializar cabecera si está vacía
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(["Fecha ejecución", "Total tareas leídas", "Tareas válidas", "Tareas con error", "Tiempo ejecución (ms)"]);
  }

  const fecha = (info && info.fechaEjecucion) ? info.fechaEjecucion : new Date();
  const totalLeidas = info && Number.isFinite(info.totalLeidas) ? info.totalLeidas : 0;
  const validas = info && Number.isFinite(info.validas) ? info.validas : 0;
  const errores = info && Number.isFinite(info.errores) ? info.errores : 0;
  const duracionMs = info && Number.isFinite(info.duracionMs) ? info.duracionMs : 0;

  hoja.appendRow([fecha, totalLeidas, validas, errores, duracionMs]);
}

