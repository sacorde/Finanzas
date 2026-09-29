/**
 * Finanzas · Categorías de gastos eventuales
 * Sugiere la categoría de un gasto por lo que cargaste antes o por palabras clave.
 */

var PALABRAS_CATEGORIA_ = {
  'Salidas y comida': ['mc', 'mcdonal', 'burger', 'hamburg', 'hambu', 'empanada', 'pizza', 'bar', 'cerveza', 'cena', 'almuerzo', 'comida', 'resto', 'cafe', 'helado', 'pedidos ya', 'rappi', 'pescadorita', 'sushi', 'parrilla', 'escape', 'cine', 'teatro', 'recital', 'river', 'boca', 'entrada'],
  'Viajes': ['viaje', 'vuelo', 'hotel', 'airbnb', 'florianopolis', 'mendoza', 'iguazu', 'chalten', 'bariloche', 'brc', 'trekking', 'pasaporte', 'excursion', 'micro', 'aerolineas', 'flybondi', 'booking'],
  'Ropa y calzado': ['ropa', 'jean', 'remera', 'short', 'zapatilla', 'bikini', 'campera', 'buzo', 'salomon', 'nike', 'adidas', 'anteojo', 'rayban', 'medias', 'zapato'],
  'Tecnología': ['samsung', 's24', 's20', 'celular', 'iphone', 'notebook', 'compaq', 'disco', 'ssd', 'monitor', 'teclado', 'mouse', 'auricular', 'juego', 'alan wake', 'steam', 'playstation', 'ps5', 'xbox', 'tablet', 'cargador'],
  'Hogar': ['mueble', 'heladera', 'lavarropas', 'silla', 'escritorio', 'colchon', 'sillon', 'cortina', 'quinta', 'ferreteria', 'pintura', 'envio mueble', 'bazar', 'sommier', 'microondas'],
  'Salud y cuidado': ['farmacia', 'medico', 'dentista', 'odontolog', 'implante', 'capilar', 'perfume', 'cortadora', 'peluqueria', 'psicolog', 'estudio', 'remedio', 'optica', 'kinesio'],
  'Regalos': ['regalo', 'cumple', 'prote', 'protes'],
  'Educación': ['matricula', 'curso', 'libro', 'utn', 'istea', 'facultad', 'copy', 'fotocopia', 'udemy', 'cuota colegio'],
  'Auto y transporte': ['arreglo auto', 'auto', 'mecanico', 'gomeria', 'service', 'vtv', 'peaje', 'estacionamiento', 'cochera', 'uber', 'cabify', 'taxi', 'multa']
};

/**
 * Adivina la categoría de un gasto.
 * 1) Lo que ya cargaste antes con la misma descripción (aprendizaje).
 * 2) Palabras clave.  3) "Otros".
 */
function adivinarCategoria(desc, aprendidas) {
  var d = norm_(desc);
  if (!d) return 'Otros';
  if (aprendidas) {
    if (aprendidas[d]) return aprendidas[d];
    var primera = d.split(' ')[0];
    if (primera.length > 2 && aprendidas['#' + primera]) return aprendidas['#' + primera];
  }
  var mejor = null, largo = 0;
  Object.keys(PALABRAS_CATEGORIA_).forEach(function (cat) {
    PALABRAS_CATEGORIA_[cat].forEach(function (p) {
      var hay = p.length <= 3 ? new RegExp('(^|[^a-z0-9])' + p + '([^a-z0-9]|$)').test(d) : d.indexOf(p) >= 0;
      if (hay && p.length > largo) { mejor = cat; largo = p.length; }
    });
  });
  return mejor || 'Otros';
}

/** Mapa de aprendizaje a partir de movimientos existentes ({descripcion, categoria}). */
function aprenderCategorias_(movs) {
  var mapa = {}, conteo = {};
  movs.forEach(function (m) {
    var d = norm_(m.descripcion), c = String(m.categoria || '');
    if (!d || !c) return;
    mapa[d] = c;
    var p = '#' + d.split(' ')[0];
    conteo[p] = conteo[p] || {};
    conteo[p][c] = (conteo[p][c] || 0) + 1;
  });
  Object.keys(conteo).forEach(function (p) {
    mapa[p] = Object.keys(conteo[p]).sort(function (a, b) { return conteo[p][b] - conteo[p][a]; })[0];
  });
  return mapa;
}
