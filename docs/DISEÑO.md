# Decisiones de diseño

## El problema del primer intento

El sistema anterior terminó siendo *más difícil de manipular que el Excel*. La causa típica: esconder la planilla detrás de formularios, tablas "normalizadas" y pantallas propias. Cada cambio chico (una cuenta, mover una fila, corregir un mes viejo) pasaba a necesitar una pantalla.

## Principio rector: la planilla es la interfaz

1. **La hoja Finanzas es la fuente de verdad y se edita como un Excel.** Nada de bases de datos paralelas: el script lee y escribe la misma grilla que ves.
2. **El script solo agrega lo que Excel no hace solo** (proyectar, fechas hábiles, calendario, inflación) y **nunca pisa algo que escribiste vos**.
3. **Estado visible, no escondido.** Estimado vs. confirmado es un estilo de celda (gris itálica vs. negro), no una columna o una base aparte. Se entiende mirando.
4. **Una sola configuración por cosa, en el lugar donde se usa.** El vencimiento, el medio de pago y la forma de proyectar están en la misma fila del concepto. La hoja Config tiene solo preferencias generales.
5. **Tolerante a lo que haga el usuario.** Insertar/borrar filas, copiar una categoría, pisar un subtotal: el sistema se reacomoda (códigos en una columna oculta, fórmulas regeneradas, menú Reparar).
6. **Las pantallas nuevas son atajos, no obligaciones.** El panel de carga y el dashboard aceleran lo frecuente (cargar un gasto desde el celular, analizar) pero todo se puede hacer escribiendo en la hoja.

## Por qué así

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Meses en columnas, conceptos en filas (como el Excel original) | Tabla larga fecha/concepto/monto | Es el modelo mental de quien ya usa la planilla; se ve un año de un vistazo |
| Totales anuales intercalados + grupos de columnas | Totales solo en el dashboard | Al plegar un año queda visible su total: el pasado ocupa una columna |
| Códigos de estructura en columna A oculta | Detectar secciones por formato o texto | Robusto a renombrar, mover e insertar filas |
| Subtotales con `SUM(rango)` regenerados por script | `SUMIFS` por categoría | Evita referencias circulares y se leen fácil en la barra de fórmulas |
| Eventuales en una hoja de movimientos | Una fila por gasto dentro de Finanzas (Excel viejo) | La hoja principal no crece sin fin, y permite cuotas y categorías |
| Reglas de vencimiento en castellano | Fórmulas `WORKDAY(...)` o un selector de fechas | Se escriben en 2 segundos y se leen igual |
| Solo repetir desde el mes actual; "mes anterior vacío = dado de baja" | Proyectar todo desde el último valor | Evita revivir suscripciones canceladas |
| Importación: futuro que repite = estimado; futuro distinto = tuyo | Todo el futuro importado como estimado | Respeta lo que planificaste a mano (ej. aguinaldo) |
| Filtros del dashboard en el navegador | Recalcular en el servidor | Respuesta instantánea al cambiar período o moneda |

## Próximos pasos posibles

- Hojas **Reservas** (tenencias, deudas de terceros) y **Pagos**: integrarlas al dashboard (patrimonio neto, deudas).
- Importar **Finanzas 2022 / 2023** a la línea de tiempo para ver la serie completa del salario.
- Ajustes de alquiler por **ICL / IPC cada N meses** como modo de proyección.
- Resumen de tarjeta: importar el PDF/CSV del resumen a Movimientos.
- Alertas: "este mes gastaste X % más en Salidas que tu promedio".
