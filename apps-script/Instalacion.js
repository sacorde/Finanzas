/**
 * Finanzas · Instalación desde la app web y limpieza de hojas
 *
 * Pasos (la app los llama de a uno para mostrar el progreso):
 *   respaldo        copia completa del archivo en tu Drive (nada se pierde)
 *   migrar          lee tu planilla actual (versión 2 o Excel original) y crea las tablas
 *   indices         feriados, inflación y dólar
 *   automatizaciones tarea diaria (7 AM)
 *   calendario      primera sincronización
 * Después la app ofrece borrar las hojas que ya no hacen falta.
 */

function api_instalar(paso) {
  var ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  switch (paso) {
    case 'respaldo': return respaldar_(ss);
    case 'migrar': return conLock_(function () { return migrar_(ss); });
    case 'indices': return pasoIndices_();
    case 'automatizaciones': return instalarDisparadores_(ss);
    case 'calendario':
      try { return { ok: true, detalle: resumenCalendario_(sincronizarCalendario()) }; }
      catch (e) { return { ok: false, detalle: 'No se pudo sincronizar el calendario: ' + e.message }; }
  }
  throw new Error('Paso desconocido: ' + paso);
}

function respaldar_(ss) {
  var nombre = ss.getName() + ' · respaldo ' + Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');
  var copia = ss.copy(nombre);
  PropertiesService.getScriptProperties().setProperty('ultimoRespaldo', copia.getUrl());
  PropertiesService.getScriptProperties().setProperty('ultimoRespaldoDia', isoDia_(new Date()));
  return { ok: true, detalle: 'Copia completa guardada en tu Drive: "' + nombre + '"', url: copia.getUrl() };
}

function migrar_(ss) {
  if (dbInstalada_()) return { ok: true, detalle: 'La base de datos ya estaba creada: no se tocó.' };
  var fuente = detectarFuente_(ss);
  var hoy = new Date();
  var modelo, avisos = [];
  if (fuente.tipo === 'v2') {
    modelo = leerV2_(ss);
  } else if (fuente.tipo === 'legado') {
    var rng = ss.getSheetByName(fuente.hoja).getDataRange();
    var leg = parsearLegado(rng.getValues(), rng.getFormulas());
    avisos = leg.avisos;
    modelo = modeloDesdeLegado(leg, hoy, {});
  } else {
    modelo = modeloPlantilla(hoy);
  }
  var db = filasAdb_(modelo.filas, modelo.movimientos);
  Object.keys(ESQUEMA).forEach(function (t) { crearTabla_(ss, t); });
  escribirTabla(FZ.T.CFG, CFG_DEF.map(function (d) { return { clave: d.k, valor: d.def, descripcion: d.ayuda }; }));
  CFG_CACHE_ = null;
  escribirTabla(FZ.T.CONCEPTOS, db.conceptos);
  escribirTabla(FZ.T.MOV, db.movimientos);
  var m = { conceptos: db.conceptos.map(normConcepto_), valores: indexarValores_(db.valores), movimientos: db.movimientos.map(normMovimiento_) };
  reproyectar_(m, null);
  guardarValores_(m);
  // Ordenar pestañas: primero las tablas principales
  [FZ.T.CONCEPTOS, FZ.T.VALORES, FZ.T.MOV, FZ.T.IND, FZ.T.FER, FZ.T.CFG].forEach(function (t, i) {
    ss.setActiveSheet(ss.getSheetByName(t));
    ss.moveActiveSheet(i + 1);
  });
  PropertiesService.getScriptProperties().setProperty('ultimoMes', isoMes_(hoy));
  return {
    ok: true,
    detalle: 'Importé ' + db.conceptos.filter(function (c) { return c.tipo === 'fijo'; }).length + ' conceptos, ' +
      db.valores.length + ' montos y ' + db.movimientos.length + ' gastos eventuales desde ' + fuente.descripcion + '.',
    avisos: avisos
  };
}

function pasoIndices_() {
  var partes = [];
  var anio = new Date().getFullYear();
  try { actualizarFeriados_(anio); actualizarFeriados_(anio + 1); partes.push('feriados ' + anio + '–' + (anio + 1)); }
  catch (e) { partes.push('feriados: ' + e.message); }
  try {
    var r = actualizarIndices();
    partes.push(r.errores.length ? 'sin ' + r.errores.join(', ') : 'inflación y dólar (' + r.meses + ' meses)');
  } catch (e) { partes.push('índices: ' + e.message); }
  return { ok: true, detalle: 'Descargados: ' + partes.join(' · ') };
}

function instalarDisparadores_(ss) {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tareaDiaria').timeBased().everyDays(1).atHour(7).create();
  return { ok: true, detalle: 'Tarea diaria programada (7 AM): cierre de mes, débitos automáticos, índices y calendario.' };
}

function resumenCalendario_(r) {
  if (r.omitido) return 'Calendario desactivado en la configuración.';
  return 'Calendario "' + leerConfig().calendario + '": ' + r.creados + ' vencimientos creados.';
}

/* ------------------------------------------------------------------ */
/* Limpieza de hojas                                                   */
/* ------------------------------------------------------------------ */

/** Hojas que no son tablas de la base de datos. */
function api_hojasSobrantes() {
  var ss = ss_();
  return ss.getSheets().filter(function (sh) { return !ESQUEMA[sh.getName()] || !esTabla_(sh); }).map(function (sh) {
    return { nombre: sh.getName(), filas: sh.getLastRow(), columnas: sh.getLastColumn() };
  });
}

/** Borra las hojas indicadas (nunca las tablas). Hace un respaldo antes si no se hizo hoy. */
function api_borrarHojas(nombres) {
  var ss = ss_();
  if (!dbInstalada_()) throw new Error('Primero hay que instalar la base de datos.');
  var props = PropertiesService.getScriptProperties();
  var respaldo = props.getProperty('ultimoRespaldo');
  var hoy = isoDia_(new Date());
  if (!respaldo || props.getProperty('ultimoRespaldoDia') !== hoy) respaldo = respaldar_(ss).url;
  var borradas = [];
  (nombres || []).forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (!sh || (ESQUEMA[n] && esTabla_(sh))) return;
    ss.deleteSheet(sh);
    borradas.push(n);
  });
  return { borradas: borradas, respaldo: respaldo };
}
