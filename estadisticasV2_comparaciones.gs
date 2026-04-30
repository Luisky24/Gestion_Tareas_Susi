/**
 * Utilidades de comparación para Estadísticas V2.
 * No modifica funciones existentes: solo ejecuta y compara resultados.
 */

/**
 * Compara los resultados de:
 * - contarTareasAbiertasPorSemana() (original)
 * - contarTareasAbiertasPorSemana_OPT() (optimizada)
 *
 * Muestra en Logger:
 * - "OK: resultados idénticos"
 * - o lista de diferencias: semana, original, optimizada
 */
function compararAbiertasOriginalVsOptimizada() {
  // Inicializar estado (tareas/hechos/hoja) para permitir ejecución independiente.
  prepararHojaEstadisticas();

  // Validación defensiva: si no hay datos cargados, evitar "tareas is not iterable".
  if (!Array.isArray(tareas) || !Array.isArray(hechos)) {
    Logger.log(
      `ERROR: estado no inicializado. ` +
      `tareas=${Object.prototype.toString.call(tareas)} ` +
      `hechos=${Object.prototype.toString.call(hechos)}`
    );
    return { ok: false, diferencias: [{ semana: "STATE", original: "NO_DATA", optimizada: "NO_DATA" }] };
  }

  const original = contarTareasAbiertasPorSemana();
  const optimizada = contarTareasAbiertasPorSemana_OPT();

  const o = original instanceof Map ? original : new Map();
  const p = optimizada instanceof Map ? optimizada : new Map();

  const claves = new Set();
  for (const k of o.keys()) claves.add(k);
  for (const k of p.keys()) claves.add(k);

  const ordenarClave = (k) => {
    const [ay, aw] = String(k).split("||");
    return { anio: Number(ay), semana: Number(aw), raw: String(k) };
  };

  const clavesOrdenadas = Array.from(claves)
    .map(ordenarClave)
    .sort((a, b) => (a.anio - b.anio) || (a.semana - b.semana) || a.raw.localeCompare(b.raw))
    .map((x) => x.raw);

  const diferencias = [];

  for (const clave of clavesOrdenadas) {
    const tieneO = o.has(clave);
    const tieneP = p.has(clave);

    const vo = tieneO ? o.get(clave) : undefined;
    const vp = tieneP ? p.get(clave) : undefined;

    if (!tieneO || !tieneP || vo !== vp) {
      diferencias.push({ semana: clave, original: vo, optimizada: vp });
    }
  }

  if (diferencias.length === 0) {
    Logger.log("OK: resultados idénticos");
    return { ok: true, diferencias: [] };
  }

  Logger.log(`DIFERENCIAS (${diferencias.length}):`);
  for (const d of diferencias) {
    Logger.log(`- ${d.semana}: original=${d.original} optimizada=${d.optimizada}`);
  }

  return { ok: false, diferencias };
}

