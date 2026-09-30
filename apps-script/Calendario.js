/**
 * Finanzas · Sincronización con Google Calendar
 *
 * Crea un calendario propio ("Finanzas") con un evento de día completo por cada
 * fecha de los conceptos marcados (📅): "💸 Alquiler · $ 1.000.000".
 * Colores: ingresos verde, gastos rojo, ahorro e inversión azul.
 * Se sincroniza con el botón "Sincronizar" y sola todos los días a las 20 h:
 * si cambia el monto o la fecha, se corrige el evento; si ya está confirmado
 * (pagado), el título pasa a "✓". Nunca toca otros calendarios.
 */

/** Color del evento según la clase del concepto. */
function colorEvento_(clase) {
  var C = CalendarApp.EventColor;
  return clase === 'I' ? C.GREEN : clase === 'A' ? C.BLUE : C.RED;
}

function obtenerCalendario_(nombre) {
  var cals = CalendarApp.getCalendarsByName(nombre);
  if (cals.length) return cals[0];
  var cal = CalendarApp.createCalendar(nombre, { summary: 'Vencimientos generados por la planilla Finanzas', color: CalendarApp.Color.GREEN });
  return cal;
}

/**
 * Eventos deseados (parte pura).
 * @param {Array} conceptos  conceptos fijos
 * @param {Object} valores   {conceptoId: {mes: {monto, estado}}}
 * @param {Array<string>} meses 'YYYY-MM'
 */
function eventosDeseados_(conceptos, valores, meses, fer, hoy) {
  var out = {};
  conceptos.forEach(function (c) {
    var regla = parsearRegla(c.vence);
    if (c.tipo !== 'fijo' || c.calendario !== 'si' || !regla || regla.error) return;
    meses.forEach(function (mes) {
      var v = valores[c.id] && valores[c.id][mes];
      if (!v || !v.monto) return;
      var d = desdeIsoMes_(mes);
      var fecha = fechaRegla(regla, d.getFullYear(), d.getMonth(), fer);
      if (!fecha) return;
      var confirmado = v.estado !== 'estimado';
      var pagado = confirmado && fecha <= hoy;
      var icono = c.clase === 'I' ? '💰' : c.clase === 'A' ? '🏦' : '💸';
      var clave = c.id + '@' + mes;
      out[clave] = {
        fecha: fecha,
        color: colorEvento_(c.clase),
        titulo: (pagado ? '✓ ' : '') + icono + ' ' + c.nombre + ' · ' + fmtPesos_(v.monto),
        desc: [describirRegla(regla), c.medio ? 'Medio: ' + c.medio : '', confirmado ? 'Monto confirmado' : 'Monto estimado', 'Generado por Finanzas'].filter(String).join('\n')
      };
    });
  });
  return out;
}

function sincronizarCalendario() {
  var cfg = leerConfig();
  if (!cfg.calendario) return { creados: 0, actualizados: 0, borrados: 0, omitido: true };
  var m = cargarModelo_();
  var hoy = new Date();
  var meses = [];
  for (var k = 0; k < cfg.mesesCal; k++) meses.push(sumarMes_(isoMes_(hoy), k));
  var deseados = eventosDeseados_(m.conceptos, m.valores, meses, leerFeriados(), hoy);

  var cal = obtenerCalendario_(cfg.calendario);
  var desde = desdeIsoMes_(meses[0]);
  var hasta = desdeIsoMes_(sumarMes_(meses[meses.length - 1], 1));
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
    if (String(ev.getColor()) !== String(d.color)) { ev.setColor(d.color); cambio = true; }
    if (cambio) res.actualizados++;
    delete deseados[clave];
  });
  var minutos = cfg.aviso > 0 ? cfg.aviso * 1440 - 9 * 60 : 0;
  Object.keys(deseados).forEach(function (clave) {
    var d = deseados[clave];
    var ev = cal.createAllDayEvent(d.titulo, d.fecha, { description: d.desc });
    ev.setTag('fz', clave);
    ev.setColor(d.color);
    ev.removeAllReminders();
    if (minutos > 0) ev.addPopupReminder(minutos);
    res.creados++;
  });
  PropertiesService.getScriptProperties().setProperty('calendarioTs', new Date().toISOString());
  return res;
}

/** Tarea automática de las 20 h: sincroniza el calendario con los cambios del día. */
function tareaCalendario() {
  if (!dbInstalada_()) return;
  actualizarEsquema_();
  sincronizarCalendario();
}
