/**
 * Finanzas · API que usa la app web (google.script.run)
 * Todo lo que viaja al navegador son textos y números (sin objetos Date).
 */

function api_estado() {
  var ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  return {
    instalado: dbInstalada_(),
    fuente: detectarFuente_(ss),
    hojas: ss.getSheets().map(function (s) { return s.getName(); }),
    urlPlanilla: ss.getUrl(),
    version: FZ.VERSION
  };
}

/** Todo lo necesario para dibujar la app. */
function api_datos() {
  var m = cargarModelo_();
  var hoy = new Date();
  var cfgRaw = {};
  CFG_DEF.forEach(function (d) { cfgRaw[d.k] = d.def; });
  leerTabla(FZ.T.CFG).forEach(function (r) { if (cfgRaw.hasOwnProperty(r.clave)) cfgRaw[r.clave] = String(r.valor); });
  var indices = leerTabla(FZ.T.IND);
  return {
    hoy: isoDia_(hoy),
    conceptos: m.conceptos,
    valores: aplanarValores_(m.valores, m.conceptos).map(function (v) { return [v.concepto, v.mes, v.monto, v.cuenta, v.estado === 'estimado' ? 1 : 0]; }),
    movimientos: m.movimientos,
    indices: indices,
    feriados: leerTabla(FZ.T.FER),
    config: cfgRaw,
    cfgDef: CFG_DEF,
    cfg: leerConfig(),
    secciones: FZ.SECCIONES,
    proyecciones: FZ.PROY,
    venc: vencimientos_(m.conceptos, hoy),
    inflEsperada: Math.round(inflacionEsperada_(indices) * 1000) / 10,
    palabras: PALABRAS_CATEGORIA_,
    aprendidas: aprenderCategorias_(m.movimientos.slice(-800)),
    urlPlanilla: ss_().getUrl()
  };
}

function valoresDe_(modelo, ids) {
  var out = {};
  ids.forEach(function (id) {
    out[id] = [];
    var porMes = modelo.valores[id] || {};
    Object.keys(porMes).sort().forEach(function (mes) {
      var v = porMes[mes];
      out[id].push([mes, v.monto, v.cuenta, v.estado === 'estimado' ? 1 : 0]);
    });
  });
  return out;
}

/**
 * Guarda celdas editadas en la grilla.
 * @param {Array<{c:string, mes:string, texto:(string|undefined), estado:(string|undefined)}>} cambios
 *   texto '' = borrar · texto undefined + estado = solo cambiar el estado (confirmar / marcar estimado)
 * @return {{valores:Object}} valores actualizados de los conceptos tocados (incluye la proyección)
 */
function api_guardarCeldas(cambios) {
  return conLock_(function () {
    var m = cargarModelo_();
    var porId = {};
    m.conceptos.forEach(function (c) { porId[c.id] = c; });
    var tocados = [];
    cambios.forEach(function (ch) {
      var c = porId[ch.c];
      if (!c || c.tipo !== 'fijo') return;
      if (!/^\d{4}-\d{2}$/.test(String(ch.mes))) throw new Error('Mes inválido: ' + ch.mes);
      var porMes = m.valores[c.id] = m.valores[c.id] || {};
      if (ch.texto === undefined || ch.texto === null) {
        if (porMes[ch.mes] && ch.estado) porMes[ch.mes].estado = ch.estado === 'estimado' ? 'estimado' : 'confirmado';
      } else if (String(ch.texto).trim() === '') {
        delete porMes[ch.mes];
      } else {
        var monto = parsearMonto(ch.texto);
        if (!monto) throw new Error('No entendí "' + ch.texto + '" (' + c.nombre + ', ' + etiquetaMes_(ch.mes) + ')');
        porMes[ch.mes] = { monto: monto.valor, cuenta: monto.formula ? monto.formula.replace(/^=/, '') : '', estado: ch.estado === 'estimado' ? 'estimado' : 'confirmado' };
      }
      if (tocados.indexOf(c.id) < 0) tocados.push(c.id);
    });
    reproyectar_(m, tocados);
    guardarValores_(m);
    return { valores: valoresDe_(m, tocados) };
  });
}

/** Crea o modifica un concepto. */
function api_guardarConcepto(c) {
  return conLock_(function () {
    var m = cargarModelo_();
    var nombre = String(c.nombre || '').trim();
    if (!nombre) throw new Error('El concepto necesita un nombre.');
    var sec = seccionPorNombre_(c.seccion) || FZ.SECCIONES[1];
    var existente = c.id ? m.conceptos.filter(function (x) { return x.id === c.id; })[0] : null;
    var regla = parsearRegla(c.vence);
    if (regla && regla.error) throw new Error(regla.error);
    var nuevo = normConcepto_({
      id: existente ? existente.id : nuevoId_(), nombre: nombre, seccion: sec.nombre,
      categoria: sec.tipo === 'eventual' ? nombre : (String(c.categoria || '').trim() || sec.nombre),
      vence: c.vence || '', medio: c.medio || '', proyeccion: c.proyeccion || 'Repetir',
      orden: existente ? existente.orden : 0
    });
    if (!existente) {
      var mismos = m.conceptos.filter(function (x) { return x.seccion === nuevo.seccion && x.categoria === nuevo.categoria; });
      var base = mismos.length ? mismos : m.conceptos.filter(function (x) { return x.seccion === nuevo.seccion; });
      var maxOrden = base.length ? Math.max.apply(null, base.map(function (x) { return x.orden; })) : seccionOrdenBase_(m, nuevo.seccion);
      nuevo.orden = maxOrden + 1;
      m.conceptos.push(nuevo);
    } else {
      if (existente.tipo === 'eventual' && existente.nombre !== nuevo.nombre) {
        m.movimientos.forEach(function (mv) { if (mv.categoria === existente.nombre) mv.categoria = nuevo.nombre; });
        escribirTabla(FZ.T.MOV, m.movimientos);
      }
      m.conceptos[m.conceptos.indexOf(existente)] = nuevo;
    }
    renumerar_(m);
    guardarConceptos_(m);
    reproyectar_(m, [nuevo.id]);
    guardarValores_(m);
    return { conceptos: m.conceptos, valores: valoresDe_(m, [nuevo.id]), venc: vencimientos_(m.conceptos, new Date()), id: nuevo.id };
  });
}

function seccionOrdenBase_(m, seccion) {
  var i = FZ.SECCIONES.map(function (s) { return s.nombre; }).indexOf(seccion);
  return (i < 0 ? 90 : i) * 10000;
}

/** Ordena por sección (orden fijo) y deja órdenes limpios 10, 20, 30… */
function renumerar_(m) {
  var secIdx = function (c) { var i = FZ.SECCIONES.map(function (s) { return s.nombre; }).indexOf(c.seccion); return i < 0 ? 99 : i; };
  m.conceptos.sort(function (a, b) { return secIdx(a) - secIdx(b) || a.orden - b.orden; });
  m.conceptos.forEach(function (c, i) { c.orden = (i + 1) * 10; });
}

function api_borrarConcepto(id) {
  return conLock_(function () {
    var m = cargarModelo_();
    var c = m.conceptos.filter(function (x) { return x.id === id; })[0];
    if (!c) return { conceptos: m.conceptos };
    if (c.tipo === 'eventual') {
      var usados = m.movimientos.filter(function (mv) { return mv.categoria === c.nombre; });
      if (usados.length) {
        var otros = m.conceptos.filter(function (x) { return x.tipo === 'eventual' && x.id !== id; })
          .sort(function (a, b) { return (b.nombre === 'Otros') - (a.nombre === 'Otros'); })[0];
        if (!otros) throw new Error('No se puede borrar la única categoría de eventuales.');
        usados.forEach(function (mv) { mv.categoria = otros.nombre; });
        escribirTabla(FZ.T.MOV, m.movimientos);
      }
    }
    m.conceptos.splice(m.conceptos.indexOf(c), 1);
    delete m.valores[id];
    guardarConceptos_(m);
    guardarValores_(m);
    return { conceptos: m.conceptos };
  });
}

/** Nuevo orden de conceptos (lista de ids en el orden deseado). Permite mover entre categorías. */
function api_ordenarConceptos(ids, cambiosCategoria) {
  return conLock_(function () {
    var m = cargarModelo_();
    var pos = {};
    ids.forEach(function (id, i) { pos[id] = i; });
    (cambiosCategoria || []).forEach(function (x) {
      m.conceptos.forEach(function (c) { if (c.id === x.id && c.tipo === 'fijo') { c.categoria = x.categoria; var s = seccionPorNombre_(x.seccion); if (s && s.tipo === 'fijo') { c.seccion = s.nombre; c.clase = s.clase; } } });
    });
    m.conceptos.forEach(function (c) { c.orden = pos.hasOwnProperty(c.id) ? pos[c.id] : 9999; });
    renumerar_(m);
    guardarConceptos_(m);
    return { conceptos: m.conceptos };
  });
}

/** Crea o modifica un gasto eventual. */
function api_guardarMovimiento(p) {
  return conLock_(function () {
    var cfg = leerConfig();
    var m = cargarModelo_();
    var monto = parsearMonto(p.texto != null ? p.texto : p.monto);
    if (!monto) throw new Error('No entendí el monto "' + (p.texto || p.monto) + '"');
    var cats = m.conceptos.filter(function (c) { return c.tipo === 'eventual'; }).map(function (c) { return c.nombre; });
    var categoria = cats.indexOf(p.categoria) >= 0 ? p.categoria : (cats.indexOf('Otros') >= 0 ? 'Otros' : cats[0]);
    var fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha)) ? p.fecha : isoDia_(new Date());
    var mv = normMovimiento_({
      id: p.id || nuevoId_(), fecha: fecha, descripcion: String(p.descripcion || '').trim() || 'Gasto', categoria: categoria,
      monto: monto.valor, cuenta: monto.formula ? monto.formula.replace(/^=/, '') : '', cuotas: p.cuotas, medio: p.medio,
      mes: /^\d{4}-\d{2}$/.test(String(p.mes || '')) ? p.mes : mesImputacion_(fecha, p.medio, cfg.tarjetaMesSig), nota: p.nota
    });
    var i = m.movimientos.map(function (x) { return x.id; }).indexOf(mv.id);
    if (i >= 0) m.movimientos[i] = mv; else m.movimientos.push(mv);
    m.movimientos.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
    escribirTabla(FZ.T.MOV, m.movimientos);
    return { movimiento: mv };
  });
}

function api_borrarMovimiento(id) {
  return conLock_(function () {
    var movs = leerTabla(FZ.T.MOV).map(normMovimiento_).filter(function (x) { return x.id !== id; });
    escribirTabla(FZ.T.MOV, movs);
    return { ok: true };
  });
}

function api_guardarConfig(valores) {
  return conLock_(function () {
    var filas = CFG_DEF.map(function (d) {
      return { clave: d.k, valor: valores.hasOwnProperty(d.k) ? String(valores[d.k]) : d.def, descripcion: d.ayuda };
    });
    escribirTabla(FZ.T.CFG, filas);
    CFG_CACHE_ = null;
    var m = cargarModelo_();
    reproyectar_(m, null);
    guardarValores_(m);
    return api_datos();
  });
}

function api_guardarFeriados(lista) {
  return conLock_(function () {
    var filas = (lista || []).filter(function (f) { return /^\d{4}-\d{2}-\d{2}$/.test(String(f.fecha)); })
      .map(function (f) { return { fecha: f.fecha, nombre: f.nombre || 'Feriado', origen: f.origen || 'manual' }; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    escribirTabla(FZ.T.FER, filas);
    FERIADOS_CACHE_ = null;
    return { feriados: filas, venc: vencimientos_(cargarModelo_().conceptos, new Date()) };
  });
}

function api_actualizarIndices() {
  var r = actualizarIndices();
  return { resultado: r, indices: leerTabla(FZ.T.IND) };
}

function api_sincronizarCalendario() {
  return sincronizarCalendario();
}
