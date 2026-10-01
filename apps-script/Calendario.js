/**
 * Finanzas · Sincronización con Google Calendar
 *
 * Crea un calendario propio ("Finanzas") con un evento de día completo por cada
 * fecha de los conceptos marcados (📅). El título es solo el nombre ("Alquiler");
 * el monto y el detalle van en la descripción.
 * Colores: ingresos verde, gastos rojo, ahorro e inversión azul.
 * Se sincroniza con el botón "Sincronizar" y sola todos los días a las 20 h:
 * si cambia el monto o la fecha, se corrige el evento. Nunca toca otros calendarios.
 * Google limita cuántas operaciones se hacen por minuto: si un evento falla se reintenta
 * y se sigue con los demás (nunca se corta toda la sincronización).
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
      var clave = c.id + '@' + mes;
      out[clave] = {
        fecha: fecha,
        color: colorEvento_(c.clase),
        titulo: c.nombre,
        desc: ['Monto: ' + fmtPesos_(v.monto) + (confirmado ? '' : ' (estimado)'), describirRegla(regla), c.medio ? 'Medio de pago: ' + c.medio : '', 'Generado por Finanzas'].filter(String).join('\n')
      };
    });
  });
  return out;
}

/** Ejecuta una operación del calendario; si Google la rechaza (límite por minuto), espera y reintenta una vez. */
function intentarCal_(fn) {
  try { return fn(); } catch (e) {
    Utilities.sleep(1500);
    return fn();
  }
}

function sincronizarCalendario() {
  var cfg = leerConfig();
  if (!cfg.calendario) return { creados: 0, actualizados: 0, borrados: 0, omitido: true };
  var m = cargarModelo_();
  var hoy = new Date();
  var meses = [];
  for (var k = 0; k < cfg.mesesCal; k++) meses.push(sumarMes_(isoMes_(hoy), k));
  var deseados = eventosDeseados_(m.conceptos, m.valores, meses, leerFeriados(), hoy);
  var marcados = m.conceptos.filter(function (c) { return c.tipo === 'fijo' && c.calendario === 'si'; });

  var cal = obtenerCalendario_(cfg.calendario);
  var desde = desdeIsoMes_(meses[0]);
  var hasta = desdeIsoMes_(sumarMes_(meses[meses.length - 1], 1));
  var res = { creados: 0, actualizados: 0, borrados: 0, errores: [], marcados: marcados.map(function (c) { return c.nombre; }),
    sinFecha: marcados.filter(function (c) { var r = parsearRegla(c.vence); return !r || r.error; }).map(function (c) { return c.nombre; }) };
  var nombreDe = function (clave) { var c = m.conceptos.filter(function (x) { return x.id === clave.split('@')[0]; })[0]; return c ? c.nombre : clave; };
  cal.getEvents(desde, hasta).forEach(function (ev) {
    var clave = ev.getTag('fz');
    if (!clave) return;
    var d = deseados[clave];
    try {
      if (!d) { intentarCal_(function () { ev.deleteEvent(); }); res.borrados++; return; }
      var inicio = ev.getAllDayStartDate();
      var cambio = false;
      if (ev.getTitle() !== d.titulo) { intentarCal_(function () { ev.setTitle(d.titulo); }); cambio = true; }
      if (ev.getDescription() !== d.desc) { intentarCal_(function () { ev.setDescription(d.desc); }); cambio = true; }
      if (!inicio || claveDia_(inicio) !== claveDia_(d.fecha)) { intentarCal_(function () { ev.setAllDayDate(d.fecha); }); cambio = true; }
      if (String(ev.getColor()) !== String(d.color)) { intentarCal_(function () { ev.setColor(d.color); }); cambio = true; }
      if (cambio) { res.actualizados++; Utilities.sleep(150); }
    } catch (e) { res.errores.push(nombreDe(clave) + ': ' + e.message); }
    delete deseados[clave];
  });
  var minutos = cfg.aviso > 0 ? cfg.aviso * 1440 - 9 * 60 : 0;
  Object.keys(deseados).forEach(function (clave) {
    var d = deseados[clave];
    try {
      var ev = intentarCal_(function () { return cal.createAllDayEvent(d.titulo, d.fecha, { description: d.desc }); });
      intentarCal_(function () { ev.setTag('fz', clave); });
      intentarCal_(function () { ev.setColor(d.color); });
      intentarCal_(function () { ev.removeAllReminders(); if (minutos > 0) ev.addPopupReminder(minutos); });
      res.creados++;
      Utilities.sleep(200);
    } catch (e) { res.errores.push(nombreDe(clave) + ': ' + e.message); }
  });
  PropertiesService.getScriptProperties().setProperty('calendarioTs', new Date().toISOString());
  if (res.errores.length) console.warn('Calendario: ' + res.errores.join(' · '));
  return res;
}

/** Tarea automática de las 20 h: sincroniza el calendario con los cambios del día. */
function tareaCalendario() {
  if (!dbInstalada_()) return;
  actualizarEsquema_();
  sincronizarCalendario();
}
