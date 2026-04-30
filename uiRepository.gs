/**
 * uiRepository.gs
 * Capa UI: encapsula HtmlService y SpreadsheetApp.getUi().
 * Objetivo: evitar uso directo de UI APIs desde Código.gs.
 */

function ui_crearMenu() {
  SpreadsheetApp.getUi()
    .createMenu('Lista Tareas')
    .addItem('Mostrar Barar Lateral', 'mostrarBarraLateral')
    .addToUi();
}

function ui_renderHtml(nombreArchivo) {
  return HtmlService.createHtmlOutputFromFile(nombreArchivo);
}

function ui_renderHtmlContent(nombreArchivo) {
  return ui_renderHtml(nombreArchivo).getContent();
}

function ui_mostrarSidebar(htmlOutput) {
  SpreadsheetApp.getUi().showSidebar(htmlOutput);
}

