// Validaciones de modelo de datos y checks previos a ejecución.
// Reglas:
// - No muta datos (solo valida y lanza Error).
// - Mensajes siempre con prefijo "VALIDACION:" para diagnóstico operativo.

const CONFIG_MODELO = {
  VERSION: "1.0.0",
  TAREAS: {
    nombreHoja: 'Tareas',
    minColumnas: 7,
    columnas: {
      fechaAlta: 0,
      tarea: 1,
      prioridad: 2,
      estado: 4,
      fechaFinEstimada: 5,
      fechaFinReal: 'last',
    },
  },
  HECHO: {
    nombreHoja: 'Hecho',
    minColumnas: 7,
    columnas: {
      fechaAlta: 0,
      tarea: 1,
      prioridad: 2,
      estado: 4,
      fechaFinEstimada: 5,
      fechaFinReal: 'last',
    },
  },
};

function validarVersionModelo() {
  const props = PropertiesService.getScriptProperties();
  const key = 'CONFIG_MODELO_VERSION';
  const versionActual = CONFIG_MODELO?.VERSION ?? '';
  if (!versionActual) {
    // No romper ejecución si no hay versión definida.
    return;
  }

  const versionGuardada = props.getProperty(key);

  // Primera ejecución: persistir versión y continuar.
  if (!versionGuardada) {
    props.setProperty(key, versionActual);
    return;
  }

  // Cambio detectado: fail-fast controlado (no se invoca automáticamente).
  if (versionGuardada !== versionActual) {
    throw new Error("VALIDACION: cambio de modelo detectado");
  }
}

function validarEstructuraHoja(nombreHoja, config, opciones = {}) {
  const errores = [];
  const warnings = [];
  if (typeof METRICAS === 'object' && METRICAS) METRICAS.validaciones++;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) {
    throw new Error(`VALIDACION: no existe la hoja "${nombreHoja}"`);
  }

  const lastColumn = hoja.getLastColumn();
  if (typeof config?.minColumnas === 'number' && lastColumn < config.minColumnas) {
    errores.push(`Hoja "${nombreHoja}": tiene ${lastColumn} columnas, mínimo requerido ${config.minColumnas}`);
  }

  const columnas = config?.columnas ?? {};
  const idxFechaAlta = columnas.fechaAlta;
  const idxTarea = columnas.tarea;
  const idxPrioridad = columnas.prioridad;
  const idxEstado = columnas.estado;
  const idxFechaFinEst = columnas.fechaFinEstimada;
  const idxFechaFinReal = columnas.fechaFinReal === 'last' ? (lastColumn - 1) : columnas.fechaFinReal;

  // Hoja vacía/degenerada: solo cabecera.
  const lastRow = hoja.getLastRow();
  if (lastRow < 2) {
    errores.push("hoja sin datos (solo cabecera)");
  }

  const indices = {
    fechaAlta: idxFechaAlta,
    tarea: idxTarea,
    prioridad: idxPrioridad,
    estado: idxEstado,
    fechaFinEstimada: idxFechaFinEst,
    fechaFinReal: idxFechaFinReal,
  };

  for (const [k, v] of Object.entries(indices)) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      errores.push(`Hoja "${nombreHoja}": índice inválido para columna "${k}" en config`);
      continue;
    }
    if (v > (lastColumn - 1)) {
      errores.push(`Hoja "${nombreHoja}": columna "${k}" fuera de rango (idx ${v}, lastColumn=${lastColumn})`);
    }
  }

  // Validación explícita de columnas críticas reales (mensajes operativos específicos)
  if (typeof columnas.estado === 'number' && columnas.estado >= lastColumn) {
    errores.push("columna estado fuera de rango");
  }
  if (typeof columnas.fechaAlta === 'number' && columnas.fechaAlta >= lastColumn) {
    errores.push("columna fechaAlta fuera de rango");
  }
  if (typeof columnas.prioridad === 'number' && columnas.prioridad >= lastColumn) {
    errores.push("columna prioridad fuera de rango");
  }
  if (columnas.fechaFinReal === 'last' && lastColumn < 1) {
    errores.push("columna fechaFinReal='last' inválida (hoja sin columnas)");
  }

  // Validación de "columna relativa" usada en moverFinalizadas: estado se evalúa como (lastColumn - 3)
  // Se valida solo cuando config fija estado por índice (0-based).
  if (typeof idxEstado === 'number') {
    const idxEstadoRelativo = lastColumn - 3;
    if (idxEstadoRelativo !== idxEstado) {
      errores.push(
        `Hoja "${nombreHoja}": columna estado no coincide con posición relativa (lastColumn-3). ` +
        `idxEstadoConfig=${idxEstado}, idxEstadoRelativo=${idxEstadoRelativo}, lastColumn=${lastColumn}`
      );
    }
  }

  // Validación de modelo real: recorrer todas las filas (desde fila 2) y validar tipos/coherencia.
  if (lastRow >= 2) {
    const numFilasDatos = lastRow - 1;
    const data = hoja.getRange(2, 1, numFilasDatos, lastColumn).getValues();

    // Inyectar resolución de columnas relativas para validación de fila sin reestructurar config global.
    const configValidacionFila = {
      ...config,
      _lastColumn: lastColumn,
      columnas: {
        ...columnas,
        // Forzar índice resuelto para fechaFinReal en validación de filas (evita dependencia frágil).
        fechaFinReal: idxFechaFinReal,
      },
    };

    let hayReparaciones = false;

    for (let i = 0; i < data.length; i++) {
      try {
        validarFilaTarea(data[i], configValidacionFila, { fila: i + 2 });
      } catch (e) {
        // Auto-reparación (opt-in): por defecto mantiene fail-fast.
        if (opciones?.autoReparar) {
          const antes = construirSnapshotFila(data[i], configValidacionFila);
          const intento = intentarAutoreparacionFila(data[i], configValidacionFila);
          if (intento?.reparado) {
            data[i] = intento.fila;
            hayReparaciones = true;
            if (typeof METRICAS === 'object' && METRICAS) METRICAS.autoreparaciones++;
            warnings.push(`Fila ${i + 2}: auto-reparación aplicada (${(intento.cambios || []).join(', ')})`);
            if (typeof logEvento === 'function') {
              const despues = construirSnapshotFila(data[i], configValidacionFila);
              logEvento('WARNING', 'Auto-reparación aplicada', {
                hoja: nombreHoja,
                fila: i + 2,
                autoreparado: true,
                cambios: intento.cambios,
                antes,
                despues,
              });
            }

            // Revalidar tras reparar
            try {
              validarFilaTarea(data[i], configValidacionFila, { fila: i + 2 });
              continue;
            } catch (e2) {
              const msg2 = (e2 && e2.message) ? e2.message : String(e2);
              errores.push(`Fila ${i + 2}: ${msg2.replace(/^VALIDACION:\s*/,'')}`);
              if (typeof METRICAS === 'object' && METRICAS) METRICAS.errores++;
              if (typeof logEvento === 'function') {
                logEvento('ERROR', 'Validación fallida tras auto-reparación', { hoja: nombreHoja, fila: i + 2 });
              }
              continue;
            }
          }
        }

        const msg = (e && e.message) ? e.message : String(e);
        errores.push(`Fila ${i + 2}: ${msg.replace(/^VALIDACION:\s*/,'')}`);
        if (typeof METRICAS === 'object' && METRICAS) METRICAS.errores++;
        if (typeof logEvento === 'function') {
          logEvento('ERROR', 'Validación de fila fallida', { hoja: nombreHoja, fila: i + 2 });
        }
      }
    }

    // Persistencia batched (opt-in) para no escribir en sheet en cada fila.
    if (opciones?.persistirReparacion && hayReparaciones) {
      hoja.getRange(2, 1, numFilasDatos, lastColumn).setValues(data);
    }
  }

  if (errores.length > 0) {
    if (opciones?.modoDiagnostico) {
      // Compatibilidad: en modo diagnóstico se mantiene retorno array de errores.
      // Si se solicitan warnings explícitamente, devolver objeto.
      if (opciones?.devolverWarnings) {
        return { errores, warnings };
      }
      return errores;
    }
    throw new Error(`VALIDACION:\n${errores.join('\n')}`);
  }

  if (warnings.length > 0 && typeof METRICAS === 'object' && METRICAS) {
    METRICAS.warnings += warnings.length;
  }

  return { hoja, lastColumn, indices };
}

function construirSnapshotFila(fila, config) {
  try {
    const columnas = config?.columnas ?? {};
    const lastCol = config?._lastColumn;
    const idxFin = typeof columnas.fechaFinReal === 'number'
      ? columnas.fechaFinReal
      : (typeof lastCol === 'number' ? (lastCol - 1) : null);

    const snap = {
      fechaAlta: fila?.[columnas.fechaAlta],
      tarea: fila?.[columnas.tarea],
      prioridad: fila?.[columnas.prioridad],
      estado: fila?.[columnas.estado],
      fechaFinEstimada: fila?.[columnas.fechaFinEstimada],
      fechaFinReal: idxFin !== null ? fila?.[idxFin] : undefined,
    };

    // Limitar tamaño de strings para evitar ruido.
    if (typeof snap.tarea === 'string' && snap.tarea.length > 200) {
      snap.tarea = `${snap.tarea.slice(0, 200)}…`;
    }

    return snap;
  } catch (e) {
    return { error: 'snapshot_failed' };
  }
}

function validarFilaTarea(fila, config, ctx) {
  const columnas = config?.columnas ?? {};
  const filaN = ctx?.fila;
  const tareaTxt = (fila && fila.length > 1 && fila[1] !== null && fila[1] !== undefined) ? String(fila[1]) : "";
  const sufijoCtx = (filaN ? ` | fila=${filaN}` : "") + (tareaTxt ? ` | tarea="${tareaTxt}"` : "");

  const idxFechaAlta = columnas.fechaAlta;
  const idxPrioridad = columnas.prioridad;
  const idxEstado = columnas.estado;
  const idxFechaFinEst = columnas.fechaFinEstimada;
  const idxFechaFinReal = columnas.fechaFinReal;

  // Fecha alta: Date o string dd/MM/yyyy parseable (si existe)
  const fechaAltaVal = fila[idxFechaAlta];
  const fechaAlta = (fechaAltaVal === '' || fechaAltaVal === null) ? null : normalizarFecha(fechaAltaVal);

  // Prioridad: debe ser número (se permite vacío/null para compatibilidad).
  const prio = fila[idxPrioridad];
  if (!(prio === '' || prio === null || typeof prio === 'number')) {
    throw new Error(`VALIDACION: prioridad no numérica${sufijoCtx}`);
  }

  // Estado: aceptar variantes y normalizar internamente a 'hecho'
  const estadoNorm = (fila[idxEstado] ?? '').toString().trim().toLowerCase();
  const estado = (estadoNorm === 'hecho') ? 'hecho' : '';
  if (!(estadoNorm === '' || estadoNorm === 'hecho')) {
    throw new Error(`VALIDACION: estado inválido (valor="${fila[idxEstado]}"). Esperado: 'hecho' o vacío${sufijoCtx}`);
  }

  // Fecha fin estimada: Date o string dd/MM/yyyy parseable o vacío
  const fhEst = fila[idxFechaFinEst];
  if (!(fhEst === '' || fhEst === null)) {
    normalizarFecha(fhEst);
  }

  // Fecha fin real: Date o vacío o string parseable
  // Nota: en el código actual `finalizarTarea()` escribe string dd/MM/yyyy; se acepta para no romper compatibilidad.
  const fhRealVal = (typeof idxFechaFinReal === 'number') ? fila[idxFechaFinReal] : null;
  const fechaFinReal = (fhRealVal === '' || fhRealVal === null || fhRealVal === undefined) ? null : normalizarFecha(fhRealVal);

  // Coherencia dataset: hecho => requiere fecha fin real; fecha fin real => requiere hecho
  if (estado === 'hecho' && !fechaFinReal) {
    throw new Error(`VALIDACION: estado 'hecho' sin fechaFinReal${sufijoCtx}`);
  }
  if (fechaFinReal && estado !== 'hecho') {
    throw new Error(`VALIDACION: fechaFinReal informada pero estado no es 'hecho'${sufijoCtx}`);
  }

  // Coherencia de fechas
  if (fechaFinReal && fechaAlta && fechaAlta.getTime() > fechaFinReal.getTime()) {
    throw new Error(`VALIDACION: fecha fin anterior a fecha alta${sufijoCtx}`);
  }
}

function validarAntesMoverFinalizadas() {
  const { hoja: hjTareas, lastColumn, indices } = validarEstructuraHoja(CONFIG_MODELO.TAREAS.nombreHoja, CONFIG_MODELO.TAREAS);
  validarEstructuraHoja(CONFIG_MODELO.HECHO.nombreHoja, CONFIG_MODELO.HECHO);

  const lastRow = hjTareas.getLastRow();
  if (lastRow < 2) {
    // No hay filas de datos; no es un fallo de estructura pero evitar ejecutar flujo que podría borrar filas inválidamente.
    throw new Error("VALIDACION: hoja \"Tareas\" no contiene filas de datos (solo cabecera). Nada que mover.");
  }

  const numFilasDatos = lastRow - 1;
  const valores = hjTareas.getRange(2, 1, numFilasDatos, lastColumn).getValues();

  const idxFechaAlta = indices.fechaAlta;
  const idxFechaFinReal = indices.fechaFinReal; // siempre resuelto a lastColumn-1
  const idxPrioridad = indices.prioridad;
  const colEstado = lastColumn - 3;

  let hayHecho = false;
  let filaInicalTareaMov = 0;

  for (let i = 0; i < valores.length; i++) {
    const fila = valores[i];

    // Validación de columnas esenciales para moverFinalizadas:
    // - estado coherente
    // - fechas alta/fin real usables con getTime() (Date) cuando se mueva
    const estadoRaw = fila[colEstado];
    const estadoNorm = (estadoRaw ?? '').toString().trim().toLowerCase();
    const estado = (estadoNorm === 'hecho') ? 'hecho' : '';
    const prio = fila[idxPrioridad];
    if (!(prio === '' || prio === null || typeof prio === 'number')) {
      throw new Error("VALIDACION: prioridad no numérica");
    }
    if (!(estadoNorm === '' || estadoNorm === 'hecho')) {
      throw new Error(`VALIDACION: estado inválido en fila ${i + 2} (valor="${estadoRaw}")`);
    }

    // Coherencia de dataset completo: fechaFinReal <-> estado hecho
    const fhFinAny = fila[idxFechaFinReal];
    const finInformada = !(fhFinAny === '' || fhFinAny === null || fhFinAny === undefined);
    if (estado === 'hecho' && !finInformada) {
      throw new Error(`VALIDACION: estado 'hecho' sin fechaFinReal en fila ${i + 2}`);
    }
    if (finInformada && estado !== 'hecho') {
      throw new Error(`VALIDACION: fechaFinReal informada pero estado no es 'hecho' en fila ${i + 2}`);
    }

    if (estado === 'hecho') {
      hayHecho = true;
      if (filaInicalTareaMov === 0) filaInicalTareaMov = i + 2;

      const fhAlta = fila[idxFechaAlta];
      const fhFin = fila[idxFechaFinReal];

      if (!(fhAlta instanceof Date)) {
        throw new Error(`VALIDACION: columna fechaAlta no contiene valores Date en fila ${i + 2} (requerido para getTime())`);
      }
      if (!(fhFin instanceof Date)) {
        throw new Error(`VALIDACION: columna fechaFinReal no contiene valores Date en fila ${i + 2} (requerido para getTime())`);
      }

      // Coherencia: fecha fin real no puede ser anterior a fecha alta
      if (fhAlta.getTime() > fhFin.getTime()) {
        throw new Error("VALIDACION: fecha fin anterior a fecha alta");
      }
    }
  }

  // Check específico para evitar deleteRows(0, ...)
  if (filaInicalTareaMov === 0 || !hayHecho) {
    throw new Error("VALIDACION: no hay tareas con estado 'hecho' para mover a \"Hecho\"");
  }

  // Protección adicional: bloquear valores degenerados (deleteRows requiere fila >=2)
  if (filaInicalTareaMov <= 1) {
    throw new Error("VALIDACION: no hay bloque válido de tareas finalizadas");
  }
}

function normalizarFecha(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) return valor;

  if (typeof valor === 'string') {
    const s = valor.trim();
    if (s === '') throw new Error("VALIDACION: fecha vacía no permitida");

    // dd/MM/yyyy
    const parts = s.split('/');
    if (parts.length !== 3) {
      throw new Error(`VALIDACION: fecha string no parseable (esperado dd/MM/yyyy): "${valor}"`);
    }
    const [d, m, y] = parts.map(n => Number(n));
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt.getTime()) || dt.getFullYear() !== y || (dt.getMonth() + 1) !== m || dt.getDate() !== d) {
      throw new Error(`VALIDACION: fecha string inválida (dd/MM/yyyy): "${valor}"`);
    }
    return dt;
  }

  throw new Error(`VALIDACION: tipo de fecha no soportado (${typeof valor})`);
}

function intentarAutoreparacionFila(fila, config) {
  // Auto-reparación limitada y reversible (opera en memoria; persistencia es opt-in en validarEstructuraHoja).
  // Retorna { reparado: boolean, fila: Array, cambios: string[] }
  const columnas = config?.columnas ?? {};
  const out = Array.isArray(fila) ? fila.slice() : [];
  const cambios = [];

  const idxFechaAlta = columnas.fechaAlta;
  const idxPrioridad = columnas.prioridad;
  const idxEstado = columnas.estado;
  const idxFechaFinEst = columnas.fechaFinEstimada;
  const idxFechaFinReal = columnas.fechaFinReal;

  // Estado: normalizar variantes a "hecho" o "".
  if (typeof idxEstado === 'number') {
    const raw = (out[idxEstado] ?? '').toString().trim();
    const norm = raw.toLowerCase();
    if (norm === 'hecho') {
      if (out[idxEstado] !== 'hecho') {
        out[idxEstado] = 'hecho';
        cambios.push('estado→hecho');
      }
    } else if (raw === '') {
      // ok
    } else {
      return { reparado: false };
    }
  }

  // Prioridad: convertir string numérica a number.
  if (typeof idxPrioridad === 'number') {
    const pr = out[idxPrioridad];
    if (typeof pr === 'string' && pr.trim() !== '') {
      const n = Number(pr.trim().replace(',', '.'));
      if (!isNaN(n)) {
        out[idxPrioridad] = n;
        cambios.push('prioridad:string→number');
      } else {
        return { reparado: false };
      }
    }
  }

  // Fechas: string dd/MM/yyyy -> Date
  const intentarFecha = (idx, label) => {
    if (typeof idx !== 'number') return true;
    const v = out[idx];
    if (v === '' || v === null || v === undefined) return true;
    if (v instanceof Date) return true;
    if (typeof v === 'string') {
      const dt = normalizarFecha(v);
      out[idx] = dt;
      cambios.push(`${label}:string→Date`);
      return true;
    }
    return false;
  };

  if (!intentarFecha(idxFechaAlta, 'fechaAlta')) return { reparado: false };
  if (!intentarFecha(idxFechaFinEst, 'fechaFinEstimada')) return { reparado: false };
  if (typeof idxFechaFinReal === 'number') {
    if (!intentarFecha(idxFechaFinReal, 'fechaFinReal')) return { reparado: false };
  }

  return { reparado: cambios.length > 0, fila: out, cambios };
}

function diagnosticarSistema() {
  const errores = [];
  const warnings = [];

  // Versionado: no debe afectar ejecución normal, pero sí reportarse en diagnóstico.
  try {
    validarVersionModelo();
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    errores.push(msg);
  }

  const resTareas = validarEstructuraHoja(CONFIG_MODELO.TAREAS.nombreHoja, CONFIG_MODELO.TAREAS, { modoDiagnostico: true, devolverWarnings: true });
  if (Array.isArray(resTareas)) {
    if (resTareas.length > 0) errores.push(...resTareas.map(x => `Tareas: ${x}`));
  } else {
    if (resTareas?.errores?.length) errores.push(...resTareas.errores.map(x => `Tareas: ${x}`));
    if (resTareas?.warnings?.length) warnings.push(...resTareas.warnings.map(x => `Tareas: ${x}`));
  }

  const resHecho = validarEstructuraHoja(CONFIG_MODELO.HECHO.nombreHoja, CONFIG_MODELO.HECHO, { modoDiagnostico: true, devolverWarnings: true });
  if (Array.isArray(resHecho)) {
    if (resHecho.length > 0) errores.push(...resHecho.map(x => `Hecho: ${x}`));
  } else {
    if (resHecho?.errores?.length) errores.push(...resHecho.errores.map(x => `Hecho: ${x}`));
    if (resHecho?.warnings?.length) warnings.push(...resHecho.warnings.map(x => `Hecho: ${x}`));
  }

  // Persistir logs en sheet de forma batched (si existe módulo de observabilidad).
  if (typeof flushLogsSheet === 'function') {
    try { flushLogsSheet(); } catch (e) { /* no romper diagnóstico */ }
  }

  const metricas = (typeof obtenerMetricas === 'function') ? obtenerMetricas() : undefined;

  return {
    estado: errores.length > 0 ? "ERROR" : "OK",
    resumen: {
      totalErrores: errores.length,
      totalWarnings: warnings.length,
    },
    errores,
    warnings,
    metricas,
  };
}

