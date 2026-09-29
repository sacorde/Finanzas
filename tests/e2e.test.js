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
  for (const t of ['Conceptos', 'Valores', 'Categorias', 'Indices', 'Feriados', 'Config']) assert.ok(env.ss.getSheetByName(t), t);
});

test('categorías de un solo nivel, con color; conceptos con vencimiento y medio', () => {
  const d = G.api_datos();
  assert.deepStrictEqual(plano(d.categorias.map((c) => c.nombre)),
    ['Ingresos', 'Vivienda', 'Servicios', 'Suscripciones', 'Transporte', 'Supermercado', 'Préstamos', 'Ahorro e Inversión', 'Eventuales']);
  assert.strictEqual(new Set(d.categorias.map((c) => c.color)).size, 9, 'cada categoría con su color');
  assert.ok(d.categorias.every((c) => /^#[0-9A-F]{6}$/i.test(c.color)));
  assert.deepStrictEqual(plano(d.conceptos.filter((c) => c.categoria === 'Ingresos').map((c) => c.nombre)), ['Salario', 'Aguinaldo', 'Bonos', 'Otros']);
  assert.ok(valor(d, d.conceptos.find((c) => c.nombre === 'Otros').id, '2026-06'), '"Otros Ingresos" pasa a "Otros" con sus montos');
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Prestamo Banco').categoria, 'Préstamos');
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Netflix').categoria, 'Suscripciones');
  assert.ok(!('seccion' in d.conceptos[0]));
  const salario = d.conceptos.find((c) => c.nombre === 'Salario');
  assert.strictEqual(salario.clase, 'I');
  assert.strictEqual(salario.vence, 'anteúltimo hábil');
  const luz = d.conceptos.find((c) => c.nombre === 'Luz');
  assert.strictEqual(luz.categoria, 'Servicios');
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Netflix').medio, 'Débito automático');
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Ahorro del Mes').clase, 'A');
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Otros').proyeccion, 'No proyectar');
  assert.ok(d.venc[luz.id]['2026-10'], 'vencimiento calculado');
});

test('vencimientos de cada mes (el día cambia mes a mes)', () => {
  G.api_guardarConcepto({ id: concepto('Luz').id, vence: 'último día' });
  const d = G.api_datos();
  const v = d.venc[concepto('Luz').id];
  assert.strictEqual(v['2026-02'], '2026-02-28');
  assert.strictEqual(v['2026-04'], '2026-04-30');
  assert.strictEqual(v['2026-12'], '2026-12-31');
  assert.strictEqual(v['2027-02'], '2027-02-28');
  assert.ok(Object.keys(v).length >= 24, 'toda la línea de tiempo');
  const p = plano(G.api_probarVence('último día', '2027-02'));
  assert.deepStrictEqual(p.fechas, ['2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
  assert.ok(p.descripcion);
  assert.match(plano(G.api_probarVence('cuando pinte', '2026-09')).error, /No entendí/);
  assert.deepStrictEqual(plano(G.api_probarVence('', '2026-09')).fechas, []);
  G.api_guardarConcepto({ id: concepto('Luz').id, vence: '1er hábil' });
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

test('los gastos eventuales son filas de la categoría Eventuales', () => {
  const d = G.api_datos();
  const ev = d.conceptos.filter((c) => c.tipo === 'eventual').map((c) => [c.nombre, c.categoria]).sort();
  assert.deepStrictEqual(plano(ev), [['Heladera', 'Eventuales'], ['Vuelo a Bariloche', 'Eventuales']]);
  const vuelo = d.conceptos.find((c) => c.nombre === 'Vuelo a Bariloche');
  assert.deepStrictEqual(plano(valor(d, vuelo.id, '2026-07')).slice(2), [350000, '200000+150000', 0]);
  assert.ok(!('movimientos' in d));
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

test('crear, editar y borrar conceptos desde la grilla', () => {
  const r = plano(G.api_guardarConcepto({ nombre: 'Gas', categoria: 'Servicios' }));
  const gas = r.conceptos.find((c) => c.nombre === 'Gas');
  const luz = r.conceptos.find((c) => c.nombre === 'Luz');
  assert.ok(gas && gas.orden > luz.orden, 'se agrega al final de su categoría');
  // Campos sueltos, como al editar una celda
  const r1 = plano(G.api_guardarConcepto({ id: gas.id, vence: '10 hábil' }));
  assert.strictEqual(r1.conceptos.find((c) => c.id === gas.id).vence, '10 hábil');
  assert.ok(r1.venc[gas.id]);
  assert.strictEqual(r1.conceptos.find((c) => c.id === gas.id).categoria, 'Servicios', 'no pierde los otros campos');
  G.api_guardarConcepto({ id: gas.id, medio: 'Débito automático' });
  G.api_guardarConcepto({ id: gas.id, proyeccion: 'Promedio 3 meses' });
  assert.throws(() => G.api_guardarConcepto({ id: gas.id, vence: 'cuando pinte' }), /No entendí/);
  G.api_guardarCeldas([{ c: gas.id, mes: '2026-09', texto: '30000' }]);
  assert.strictEqual(valor(G.api_datos(), gas.id, '2026-10')[2], 30000);
  const r2 = plano(G.api_guardarConcepto({ id: gas.id, nombre: 'Gas natural' }));
  assert.ok(r2.conceptos.find((c) => c.id === gas.id && c.nombre === 'Gas natural' && c.medio === 'Débito automático' && c.proyeccion === 'Promedio 3 meses'));
  // Mover y reordenar
  const r3 = plano(G.api_moverConcepto(gas.id, -1));
  const serv = r3.conceptos.filter((c) => c.categoria === 'Servicios').map((c) => c.nombre);
  assert.deepStrictEqual(serv, ['Gas natural', 'Luz']);
  const r4 = plano(G.api_moverConceptoA(gas.id, 'Vivienda'));
  assert.strictEqual(r4.conceptos.find((c) => c.id === gas.id).categoria, 'Vivienda');
  assert.strictEqual(r4.conceptos.find((c) => c.id === gas.id).nombre, 'Gas natural');
  assert.throws(() => G.api_moverConceptoA(gas.id, 'Eventuales'), /eventuales/);
  assert.throws(() => G.api_moverConceptoA(gas.id, 'No existe'), /No existe la categoría/);
  assert.throws(() => G.api_guardarConcepto({ nombre: 'X', categoria: 'No existe' }), /No existe la categoría/);
  G.api_borrarConcepto(gas.id);
  const d = G.api_datos();
  assert.ok(!d.conceptos.find((c) => c.id === gas.id));
  assert.ok(!d.valores.some((v) => v[0] === gas.id));
});

test('categorías: crear, renombrar, color, ordenar y borrar', () => {
  let r = plano(G.api_guardarCategoria({ nombre: 'Salud' }));
  const salud = r.categorias.find((c) => c.nombre === 'Salud');
  assert.ok(salud && /^#/.test(salud.color));
  assert.deepStrictEqual([salud.clase, salud.tipo], ['G', 'fijo']);
  assert.ok(!r.categorias.some((c) => c !== salud && c.color === salud.color), 'color distinto a las demás');
  G.api_guardarConcepto({ nombre: 'Prepaga', categoria: 'Salud' });
  r = plano(G.api_guardarCategoria({ nombre: 'Salud y bienestar', anterior: 'Salud', color: '#123456' }));
  assert.ok(r.categorias.find((c) => c.nombre === 'Salud y bienestar' && c.color === '#123456'));
  assert.strictEqual(r.conceptos.find((c) => c.nombre === 'Prepaga').categoria, 'Salud y bienestar');
  assert.throws(() => G.api_guardarCategoria({ nombre: 'servicios' }), /Ya existe/);
  assert.throws(() => G.api_borrarCategoria('Salud y bienestar'), /tiene 1 fila/);
  // Cambiar cómo suma (ingreso / gasto / ahorro)
  r = plano(G.api_guardarCategoria({ nombre: 'Salud y bienestar', anterior: 'Salud y bienestar', clase: 'A' }));
  assert.strictEqual(r.conceptos.find((c) => c.nombre === 'Prepaga').clase, 'A');
  const orden0 = r.categorias.map((c) => c.nombre);
  r = plano(G.api_moverCategoria(orden0[orden0.length - 1], -1));
  const orden1 = r.categorias.map((c) => c.nombre);
  assert.strictEqual(orden1[orden1.length - 2], orden0[orden0.length - 1]);
  G.api_borrarConcepto(r.conceptos.find((c) => c.nombre === 'Prepaga').id);
  r = plano(G.api_borrarCategoria('Salud y bienestar'));
  assert.ok(!r.categorias.some((c) => c.nombre === 'Salud y bienestar'));
});

test('carga rápida de un gasto eventual en cuotas crea una fila', () => {
  const r = plano(G.api_crearEventual({ nombre: 'Notebook', texto: '900k', cuotas: 6, medio: 'Tarjeta VISA', mes: '2026-10' }));
  const nb = r.conceptos.find((c) => c.id === r.id);
  assert.deepStrictEqual([nb.nombre, nb.categoria, nb.tipo, nb.medio], ['Notebook', 'Eventuales', 'eventual', 'Tarjeta VISA']);
  assert.deepStrictEqual(r.valores[r.id].map((x) => [x[0], x[1]]), [['2026-10', 150000], ['2026-11', 150000], ['2026-12', 150000], ['2027-01', 150000], ['2027-02', 150000], ['2027-03', 150000]]);
  const r2 = plano(G.api_crearEventual({ nombre: 'Cena', texto: '25000', mes: '2026-09' }));
  assert.strictEqual(r2.categorias.length, r.categorias.length, 'no crea categorías');
  // Las celdas de eventuales se editan como cualquier otra y no se proyectan
  G.api_guardarCeldas([{ c: r2.id, mes: '2026-09', texto: '30000' }]);
  const d = G.api_datos();
  assert.strictEqual(valor(d, r2.id, '2026-09')[2], 30000);
  assert.ok(!valor(d, r2.id, '2026-10'));
  G.api_borrarConcepto(r2.id);
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
  assert.deepStrictEqual(env.ss.getSheets().map((s) => s.getName()), ['Conceptos', 'Valores', 'Categorias', 'Indices', 'Feriados', 'Config']);
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
  assert.ok(!sueldo, '"Sueldo" pasa a llamarse "Salario"');
  const salario = d.conceptos.find((c) => c.nombre === 'Salario');
  assert.strictEqual(salario.categoria, 'Ingresos');
  assert.strictEqual(internet.categoria, 'Servicios');
  assert.strictEqual(internet.vence, '10');
  assert.deepStrictEqual(valor(d, salario.id, '2026-09').slice(2), [120, '', 0]);
  assert.deepStrictEqual(valor(d, salario.id, '2026-11').slice(2), [120, '', 1]);
  assert.deepStrictEqual(valor(d, internet.id, '2026-09').slice(2), [55, '50+5', 0]);
  const silla = d.conceptos.find((c) => c.nombre === 'Silla');
  assert.strictEqual(silla.categoria, 'Eventuales');
  assert.deepStrictEqual(d.valores.filter((v) => v[0] === silla.id).map((v) => [v[1], v[2]]), [['2026-10', 100000], ['2026-11', 100000], ['2026-12', 100000]]);
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Algo').categoria, 'Eventuales');
  assert.ok(env2.ss.getSheetByName('Movimientos'), 'la hoja vieja de movimientos queda para limpiar');
  assert.ok(G2.api_hojasSobrantes().some((h) => h.nombre === 'Movimientos'));
});

/* ---------- Escenario 3: base de la versión 3 (tabla Movimientos) ---------- */
test('actualiza sola una base de la versión 3', () => {
  const G3 = cargar({ hoy: HOY });
  const env3 = crearEntorno(G3);
  const hoja = (nombre, filas) => { const sh = env3.ss.insertSheet(nombre); sh.getRange(1, 1, filas.length, filas[0].length).setValues(filas); };
  hoja('Conceptos', [['id', 'nombre', 'seccion', 'clase', 'categoria', 'tipo', 'vence', 'medio', 'proyeccion', 'orden'],
    ['a1', 'Luz', 'Gastos fijos', 'G', 'Servicios', 'fijo', '1er hábil', '', 'Repetir', 10],
    ['e1', 'Hogar', 'Eventuales', 'G', 'Hogar', 'eventual', '', '', '', 20], ['e2', 'Otros', 'Eventuales', 'G', 'Otros', 'eventual', '', '', '', 30]]);
  hoja('Valores', [['concepto', 'mes', 'monto', 'cuenta', 'estado'], ['a1', '2026-09', 100, '', 'confirmado']]);
  hoja('Movimientos', [['id', 'fecha', 'descripcion', 'categoria', 'monto', 'cuenta', 'cuotas', 'medio', 'mes', 'nota'],
    ['m1', '2026-09-20', 'Silla', 'Hogar', 300000, '', 3, 'Tarjeta VISA', '2026-10', ''], ['m2', '2026-09-21', 'Pizza', 'Otros', 12000, '', 1, '', '2026-09', '']]);
  const d = plano(G3.api_datos());
  assert.strictEqual(d.categorias.length, 9);
  assert.strictEqual(d.conceptos.find((c) => c.id === 'a1').categoria, 'Servicios');
  const silla = d.conceptos.find((c) => c.nombre === 'Silla');
  assert.deepStrictEqual([silla.tipo, silla.categoria, silla.medio], ['eventual', 'Eventuales', 'Tarjeta VISA']);
  assert.strictEqual(d.valores.filter((v) => v[0] === silla.id).length, 3);
  assert.ok(!d.conceptos.some((c) => c.id === 'e1'), 'las filas-categoría viejas desaparecen');
  assert.ok(env3.ss.getSheetByName('Movimientos (versión anterior)'));
  assert.strictEqual(plano(G3.api_datos()).conceptos.length, d.conceptos.length, 'no se repite');
});

/* ---------- Escenario 4: base de la versión 4 (secciones + subcategorías) ---------- */
test('actualiza sola una base de la versión 4 a categorías de un solo nivel', () => {
  const G4 = cargar({ hoy: HOY });
  const env4 = crearEntorno(G4);
  const hoja = (nombre, filas) => { const sh = env4.ss.insertSheet(nombre); sh.getRange(1, 1, filas.length, filas[0].length).setValues(filas); };
  hoja('Conceptos', [['id', 'nombre', 'seccion', 'clase', 'categoria', 'tipo', 'vence', 'medio', 'proyeccion', 'orden'],
    ['i1', 'Salario', 'Ingresos', 'I', 'Ingresos', 'fijo', 'anteúltimo hábil', '', 'Repetir', 10],
    ['i2', 'Otros Ingresos', 'Ingresos', 'I', 'Ingresos', 'fijo', '', '', 'No proyectar', 20],
    ['g1', 'Seguro', 'Gastos fijos', 'G', 'Auto', 'fijo', '', '', 'Repetir', 30],
    ['g2', 'Crossfit', 'Gastos fijos', 'G', 'Vivienda', 'fijo', '', '', 'Repetir', 40],
    ['g3', 'Luz', 'Gastos fijos', 'G', 'Servicios', 'fijo', '1er hábil', 'Débito automático', 'Repetir', 50],
    ['p1', 'Prestamo Galicia', 'Préstamos y deudas', 'G', 'Préstamos y deudas', 'fijo', '', '', 'Repetir', 60],
    ['a1', 'Ahorro del Mes', 'Ahorro e inversión', 'A', 'Ahorro e inversión', 'fijo', '', '', 'Repetir', 70],
    ['e1', 'Heladera', 'Eventuales', 'G', 'Hogar', 'eventual', '', 'Tarjeta VISA', 'No proyectar', 80]]);
  hoja('Categorias', [['seccion', 'nombre', 'color', 'orden'], ['Gastos fijos', 'Auto', '#111111', 10], ['Eventuales', 'Hogar', '#222222', 20]]);
  hoja('Valores', [['concepto', 'mes', 'monto', 'cuenta', 'estado'], ['i2', '2026-06', 500, '', 'confirmado'], ['e1', '2026-03', 900000, '', 'confirmado'], ['g1', '2026-09', 100, '', 'confirmado']]);
  assert.strictEqual(G4.api_estado().instalado, true, 'la base vieja cuenta como instalada');
  const d = plano(G4.api_datos());
  const cat = (id) => d.conceptos.find((c) => c.id === id).categoria;
  assert.deepStrictEqual(['g1', 'g2', 'g3', 'p1', 'a1', 'e1'].map(cat), ['Transporte', 'Vivienda', 'Servicios', 'Préstamos', 'Ahorro e Inversión', 'Eventuales']);
  assert.deepStrictEqual(d.conceptos.filter((c) => c.categoria === 'Ingresos').map((c) => c.nombre), ['Salario', 'Aguinaldo', 'Bonos', 'Otros']);
  assert.strictEqual(d.conceptos.find((c) => c.nombre === 'Otros').id, 'i2', 'renombra sin perder los montos');
  assert.ok(valor(d, 'i2', '2026-06'));
  assert.ok(valor(d, 'e1', '2026-03'));
  assert.ok(valor(d, 'g1', '2026-10'), 'sigue proyectando');
  assert.deepStrictEqual(d.categorias.map((c) => c.nombre).length, 9);
  assert.deepStrictEqual(env4.ss.getSheetByName('Conceptos').getRange(1, 1, 1, 9).getValues()[0], ['id', 'nombre', 'categoria', 'clase', 'tipo', 'vence', 'medio', 'proyeccion', 'orden']);
  assert.deepStrictEqual(env4.ss.getSheetByName('Categorias').getRange(1, 1, 1, 5).getValues()[0], ['nombre', 'clase', 'tipo', 'color', 'orden']);
  assert.strictEqual(env4.ss.getSheetByName('Conceptos').getLastColumn(), 9);
  assert.deepStrictEqual(plano(G4.api_hojasSobrantes()), [], 'las tablas actualizadas no se ofrecen para borrar');
  assert.strictEqual(plano(G4.api_datos()).conceptos.length, d.conceptos.length, 'no se repite');
});
