/**
 * Finanzas · Modelo en memoria sobre las tablas
 *
 *  conceptos   una fila por concepto de la grilla. Fijos (Salario, Luz…) y eventuales
 *              (Heladera, Cena…): los eventuales son filas sueltas dentro de su categoría.
 *  valores     una fila por concepto × mes: monto, cuenta ("10615+178223") y estado
 *              (confirmado = lo cargaste vos · estimado = lo completó el sistema)
 *  categorias  categorías de cada sección, con su color y orden
 */

function normConcepto_(c) {
  var sec = seccionPorNombre_(c.seccion);
  var tipo = sec ? sec.tipo : (c.tipo === 'eventual' ? 'eventual' : 'fijo');
  return {
    id: String(c.id), nombre: String(c.nombre || ''), seccion: sec ? sec.nombre : String(c.seccion || 'Gastos fijos'),
    clase: sec ? sec.clase : (String(c.clase || 'G')), categoria: String(c.categoria || (sec ? sec.nombre : c.seccion) || ''),
    tipo: tipo, vence: tipo === 'fijo' ? String(c.vence == null ? '' : c.vence) : '', medio: String(c.medio || ''),
    proyeccion: tipo === 'eventual' ? 'No proyectar' : (FZ.PROY.indexOf(String(c.proyeccion)) >= 0 ? String(c.proyeccion) : 'Repetir'),
    orden: Number(c.orden) || 0
  };
}

function seccionPorNombre_(nombre) {
  var n = norm_(nombre);
  for (var i = 0; i < FZ.SECCIONES.length; i++) if (norm_(FZ.SECCIONES[i].nombre) === n) return FZ.SECCIONES[i];
  return null;
}

function normCategoria_(c) {
  var sec = seccionPorNombre_(c.seccion);
  return { seccion: sec ? sec.nombre : String(c.seccion), nombre: String(c.nombre || '').trim(), color: String(c.color || ''), orden: Number(c.orden) || 0 };
}

function cargarModelo_() {
  return {
    conceptos: leerTabla(FZ.T.CONCEPTOS).map(normConcepto_),
    valores: indexarValores_(leerTabla(FZ.T.VALORES)),
    categorias: leerTabla(FZ.T.CAT).map(normCategoria_)
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
  conceptos.forEach(function (c) { validos[c.id] = true; });
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
function lineaDeTiempo_(idx, hoyIso, horizonte) {
  var min = sumarMes_(hoyIso.slice(0, 7), -12);
  Object.keys(idx).forEach(function (cid) { Object.keys(idx[cid]).forEach(function (m) { if (m < min) min = m; }); });
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
  var meses = lineaDeTiempo_(modelo.valores, hoy + '-01', cfg.horizonte);
  var idxHoy = meses.indexOf(hoy);
  var idxFin = Math.min(meses.length - 1, idxHoy + cfg.horizonte);
  var confirmar = {};
  (opts.confirmar || []).forEach(function (x) { confirmar[x.concepto + '@' + x.mes] = true; });
  var infl = null, total = 0;
  modelo.conceptos.forEach(function (c) {
    if (ids && ids.indexOf(c.id) < 0) return;
    var porMes = modelo.valores[c.id] = modelo.valores[c.id] || {};
    if (c.tipo !== 'fijo') {
      Object.keys(porMes).forEach(function (m) { if (porMes[m].estado === 'estimado' && opts.confirmarAntesDe && m < opts.confirmarAntesDe) { porMes[m].estado = 'confirmado'; total++; } });
      return;
    }
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

/** Orden global: sección (orden fijo) → categoría (orden de la tabla) → concepto. Deja órdenes 10, 20, 30… */
function renumerar_(m) {
  var secIdx = {};
  FZ.SECCIONES.forEach(function (s, i) { secIdx[s.nombre] = i; });
  var si = function (n) { return secIdx.hasOwnProperty(n) ? secIdx[n] : 99; };
  var catIdx = {};
  m.categorias.sort(function (a, b) { return si(a.seccion) - si(b.seccion) || a.orden - b.orden; });
  m.categorias.forEach(function (c, i) { c.orden = (i + 1) * 10; catIdx[c.seccion + '/' + c.nombre] = i; });
  var ci = function (c) { var k = c.seccion + '/' + c.categoria; return catIdx.hasOwnProperty(k) ? catIdx[k] : -1; };
  m.conceptos.sort(function (a, b) {
    return si(a.seccion) - si(b.seccion) || ci(a) - ci(b) || a.orden - b.orden;
  });
  m.conceptos.forEach(function (c, i) { c.orden = (i + 1) * 10; });
}

function guardarConceptos_(m) {
  renumerar_(m);
  escribirTabla(FZ.T.CONCEPTOS, m.conceptos);
  escribirTabla(FZ.T.CAT, m.categorias);
}

/** Crea la categoría si no existe (con el próximo color libre). */
function asegurarCategoria_(m, seccion, nombre) {
  if (!nombre || nombre === seccion) return null;
  var ya = m.categorias.filter(function (c) { return c.seccion === seccion && norm_(c.nombre) === norm_(nombre); })[0];
  if (ya) return ya;
  var usados = m.categorias.map(function (c) { return c.color; });
  var color = COLORES_CAT.filter(function (x) { return usados.indexOf(x) < 0; })[0] || COLORES_CAT[m.categorias.length % COLORES_CAT.length];
  var cat = { seccion: seccion, nombre: nombre, color: color, orden: 1e6 };
  m.categorias.push(cat);
  return cat;
}

/** Mes en que impacta un gasto (tarjeta → mes siguiente, si está configurado). */
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
