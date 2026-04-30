/**
 * f_triggers_debug.gs
 * Utilidades de depuración para triggers (logs, inspección, diagnósticos).
 * Este fichero contendrá helpers no críticos para producción, pensados para facilitar troubleshooting.
 */

function listarTriggersActivosLogger() {
  const triggers = ScriptApp.getProjectTriggers();

  if (triggers.length === 0) {
    Logger.log("No hay triggers activos.");
    return;
  }

  triggers.forEach((trigger, index) => {
    Logger.log(`Trigger ${index + 1}:`);
    Logger.log(`  Función: ${trigger.getHandlerFunction()}`);
    Logger.log(`  Tipo de Evento: ${trigger.getEventType()}`);
    Logger.log(`  Fuente del Trigger: ${trigger.getTriggerSource()}`);
  });
}

