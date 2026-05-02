/**
 * f_planificador_service.gs
 * Capa de servicio del módulo de planificación.
 * Aquí se centralizará la lógica de negocio/orquestación relacionada con planificación (sin acceso directo a UI ni IO).
 */

/**
 * Punto único de entrada para todas las estadísticas del sistema.
 * No llamar directamente a funciones internas.
 */
function ejecutarEstadisticasDelSistema() {
  repo_migrarColumnaObjetivoSiNecesario();

  eliminarHojasAnalisisManualLegacy_();

  /**
   * Orquestador de estadísticas del sistema.
   *
   * Este proyecto mantiene **dos sistemas** de estadísticas:
   * - **Flujo (operativo)**: métricas simples para seguimiento del funcionamiento semanal.
   * - **Analítico (reporting)**: reporte más rico para análisis de rendimiento.
   *
   * IMPORTANTE:
   * - **NO son equivalentes** (no generan las mismas hojas, ni las mismas métricas/dimensiones).
   * - **Ambos son necesarios actualmente** para cubrir operación + análisis.
   * - **No eliminar** uno de los dos sin un análisis funcional del reporting y de los consumidores actuales.
   */

  // Feature flags (control de activación):
  // - Útil para pruebas, despliegues graduales y control operativo.
  // - NO sustituye a eliminar código: desactivar no implica que sea “seguro borrar” sin análisis.
  const CONFIG_ESTADISTICAS = {
    flujo: true,
    analitico: true,
  };

  // A) `ejecutarEstadisticasFlujo()`
  // - Genera **métricas operativas** en la hoja `Estadisticas`.
  // - Tipo de métricas: **nuevas**, **abiertas**, **cerradas** (agregación semanal ISO).
  // - Uso: seguimiento del sistema / flujo de trabajo (monitorización operativa).
  if (CONFIG_ESTADISTICAS.flujo === true) {
    ejecutarEstadisticasFlujo();
  }

  // B) `ejecutarEstadisticasAnaliticas()`
  // - Genera **reporting analítico** en la hoja `Resumen Semanal`.
  // - Incluye segmentación por **estado** y **prioridad**, y cálculos como **medias** (y otras medidas analíticas).
  // - Uso: análisis de rendimiento (duraciones, desviaciones y seguimiento histórico).
  if (CONFIG_ESTADISTICAS.analitico === true) {
    ejecutarEstadisticasAnaliticas();
  }

  ejecutarToastInteligenteDashboardSiCorresponde();

  ejecutarAlertasProactivasDashboardSiCorresponde();
}

function ejecutarCalculoEstadisticas() {
  ejecutarEstadisticasDelSistema();
}

