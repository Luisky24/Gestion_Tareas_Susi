function log(...args) {
  console.log('[APP]', ...args);
}

function error(...args) {
  console.error('[APP ERROR]', ...args);
}

const libro = SpreadsheetApp.getActiveSpreadsheet();
const nombreHoja = "Estadisticas";
let hoja = libro.getSheetByName(nombreHoja);
const cabeceras = ["Año", "Semana", "Tareas Nuevas", "Tareas Abiertas", "Tareas Cerradas"];
let tareas;
let hechos;

function estadisticasV2() {

  try {

    // Borramos y creamos la hoja
    // Obtenemos la información para los cálculos
    prepararHojaEstadisticas();

    let contadorNuevas = contarTareasNuevas();
    let contadorCerradas = contarTareasCerradas();

    // Versión optimizada (deltas + prefijo). Validada contra versión original.
    let contadorAbiertas = contarTareasAbiertasPorSemana_OPT();

    let nuevasAbiertasCerradas = unirNuevasAbiertasCerradas(contadorNuevas, contadorCerradas, contadorAbiertas);

    nuevasAbiertasCerradas = ordenarAbiertasCerradas(nuevasAbiertasCerradas);

    const valores = formatearDatos(nuevasAbiertasCerradas);

    grabarEnHjEstadisticas(valores);

    log("Proceso estadísticas finalizado de forma correcta");

  } catch (error) {
    registrarError("estadisticasV2", error);
  }

}

function formatearDatos(nuevasAbiertasCerradas) {
  // Formatear datos

  try {
    const valores = nuevasAbiertasCerradas.map(obj => {
      try {
        const [anio, semana] = obj.CampoClave.split('||');
        return [
          Number(anio),
          Number(semana),
          obj.Nuevas || 0,
          obj.Abiertas || 0,
          obj.Cerradas || 0
        ];
      } catch (error) {
        registrarError("estadisticasV2.map", error);
        return [0, 0, 0, 0, 0];
      }
    });

    return valores;

  } catch (error) {
    registrarError("formatearDatos", error);
    throw error; // detiene proceso si falla esta parte crítica
  }

}

function ordenarAbiertasCerradas(nuevasAbiertasCerradas) {

  nuevasAbiertasCerradas.sort((a,b)=>{
    
    const [ay, am] = a.CampoClave.split("||").map(x => Number(x.trim()));
    const [by, bm] = b.CampoClave.split("||").map(x => Number(x.trim()));

    // Primero por año descendente
    if (ay !== by) return by - ay;

    // Luego por mes/semana descendente
    return bm - am;

  });

  return nuevasAbiertasCerradas;

}


function contarTareasAbiertasPorSemana() {
  // Índices del modelo de datos (filas leídas con getDisplayValues)
  const IDX_FECHA_INICIO = 0;
  const IDX_FECHA_FIN = 6;

  const resultado = new Map();
  let hoy = new Date();
  let ultimoDiaSemanaHoy = ultimoDiaSemana(hoy);
  hoy.setHours(0, 0, 0, 0);

  for (const tarea of tareas) {
    const fechaInicioStr = tarea[IDX_FECHA_INICIO];
    const fechaFin = tarea[IDX_FECHA_FIN];

    // Solo procesar tareas abiertas
    if (!fechaFin || fechaFin === "") {
      const fechaInicio = convertirAFecha(fechaInicioStr);
      if (!fechaInicio) continue;

      // Recorremos semana a semana desde inicio hasta hoy
      let fechaActual = new Date(fechaInicio);
      while (fechaActual.getTime() <= ultimoDiaSemanaHoy.getTime()) {
        const annoSemana = obtenerAnioYSemana(fechaActual);
        const clave = `${annoSemana.anno}||${annoSemana.semana}`;
        let valorActual = resultado.get(clave) ?? 0;
        resultado.set(clave, valorActual + 1);

        // Avanzar una semana
        fechaActual.setDate(fechaActual.getDate() + 7);
      }
    }
  }

  return resultado;
}

function unirNuevasAbiertasCerradas(nuevas, cerradas, abiertas) {

  // Unimos y obtenemos una sola clave para ambas estructuras
  let claves = new Set([...nuevas.keys(), ...cerradas.keys(), ...abiertas.keys()]);

  // Por cada clave verificamos si existe en abiertas y cerradas y si existe añadimos o ponemos cerro en un
  // array que porcada elmento tiene la estructura clave, vloa abiertas, valor cerradas
  let resultado = []
  for (clave of claves) {
    const valorNuevas = nuevas.get(clave) ?? 0;
    const valorCerrada = cerradas.get(clave) ?? 0;
    const valorAbiertas = abiertas.get(clave) ?? 0;

    resultado.push({ ['CampoClave']: clave, ['Nuevas']: valorNuevas, ['Abiertas']: valorAbiertas, ['Cerradas']: valorCerrada });

  }

  //console.log("Parada");

  return resultado;

}

function contarTareasCerradas() {
  // Índice del modelo de datos (fecha fin real)
  const IDX_FECHA_FIN = 6;

  let mapa1 = new Map();

  let union = [...tareas, ...hechos];

  const unionConFechaFin = union.filter(ele => {
    const fin = ele[IDX_FECHA_FIN];
    return fin != null && fin.toString().trim() !== "";
  });

  mapa1 = contarXTipo(mapa1, unionConFechaFin, 'C');

  //return Array.from(mapa1, ([grupo, suma]) => ({grupo,suma}));
  return mapa1;

}

function contarTareasNuevas() {

  let mapa = new Map;

  let union = [...tareas, ...hechos];

  mapa = contarXTipo(mapa, union, 'N');

  // console.log("Parada");

  //return Array.from(mapa, ([grupo,suma]) => ({grupo, suma}));
  return mapa;

}

// Cuenta el número de elmentos de un array que cumple unas condiciones
// El contaje se hace sobre un Map que se recibe y un los elementos se reciben
// en array donde ada elemento es otro array

function contarXTipo(mapa, valores, tipo) {
  // Índices del modelo de datos (fecha alta / fecha fin real)
  const IDX_FECHA_INICIO = 0;
  const IDX_FECHA_FIN = 6;

  valores.forEach(ele => {

    // Obtener año y semana de una fecha
    let fecha = ele[IDX_FECHA_INICIO];

    if (tipo == 'C') {
      fecha = ele[IDX_FECHA_FIN];
    }

    let annoSemana = obtenerAnioYSemana(fecha);
    
    let clave = annoSemana.anno + '||' + annoSemana.semana;
    let valorActualContador = mapa.get(clave) ?? 0;
    mapa.set(clave, valorActualContador + 1);

  })

  //console.log("Parada");

  return mapa;

}
