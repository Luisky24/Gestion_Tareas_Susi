    
    function startAction(opcion) {
      let nbOpcion = "";
      try {
    
      switch (opcion) {
        case 1: nbOpcion = 'Nueva Tarea';
                break;
        case 2: nbOpcion = 'Finalizar Tarea';;
                break;
        case 3: nbOpcion = 'Reactivar Tarea';;
                break;
        case 4: nbOpcion = 'Borrar Tarea';;
                break;
        case 5: nbOpcion = 'Reorganizar Tareas';;
                break;
        case 6: nbOpcion = 'Traspasar Tareas Finalizadas';;
                break;
        default:
          throw new Error("Opción seleccionada no existe");

      }

  } catch(err) {
    throw new Error(err.message);
  }
      let inicio = `Inicio proceso... ${nbOpcion}`;
      updateStatus(inicio);
      console.log("start ");
      desactivarBotones();
      // Llamada al servidor con un manejador de éxito
      google.script.run
        .withSuccessHandler((error) => updateStatus(`Proceso completado.`))
        .withFailureHandler((error) => updateStatus(`Error: ${error.message}`))
        .gestorOpciones(opcion);
    }

    function updateStatus(message) {
      activarBotones();
      const defaultStatus = "<< Puede seleccionar otra opción >>";
      const statusElement = document.getElementById('status');
      statusElement.innerText = `Estado: ${message}`;

      // Restaurar el estado inicial después de 10 segundos (10,000 ms)
      clearTimeout(statusElement.timeout); // Cancelar cualquier temporizador previo
      statusElement.timeout = setTimeout(() => {
        statusElement.innerText = defaultStatus;
      }, 10000); // 10,000 ms = 10 segundos
    }

    function desactivarBotones() {
      const buttons = document.querySelectorAll("#opciones button");
      buttons.forEach(button => (button.disabled = true)); // Desactiva todos los botones
    }

    function activarBotones() {
      const buttons = document.querySelectorAll("#opciones button");
      buttons.forEach(button => (button.disabled = false));
    }

    (function(){console.log(`Bundle cargado correctamente desde Vite`)})();
