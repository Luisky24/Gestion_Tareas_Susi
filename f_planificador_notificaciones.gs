/**
 * f_planificador_notificaciones.gs
 * Adaptador de notificaciones del módulo de planificación.
 * Aquí se encapsularán envíos (p.ej. MailApp) y formatos de mensajes para el planificador.
 */

/** Email para alertas y notificaciones del planificador (override: Script property EMAIL_NOTIFICACION). */
function obtenerEmailNotificacion() {
  const desdeProps = PropertiesService.getScriptProperties().getProperty('EMAIL_NOTIFICACION');
  if (desdeProps != null && String(desdeProps).trim() !== '') return String(desdeProps).trim();
  return 'luiskycv24@gmail.com';
}

function notificarExito() {
  const destinatario = obtenerEmailNotificacion();
  const asunto = "Calculo Estadísticas - Éxito";
  const cuerpo = "El proceso 'ejecutarEstadisticasAnaliticas' se ejecutó correctamente sin errores.";
  MailApp.sendEmail(destinatario, asunto, cuerpo);
}

function notificarError(error) {
  const destinatario = obtenerEmailNotificacion();
  const asunto = "Calculo Estadísticas - Error";
  const cuerpo =
    `El proceso 'ejecutarEstadisticasAnaliticas' ha fallado con el siguiente error:\n\n${error.message}\n\nStack:\n${error.stack}`;
  MailApp.sendEmail(destinatario, asunto, cuerpo);
}

