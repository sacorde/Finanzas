/**
 * Finanzas · Índices (inflación, dólar) y feriados
 *
 * Fuentes públicas, sin claves:
 *  - Inflación mensual INDEC: api.argentinadatos.com (respaldo: apis.datos.gob.ar)
 *  - Dólar oficial y blue (promedio mensual de venta): api.argentinadatos.com
 *  - Feriados nacionales: api.argentinadatos.com (respaldo: Google Calendar "Feriados en Argentina")
 * Una fila con origen "manual" (editada a mano en la tabla Indices) no se vuelve a pisar.
 */

var API_AD_ = 'https://api.argentinadatos.com/v1';

function traerJson_(url) {
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Accept: 'application/json' } });
  if (r.getResponseCode() !== 200) throw new Error(url + ' → HTTP ' + r.getResponseCode());
  return JSON.parse(r.getContentText());
}

/* ---------- Tabla Indices ---------- */

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

/** Descarga inflación y dólar y los fusiona en la tabla Indices (respeta filas "manual"). */
function actualizarIndices() {
  var infl = {}, oficial = {}, blue = {}, errores = [];
  try { infl = traerInflacion_(); } catch (e) { errores.push('inflación'); }
  try { oficial = promedioMensual_(traerJson_(API_AD_ + '/cotizaciones/dolares/oficial'), 'venta'); } catch (e) { errores.push('dólar oficial'); }
  try { blue = promedioMensual_(traerJson_(API_AD_ + '/cotizaciones/dolares/blue'), 'venta'); } catch (e) { errores.push('dólar blue'); }
  return conLock_(function () {
    var existentes = {};
    leerTabla(FZ.T.IND).forEach(function (r) { existentes[String(r.mes)] = r; });
    var hoy = isoMes_(new Date());
    var desde = Object.keys(existentes).sort()[0] || sumarMes_(hoy, -48);
    leerTabla(FZ.T.VALORES).forEach(function (v) { var d = sumarMes_(String(v.mes), -12); if (d < desde) desde = d; });
    var filas = [];
    for (var iso = desde; iso <= hoy; iso = sumarMes_(iso, 1)) {
      var prev = existentes[iso];
      if (prev && prev.origen === 'manual') { filas.push(prev); continue; }
      filas.push({ mes: iso, inflacion: pick_(infl[iso], prev && prev.inflacion), dolar_oficial: pick_(oficial[iso], prev && prev.dolar_oficial),
        dolar_blue: pick_(blue[iso], prev && prev.dolar_blue), origen: 'auto' });
    }
    escribirTabla(FZ.T.IND, filas);
    PropertiesService.getScriptProperties().setProperty('indicesTs', String(Date.now()));
    return { meses: filas.length, errores: errores };
  });
}

function pick_(nuevo, viejo) {
  return nuevo !== undefined && nuevo !== null && nuevo !== '' ? nuevo : (viejo !== undefined && viejo !== null ? viejo : '');
}

/** Agrega los feriados nacionales de un año a la tabla Feriados (sin duplicar). */
function actualizarFeriados_(anio) {
  var lista = [];
  try {
    lista = traerJson_(API_AD_ + '/feriados/' + anio).map(function (x) { return { fecha: String(x.fecha).slice(0, 10), nombre: x.nombre, origen: 'auto' }; });
  } catch (e) {
    try {
      var cal = CalendarApp.getCalendarById('es.ar#holiday@group.v.calendar.google.com');
      lista = cal.getEvents(new Date(anio, 0, 1), new Date(anio + 1, 0, 1)).map(function (ev) {
        return { fecha: isoDia_(ev.getAllDayStartDate()), nombre: ev.getTitle(), origen: 'auto' };
      });
    } catch (e2) { console.warn('Sin feriados para ' + anio + ': ' + e2); }
  }
  return conLock_(function () {
    var existentes = leerTabla(FZ.T.FER);
    var claves = {};
    existentes.forEach(function (r) { claves[r.fecha] = true; });
    var nuevos = lista.filter(function (r) { return !claves[r.fecha]; });
    if (!nuevos.length) return 0;
    escribirTabla(FZ.T.FER, existentes.concat(nuevos).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }));
    FERIADOS_CACHE_ = null;
    return nuevos.length;
  });
}
