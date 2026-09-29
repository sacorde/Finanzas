const test = require('node:test');
const assert = require('node:assert');
const { cargar, cargarBloqueHtml } = require('./harness');
const P = cargarBloqueHtml('Nucleo.html', 'nucleo');
const G = cargar();

const ctx = {
  hoy: '2026-09-28',
  medios: ['Débito automático', 'Tarjeta VISA', 'Tarjeta AMEX', 'Transferencia', 'Efectivo', 'Mercado Pago'],
  items: [
    { nombre: 'Luz', fila: 28, categoria: 'Servicios' }, { nombre: 'Seguro', fila: 38, categoria: 'Auto' },
    { nombre: 'Seguro Incendio', fila: 35, categoria: 'Vivienda' }, { nombre: 'Super Mes', fila: 41, categoria: 'Supermercado' },
    { nombre: 'Expensas', fila: 34, categoria: 'Vivienda' }, { nombre: 'Salario', fila: 9, categoria: 'Ingresos' }
  ],
  aprendidas: { 'coto': 'Salidas y comida', '#coto': 'Salidas y comida' },
  palabras: G.PALABRAS_CATEGORIA_
};
const I = (t) => JSON.parse(JSON.stringify(P.interpretar(t, ctx)));

test('concepto fijo + monto', () => {
  const r = I('luz 89.423');
  assert.strictEqual(r.tipo, 'fijo');
  assert.strictEqual(r.candidatos[0].nombre, 'Luz');
  assert.strictEqual(r.monto.valor, 89423);
});

test('coincidencia exacta gana; ambiguos quedan como candidatos', () => {
  const r = I('seguro 131869');
  assert.deepStrictEqual(r.candidatos.map((c) => c.nombre), ['Seguro', 'Seguro Incendio']);
  assert.strictEqual(I('super 350k').candidatos[0].nombre, 'Super Mes');
});

test('eventual con cuotas, medio y categoría', () => {
  const r = I('heladera 900k 6 cuotas visa');
  assert.strictEqual(r.tipo, 'mov');
  assert.strictEqual(r.desc, 'heladera');
  assert.strictEqual(r.monto.valor, 900000);
  assert.strictEqual(r.cuotas, 6);
  assert.strictEqual(r.medio, 'Tarjeta VISA');
  assert.strictEqual(r.categoria, 'Hogar');
});

test('cuentas, meses y fechas', () => {
  const r = I('expensas 191211+11389 oct');
  assert.strictEqual(r.monto.valor, 202600);
  assert.ok(r.monto.cuenta);
  assert.strictEqual(r.montoTexto, '191211+11389');
  assert.strictEqual(r.mes, '2026-10');
  assert.strictEqual(I('viaje mar del plata 300k').mes, '');
  assert.strictEqual(I('viaje mar del plata 300k').categoria, 'Viajes');
  assert.strictEqual(I('salario 3.600.000 mes que viene').mes, '2026-10');
  assert.strictEqual(I('coto 19/07 57500').fecha, '2026-07-19');
  assert.strictEqual(I('coto 19/07 57500').categoria, 'Salidas y comida');
  assert.strictEqual(I('cena ayer 25k').fecha, '2026-09-27');
  assert.strictEqual(I('samsung s24 485000 x12').cuotas, 12);
  assert.strictEqual(I('samsung s24 485000 x12').desc, 'samsung s24');
  assert.strictEqual(I('empanadas 3ra docena 21000').desc, 'empanadas 3ra docena');
});

test('mes de impacto con tarjeta', () => {
  assert.strictEqual(P.mesImpacto('2026-09-20', 'Tarjeta VISA', true), '2026-10');
  assert.strictEqual(P.mesImpacto('2026-09-20', 'Efectivo', true), '2026-09');
});

test('el cliente categoriza igual que el servidor', () => {
  for (const d of ['Heladera', 'Vuelo BRC', 'MC Donals', 'Zapatilla', 'Matricula ISTEA', 'algo raro']) {
    assert.strictEqual(P.adivinarP(d, {}, G.PALABRAS_CATEGORIA_), G.adivinarCategoria(d, {}), d);
  }
});

test('montos: cliente y servidor coinciden', () => {
  for (const s of ['89.423', '1.234,56', '150k', '2828*3*4', '(100+50)/2', 'abc', '1,5M']) {
    const a = P.montoP(s), b = G.parsearMonto(s);
    assert.strictEqual(a && a.valor, b && b.valor, s);
  }
});

test('sumas de eventuales reparten cuotas', () => {
  const E = JSON.parse(JSON.stringify(P.sumasEventuales([
    { categoria: 'Hogar', monto: 900, cuotas: 3, mes: '2026-11' }, { categoria: 'Hogar', monto: 50, cuotas: 1, mes: '2026-12' }
  ])));
  assert.deepStrictEqual(E, { Hogar: { '2026-11': 300, '2026-12': 350, '2027-01': 300 } });
  const del = P.movimientosDelMes([{ categoria: 'Hogar', monto: 900, cuotas: 3, mes: '2026-11' }], 'Hogar', '2027-01');
  assert.strictEqual(del[0].cuota, 3);
});

test('filas de la grilla: secciones, categorías y filas para agregar', () => {
  const sec = [{ nombre: 'Ingresos', clase: 'I', tipo: 'fijo' }, { nombre: 'Gastos fijos', clase: 'G', tipo: 'fijo' }, { nombre: 'Eventuales', clase: 'G', tipo: 'eventual' }];
  const c = (id, nombre, seccion, categoria, tipo, orden) => ({ id, nombre, seccion, categoria, tipo: tipo || 'fijo', orden });
  const con = [c('1', 'Salario', 'Ingresos', 'Ingresos', 'fijo', 1), c('2', 'Luz', 'Gastos fijos', 'Servicios', 'fijo', 3), c('3', 'Alquiler', 'Gastos fijos', 'Vivienda', 'fijo', 2), c('4', 'Viajes', 'Eventuales', 'Viajes', 'eventual', 4)];
  const f = P.construirFilas(con, sec, {}).map((x) => x.t + ':' + (x.c ? x.c.nombre : x.categoria || x.sec.nombre));
  assert.deepStrictEqual([...f], ['sec:Ingresos', 'item:Salario', 'add:Ingresos', 'sec:Gastos fijos', 'cat:Vivienda', 'item:Alquiler', 'add:Vivienda', 'cat:Servicios', 'item:Luz', 'add:Servicios', 'addcat:Gastos fijos', 'sec:Eventuales', 'item:Viajes', 'add:Eventuales']);
  const cerr = P.construirFilas(con, sec, { 's:Gastos fijos': true }).map((x) => x.t);
  assert.strictEqual(cerr.filter((t) => t === 'cat').length, 0);
});

test('línea de tiempo igual en cliente y servidor', () => {
  const idx = { a: { '2024-03': {} } };
  const cli = P.lineaDeTiempoP(idx, [], '2026-09-28', 12);
  const srv = G.lineaDeTiempo_(idx, [], '2026-09-28', 12);
  assert.strictEqual(cli.join(), srv.join());
  assert.strictEqual(cli[0], '2024-01');
  assert.strictEqual(cli[cli.length - 1], '2027-12');
});
