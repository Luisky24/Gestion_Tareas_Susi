/**
 * Vista y utilidades de presentación para la hoja `Estadisticas`.
 *
 * NO modifica el motor V2 ni recalcula métricas.
 *
 * ---------------------------------------------------------------------------
 * BOTONES DE ORDEN EN LA HOJA (configuración manual del usuario)
 * ---------------------------------------------------------------------------
 * Google Sheets no permite crear desde Apps Script imágenes/dibujos con script
 * asignado. Para ordenar desde la propia hoja:
 *
 * 1. Insertar → Imagen (o Dibujo), colocarlo donde prefieras en la hoja.
 * 2. Clic en la imagen → menú ⋮ → Asignar script.
 * 3. Para orden ascendente (año + semana):  ordenarEstadisticasAsc
 *    Para orden descendente:                 ordenarEstadisticasDesc
 *
 * Tras ordenar, se reaplica la presentación de cabeceras y columna G (oculta).
 */

const _EST_VISTA_HOJA = 'Estadisticas';
const _EST_VISTA_COL_A = 1;
const _EST_VISTA_COL_G = 7;

/** Si es true, tras ordenar se escribe en A1 el modo activo (vuelve a "Año" al regenerar estadísticas V2). */
const _EST_VISTA_ACTUALIZAR_A1_CON_ORDEN = true;

/** Índices 0-based dentro de filas A:G */
const _EST_VISTA_IDX = { ANO: 0, SEMANA: 1, NUEVAS: 2, ABIERTAS: 3, CERRADAS: 4, HIST: 5, LABEL: 6 };

const _GRAFICA_CFG_KEY = 'GRAFICA_ESTADISTICAS_CFG';
const _GRAFICA_RANGOS_VALIDOS = ['todas', '52', '26', '13', '8'];

/** Última vista del modal combinado dashboard/gráfico (UserProperties). */
const _VISTA_KEY = 'ESTADISTICAS_VISTA';

function getVistaEstadisticas_() {
  const v = PropertiesService.getUserProperties().getProperty(_VISTA_KEY);
  return v === 'grafico' ? 'grafico' : 'dashboard';
}

function setVistaEstadisticas_(vista) {
  const v = vista === 'grafico' ? 'grafico' : 'dashboard';
  PropertiesService.getUserProperties().setProperty(_VISTA_KEY, v);
}

/** Wrappers públicos para `google.script.run` (las funciones con `_` no son invocables desde el cliente). */
function getVistaEstadisticas() {
  return getVistaEstadisticas_();
}

function setVistaEstadisticas(vista) {
  return setVistaEstadisticas_(vista);
}

/**
 * Normaliza tipos, rangos permitidos y al menos una serie activa.
 */
function _sanitizarCfg_(cfg) {
  const rawRango =
    cfg && cfg.rangoSemanas != null && cfg.rangoSemanas !== '' ? String(cfg.rangoSemanas) : 'todas';
  const rangoOk =
    _GRAFICA_RANGOS_VALIDOS.indexOf(rawRango) !== -1 ? rawRango : 'todas';

  const out = {
    seriesNuevas: !!(cfg && cfg.seriesNuevas),
    seriesAbiertas: !!(cfg && cfg.seriesAbiertas),
    seriesCerradas: !!(cfg && cfg.seriesCerradas),
    seriesHistorico: !!(cfg && cfg.seriesHistorico),
    rangoSemanas: rangoOk,
  };

  if (!out.seriesNuevas && !out.seriesAbiertas && !out.seriesCerradas && !out.seriesHistorico) {
    out.seriesNuevas = true;
  }

  return out;
}

/** Preferencias del gráfico HTML por usuario (modal Estadísticas). */
function getGraficaConfig_() {
  const defaults = {
    seriesNuevas: true,
    seriesAbiertas: true,
    seriesCerradas: true,
    seriesHistorico: true,
    rangoSemanas: 'todas',
  };
  try {
    const raw = PropertiesService.getUserProperties().getProperty(_GRAFICA_CFG_KEY);
    if (!raw) return _sanitizarCfg_(defaults);
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return _sanitizarCfg_(defaults);
    return _sanitizarCfg_(Object.assign({}, defaults, parsed));
  } catch (e) {
    return _sanitizarCfg_(defaults);
  }
}

function setGraficaConfig_(cfg) {
  PropertiesService.getUserProperties().setProperty(_GRAFICA_CFG_KEY, JSON.stringify(cfg));
}

/**
 * Elimina preferencias guardadas y devuelve la configuración por defecto (sanitizada).
 */
function resetGraficaConfig_() {
  PropertiesService.getUserProperties().deleteProperty(_GRAFICA_CFG_KEY);
  return getGraficaConfig_();
}

/** Expuesto a `google.script.run` (el cliente no puede llamar a `resetGraficaConfig_`). */
function resetGraficaConfig() {
  return resetGraficaConfig_();
}

/**
 * Persistencia desde HtmlService; fusiona, sanitiza y garantiza al menos una serie visible.
 */
function guardarGraficaEstadisticasConfig(configParcial) {
  const merged = _sanitizarCfg_(Object.assign({}, getGraficaConfig_(), configParcial || {}));
  setGraficaConfig_(merged);
  return merged;
}

/**
 * Ordena filas de datos (2..lastRow, A:G) por año y semana ascendente y refresca el gráfico embebido.
 */
function ordenarEstadisticasAsc() {
  _ordenarFilasEstadisticas_(true);
}

/**
 * Ordena filas de datos por año y semana descendente.
 */
function ordenarEstadisticasDesc() {
  _ordenarFilasEstadisticas_(false);
}

function _ordenarFilasEstadisticas_(ascendente) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(_EST_VISTA_HOJA);
  if (!hoja) {
    ss.toast('No existe la hoja Estadisticas.', 'Estadísticas', 6);
    return;
  }

  const lastRow = hoja.getLastRow();
  if (lastRow <= 1) {
    ss.toast('No hay datos para ordenar (solo cabecera o hoja vacía).', 'Estadísticas', 6);
    return;
  }

  const range = hoja.getRange(2, _EST_VISTA_COL_A, lastRow, _EST_VISTA_COL_G);
  const values = range.getValues();

  values.sort((a, b) => {
    const ay = Number(a[_EST_VISTA_IDX.ANO]);
    const am = Number(a[_EST_VISTA_IDX.SEMANA]);
    const by = Number(b[_EST_VISTA_IDX.ANO]);
    const bm = Number(b[_EST_VISTA_IDX.SEMANA]);
    if (ay !== by) return ascendente ? ay - by : by - ay;
    return ascendente ? am - bm : bm - am;
  });

  range.setValues(values);

  if (_EST_VISTA_ACTUALIZAR_A1_CON_ORDEN) {
    hoja.getRange(1, 1).setValue(ascendente ? 'Año · ASC' : 'Año · DESC');
  }

  aplicarPresentacionCabecerasYColumnaEstadisticas_(hoja);

  ss.toast(
    ascendente ? 'Orden aplicado: ascendente (año + semana).' : 'Orden aplicado: descendente (año + semana).',
    'Estadísticas',
    5
  );
}

/**
 * Datos para la vista HTML del gráfico: etiqueta de semana + 4 métricas por fila.
 * Orden SIEMPRE ascendente por año + semana (independiente del orden en hoja).
 *
 * @returns {{ rows: [string, number, number, number, number][] }}
 */
function obtenerDatosGraficaEstadisticas() {
  const cfg = getGraficaConfig_();

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(_EST_VISTA_HOJA);
  if (!sh || sh.getLastRow() <= 1) {
    return { rows: [], config: cfg };
  }

  const lastRow = sh.getLastRow();
  const values = sh.getRange(2, _EST_VISTA_COL_A, lastRow, _EST_VISTA_COL_G).getValues();

  values.sort((a, b) => {
    const ay = Number(a[_EST_VISTA_IDX.ANO]);
    const am = Number(a[_EST_VISTA_IDX.SEMANA]);
    const by = Number(b[_EST_VISTA_IDX.ANO]);
    const bm = Number(b[_EST_VISTA_IDX.SEMANA]);
    if (ay !== by) return ay - by;
    return am - bm;
  });

  const rows = values.map((r) => {
    const lab = r[_EST_VISTA_IDX.LABEL];
    const label = lab != null && lab !== '' ? String(lab) : '';
    return [
      label,
      Number(r[_EST_VISTA_IDX.NUEVAS]) || 0,
      Number(r[_EST_VISTA_IDX.ABIERTAS]) || 0,
      Number(r[_EST_VISTA_IDX.CERRADAS]) || 0,
      Number(r[_EST_VISTA_IDX.HIST]) || 0,
    ];
  });

  return { rows: rows, config: cfg };
}

/**
 * Abre un modal con Google Charts (líneas) alimentado por `obtenerDatosGraficaEstadisticas`.
 */
function mostrarGraficaEstadisticas() {
  const html = HtmlService.createHtmlOutputFromFile('grafica_estadisticas')
    .setWidth(920)
    .setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, 'Evolución semanal (Estadísticas)');
}

/**
 * Guía breve en modal (uso de métricas, alertas e interpretación).
 */
function mostrarManualEstadisticas() {
  const html = HtmlService.createHtmlOutputFromFile('manual_estadisticas')
    .setWidth(800)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Guía de estadísticas');
}
