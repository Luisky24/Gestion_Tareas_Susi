/**
 * FASE MIGRACIÓN 1
 *
 * Contrato de columnas y helpers de acceso al modelo de "Tareas".
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
  OBJETIVO: Object.freeze({ idx: 5, col: 6 }),
  FECHA_FIN_ESTIMADA: Object.freeze({ idx: 6, col: 7 }),
  FECHA_FIN_REAL: Object.freeze({ idx: 7, col: 8 }),
});

/** Número de columnas del modelo de fila de tarea (ancho esperado de cada fila). */
function task_expectedColumnCount() {
  return TASK_COLUMNS.FECHA_FIN_REAL.idx + 1;
}

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

/**
 * Indica si la columna Objetivo está marcada con "X" (mayús./minús. ignoradas).
 */
function task_isObjetivoMarcado(tareaRow) {
  if (!Array.isArray(tareaRow)) return false;
  const v = tareaRow[TASK_COLUMNS.OBJETIVO.idx];
  return String(v === null || v === undefined ? "" : v)
    .trim()
    .toUpperCase() === "X";
}

/**
 * Clave yyyy-MM-dd del día de la fecha estimada en la zona horaria del script, o '' si vacía/inválida.
 * Dos vacías se consideran la misma clave ('').
 */
function task_dayKeyEstimada(tareaRow) {
  return task_valueToDayKey_(task_getFechaFinEstimada(tareaRow));
}

/**
 * true si hay fecha estimada válida y su día calendario es <= hoy (misma zona horaria que el script).
 */
function task_estimadaMenorOIgualHoy(tareaRow) {
  const key = task_dayKeyEstimada(tareaRow);
  if (key === "") return false;
  return key <= task_todayDayKey_();
}

/**
 * Convierte un valor de celda de fecha a clave de día yyyy-MM-dd o ''.
 */
function task_valueToDayKey_(v) {
  if (v === null || v === undefined || v === "") return "";

  const tz = Session.getScriptTimeZone();

  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  }

  // Serial numérico de hoja de cálculo (días desde epoch tipo Excel/Sheets), opcionalmente con fracción horaria.
  if (typeof v === "number" && isFinite(v)) {
    const d = new Date((v - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, tz, "yyyy-MM-dd");
    }
  }

  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return "";
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) {
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, "yyyy-MM-dd");
    }
  }

  return "";
}

function task_todayDayKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/**
 * Rellena la fila con celdas vacías hasta el ancho esperado del modelo.
 */
function task_padRowToExpectedWidth(tareaRow) {
  if (!Array.isArray(tareaRow)) return;
  const n = task_expectedColumnCount();
  while (tareaRow.length < n) tareaRow.push("");
}
