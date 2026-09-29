/**
 * Finanzas · Modelo en memoria sobre las tablas
 *
 *  conceptos  una fila por concepto (Salario, Luz, Alquiler… y las categorías de Eventuales)
 *  valores    una fila por concepto × mes con monto, cuenta ("10615+178223") y estado
 *             (confirmado = lo cargaste vos · estimado = lo completó el sistema)
 *  movimientos gastos eventuales sueltos o en cuotas
 */

function normConcepto_(c) {
  var sec = seccionPorNombre_(c.seccion);
  return {
    id: String(c.id), nombre: String(c.nombre || ''), seccion: sec ? sec.nombre : String(c.seccion || 'Gastos fijos'),
    clase: sec ? sec.clase : (String(c.clase || 'G')), categoria: String(c.categoria || c.seccion || ''),
    tipo: sec ? sec.tipo : (c.tipo === 'eventual' ? 'eventual' : 'fijo'),
    vence: String(c.vence == null ? '' : c.vence), medio: String(c.medio || ''),
    proyeccion: FZ.PROY.indexOf(String(c.proyeccion)) >= 0 ? String(c.proyeccion) : 'Repetir',
    orden: Number(c.orden) || 0
  };
}

function seccionPorNombre_(nombre) {
  var n = norm_(nombre);
  for (var i = 0; i < FZ.SECCIONES.length; i++) if (norm_(FZ.SECCIONES[i].nombre) === n) return FZ.SECCIONES[i];
  return null;
}

function cargarModelo_() {
  return {
    conceptos: leerTabla(FZ.T.CONCEPTOS).map(normConcepto_),
    valores: indexarValores_(leerTabla(FZ.T.VALORES)),
    movimientos: leerTabla(FZ.T.MOV).map(normMovimiento_)
  };
}

function normMovimiento_(m) {
  return {
    id: String(m.id), fecha: String(m.fecha || ''), descripcion: String(m.descripcion || ''), categoria: String(m.categoria || 'Otros'),
    monto: Number(m.monto) || 0, cuenta: String(m.cuenta || ''), cuotas: Math.max(1, Number(m.cuotas) || 1),
    medio: String(m.medio || ''), mes: String(m.mes || ''), nota: String(m.nota || '')
  };
}

/** {concepto: {mes: {monto, cuenta, estado}}} */
function indexarValores_(filas) {
  var idx = {};
  filas.forEach(function (r) {
    if (!r.concepto || !r.mes || r.monto === '' || r.monto === null) return;
    (idx[r.concepto] = idx[r.concepto] || {})[String(r.mes)] = {
      monto: Number(r.monto) || 0, cuenta: String(r.cuenta || ''), estado: r.estado === 'estimado' ? 'estimado' : 'confirmado'
    };
  });
  return idx;
}

function aplanarValores_(idx, conceptos) {
  var validos = {};
  conceptos.forEach(function (c) { if (c.tipo === 'fijo') validos[c.id] = true; });
  var filas = [];
  Object.keys(idx).sort().forEach(function (cid) {
    if (!validos[cid]) return;
    Object.keys(idx[cid]).sort().forEach(function (mes) {
      var v = idx[cid][mes];
      filas.push({ concepto: cid, mes: mes, monto: v.monto, cuenta: v.cuenta, estado: v.estado });
    });
  });
  return filas;
}

/** Meses de la línea de tiempo: desde enero del primer dato (o del año pasado) hasta diciembre del horizonte. */
function lineaDeTiempo_(idx, movimientos, hoyIso, horizonte) {
  var min = sumarMes_(hoyIso.slice(0, 7), -12);
  Object.keys(idx).forEach(function (cid) { Object.keys(idx[cid]).forEach(function (m) { if (m < min) min = m; }); });
  movimientos.forEach(function (m) { if (m.mes && m.mes < min) min = m.mes; });
  var fin = sumarMes_(hoyIso.slice(0, 7), horizonte);
  var ini = min.slice(0, 4) + '-01', finAnio = fin.slice(0, 4) + '-12';
  var out = [];
  for (var m = ini; m <= finAnio; m = sumarMes_(m, 1)) out.push(m);
  return out;
}

/**
 * Reproyecta conceptos fijos (todos o los indicados).
 * opts.confirmarAntesDe: 'YYYY-MM' → los estimados de meses anteriores pasan a confirmados.
 * opts.confirmar: [{concepto, mes}] → confirma esas celdas.
 * @return {number} celdas modificadas
 */
function reproyectar_(modelo, ids, opts) {
  opts = opts || {};
  var cfg = leerConfig();
  var hoy = isoMes_(new Date());
  var meses = lineaDeTiempo_(modelo.valores, modelo.movimientos, hoy + '-01', cfg.horizonte);
  var idxHoy = meses.indexOf(hoy);
  var idxFin = Math.min(meses.length - 1, idxHoy + cfg.horizonte);
  var confirmar = {};
  (opts.confirmar || []).forEach(function (x) { confirmar[x.concepto + '@' + x.mes] = true; });
  var infl = null, total = 0;
  modelo.conceptos.forEach(function (c) {
    if (c.tipo !== 'fijo' || (ids && ids.indexOf(c.id) < 0)) return;
    var porMes = modelo.valores[c.id] = modelo.valores[c.id] || {};
    var celdas = meses.map(function (m) {
      var x = porMes[m];
      if (!x) return { v: '', f: '', proy: false };
      if (x.estado === 'estimado' && ((opts.confirmarAntesDe && m < opts.confirmarAntesDe) || confirmar[c.id + '@' + m])) {
        x.estado = 'confirmado'; total++;
      }
      return { v: x.monto, f: x.cuenta ? '=' + x.cuenta : '', proy: x.estado === 'estimado' };
    });
    if (c.proyeccion === 'Ajustar por inflación' && infl === null) infl = inflacionEsperada_();
    calcularProyeccion(celdas, idxHoy, idxFin, c.proyeccion, infl || 0).forEach(function (ch) {
      var mes = meses[ch.i];
      if (ch.borrar) delete porMes[mes];
      else {
        var cuenta = ch.f ? ch.f.replace(/^=/, '') : '';
        var monto = cuenta ? (parsearMonto(cuenta) || { valor: 0 }).valor : Number(ch.v) || 0;
        porMes[mes] = { monto: monto, cuenta: cuenta, estado: 'estimado' };
      }
      total++;
    });
  });
  return total;
}

function guardarValores_(modelo) {
  escribirTabla(FZ.T.VALORES, aplanarValores_(modelo.valores, modelo.conceptos));
}

function guardarConceptos_(modelo) {
  escribirTabla(FZ.T.CONCEPTOS, modelo.conceptos.slice().sort(function (a, b) { return a.orden - b.orden; }));
}

/** Mes en que impacta un gasto eventual (tarjeta → mes siguiente, si está configurado). */
function mesImputacion_(fechaIso, medio, tarjetaMesSig) {
  var f = desdeIsoDia_(fechaIso);
  var sig = tarjetaMesSig && /tarjeta|visa|amex|master/.test(norm_(medio));
  return isoMes_(new Date(f.getFullYear(), f.getMonth() + (sig ? 1 : 0), 1));
}

/** Fechas de vencimiento del mes actual y el siguiente: {conceptoId: {mes: 'YYYY-MM-DD'}} */
function vencimientos_(conceptos, hoy) {
  var fer = leerFeriados();
  var out = {};
  conceptos.forEach(function (c) {
    if (c.tipo !== 'fijo') return;
    var r = parsearRegla(c.vence);
    if (!r || r.error) return;
    out[c.id] = {};
    for (var k = 0; k < 2; k++) {
      var d = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1);
      var f = fechaRegla(r, d.getFullYear(), d.getMonth(), fer);
      if (f) out[c.id][isoMes_(d)] = isoDia_(f);
    }
  });
  return out;
}
