/**
 * Exporta datos de hojas legacy y V3 a JSON para análisis comparativo.
 * Solo lectura: no escribe en hojas ni modifica datos.
 */
function exportarDatosComparacionEstadisticas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  /**
   * Lee una hoja y la convierte a array de registros (objetos) usando la 1ª fila como cabecera.
   * Si la hoja no existe o está vacía, devuelve [].
   *
   * @param {string} sheetName
   * @returns {Object[]}
   */
  const sheetToRecords = (sheetName) => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return [];

    const values = sh.getDataRange().getValues();
    if (!Array.isArray(values) || values.length === 0) return [];

    const headers = Array.isArray(values[0]) ? values[0] : [];
    if (headers.length === 0) return [];

    const out = [];
    for (let r = 1; r < values.length; r++) {
      const row = Array.isArray(values[r]) ? values[r] : [];
      const obj = {};

      for (let c = 0; c < headers.length; c++) {
        const rawKey = headers[c];
        const key = rawKey === null || rawKey === undefined ? "" : String(rawKey).trim();
        if (!key) continue;
        obj[key] = row[c];
      }

      out.push(obj);
    }

    return out;
  };

  const datos = {
    estadisticasV2: sheetToRecords("Estadisticas"),
    estadisticasV3: sheetToRecords("Estadisticas V3"),
    resumenV1: sheetToRecords("Resumen Semanal"),
    resumenV3: sheetToRecords("Resumen Semanal V3"),
  };

  Logger.log(JSON.stringify(datos));
  return datos;
}

