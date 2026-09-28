// Prueba de punta a punta: instala sobre una planilla vieja simulada y usa el sistema.
const test = require('node:test');
const assert = require('node:assert');
const { cargar } = require('./harness');
const { crearEntorno } = require('./mock-sheets');

const G = cargar({ hoy: new Date(2026, 8, 28, 10, 0) }); // 28/09/2026
const env = crearEntorno(G);
const D = G.Date;

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const ANTEULTIMO = '=WORKDAY(EOMONTH(TODAY(),0)+1,-2)';
const PRIMER_HABIL = '=WORKDAY(IF(DAY(TODAY())<=1, DATE(YEAR(TODAY()), MONTH(TODAY()), 1), DATE(YEAR(TODAY()), MONTH(TODAY())+1, 1))-1, 1)';
const doce = (f) => Array.from({ length: 12 }, (_, i) => f(i));

function planillaVieja() {
  const sh = env.ss.insertSheet('Finanzas');
  sh.insertColumnsAfter(26, 10);
  const vacio = () => Array(28).fill('');
  const filas = [];
  const f1 = vacio(); f1[0] = 'FINANZAS'; MESES.forEach((m, i) => { f1[2 + i] = m; f1[15 + i] = m; }); f1[14] = 2026; f1[27] = 2027;
  filas.push(f1);
  const f2 = vacio(); f2[14] = 'TOTAL AÑO'; f2[27] = 'TOTAL AÑO'; filas.push(f2);
  const fila = (a, b, v26, v27) => { const f = vacio(); f[0] = a; f[1] = b; doce((i) => { f[2 + i] = v26 ? v26(i) : ''; f[15 + i] = v27 ? v27(i) : ''; }); return f; };
  filas.push(fila('INGRESOS', ''));
  filas.push(fila('', ''));
  filas.push(fila(ANTEULTIMO, 'Salario', (i) => 1000000 + i * 50000, (i) => (i < 3 ? 1550000 : '')));
  filas.push(fila('Otros Ingresos', '', (i) => (i === 5 ? 500000 : '')));
  filas.push(fila('', ''));
  filas.push(fila('Total Ingresos', '', (i) => '=SUM(C5:C6)'));
  filas.push(fila('GASTOS FIJOS', ''));
  filas.push(fila('Suscripciones', ''));
  filas.push(fila('DA', 'Netflix', (i) => (i < 4 ? 12000 : '')));
  filas.push(fila('Servicios', ''));
  filas.push(fila(PRIMER_HABIL, 'Luz', (i) => (i === 3 ? '=100+50' : i <= 8 ? 100 + i : ''), () => ''));
  filas.push(fila('PRESTAMOS/INVERSIONES', ''));
  filas.push(fila(PRIMER_HABIL, 'Ahorro del Mes', (i) => (i <= 8 ? '=C5*20%' : '')));
  filas.push(fila('', 'Prestamo Banco', (i) => (i < 12 ? 50000 : '')));
  filas.push(fila('EVENTUALES', ''));
  filas.push(fila('', 'Heladera', (i) => (i === 2 ? 900000 : '')));
  filas.push(fila('', 'Vuelo a Bariloche', (i) => (i === 6 ? '=200000+150000' : '')));
  filas.push(fila('Total Eventuales', ''));
  sh.getRange(1, 1, filas.length, 28).setValues(filas);
  return sh;
}

planillaVieja();
const res = G.instalarSistema_(true);
const sh = env.ss.getSheetByName('Finanzas');
const est = () => G.leerEstructura(sh);
const E = est();
const item = (n) => est().items.find((i) => i.nombre === n);
const col = (y, m) => E.meses.find((x) => x.iso === `${y}-${String(m).padStart(2, '0')}`).col;
const celda = (n, y, m) => sh.getRange(item(n).fila, col(y, m));

test('instala hojas y conserva la original', () => {
  const nombres = env.ss.getSheets().map((s) => s.getName());
  for (const n of ['Finanzas', 'Movimientos', 'Config', 'Índices', 'Finanzas (original)']) assert.ok(nombres.includes(n), n);
  assert.strictEqual(res.origen, 'importado');
  assert.strictEqual(sh.getRange(3, 1).getValue(), 'RES:I');
});

test('línea de tiempo con meses y totales anuales', () => {
  assert.strictEqual(E.meses[0].iso, '2026-01');
  assert.strictEqual(E.meses.length, 24);
  assert.strictEqual(E.totales.map((t) => t.anio).join(), '2026,2027');
  assert.strictEqual(E.totales[0].col, E.meses[11].col + 1);
});

test('estructura: secciones, categorías, reglas y medios', () => {
  assert.strictEqual(E.secciones.map((s) => s.nombre.toUpperCase()).join(), 'INGRESOS,GASTOS FIJOS,PRÉSTAMOS Y DEUDAS,AHORRO E INVERSIÓN,EVENTUALES');
  assert.strictEqual(E.categorias.map((c) => c.nombre).join(), 'Suscripciones,Servicios');
  assert.strictEqual(item('Salario').vence, 'anteúltimo hábil');
  assert.strictEqual(item('Luz').vence, '1er hábil');
  assert.strictEqual(item('Netflix').medio, 'Débito automático');
  assert.strictEqual(item('Ahorro del Mes').clase, 'A');
  assert.strictEqual(item('Prestamo Banco').seccion.toUpperCase(), 'PRÉSTAMOS Y DEUDAS');
});

test('cuentas escritas a mano se conservan como fórmula', () => {
  assert.strictEqual(celda('Luz', 2026, 4).getFormula(), '=100+50');
});

test('proyección: Luz repite septiembre hacia adelante en gris itálica, dentro del horizonte', () => {
  assert.strictEqual(celda('Luz', 2026, 9).getValue(), 108);
  assert.strictEqual(celda('Luz', 2026, 9).getFontStyle(), 'normal');
  for (const [y, m] of [[2026, 10], [2026, 12], [2027, 9]]) {
    assert.strictEqual(celda('Luz', y, m).getValue(), 108, `${y}-${m}`);
    assert.strictEqual(celda('Luz', y, m).getFontStyle(), 'italic');
  }
  assert.strictEqual(celda('Luz', 2027, 10).getValue(), '');
  // Netflix se dio de baja en mayo: no se proyecta
  assert.strictEqual(celda('Netflix', 2026, 10).getValue(), '');
});

test('subtotales, resumen y totales anuales son fórmulas', () => {
  const s = E.secciones[1];
  assert.match(sh.getRange(s.fila, col(2026, 9)).getFormulasR1C1()[0][0], /^=SUM\(R\d+C,R\d+C\)$/);
  assert.match(sh.getRange(E.resumen.L, col(2026, 9)).getFormulasR1C1()[0][0], /^=R\d+C-R\d+C-R\d+C$/);
  assert.match(sh.getRange(item('Luz').fila, E.totales[0].col).getFormula(), /^=SUM\(\$G\d+:\$R\d+\)$/);
});

test('eventuales: van a Movimientos y la fila suma por categoría', () => {
  const mov = env.ss.getSheetByName('Movimientos');
  const filas = mov.getRange(2, 1, 2, 7).getValues();
  assert.deepStrictEqual(filas.map((r) => [r[1], r[2]]), [['Heladera', 'Hogar'], ['Vuelo a Bariloche', 'Viajes']]);
  assert.strictEqual(mov.getRange(3, 4).getFormula(), '=200000+150000');
  assert.match(sh.getRange(item('Hogar').fila, col(2026, 3)).getFormulasR1C1()[0][0], /^=SUMIFS\(Movimientos!C10/);
});

test('arrastre: al cargar un aumento, los meses siguientes se actualizan', () => {
  const c = celda('Luz', 2026, 10);
  c.setValue(200);
  G.onEdit({ range: c, source: env.ss, value: 200 });
  assert.strictEqual(celda('Luz', 2026, 10).getFontStyle(), 'normal');
  assert.strictEqual(celda('Luz', 2026, 11).getValue(), 200);
  assert.strictEqual(celda('Luz', 2026, 11).getFontStyle(), 'italic');
  assert.strictEqual(celda('Luz', 2027, 9).getValue(), 200);
});

test('regla de vencimiento escrita a mano: calcula el próximo y avisa', () => {
  const cfg = env.ss.getSheetByName('Config');
  cfg.getRange(G.CFG_FILA_FERIADOS + 2, 1, 1, 3).setValues([[new D(2026, 9, 12), 'Diversidad cultural', 'manual']]);
  G.FERIADOS_CACHE_ = null;
  const c = sh.getRange(item('Netflix').fila, 3);
  c.setValue('10 hábil');
  G.onEdit({ range: c, source: env.ss });
  const prox = sh.getRange(item('Netflix').fila, 4).getValue();
  assert.ok(prox instanceof D);
  assert.strictEqual(G.isoDia_(prox), '2026-10-13'); // 10/10 es sábado y el lunes 12 es feriado
});

test('panel: carga fija, eventual y deshacer', () => {
  const r1 = G.panelGuardar({ tipo: 'fijo', fila: item('Luz').fila, mes: '2026-11', texto: '210' });
  assert.ok(r1.ok, r1.mensaje);
  assert.strictEqual(celda('Luz', 2026, 12).getValue(), 210);
  G.panelDeshacer();
  assert.strictEqual(celda('Luz', 2026, 11).getValue(), 200);
  assert.strictEqual(celda('Luz', 2026, 11).getFontStyle(), 'italic');
  assert.strictEqual(celda('Luz', 2026, 12).getValue(), 200);

  const r2 = G.panelGuardar({ tipo: 'mov', texto: '900k', desc: 'Notebook', categoria: 'Tecnología', cuotas: 6, medio: 'Tarjeta VISA', fecha: '2026-09-20' });
  assert.ok(r2.ok);
  const mov = env.ss.getSheetByName('Movimientos');
  assert.deepStrictEqual(mov.getRange(4, 2, 1, 5).getValues()[0], ['Notebook', 'Tecnología', 900000, 6, 'Tarjeta VISA']);
});

test('panelDatos y dashboardDatos devuelven el mes actual', () => {
  const p = G.panelDatos();
  assert.strictEqual(p.mes, '2026-09');
  assert.ok(p.items.find((i) => i.nombre === 'Luz'));
  assert.ok(p.categorias.includes('Viajes'));
  const d = G.dashboardDatos();
  assert.strictEqual(d.meses.length, 24);
  assert.strictEqual(d.mesActual, '2026-09');
  const luz = d.items.find((i) => i.nombre === 'Luz');
  assert.strictEqual(luz.e[d.meses.indexOf('2026-12')], 1);
});

test('tarea diaria: cierra el mes, confirma débitos y sincroniza el calendario', () => {
  G.tareaDiaria();
  const titulos = env.eventos.filter((e) => !e._borrado).map((e) => e._t).sort();
  assert.ok(titulos.some((t) => /Luz · \$ 108/.test(t)), titulos.join(' | '));
  assert.ok(titulos.some((t) => /💰 Salario/.test(t)));
  // Segunda corrida: idempotente
  const n = env.eventos.length;
  G.tareaDiaria();
  assert.strictEqual(env.eventos.length, n);
});

test('insertar una fila nueva en una categoría: toma fórmulas y validaciones', () => {
  const luz = item('Luz').fila;
  sh.insertRowBefore(luz + 1);
  G.alCambiar({ changeType: 'INSERT_ROW' });
  const c = sh.getRange(luz + 1, 2);
  c.setValue('Gas');
  G.onEdit({ range: c, source: env.ss });
  assert.strictEqual(sh.getRange(luz + 1, 6).getValue(), 'Repetir');
  const cat = est().categorias.find((x) => x.nombre === 'Servicios');
  const m = /^=SUM\(R(\d+)C:R(\d+)C\)$/.exec(sh.getRange(cat.fila, col(2026, 9)).getFormulasR1C1()[0][0]);
  assert.ok(m && Number(m[1]) === cat.fila + 1 && Number(m[2]) >= luz + 1);
});
