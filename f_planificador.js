function triggerCalculoEstadisticas() {
  const destinatario = "luiskycv24@gmail.com";  // Cambia por tu email real
  let asunto, cuerpo;

  try {
    estadisticasV2();  // Ejecuta tu función principal

    // El siguiente proceso son las estadísticas semanales que estan en el archivo f_secundarias.gs
    calculoEstadisticas();

    asunto = "Calculo Estadísticas - Éxito";
    cuerpo = "El proceso 'calculoEstadisticas' se ejecutó correctamente sin errores.";
  } catch (error) {
    asunto = "Calculo Estadísticas - Error";
    cuerpo = `El proceso 'calculoEstadisticas' ha fallado con el siguiente error:\n\n${error.message}\n\nStack:\n${error.stack}`;
  }

  MailApp.sendEmail(destinatario, asunto, cuerpo);
}

function crearTriggerCalculoEstadisticas() {
  // Borra triggers previos para esta función
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'triggerCalculoEstadisticas') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Crear nuevo trigger para cada lunes a las 03:00
  ScriptApp.newTrigger('triggerCalculoEstadisticas')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(13)
    .nearMinute(10)
    .create();
}

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





