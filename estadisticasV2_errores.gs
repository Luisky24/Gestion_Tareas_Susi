/**
 * Gestión de errores para Estadísticas V2.
 * Mantiene nombres/firmas/lógica exactamente igual que en `f_estadisticasV2.js`.
 */

function registrarError(funcion, error) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let hojaErrores = ss.getSheetByName('Errores_Estadisticas');

    if (!hojaErrores) {
      hojaErrores = ss.insertSheet('Errores_Estadisticas');
      hojaErrores.appendRow(['Fecha', 'Función', 'Mensaje', 'Detalle']);
    }

    const fecha = new Date();
    hojaErrores.appendRow([
      fecha,
      funcion,
      error.message || 'Error sin mensaje',
      error.stack || ''
    ]);

    error(`❌ Error en ${funcion}: ${error.message}`);

  } catch (e) {
    Logger.log("Error al registrar error: " + e.message);
  }
}

