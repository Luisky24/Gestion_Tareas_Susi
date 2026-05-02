/**
 * Limpieza de hojas del antiguo flujo de análisis manual y ayuda en hoja.
 * El dashboard usa insights/score/predicción sobre Estadisticas; ya no se mantienen estas hojas.
 */

/**
 * Elimina Estadisticas_Ayuda y Estadisticas_Analisis si existen (una pasada idempotente).
 */
function eliminarHojasAnalisisManualLegacy_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nombres = ['Estadisticas_Ayuda', 'Estadisticas_Analisis'];
    for (let i = 0; i < nombres.length; i++) {
      const sh = ss.getSheetByName(nombres[i]);
      if (sh) ss.deleteSheet(sh);
    }
  } catch (e) {
    registrarError('eliminarHojasAnalisisManualLegacy_', e);
  }
}
