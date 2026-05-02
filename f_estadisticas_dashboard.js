/**
 * Dashboard de estadísticas en modal (solo lectura).
 * No modifica el motor V2 ni ejecuta/duplica la lógica de análisis.
 */

const _EST_DASH_HOJA_STATS = 'Estadisticas';

/** Índices 0-based columnas A:G (misma convención que f_estadisticas_vista.js) */
const _EST_DASH_IDX = { ANO: 0, SEMANA: 1, NUEVAS: 2, ABIERTAS: 3, CERRADAS: 4, HIST: 5, LABEL: 6 };

/** ScriptProperties: fecha yyyy-MM-dd del último envío de alerta proactiva (anti-spam diario). */
const _EST_DASH_PROP_ULTIMA_ALERTA_FECHA = 'ULTIMA_ALERTA_FECHA';

/** ScriptProperties: último mensaje de toast mostrado (evita repetición). */
const _EST_DASH_PROP_ULTIMO_TOAST = 'ULTIMO_TOAST';

function _estDashOrdenarFilasStatsAsc_(values) {
  const copia = values.slice();
  copia.sort((a, b) => {
    const ay = Number(a[_EST_DASH_IDX.ANO]);
    const am = Number(a[_EST_DASH_IDX.SEMANA]);
    const by = Number(b[_EST_DASH_IDX.ANO]);
    const bm = Number(b[_EST_DASH_IDX.SEMANA]);
    if (ay !== by) return ay - by;
    return am - bm;
  });
  return copia;
}

/**
 * Etiqueta «Semana (Año)» (columna G) o fallback WW/AAAA desde ISO.
 */
function _estDashEtiquetaSemana_(row) {
  const lab = row[_EST_DASH_IDX.LABEL];
  if (lab != null && String(lab).trim() !== '') return String(lab).trim();
  const ano = Number(row[_EST_DASH_IDX.ANO]) || 0;
  const sem = Number(row[_EST_DASH_IDX.SEMANA]) || 0;
  return String(sem).padStart(2, '0') + '/' + ano;
}

/**
 * KPIs de la última semana en sentido cronológico (última fila tras ordenar ISO).
 */
function _estDashLeerKpisUltimaSemana_(sh) {
  const vacio = { nuevas: 0, cerradas: 0, backlog: 0, semana: '' };
  if (!sh || sh.getLastRow() <= 1) return vacio;

  const lastRow = sh.getLastRow();
  const values = sh.getRange(2, 1, lastRow, 7).getValues();
  const ordenadas = _estDashOrdenarFilasStatsAsc_(values);
  if (!ordenadas.length) return vacio;

  const ult = ordenadas[ordenadas.length - 1];
  return {
    nuevas: Number(ult[_EST_DASH_IDX.NUEVAS]) || 0,
    cerradas: Number(ult[_EST_DASH_IDX.CERRADAS]) || 0,
    backlog: Number(ult[_EST_DASH_IDX.HIST]) || 0,
    semana: _estDashEtiquetaSemana_(ult),
  };
}

/**
 * Filas al formato de `obtenerDatosGraficaEstadisticas`: [label, nuevas, abiertasAct, cerradas, hist].
 * Orden cronológico ascendente.
 */
const _EST_DASH_ROW_GRAF_NUEVAS = 1;
const _EST_DASH_ROW_GRAF_CERRADAS = 3;
const _EST_DASH_ROW_GRAF_HIST = 4;

/**
 * Tendencia de la última semana vs media de las 4 anteriores (mismo formato que `grafica.rows`).
 * @param {Array[]} rows
 * @param {number} index Índice de columna en cada fila (p. ej. nuevas=1, cerradas=3, hist=4).
 * @returns {{ valor: number, variacion: number, direccion: string }}
 */
function _calcularTendencia_(rows, index) {
  if (!rows || rows.length < 5) {
    return { valor: 0, variacion: 0, direccion: '→' };
  }

  const ultimas = rows.slice(-5);
  const ultima = Number(ultimas[4][index]) || 0;
  const anteriores = ultimas.slice(0, 4);

  let sum = 0;
  for (let i = 0; i < anteriores.length; i++) {
    sum += Number(anteriores[i][index]) || 0;
  }
  const media = sum / 4;

  if (media === 0) {
    return { valor: ultima, variacion: 0, direccion: '→' };
  }

  const variacion = Math.round(((ultima - media) / media) * 100);

  let direccion = '→';
  if (variacion > 5) direccion = '↑';
  if (variacion < -5) direccion = '↓';

  return {
    valor: ultima,
    variacion: variacion,
    direccion: direccion,
  };
}

/**
 * Proyección naive próxima semana: último valor + (último − media de los 4 anteriores).
 * @param {Array[]} rows Filas `grafica.rows`
 * @param {number} index Columna numérica en cada fila
 * @returns {number|null} Entero ≥ 0 o null si no hay ≥ 5 semanas
 */
function _predecirValor_(rows, index) {
  if (!rows || rows.length < 5) return null;

  const ultimas = rows.slice(-5);
  const ultima = Number(ultimas[4][index]) || 0;
  const anteriores = ultimas.slice(0, 4);

  let sum = 0;
  for (let i = 0; i < anteriores.length; i++) {
    sum += Number(anteriores[i][index]) || 0;
  }
  const media = sum / 4;

  const delta = ultima - media;
  const prediccion = Math.round(ultima + delta);
  return Math.max(prediccion, 0);
}

/**
 * Mensaje corto según evolución esperada del backlog (histórico).
 */
function _evaluarPrediccion_(predHistorico, actualHistorico) {
  const pred = Number(predHistorico);
  const act = Number(actualHistorico);
  if (pred > act) {
    return 'El backlog seguirá creciendo';
  }
  if (pred < act) {
    return 'El backlog podría reducirse';
  }
  return 'El sistema se mantendrá estable';
}

/**
 * Insights locales sobre las últimas semanas (solo lectura de `rows`; sin motor V2).
 * @param {Array[]} rows
 * @returns {{ tipo: string, texto: string, recomendacion: string, codigo: string }[]}
 */
function _generarInsights_(rows) {
  if (!rows || rows.length < 4) return [];

  const ult4 = rows.slice(-4);
  let sumN = 0;
  let sumC = 0;
  for (let i = 0; i < ult4.length; i++) {
    const row = ult4[i];
    const nuevas = Number(row[_EST_DASH_ROW_GRAF_NUEVAS]) || 0;
    const cerradas = Number(row[_EST_DASH_ROW_GRAF_CERRADAS]) || 0;
    sumN += nuevas;
    sumC += cerradas;
  }
  const mediaNuevas = sumN / 4;
  const mediaCerradas = sumC / 4;

  const ult = rows[rows.length - 1];
  const ultimaNuevas = Number(ult[_EST_DASH_ROW_GRAF_NUEVAS]) || 0;
  const ultimaCerradas = Number(ult[_EST_DASH_ROW_GRAF_CERRADAS]) || 0;

  const histUltimas3 = rows.slice(-3).map((row) => {
    const hist = Number(row[_EST_DASH_ROW_GRAF_HIST]) || 0;
    return hist;
  });

  /** @type {{ tipo: string, texto: string, recomendacion: string, codigo: string }[]} */
  const insights = [];

  if (ultimaNuevas > mediaNuevas * 1.3) {
    insights.push({
      tipo: 'alerta',
      texto: 'Las tareas nuevas han aumentado significativamente',
      recomendacion: 'Reducir entrada o aumentar capacidad de cierre',
      codigo: 'NUEVAS_ALTA',
    });
  }

  if (mediaCerradas > 0 && ultimaCerradas < mediaCerradas * 0.8) {
    insights.push({
      tipo: 'alerta',
      texto: 'Las tareas cerradas han disminuido',
      recomendacion: 'Identificar bloqueos y recuperar el ritmo de cierre esta semana',
      codigo: 'CIERRES_BAJOS',
    });
  }

  if (
    histUltimas3.length === 3 &&
    histUltimas3[2] > histUltimas3[1] &&
    histUltimas3[1] > histUltimas3[0]
  ) {
    insights.push({
      tipo: 'alerta',
      texto: 'El volumen de tareas pendientes está creciendo',
      recomendacion: 'Priorizar cierres y frenar nuevas entradas hasta estabilizar backlog',
      codigo: 'BACKLOG_CRECIENTE',
    });
  }

  return insights.slice(0, 3);
}

function _calcularScore_(insights) {
  let score = 100;
  const codigos = new Set(
    (insights || []).map(function (i) {
      return i && i.codigo ? i.codigo : null;
    }).filter(Boolean)
  );
  if (codigos.has('NUEVAS_ALTA')) score -= 20;
  if (codigos.has('CIERRES_BAJOS')) score -= 20;
  if (codigos.has('BACKLOG_CRECIENTE')) score -= 30;
  return Math.max(score, 0);
}

/** Desglose legible del score (una entrada por código activo, sin duplicados). */
function _generarScoreDetalle_(insights) {
  const codigos = new Set(
    (insights || []).map(function (i) {
      return i && i.codigo ? i.codigo : null;
    }).filter(Boolean)
  );
  const detalle = [];
  if (codigos.has('NUEVAS_ALTA')) detalle.push('-20 nuevas altas');
  if (codigos.has('CIERRES_BAJOS')) detalle.push('-20 cierres bajos');
  if (codigos.has('BACKLOG_CRECIENTE')) detalle.push('-30 backlog creciente');
  return detalle;
}

function _estadoDesdeScore_(score) {
  const n = Number(score);
  if (n < 50) return 'CRÍTICO';
  if (n < 80) return 'ALERTA';
  return 'OK';
}

function _generarRecomendacion_(insights) {
  if (!insights || !insights.length) {
    return 'Mantener el ritmo actual';
  }
  const codigos = new Set(
    insights.map(function (i) {
      return i && i.codigo ? i.codigo : null;
    }).filter(Boolean)
  );
  if (codigos.has('BACKLOG_CRECIENTE')) {
    return 'Priorizar cierres y frenar nuevas entradas hasta estabilizar backlog';
  }
  if (codigos.has('CIERRES_BAJOS')) {
    return 'Identificar bloqueos y recuperar el ritmo de cierre esta semana';
  }
  if (codigos.has('NUEVAS_ALTA')) {
    return 'Reducir entrada o aumentar capacidad de cierre';
  }
  return 'Analizar causa raíz y ajustar el plan en la próxima revisión';
}

function _estDashRangoEstado_(e) {
  const u = String(e || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (u.indexOf('CRITICO') !== -1) return 3;
  if (u.indexOf('ALERTA') !== -1) return 2;
  return 1;
}

/** Devuelve el estado más desfavorable (CRÍTICO &gt; ALERTA &gt; OK). */
function _estDashPeorEstado_(a, b) {
  return _estDashRangoEstado_(a) >= _estDashRangoEstado_(b) ? String(a || 'OK').trim() || 'OK' : String(b || 'OK').trim() || 'OK';
}

/** Tendencia del backlog (serie histórico en gráfica) según flecha de KPI. */
function _tendenciaGlobalDesdeBacklog_(tHistorico) {
  if (!tHistorico || typeof tHistorico !== 'object') return 'ESTABLE';
  const d = tHistorico.direccion;
  if (d === '↑') return 'CRECIENTE';
  if (d === '↓') return 'DECRECIENTE';
  return 'ESTABLE';
}

function _estDashNormalizarGrafica_(grafica) {
  const vacio = { rows: [], config: {} };
  if (!grafica || typeof grafica !== 'object') return vacio;
  const rows = Array.isArray(grafica.rows) ? grafica.rows : [];
  const config = grafica.config && typeof grafica.config === 'object' ? grafica.config : {};
  return { rows: rows, config: config };
}

/**
 * @returns {{
 *   estado: string,
 *   kpis: {
 *     nuevas: { valor: number, variacion: number, direccion: string },
 *     cerradas: { valor: number, variacion: number, direccion: string },
 *     historico: { valor: number, variacion: number, direccion: string },
 *     backlog: number,
 *     semana: string,
 *   },
 *   alertas: string[],
 *   insights: { tipo: string, texto: string, recomendacion: string, codigo?: string }[],
 *   score: number,
 *   scoreDetalle: string[],
 *   recomendacion: string,
 *   tendenciaGlobal: string,
 *   prediccion: {
 *     nuevas: number,
 *     cerradas: number,
 *     historico: number,
 *     mensaje: string,
 *     sentidoBacklog: 'sube' | 'baja' | 'estable'
 *   } | null,
 *   grafica: { rows: *, config: * }
 * }}
 */
function obtenerDatosDashboardEstadisticas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hStats = ss.getSheetByName(_EST_DASH_HOJA_STATS);
  const kpisRaw = _estDashLeerKpisUltimaSemana_(hStats);

  /** Estado base desde hoja de análisis eliminado; el dashboard usa score + insights. */
  const estado = 'OK';

  let grafica = null;
  try {
    grafica = obtenerDatosGraficaEstadisticas();
  } catch (err) {
    grafica = null;
  }

  const graficaSegura = _estDashNormalizarGrafica_(grafica);
  const rows = graficaSegura.rows;
  const insights = _generarInsights_(rows);

  const tNuevas = _calcularTendencia_(rows, _EST_DASH_ROW_GRAF_NUEVAS);
  const tCerradas = _calcularTendencia_(rows, _EST_DASH_ROW_GRAF_CERRADAS);
  const tHistorico = _calcularTendencia_(rows, _EST_DASH_ROW_GRAF_HIST);

  const kpisSeguros = {
    nuevas: tNuevas,
    cerradas: tCerradas,
    historico: tHistorico,
    backlog: kpisRaw && Number(kpisRaw.backlog) ? Number(kpisRaw.backlog) : 0,
    semana: kpisRaw && kpisRaw.semana != null ? String(kpisRaw.semana) : '',
  };
  const alertasSeguras = [];
  const insightsSeguros = Array.isArray(insights) ? insights : [];

  const score = _calcularScore_(insightsSeguros);
  const scoreDetalle = _generarScoreDetalle_(insightsSeguros);
  const estadoCalculado = _estadoDesdeScore_(score);
  const recomendacion = _generarRecomendacion_(insightsSeguros);
  const estadoPrevio = estado || 'OK';
  const estadoFinal = _estDashPeorEstado_(estadoPrevio, estadoCalculado);

  const tendenciaGlobal = _tendenciaGlobalDesdeBacklog_(tHistorico);

  const predNuevas = _predecirValor_(rows, _EST_DASH_ROW_GRAF_NUEVAS);
  const predCerradas = _predecirValor_(rows, _EST_DASH_ROW_GRAF_CERRADAS);
  const predHistorico = _predecirValor_(rows, _EST_DASH_ROW_GRAF_HIST);

  let prediccion = null;
  if (
    predNuevas != null &&
    predCerradas != null &&
    predHistorico != null &&
    rows &&
    rows.length > 0
  ) {
    const ult = rows[rows.length - 1];
    const actualHist = Number(ult[_EST_DASH_ROW_GRAF_HIST]) || 0;
    let sentidoBacklog = 'estable';
    if (predHistorico > actualHist) sentidoBacklog = 'sube';
    else if (predHistorico < actualHist) sentidoBacklog = 'baja';
    prediccion = {
      nuevas: predNuevas,
      cerradas: predCerradas,
      historico: predHistorico,
      mensaje: _evaluarPrediccion_(predHistorico, actualHist),
      sentidoBacklog: sentidoBacklog,
    };
  }

  return {
    estado: estadoFinal,
    kpis: kpisSeguros,
    alertas: alertasSeguras,
    insights: insightsSeguros,
    score: score,
    scoreDetalle: scoreDetalle,
    recomendacion: recomendacion,
    tendenciaGlobal: tendenciaGlobal,
    prediccion: prediccion,
    grafica: graficaSegura,
  };
}

function _estDashFechaLocalYyyyMmDd_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _estDashYaSeEnvioAlertaProactivaHoy_() {
  const ultima = PropertiesService.getScriptProperties().getProperty(_EST_DASH_PROP_ULTIMA_ALERTA_FECHA);
  return ultima === _estDashFechaLocalYyyyMmDd_();
}

function _estDashMarcarAlertaProactivaEnviadaHoy_() {
  PropertiesService.getScriptProperties().setProperty(
    _EST_DASH_PROP_ULTIMA_ALERTA_FECHA,
    _estDashFechaLocalYyyyMmDd_()
  );
}

/**
 * @param {*} data Salida de `obtenerDatosDashboardEstadisticas`.
 * @returns {{ tipo: string, mensaje: string }[]}
 */
function _detectarAlertasProactivas_(data) {
  const alertas = [];
  const insights = (data && data.insights) || [];
  const pred = (data && data.prediccion) || {};

  if (pred && pred.mensaje && String(pred.mensaje).toLowerCase().includes('creciendo')) {
    alertas.push({
      tipo: 'BACKLOG',
      mensaje: 'El backlog está aumentando y puede afectar al sistema',
    });
  }

  if (
    insights.some(function (i) {
      return i && i.codigo === 'NUEVAS_ALTA';
    })
  ) {
    alertas.push({
      tipo: 'NUEVAS',
      mensaje: 'Las tareas nuevas han aumentado significativamente',
    });
  }

  if (
    insights.some(function (i) {
      return i && i.codigo === 'CIERRES_BAJOS';
    })
  ) {
    alertas.push({
      tipo: 'CIERRES',
      mensaje: 'Las tareas cerradas han disminuido',
    });
  }

  return alertas;
}

function _generarEmailAlerta_(alertas, data) {
  if (!alertas || !alertas.length) return null;

  let cuerpo = '🚨 ALERTA DEL SISTEMA\n\n';

  alertas.forEach(function (a) {
    cuerpo += '- ' + a.mensaje + '\n';
  });

  const score = data && data.score != null ? data.score : '—';
  const rec = data && data.recomendacion != null ? String(data.recomendacion) : '';

  cuerpo += '\n📊 Score: ' + score + '/100';
  cuerpo += '\n👉 ' + rec;

  return {
    asunto: '🚨 Alerta sistema tareas',
    cuerpo: cuerpo,
  };
}

function _enviarEmailAlerta_(email, contenido) {
  if (!contenido || !email || !String(email).trim()) return;

  MailApp.sendEmail({
    to: String(email).trim(),
    subject: contenido.asunto,
    body: contenido.cuerpo,
  });
}

/**
 * Un único mensaje de feedback según score / insights (silencio si score > 90 sin insights).
 * @param {*} data Salida de `obtenerDatosDashboardEstadisticas`.
 * @returns {{ mensaje: string, duracion: number } | null}
 */
function _generarToastInteligente_(data) {
  if (!data) return null;

  const score = data.score != null ? Number(data.score) : 100;
  const insights = data.insights || [];

  if (score > 90 && insights.length === 0) {
    return null;
  }

  if (score < 50) {
    return {
      mensaje: '🔴 Sistema en estado crítico',
      duracion: 10,
    };
  }

  if (score < 80) {
    return {
      mensaje: '🟠 Atención: ' + (data.recomendacion || ''),
      duracion: 8,
    };
  }

  if (insights.length) {
    const t0 = insights[0] && insights[0].texto != null ? String(insights[0].texto) : '';
    return {
      mensaje: '💡 ' + t0,
      duracion: 5,
    };
  }

  return {
    mensaje: '🟢 Sistema estable',
    duracion: 4,
  };
}

function _mostrarToast_(toast) {
  if (!toast || !toast.mensaje) return;

  const props = PropertiesService.getScriptProperties();
  const ultimo = props.getProperty(_EST_DASH_PROP_ULTIMO_TOAST);
  if (ultimo === toast.mensaje) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast(toast.mensaje, 'Estado del sistema', toast.duracion != null ? toast.duracion : 5);

  props.setProperty(_EST_DASH_PROP_ULTIMO_TOAST, toast.mensaje);
}

function ejecutarToastInteligenteDashboardSiCorresponde() {
  try {
    const data = obtenerDatosDashboardEstadisticas();
    const toast = _generarToastInteligente_(data);
    _mostrarToast_(toast);
  } catch (e) {
    registrarError('ERROR_TOAST', e);
  }
}

/**
 * Envío opcional tras analítica: solo si hay alertas y no hubo envío hoy (PropertiesService).
 */
function ejecutarAlertasProactivasDashboardSiCorresponde() {
  try {
    if (_estDashYaSeEnvioAlertaProactivaHoy_()) return;

    const data = obtenerDatosDashboardEstadisticas();
    const alertas = _detectarAlertasProactivas_(data);
    const emailContenido = _generarEmailAlerta_(alertas, data);

    if (!emailContenido) return;

    const email = obtenerEmailNotificacion();
    _enviarEmailAlerta_(email, emailContenido);
    _estDashMarcarAlertaProactivaEnviadaHoy_();
  } catch (e) {
    registrarError('ERROR_ALERTAS_PROACTIVAS', e);
  }
}

function mostrarDashboardEstadisticas() {
  const html = HtmlService.createHtmlOutputFromFile('dashboard_estadisticas')
    .setWidth(940)
    .setHeight(780);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard de estadísticas');
}
