
/* Ordena tareas, primero por prioridad y despuues por fecha fin real
*/
function ordenarTareas(tblTareas, num_columnas) {

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

/* Asigan los colores pijama a la lista de tareas
*/


function pijama() {
  let hj_actual = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  let num_filas = hj_actual.getLastRow();
  let num_columnas = hj_actual.getLastColumn();

  // Color pijama
  const colorHex_amarillo = rgbToHex(255, 255, 195);
  const colorHex_blanco = rgbToHex(255, 255, 255);
  const colorHex_gris = rgbToHex(210, 210, 210);
  const colorTareasVencidas = rgbToHex(255, 125, 125);
  let fhDia = new Date().getTime();

  let rng_pijama = hj_actual.getRange(2, 1, num_filas-1, num_columnas);
  let vl_pijama = rng_pijama.getValues();
  let colores = [];

  for (let i = 0; i < num_filas-1; i++) {
    let color = colorHex_blanco;

    if (i % 2 === 0) {

      color = colorHex_blanco;

    } else {

      color = colorHex_amarillo;

    }

    if (vl_pijama[i][4] == "hecho") {
      color = colorHex_gris;
    } else if (vl_pijama[i][5] != "") {
      let fhFinEsperada = vl_pijama[i][5].getTime();
      if (fhDia > fhFinEsperada) {
        color = colorTareasVencidas;
      }
    }

    colores.push(Array(num_columnas).fill(color));

  }

  rng_pijama.setBackgrounds(colores);

}


/* Reubica las tareas finalizadas
*/

function reubicarTareaFinalizada(hjActiva, numFilas, numColumnas, filaorigen) {

  /*Buscamos la fila donde se debe ubicar, las condiciones son las siguientes
  - Al final de la tabla de tareas junto con el resto de finalizadas y entre las que su fecha fi se encuentre
  */
  let indice = numFilas - 2;
  let encontrado = false;
  let rngTablaTareas = hjActiva.getRange(2, 1, numFilas - 1, numColumnas);
  let valoresTablaTareas = rngTablaTareas.getValues();
  /* Obtenemos la area origen y su fecha para convertirla en DATE por si es necesario coparar con otras tareas finalizadas y saber donde se debe incustrar la tarea que se ha marcado como finalizada
  */

  let rngOrigen = hjActiva.getRange(filaorigen, 1, 1, numColumnas);
  let vlOrigen = rngOrigen.getValues();
  let colorOrigen = hjActiva.getRange(filaorigen, 1).getBackground();
  let fhFinTareaOrigen = vlOrigen[0][numColumnas - 1];


  /* Buscar la fila donde debe ser incrustada la tarea finalizada
  */
  let filaDestino = 0;
  while (indice > 0 && !encontrado) {
    let fhFilaAnalisis = valoresTablaTareas[indice][numColumnas - 1]
    if (valoresTablaTareas[indice][4] != "hecho" ||
      (valoresTablaTareas[indice][4] == "hecho" && fhFilaAnalisis > fhFinTareaOrigen)) {
      filaDestino = indice + 3;
      encontrado = true;
    } else {
      indice--;
    }
  }

  /* Insertamos una nueva linea donde se graba la tarea finalizada
  */
  hjActiva.insertRowBefore(filaDestino);
  let rngDestino = hjActiva.getRange(filaDestino, 1, 1, numColumnas);
  rngDestino.setValues(vlOrigen);
  rngDestino.setBackground(colorOrigen);

  /* Procedemos a borrar la fila origen
  */
  hjActiva.deleteRow(filaorigen);

}

/* Obtiene valor hexdecimal de los colores.
Se le proporciona los valores del rojo, verde y azul
*/
// Función para convertir RGB a Hex
function rgbToHex(r, g, b) {
  const toHex = (c) => c.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

