/**
 * Finanzas · Sincronización con Google Calendar
 *
 * Crea un calendario propio ("Finanzas") con un evento de día completo por cada
 * vencimiento: "💸 Alquiler · $ 1.000.000". Se actualiza solo todos los días:
 * si cambia el monto o la fecha, se corrige el evento; si ya está confirmado
 * (pagado), el título pasa a "✓". Nunca toca otros calendarios.
 */

function obtenerCalendario_(nombre) {
  var cals = CalendarApp.getCalendarsByName(nombre);
  if (cals.length) return cals[0];
  var cal = CalendarApp.createCalendar(nombre, { summary: 'Vencimientos generados por la planilla Finanzas', color: CalendarApp.Color.GREEN });
  return cal;
}

/** Eventos deseados (parte pura). */
function eventosDeseados_(items, meses, valoresPorFila, estilosPorFila, fer, hoy) {
  var out = {};
  items.forEach(function (it) {
    var regla = parsearRegla(it.vence);
    if (!regla || regla.error) return;
    meses.forEach(function (m, k) {
      var v = valoresPorFila[it.fila] ? valoresPorFila[it.fila][k] : '';
      if (typeof v !== 'number' || !v) return;
      var fecha = fechaRegla(regla, m.fecha.getFullYear(), m.fecha.getMonth(), fer);
      if (!fecha) return;
      var confirmado = estilosPorFila[it.fila] && estilosPorFila[it.fila][k] !== 'italic';
      var pagado = confirmado && fecha <= hoy;
      var icono = it.clase === 'I' ? '💰' : it.clase === 'A' ? '🏦' : '💸';
      var clave = norm_(it.nombre).replace(/[^a-z0-9]+/g, '-') + '@' + m.iso;
      out[clave] = {
        fecha: fecha,
        titulo: (pagado ? '✓ ' : '') + icono + ' ' + it.nombre + ' · ' + fmtPesos_(v),
        desc: [describirRegla(regla), it.medio ? 'Medio: ' + it.medio : '', confirmado ? 'Monto confirmado' : 'Monto estimado', 'Generado por la planilla Finanzas'].filter(String).join('\n')
      };
    });
  });
  return out;
}

function sincronizarCalendario() {
  var cfg = leerConfig();
  if (!cfg.calendario) return { creados: 0, actualizados: 0, borrados: 0, omitido: true };
  var sh = hoja_();
  var est = leerEstructura(sh);
  var hoy = new Date();
  var i0 = indiceMes_(est, hoy);
  if (i0 < 0) return { creados: 0, actualizados: 0, borrados: 0 };
  var meses = est.meses.slice(i0, i0 + cfg.mesesCal);
  var items = est.items.filter(function (it) { return !it.mov && it.vence !== ''; });
  var valores = {}, estilos = {};
  if (items.length) {
    var c0 = meses[0].col, c1 = meses[meses.length - 1].col;
    var rng = sh.getRange(3, c0, est.ultimaFila - 2, c1 - c0 + 1);
    var vals = rng.getValues(), sts = rng.getFontStyles();
    items.forEach(function (it) {
      valores[it.fila] = meses.map(function (m) { return vals[it.fila - 3][m.col - c0]; });
      estilos[it.fila] = meses.map(function (m) { return sts[it.fila - 3][m.col - c0]; });
    });
  }
  var deseados = eventosDeseados_(items, meses, valores, estilos, leerFeriados(), hoy);

  var cal = obtenerCalendario_(cfg.calendario);
  var desde = new Date(meses[0].fecha.getFullYear(), meses[0].fecha.getMonth(), 1);
  var hasta = new Date(meses[meses.length - 1].fecha.getFullYear(), meses[meses.length - 1].fecha.getMonth() + 1, 1);
  var res = { creados: 0, actualizados: 0, borrados: 0 };
  cal.getEvents(desde, hasta).forEach(function (ev) {
    var clave = ev.getTag('fz');
    if (!clave) return;
    var d = deseados[clave];
    if (!d) { ev.deleteEvent(); res.borrados++; return; }
    var inicio = ev.getAllDayStartDate();
    var cambio = false;
    if (ev.getTitle() !== d.titulo) { ev.setTitle(d.titulo); cambio = true; }
    if (ev.getDescription() !== d.desc) { ev.setDescription(d.desc); cambio = true; }
    if (!inicio || claveDia_(inicio) !== claveDia_(d.fecha)) { ev.setAllDayDate(d.fecha); cambio = true; }
    if (cambio) res.actualizados++;
    delete deseados[clave];
  });
  var minutos = cfg.aviso > 0 ? cfg.aviso * 1440 - 9 * 60 : 0;
  Object.keys(deseados).forEach(function (clave) {
    var d = deseados[clave];
    var ev = cal.createAllDayEvent(d.titulo, d.fecha, { description: d.desc });
    ev.setTag('fz', clave);
    ev.removeAllReminders();
    if (minutos > 0) ev.addPopupReminder(minutos);
    res.creados++;
  });
  return res;
}
