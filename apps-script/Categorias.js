/**
 * Finanzas · En qué categoría va cada concepto
 * Se usa al importar el Excel y al pasar datos de versiones anteriores
 * (que tenían secciones y subcategorías) a las categorías de un solo nivel.
 */

/** Nombres de categorías viejas → categoría nueva. */
var SINONIMOS_CATEGORIA_ = {
  'Ingresos': ['ingreso', 'ingresos', 'sueldo', 'sueldos', 'salario'],
  'Vivienda': ['vivienda', 'casa', 'hogar', 'alquiler', 'depto', 'departamento'],
  'Servicios': ['servicio', 'servicios', 'impuestos', 'impuesto'],
  'Suscripciones': ['suscripcion', 'suscripciones', 'streaming'],
  'Transporte': ['transporte', 'auto', 'autos', 'movilidad', 'vehiculo', 'moto', 'auto y transporte'],
  'Supermercado': ['super', 'supermercado', 'alimentos', 'almacen', 'comida'],
  'Préstamos': ['prestamo', 'prestamos', 'deuda', 'deudas', 'credito', 'creditos', 'prestamos y deudas'],
  'Ahorro e Inversión': ['ahorro', 'ahorros', 'inversion', 'inversiones', 'ahorro e inversion'],
  'Eventuales': ['eventual', 'eventuales', 'varios']
};

/** Palabras en el nombre del concepto → categoría (cuando la categoría vieja no alcanza). */
var PALABRAS_FIJOS_ = {
  'Vivienda': ['alquiler', 'expensa', 'hipoteca', 'abl', 'inmobiliario', 'seguro incendio', 'seguro hogar', 'mantenimiento'],
  'Servicios': ['luz', 'gas', 'agua', 'internet', 'celular', 'telefono', 'personal', 'movistar', 'claro', 'tuenti', 'edenor', 'edesur',
    'metrogas', 'naturgy', 'aysa', 'cable', 'fibertel', 'telecentro', 'impuesto'],
  'Suscripciones': ['netflix', 'spotify', 'youtube', 'disney', 'hbo', 'max', 'prime', 'amazon', 'apple', 'google one', 'icloud', 'crunchyroll',
    'paramount', 'mercadolibre nivel', 'meli+', 'pedidos ya plus', 'chatgpt', 'gym', 'gimnasio', 'sportclub', 'megatlon', 'crossfit'],
  'Transporte': ['nafta', 'sube', 'auto', 'patente', 'seguro auto', 'peaje', 'estacionamiento', 'cochera', 'colectivo', 'tren', 'subte', 'uber', 'cabify'],
  'Supermercado': ['super', 'coto', 'carrefour', 'jumbo', 'disco', 'vea', 'changomas', 'verduleria', 'carniceria', 'almacen', 'dia'],
  'Préstamos': ['prestamo', 'credito', 'deuda', 'refinanciacion'],
  'Ahorro e Inversión': ['ahorro', 'inversion', 'plazo fijo', 'fci', 'cedear']
};

function contienePalabra_(texto, p) {
  return p.length <= 3 ? new RegExp('(^|[^a-z0-9])' + p.replace(/[+]/g, '\\+') + '([^a-z0-9]|$)').test(texto) : texto.indexOf(p) >= 0;
}

/**
 * Categoría nueva para un concepto de una versión anterior.
 * @param {{seccion:string, categoria:string, nombre:string, clase:string, tipo:string}} c
 * @return {string} nombre de la categoría
 */
function mapearCategoria_(c) {
  if (c.tipo === 'eventual') return 'Eventuales';
  if (c.clase === 'I') return 'Ingresos';
  if (c.clase === 'A') return 'Ahorro e Inversión';
  var cat = norm_(c.categoria), sec = norm_(c.seccion);
  var porNombre = function (texto) {
    var elegida = null;
    Object.keys(SINONIMOS_CATEGORIA_).forEach(function (k) { if (!elegida && SINONIMOS_CATEGORIA_[k].indexOf(texto) >= 0) elegida = k; });
    return elegida;
  };
  var r = cat && cat !== sec ? porNombre(cat) : null;
  if (r) return r;
  if (/prestamo|deuda/.test(sec)) return 'Préstamos';
  var n = norm_(c.nombre), mejor = null, largo = 0;
  Object.keys(PALABRAS_FIJOS_).forEach(function (k) {
    PALABRAS_FIJOS_[k].forEach(function (p) { if (p.length > largo && contienePalabra_(n, p)) { mejor = k; largo = p.length; } });
  });
  if (mejor) return mejor;
  // Una categoría propia que no está en la lista se conserva como categoría
  if (cat && cat !== sec && cat !== 'otros fijos') return String(c.categoria).trim();
  return porNombre(sec) || 'Servicios';
}
