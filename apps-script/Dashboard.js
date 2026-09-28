/**
 * Finanzas · Datos para el dashboard
 * El servidor entrega todo en una sola llamada; los filtros corren en el navegador
 * (instantáneos, sin esperar al servidor).
 */

function dashboardDatos() {
  var sh = hoja_();
  var est = leerEstructura(sh);
  var hoy = new Date();
  var c0 = FZ.COL_MES0, nCol = est.ultimaCol - c0 + 1, n = est.ultimaFila - 2;
  var rng = sh.getRange(3, c0, n, nCol);
  var vals = rng.getValues(), sts = rng.getFontStyles();
  var items = est.items.map(function (it) {
    var r = it.fila - 3;
    return {
      nombre: it.nombre, seccion: it.seccion, categoria: it.categoria, clase: it.clase, mov: it.mov, medio: it.medio,
      v: est.meses.map(function (m) { var x = vals[r][m.col - c0]; return typeof x === 'number' ? Math.round(x) : null; }),
      e: est.meses.map(function (m) { return sts[r][m.col - c0] === 'italic' ? 1 : 0; })
    };
  });
  var ind = leerIndices_();
  var cfg = leerConfig();
  var proximos = panelDatos().items.filter(function (i) { return i.fecha && i.fecha >= isoDia_(hoy) && i.valor; })
    .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).slice(0, 8);
  return {
    generado: isoDia_(hoy),
    mesActual: isoMes_(hoy),
    meses: est.meses.map(function (m) { return m.iso; }),
    items: items,
    inflacion: ind.inflacion,
    oficial: ind.oficial,
    blue: ind.blue,
    inflEsperada: Math.round(inflacionEsperada_() * 1000) / 10,
    dolar: norm_(cfg.dolar) === 'oficial' ? 'oficial' : 'blue',
    proximos: proximos
  };
}
