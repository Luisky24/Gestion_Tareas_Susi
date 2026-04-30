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

  // Si ya está finalizada, no permitimos finalizar de nuevo
  if (tareaMod.length >= 5 && tareaMod[4] === 'hecho') {
    throw new Error("La tarea ya está finalizada (estado 'hecho')");
  }

  // estado
  if (tareaMod.length >= 5) {
    tareaMod[4] = 'hecho';
  }

  // fecha fin (última columna)
  if (tareaMod.length >= 1) {
    tareaMod[tareaMod.length - 1] = fechaActual;
  }

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

/* distribuir en tres tablas las tareas según su estado, 'en curso', 'retrasadas', 'finalizadas'
*/

  vlTareas.forEach((elemento, indice) => {
    let colorTarea = null;
    let fhEstimada = fhDia;
    if (elemento[5] != "") {
      fhEstimada = elemento[5].getTime();
    }
    if (fhDia > fhEstimada && elemento[4] != "hecho") {
      tblTareasRetrasadas.push(vlTareas[indice]);
    } else if (elemento[4] == "hecho") {
      tblTareasFinalizadas.push(vlTareas[indice]);
    } else {
      tblTareasCurso.push(vlTareas[indice]);
    }

  });

  // Ordenar tareas 'en curso'
  svc_ordenarTareas(tblTareasCurso, ultimaColumna);

  // Ordenar tareas 'retrasadas'
  svc_ordenarTareas(tblTareasRetrasadas, ultimaColumna);

  // Ordenar tareas 'finalizadas'
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

function svc_ordenarTareas(tblTareas, num_columnas) {

  tblTareas.sort((a, b) => {
    const prioridadDif = a[2] - b[2];

    if (prioridadDif !== 0) { return prioridadDif; }

    let fechaA = a[num_columnas - 1];
    let fechaB = b[num_columnas - 1];

    if (fechaA == "") { fechaA = new Date() };
    if (fechaB == "") { fechaB = new Date() };

    return fechaA.getTime() - fechaB.getTime();
  })

}

function procesarMoverFinalizadas(tareas, tareasHecho) {
  let vlTareas = tareas;
  if (!Array.isArray(vlTareas)) vlTareas = [];

  let vlHecho = tareasHecho;
  if (!Array.isArray(vlHecho)) vlHecho = [];

  if (vlTareas.length === 0 && vlHecho.length === 0) {
    return { tareasRestantes: [], tareasHechoFinal: [] };
  }

  let numcolumnas = 0;
  if (vlTareas.length > 0 && Array.isArray(vlTareas[0])) {
    numcolumnas = vlTareas[0].length;
  }

  let lstTareasFinalizadas = [];
  let tareasRestantes = [];

  vlTareas.some((elemento, indice) => {
    if (!Array.isArray(elemento)) return;
    if (numcolumnas > 0 && elemento[numcolumnas - 3] == 'hecho') {
      lstTareasFinalizadas.push(elemento);
    } else {
      tareasRestantes.push(elemento);
    }
  })

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

  /*Verificamos si existe la tarea finalizada a mover en las tares de la hoja 'Hecho'
  Obtenemos los elementos a incluir y la posición que ocupa el elemnto inmediatamente inferior
  a este
  */
  let mapIn = new Map();

  for (let elemenIn of lstTareasFinalizadas) {
    if (!Array.isArray(elemenIn)) continue;

    /* Clave formada por: fecha finalización, tarea, fecha alta
    */
    let tFin = safeTime(elemenIn[6]);
    let tAlta = safeTime(elemenIn[0]);
    let nombre = elemenIn[1];
    if (nombre === null || nombre === undefined) nombre = "";
    let claveIn = `${tFin === null ? 0 : tFin}|${nombre}|${tAlta === null ? 0 : tAlta}`;

    mapIn.set(claveIn, elemenIn);

  }

  /* Unimos tanto los nuevos elementos a incoporar a Hecho como los que tenía esta hoja, 
  posteriormente lo ordenamos por Fecha Fin Real, fecha alta y Noombre tarea descendentemente
  */
  let mapHch = new Map();
  let filaHch = 0;
  if (vlHecho.length > 0 && Array.isArray(vlHecho[0]) && vlHecho[0][1] != "") {
    for (elemenHch of vlHecho) {
      if (!Array.isArray(elemenHch)) continue;
      /* Clave formada por: fecha finalización, tarea, fecha alta
      */
      let tFin = safeTime(elemenHch[6]);
      let tAlta = safeTime(elemenHch[0]);
      let nombre = elemenHch[1];
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
  })

  return { tareasRestantes, tareasHechoFinal };
}

