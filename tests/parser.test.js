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

test('cuotas escritas en la celda', () => {
  assert.deepStrictEqual({ ...P.cuotasEnCelda('900k 6c') }, { texto: '900k', cuotas: 6 });
  assert.deepStrictEqual({ ...P.cuotasEnCelda('900000 x 12') }, { texto: '900000', cuotas: 12 });
  assert.deepStrictEqual({ ...P.cuotasEnCelda('90.000 en 3 cuotas') }, { texto: '90.000', cuotas: 3 });
  assert.strictEqual(P.cuotasEnCelda('1506c'), null);
  assert.strictEqual(P.cuotasEnCelda('900000'), null);
  assert.strictEqual(P.cuotasEnCelda('hola 3c'), null);
});

test('filas de la grilla: secciones, categorías con color y filas nuevas', () => {
  const sec = [{ nombre: 'Ingresos', clase: 'I', tipo: 'fijo' }, { nombre: 'Gastos fijos', clase: 'G', tipo: 'fijo' }, { nombre: 'Eventuales', clase: 'G', tipo: 'eventual' }];
  const c = (id, nombre, seccion, categoria, tipo, orden) => ({ id, nombre, seccion, categoria, tipo: tipo || 'fijo', orden });
  const con = [c('1', 'Salario', 'Ingresos', 'Ingresos', 'fijo', 1), c('2', 'Luz', 'Gastos fijos', 'Servicios', 'fijo', 3), c('3', 'Alquiler', 'Gastos fijos', 'Vivienda', 'fijo', 2), c('4', 'Heladera', 'Eventuales', 'Hogar', 'eventual', 4)];
  const cats = [{ seccion: 'Gastos fijos', nombre: 'Vivienda', color: '#111', orden: 1 }, { seccion: 'Gastos fijos', nombre: 'Servicios', color: '#222', orden: 2 },
    { seccion: 'Eventuales', nombre: 'Hogar', color: '#333', orden: 3 }, { seccion: 'Eventuales', nombre: 'Viajes', color: '#444', orden: 4 }];
  const f = P.construirFilas(con, cats, sec, { nuevos: [{ t: 'nuevo', seccion: 'Gastos fijos', categoria: 'Servicios' }] })
    .map((x) => x.t + ':' + (x.c ? x.c.nombre : x.cat ? x.cat.nombre : x.categoria || x.sec.nombre));
  assert.deepStrictEqual([...f], ['sec:Ingresos', 'item:Salario', 'sec:Gastos fijos', 'cat:Vivienda', 'item:Alquiler', 'cat:Servicios', 'item:Luz', 'nuevo:Servicios',
    'sec:Eventuales', 'cat:Hogar', 'item:Heladera', 'cat:Viajes']);
  const oculto = P.construirFilas(con, cats, sec, { visible: (x) => x.tipo !== 'eventual' }).map((x) => x.t);
  assert.ok(!oculto.includes('item') || oculto.filter((t) => t === 'item').length === 3);
  const cerr = P.construirFilas(con, cats, sec, { colapsadas: { 's:Gastos fijos': true } }).map((x) => x.t);
  assert.strictEqual(cerr.filter((t) => t === 'cat').length, 2);
});

test('línea de tiempo igual en cliente y servidor', () => {
  const idx = { a: { '2024-03': {} } };
  const cli = P.lineaDeTiempoP(idx, '2026-09-28', 12);
  const srv = G.lineaDeTiempo_(idx, '2026-09-28', 12);
  assert.strictEqual(cli.join(), srv.join());
  assert.strictEqual(cli[0], '2024-01');
  assert.strictEqual(cli[cli.length - 1], '2027-12');
});
