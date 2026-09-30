/**
 * Finanzas · Modelo en memoria sobre las tablas
 *
 *  categorias  un solo nivel (Ingresos, Vivienda, Servicios…), cada una con su color,
 *              clase (I ingreso · G gasto · A ahorro) y tipo (fijo · eventual)
 *  conceptos   una fila de la grilla dentro de su categoría. Fijos (Salario, Luz…) se proyectan;
 *              eventuales (Heladera, Cena…) son una fila por gasto.
 *  valores     una fila por concepto × mes: monto, cuenta ("10615+178223") y estado
 *              (confirmado = lo cargaste vos · estimado = lo completó el sistema)
 */

function normCategoria_(c) {
  var base = categoriaBase_(c.nombre);
  var clase = String(c.clase || (base ? base.clase : 'G'));
  return {
    nombre: String(c.nombre || '').trim(),
    clase: /^[IGA]$/.test(clase) ? clase : 'G',
    tipo: String(c.tipo || (base ? base.tipo : 'fijo')) === 'eventual' ? 'eventual' : 'fijo',
    color: String(c.color || (base ? base.color : '')),
    orden: Number(c.orden) || 0
  };
}

/** La categoría (de la lista) con ese nombre, sin importar mayúsculas ni acentos. */
function buscarCategoria_(categorias, nombre) {
  var n = norm_(nombre);
  for (var i = 0; i < categorias.length; i++) if (norm_(categorias[i].nombre) === n) return categorias[i];
  return null;
}

function categoriaBase_(nombre) { return buscarCategoria_(FZ.CATEGORIAS, nombre); }

/** Las categorías de siempre, en su orden y con sus colores. */
function categoriasBase_() {
  return FZ.CATEGORIAS.map(function (c, i) { return normCategoria_({ nombre: c.nombre, orden: (i + 1) * 10 }); });
}

/** Normaliza un concepto; la clase y el tipo salen de su categoría. */
function normConcepto_(c, categorias) {
  var cat = buscarCategoria_(categorias || [], c.categoria);
  var tipo = cat ? cat.tipo : (c.tipo === 'eventual' ? 'eventual' : 'fijo');
  return {
    id: String(c.id), nombre: String(c.nombre || ''), categoria: cat ? cat.nombre : String(c.categoria || ''),
    clase: cat ? cat.clase : (/^[IGA]$/.test(String(c.clase)) ? String(c.clase) : 'G'),
    tipo: tipo, vence: tipo === 'fijo' ? String(c.vence == null ? '' : c.vence) : '', medio: String(c.medio || ''),
    proyeccion: tipo === 'eventual' ? 'No proyectar' : (FZ.PROY.indexOf(String(c.proyeccion)) >= 0 ? String(c.proyeccion) : 'Repetir'),
    formula: tipo === 'fijo' && parsearFormula_(c.formula) ? formulaTexto_(parsearFormula_(c.formula)) : '',
    orden: Number(c.orden) || 0
  };
}

/**
 * Fórmula de un concepto calculado: base (total de ingresos, total de gastos u otro concepto),
 * operación y número. Formato: "Ingresos*20%" · "Gastos+1000000" · "Ingresos-500000" · "#<id>*10%".
 * @return {{base:string, op:string, n:number}|null} base 'I' | 'G' | id; op '%' | '+' | '-'
 */
function parsearFormula_(texto) {
  var m = /^=?\s*(ingresos|gastos|#[\w-]+)\s*([*+\-])\s*([\d.,]+)\s*(%?)\s*$/i.exec(String(texto || ''));
  if (!m) return null;
  var op = m[2] === '*' ? '%' : m[2];
  if ((op === '%') !== (m[4] === '%')) return null;
  var t = m[3];
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  else if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
  var n = Number(t);
  if (!(n > 0) || (op === '%' && n > 1000)) return null;
  var b = m[1].toLowerCase();
  return { base: b === 'ingresos' ? 'I' : b === 'gastos' ? 'G' : m[1].slice(1), op: op, n: n };
}

function formulaTexto_(f) {
  return (f.base === 'I' ? 'Ingresos' : f.base === 'G' ? 'Gastos' : '#' + f.base) + (f.op === '%' ? '*' + f.n + '%' : f.op + f.n);
}

/**
 * Completa los meses de un concepto con fórmula (desde el mes actual hasta el horizonte).
 * Lo que cargaste a mano en un mes se respeta.
 */
function aplicarFormula_(modelo, c, meses, idxHoy, idxFin) {
  var f = parsearFormula_(c.formula);
  var porMes = modelo.valores[c.id] = modelo.valores[c.id] || {};
  var suman = f.base === 'I' || f.base === 'G' ? modelo.conceptos.filter(function (x) { return x.clase === f.base && !x.formula && x.id !== c.id; }) : null;
  var base = function (mes) {
    if (suman) {
      var s = null;
      suman.forEach(function (x) { var v = modelo.valores[x.id] && modelo.valores[x.id][mes]; if (v) s = (s || 0) + v.monto; });
      return s;
    }
    var v = modelo.valores[f.base] && modelo.valores[f.base][mes];
    return v ? v.monto : null;
  };
  var cambios = 0;
  meses.forEach(function (mes, i) {
    if (i < idxHoy) return;
    var x = porMes[mes];
    if (x && x.estado === 'confirmado') return;
    var b = i <= idxFin ? base(mes) : null;
    if (b === null) { if (x) { delete porMes[mes]; cambios++; } return; }
    var monto = f.op === '%' ? b * f.n / 100 : f.op === '+' ? b + f.n : Math.max(0, b - f.n);
    monto = Math.round(monto * 100) / 100;
    if (!x || x.monto !== monto || x.cuenta) { porMes[mes] = { monto: monto, cuenta: '', estado: 'estimado' }; cambios++; }
  });
  return cambios;
}

function cargarModelo_() {
  var categorias = leerTabla(FZ.T.CAT).map(normCategoria_).filter(function (c) { return c.nombre; });
  return {
    categorias: categorias,
    conceptos: leerTabla(FZ.T.CONCEPTOS).map(function (c) { return normConcepto_(c, categorias); }),
    valores: indexarValores_(leerTabla(FZ.T.VALORES))
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
    // Los conceptos con fórmula dependen de otros: se calculan todos al final
    if ((ids && ids.indexOf(c.id) < 0 && !c.formula)) return;
    var porMes = modelo.valores[c.id] = modelo.valores[c.id] || {};
    if (c.tipo !== 'fijo' || c.formula) {
      Object.keys(porMes).forEach(function (m) {
        if (porMes[m].estado === 'estimado' && ((opts.confirmarAntesDe && m < opts.confirmarAntesDe) || confirmar[c.id + '@' + m])) { porMes[m].estado = 'confirmado'; total++; }
      });
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
  modelo.conceptos.forEach(function (c) { if (c.formula) total += aplicarFormula_(modelo, c, meses, idxHoy, idxFin); });
  return total;
}

/** Ids de los conceptos con fórmula (se recalculan cuando cambia cualquier otro). */
function idsConFormula_(m) { return m.conceptos.filter(function (c) { return c.formula; }).map(function (c) { return c.id; }); }

function guardarValores_(modelo) {
  escribirTabla(FZ.T.VALORES, aplanarValores_(modelo.valores, modelo.conceptos));
}

var ORDEN_CLASE_ = { I: 0, G: 1, A: 2 };

/** Orden global: grupo (ingresos → gastos → ahorro) → categoría (orden de la tabla) → concepto. Deja órdenes 10, 20, 30… */
function renumerar_(m) {
  var gi = function (c) { return ORDEN_CLASE_.hasOwnProperty(c.clase) ? ORDEN_CLASE_[c.clase] : 1; };
  m.categorias.sort(function (a, b) { return gi(a) - gi(b) || a.orden - b.orden; });
  var catIdx = {};
  m.categorias.forEach(function (c, i) { c.orden = (i + 1) * 10; catIdx[c.nombre] = i; });
  var ci = function (c) { return catIdx.hasOwnProperty(c.categoria) ? catIdx[c.categoria] : 1e6; };
  m.conceptos.sort(function (a, b) { return ci(a) - ci(b) || a.orden - b.orden; });
  m.conceptos.forEach(function (c, i) { c.orden = (i + 1) * 10; });
}

function guardarConceptos_(m) {
  renumerar_(m);
  escribirTabla(FZ.T.CONCEPTOS, m.conceptos);
  escribirTabla(FZ.T.CAT, m.categorias);
}

/**
 * Devuelve la categoría con ese nombre; si no existe la crea (al final, con el próximo color libre).
 * @param {{clase:string, tipo:string}} def clase y tipo si hay que crearla (por defecto, gasto fijo)
 */
function asegurarCategoria_(m, nombre, def) {
  nombre = String(nombre || '').trim();
  if (!nombre) return null;
  var ya = buscarCategoria_(m.categorias, nombre);
  if (ya) return ya;
  def = def || {};
  var base = categoriaBase_(nombre);
  var usados = m.categorias.map(function (c) { return c.color; });
  var color = base ? base.color : COLORES_CAT.filter(function (x) { return usados.indexOf(x) < 0; })[0] || COLORES_CAT[m.categorias.length % COLORES_CAT.length];
  var cat = normCategoria_({ nombre: base ? base.nombre : nombre, clase: base ? base.clase : def.clase, tipo: base ? base.tipo : def.tipo, color: color, orden: 1e6 + m.categorias.length });
  m.categorias.push(cat);
  return cat;
}

/** La categoría donde van los gastos eventuales (la crea si no existe). */
function categoriaEventual_(m) {
  return m.categorias.filter(function (c) { return c.tipo === 'eventual'; })[0] ||
    asegurarCategoria_(m, FZ.CATEGORIAS.filter(function (c) { return c.tipo === 'eventual'; })[0].nombre);
}

/**
 * Ingresos siempre tiene Salario, Aguinaldo, Bonos y Otros (en ese orden, arriba de todo).
 * Reconoce los nombres parecidos ("Sueldo", "Otros ingresos", "SAC") y los renombra.
 */
function completarIngresos_(m) {
  var base = FZ.CATEGORIAS.filter(function (c) { return c.clase === 'I'; })[0];
  var cat = buscarCategoria_(m.categorias, base.nombre) || asegurarCategoria_(m, base.nombre);
  var parecidos = { Salario: /^(salario|sueldo)s?( neto)?$/, Aguinaldo: /^(aguinaldo|sac)$/, Bonos: /^(bono|bonos|bonificacion(es)?)$/, Otros: /^otros?( ingresos?)?$/ };
  var deIng = m.conceptos.filter(function (c) { return c.categoria === cat.nombre; });
  FZ.INGRESOS.forEach(function (nombre, i) {
    var c = deIng.filter(function (x) { return norm_(x.nombre) === norm_(nombre); })[0] ||
      deIng.filter(function (x) { return parecidos[nombre] && parecidos[nombre].test(norm_(x.nombre)) && FZ.INGRESOS.indexOf(x.nombre) < 0; })[0];
    if (c) c.nombre = nombre;
    else {
      c = normConcepto_({ id: nuevoId_(), nombre: nombre, categoria: cat.nombre, proyeccion: nombre === 'Salario' ? 'Repetir' : 'No proyectar' }, m.categorias);
      m.conceptos.push(c);
    }
    c.orden = -1000 + i;
  });
}

/** Mes en que impacta un gasto (tarjeta → mes siguiente, si está configurado). */
function mesImputacion_(fechaIso, medio, tarjetaMesSig) {
  var f = desdeIsoDia_(fechaIso);
  var sig = tarjetaMesSig && /tarjeta|visa|amex|master/.test(norm_(medio));
  return isoMes_(new Date(f.getFullYear(), f.getMonth() + (sig ? 1 : 0), 1));
}

/**
 * Fecha de vencimiento de cada concepto fijo en cada mes de la línea de tiempo
 * (el día cambia mes a mes: último día 28/30/31, días hábiles, feriados).
 * @return {Object} {conceptoId: {'YYYY-MM': 'YYYY-MM-DD'}}
 */
function vencimientos_(m, hoy) {
  var fer = leerFeriados();
  var meses = lineaDeTiempo_(m.valores, isoDia_(hoy), leerConfig().horizonte);
  var out = {};
  m.conceptos.forEach(function (c) {
    if (c.tipo !== 'fijo') return;
    var r = parsearRegla(c.vence);
    if (!r || r.error) return;
    out[c.id] = {};
    meses.forEach(function (mes) {
      var d = desdeIsoMes_(mes);
      var f = fechaRegla(r, d.getFullYear(), d.getMonth(), fer);
      if (f) out[c.id][mes] = isoDia_(f);
    });
  });
  return out;
}
