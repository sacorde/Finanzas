# Decisiones de diseño

## Evolución

1. **Primer intento (otro repo):** terminó siendo más difícil de manipular que el Excel.
2. **Versión 2:** la hoja de Google Sheets como interfaz, con scripts que agregaban automatizaciones. Funcionaba, pero la planilla mezclaba datos, formato y lógica, y quedaba atada a lo que Sheets deja hacer.
3. **Versión 3:** una **app web** que se usa como un Excel y una planilla que es **solo base de datos**.
4. **Versión 4:** todo se agrega y modifica en celdas (sin formularios ni pestaña de movimientos), categorías con color y selector de mes.
5. **Versión 5 (actual):** un solo nivel de categorías (sin secciones ni subcategorías), sin columna de detalles: vencimiento y medio de pago resumidos junto al nombre.

## Principios

1. **Se edita como un Excel.** Grilla con teclado (flechas, Enter, Tab, Supr), cuentas en las celdas, copiar y pegar, deshacer, suma de la selección. Las pantallas nuevas (carga rápida, menú contextual) son atajos, no obligaciones.
2. **El sistema nunca pisa lo que cargaste vos.** El estado *confirmado* / *estimado* es explícito (columna `estado`) y se ve en la celda (negro / gris itálica).
3. **Datos simples y legibles.** Una tabla por entidad, una fila por registro, texto plano para meses y fechas (`2026-09`, `2026-09-28`), para que Sheets no los convierta.
4. **Una sola configuración por cosa, en el lugar donde se usa.** Vencimiento, medio de pago y proyección están en el concepto. Ajustes solo tiene preferencias generales.
5. **Nada destructivo sin respaldo.** La instalación y la limpieza de hojas hacen una copia completa del archivo antes de tocar nada.
6. **Instantáneo en pantalla, seguro en el servidor.** La celda cambia al instante. El guardado va en cola, en lotes y con lock. El servidor recalcula la proyección y devuelve el resultado.

## Por qué así

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| App web de Apps Script (HtmlService) | Sitio externo + API de Sheets | No hay servidores ni claves: corre con tu cuenta y tus permisos |
| Tabla `Valores` larga (concepto × mes) | Grilla de meses en la hoja | Sin límites de columnas ni fórmulas frágiles, y fácil de leer desde cualquier herramienta |
| Proyección calculada en el servidor | Fórmulas en Sheets | Reglas claras (repetir, promedio, inflación, baja con 0) y testeables |
| Gastos eventuales como filas de la grilla (una por gasto, en la categoría Eventuales) | Una lista aparte de movimientos | Todo se carga y se corrige en celdas, como en el Excel; las filas de años plegados se ocultan |
| Cuotas escritas en la celda (`600k 3c`) | Formulario de cuotas | Se reparten en celdas normales, que se pueden corregir una por una |
| Un solo nivel de categorías, en su tabla, con color | Secciones con subcategorías | Más simple de leer y de mantener; permite categorías vacías, colores y orden propio |
| Vencimiento y medio resumidos junto al nombre | Columnas de detalle | La grilla queda como el Excel: concepto + meses |
| Tablas leídas por encabezado | Por posición de columna | Las bases de versiones anteriores se actualizan solas sin romperse |
| Deploy a la implementación de prueba (`/dev`) | Crear una versión por deploy | Siempre el último código, sin acumular versiones; la app es privada (solo el dueño) |
| Filtros y dashboard en el navegador | Recalcular en el servidor | Respuesta instantánea |

## Próximos pasos posibles

- Importar *Finanzas 2022 / 2023* para ver la serie completa del salario.
- Tenencias y deudas (la vieja hoja *Reservas*): patrimonio neto en el dashboard.
- Ajustes de alquiler por ICL / IPC cada N meses como modo de proyección.
- Importar el resumen de la tarjeta (PDF/CSV) como filas de Eventuales.
- Alertas: "este mes gastaste X % más en Salidas que tu promedio".
