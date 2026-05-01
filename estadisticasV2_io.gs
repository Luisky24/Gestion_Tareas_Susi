/**
 * Capa IO para Estadísticas V2.
 * Mantiene nombres/firmas/lógica exactamente igual que en `f_estadisticas_flujo.js`.
 *
 * IMPORTANTE:
 * - NO declara variables globales del módulo (libro, hoja, tareas, hechos, etc.).
 * - Depende de esas variables definidas en `f_estadisticas_flujo.js` (ámbito global de Apps Script).
 */

function obtenerDatosHoja(hojaBusqueda) {
  try {
    const hoja = libro.getSheetByName(hojaBusqueda);
    if (!hoja) throw new Error(`No existe la hoja "${hojaBusqueda}"`);

    const numFilas = hoja.getLastRow();
    if (numFilas <= 1) return []; // solo cabecera

    const numColumnas = hoja.getLastColumn();
    const rango = hoja.getRange(2, 1, numFilas - 1, numColumnas);
    return rango.getDisplayValues();

  } catch (error) {
    registrarError("obtenerDatosHoja", error);
    return [];
  }
}

function prepararHojaEstadisticas() {
  try {
    if (existeHoja()) {
      borrarHoja();
    }

    crearHoja(3);
    hoja.getRange(1, 1, 1, cabeceras.length).setValues([cabeceras]);

    tareas = obtenerDatosHoja("Tareas");
    hechos = obtenerDatosHoja("Hecho");

  } catch (error) {
    registrarError("prepararHojaEstadisticas", error);
    throw error; // detiene proceso si falla esta parte crítica
  }
}

function grabarEnHjEstadisticas(valores) {
  try {
    if (!hoja) throw new Error('No existe la hoja "Estadísticas"');

    if (valores.length > 0) {
      hoja.getRange(2, 1, valores.length, valores[0].length).setValues(valores);
    } else {
      throw new Error('No hay valores para escribir.');
    }

  } catch (error) {
    registrarError("grabarEnHjEstadisticas", error);
  }
}

function existeHoja() {
  //const hoja = libro.getSheetByName(nombreHoja);
  return hoja !== null;
}

function borrarHoja() {
  try {
    libro.deleteSheet(hoja);
  } catch (error) {
    registrarError("borrarHoja", error);
  }
}

function crearHoja(posicionLibro) {
  try {
    libro.insertSheet(nombreHoja, posicionLibro);
    hoja = libro.getSheetByName(nombreHoja);
  } catch (error) {
    registrarError("crearHoja", error);
  }
}

