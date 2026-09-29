/**
 * Finanzas · Tarea diaria (7 AM)
 *  - Cierre de mes: los estimados de meses anteriores pasan a confirmados.
 *  - Débitos automáticos: el día del vencimiento se confirma el monto del mes.
 *  - Proyección: se extiende el horizonte de meses estimados.
 *  - Inflación y dólar (semanal), feriados del año siguiente, calendario.
 */
function tareaDiaria() {
  if (!dbInstalada_()) return;
  actualizarEsquema_();
  var cfg = leerConfig();
  var hoy = new Date(), mesHoy = isoMes_(hoy);
  var props = PropertiesService.getScriptProperties();
  conLock_(function () {
    var m = cargarModelo_();
    var opts = { confirmar: [] };
    if (props.getProperty('ultimoMes') !== mesHoy && cfg.cerrarMes) opts.confirmarAntesDe = mesHoy;
    if (cfg.confirmarDA) {
      var fer = leerFeriados();
      m.conceptos.forEach(function (c) {
        if (c.tipo !== 'fijo' || !/debito|automatico/.test(norm_(c.medio))) return;
        var r = parsearRegla(c.vence);
        if (!r || r.error) return;
        var f = fechaRegla(r, hoy.getFullYear(), hoy.getMonth(), fer);
        if (f && f <= hoy) opts.confirmar.push({ concepto: c.id, mes: mesHoy });
      });
    }
    reproyectar_(m, null, opts);
    guardarValores_(m);
    props.setProperty('ultimoMes', mesHoy);
  });
  var ts = Number(props.getProperty('indicesTs') || 0);
  if (Date.now() - ts > 6 * 864e5) { try { actualizarIndices(); } catch (e) { console.warn(e); } }
  try {
    var prox = String(hoy.getFullYear() + 1);
    if (hoy.getMonth() >= 9 && !Object.keys(leerFeriados()).some(function (k) { return k.indexOf(prox) === 0; })) actualizarFeriados_(hoy.getFullYear() + 1);
  } catch (e) { console.warn(e); }
  try { sincronizarCalendario(); } catch (e) { console.warn(e); }
}
