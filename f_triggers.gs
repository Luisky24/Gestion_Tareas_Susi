/**
 * f_triggers.gs
 * Módulo de triggers del proyecto.
 * Aquí se agruparán funciones de creación/borrado/listado de triggers y puntos de entrada asociados.
 */

const TRIGGERS_CONFIG = [
  {
    nombre: 'triggerCalculoEstadisticas',
    tipo: 'time',
    diaSemana: 'FRIDAY',
    hora: 13,
    minuto: 10,
  },
];

const TRIGGERS_CONFIG_PROPERTY_KEY = 'TRIGGERS_CONFIG';

function guardarConfigTriggers(configArray) {
  if (!Array.isArray(configArray)) {
    throw new Error(
      `guardarConfigTriggers esperaba un array. Recibido: ${Object.prototype.toString.call(configArray)}`
    );
  }

  const raw = JSON.stringify(configArray);
  PropertiesService.getScriptProperties().setProperty(TRIGGERS_CONFIG_PROPERTY_KEY, raw);
}

function obtenerConfigTriggers() {
  const raw = PropertiesService.getScriptProperties().getProperty(TRIGGERS_CONFIG_PROPERTY_KEY);
  if (!raw) {
    throw new Error(
      `No existe la propiedad '${TRIGGERS_CONFIG_PROPERTY_KEY}' en ScriptProperties. ` +
        `Guarda primero la configuración con guardarConfigTriggers(configArray).`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `El JSON de configuración de triggers en ScriptProperties es inválido (clave: ${TRIGGERS_CONFIG_PROPERTY_KEY}). ` +
        `Error original: ${e && e.message ? e.message : String(e)}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `El JSON de configuración de triggers debe ser un array. Recibido: ${Object.prototype.toString.call(parsed)}`
    );
  }

  return parsed;
}

function inicializarConfigTriggers() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(TRIGGERS_CONFIG_PROPERTY_KEY);
  if (existing) {
    Logger.log(
      `La propiedad '${TRIGGERS_CONFIG_PROPERTY_KEY}' ya existe. No se sobrescribe. ` +
        `Si quieres reinicializar, elimina la propiedad manualmente en ScriptProperties.`
    );
    return;
  }

  const configPorDefecto = [
    {
      nombre: 'triggerCalculoEstadisticas',
      tipo: 'time',
      diaSemana: 'FRIDAY',
      hora: 13,
      minuto: 10,
      activo: true,
    },
  ];

  guardarConfigTriggers(configPorDefecto);
  Logger.log(`Configuración de triggers inicializada en ScriptProperties ('${TRIGGERS_CONFIG_PROPERTY_KEY}').`);
}

function eliminarTriggers(nombreFuncion) {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === nombreFuncion) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

function crearTriggerDesdeConfig(config) {
  if (!config || config.tipo !== 'time') {
    throw new Error(`Config de trigger no soportada: ${JSON.stringify(config)}`);
  }

  return ScriptApp.newTrigger(config.nombre)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay[config.diaSemana])
    .atHour(config.hora)
    .nearMinute(config.minuto)
    .create();
}

function crearTodosLosTriggers() {
  const configTriggers = obtenerConfigTriggers();
  configTriggers.forEach((config) => {
    if (!config || config.activo !== true) {
      return;
    }
    eliminarTriggers(config.nombre);
    crearTriggerDesdeConfig(config);
  });
}

function crearTriggerCalculoEstadisticas() {
  const config = TRIGGERS_CONFIG.find((c) => c.nombre === 'triggerCalculoEstadisticas');
  if (!config) {
    throw new Error("No existe configuración para 'triggerCalculoEstadisticas'");
  }

  eliminarTriggers(config.nombre);
  crearTriggerDesdeConfig(config);
}

