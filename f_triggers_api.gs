/**
 * f_triggers_api.gs
 * Endpoints backend (tipo API) para gestionar la configuración de triggers.
 *
 * Nota: Este archivo NO implementa lógica de triggers; delega en las funciones auxiliares:
 * - obtenerConfigTriggers
 * - guardarConfigTriggers
 * - crearTodosLosTriggers
 */

/**
 * Obtiene la configuración actual de triggers desde PropertiesService.
 * @returns {Array} Array de configuraciones de triggers.
 */
function apiObtenerTriggers() {
  return obtenerConfigTriggers();
}

/**
 * Guarda la configuración de triggers en PropertiesService.
 * @param {Array} config - Array de configuraciones.
 */
function apiGuardarTriggers(config) {
  guardarConfigTriggers(config);
}

/**
 * Elimina y vuelve a crear todos los triggers según la configuración actual.
 */
function apiRecrearTriggers() {
  crearTodosLosTriggers();
}

/**
 * Inicializa la configuración de triggers en ScriptProperties (solo si no existe)
 * y devuelve la configuración resultante.
 *
 * Esto permite una UX “primer uso” sin duplicar defaults en frontend.
 * @returns {Array} Configuración actual tras inicializar.
 */
function apiInicializarTriggersConfig() {
  inicializarConfigTriggers();
  return obtenerConfigTriggers();
}

