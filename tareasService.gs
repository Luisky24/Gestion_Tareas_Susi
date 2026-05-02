function procesarNuevaTarea(fechaActual) {
  let fecha = fechaActual;

  if (fecha === null || fecha === undefined || fecha === "") {
    throw new Error("Fecha de alta inválida: valor vacío");
  }

  // Aceptar Date o string dd/MM/yyyy (formato usado por el proyecto)
  if (fecha instanceof Date) {
    if (isNaN(fecha.getTime())) {
      throw new Error("Fecha de alta inválida: Date no válido");
    }
  } else if (typeof fecha === "string") {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha.trim());
    if (!m) {
      throw new Error("Fecha de alta inválida: formato esperado dd/MM/yyyy");
    }
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getMonth() !== (mo - 1) || dt.getDate() !== d) {
      throw new Error("Fecha de alta inválida: día/mes/año no válido");
    }
  } else {
    throw new Error("Fecha de alta inválida: tipo no soportado");
  }

  const tarea = [fechaActual];
  if (!Array.isArray(tarea) || tarea.length < 1 || tarea[0] === undefined) {
    throw new Error("Estructura de tarea inválida: no se pudo crear correctamente");
  }

  return tarea;
}

// =====================
// Service (dominio/casos de uso sin UI/SpreadsheetApp directo)
// =====================

function svc_nuevaTarea(fechaAlta) {
  return procesarNuevaTarea(fechaAlta);
}

function procesarFinalizarTarea(tarea, fechaActual) {
  let tareaMod = tarea;
  if (!Array.isArray(tareaMod)) {
    throw new Error("Estructura de tarea inválida: se esperaba un array");
  }

  task_padRowToExpectedWidth(tareaMod);

  if (task_isHecho(tareaMod)) {
    throw new Error("La tarea ya está finalizada (estado 'hecho')");
  }

  tareaMod[TASK_COLUMNS.ESTADO.idx] = "hecho";
  tareaMod[TASK_COLUMNS.FECHA_FIN_REAL.idx] = fechaActual;

  return tareaMod;
}

function svc_finalizarTarea(tarea, fechaFin) {
  return procesarFinalizarTarea(tarea, fechaFin);
}

function procesarReorganizacionTareas(tareas) {
  let vlTareas = tareas;
  if (!Array.isArray(vlTareas)) vlTareas = [];

  let ultimaColumna = 0;
  if (vlTareas.length > 0 && Array.isArray(vlTareas[0])) {
    ultimaColumna = vlTareas[0].length;
  }

  let tblTareasRetrasadas = [];
  let tblTareasCurso = [];
  let tblTareasFinalizadas = [];

  let fhDia = new Date().getTime();

  vlTareas.forEach((elemento, indice) => {
    let fhEstimada = fhDia;
    const est = task_getFechaFinEstimada(elemento);
    if (est !== null && est !== undefined && est !== "") {
      const t = task_safeTime(est);
      if (t > 0) fhEstimada = t;
    }

    if (fhDia > fhEstimada && !task_isHecho(elemento)) {
      tblTareasRetrasadas.push(vlTareas[indice]);
    } else if (task_isHecho(elemento)) {
      tblTareasFinalizadas.push(vlTareas[indice]);
    } else {
      tblTareasCurso.push(vlTareas[indice]);
    }
  });

  svc_ordenarTareas(tblTareasCurso, ultimaColumna);
  svc_ordenarTareas(tblTareasRetrasadas, ultimaColumna);
  svc_ordenarTareas(tblTareasFinalizadas, ultimaColumna);

  let tablafinal = [...tblTareasRetrasadas, ...tblTareasCurso, ...tblTareasFinalizadas];
  return tablafinal;
}

function svc_reorganizarTareas(vlTareas) {
  return procesarReorganizacionTareas(vlTareas);
}

function svc_moverFinalizadas(vlTareas, vlHecho) {
  return procesarMoverFinalizadas(vlTareas, vlHecho);
}

// =====================
// Dominio puro (helpers)
// =====================

/** Prioridad numérica para ordenar; valores no numéricos → 0 (evita NaN en el comparator). */
function task_prioridadNumericaSegura_(row) {
  if (!Array.isArray(row)) return 0;
  const n = Number(row[TASK_COLUMNS.PRIORIDAD.idx]);
  if (!isFinite(n)) return 0;
  return n;
}

function svc_ordenarTareas(tblTareas, num_columnas) {
  tblTareas.sort((a, b) => {
    const pa = task_prioridadNumericaSegura_(a);
    const pb = task_prioridadNumericaSegura_(b);
    let prioridadDif = pa - pb;
    if (!isFinite(prioridadDif)) prioridadDif = 0;

    if (prioridadDif !== 0) return prioridadDif;

    let fechaA = task_getFechaFinReal(a);
    let fechaB = task_getFechaFinReal(b);

    if (fechaA === "") fechaA = new Date();
    if (fechaB === "") fechaB = new Date();

    const realDiff = fechaA.getTime() - fechaB.getTime();
    if (realDiff !== 0) return realDiff;

    const dayA = task_dayKeyEstimada(a);
    const dayB = task_dayKeyEstimada(b);
    if (dayA !== dayB) return 0;

    const aX = task_isObjetivoMarcado(a) ? 1 : 0;
    const bX = task_isObjetivoMarcado(b) ? 1 : 0;
    return bX - aX;
  });
}

function procesarMoverFinalizadas(tareas, tareasHecho) {
  let vlTareas = tareas;
  if (!Array.isArray(vlTareas)) vlTareas = [];

  let vlHecho = tareasHecho;
  if (!Array.isArray(vlHecho)) vlHecho = [];

  if (vlTareas.length === 0 && vlHecho.length === 0) {
    return { tareasRestantes: [], tareasHechoFinal: [] };
  }

  let lstTareasFinalizadas = [];
  let tareasRestantes = [];

  vlTareas.some((elemento, indice) => {
    if (!Array.isArray(elemento)) return;
    if (task_isHecho(elemento)) {
      lstTareasFinalizadas.push(elemento);
    } else {
      tareasRestantes.push(elemento);
    }
  });

  const safeTime = (v) => {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime();
    if (v && typeof v.getTime === "function") {
      try {
        const t = v.getTime();
        return isNaN(t) ? null : t;
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  let mapIn = new Map();

  for (let elemenIn of lstTareasFinalizadas) {
    if (!Array.isArray(elemenIn)) continue;

    let tFin = safeTime(task_getFechaFinReal(elemenIn));
    let tAlta = safeTime(elemenIn[TASK_COLUMNS.FECHA_ALTA.idx]);
    let nombre = elemenIn[TASK_COLUMNS.TITULO.idx];
    if (nombre === null || nombre === undefined) nombre = "";
    let claveIn = `${tFin === null ? 0 : tFin}|${nombre}|${tAlta === null ? 0 : tAlta}`;

    mapIn.set(claveIn, elemenIn);
  }

  let mapHch = new Map();
  let filaHch = 0;
  if (vlHecho.length > 0 && Array.isArray(vlHecho[0]) && vlHecho[0][TASK_COLUMNS.TITULO.idx] != "") {
    for (elemenHch of vlHecho) {
      if (!Array.isArray(elemenHch)) continue;

      let tFin = safeTime(task_getFechaFinReal(elemenHch));
      let tAlta = safeTime(elemenHch[TASK_COLUMNS.FECHA_ALTA.idx]);
      let nombre = elemenHch[TASK_COLUMNS.TITULO.idx];
      if (nombre === null || nombre === undefined) nombre = "";
      let claveHch = `${tFin === null ? 0 : tFin}|${nombre}|${tAlta === null ? 0 : tAlta}`;

      mapHch.set(claveHch, elemenHch);
      filaHch++;
    }
  }

  let unionMap = [...mapHch, ...mapIn];

  let sortedMap = new Map([...unionMap].sort().reverse());

  let tareasHechoFinal = [];
  sortedMap.forEach((valor) => {
    tareasHechoFinal.push(valor);
  });

  return { tareasRestantes, tareasHechoFinal };
}
