function log(...args) {
  APP.LOG.log('[APP] ' + args.map(String).join(' '));
}

function error(...args) {
  APP.LOG.error('[APP ERROR] ' + args.map(String).join(' '));
}

function onOpen() {
  repo_migrarColumnaObjetivoSiNecesario();

  let hj_actual = repo_obtenerHoja('Tareas');
  if (hj_actual) {
    hj_actual.activate();
  }

  //let hj_Actual = SpreadsheetApp.getActiveSheet();
  APP.LOG.log("Nombre Hoja: " + hj_actual.getName());

  // Poner color pijama y despues color vencidas
  //pijama(hj_actual);
  //detectarVencidas(hj_actual);
  reorganizarTareas();

  // Crear menú
  ui_crearMenu();

}

function mostrarBarraLateral() {
  var barra = ui_renderHtml('index').setTitle('Menú Gestión Tareas');
  ui_mostrarSidebar(barra);
  APP.LOG.log("");
}

function abrirPanelTriggers() {
  const html = HtmlService.createTemplateFromFile('panelTriggers')
    .evaluate()
    .setWidth(900)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(html, 'Gestión de Triggers');
}

/**
 * Cambia el contenido del sidebar cargando un archivo HTML del proyecto.
 * Se usa desde el frontend para navegación simple entre paneles.
 *
 * @param {string} nombreArchivo Nombre del archivo HTML (sin extensión).
 */
function cargarPagina(nombreArchivo) {
  const nombre = String(nombreArchivo || '').trim();
  if (!nombre) {
    throw new Error('cargarPagina(nombreArchivo): nombreArchivo es obligatorio.');
  }

  if (nombre === 'panelTriggers') {
    abrirPanelTriggers();
    return;
  }

  const htmlOutput = ui_renderHtml(nombre).setTitle('Menú Gestión Tareas');
  ui_mostrarSidebar(htmlOutput);
}

/**
 * Devuelve el HTML de un archivo para carga dinámica en frontend.
 * Se usa desde `cargarPagina(nombre)` (cliente) para pintar dentro de un contenedor.
 *
 * @param {string} nombre Nombre del archivo HTML (sin extensión).
 * @returns {string} Contenido HTML del archivo.
 */
function obtenerHtml(nombre) {
  const n = String(nombre || '').trim();
  if (!n) {
    throw new Error('obtenerHtml(nombre): nombre es obligatorio.');
  }
  // Renderizado como plantilla para soportar includes/templating en páginas parciales.
  return ui_renderHtmlContent(n);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function gestorOpciones(opcion) {

  APP.LOG.log(opcion);

  try {

    switch (opcion) {
      case 1: nuevaTarea();
        break;
      case 2: finalizarTarea();
        break;
      case 3: reactivarTarea();
        break;
      case 4: borrarTarea();
        break;
      case 5: reorganizarTareas();
        break;
      case 6: moverFinalizadas();
        break;
      default:
        throw new Error("Opción seleccionada no existe");

    }

  } catch (err) {
    throw new Error(err.message);
  }

}

function nuevaTarea() {
  try {
    // Creamos una nueva fila para la tarea en la primera posición de la tabla de tareas
    let hj_tareas = repo_insertarFilaAntes('Tareas', 2);

    /* Obtenemos el color de la celda de la fila de la tarea siguiente a la de la nueva 
    tarea para saber de que color pintar las celdas de la nueva tarea
    */
    let colorLineaSgte = repo_getBackground('Tareas', 3, 1);

    // Obtenemos el número de columnas de las tareas
    let num_columnas = repo_getLastColumn('Tareas');

    /*Obtenemos el rango de la nueva tarea para pintar su color pijama y en función de este ponemos el background
    */
    let rng_NuevaTarea = repo_getRange('Tareas', 2, 1, 1, num_columnas);
    aplicarColorNuevaTarea(rng_NuevaTarea, colorLineaSgte);

    // Activar la celda 2,1 y asignarle la fecha actual
    let rngCelda = repo_activateRange('Tareas', 2, 1);

    // Obtener fecha del día para asignarla como fecha alta tarea
    let fhDia = new Date();
    let zonaHoraria = Session.getScriptTimeZone();

    let fechaAlta = Utilities.formatDate(fhDia, zonaHoraria, "dd/MM/yyyy");
    let tareaNueva = svc_nuevaTarea(fechaAlta);
    rngCelda.setValue(tareaNueva[0]);

    /* Un a vez puesta la fecha nos posicionamos en la siguiente celda para que se
    completen los datos de la hj_tareas*/
    repo_setActiveRange('Tareas', 2, 2);

    //reorganizarTareas();
    
  }
  catch (err) {
    throw new Error(err.message); // Pasar el error como controlado
  }
}

function finalizarTarea() {
  try {

    let hj_tareas = repo_obtenerHoja('Tareas');

    /* Obtenemos la fila donde se encuentra ubicada la tarea que se desea finalizar y la columna donde se debe incluir la fecha fin, la última de las columnas, y posicionaos en la fecha fin la celda activa 
    */
    let rngTarea = repo_obtenerRangoActivo('Tareas');
    let filaTarea = rngTarea.getRow();
    let columnasTarea = repo_getLastColumn('Tareas');
    let filasTareas = repo_getLastRow('Tareas');

    /* Comprobamos que la tarea no esta finaliza y se encuentra en el rango de tareas en cuyo caso procedemos a actualizar la fecha fin
    */
    let vlFhFin = repo_getValue('Tareas', filaTarea, columnasTarea);
    if (filaTarea > filasTareas || filaTarea < 2) {
      throw new Error("Fila seleccionada no contiene tarea");
    } else {
      /* Obtenemos la fecha del dia
      */
      let fhDia = new Date();
      let zonaHoraria = Session.getScriptTimeZone();
      let fechaFin = Utilities.formatDate(fhDia, zonaHoraria, "dd/MM/yyyy");

      let tarea = repo_getValues('Tareas', filaTarea, 1, 1, columnasTarea)[0];
      tarea = svc_finalizarTarea(tarea, fechaFin);
      repo_setValuesEnRango('Tareas', filaTarea, 1, 1, columnasTarea, [tarea]);

      /* Obtenmos el rango y modificamos la celda
      */
      repo_setValue('Tareas', filaTarea, columnasTarea, fechaFin);

      /* Ponemos la tarea del color asociado a las finalizadas, 210,210,210
      */
      let rngFhFin = repo_getRangeEnHoja(hj_tareas, filaTarea, 1, 1, columnasTarea);
      aplicarColorTareaFinalizada(rngFhFin);
      /* Pasamos al tarea al estado 'hecho'
      */
      repo_setValue('Tareas', filaTarea, TASK_COLUMNS.ESTADO.col, 'hecho');

      reubicarTareaFinalizada(hj_tareas, filasTareas, columnasTarea, filaTarea);
      reorganizarTareas();
    }

  } catch (error) {
    throw new Error(error.message); // Pasar el error como controlado
  }
}

function borrarTarea() {
  try {
    let hj_tareas = repo_obtenerHoja('Tareas');

    /* Verificamos que la fila seleccionada esta dentro de las filas con tareas
    */
    let ultFila = repo_getLastRow('Tareas');
    let ultColumn = repo_getLastColumn('Tareas');
    let rngTarea = repo_obtenerRangoActivo('Tareas');
    let filaTarea = rngTarea.getRow();
    let columTarea = rngTarea.getColumn();
    if (filaTarea > 1 && filaTarea <= ultFila && columTarea <= ultColumn) {

      /* Obtenemos la fila donde se encuentra ubicada la tarea que se desea borrar
      */
      repo_borrarFila('Tareas', filaTarea);
      reorganizarTareas();

    } else {
      throw new Error("La fila y columna seleccionada no tiene asociada una tarea");
    }

  } catch (err) {
    throw new Error(err.message); // Pasar el error como controlado
  }
}

function reactivarTarea() {
  try {

  } catch (err) {
    throw new Error(err.message); // Pasar el error como controlado
  }
  /* Obtenemos la hoja activa, su nombre, la última fila con datos y la celda seleccionada
  */
  let hjActiva = repo_obtenerHoja('Tareas');
  let nbHjActiva = hjActiva.getName();
  let ultFilaHjActiva = repo_getLastRow('Tareas');
  let ultColumHjActiva = repo_getLastColumn('Tareas');
  let celdaActiva = repo_obtenerCeldaActiva('Tareas');
  let filaSelecc = celdaActiva.getRow();
  let columSelecc = celdaActiva.getColumn();

  /*Verificamos que la fila y columna seleccionada esta en el rango de datos
  */
  let indDentroRango = false;
  if (filaSelecc <= ultFilaHjActiva && columSelecc <= ultColumHjActiva) {
    repo_setValue('Tareas', filaSelecc, TASK_COLUMNS.ESTADO.col, "");
    repo_setValue('Tareas', filaSelecc, TASK_COLUMNS.FECHA_FIN_REAL.col, "");

    if (nbHjActiva === 'Hecho') {
      let vlModif = repo_getValues('Tareas', filaSelecc, 1, 1, ultColumHjActiva - 1);

      /* Activamos la hoja de Tareas y buscamos la ultima fila, insertar la 
      tarea a reactivar tras aquella
      */
      let hjDestino = repo_obtenerHoja("Tareas");
      let ultFilaDest = repo_getLastRow("Tareas");
      repo_setValues("Tareas", ultFilaDest + 1, 1, vlModif);
      /*Borrar elemento reactivado
      */
      repo_borrarFila('Tareas', filaSelecc);

      /*Copiamos hoja destino sobre activa para el resto de los procesos
      */
      hjDestino.activate();
      hjActiva = hjDestino;
      //console.log(SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName());
    } else if (nbHjActiva === 'Tareas') {
      repo_setValue('Tareas', filaSelecc, TASK_COLUMNS.ESTADO.col, "");
      repo_setValue('Tareas', filaSelecc, TASK_COLUMNS.FECHA_FIN_REAL.col, "");
      let rngModif = repo_getRangeEnHoja(hjActiva, filaSelecc, 1, 1, columSelecc - 1);
      aplicarColorTareaReactivada(rngModif);
    }
    SpreadsheetApp.flush;
    
    reorganizarTareas();

  }

}

function reorganizarTareas() {
  try {
    repo_migrarColumnaObjetivoSiNecesario();

    let vlTareas = obtenerTodasLasTareas();
    let tablafinal = svc_reorganizarTareas(vlTareas);

    /* Se procede a reecribir las tareas sobre la hoja excel
    */

    limpiarTareas();

    escribirTareas(tablafinal);

    pijama();

  } catch (err) {
    throw new Error(err.message);
  }
}

function moverFinalizadas() {
  try {
    repo_migrarColumnaObjetivoSiNecesario();

    /* Obtenemos las tareas finalizadas de la hoja 'Tareas'
    */
    let numfilas = repo_getLastRow('Tareas');
    let numcolumnas = repo_getLastColumn('Tareas');
    let vlTareas = repo_getValues('Tareas', 2, 1, numfilas - 1, numcolumnas);

    /* Obtenemos la lista de tareas de la hoja 'Hecho'
    */
    let numfilasHecho = repo_getLastRow('Hecho');
    if (numfilasHecho < 2) { numfilasHecho = 2 };
    let numcolumnasHecho = repo_getLastColumn('Hecho');
    let vlHecho = repo_getValues('Hecho', 2, 1, numfilasHecho - 1, numcolumnasHecho);
    let rsProcesar = svc_moverFinalizadas(vlTareas, vlHecho);

    /* Procedemos a escribir las filas de la hoja 'Hecho'
    */
    let elementosIncluir = [];
    let fila = 0;
    //let numTareasSort = sortedMap.size();
    let tareaHchAlta = []; 
    rsProcesar.tareasHechoFinal.forEach((valor) => {
      tareaHchAlta.push(valor);
      fila++;
    });

    repo_setValuesEnRango('Hecho', 2, 1, fila, numcolumnasHecho, tareaHchAlta);

    /*Borrar tareas marcadas con hecho en la hoja Tareas
    */
    let filaInicalTareaMov = 0;
    if (rsProcesar.tareasRestantes.length < vlTareas.length) {
      filaInicalTareaMov = rsProcesar.tareasRestantes.length + 2;
    }
    repo_borrarFilas('Tareas', filaInicalTareaMov, (numfilas - filaInicalTareaMov + 1));

    repo_flush();

  } catch (err) {
    throw new Error(err.message); // Pasar el error como controlado
  }
}



