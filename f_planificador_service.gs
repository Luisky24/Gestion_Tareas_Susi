/**
 * f_planificador_service.gs
 * Capa de servicio del módulo de planificación.
 * Aquí se centralizará la lógica de negocio/orquestación relacionada con planificación (sin acceso directo a UI ni IO).
 */

function ejecutarCalculoEstadisticas() {
  estadisticasV2();
  // El siguiente proceso son las estadísticas semanales que estan en el archivo f_secundarias.gs
  calculoEstadisticas();

  // Ejecución paralela V3 para validación antes de migración
  try {
    app_ejecutarEstadisticasV3();
  } catch (e) {
    Logger.log(
      `Error en ejecución paralela V3 (app_ejecutarEstadisticasV3): ${
        e && e.message ? e.message : String(e)
      }\n${e && e.stack ? e.stack : ""}`
    );
  }
}

