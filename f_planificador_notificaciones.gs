/**
 * f_planificador_notificaciones.gs
 * Adaptador de notificaciones del módulo de planificación.
 * Aquí se encapsularán envíos (p.ej. MailApp) y formatos de mensajes para el planificador.
 */

/**
 * Email para alertas y notificaciones del planificador.
 *
 * Fuente de verdad:
 * - ScriptProperty `EMAIL_NOTIFICACION`
 *
 * Comportamiento resiliente:
 * - Si no está configurado, devuelve `null` (no lanza excepción).
 * - Los envíos deben ser best-effort: no romper batch/triggers.
 */
function obtenerEmailNotificacion() {
  const desdeProps = PropertiesService.getScriptProperties().getProperty('EMAIL_NOTIFICACION');
  if (desdeProps != null && String(desdeProps).trim() !== '') return String(desdeProps).trim();
  return null;
}

function notificarExito() {
  const destinatario = obtenerEmailNotificacion();
  if (!destinatario) {
    Logger.log("[WARN] No se envía email de éxito: falta configurar ScriptProperty 'EMAIL_NOTIFICACION'.");
    return;
  }
  const asunto = 'Calculo Estadísticas - Éxito';
  const cuerpo = "El proceso 'ejecutarEstadisticasAnaliticas' se ejecutó correctamente sin errores.";
  try {
    MailApp.sendEmail(destinatario, asunto, cuerpo);
  } catch (e) {
    Logger.log('[WARN] Falló el envío de email de éxito. Error: ' + (e && e.message ? e.message : String(e)));
  }
}

function notificarError(error) {
  const destinatario = obtenerEmailNotificacion();
  if (!destinatario) {
    Logger.log("[WARN] No se envía email de error: falta configurar ScriptProperty 'EMAIL_NOTIFICACION'.");
    return;
  }
  const asunto = 'Calculo Estadísticas - Error';
  const msg = error && error.message ? String(error.message) : String(error);
  const stack = error && error.stack ? String(error.stack) : '';
  const cuerpo =
    "El proceso 'ejecutarEstadisticasAnaliticas' ha fallado con el siguiente error:\n\n" +
    msg +
    (stack ? '\n\nStack:\n' + stack : '');
  try {
    MailApp.sendEmail(destinatario, asunto, cuerpo);
  } catch (e) {
    Logger.log('[WARN] Falló el envío de email de error. Error: ' + (e && e.message ? e.message : String(e)));
  }
}

