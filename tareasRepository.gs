/**
 * Capa técnica (acceso a datos) para la hoja de cálculo.
 * - Sin lógica de negocio.
 * - Lee/escribe desde la fila 2 (fila 1 se asume cabecera).
 */

const NOMBRE_HOJA_TAREAS = 'Tareas';
const FILA_INICIO_DATOS_TAREAS = 2;

// =====================
// Helpers repository (hojas/rangos/IO básico)
// =====================

function repo_obtenerHoja(nombre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;
  return ss.getSheetByName(nombre) || null;
}

function repo_activarHoja(nombre) {
  const hoja = repo_obtenerHoja(nombre);
  if (hoja) hoja.activate();
  return hoja;
}

function repo_insertarFilaTarea(posicion) {
  const hoja = obtenerHojaTareas();
  if (!hoja) return null;
  hoja.insertRowBefore(posicion);
  return hoja;
}

function repo_insertarFilaAntes(nombreHoja, posicion) {
  const hoja = repo_obtenerHoja(nombreHoja);
  if (!hoja) return null;
  hoja.insertRowBefore(posicion);
  return hoja;
}

function repo_borrarFilaTarea(fila) {
  const hoja = obtenerHojaTareas();
  if (!hoja) return;
  hoja.deleteRow(fila);
}

function repo_borrarFila(nombreHoja, fila) {
  const hoja = repo_obtenerHoja(nombreHoja);
  if (!hoja) return;
  hoja.deleteRow(fila);
}

function repo_borrarFilas(nombreHoja, filaInicio, numFilas) {
  const hoja = repo_obtenerHoja(nombreHoja);
  if (!hoja) return;
  hoja.deleteRows(filaInicio, numFilas);
}

function repo_getLastRow(nombreHoja) {
  const hoja = repo_obtenerHoja(nombreHoja);
  if (!hoja) return 0;
  return hoja.getLastRow();
}

function repo_getLastColumn(nombreHoja) {
  const hoja = repo_obtenerHoja(nombreHoja);
  if (!hoja) return 0;
  return hoja.getLastColumn();
}

function repo_getRange(nombreHoja, row, col, numRows, numCols) {
  const hoja = repo_obtenerHoja(nombreHoja);
  if (!hoja) return null;
  if (numRows === undefined || numRows === null) return hoja.getRange(row, col);
  return hoja.getRange(row, col, numRows, numCols);
}

function repo_getRangeEnHoja(hoja, row, col, numRows, numCols) {
  if (!hoja) return null;
  if (numRows === undefined || numRows === null) return hoja.getRange(row, col);
  return hoja.getRange(row, col, numRows, numCols);
}

function repo_getBackground(nombreHoja, row, col) {
  const rng = repo_getRange(nombreHoja, row, col);
  if (!rng) return null;
  return rng.getBackground();
}

function repo_getValue(nombreHoja, row, col) {
  const rng = repo_getRange(nombreHoja, row, col);
  if (!rng) return null;
  return rng.getValue();
}

function repo_setValue(nombreHoja, row, col, value) {
  const rng = repo_getRange(nombreHoja, row, col);
  if (!rng) return;
  rng.setValue(value);
}

function repo_getValues(nombreHoja, row, col, numRows, numCols) {
  const rng = repo_getRange(nombreHoja, row, col, numRows, numCols);
  if (!rng) return [];
  return rng.getValues();
}

function repo_setValues(nombreHoja, row, col, values) {
  const tabla = values;
  if (!Array.isArray(tabla) || tabla.length === 0) return;
  const numRows = tabla.length;
  const numCols = Array.isArray(tabla[0]) ? tabla[0].length : 0;
  if (numCols < 1) return;
  const rng = repo_getRange(nombreHoja, row, col, numRows, numCols);
  if (!rng) return;
  rng.setValues(tabla);
}

/**
 * Escribe `values` en un rango de tamaño fijo (forzando dimensiones).
 * Útil para mantener el comportamiento exacto de setValues cuando el rango se definía con numRows/numCols explícitos.
 */
function repo_setValuesEnRango(nombreHoja, row, col, numRows, numCols, values) {
  const rng = repo_getRange(nombreHoja, row, col, numRows, numCols);
  if (!rng) return;
  rng.setValues(values);
}

function repo_obtenerRangoActivo(nombreHoja) {
  const hoja = repo_obtenerHoja(nombreHoja);
  if (!hoja) return null;
  return hoja.getActiveRange();
}

function repo_obtenerCeldaActiva(nombreHoja) {
  const hoja = repo_obtenerHoja(nombreHoja);
  if (!hoja) return null;
  return hoja.getActiveCell();
}

function repo_setActiveRange(nombreHoja, row, col) {
  const hoja = repo_obtenerHoja(nombreHoja);
  if (!hoja) return;
  const rng = hoja.getRange(row, col);
  hoja.setActiveRange(rng);
}

function repo_activateRange(nombreHoja, row, col) {
  const rng = repo_getRange(nombreHoja, row, col);
  if (!rng) return null;
  rng.activate();
  return rng;
}

function repo_flush() {
  SpreadsheetApp.flush();
}

/**
 * Inserta la columna "Objetivo" entre E y F si la hoja sigue el esquema legacy (7 columnas).
 * Idempotente: no hace nada si ya hay al menos 8 columnas.
 */
function repo_migrarColumnaObjetivoSiNecesario() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  const expectedCol = TASK_COLUMNS.FECHA_FIN_REAL.col;
  const logMigracion = (msg) => {
    if (typeof APP !== "undefined" && APP.LOG && typeof APP.LOG.log === "function") {
      APP.LOG.log(msg);
    } else {
      Logger.log(msg);
    }
  };

  [NOMBRE_HOJA_TAREAS, "Hecho"].forEach((nombre) => {
    const sh = ss.getSheetByName(nombre);
    if (!sh) return;
    const lc = sh.getLastColumn();
    if (lc >= expectedCol) return;

    if (lc < 7) {
      logMigracion(
        "[Migración Objetivo] Hoja \"" +
          nombre +
          "\": getLastColumn=" +
          lc +
          " (<7). No se migra automáticamente; revise la estructura de la hoja."
      );
      return;
    }

    // Esquema antiguo: 7 columnas (A–G). Insertar antes de la antigua F (fecha estimada) = col 6.
    if (lc === 7) {
      const lcConfirm = sh.getLastColumn();
      if (lcConfirm !== 7) return;

      sh.insertColumnBefore(6);
      sh.getRange(1, 6).setValue("Objetivo");
    }
  });
}

/**
 * Devuelve la hoja de tareas o null si no existe.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet|null}
 */
function obtenerHojaTareas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;
  return ss.getSheetByName(NOMBRE_HOJA_TAREAS) || null;
}

/**
 * Lee todas las tareas como matriz 2D (valores crudos).
 * No lanza error si no hay datos o no existe la hoja.
 * @returns {any[][]}
 */
function obtenerTodasLasTareas() {
  const hoja = obtenerHojaTareas();
  if (!hoja) return [];

  const lastRow = hoja.getLastRow();
  const lastCol = hoja.getLastColumn();

  if (lastRow < FILA_INICIO_DATOS_TAREAS || lastCol < 1) return [];

  const numRows = lastRow - FILA_INICIO_DATOS_TAREAS + 1;
  const rango = hoja.getRange(FILA_INICIO_DATOS_TAREAS, 1, numRows, lastCol);
  let valores = rango.getValues();

  // Caso borde: a veces getValues devuelve [ [] ] si el rango es “vacío”.
  if (!valores || valores.length === 0) return [];
  if (valores.length === 1 && (!valores[0] || valores[0].length === 0)) return [];

  const expected = task_expectedColumnCount();
  valores = valores.map((row) => {
    const r = Array.isArray(row) ? row.slice() : [];
    while (r.length < expected) r.push("");
    return r;
  });

  return valores;
}

/**
 * Escribe tareas desde la fila 2, columna 1.
 * Espera una matriz 2D (filas x columnas). No hace validaciones de negocio.
 * No lanza error si la hoja no existe o si tareas viene vacío.
 * @param {any[][]} tareas
 */
function escribirTareas(tareas) {
  const hoja = obtenerHojaTareas();
  if (!hoja) return;
  if (!Array.isArray(tareas) || tareas.length === 0) return;

  const expected = task_expectedColumnCount();
  const normalizadas = tareas.map((row) => {
    const r = Array.isArray(row) ? row.slice() : [];
    while (r.length < expected) r.push("");
    return r;
  });

  const numRows = normalizadas.length;
  const numCols = expected;
  if (numCols < 1) return;

  const rango = hoja.getRange(FILA_INICIO_DATOS_TAREAS, 1, numRows, numCols);
  rango.setValues(normalizadas);
}

/**
 * Limpia (contenido) de la tabla de tareas desde la fila 2 hasta el final usado.
 * No lanza error si no hay datos o no existe la hoja.
 */
function limpiarTareas() {
  const hoja = obtenerHojaTareas();
  if (!hoja) return;

  const lastRow = hoja.getLastRow();
  const lastCol = hoja.getLastColumn();
  if (lastRow < FILA_INICIO_DATOS_TAREAS || lastCol < 1) return;

  const numRows = lastRow - FILA_INICIO_DATOS_TAREAS + 1;
  hoja.getRange(FILA_INICIO_DATOS_TAREAS, 1, numRows, lastCol).clearContent();
}

