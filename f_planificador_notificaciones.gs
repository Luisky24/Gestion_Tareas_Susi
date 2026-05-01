/**
 * f_planificador_notificaciones.gs
 * Adaptador de notificaciones del módulo de planificación.
 * Aquí se encapsularán envíos (p.ej. MailApp) y formatos de mensajes para el planificador.
 */

function notificarExito() {
  const destinatario = "luiskycv24@gmail.com"; // Cambia por tu email real
  const asunto = "Calculo Estadísticas - Éxito";
  const cuerpo = "El proceso 'ejecutarEstadisticasAnaliticas' se ejecutó correctamente sin errores.";
  MailApp.sendEmail(destinatario, asunto, cuerpo);
}

function notificarError(error) {
  const destinatario = "luiskycv24@gmail.com"; // Cambia por tu email real
  const asunto = "Calculo Estadísticas - Error";
  const cuerpo =
    `El proceso 'ejecutarEstadisticasAnaliticas' ha fallado con el siguiente error:\n\n${error.message}\n\nStack:\n${error.stack}`;
  MailApp.sendEmail(destinatario, asunto, cuerpo);
}

