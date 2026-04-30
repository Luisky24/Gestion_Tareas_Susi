
/* Ordena tareas, primero por prioridad y despuues por fecha fin real
*/
function ordenarTareas(tblTareas, num_columnas) {
  return svc_ordenarTareas(tblTareas, num_columnas);
}

/* Reubica las tareas finalizadas
*/

function reubicarTareaFinalizada(hjActiva, numFilas, numColumnas, filaorigen) {
  /* FASE MIGRACIÓN 1 */

  /*Buscamos la fila donde se debe ubicar, las condiciones son las siguientes
  - Al final de la tabla de tareas junto con el resto de finalizadas y entre las que su fecha fi se encuentre
  */
  // Leemos solo lo necesario para calcular destino: ESTADO y FECHA_FIN_REAL.
  // Esto mantiene la lógica idéntica pero reduce datos transferidos desde la hoja.
  let numDataRows = numFilas - 1;
  let rngEstados = hjActiva.getRange(2, TASK_COLUMNS.ESTADO.col, numDataRows, 1);
  let vlEstados = rngEstados.getValues();
  let rngFhFinReal = hjActiva.getRange(2, numColumnas, numDataRows, 1);
  let vlFhFinReal = rngFhFinReal.getValues();

  // Construimos un "rows" mínimo compatible con los helpers del dominio.
  let valoresTablaTareas = [];
  for (let i = 0; i < numDataRows; i++) {
    let row = [];
    row[TASK_COLUMNS.ESTADO.idx] = vlEstados[i][0];
    row[TASK_COLUMNS.FECHA_FIN_REAL.idx] = vlFhFinReal[i][0];
    valoresTablaTareas.push(row);
  }

  // Color origen (compatibilidad: se conserva el comportamiento de copiar el background de la primera celda)
  let colorOrigen = hjActiva.getRange(filaorigen, 1).getBackground();


  /* Buscar la fila donde debe ser incrustada la tarea finalizada
  */
  // `valoresTablaTareas[0]` corresponde a la fila 2 de la hoja.
  // `filaorigen` es 1-based (Sheets) => índice 0-based dentro de `valoresTablaTareas`:
  let filaOrigenIdx = filaorigen - 2;

  // Calcular destino en dominio puro (0-based, inserción "before" en el array)
  let idxDestino = calcFilaDestinoFinalizadas(valoresTablaTareas, filaOrigenIdx, TASK_COLUMNS);

  // Validaciones / fallback seguro
  if (typeof idxDestino !== "number" || isNaN(idxDestino)) {
    idxDestino = valoresTablaTareas.length;
  }
  if (idxDestino < 0) idxDestino = 0;
  if (idxDestino > valoresTablaTareas.length) idxDestino = valoresTablaTareas.length;

  // Convertir índice 0-based a fila 1-based de Sheets (rows[0] == fila 2)
  let filaDestino = idxDestino + 2;

  // Si destino y origen coinciden, no hacemos nada
  if (filaDestino === filaorigen) return;

  /*
   * Movimiento de fila (operación estructural costosa) optimizado:
   * Sustituimos "insertRowBefore + setValues + deleteRow" por un único "moveRows".
   *
   * IMPORTANTE: para mantener el comportamiento exacto del flujo anterior (insertar y luego borrar),
   * ajustamos el destino cuando el origen está por encima del destino, ya que el borrado desplazaría
   * el destino una fila hacia arriba.
   */
  let filaDestinoFinal = filaDestino;
  if (filaorigen < filaDestino) {
    filaDestinoFinal = filaDestino - 1;
  }
  if (filaDestinoFinal === filaorigen) return;
  if (filaDestinoFinal < 2) filaDestinoFinal = 2;

  let rngFilaMover = hjActiva.getRange(filaorigen, 1, 1, numColumnas);
  hjActiva.moveRows(rngFilaMover, filaDestinoFinal);

  // Mantener la misma llamada de UI: aplicar color al rango destino
  let rngDestino = hjActiva.getRange(filaDestinoFinal, 1, 1, numColumnas);
  aplicarColorRango(rngDestino, colorOrigen);

}

