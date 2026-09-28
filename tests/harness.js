// Carga los archivos de apps-script/ en un contexto aislado para testear la lógica pura.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * @param {{hoy?: Date}} opts  hoy: fija la fecha actual (new Date() y Date.now()).
 */
function cargar(opts = {}) {
  let D = Date;
  if (opts.hoy) {
    const HOY = opts.hoy.getTime();
    D = class extends Date { constructor(...a) { if (a.length) super(...a); else super(HOY); } static now() { return HOY; } };
  }
  const ctx = { console, Date: D, Math, JSON, Number, String, Object, Array, RegExp, isNaN, isFinite, parseInt, parseFloat, Error };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'apps-script');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

/** Extrae el bloque marcado // <nombre> ... // </nombre> de un HTML y lo evalúa. */
function cargarBloqueHtml(archivo, nombre) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', archivo), 'utf8');
  const i = src.indexOf('// <' + nombre + '>'), j = src.indexOf('// </' + nombre + '>');
  if (i < 0 || j < 0) throw new Error('No se encontró el bloque ' + nombre);
  const ctx = { console, Date, Math, JSON, Number, String, Object, Array, RegExp, isNaN, isFinite, Intl };
  vm.createContext(ctx);
  vm.runInContext(src.slice(i, j), ctx, { filename: archivo });
  return ctx;
}

module.exports = { cargar, cargarBloqueHtml };
