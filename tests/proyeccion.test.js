const test = require('node:test');
const assert = require('node:assert');
const { cargar } = require('./harness');
const G = cargar();

const conf = (v, f = '') => ({ v, f, proy: false });
const est = (v, f = '') => ({ v, f, proy: true });
const vacia = () => ({ v: '', f: '', proy: false });
const plano = (x) => JSON.parse(JSON.stringify(x));

test('repite el último valor confirmado hacia adelante', () => {
  const celdas = [conf(100), conf(120), vacia(), vacia(), vacia()];
  const ch = plano(G.calcularProyeccion(celdas, 2, 4, 'Repetir', 0));
  assert.deepStrictEqual(ch.map((c) => [c.i, c.v]), [[2, 120], [3, 120], [4, 120]]);
});

test('un aumento cargado actualiza los estimados siguientes hasta el próximo valor propio', () => {
  // mes actual = 2, el usuario cargó 150 en el mes 2; mes 5 tiene un valor propio (200)
  const celdas = [conf(100), conf(100), conf(150), est(100), est(100), conf(200), est(100)];
  const ch = plano(G.calcularProyeccion(celdas, 2, 6, 'Repetir', 0));
  assert.deepStrictEqual(ch.map((c) => [c.i, c.v]), [[3, 150], [4, 150], [6, 200]]);
});

test('no proyecta si el mes anterior quedó vacío (concepto dado de baja)', () => {
  const celdas = [conf(100), vacia(), vacia(), est(100)];
  const ch = plano(G.calcularProyeccion(celdas, 2, 3, 'Repetir', 0));
  assert.deepStrictEqual(ch, [{ i: 3, borrar: true }]);
});

test('un 0 confirmado da de baja hacia adelante', () => {
  const celdas = [conf(100), conf(0), est(100)];
  const ch = plano(G.calcularProyeccion(celdas, 1, 2, 'Repetir', 0));
  assert.deepStrictEqual(ch.map((c) => [c.i, c.v]), [[2, 0]]);
});

test('respeta el horizonte y no reescribe lo que ya está igual', () => {
  const celdas = [conf(10), est(10), est(10), vacia()];
  assert.deepStrictEqual(plano(G.calcularProyeccion(celdas, 1, 2, 'Repetir', 0)), []);
});

test('copia las cuentas escritas a mano', () => {
  const celdas = [conf(33936, '=2828*3*4'), vacia(), conf(500, '=250+250'), vacia()];
  const ch = plano(G.calcularProyeccion(celdas, 1, 3, 'Repetir', 0));
  assert.deepStrictEqual(ch.map((c) => [c.i, c.f, c.v]), [[1, '=2828*3*4', 33936], [3, '=250+250', 500]]);
});

test('promedio de 3 meses y ajuste por inflación', () => {
  const celdas = [conf(90), conf(120), conf(150), vacia(), vacia()];
  assert.deepStrictEqual(plano(G.calcularProyeccion(celdas, 3, 4, 'Promedio 3 meses', 0)).map((c) => c.v), [120, 120]);
  assert.deepStrictEqual(plano(G.calcularProyeccion(celdas, 3, 4, 'Ajustar por inflación', 0.1)).map((c) => c.v), [165, 182]);
});

test('"No proyectar" limpia estimados', () => {
  const celdas = [conf(100), est(100), vacia()];
  assert.deepStrictEqual(plano(G.calcularProyeccion(celdas, 1, 2, 'No proyectar', 0)), [{ i: 1, borrar: true }]);
});

test('meses específicos y aumento fijo mensual', () => {
  // ene..dic; cargado en junio (idx 5); hoy = septiembre (idx 8)
  const celdas = Array.from({ length: 24 }, (_, i) => (i === 5 ? { v: 100, f: '', proy: false } : { v: '', f: '', proy: false }));
  const numMes = Array.from({ length: 24 }, (_, i) => (i % 12) + 1);
  const ch = G.calcularProyeccion(celdas, 8, 23, 'Repetir', 0, { meses: [6, 12], numMes });
  assert.deepStrictEqual([...ch.map((x) => x.i)], [11, 17, 23]);
  assert.ok(ch.every((x) => x.v === 100));
  const au = G.calcularProyeccion(celdas, 8, 23, 'Aumento 10%', 0, { meses: [12], numMes });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(au.map((x) => [x.i, x.v]))), [[11, Math.round(100 * Math.pow(1.1, 6))], [23, Math.round(100 * Math.pow(1.1, 18))]]);
  // Todos los meses: un mes vacío antes de hoy sigue siendo baja
  assert.deepStrictEqual(G.calcularProyeccion(celdas, 8, 23, 'Repetir', 0).length, 0);
});
