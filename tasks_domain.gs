/**
 * FASE MIGRACIÓN 1
 *
 * Dominio puro (sin SpreadsheetApp).
 * En esta fase se extrae la lógica de cálculo de la fila destino para reubicar tareas finalizadas.
 */

/**
 * Convierte un valor de celda (Date / number / string) en timestamp (ms).
 * - Si no se puede interpretar, devuelve 0 para mantener comparaciones "seguras" y deterministas.
 * - Soporta strings "dd/MM/yyyy" (formato usado en otras partes del proyecto).
 */
function task_safeTime(value) {
  if (value === null || value === undefined || value === "") return 0;

  if (value instanceof Date) {
    const t = value.getTime();
    return isNaN(t) ? 0 : t;
  }

  if (typeof value === "number") {
    return isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (s === "") return 0;

    // dd/MM/yyyy
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const y = Number(m[3]);
      const dt = new Date(y, mo - 1, d);
      const t = dt.getTime();
      return isNaN(t) ? 0 : t;
    }

    // Fallback: Date.parse (ISO u otros formatos)
    const parsed = Date.parse(s);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Objetos con getTime (p.ej. Date-like)
  if (typeof value === "object" && typeof value.getTime === "function") {
    try {
      const t = value.getTime();
      return isNaN(t) ? 0 : t;
    } catch (e) {
      return 0;
    }
  }

  return 0;
}

/**
 * Calcula el índice (0-based) donde debe insertarse la tarea finalizada (inserción "before")
 * dentro del array completo de tareas `rows` (tal como lo devuelve `getValues()` sobre la tabla).
 *
 * Firma solicitada:
 * - rows: array de filas (cada fila es un array 0-based)
 * - filaOrigenIdx: índice 0-based dentro de rows
 * - cols: contrato de columnas (TASK_COLUMNS). En esta fase se recibe para compatibilidad futura.
 *
 * Reproduce la lógica actual de `reubicarTareaFinalizada`:
 * - Recorre desde el final hacia arriba (sin evaluar el índice 0, igual que `while (indice > 0)`).
 * - Encuentra la primera fila donde:
 *   - NO esté "hecho", o
 *   - esté "hecho" y su fecha fin real sea mayor que la de la tarea origen
 * - Inserta antes de esa fila (equivalente a `filaDestino = indice + 3` en hoja).
 *
 * Si no se encuentra un punto de inserción, devuelve una posición válida: `rows.length` (append).
 */
function calcFilaDestinoFinalizadas(rows, filaOrigenIdx, cols) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const origen = rows[filaOrigenIdx];
  const fhOrigen = task_safeTime(task_getFechaFinReal(origen));

  let indice = rows.length - 1;
  let encontrado = false;
  let destinoInsertIdx = rows.length; // fallback válido (append)

  while (indice > 0 && !encontrado) {
    const fila = rows[indice];
    const esHecho = task_isHecho(fila);

    if (!esHecho) {
      // Caso: primera fila NO hecha desde abajo -> insertar antes de la siguiente (indice+1)
      destinoInsertIdx = indice + 1;
      encontrado = true;
    } else {
      const fhAnalisis = task_safeTime(task_getFechaFinReal(fila));
      if (fhAnalisis > fhOrigen) {
        // Caso: fila hecha con fecha fin real mayor que la de origen -> insertar antes de (indice+1)
        destinoInsertIdx = indice + 1;
        encontrado = true;
      } else {
        indice--;
      }
    }
  }

  return destinoInsertIdx;
}

