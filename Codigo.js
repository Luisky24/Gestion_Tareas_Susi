
function onOpen() {
  let hj_actual = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');
  if (hj_actual) {
    hj_actual.activate();
  }

  //let hj_Actual = SpreadsheetApp.getActiveSheet();
  console.log("Nombre Hoja: " + hj_actual.getName());

  // Poner color pijama y despues color vencidas
  //pijama(hj_actual);
  //detectarVencidas(hj_actual);
  reorganizarTareas();

  // Crear menú
  SpreadsheetApp.getUi().createMenu('Lista Tareas')
    .addItem('Mostrar Barar Lateral', 'mostrarBarraLateral')
    .addToUi();

}

function mostrarBarraLateral() {
  var barra = HtmlService.createHtmlOutputFromFile('index').setTitle('Menú Gestión Tareas');
  SpreadsheetApp.getUi().showSidebar(barra);
  console.log("");
}

function include(filename) {
  let html = HtmlService.createHtmlOutputFromFile(filename).getContent();
  return html;
}

function gestorOpciones(opcion) {

  console.log(opcion);

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
    let hj_tareas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');
    hj_tareas.insertRowBefore(2);

    /* Obtenemos el color de la celda de la fila de la tarea siguiente a la de la nueva 
    tarea para saber de que color pintar las celdas de la nueva tarea
    */
    let rngLineaSgte = hj_tareas.getRange(3, 1);
    let colorLineaSgte = rngLineaSgte.getBackground();

    // Obtenemos el número de columnas de las tareas
    let num_columnas = hj_tareas.getLastColumn();

    // Obtener los colores pijama para la tabla de tareas
    const colorHex_amarillo = rgbToHex(255, 255, 195);
    const colorHex_blanco = rgbToHex(255, 255, 255);

    /*Obtenemos el rango de la nueva tarea para pintar su color pijama y en función de este ponemos el background
    */
    let rng_NuevaTarea = hj_tareas.getRange(2, 1, 1, num_columnas);
    if (colorLineaSgte != colorHex_amarillo) {
      rng_NuevaTarea.setBackground(colorHex_amarillo);
    } else {
      rng_NuevaTarea.setBackground(colorHex_blanco)
    }

    // Activar la celda 2,1 y asignarle la fecha actual
    let rngCelda = hj_tareas.getRange(2, 1);
    rngCelda.activate();

    // Obtener fecha del día para asignarla como fecha alta tarea
    let fhDia = new Date();
    let zonaHoraria = Session.getScriptTimeZone();

    let fechaAlta = Utilities.formatDate(fhDia, zonaHoraria, "dd/MM/yyyy");
    rngCelda.setValue(fechaAlta);

    /* Un a vez puesta la fecha nos posicionamos en la siguiente celda para que se
    completen los datos de la hj_tareas*/
    rngCelda = hj_tareas.getRange(2, 2);
    hj_tareas.setActiveRange(rngCelda);

    //reorganizarTareas();
    
  }
  catch (err) {
    throw new Error(err.message); // Pasar el error como controlado
  }


}

function finalizarTarea() {
  try {

    let hj_tareas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');
    validarEstructuraHoja('Tareas', CONFIG_MODELO.TAREAS);

    /* Obtenemos la fila donde se encuentra ubicada la tarea que se desea finalizar y la columna donde se debe incluir la fecha fin, la última de las columnas, y posicionaos en la fecha fin la celda activa 
    */
    let rngTarea = hj_tareas.getActiveRange();
    let filaTarea = rngTarea.getRow();
    let columnasTarea = hj_tareas.getLastColumn();
    let filasTareas = hj_tareas.getLastRow();

    // Validación de fila activa antes de escribir
    if (filaTarea < 2 || filaTarea > filasTareas) {
      throw new Error("VALIDACION: fila activa fuera del rango de tareas (seleccione una fila de tarea)");
    }

    /* Comprobamos que la tarea no esta finaliza y se encuentra en el rango de tareas en cuyo caso procedemos a actualizar la fecha fin
    */
    let vlFhFin = hj_tareas.getRange(filaTarea, columnasTarea).getValue();
    if (filaTarea > filasTareas || filaTarea < 2) {
      throw new Error("Fila seleccionada no contiene tarea");
    } else {
      /* Obtenemos la fecha del dia
      */
      let fhDia = new Date();
      let zonaHoraria = Session.getScriptTimeZone();
      let fechaFin = Utilities.formatDate(fhDia, zonaHoraria, "dd/MM/yyyy");

      /* Obtenmos el rango y modificamos la celda
      */
      let rngFhFin = hj_tareas.getRange(filaTarea, columnasTarea);
      rngFhFin.setValue(fechaFin);

      /* Ponemos la tarea del color asociado a las finalizadas, 210,210,210
      */
      rngFhFin = hj_tareas.getRange(filaTarea, 1, 1, columnasTarea);
      rngFhFin.setBackground(rgbToHex(210, 210, 210));
      /* Pasamos al tarea al estado 'hecho'
      */
      rngFhFin = hj_tareas.getRange(filaTarea, 5);
      rngFhFin.setValue('hecho');

      reubicarTareaFinalizada(hj_tareas, filasTareas, columnasTarea, filaTarea);
      reorganizarTareas();
    }

  } catch (error) {
    throw new Error(err.message); // Pasar el error como controlado
  }

}

function borrarTarea() {
  try {
    let hj_tareas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');

    /* Verificamos que la fila seleccionada esta dentro de las filas con tareas
    */
    let ultFila = hj_tareas.getLastRow();
    let ultColumn = hj_tareas.getLastColumn();
    let rngTarea = hj_tareas.getActiveRange();
    let filaTarea = rngTarea.getRow();
    let columTarea = rngTarea.getColumn();
    if (filaTarea > 1 && filaTarea <= ultFila && columTarea <= ultColumn) {

      /* Obtenemos la fila donde se encuentra ubicada la tarea que se desea borrar
      */
      hj_tareas.deleteRow(filaTarea);
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
    throw new Error(error.message); // Pasar el error como controlado
  }
  /* Obtenemos la hoja activa, su nombre, la última fila con datos y la celda seleccionada
  */
  let hjActiva = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');
  let nbHjActiva = hjActiva.getName();
  let ultFilaHjActiva = hjActiva.getLastRow();
  let ultColumHjActiva = hjActiva.getLastColumn();
  let filaSelecc = hjActiva.getActiveCell().getRow();
  let columSelecc = hjActiva.getActiveCell().getColumn();

  /*Verificamos que la fila y columna seleccionada esta en el rango de datos
  */
  let indDentroRango = false;
  if (filaSelecc <= ultFilaHjActiva && columSelecc <= ultColumHjActiva) {
    let rngModif = hjActiva.getRange(filaSelecc, 5).setValue("");
    rngModif = hjActiva.getRange(filaSelecc, 7).setValue("");

    if (nbHjActiva === 'Hecho') {
      let rngModif = hjActiva.getRange(filaSelecc, 1, 1, ultColumHjActiva - 1);
      let vlModif = rngModif.getValues();

      /* Activamos la hoja de Tareas y buscamos la ultima fila, insertar la 
      tarea a reactivar tras aquella
      */
      let hjDestino = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tareas");
      let ultFilaDest = hjDestino.getLastRow();
      let rgnDest = hjDestino.getRange(ultFilaDest + 1, 1, 1, hjDestino.getLastColumn() - 1);
      rgnDest.setValues(vlModif);
      /*Borrar elemento reactivado
      */
      hjActiva.deleteRow(filaSelecc);

      /*Copiamos hoja destino sobre activa para el resto de los procesos
      */
      hjDestino.activate();
      hjActiva = hjDestino;
      //console.log(SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName());
    } else if (nbHjActiva === 'Tareas') {
      let rngModif = hjActiva.getRange(filaSelecc, 5).setValue("");
      rngModif = hjActiva.getRange(filaSelecc, 7).setValue("");
      const colorHex_blanco = rgbToHex(255, 255, 195);
      rngModif = hjActiva.getRange(filaSelecc, 1, 1, columSelecc - 1);
      rngModif.setBackground(colorHex_blanco);
    }
    SpreadsheetApp.flush;
    
    reorganizarTareas();

  }

}

function reorganizarTareas() {
  try {

    let hjActiva = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');
    validarEstructuraHoja('Tareas', CONFIG_MODELO.TAREAS);

    let ultimaFila = hjActiva.getLastRow();
    let ultimaColumna = hjActiva.getLastColumn();

    let rngTareas = hjActiva.getRange(2, 1, ultimaFila - 1, ultimaColumna);
    let vlTareas = rngTareas.getValues();

    let tblTareasRetrasadas = [];
    let tblTareasCurso = [];
    let tblTareasFinalizadas = [];

    let fhDia = new Date().getTime();

  /* distribuir en tres tablas las tareas según su estado, 'en curso', 'retrasadas', 'finalizadas'
  */

    vlTareas.forEach((elemento, indice) => {
      let colorTarea = hjActiva.getRange(indice + 2, 1).getBackground();
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
    ordenarTareas(tblTareasCurso, ultimaColumna);

    // Ordenar tareas 'retrasadas'
    ordenarTareas(tblTareasRetrasadas, ultimaColumna);

    // Ordenar tareas 'finalizadas'
    ordenarTareas(tblTareasFinalizadas, ultimaColumna);

    /* Se procede a reecribir las tareas sobre la hoja excel
    */

    rngTareas.clearContent();

    let tablafinal = [...tblTareasRetrasadas, ...tblTareasCurso, ...tblTareasFinalizadas];
    rngTareas.setValues(tablafinal);

    pijama();

  } catch (err) {
    throw new Error(err.message);
  }
}

function moverFinalizadas() {
  try {

    /* Obtenemos las tareas finalizadas de la hoja 'Tareas'
    */
    validarAntesMoverFinalizadas();
    let hjTareas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');
    let numfilas = hjTareas.getLastRow();
    let numcolumnas = hjTareas.getLastColumn();
    let rngTareas = hjTareas.getRange(2, 1, numfilas - 1, numcolumnas);
    let vlTareas = rngTareas.getValues();

    let lstTareasFinalizadas = [];
    let filaInicalTareaMov = 0;

    vlTareas.some((elemento, indice) => {
      if (elemento[numcolumnas - 3] == 'hecho') {
        if (filaInicalTareaMov == 0) { filaInicalTareaMov = indice + 2 };
        lstTareasFinalizadas.push(elemento);
      }
    })

    vlTareas.length = 0;

    /* Obtenemos la lista de tareas de la hoja 'Hecho'
    */
    let hjHecho = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hecho');
    let numfilasHecho = hjHecho.getLastRow();
    if (numfilasHecho < 2) { numfilasHecho = 2 };
    let numcolumnasHecho = hjHecho.getLastColumn();
    let rngHecho = hjHecho.getRange(2, 1, numfilasHecho - 1, numcolumnasHecho);
    let vlHecho = rngHecho.getValues();

    /*Verificamos si existe la tarea finalizada a mover en las tares de la hoja 'Hecho'
    Obtenemos los elementos a incluir y la posición que ocupa el elemnto inmediatamente inferior
    a este
    */
    let mapIn = new Map();

    for (let elemenIn of lstTareasFinalizadas) {

      /* Clave formada por: fecha finalización, tarea, fecha alta
      */
      let claveIn = `${elemenIn[6].getTime()}|${elemenIn[1]}|${elemenIn[0].getTime()}`;

      mapIn.set(claveIn, elemenIn);

    }

    /* Unimos tanto los nuevos elementos a incoporar a Hecho como los que tenía esta hoja, 
    posteriormente lo ordenamos por Fecha Fin Real, fecha alta y Noombre tarea descendentemente
    */
    let mapHch = new Map();
    let filaHch = 0;
    if (vlHecho.length > 0 && vlHecho[0][1] != "") {
      for (elemenHch of vlHecho) {
        /* Clave formada por: fecha finalización, tarea, fecha alta
        */
        let claveHch = `${elemenHch[6].getTime()}|${elemenHch[1]}|${elemenHch[0].getTime()}`;

        mapHch.set(claveHch, elemenHch);
        filaHch++;

      }
    }

    let unionMap = [...mapHch, ...mapIn];

    let sortedMap = new Map([...unionMap].sort().reverse());

    /* Procedemos a escribir las filas de la hoja 'Hecho'
    */
    let elementosIncluir = [];
    let fila = 0;
    //let numTareasSort = sortedMap.size();
    let tareaHchAlta = []; 
    sortedMap.forEach((valor) => {
      tareaHchAlta.push(valor);
      fila++;
    })

    let rngFila = hjHecho.getRange(2, 1, fila, numcolumnasHecho);
    rngFila.setValues(tareaHchAlta);

    /*Borrar tareas marcadas con hecho en la hoja Tareas
    */
    hjTareas.deleteRows(filaInicalTareaMov, (numfilas - filaInicalTareaMov + 1));

    SpreadsheetApp.flush();

  } catch (err) {
    throw new Error(error.message); // Pasar el error como controlado
  }
}



