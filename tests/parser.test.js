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

test('junto al nombre: día de pago del mes y medio de pago abreviado', () => {
  assert.deepStrictEqual(['Débito automático', 'Transferencia', 'Efectivo', 'Mercado Pago', 'Tarjeta VISA', 'Tarjeta AMEX', ''].map(P.abrevMedio), ['DA', 'T', 'EF', 'MP', 'VISA', 'AMEX', '']);
  assert.strictEqual(P.resumenConcepto({ tipo: 'fijo', proyeccion: 'Promedio 3 meses' }), 'prom.');
  assert.strictEqual(P.resumenConcepto({ tipo: 'fijo', proyeccion: 'Repetir' }), '');
  assert.strictEqual(P.resumenConcepto({ tipo: 'eventual', proyeccion: 'No proyectar' }), '');
  const venc = { a: { '2026-02': '2026-02-28', '2026-03': '2026-03-31' } };
  assert.strictEqual(P.diaDePago(venc, 'a', '2026-02'), 28);
  assert.strictEqual(P.diaDePago(venc, 'a', '2026-03'), 31);
  assert.strictEqual(P.diaDePago(venc, 'a', '2026-04'), null);
  assert.strictEqual(P.diaDePago(venc, 'b', '2026-02'), null);
});

test('fórmulas (ƒx): cliente igual que servidor', () => {
  for (const t of ['Ingresos*20%', '=ingresos * 12,5 %', '#abc123*10%', 'Gastos+1000000', 'Ingresos-1.000.000', '#abc-500000', 'Ingresos*0%', 'Ingresos*20', 'Gastos+10%', 'otra cosa', '']) {
    const a = P.parsearFormulaP(t), b = G.parsearFormula_(t);
    assert.deepStrictEqual(a && { ...a }, b && { ...b }, t);
  }
  assert.deepStrictEqual({ ...P.parsearFormulaP('Ingresos-1.000.000') }, { base: 'I', op: '-', n: 1000000 });
  assert.strictEqual(P.parsearFormulaP('Ingresos*20'), null, 'el porcentaje lleva %');
  assert.strictEqual(P.textoFormula('I', '%', 20), 'Ingresos*20%');
  assert.strictEqual(P.textoFormula('G', '+', 1000000), 'Gastos+1000000');
  assert.strictEqual(P.textoFormula('abc', '-', 500), '#abc-500');
  assert.strictEqual(P.describirFormula('Ingresos*20%', []), '20% de Ingresos');
  assert.strictEqual(P.describirFormula('Gastos+1000000', []), 'Gastos + $ 1.000.000');
  assert.strictEqual(P.describirFormula('#abc*12.5%', [{ id: 'abc', nombre: 'Salario' }]), '12,5% de Salario');
  assert.strictEqual(P.resumenConcepto({ tipo: 'fijo', proyeccion: 'Repetir', formula: 'Ingresos*20%' }), 'ƒx 20%');
  assert.strictEqual(P.resumenConcepto({ tipo: 'fijo', proyeccion: 'Repetir', formula: 'Gastos+1000' }), 'ƒx');
});

test('filas archivadas según el mes elegido', () => {
  const ev = { tipo: 'eventual' }, fijo = { tipo: 'fijo' };
  const vac = { '2026-01': { m: 900000 } };
  assert.strictEqual(P.estaArchivado(ev, vac, '2026-09'), true, 'eventual de enero, archivado en septiembre');
  assert.strictEqual(P.estaArchivado(ev, vac, '2026-01'), false, 'visible en su mes');
  assert.strictEqual(P.estaArchivado(ev, { '2026-08': { m: 1 }, '2026-09': { m: 1 }, '2026-10': { m: 1 } }, '2026-09'), false, 'cuota del mes');
  assert.strictEqual(P.estaArchivado(ev, {}, '2026-09'), false, 'fila nueva sin montos');
  const alquiler = { '2026-01': { m: 1 }, '2026-09': { m: 1 }, '2026-12': { m: 1 } };
  assert.strictEqual(P.estaArchivado(fijo, alquiler, '2026-09'), false, 'se paga todos los meses');
  const netflix = { '2025-10': { m: 6000 }, '2026-04': { m: 6000 }, '2026-05': { m: 0 }, '2026-12': { m: 0 } };
  assert.strictEqual(P.estaArchivado(fijo, netflix, '2026-09'), true, 'dado de baja (los 0 no cuentan)');
  assert.strictEqual(P.estaArchivado(fijo, netflix, '2026-03'), false, 'visible antes de la baja');
  assert.strictEqual(P.estaArchivado(fijo, { '2026-12': { m: 5 } }, '2026-09'), false, 'empieza más adelante');
  assert.strictEqual(P.estaArchivado(fijo, {}, '2026-09'), false, 'Aguinaldo/Bonos vacíos siempre visibles');
});

test('selector de vencimiento: día 1–28, último / anteúltimo, hábil', () => {
  const r = (dia, fin, habil) => P.reglaDesdeSelector({ dia, fin, habil });
  assert.strictEqual(r(15, '', false), '15');
  assert.strictEqual(r('10', '', true), '10 hábil');
  assert.strictEqual(r(31, '', false), '28', 'máximo 28');
  assert.strictEqual(r('', '', true), '', 'sin día no hay vencimiento');
  assert.strictEqual(r(5, 'ultimo', false), 'último día', 'último gana sobre el día');
  assert.strictEqual(r('', 'ultimo', true), 'último hábil');
  assert.strictEqual(r('', 'anteultimo', false), 'anteúltimo día');
  assert.strictEqual(r('', 'anteultimo', true), 'anteúltimo hábil');
  const s = (t) => ({ ...P.selectorDesdeRegla(t) });
  assert.deepStrictEqual(s('15'), { dia: 15, fin: '', habil: false });
  assert.deepStrictEqual(s('10 hábil'), { dia: 10, fin: '', habil: true });
  assert.deepStrictEqual(s('1er hábil'), { dia: 1, fin: '', habil: true });
  assert.deepStrictEqual(s('último día'), { dia: '', fin: 'ultimo', habil: false });
  assert.deepStrictEqual(s('anteúltimo hábil'), { dia: '', fin: 'anteultimo', habil: true });
  assert.deepStrictEqual(s(''), { dia: '', fin: '', habil: false });
  assert.ok(s('primer lunes').otra);
  assert.ok(s('30').otra, 'día mayor a 28 no entra en el selector');
  // Todo lo que arma el selector lo entiende el servidor
  for (const t of [r(1, '', true), r(28, '', false), r('', 'ultimo', true), r('', 'anteultimo', false)]) assert.ok(!G.parsearRegla(t).error, t);
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

test('filas agrupadas en ingresos → gastos → ahorro, con su grupo', () => {
  const cats = [{ nombre: 'Ahorro', clase: 'A', orden: 1 }, { nombre: 'Eventuales', clase: 'G', orden: 9 }, { nombre: 'Vivienda', clase: 'G', orden: 2 }, { nombre: 'Ingresos', clase: 'I', orden: 5 }];
  const con = [{ id: '1', nombre: 'Luz', categoria: 'Vivienda', clase: 'G', orden: 1 }, { id: '2', nombre: 'Salario', categoria: 'Ingresos', clase: 'I', orden: 1 }];
  const f = P.construirFilas(con, cats, { colapsadas: { Vivienda: true }, nuevos: [{ t: 'nuevacat' }] });
  assert.deepStrictEqual([...f.map((x) => x.t + ':' + (x.c ? x.c.nombre : x.cat ? x.cat.nombre : '') + ':' + x.grupo)],
    ['cat:Ingresos:I', 'item:Salario:I', 'cat:Vivienda:G', 'cat:Eventuales:G', 'cat:Ahorro:A', 'nuevacat::null']);
  assert.strictEqual(f[2].cerrada, true, 'plegada: la fila de categoría muestra la suma');
  assert.strictEqual(f[0].cerrada, false, 'desplegada: solo divisor');
});

test('línea de tiempo igual en cliente y servidor', () => {
  const idx = { a: { '2024-03': {} } };
  const cli = P.lineaDeTiempoP(idx, '2026-09-28', 12);
  const srv = G.lineaDeTiempo_(idx, '2026-09-28', 12);
  assert.strictEqual(cli.join(), srv.join());
  assert.strictEqual(cli[0], '2024-01');
  assert.strictEqual(cli[cli.length - 1], '2027-12');
});
