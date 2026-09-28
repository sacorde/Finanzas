// Datos de ejemplo (ficticios) para previsualizar el panel y el dashboard sin Apps Script.
function generar(hoyIso = '2026-09-28') {
  const hoy = new Date(hoyIso + 'T12:00:00');
  const meses = [];
  for (let y = 2024; y <= 2027; y++) for (let m = 0; m < 12; m++) meses.push(`${y}-${String(m + 1).padStart(2, '0')}`);
  const iAct = meses.indexOf(hoyIso.slice(0, 7));
  // Inflación mensual aproximada 2024-2026
  const inflacion = {};
  const inf24 = [20.6, 13.2, 11, 8.8, 4.2, 4.6, 4, 4.2, 3.5, 2.7, 2.4, 2.7];
  const inf25 = [2.2, 2.4, 3.7, 2.8, 1.5, 1.6, 1.9, 1.9, 2.1, 2.3, 2.5, 2.8];
  const inf26 = [2.6, 2.4, 2.9, 2.7, 2.3, 2.1, 2.0, 1.9];
  [...inf24, ...inf25, ...inf26].forEach((v, i) => { inflacion[meses[i]] = v; });
  const blue = {}; let b = 1100;
  meses.slice(0, iAct + 1).forEach((m, i) => { b *= i < 12 ? 1.015 : 1.012; blue[m] = Math.round(b); });
  const oficial = {}; Object.keys(blue).forEach((m) => { oficial[m] = Math.round(blue[m] * 0.9); });

  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const serie = (base, crecimiento, cadaN = 1, ruido = 0, desde = 0, hasta = 999) => {
    let v = base; return meses.map((m, i) => {
      if (i < desde || i > hasta) return null;
      if (i > 0 && i % cadaN === 0) v *= 1 + crecimiento;
      const r = Math.round(v * (1 + (rnd() - .5) * ruido));
      return i > iAct + 12 ? null : r;
    });
  };
  const item = (nombre, seccion, categoria, clase, v, extra = {}) => ({ nombre, seccion, categoria, clase, mov: false, medio: '', v, e: v.map((x, i) => (x !== null && i > iAct ? 1 : 0)), ...extra });
  const items = [
    item('Salario', 'Ingresos', 'Ingresos', 'I', serie(900000, 0.08, 2, 0, 0)),
    item('Otros ingresos', 'Ingresos', 'Ingresos', 'I', meses.map((m, i) => (/-(06|12)$/.test(m) && i <= iAct + 3 ? 450000 * (1 + i * 0.05) : null))),
    item('Alquiler', 'Gastos fijos', 'Vivienda', 'G', serie(250000, 0.25, 6)),
    item('Expensas', 'Gastos fijos', 'Vivienda', 'G', serie(110000, 0.035, 1, 0.02)),
    item('Luz', 'Gastos fijos', 'Servicios', 'G', serie(30000, 0.06, 1, 0.25)),
    item('Gas', 'Gastos fijos', 'Servicios', 'G', serie(12000, 0.07, 1, 0.3)),
    item('Internet', 'Gastos fijos', 'Servicios', 'G', serie(18000, 0.045, 1)),
    item('Celular', 'Gastos fijos', 'Servicios', 'G', serie(9000, 0.04, 1)),
    item('Netflix', 'Gastos fijos', 'Suscripciones', 'G', serie(5000, 0.06, 2)),
    item('Spotify', 'Gastos fijos', 'Suscripciones', 'G', serie(2500, 0.05, 2)),
    item('Gimnasio', 'Gastos fijos', 'Salud', 'G', serie(22000, 0.05, 2)),
    item('Prepaga', 'Gastos fijos', 'Salud', 'G', serie(60000, 0.045, 1)),
    item('Nafta', 'Gastos fijos', 'Auto', 'G', serie(40000, 0.03, 1, 0.15)),
    item('Seguro auto', 'Gastos fijos', 'Auto', 'G', serie(35000, 0.05, 1)),
    item('Supermercado', 'Gastos fijos', 'Supermercado', 'G', serie(200000, 0.035, 1, 0.1)),
    item('Préstamo', 'Préstamos y deudas', 'Préstamos y deudas', 'G', serie(80000, 0, 1, 0, 0, 20)),
    item('Ahorro del mes', 'Ahorro e inversión', 'Ahorro e inversión', 'A', serie(150000, 0.06, 1, 0.3)),
  ];
  ['Salidas y comida', 'Viajes', 'Ropa y calzado', 'Tecnología', 'Hogar', 'Regalos', 'Otros'].forEach((c, k) => {
    items.push({ nombre: c, seccion: 'Eventuales', categoria: c, clase: 'G', mov: true, medio: '',
      v: meses.map((m, i) => (i > iAct ? null : rnd() < 0.55 ? Math.round((20000 + rnd() * 150000) * (1 + i * 0.04) * (k === 1 ? 2 : 1)) : 0)), e: meses.map(() => 0) });
  });
  const proximos = [
    { nombre: 'Salario', fecha: '2026-09-29', valor: 3594654, estimado: true },
    { nombre: 'Luz', fecha: '2026-10-01', valor: 150000, estimado: true },
    { nombre: 'Supermercado', fecha: '2026-10-01', valor: 350000, estimado: true },
    { nombre: 'Alquiler', fecha: '2026-10-13', valor: 1000000, estimado: true },
    { nombre: 'Expensas', fecha: '2026-10-15', valor: 202600, estimado: true },
  ];
  const dashboard = { generado: hoyIso, mesActual: hoyIso.slice(0, 7), meses, items, inflacion, oficial, blue, inflEsperada: 2.0, dolar: 'blue', proximos };

  const pItems = items.filter((i) => !i.mov).map((i, k) => ({
    nombre: i.nombre, fila: 9 + k, seccion: i.seccion, categoria: i.categoria, clase: i.clase, medio: k % 3 ? 'Débito automático' : '',
    vence: '', fecha: ['2026-09-01', '2026-09-10', '2026-09-15', '2026-09-29', '2026-09-30', ''][k % 6], valor: i.v[iAct], estimado: k % 4 === 0,
  }));
  const panel = {
    hoy: hoyIso, mes: hoyIso.slice(0, 7), mesLabel: 'Septiembre 2026',
    meses: [-3, -2, -1, 0, 1, 2, 3].map((k) => ({ iso: meses[iAct + k], label: meses[iAct + k] })),
    items: pItems, categorias: ['Salidas y comida', 'Viajes', 'Ropa y calzado', 'Tecnología', 'Hogar', 'Salud y cuidado', 'Regalos', 'Educación', 'Auto y transporte', 'Otros'],
    medios: ['Débito automático', 'Tarjeta VISA', 'Tarjeta AMEX', 'Transferencia', 'Efectivo', 'Mercado Pago'],
    aprendidas: {}, palabras: { Hogar: ['heladera', 'mueble'], 'Salidas y comida': ['cena', 'bar'], Viajes: ['viaje', 'vuelo'] },
    recientes: [{ fecha: '2026-09-20', desc: 'Cena cumple', cat: 'Salidas y comida', monto: 48000, cuotas: 1 }, { fecha: '2026-09-12', desc: 'Heladera', cat: 'Hogar', monto: 984385, cuotas: 6 }],
    resumen: { I: 3594654, G: 2071965, A: 99999, L: 1422689 }, deshacer: '',
  };
  return { dashboard, panel };
}
module.exports = { generar };
