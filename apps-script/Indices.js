/**
 * Finanzas · Índices (inflación, dólar), feriados y hoja Config
 *
 * Fuentes públicas, sin claves:
 *  - Inflación mensual INDEC: api.argentinadatos.com (respaldo: apis.datos.gob.ar)
 *  - Dólar oficial y blue (promedio mensual de venta): api.argentinadatos.com
 *  - Feriados nacionales: api.argentinadatos.com (respaldo: Google Calendar "Feriados en Argentina")
 * Cualquier fila que edites a mano queda marcada "manual" y no se vuelve a pisar.
 */

var API_AD_ = 'https://api.argentinadatos.com/v1';

function traerJson_(url) {
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Accept: 'application/json' } });
  if (r.getResponseCode() !== 200) throw new Error(url + ' → HTTP ' + r.getResponseCode());
  return JSON.parse(r.getContentText());
}

/* ---------- Hoja Índices ---------- */

function crearHojaIndices_(ss) {
  var sh = ss.getSheetByName(FZ.HOJA_IND);
  if (!sh) sh = ss.insertSheet(FZ.HOJA_IND);
  var C = FZ.C;
  sh.getRange(1, 1, 1, 5).setValues([['Mes', 'Inflación mensual (%)', 'Dólar oficial', 'Dólar blue', 'Origen']])
    .setBackground(C.cabecera).setFontColor('#FFFFFF').setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, sh.getMaxRows(), 5).setFontFamily(FZ.FUENTE).setFontSize(10);
  [110, 150, 120, 120, 90].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat('mmm yyyy');
  sh.getRange(2, 2, sh.getMaxRows() - 1, 1).setNumberFormat('0.0');
  sh.getRange(2, 3, sh.getMaxRows() - 1, 2).setNumberFormat('#,##0.00');
  sh.getRange(2, 5, sh.getMaxRows() - 1, 1).setFontColor(C.tenue);
  sh.getRange(1, 5).setNote('"auto" = lo completa el sistema. Si editás una fila, pasa a "manual" y se respeta.');
  sh.setTabColor(C.ahorro);
  return sh;
}

function promedioMensual_(lista, campo) {
  var acc = {};
  lista.forEach(function (x) {
    var iso = String(x.fecha).slice(0, 7), v = Number(x[campo]);
    if (!v) return;
    acc[iso] = acc[iso] || { s: 0, n: 0 };
    acc[iso].s += v; acc[iso].n++;
  });
  var out = {};
  Object.keys(acc).forEach(function (k) { out[k] = Math.round(acc[k].s / acc[k].n * 100) / 100; });
  return out;
}

function traerInflacion_() {
  try {
    var out = {};
    traerJson_(API_AD_ + '/finanzas/indices/inflacion').forEach(function (x) { out[String(x.fecha).slice(0, 7)] = Number(x.valor); });
    if (Object.keys(out).length) return out;
  } catch (e) { console.warn('argentinadatos inflación: ' + e); }
  var j = traerJson_('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&representation_mode=percent_change&limit=1000&format=json');
  var res = {};
  j.data.forEach(function (x) { res[String(x[0]).slice(0, 7)] = Math.round(Number(x[1]) * 1000) / 10; });
  return res;
}

/** Descarga inflación y dólar y los fusiona en la hoja Índices. */
function actualizarIndices() {
  var ss = ss_();
  var sh = ss.getSheetByName(FZ.HOJA_IND) || crearHojaIndices_(ss);
  var infl = {}, oficial = {}, blue = {}, errores = [];
  try { infl = traerInflacion_(); } catch (e) { errores.push('inflación'); }
  try { oficial = promedioMensual_(traerJson_(API_AD_ + '/cotizaciones/dolares/oficial'), 'venta'); } catch (e) { errores.push('dólar oficial'); }
  try { blue = promedioMensual_(traerJson_(API_AD_ + '/cotizaciones/dolares/blue'), 'venta'); } catch (e) { errores.push('dólar blue'); }

  var existentes = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
      if (r[0] instanceof Date) existentes[isoMes_(r[0])] = r;
    });
  }
  var fin = sh.getParent().getSheetByName(FZ.HOJA);
  var desde = new Date(new Date().getFullYear() - 3, 0, 1);
  if (fin) {
    var est = leerEstructura(fin);
    if (est.meses.length) desde = new Date(est.meses[0].fecha.getFullYear() - 1, 0, 1);
  }
  var hoy = new Date(), filas = [];
  for (var d = desde; d <= hoy; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    var iso = isoMes_(d), prev = existentes[iso];
    if (prev && prev[4] === 'manual') { filas.push(prev); continue; }
    filas.push([new Date(d), pick_(infl[iso], prev && prev[1]), pick_(oficial[iso], prev && prev[2]), pick_(blue[iso], prev && prev[3]), 'auto']);
  }
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).clearContent();
  if (filas.length) sh.getRange(2, 1, filas.length, 5).setValues(filas);
  INDICES_CACHE_ = null;
  PropertiesService.getDocumentProperties().setProperty('indicesTs', String(Date.now()));
  return { meses: filas.length, errores: errores };
}

function pick_(nuevo, viejo) {
  return nuevo !== undefined && nuevo !== null && nuevo !== '' ? nuevo : (viejo !== undefined && viejo !== null ? viejo : '');
}

var INDICES_CACHE_ = null;
/** @return {{inflacion:Object, oficial:Object, blue:Object}} mapas 'YYYY-MM' → número */
function leerIndices_() {
  if (INDICES_CACHE_) return INDICES_CACHE_;
  var out = { inflacion: {}, oficial: {}, blue: {} };
  var sh = hoja_(FZ.HOJA_IND);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(function (r) {
      if (!(r[0] instanceof Date)) return;
      var iso = isoMes_(r[0]);
      if (r[1] !== '' && !isNaN(Number(r[1]))) out.inflacion[iso] = Number(r[1]);
      if (Number(r[2])) out.oficial[iso] = Number(r[2]);
      if (Number(r[3])) out.blue[iso] = Number(r[3]);
    });
  }
  INDICES_CACHE_ = out;
  return out;
}

/** Al editar la hoja Índices a mano, la fila pasa a "manual". */
function alEditarIndices_(e) {
  var r = e.range;
  if (r.getRow() < 2 || r.getColumn() > 4) return;
  r.getSheet().getRange(r.getRow(), 5, r.getNumRows(), 1).setValue('manual');
}

/* ---------- Hoja Config ---------- */

function crearHojaConfig_(ss) {
  var sh = ss.getSheetByName(FZ.HOJA_CFG);
  var previos = {};
  if (sh) {
    sh.getRange(1, 1, CFG_FILA_FERIADOS - 1, 2).getValues().forEach(function (r) { previos[String(r[0]).trim()] = r[1]; });
  } else {
    sh = ss.insertSheet(FZ.HOJA_CFG);
  }
  var C = FZ.C;
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, sh.getMaxRows(), 3).setFontFamily(FZ.FUENTE).setFontSize(10).setVerticalAlignment('middle');
  sh.getRange(1, 1).setValue('Configuración').setFontSize(14).setFontWeight('bold').setFontColor(C.tinta);
  sh.getRange(2, 1).setValue('Todo lo demás se configura en la hoja Finanzas, fila por fila. Acá solo hay preferencias generales.').setFontColor(C.tinta2);
  var filas = CFG_DEF.map(function (d) {
    return [d.label, previos.hasOwnProperty(d.label) ? previos[d.label] : d.def, d.ayuda];
  });
  sh.getRange(3, 1, filas.length, 3).setValues(filas);
  sh.getRange(3, 1, filas.length, 1).setFontWeight('bold').setFontColor(C.tinta);
  sh.getRange(3, 2, filas.length, 1).setBackground(C.acentoSuave).setHorizontalAlignment('left');
  sh.getRange(3, 3, filas.length, 1).setFontColor(C.tenue).setFontSize(9);
  sh.getRange(3, 1, filas.length, 3).setBorder(null, null, null, null, null, true, C.linea, SpreadsheetApp.BorderStyle.SOLID);
  var siNo = SpreadsheetApp.newDataValidation().requireValueInList(['Sí', 'No'], true).build();
  CFG_DEF.forEach(function (d, i) {
    if (['cerrarMes', 'confirmarDA', 'tarjetaMesSig'].indexOf(d.k) >= 0) sh.getRange(3 + i, 2).setDataValidation(siNo);
    if (d.k === 'dolar') sh.getRange(3 + i, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Blue', 'Oficial'], true).build());
  });
  sh.setColumnWidth(1, 320); sh.setColumnWidth(2, 360); sh.setColumnWidth(3, 520);
  sh.setRowHeights(3, filas.length, 28);

  sh.getRange(CFG_FILA_FERIADOS, 1).setValue('Feriados y días no laborables').setFontSize(12).setFontWeight('bold').setFontColor(C.tinta);
  sh.getRange(CFG_FILA_FERIADOS, 2).setValue('Se usan para calcular días hábiles. Podés agregar los tuyos (ej. asueto de tu empresa).').setFontColor(C.tinta2);
  sh.getRange(CFG_FILA_FERIADOS + 1, 1, 1, 3).setValues([['Fecha', 'Nombre', 'Origen']]).setBackground(C.cabecera).setFontColor('#FFFFFF').setFontWeight('bold');
  sh.getRange(CFG_FILA_FERIADOS + 2, 1, sh.getMaxRows() - CFG_FILA_FERIADOS - 1, 1).setNumberFormat('ddd dd/mm/yyyy');
  sh.setTabColor(C.tenue);
  CFG_CACHE_ = null;
  return sh;
}

/** Agrega los feriados nacionales de un año a la tabla de Config (sin duplicar). */
function actualizarFeriados_(anio) {
  var sh = hoja_(FZ.HOJA_CFG);
  if (!sh) return 0;
  var lista = [];
  try {
    lista = traerJson_(API_AD_ + '/feriados/' + anio).map(function (x) {
      var p = String(x.fecha).split('-');
      return [new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])), x.nombre, 'auto'];
    });
  } catch (e) {
    try {
      var cal = CalendarApp.getCalendarById('es.ar#holiday@group.v.calendar.google.com');
      lista = cal.getEvents(new Date(anio, 0, 1), new Date(anio + 1, 0, 1)).map(function (ev) {
        var d = ev.getAllDayStartDate();
        return [new Date(d.getFullYear(), d.getMonth(), d.getDate()), ev.getTitle(), 'auto'];
      });
    } catch (e2) { console.warn('Sin feriados para ' + anio + ': ' + e2); }
  }
  var inicio = CFG_FILA_FERIADOS + 2;
  var existentes = sh.getLastRow() >= inicio ? sh.getRange(inicio, 1, sh.getLastRow() - inicio + 1, 3).getValues().filter(function (r) { return r[0] instanceof Date; }) : [];
  var claves = {};
  existentes.forEach(function (r) { claves[claveDia_(r[0])] = true; });
  var nuevos = lista.filter(function (r) { return !claves[claveDia_(r[0])]; });
  if (!nuevos.length) return 0;
  var todos = existentes.concat(nuevos).sort(function (a, b) { return a[0] - b[0]; });
  sh.getRange(inicio, 1, todos.length, 3).setValues(todos);
  FERIADOS_CACHE_ = null;
  return nuevos.length;
}
