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

test('eventual con cuotas y medio', () => {
  const r = I('heladera 900k 6 cuotas visa');
  assert.strictEqual(r.tipo, 'mov');
  assert.strictEqual(r.desc, 'heladera');
  assert.strictEqual(r.monto.valor, 900000);
  assert.strictEqual(r.cuotas, 6);
  assert.strictEqual(r.medio, 'Tarjeta VISA');
});

test('cuentas, meses y fechas', () => {
  const r = I('expensas 191211+11389 oct');
  assert.strictEqual(r.monto.valor, 202600);
  assert.ok(r.monto.cuenta);
  assert.strictEqual(r.montoTexto, '191211+11389');
  assert.strictEqual(r.mes, '2026-10');
  assert.strictEqual(I('viaje mar del plata 300k').mes, '');
  assert.strictEqual(I('salario 3.600.000 mes que viene').mes, '2026-10');
  assert.strictEqual(I('coto 19/07 57500').fecha, '2026-07-19');
  assert.strictEqual(I('cena ayer 25k').fecha, '2026-09-27');
  assert.strictEqual(I('samsung s24 485000 x12').cuotas, 12);
  assert.strictEqual(I('samsung s24 485000 x12').desc, 'samsung s24');
  assert.strictEqual(I('empanadas 3ra docena 21000').desc, 'empanadas 3ra docena');
});

test('mes de impacto con tarjeta', () => {
  assert.strictEqual(P.mesImpacto('2026-09-20', 'Tarjeta VISA', true), '2026-10');
  assert.strictEqual(P.mesImpacto('2026-09-20', 'Efectivo', true), '2026-09');
});

test('categoría nueva para conceptos de versiones anteriores', () => {
  const m = (seccion, categoria, nombre, clase, tipo) => G.mapearCategoria_({ seccion, categoria, nombre, clase: clase || 'G', tipo: tipo || 'fijo' });
  assert.strictEqual(m('Gastos fijos', 'Auto', 'Seguro'), 'Transporte');
  assert.strictEqual(m('Gastos fijos', 'Vivienda', 'Crossfit'), 'Vivienda');
  assert.strictEqual(m('Gastos fijos', 'Gastos fijos', 'Netflix'), 'Suscripciones');
  assert.strictEqual(m('Gastos fijos', 'Gastos fijos', 'Gas'), 'Servicios');
  assert.strictEqual(m('Préstamos y deudas', 'Préstamos y deudas', 'Banco'), 'Préstamos');
  assert.strictEqual(m('Ingresos', 'Ingresos', 'Sueldo', 'I'), 'Ingresos');
  assert.strictEqual(m('Ahorro e inversión', '', 'Dólares', 'A'), 'Ahorro e Inversión');
  assert.strictEqual(m('Eventuales', 'Hogar', 'Silla', 'G', 'eventual'), 'Eventuales');
  assert.strictEqual(m('Gastos fijos', 'Mascotas', 'Veterinaria'), 'Mascotas', 'una categoría propia se conserva');
  assert.strictEqual(m('Gastos fijos', 'Otros fijos', 'Cosa rara'), 'Servicios');
});

test('resumen de vencimiento y medio junto al nombre', () => {
  const r = (c) => P.resumenConcepto(Object.assign({ tipo: 'fijo', proyeccion: 'Repetir' }, c));
  assert.strictEqual(r({ vence: '1er hábil', medio: 'Débito automático' }), '1er háb. · Déb. aut.');
  assert.strictEqual(r({ vence: '10', medio: 'Tarjeta VISA' }), 'día 10 · VISA');
  assert.strictEqual(r({ vence: 'anteúltimo hábil' }), 'anteúlt. háb.');
  assert.strictEqual(r({ proyeccion: 'Promedio 3 meses' }), 'prom.');
  assert.strictEqual(r({}), '');
  assert.strictEqual(r({ tipo: 'eventual', vence: '10', medio: 'Efectivo', proyeccion: 'No proyectar' }), 'Efectivo');
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

test('filas de la grilla: categorías con color, sus filas y filas nuevas', () => {
  const c = (id, nombre, categoria, tipo, orden) => ({ id, nombre, categoria, tipo: tipo || 'fijo', orden });
  const con = [c('1', 'Salario', 'Ingresos', 'fijo', 1), c('2', 'Luz', 'Servicios', 'fijo', 3), c('3', 'Alquiler', 'Vivienda', 'fijo', 2), c('4', 'Heladera', 'Eventuales', 'eventual', 4)];
  const cats = [{ nombre: 'Ingresos', color: '#000', orden: 0 }, { nombre: 'Vivienda', color: '#111', orden: 1 }, { nombre: 'Servicios', color: '#222', orden: 2 },
    { nombre: 'Préstamos', color: '#333', orden: 3 }, { nombre: 'Eventuales', color: '#444', orden: 4 }];
  const f = P.construirFilas(con, cats, { nuevos: [{ t: 'nuevo', categoria: 'Servicios' }, { t: 'nuevacat' }] })
    .map((x) => x.t + (x.c ? ':' + x.c.nombre : x.cat ? ':' + x.cat.nombre : ''));
  assert.deepStrictEqual([...f], ['cat:Ingresos', 'item:Salario', 'cat:Vivienda', 'item:Alquiler', 'cat:Servicios', 'item:Luz', 'nuevo:Servicios',
    'cat:Préstamos', 'cat:Eventuales', 'item:Heladera', 'nuevacat']);
  const oculto = P.construirFilas(con, cats, { visible: (x) => x.tipo !== 'eventual' }).map((x) => x.t);
  assert.strictEqual(oculto.filter((t) => t === 'item').length, 3);
  const cerr = P.construirFilas(con, cats, { colapsadas: { Vivienda: true } }).map((x) => x.t + (x.c ? ':' + x.c.nombre : ''));
  assert.ok(!cerr.includes('item:Alquiler'));
  assert.strictEqual(cerr.filter((t) => t === 'cat').length, 5);
});

test('línea de tiempo igual en cliente y servidor', () => {
  const idx = { a: { '2024-03': {} } };
  const cli = P.lineaDeTiempoP(idx, '2026-09-28', 12);
  const srv = G.lineaDeTiempo_(idx, '2026-09-28', 12);
  assert.strictEqual(cli.join(), srv.join());
  assert.strictEqual(cli[0], '2024-01');
  assert.strictEqual(cli[cli.length - 1], '2027-12');
});
