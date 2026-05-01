/**
 * Capa IO para Estadísticas V2.
 * Mantiene nombres/firmas/lógica exactamente igual que en `f_estadisticas_flujo.js`.
 *
 * IMPORTANTE:
 * - NO declara variables globales del módulo (libro, hoja, tareas, hechos, etc.).
 * - Depende de esas variables definidas en `f_estadisticas_flujo.js` (ámbito global de Apps Script).
 */

function obtenerDatosHoja(ctx, hojaBusqueda) {
  try {
    const hoja = ctx.libro.getSheetByName(hojaBusqueda);
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

function prepararHojaEstadisticas(ctx) {
  try {
    if (existeHoja(ctx)) {
      borrarHoja(ctx);
    }

    crearHoja(ctx, 3);
    ctx.hoja.getRange(1, 1, 1, ctx.cabeceras.length).setValues([ctx.cabeceras]);

    ctx.tareas = obtenerDatosHoja(ctx, "Tareas");
    ctx.hechos = obtenerDatosHoja(ctx, "Hecho");

  } catch (error) {
    registrarError("prepararHojaEstadisticas", error);
    throw error; // detiene proceso si falla esta parte crítica
  }
}

function grabarEnHjEstadisticas(ctx, valores) {
  try {
    if (!ctx.hoja) throw new Error('No existe la hoja "Estadísticas"');

    if (valores.length > 0) {
      ctx.hoja.getRange(2, 1, valores.length, valores[0].length).setValues(valores);
    } else {
      throw new Error('No hay valores para escribir.');
    }

  } catch (error) {
    registrarError("grabarEnHjEstadisticas", error);
  }
}

function existeHoja(ctx) {
  return ctx.hoja !== null;
}

function borrarHoja(ctx) {
  try {
    ctx.libro.deleteSheet(ctx.hoja);
  } catch (error) {
    registrarError("borrarHoja", error);
  }
}

function crearHoja(ctx, posicionLibro) {
  try {
    ctx.libro.insertSheet(ctx.nombreHoja, posicionLibro);
    ctx.hoja = ctx.libro.getSheetByName(ctx.nombreHoja);
  } catch (error) {
    registrarError("crearHoja", error);
  }
}

