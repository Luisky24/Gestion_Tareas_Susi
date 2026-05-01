/**
 * Utilidades de fechas para Estadísticas V2.
 * Mantiene nombres/firmas/lógica exactamente igual que en `f_estadisticas_flujo.js`.
 */

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

