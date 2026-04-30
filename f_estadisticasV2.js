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
let annoProceso;
let semanaProceso;
let tareas;
let hechos;

function estadisticasV2() {

  try {

    // Obtener fecha del día para obtener mes y semana del dia de proceso para poder
    // saber que tareas se han abierto o cerrado en esa semana
    //hoy.setHours(0, 0, 0, 0);
    let annoSemanaProceso = obtenerAnioYSemana(new Date());
    //annoProceso = annoSemanaProceso.anno;
    //semanaProceso = annoSemanaProceso.semana;

    // Borramos y creamos la hoja
    // Obtenemos la información para los cálculos
    prepararHojaEstadisticas();

    let contadorNuevas = contarTareasNuevas();
    let contadorCerradas = contarTareasCerradas();

    let contadorAbiertas = contarTareasAbiertasPorSemana();

    let nuevasAbiertasCerradas = unirNuevasAbiertasCerradas(contadorNuevas, contadorCerradas, contadorAbiertas);

    nuevasAbiertasCerradas = ordenarAbiertasCerradas(nuevasAbiertasCerradas);

    const valores = formatearDatos(nuevasAbiertasCerradas);

    grabarEnHjEstadisticas(valores);

    log("Proceso estadísticas finalizado de forma correcta");

  } catch (error) {
    registrarError("estadisticasV2", error);
  }

}

function grabarEnHjEstadisticas(valores) {

  try {

    // Comprobamos que existe la hoja
    if (!hoja) {
      throw new Error('No existe la hoja "Estadísticas"');
    }

    // Escribimos los valores debajo de la cabecera
    if (valores.length > 0) {
      hoja.getRange(2, 1, valores.length, valores[0].length).setValues(valores);
    }
  } catch (error) {
    registrarError("estadisticasV2.grabarEnHjEstadisticas", error);
    return [0, 0, 0, 0];
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

function grabarEnHjEstadisticas(valores) {
  try {
    if (!hoja) throw new Error('No existe la hoja "Estadísticas"');

    if (valores.length > 0) {
      hoja.getRange(2, 1, valores.length, valores[0].length).setValues(valores);
    } else {
      throw new Error('No hay valores para escribir.');
    }

  } catch (error) {
    registrarError("grabarEnHjEstadisticas", error);
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
  const resultado = new Map();
  let hoy = new Date();
  let ultimoDiaSemanaHoy = ultimoDiaSemana(hoy);
  hoy.setHours(0, 0, 0, 0);

  for (const tarea of tareas) {
    const fechaInicioStr = tarea[0];
    const fechaFin = tarea[6];

    // Solo procesar tareas abiertas
    if (!fechaFin || fechaFin === "") {
      const fechaInicio = convertirAFecha(fechaInicioStr);
      if (!fechaInicio) continue;

      // Recorremos semana a semana desde inicio hasta hoy
      let fechaActual = new Date(fechaInicio);
      //console.log("NUEVA");
      while (fechaActual.getTime() <= ultimoDiaSemanaHoy.getTime()) {
        const annoSemana = obtenerAnioYSemana(fechaActual);
        const clave = `${annoSemana.anno}||${annoSemana.semana}`;
        /*
        if(annoSemana.semana == 44 || annoSemana.semana == 43) {
          console.log('Fecha Inicio: ' + fechaInicio + " Actual: " + fechaActual);
          console.log('Fecha hoy: ' + ultimoDiaSemanaHoy);
          console.log('Semana: ' + annoSemana.semana);
        }
        */
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

  let mapa1 = new Map();

  let union = [...tareas, ...hechos];

  const unionConFechaFin = union.filter(ele => {
    const fin = ele[6];
    return fin != null && fin.toString().trim() !== "";
  });

  mapa1 = contarXTipo(mapa1, unionConFechaFin, 'C');

 //console.log("Parada");

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

  valores.forEach(ele => {

    // Obtener año y semana de una fecha
    let fecha = ele[0];

    if (tipo == 'C') {
      fecha = ele[6];
    }

    let annoSemana = obtenerAnioYSemana(fecha);
    
    let clave = annoSemana.anno + '||' + annoSemana.semana;
    let valorActualContador = mapa.get(clave) ?? 0;
    mapa.set(clave, valorActualContador + 1);

  })

  //console.log("Parada");

  return mapa;

}

function obtenerAnioYSemana(fechaIN) {
  let fecha = fechaIN;
  if (typeof fechaIN === "string") {
    fecha = convertirAFecha(fechaIN)
  };
  let anno = fecha.getFullYear();
  const [semana, annoSemana] = obtenerSemanaISO(fecha);
  
  if (anno != annoSemana) {anno = annoSemana};
  return {anno, semana};
}

function convertirAFecha(str) {
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function obtenerSemanaISO(fecha) {
  const fechaCopia = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));

  // Ajustar al jueves de la semana actual (ISO define semana según el jueves)
  const diaSemana = fechaCopia.getUTCDay() || 7; // domingo=7
  fechaCopia.setUTCDate(fechaCopia.getUTCDate() + 4 - diaSemana);

  // Obtener el primer día del año
  const inicioAnno = new Date(Date.UTC(fechaCopia.getUTCFullYear(), 0, 1));

  // Calcular número de semana
  const semana = Math.ceil((((fechaCopia - inicioAnno) / 86400000) + 1) / 7);
  const annoSemana = fechaCopia.getFullYear();

  return [semana, annoSemana];
}

function ultimoDiaSemana(fecha) {
  const f = new Date(fecha); // copia para no alterar el original
  const diaSemana = f.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado

  // si hoy es domingo (0), ya es el último día de la semana
  if (diaSemana !== 0) {
    f.setDate(f.getDate() + (7 - diaSemana)); // avanza hasta domingo
  }

  f.setHours(0, 0, 0, 0); // opcional: normalizar hora
  return f;
}


function obtenerDatosHoja(hojaBusqueda) {
  try {
    const hoja = libro.getSheetByName(hojaBusqueda);
    if (!hoja) throw new Error(`No existe la hoja "${hojaBusqueda}"`);

    const numFilas = hoja.getLastRow();
    if (numFilas <= 1) return []; // solo cabecera

    const numColumnas = hoja.getLastColumn();
    const rango = hoja.getRange(2, 1, numFilas - 1, numColumnas);
    return rango.getDisplayValues();

  } catch (error) {
    registrarError("obtenerDatosHoja", error);
    return [];
  }
}

function prepararHojaEstadisticas() {
  try {
    if (existeHoja()) {
      borrarHoja();
    }

    crearHoja(3);
    hoja.getRange(1, 1, 1, cabeceras.length).setValues([cabeceras]);

    tareas = obtenerDatosHoja("Tareas");
    hechos = obtenerDatosHoja("Hecho");

    //console.log("Parada");

  } catch (error) {
    registrarError("prepararHojaEstadisticas", error);
    throw error; // detiene proceso si falla esta parte crítica
  }
}

function existeHoja() {
  //const hoja = libro.getSheetByName(nombreHoja);
  return hoja !== null;
}

function borrarHoja() {
  try {
    libro.deleteSheet(hoja);
  } catch (error) {
    registrarError("borrarHoja", error);
  }
}

function crearHoja(posicionLibro) {
  try {
    libro.insertSheet(nombreHoja, posicionLibro);
    hoja = libro.getSheetByName(nombreHoja);
  } catch (error) {
    registrarError("crearHoja", error);
  }
}

/* -------------------------------------------------- */
/* --- FUNCIONES DE ERROR --- */
/* -------------------------------------------------- */

function registrarError(funcion, error) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let hojaErrores = ss.getSheetByName('Errores_Estadisticas');

    if (!hojaErrores) {
      hojaErrores = ss.insertSheet('Errores_Estadisticas');
      hojaErrores.appendRow(['Fecha', 'Función', 'Mensaje', 'Detalle']);
    }

    const fecha = new Date();
    hojaErrores.appendRow([
      fecha,
      funcion,
      error.message || 'Error sin mensaje',
      error.stack || ''
    ]);

    error(`❌ Error en ${funcion}: ${error.message}`);

  } catch (e) {
    Logger.log("Error al registrar error: " + e.message);
  }
}

