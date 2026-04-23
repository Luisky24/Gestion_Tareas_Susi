
function calculoEstadisticas() {
  procesarResumenPorFechaFin('Tareas', 'Hecho');
}

function procesarResumenPorFechaFin(...nombresHojas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const hojaErrores = ss.getSheetByName('Errores') || ss.insertSheet('Errores');
  hojaErrores.clearContents();
  hojaErrores.appendRow(['Hoja', 'Fila', 'Mensaje']);

  if (nombresHojas.length < 1 || nombresHojas.length > 2) {
    hojaErrores.appendRow(['-', '-', 'Número inválido de hojas. Se espera una o dos.']);
    return;
  }

  const hojaResumen = ss.getSheetByName('Resumen Semanal') || ss.insertSheet('Resumen Semanal');
  hojaResumen.clearContents();

  // Obtener ambos resúmenes
  const resumenHechas = calcularResumenHechas(nombresHojas, hojaErrores);
  const resumenNoHechas = calcularResumenNoHechas(nombresHojas, hojaErrores);

  const salidaCombinada = resumenHechas.concat(resumenNoHechas);
  const salidaOrdenada = ordenarSalidaResumen(salidaCombinada);

  // Asegurar uniformidad de columnas
  const numColumnas = salidaOrdenada[0].length;
  for (let i = 1; i < salidaOrdenada.length; i++) {
    while (salidaOrdenada[i].length < numColumnas) {
      salidaOrdenada[i].push('');
    }
  }

  hojaResumen.getRange(1, 1, salidaOrdenada.length, numColumnas).setValues(salidaOrdenada);


  console.log("Proceso resumen semanal finalizado de forma correcta");

}

function calcularResumenHechas(nombresHojas, hojaErrores) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultados = {};
  const salida = [['Año', 'Semana', 'Estado', 'Prioridad', 'Número de Tareas', 'Media Días desde Inicio', 'Desviación Media en Días', 'Tareas nuevas semana', 'Total tareas no hechas']];

  nombresHojas.forEach(nombreHoja => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) {
      hojaErrores.appendRow([nombreHoja, '-', 'La hoja no existe.']);
      return;
    }

    const datos = hoja.getDataRange().getValues();
    datos.shift(); // quitar encabezado

    const IDX_FECHA = 0;
    const IDX_PRIORIDAD = 2;
    const IDX_ESTADO = 4;
    const IDX_FECHA_FIN_EST = 5;
    const IDX_FECHA_FIN = 6;

    datos.forEach((row, idx) => {
      const fila = idx + 2;
      const estado = String(row[IDX_ESTADO] || '').toLowerCase();
      if (estado !== 'hecho') return;

      const fechaInicio = new Date(row[IDX_FECHA]);
      const fechaFin = new Date(row[IDX_FECHA_FIN]);
      let fechaFinEstimada = new Date(row[IDX_FECHA_FIN_EST]);
      if (isNaN(fechaFinEstimada)) fechaFinEstimada = fechaFin;

      if (isNaN(fechaInicio) || isNaN(fechaFin)) {
        hojaErrores.appendRow([nombreHoja, fila, 'Fechas inválidas.']);
        return;
      }

      const semana = getWeekNumber(fechaFin);
      const anio = fechaFin.getFullYear();
      const prioridad = row[IDX_PRIORIDAD] || 'Sin Prioridad';
      const clave = `${anio}-W${String(semana).padStart(2, '0')}-${estado}-${prioridad}`;

      if (!resultados[clave]) resultados[clave] = {
        anio, semana, estado, prioridad,
        numTareas: 0, sumaDias: 0, sumaDesv: 0
      };

      const dias = Math.round((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24));
      const desv = Math.round((fechaFin - fechaFinEstimada) / (1000 * 60 * 60 * 24));

      resultados[clave].numTareas++;
      resultados[clave].sumaDias += dias;
      resultados[clave].sumaDesv += desv;
    });
  });

  for (const clave in resultados) {
    const r = resultados[clave];
    salida.push([
      r.anio,
      r.semana,
      r.estado,
      r.prioridad,
      r.numTareas,
      Math.round(r.sumaDias / r.numTareas),
      Math.round(r.sumaDesv / r.numTareas),
      '',
      ''
    ]);
  }

  return salida;
}

function calcularResumenNoHechas(nombresHojas, hojaErrores) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultados = {};
  const salida = [];

  nombresHojas.forEach(nombreHoja => {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return;

    const datos = hoja.getDataRange().getValues();
    datos.shift(); // quitar encabezado

    const IDX_FECHA = 0;
    const IDX_PRIORIDAD = 2;
    const IDX_ESTADO = 4;

    datos.forEach((row, idx) => {
      const fila = idx + 2;
      const estado = String(row[IDX_ESTADO] || '').toLowerCase();
      if (estado === 'hecho') return;

      const fechaInicio = new Date(row[IDX_FECHA]);
      if (isNaN(fechaInicio)) {
        hojaErrores.appendRow([nombreHoja, fila, 'Fecha de inicio inválida (tarea no hecha).']);
        return;
      }

      const semana = getWeekNumber(fechaInicio);
      const anio = fechaInicio.getFullYear();
      const prioridad = row[IDX_PRIORIDAD] || 'Sin Prioridad';
      const clave = `${anio}-W${String(semana).padStart(2, '0')}-${estado}-${prioridad}`;

      if (!resultados[clave]) resultados[clave] = {
        anio, semana, estado, prioridad,
        nuevas: 0, total: 0
      };

      resultados[clave].nuevas++;
      resultados[clave].total++;
    });
  });

  for (const clave in resultados) {
    const r = resultados[clave];
    salida.push([
      r.anio,
      r.semana,
      r.estado,
      r.prioridad,
      '', '', '', // columnas de tareas hechas
      r.nuevas,
      r.total
    ]);
  }

  return salida;
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function ordenarSalidaResumen(data) {
  const [encabezado, ...filas] = data;
  filas.sort((a, b) => {
    if (a[0] !== b[0]) return b[0] - a[0]; // Año desc
    if (a[1] !== b[1]) return b[1] - a[1]; // Semana desc
    if (a[2] !== b[2]) return String(a[2]).localeCompare(String(b[2])); // Estado asc
    return String(a[3]).localeCompare(String(b[3])); // Prioridad asc
  });
  return [encabezado, ...filas];
}

