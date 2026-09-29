// Pruebas de punta a punta con un simulador de Google Sheets:
// instalación desde el Excel original y desde la versión 2, uso de la API y limpieza de hojas.
const test = require('node:test');
const assert = require('node:assert');
const { cargar } = require('./harness');
const { crearEntorno } = require('./mock-sheets');

const HOY = new Date(2026, 8, 28, 10, 0); // 28/09/2026
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const ANTEULTIMO = '=WORKDAY(EOMONTH(TODAY(),0)+1,-2)';
const PRIMER_HABIL = '=WORKDAY(IF(DAY(TODAY())<=1, DATE(YEAR(TODAY()), MONTH(TODAY()), 1), DATE(YEAR(TODAY()), MONTH(TODAY())+1, 1))-1, 1)';
const doce = (f) => Array.from({ length: 12 }, (_, i) => f(i));
const plano = (x) => JSON.parse(JSON.stringify(x));

function planillaVieja(env) {
  const sh = env.ss.insertSheet('Finanzas');
  sh.insertColumnsAfter(26, 10);
  const vacio = () => Array(28).fill('');
  const f1 = vacio(); f1[0] = 'FINANZAS'; MESES.forEach((m, i) => { f1[2 + i] = m; f1[15 + i] = m; }); f1[14] = 2026; f1[27] = 2027;
  const f2 = vacio(); f2[14] = 'TOTAL AÑO'; f2[27] = 'TOTAL AÑO';
  const fila = (a, b, v26, v27) => { const f = vacio(); f[0] = a; f[1] = b; doce((i) => { f[2 + i] = v26 ? v26(i) : ''; f[15 + i] = v27 ? v27(i) : ''; }); return f; };
  const filas = [f1, f2,
    fila('INGRESOS', ''), fila('', ''),
    fila(ANTEULTIMO, 'Salario', (i) => 1000000 + i * 50000, (i) => (i < 3 ? 1550000 : '')),
    fila('Otros Ingresos', '', (i) => (i === 5 ? 500000 : '')), fila('', ''), fila('Total Ingresos', '', () => '=SUM(C5:C6)'),
    fila('GASTOS FIJOS', ''), fila('Suscripciones', ''), fila('DA', 'Netflix', (i) => (i < 4 ? 12000 : '')),
    fila('Servicios', ''), fila(PRIMER_HABIL, 'Luz', (i) => (i === 3 ? '=100+50' : i <= 8 ? 100 + i : '')),
    fila('PRESTAMOS/INVERSIONES', ''), fila(PRIMER_HABIL, 'Ahorro del Mes', (i) => (i <= 8 ? '=C5*20%' : '')), fila('', 'Prestamo Banco', () => 50000),
    fila('EVENTUALES', ''), fila('', 'Heladera', (i) => (i === 2 ? 900000 : '')), fila('', 'Vuelo a Bariloche', (i) => (i === 6 ? '=200000+150000' : '')),
    fila('Total Eventuales', '')];
  sh.getRange(1, 1, filas.length, 28).setValues(filas);
  env.ss.insertSheet('Reservas').getRange(1, 1).setValue('TENENCIA');
  env.ss.insertSheet('Pagos').getRange(1, 1).setValue('x');
}

function instalar(G) {
  const res = {};
  for (const paso of ['respaldo', 'migrar', 'indices', 'automatizaciones', 'calendario']) res[paso] = plano(G.api_instalar(paso));
  return res;
}

/* ---------- Escenario 1: Excel original ---------- */
const G = cargar({ hoy: HOY });
const env = crearEntorno(G);
planillaVieja(env);
const estadoAntes = plano(G.api_estado());
const pasos = instalar(G);
const concepto = (n) => G.api_datos().conceptos.find((c) => c.nombre === n);
const valor = (d, cid, mes) => d.valores.find((v) => v[0] === cid && v[1] === mes);

test('detecta el Excel original y lo instala', () => {
  assert.strictEqual(estadoAntes.instalado, false);
  assert.strictEqual(estadoAntes.fuente.tipo, 'legado');
  for (const p of Object.keys(pasos)) assert.ok(pasos[p].ok !== false || p === 'calendario', p + ': ' + pasos[p].detalle);
  assert.strictEqual(env.ss._copias.length, 1, 'hace una copia de respaldo');
  assert.strictEqual(G.api_estado().instalado, true);
  for (const t of ['Conceptos', 'Valores', 'Movimientos', 'Indices', 'Feriados', 'Config']) assert.ok(env.ss.getSheetByName(t), t);
});

test('conceptos con sección, categoría, vencimiento y medio', () => {
  const d = G.api_datos();
  const salario = d.conceptos.find((c) => c.nombre === 'Salario');
  assert.strictEqual(salario.seccion, 'Ingresos');
  assert.strictEqual(salario.vence, 'anteúltimo hábil');
  const luz = d.conceptos.find((c) => c.nombre === 'Luz');
  assert.strictEqual(luz.categoria, 'Servicios');
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Netflix').medio, 'Débito automático');
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Ahorro del Mes').clase, 'A');
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Otros Ingresos').proyeccion, 'No proyectar');
  assert.ok(d.conceptos.some((c) => c.tipo === 'eventual' && c.nombre === 'Viajes'));
  assert.ok(d.venc[luz.id]['2026-10'], 'vencimiento calculado');
});

test('valores: cuentas conservadas, proyección estimada dentro del horizonte', () => {
  const d = G.api_datos();
  const luz = concepto('Luz');
  assert.deepStrictEqual(plano(valor(d, luz.id, '2026-04')), [luz.id, '2026-04', 150, '100+50', 0]);
  assert.deepStrictEqual(plano(valor(d, luz.id, '2026-09')), [luz.id, '2026-09', 108, '', 0]);
  assert.deepStrictEqual(plano(valor(d, luz.id, '2026-12')), [luz.id, '2026-12', 108, '', 1]);
  assert.ok(valor(d, luz.id, '2027-09'));
  assert.ok(!valor(d, luz.id, '2027-10'), 'no pasa el horizonte');
  assert.ok(!valor(d, concepto('Netflix').id, '2026-10'), 'concepto dado de baja no se proyecta');
});

test('eventuales pasan a Movimientos con categoría', () => {
  const d = G.api_datos();
  const m = d.movimientos.map((x) => [x.descripcion, x.categoria, x.monto, x.cuenta, x.mes]);
  assert.deepStrictEqual(plano(m), [['Heladera', 'Hogar', 900000, '', '2026-03'], ['Vuelo a Bariloche', 'Viajes', 350000, '200000+150000', '2026-07']]);
});

test('editar una celda confirma y arrastra el precio a los meses siguientes', () => {
  const luz = concepto('Luz');
  const r = plano(G.api_guardarCeldas([{ c: luz.id, mes: '2026-10', texto: '=150+50' }]));
  const porMes = Object.fromEntries(r.valores[luz.id].map((x) => [x[0], x]));
  assert.deepStrictEqual(porMes['2026-10'], ['2026-10', 200, '150+50', 0]);
  assert.deepStrictEqual(porMes['2026-11'], ['2026-11', 200, '150+50', 1]);
  // Confirmar un estimado sin cambiar el valor
  G.api_guardarCeldas([{ c: luz.id, mes: '2026-11', estado: 'confirmado' }]);
  assert.strictEqual(valor(G.api_datos(), luz.id, '2026-11')[4], 0);
  // Borrar un mes futuro lo devuelve al estimado automático (desde septiembre)
  G.api_guardarCeldas([{ c: luz.id, mes: '2026-11', texto: '' }, { c: luz.id, mes: '2026-10', texto: '' }]);
  const d = G.api_datos();
  assert.deepStrictEqual(plano(valor(d, luz.id, '2026-10')).slice(2), [108, '', 1]);
  // Un 0 da de baja hacia adelante
  G.api_guardarCeldas([{ c: luz.id, mes: '2026-10', texto: '0' }]);
  assert.deepStrictEqual(plano(valor(G.api_datos(), luz.id, '2026-12')).slice(2), [0, '', 1]);
  G.api_guardarCeldas([{ c: luz.id, mes: '2026-10', texto: '' }]);
  assert.throws(() => G.api_guardarCeldas([{ c: luz.id, mes: '2026-10', texto: 'hola' }]), /No entendí/);
});

test('crear, editar y borrar conceptos', () => {
  const r = plano(G.api_guardarConcepto({ nombre: 'Gas', seccion: 'Gastos fijos', categoria: 'Servicios', vence: '10 hábil', medio: 'Débito automático', proyeccion: 'Promedio 3 meses' }));
  const gas = r.conceptos.find((c) => c.nombre === 'Gas');
  const luz = r.conceptos.find((c) => c.nombre === 'Luz');
  assert.ok(gas && gas.orden > luz.orden, 'se agrega al final de su categoría');
  assert.ok(r.venc[gas.id]);
  assert.throws(() => G.api_guardarConcepto({ nombre: 'X', seccion: 'Gastos fijos', vence: 'cuando pinte' }), /No entendí/);
  G.api_guardarCeldas([{ c: gas.id, mes: '2026-09', texto: '30000' }]);
  assert.strictEqual(valor(G.api_datos(), gas.id, '2026-10')[2], 30000);
  const r2 = plano(G.api_guardarConcepto(Object.assign({}, gas, { nombre: 'Gas natural' })));
  assert.ok(r2.conceptos.find((c) => c.id === gas.id && c.nombre === 'Gas natural'));
  G.api_borrarConcepto(gas.id);
  const d = G.api_datos();
  assert.ok(!d.conceptos.find((c) => c.id === gas.id));
  assert.ok(!d.valores.some((v) => v[0] === gas.id));
});

test('renombrar una categoría de eventuales mueve sus gastos', () => {
  const viajes = concepto('Viajes');
  G.api_guardarConcepto(Object.assign({}, viajes, { nombre: 'Viajes y escapadas' }));
  assert.ok(G.api_datos().movimientos.some((m) => m.categoria === 'Viajes y escapadas'));
});

test('movimientos: cuotas, tarjeta al mes siguiente, editar y borrar', () => {
  const r = plano(G.api_guardarMovimiento({ descripcion: 'Notebook', texto: '900k', categoria: 'Tecnología', cuotas: 6, medio: 'Tarjeta VISA', fecha: '2026-09-20' }));
  assert.strictEqual(r.movimiento.monto, 900000);
  assert.strictEqual(r.movimiento.mes, '2026-10');
  const r2 = plano(G.api_guardarMovimiento({ descripcion: 'Cena', texto: '25000', categoria: 'no existe', fecha: '2026-09-21', medio: 'Efectivo' }));
  assert.strictEqual(r2.movimiento.categoria, 'Otros');
  assert.strictEqual(r2.movimiento.mes, '2026-09');
  G.api_guardarMovimiento(Object.assign({}, r2.movimiento, { texto: '30000' }));
  assert.strictEqual(G.api_datos().movimientos.find((m) => m.id === r2.movimiento.id).monto, 30000);
  G.api_borrarMovimiento(r2.movimiento.id);
  assert.ok(!G.api_datos().movimientos.find((m) => m.id === r2.movimiento.id));
});

test('tarea diaria: calendario idempotente', () => {
  G.tareaDiaria();
  const n = env.eventos.filter((e) => !e._borrado).length;
  assert.ok(n > 0);
  assert.ok(env.eventos.some((e) => /Luz/.test(e._t)));
  G.tareaDiaria();
  assert.strictEqual(env.eventos.filter((e) => !e._borrado).length, n);
});

test('configuración y feriados', () => {
  const d = plano(G.api_guardarConfig({ horizonte: '6', calendario: 'Finanzas' }));
  assert.strictEqual(d.cfg.horizonte, 6);
  const luz = d.conceptos.find((c) => c.nombre === 'Luz');
  assert.ok(!valor(d, luz.id, '2027-06'), 'el horizonte más corto recorta la proyección');
  const f = plano(G.api_guardarFeriados([{ fecha: '2026-10-12', nombre: 'Diversidad cultural' }]));
  assert.strictEqual(f.feriados.length, 1);
});

test('limpieza: detecta y borra las hojas que sobran (nunca las tablas)', () => {
  const sobrantes = plano(G.api_hojasSobrantes()).map((h) => h.nombre).sort();
  assert.deepStrictEqual(sobrantes, ['Finanzas', 'Pagos', 'Reservas']);
  const r = plano(G.api_borrarHojas(sobrantes.concat(['Conceptos'])));
  assert.deepStrictEqual(r.borradas.sort(), sobrantes);
  assert.deepStrictEqual(env.ss.getSheets().map((s) => s.getName()), ['Conceptos', 'Valores', 'Movimientos', 'Indices', 'Feriados', 'Config']);
  assert.ok(r.respaldo);
});

/* ---------- Escenario 2: planilla versión 2 ---------- */
test('migra la grilla de la versión 2 conservando estimados y movimientos', () => {
  const G2 = cargar({ hoy: HOY });
  const env2 = crearEntorno(G2);
  const D = G2.Date;
  const sh = env2.ss.insertSheet('Finanzas');
  sh.insertColumnsAfter(26, 10);
  const meses = Array.from({ length: 12 }, (_, i) => new D(2026, i, 1));
  const n = 6 + 12 + 1;
  const fila = (a, b, c, e, f, vals) => { const r = Array(n).fill(''); r[0] = a; r[1] = b; r[2] = c || ''; r[4] = e || ''; r[5] = f || ''; (vals || []).forEach((v, i) => { r[6 + i] = v; }); return r; };
  const cab1 = Array(n).fill(''), cab2 = Array(n).fill('');
  meses.forEach((d, i) => { cab2[6 + i] = d; }); cab2[18] = 'Total 2026';
  const filas = [cab1, cab2,
    fila('RES:I', 'Ingresos'), fila('RES:G', 'Gastos'), fila('RES:A', 'Ahorro'), fila('RES:L', 'Libre'), fila('', ''),
    fila('SEC:I', 'INGRESOS'), fila('', 'Sueldo', 'anteúltimo hábil', 'Transferencia', 'Repetir', [100, 100, 100, 100, 100, 100, 100, 100, 120, 120, 120, 120]),
    fila('SEC:G', 'GASTOS FIJOS'), fila('CAT', 'Servicios'), fila('', 'Internet', '10', 'Débito automático', 'Repetir', ['', '', '', '', '', '', '', 50, 55, 55, 55, 55]),
    fila('SEC:G:MOV', 'EVENTUALES'), fila('', 'Hogar'), fila('', 'Otros')];
  sh.getRange(1, 1, filas.length, n).setValues(filas);
  sh.getRange(9, 6 + 10, 1, 4).setFontStyles([['italic', 'italic', 'italic', 'italic']]);
  sh.getRange(12, 6 + 10, 1, 3).setFontStyles([['italic', 'italic', 'italic']]);
  sh.getRange(12, 6 + 9).setFormula('=50+5');
  const mov = env2.ss.insertSheet('Movimientos');
  mov.getRange(1, 1, 3, 8).setValues([
    ['Fecha', 'Descripción', 'Categoría', 'Monto', 'Cuotas', 'Medio de pago', 'Mes (opcional)', 'Desde (auto)'],
    [new D(2026, 8, 20), 'Silla', 'Hogar', 300000, 3, 'Tarjeta VISA', '', new D(2026, 9, 1)],
    [new D(2026, 8, 21), 'Algo', 'Categoria vieja', 1000, 1, '', '', new D(2026, 8, 1)]]);
  assert.strictEqual(G2.api_estado().fuente.tipo, 'v2');
  const r = plano(G2.api_instalar('migrar'));
  assert.ok(r.ok, r.detalle);
  const d = plano(G2.api_datos());
  const sueldo = d.conceptos.find((c) => c.nombre === 'Sueldo');
  const internet = d.conceptos.find((c) => c.nombre === 'Internet');
  assert.strictEqual(sueldo.seccion, 'Ingresos');
  assert.strictEqual(internet.categoria, 'Servicios');
  assert.strictEqual(internet.vence, '10');
  assert.deepStrictEqual(valor(d, sueldo.id, '2026-09').slice(2), [120, '', 0]);
  assert.deepStrictEqual(valor(d, sueldo.id, '2026-11').slice(2), [120, '', 1]);
  assert.deepStrictEqual(valor(d, internet.id, '2026-09').slice(2), [55, '50+5', 0]);
  assert.deepStrictEqual(d.movimientos.map((m) => [m.descripcion, m.categoria, m.mes, m.cuotas]), [['Silla', 'Hogar', '2026-10', 3], ['Algo', 'Otros', '2026-09', 1]]);
  assert.ok(env2.ss.getSheetByName('Movimientos (anterior)'), 'la hoja vieja de movimientos queda para limpiar');
});
