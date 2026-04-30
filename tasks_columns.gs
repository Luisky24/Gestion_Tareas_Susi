/**
 * FASE MIGRACIÓN 1
 *
 * Contrato de columnas y helpers de acceso al modelo de "Tareas".
 * Importante: en esta fase NO se conecta aún con el resto del código existente.
 *
 * Convenciones:
 * - idx: índice 0-based del array devuelto por getValues()
 * - col: columna 1-based de Google Sheets
 */

/**
 * Contrato de columnas para la hoja de tareas.
 * Ajusta/expande este contrato cuando el modelo crezca, sin introducir índices mágicos.
 */
const TASK_COLUMNS = Object.freeze({
  FECHA_ALTA: Object.freeze({ idx: 0, col: 1 }),
  TITULO: Object.freeze({ idx: 1, col: 2 }),
  PRIORIDAD: Object.freeze({ idx: 2, col: 3 }),
  // (col 4 / idx 3): reservado/no referenciado explícitamente en el código actual
  ESTADO: Object.freeze({ idx: 4, col: 5 }),
  FECHA_FIN_ESTIMADA: Object.freeze({ idx: 5, col: 6 }),
  FECHA_FIN_REAL: Object.freeze({ idx: 6, col: 7 }),
});

/**
 * Valores de dominio usados por el sistema actual.
 * Se centraliza aquí para evitar literales dispersos.
 */
const TASK_DOMAIN = Object.freeze({
  ESTADO_HECHO: "hecho",
});

/**
 * Devuelve el estado de una fila de tarea (array 0-based de getValues()).
 */
function task_getEstado(tareaRow) {
  if (!Array.isArray(tareaRow)) return "";
  const v = tareaRow[TASK_COLUMNS.ESTADO.idx];
  return v === null || v === undefined ? "" : String(v);
}

/**
 * Devuelve la fecha fin real de una fila de tarea.
 * Puede ser Date, string o "" según cómo se haya escrito/convertido el dato.
 */
function task_getFechaFinReal(tareaRow) {
  if (!Array.isArray(tareaRow)) return "";
  return tareaRow[TASK_COLUMNS.FECHA_FIN_REAL.idx];
}

/**
 * Devuelve la fecha fin estimada de una fila de tarea.
 */
function task_getFechaFinEstimada(tareaRow) {
  if (!Array.isArray(tareaRow)) return "";
  return tareaRow[TASK_COLUMNS.FECHA_FIN_ESTIMADA.idx];
}

/**
 * Indica si la tarea está marcada como finalizada según el estado del modelo actual.
 */
function task_isHecho(tareaRow) {
  return task_getEstado(tareaRow) === TASK_DOMAIN.ESTADO_HECHO;
}

