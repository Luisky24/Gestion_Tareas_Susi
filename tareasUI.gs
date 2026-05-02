/* Capa UI (presentación): colores y formato visual */
/* FASE MIGRACIÓN 1 */

// Función para convertir RGB a Hex
function rgbToHex(r, g, b) {
  const toHex = (c) => c.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Compatibilidad: se mantiene el nombre original usado por el código existente.
 * Implementación delegada al nuevo módulo `tasks_ui.gs`.
 */
function aplicarColorRango(rango, colorHex) {
  return ui_aplicarColorRango(rango, colorHex);
}

function aplicarColorNuevaTarea(rangoNuevaTarea, colorBase) {
  // Obtener los colores pijama para la tabla de tareas
  const colorHex_amarillo = rgbToHex(255, 255, 195);
  const colorHex_blanco = rgbToHex(255, 255, 255);

  if (colorBase != colorHex_amarillo) {
    rangoNuevaTarea.setBackground(colorHex_amarillo);
  } else {
    rangoNuevaTarea.setBackground(colorHex_blanco);
  }
}

function aplicarColorTareaFinalizada(rangoFilaTarea) {
  rangoFilaTarea.setBackground(rgbToHex(210, 210, 210));
}

function aplicarColorTareaReactivada(rango) {
  const colorHex_blanco = rgbToHex(255, 255, 195);
  rango.setBackground(colorHex_blanco);
}

function aplicarColorPijama(hoja) {
  let hj_actual = hoja;
  if (!hj_actual) return;

  let num_filas = hj_actual.getLastRow();
  let num_columnas = hj_actual.getLastColumn();
  if (num_filas < 2 || num_columnas < 1) return;

  const colorHex_amarillo = rgbToHex(255, 255, 195);
  const colorHex_blanco = rgbToHex(255, 255, 255);
  const colorHex_gris = rgbToHex(210, 210, 210);
  const colorHex_verde = rgbToHex(200, 230, 201);
  const colorHex_azul = rgbToHex(187, 222, 251);

  let rng_pijama = hj_actual.getRange(2, 1, num_filas - 1, num_columnas);
  let vl_pijama = rng_pijama.getValues();
  let colores = [];

  for (let i = 0; i < num_filas - 1; i++) {
    const row = vl_pijama[i];
    task_padRowToExpectedWidth(row);

    let color =
      i % 2 === 0 ? colorHex_blanco : colorHex_amarillo;

    if (task_isObjetivoMarcado(row)) {
      color = colorHex_verde;
    } else if (task_isHecho(row)) {
      color = colorHex_gris;
    } else if (task_estimadaMenorOIgualHoy(row)) {
      color = colorHex_azul;
    }

    colores.push(Array(num_columnas).fill(color));
  }

  rng_pijama.setBackgrounds(colores);
}

// Compatibilidad: se mantiene la firma original
function pijama() {
  let hj_actual = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  aplicarColorPijama(hj_actual);
}
