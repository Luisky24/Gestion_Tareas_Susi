function triggerCalculoEstadisticas() {
  try {
    ejecutarCalculoEstadisticas();
    notificarExito();
  } catch (error) {
    notificarError(error);
  }
}





