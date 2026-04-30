/**
 * f_planificador_service.gs
 * Capa de servicio del módulo de planificación.
 * Aquí se centralizará la lógica de negocio/orquestación relacionada con planificación (sin acceso directo a UI ni IO).
 */

function ejecutarCalculoEstadisticas() {
  estadisticasV2();
  // El siguiente proceso son las estadísticas semanales que estan en el archivo f_secundarias.gs
  calculoEstadisticas();
}

