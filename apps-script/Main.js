/**
 * Finanzas · Menú, disparadores y automatizaciones
 *
 *  onOpen      → menú + foco en el mes actual (años anteriores colapsados)
 *  onEdit      → arrastre de precios, vencimientos, fórmulas, categorías
 *  alCambiar   → al insertar/borrar filas, recalcula subtotales (instalable)
 *  tareaDiaria → cierre de mes, débitos automáticos, índices, calendario (7 AM)
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('💰 Finanzas')
    .addItem('➕ Cargar gasto o ingreso', 'abrirPanel')
    .addItem('📊 Dashboard', 'abrirDashboard')
    .addItem('🎯 Ir al mes actual', 'irAlMesActual')
    .addSeparator()
    .addItem('🗓️ Sincronizar calendario ahora', 'menuCalendario')
    .addItem('📈 Actualizar inflación y dólar', 'menuIndices')
    .addItem('🔧 Reparar fórmulas y formato', 'menuReparar')
    .addSeparator()
    .addItem('⚙️ Instalar / actualizar sistema', 'menuInstalar')
    .addToUi();
  try {
    var sh = hoja_();
    if (sh && estaInstalado_(sh)) enfocarMesActual(sh);
  } catch (e) { console.warn(e); }
}

function estaInstalado_(sh) {
  return String(sh.getRange(3, FZ.COL_TIPO).getValue()) === 'RES:I';
}

function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet(), nombre = sh.getName();
  try {
    if (nombre === FZ.HOJA) alEditarFinanzas_(e);
    else if (nombre === FZ.HOJA_MOV) alEditarMovimientos_(e);
    else if (nombre === FZ.HOJA_IND) alEditarIndices_(e);
  } catch (err) {
    console.error(err);
    e.source.toast(String(err && err.message || err), '⚠️ Finanzas', 6);
  }
}

function alEditarFinanzas_(e) {
  var r = e.range, sh = r.getSheet();
  var f0 = r.getRow(), f1 = r.getLastRow(), c0 = r.getColumn(), c1 = r.getLastColumn();
  if (f1 < 3 || !estaInstalado_(sh)) return;
  var est = leerEstructura(sh);
  var enRango = function (it) { return it.fila >= f0 && it.fila <= f1; };
  var toca = function (col) { return c0 <= col && c1 >= col; };
  var ss = e.source;

  // Nombre: fila nueva o renombrada → fórmulas, validaciones y valores por defecto
  if (toca(FZ.COL_NOMBRE)) {
    est.items.filter(function (it) { return enRango(it) && !it.mov; }).forEach(function (it) {
      if (!sh.getRange(it.fila, FZ.COL_PROY).getValue()) sh.getRange(it.fila, FZ.COL_PROY).setValue(modoProyeccionSugerido(it.nombre));
    });
    reconstruirFormulas(sh, est);
    aplicarValidaciones_(sh, est);
    if (est.items.some(function (it) { return enRango(it) && it.mov; })) actualizarValidacionMovimientos_(est);
  }

  // Vencimiento: interpretar la regla y mostrar el próximo
  if (toca(FZ.COL_VENCE)) {
    actualizarProximos(sh, est);
    if (f0 === f1) {
      var regla = parsearRegla(sh.getRange(f0, FZ.COL_VENCE).getValue());
      if (regla && regla.error) ss.toast(regla.error, '🤔 Vencimiento', 8);
      else if (regla) {
        var prox = proximoVencimiento(regla, new Date(), leerFeriados());
        ss.toast(describirRegla(regla) + (prox ? ' · próximo: ' + fechaCorta_(prox) : ''), '📅 Vencimiento', 5);
      }
    }
  }

  // Modo de proyección cambiado
  if (toca(FZ.COL_PROY)) {
    reproyectar(sh, est, est.items.filter(enRango).map(function (it) { return it.fila; }));
  }

  // Montos
  if (c1 >= FZ.COL_MES0) {
    var estructurales = [];
    Object.keys(est.resumen).forEach(function (k) { estructurales.push(est.resumen[k]); });
    est.secciones.forEach(function (s) { estructurales.push(s.fila); });
    est.categorias.forEach(function (c) { estructurales.push(c.fila); });
    var tocaTotal = est.totales.some(function (t) { return toca(t.col); });
    if (tocaTotal || estructurales.some(function (f) { return f >= f0 && f <= f1; })) {
      reconstruirFormulas(sh, est);
      ss.toast('Los totales y subtotales se calculan solos: se restauró la fórmula.', 'Finanzas', 4);
    }
    var items = est.items.filter(enRango);
    var fijos = items.filter(function (it) { return !it.mov; });
    if (items.some(function (it) { return it.mov; })) reconstruirFormulas(sh, est);
    if (!fijos.length) return;
    var desde = Math.max(c0, FZ.COL_MES0);
    fijos.forEach(function (it) { marcarConfirmado_(sh.getRange(it.fila, desde, 1, c1 - desde + 1)); });
    var n = reproyectar(sh, est, fijos.map(function (it) { return it.fila; }));
    if (n && fijos.length === 1) {
      ss.toast('Los meses siguientes de "' + fijos[0].nombre + '" se actualizaron (' + n + ').', '↻ Arrastre', 4);
    }
  }
}

/** Disparador instalable onChange: filas insertadas o borradas. */
function alCambiar(e) {
  if (!e || ['INSERT_ROW', 'REMOVE_ROW', 'INSERT_COLUMN', 'REMOVE_COLUMN'].indexOf(e.changeType) < 0) return;
  var sh = hoja_();
  if (!sh || !estaInstalado_(sh)) return;
  var est = leerEstructura(sh);
  if (e.changeType === 'INSERT_ROW') limpiarFilasNuevas_(sh, est);
  reconstruirFormulas(sh, est);
  aplicarGrupos_(sh, est);
  aplicarValidaciones_(sh, est);
}

/** Filas en blanco dentro de una sección: estilo de ítem (no heredan el de un encabezado). */
function limpiarFilasNuevas_(sh, est) {
  var izq = sh.getRange(1, 1, est.ultimaFila, 2).getValues();
  var lc = est.ultimaCol;
  for (var f = 3; f < est.ultimaFila; f++) {
    var vacia = !String(izq[f - 1][0]).trim() && !String(izq[f - 1][1]).trim();
    var siguienteEsSeccion = String(izq[f][0]).indexOf(FZ.SEC) === 0;
    if (!vacia || siguienteEsSeccion) continue;
    if (sh.getRowHeight(f) > 12 && sh.getRange(f, FZ.COL_NOMBRE).getBackground() === FZ.C.fondo) continue;
    sh.setRowHeight(f, 26);
    sh.getRange(f, 1, 1, lc).setBackground(FZ.C.fondo).setFontWeight('normal').setFontColor(FZ.C.tinta).setFontStyle('normal').setFontSize(10)
      .setBorder(false, false, true, false, false, false, FZ.C.linea, SpreadsheetApp.BorderStyle.SOLID);
    est.totales.forEach(function (t) { sh.getRange(f, t.col).setBackground(FZ.C.fondoTotal).setFontWeight('bold'); });
  }
}

/** Todos los días a la mañana. */
function tareaDiaria() {
  var sh = hoja_();
  if (!sh || !estaInstalado_(sh)) return;
  var props = PropertiesService.getDocumentProperties();
  var cfg = leerConfig(), hoy = new Date();
  if (asegurarLineaDeTiempo(sh)) {
    var e0 = leerEstructura(sh);
    reconstruirFormulas(sh, e0);
    aplicarFormato(sh, e0);
  }
  var est = leerEstructura(sh);
  var idx = indiceMes_(est, hoy);
  var opts = { confirmar: [] };
  if (props.getProperty('ultimoMes') !== isoMes_(hoy) && cfg.cerrarMes) opts.confirmarAntesDe = idx;
  if (cfg.confirmarDA && idx >= 0) {
    var fer = leerFeriados();
    est.items.forEach(function (it) {
      if (it.mov || !/debito|automatico/.test(norm_(it.medio))) return;
      var regla = parsearRegla(it.vence);
      if (!regla || regla.error) return;
      var f = fechaRegla(regla, hoy.getFullYear(), hoy.getMonth(), fer);
      if (f && f <= hoy) opts.confirmar.push({ fila: it.fila, idx: idx });
    });
  }
  reproyectar(sh, est, null, opts);
  props.setProperty('ultimoMes', isoMes_(hoy));
  actualizarProximos(sh, est);

  var ts = Number(props.getProperty('indicesTs') || 0);
  if (Date.now() - ts > 6 * 864e5) { try { actualizarIndices(); } catch (e) { console.warn(e); } }
  try {
    var fers = leerFeriados();
    var prox = String(hoy.getFullYear() + 1);
    if (!Object.keys(fers).some(function (k) { return k.indexOf(prox) === 0; }) && hoy.getMonth() >= 9) actualizarFeriados_(hoy.getFullYear() + 1);
  } catch (e) { console.warn(e); }
  try { sincronizarCalendario(); } catch (e) { console.warn(e); }
}

/* ------------------------------------------------------------------ */
/* Menú                                                                */
/* ------------------------------------------------------------------ */

function abrirPanel() {
  var t = HtmlService.createTemplateFromFile('Panel');
  t.modo = 'sheets';
  t.urlWeb = '';
  SpreadsheetApp.getUi().showSidebar(t.evaluate().setTitle('Finanzas'));
}

function abrirDashboard() {
  var t = HtmlService.createTemplateFromFile('Dashboard');
  t.modo = 'sheets';
  var html = t.evaluate().setWidth(1280).setHeight(860);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard');
}

/** App web (para el celular): /exec?v=panel o /exec (dashboard). */
function doGet(e) {
  var v = e && e.parameter && e.parameter.v === 'panel' ? 'Panel' : 'Dashboard';
  var t = HtmlService.createTemplateFromFile(v);
  t.modo = 'web';
  t.urlWeb = ScriptApp.getService().getUrl();
  return t.evaluate()
    .setTitle(v === 'Panel' ? 'Cargar · Finanzas' : 'Dashboard · Finanzas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function irAlMesActual() {
  var sh = hoja_();
  ss_().setActiveSheet(sh);
  enfocarMesActual(sh);
}

function menuCalendario() {
  var r = sincronizarCalendario();
  ss_().toast(r.omitido ? 'No hay calendario configurado (hoja Config).' :
    'Creados ' + r.creados + ' · actualizados ' + r.actualizados + ' · borrados ' + r.borrados, '🗓️ Calendario', 6);
}

function menuIndices() {
  var r = actualizarIndices();
  ss_().toast(r.errores.length ? 'No se pudo descargar: ' + r.errores.join(', ') : 'Listo: ' + r.meses + ' meses actualizados.', '📈 Índices', 6);
}

function menuReparar() {
  var sh = hoja_();
  CFG_CACHE_ = null;
  asegurarLineaDeTiempo(sh);
  var est = leerEstructura(sh);
  reconstruirFormulas(sh, est);
  aplicarFormato(sh, est);
  reproyectar(sh, est);
  actualizarProximos(sh, est);
  actualizarValidacionMovimientos_(est);
  var shm = hoja_(FZ.HOJA_MOV);
  if (shm) shm.getRange(1, FZ.MOV.DESDE, 1, 3).setFormulas([formulasMovimientos_(leerConfig().tarjetaMesSig)]);
  enfocarMesActual(sh, est);
  ss_().toast('Fórmulas, formato y proyecciones al día.', '🔧 Finanzas', 5);
}

function menuInstalar() {
  var ui = SpreadsheetApp.getUi();
  var ss = ss_();
  var sh = ss.getSheetByName(FZ.HOJA);
  if (sh && estaInstalado_(sh)) {
    instalarDisparadores_();
    menuReparar();
    ui.alert('Sistema actualizado', 'Disparadores reinstalados y planilla reparada. Tus datos no se tocaron.', ui.ButtonSet.OK);
    return;
  }
  var usarLegado = false;
  if (sh) {
    var resp = ui.alert('Instalar Finanzas',
      'Encontré tu hoja "Finanzas".\n\n¿Importo sus datos al sistema nuevo?\n\n' +
      '• Sí: se importan meses, conceptos, vencimientos y eventuales.\n' +
      '• No: se crea una planilla nueva vacía.\n\n' +
      'Tu hoja original no se borra: queda como "Finanzas (original)".', ui.ButtonSet.YES_NO_CANCEL);
    if (resp === ui.Button.CANCEL || resp === ui.Button.CLOSE) return;
    usarLegado = resp === ui.Button.YES;
  }
  ss.toast('Armando tu planilla… (puede tardar un minuto)', '⚙️ Finanzas', 60);
  var res = instalarSistema_(usarLegado);
  instalarDisparadores_();
  var extra = [];
  try { var ri = actualizarIndices(); if (ri.errores.length) extra.push('No se pudo descargar: ' + ri.errores.join(', ')); } catch (e) { extra.push('Índices: ' + e.message); }
  try { sincronizarCalendario(); } catch (e) { extra.push('Calendario: ' + e.message); }
  mostrarBienvenida_(res, extra);
}

function instalarDisparadores_() {
  var ss = ss_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['alCambiar', 'tareaDiaria'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('alCambiar').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('tareaDiaria').timeBased().everyDays(1).atHour(7).create();
}

function mostrarBienvenida_(res, extra) {
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var html = '<div style="font:14px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0F172A;padding:4px 8px">' +
    '<h2 style="margin:0 0 6px;font-size:20px">¡Listo! 🎉</h2>' +
    '<p style="margin:0 0 14px;color:#475569">' + (res.origen === 'importado'
      ? 'Importé <b>' + res.items + '</b> conceptos y <b>' + res.movimientos + '</b> gastos eventuales (' + res.meses + ' meses).'
      : 'Creé una planilla nueva con ' + res.items + ' conceptos de ejemplo.') + '</p>' +
    '<div style="display:grid;gap:10px">' +
    tip_('✍️', 'Escribí como en Excel', 'Números o cuentas (=1500*3). Lo que cargás vos queda en <b>negro</b>; lo que completa el sistema, en <i style="color:#94A3B8">gris itálica</i>.') +
    tip_('↻', 'Arrastre de precios', 'Si la luz aumenta en septiembre, escribilo ahí: los meses siguientes se actualizan solos.') +
    tip_('📅', 'Vencimientos en palabras', 'En la columna Vence: <b>15</b>, <b>10 hábil</b>, <b>1er hábil</b>, <b>último hábil</b>… Van solos a tu Google Calendar.') +
    tip_('🧾', 'Gastos sueltos y cuotas', 'Menú <b>💰 Finanzas → Cargar</b>: escribí “heladera 900000 6 cuotas visa” y listo.') +
    tip_('📊', 'Dashboard', 'Salario real contra inflación, aumentos por concepto, gastos por categoría.') +
    '</div>' +
    (res.avisos && res.avisos.length ? '<details style="margin-top:14px;color:#475569"><summary>' + res.avisos.length + ' fórmulas con referencias se importaron como valor</summary><ul style="font-size:12px">' +
      res.avisos.slice(0, 40).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></details>' : '') +
    (extra.length ? '<p style="margin-top:12px;color:#92400E;font-size:12px">' + extra.map(esc).join('<br>') + '</p>' : '') +
    '<p style="margin-top:16px"><button onclick="google.script.host.close()" style="background:#4F46E5;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer">Empezar</button></p></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(560), 'Finanzas');
}

function tip_(icono, titulo, texto) {
  return '<div style="display:flex;gap:10px;align-items:flex-start;background:#F8FAFC;border-radius:10px;padding:10px 12px">' +
    '<div style="font-size:18px;line-height:1.2">' + icono + '</div><div><b>' + titulo + '</b><br><span style="color:#475569;font-size:13px">' + texto + '</span></div></div>';
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}
