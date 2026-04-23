// Observabilidad: logging estructurado, histórico y métricas.
// Diseñado para ser desacoplado: no depende de validaciones específicas.

const LOGS_BUFFER = [];

// Métricas operativas (en memoria por ejecución).
const METRICAS = {
  validaciones: 0,
  errores: 0,
  warnings: 0,
  autoreparaciones: 0,
  logsPersistidos: 0,
};

const CONFIG_OBSERVABILIDAD = {
  // Entorno: en PROD se reduce ruido (especialmente INFO).
  entorno: 'PROD', // 'PROD' | 'DEBUG'
  // Control de ruido: si true, se registran solo eventos de error/alto impacto.
  soloErrores: false,
  // Rotación: máximo de filas de datos (sin cabecera) a conservar en Logs_Sistema.
  maxFilasLogs: 5000,
  // Buffer: límite de eventos en memoria antes de auto-flush.
  maxBuffer: 200,
  // Auto-flush al superar maxBuffer (no activo si no hay Spreadsheet disponible).
  autoFlushBuffer: true,
  // Hook de crítico (preparado; no activar por defecto).
  activarHookCritico: false,
};

// ID por ejecución para trazabilidad (mismo valor durante toda la ejecución).
const RUN_ID = (function generarRunId() {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const rnd = Math.random().toString(36).slice(2, 10);
  return `run_${ts}_${rnd}`;
})();

function logEvento(tipo, mensaje, contexto = {}, opciones = {}) {
  // Compatibilidad: si se pasa un string como 4º parámetro, se interpreta como nivel.
  if (typeof opciones === 'string') {
    opciones = { nivel: opciones };
  }

  const nivel = String(opciones?.nivel || inferirNivel(tipo)).toUpperCase();

  const evento = {
    timestamp: new Date().toISOString(),
    runId: RUN_ID,
    tipo: String(tipo || 'INFO'),
    nivel,
    mensaje: String(mensaje || ''),
    contexto: contexto && typeof contexto === 'object' ? limitarContexto(contexto) : {},
  };

  const soloErrores = (opciones?.soloErrores === true) || CONFIG_OBSERVABILIDAD.soloErrores === true;
  if (debeLoggearPorEntorno(evento) && (!soloErrores || debeLoggearEnSoloErrores(evento))) {
    Logger.log(JSON.stringify(evento));
    LOGS_BUFFER.push(evento);
  }

  // Acción para CRITICO (hook preparado, no activo por defecto).
  if (evento.nivel === 'CRITICO') {
    gestionarEventoCritico(evento);
  }

  // Control de tamaño de buffer: auto-flush al superar el límite.
  if (CONFIG_OBSERVABILIDAD.autoFlushBuffer && LOGS_BUFFER.length > CONFIG_OBSERVABILIDAD.maxBuffer) {
    try {
      flushLogsSheet();
    } catch (e) {
      // No romper ejecución por fallos de flush.
    }
  }

  return evento;
}

function registrarLogSheet(evento) {
  // Inserta un evento (ya estructurado) en el buffer; persistencia se hace vía flush.
  LOGS_BUFFER.push(evento);
}

function flushLogsSheet() {
  if (LOGS_BUFFER.length === 0) return 0;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName('Logs_Sistema');
  if (!hoja) {
    hoja = ss.insertSheet('Logs_Sistema');
    hoja.appendRow(['Timestamp', 'Tipo', 'Mensaje', 'Contexto(JSON)']);
  }

  const filas = LOGS_BUFFER.splice(0, LOGS_BUFFER.length).map(ev => ([
    ev.timestamp || new Date().toISOString(),
    ev.tipo || '',
    ev.mensaje || '',
    JSON.stringify(ev.contexto || {}),
  ]));

  if (filas.length > 0) {
    hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, 4).setValues(filas);
    METRICAS.logsPersistidos += filas.length;
  }

  // Persistencia de métricas (snapshot) tras flush.
  persistirMetricasSnapshot();

  // Rotación de logs tras flush.
  limpiarLogsAntiguos(CONFIG_OBSERVABILIDAD.maxFilasLogs);

  return filas.length;
}

function obtenerMetricas() {
  return {
    validaciones: METRICAS.validaciones,
    errores: METRICAS.errores,
    warnings: METRICAS.warnings,
    autoreparaciones: METRICAS.autoreparaciones,
    logsPersistidos: METRICAS.logsPersistidos,
  };
}

function persistirMetricasSnapshot() {
  try {
    const props = PropertiesService.getScriptProperties();
    // Snapshot compacto: sin estructuras grandes.
    props.setProperty('METRICAS_SNAPSHOT_LAST', JSON.stringify({
      timestamp: new Date().toISOString(),
      runId: RUN_ID,
      metricas: {
        validaciones: METRICAS.validaciones,
        errores: METRICAS.errores,
        warnings: METRICAS.warnings,
        autoreparaciones: METRICAS.autoreparaciones,
        logsPersistidos: METRICAS.logsPersistidos,
      },
    }));
  } catch (e) {
    // No romper ejecución por fallos de PropertiesService.
  }
}

function limpiarLogsAntiguos(maxFilas) {
  try {
    const limite = typeof maxFilas === 'number' && maxFilas > 0 ? Math.floor(maxFilas) : CONFIG_OBSERVABILIDAD.maxFilasLogs;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName('Logs_Sistema');
    if (!hoja) return 0;

    const lastRow = hoja.getLastRow();
    const filasDatos = Math.max(0, lastRow - 1); // sin cabecera
    if (filasDatos <= limite) return 0;

    const exceso = filasDatos - limite;
    // Borrar las filas más antiguas (desde fila 2).
    hoja.deleteRows(2, exceso);
    return exceso;
  } catch (e) {
    return 0;
  }
}

function limitarContexto(ctx) {
  // Evita contextos enormes o con objetos complejos.
  const out = {};
  const keys = Object.keys(ctx).slice(0, 30);
  for (const k of keys) {
    const v = ctx[k];
    if (v === null || v === undefined) continue;

    if (typeof v === 'string') {
      out[k] = v.length > 300 ? `${v.slice(0, 300)}…` : v;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else if (v instanceof Date) {
      out[k] = v.toISOString();
    } else {
      // No serializar estructuras complejas: dejar pista.
      out[k] = `[${Object.prototype.toString.call(v)}]`;
    }
  }
  return out;
}

function inferirNivel(tipo) {
  const t = String(tipo || '').toUpperCase();
  if (t === 'ERROR') return 'ALTO';
  if (t === 'VALIDACION') return 'ALTO';
  if (t === 'WARNING') return 'MEDIO';
  return 'BAJO';
}

function debeLoggearEnSoloErrores(evento) {
  const tipo = String(evento?.tipo || '').toUpperCase();
  const nivel = String(evento?.nivel || '').toUpperCase();
  if (tipo === 'ERROR' || tipo === 'VALIDACION') return true;
  if (nivel === 'CRITICO' || nivel === 'ALTO') return true;
  return false;
}

function debeLoggearPorEntorno(evento) {
  const entorno = String(CONFIG_OBSERVABILIDAD.entorno || 'PROD').toUpperCase();
  if (entorno === 'DEBUG') return true;

  // PROD: reducir ruido. Mantener WARNING/ERROR/VALIDACION y niveles ALTO/CRITICO.
  const tipo = String(evento?.tipo || '').toUpperCase();
  const nivel = String(evento?.nivel || '').toUpperCase();
  if (tipo === 'ERROR' || tipo === 'VALIDACION' || tipo === 'WARNING') return true;
  if (nivel === 'CRITICO' || nivel === 'ALTO') return true;
  return false;
}

function gestionarEventoCritico(evento) {
  // Hook preparado (no activo por defecto). Permite extender con alertas (email, etc.).
  if (!CONFIG_OBSERVABILIDAD.activarHookCritico) return;
  // Implementación vacía intencional para no cambiar comportamiento funcional.
  // Punto de extensión: notificaciones, escalado, etc.
}

