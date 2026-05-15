# Refactor Nóminas — Notas de trabajo

Branch: `feat/contratos-terminar-y-licencias`
Estado: en desarrollo (sin pushear todavía a `main`).

Este archivo resume todo el trabajo hecho sobre el módulo Nóminas (motor de cálculo, contratos, conceptos, feriados, UI ficha del empleado). Sirve como handoff para retomar en otro chat o para hacer code review.

## Filosofía aplicada

- **Sin parches, todo como corresponde.** Cuando aparece una inconsistencia (UI vs BD, tipo de feriado, doble pago, etc.) se arregla en la raíz, no con un helper de display.
- **Multi-tenant estricto**: todo filtra por `empresa_id`.
- **Régimen-agnóstico**: presentismo, antigüedad, premios funcionan igual sea informal o relación de dependencia.

---

## 1. Motor de cálculo (`src/lib/nominas/motor-calculo.ts`)

### Helpers nuevos
- `esUltimaLiquidacionDelMes(periodoInicio, periodoFin)` — devuelve true si el último día del mes cae dentro del período. Se usa para gatear los conceptos `periodicidad='mensual'`.
- `calcularBasicoMensual(modalidad, montoBase, diasLaboralesDelMes)` — convierte el `monto_base` del contrato al básico mensual real:
  - `fijo_mensual` → monto
  - `fijo_quincenal` → monto × 2
  - `fijo_semanal` → monto × 30/7
  - `por_dia` → monto × días laborales del mes
  - `por_hora` → monto × días laborales × 8

### Nuevas condiciones de concepto (`condicion_jsonb`)
Cada concepto puede tener una condición que el motor evalúa contra las métricas del período.

| Tipo | Parámetros | Cuándo se cumple |
|---|---|---|
| `asistencia_perfecta` | — | No hubo ausencias ni tardanzas |
| `trabajo_feriado` | `feriados: N` (default 1) | El empleado fichó entrada en ≥ N feriados |
| `horas_minimas` | `horas: N` | Horas netas del período ≥ N |
| `dias_minimos` | `dias: N` | (Ya existía) Días trabajados ≥ N |
| `sin_tardanzas` | — | (Ya existía) |
| `sin_ausencias` | — | (Ya existía) |

### Periodicidad de conceptos
Cada concepto declara cómo se aplica:
- `por_periodo` — se aplica en cada liquidación con métricas del período (default).
- `mensual` — solo se aplica en la **última** liquidación del mes; se evalúa contra métricas del mes completo y se calcula sobre el básico **mensual**. Esto evita que un Presentismo del 10% se cobre dos veces en un esquema quincenal.
- `unico` — reservado, no implementado.

### Pago doble por trabajar en feriado
`calcularMontoConcepto` ahora recibe la condición. Cuando `modo_calculo='por_evento'` + condición `trabajo_feriado`, el motor multiplica el valor por `dias_feriados_trabajados`. Caso típico: concepto "Pago feriado trabajado", monto = jornal, evento por feriado → trabajó 2 feriados → cobra 2 jornales extra.

### Métricas extendidas (`MetricasAsistencia`)
Se agregó `dias_feriados_trabajados: number` para alimentar la condición `trabajo_feriado` y el cálculo de pago doble.

### Tests
33/33 pasando (`src/lib/nominas/__tests__/motor-calculo.test.ts`).

---

## 2. Feriados y días no laborables

### Migración SQL nueva
Ninguna; se aprovecha la tabla `feriados` existente (`src/db/migraciones/feriados.sql`) que tiene `tipo IN ('nacional', 'puente', 'no_laborable', 'empresa', 'regional')`.

### Endpoint `/api/nominas/route.ts` ahora consulta la tabla
Antes solo usaba `date-holidays` (feriados nacionales por código de país). Ahora:
1. Carga feriados nacionales con la librería (`type='public'`).
2. Carga la tabla `feriados` de la empresa, **rango anio completo** (no solo del período, porque el cálculo mensual puede ver días del mes fuera de `[desde, hasta]`).
3. **Separa por tipo**:
   - `feriadosSet`: nacional + puente + empresa + regional → pago doble si se trabaja, no laboral si no.
   - `diasNoLaborablesSet`: `no_laborable` → el empleador decide si abre. Si trabaja, paga normal (no doble); si no trabaja, no es ausencia.

### `calcularDiasDelPeriodo` ahora distingue
- Día activo del turno + en `feriadosSet` → `fechasFeriado` (genera doble pago).
- Día activo del turno + en `diasNoLaborablesSet` → **descartado** (ni laboral ni feriado).
- Día activo del turno + ninguno → `fechasLaborales`.

### Métricas mensuales
`metricasMes.dias_feriados_trabajados` cuenta cuántas fechas del mes con `feriadosSet.has(fecha)` tuvieron fichaje de entrada.

### UI Feriados conectada
**La sección `SeccionFeriados.tsx` existía pero estaba huérfana** (nunca importada). Ahora está montada en `/calendario/configuracion` como tab "Feriados" (grupo Personalización). Carga lazy desde `/api/calendario/feriados`. Incluye el botón "Generar con Salix IA" que llama a `/api/calendario/feriados/generar-ia`.

---

## 3. Conceptos de nómina

### Migraciones nuevas
- `sql/089_periodicidad_conceptos.sql` — agrega columna `periodicidad ('mensual' | 'por_periodo' | 'unico')` a `conceptos_nomina`.
- `sql/090_conceptos_predefinidos.sql` — agrega `es_predefinido boolean NOT NULL DEFAULT false` + backfill para los conceptos seeded del sistema (Presentismo, Premio puntualidad, Antigüedad, Descuento por uniforme).

### Backend
- `GET /api/nominas/conceptos` — devuelve todos los campos incluyendo `es_predefinido`, `periodicidad`.
- `POST /api/nominas/conceptos` — acepta `duplicar_de: <id>` para clonar un concepto existente como NO predefinido (permite hacer variantes por sector).
- `PATCH /api/nominas/conceptos/[id]` — whitelist incluye `periodicidad`.
- `DELETE /api/nominas/conceptos/[id]`:
  - Si es predefinido → 409 con codigo `PREDEFINIDO`. El operador puede desactivarlo con `activo=false` pero no eliminarlo.
  - Si no es predefinido y no hay referencias en `conceptos_contrato` → **hard delete real** de la BD.
  - Si no es predefinido pero está asignado a algún contrato → soft delete (`activo=false`) para no romper recibos viejos. La tabla snapshot `conceptos_aplicados_pago` tiene `ON DELETE SET NULL`, no bloquea.
  - La respuesta incluye `modo: 'eliminado' | 'desactivado'` para que la UI muestre el toast correcto.

### UI `VistaConfiguracion.tsx` (tab Configuración del módulo Nóminas)
- Badge **"Predefinido"** con icono `Shield` para los del sistema.
- Botón **Duplicar** (icono Copy) — clona un concepto como editable y eliminable.
- **4 slots fijos de acciones** para que se alineen las columnas entre filas: Editar | Duplicar | Toggle activo | Eliminar.
- Predefinidos: solo Toggle activo (no Eliminar).
- No predefinidos: tanto Toggle como Eliminar; el botón Eliminar aparece en activos e inactivos.
- **Modal de confirmación propio** (`ModalConfirmacion`) en lugar de `confirm()` nativo, porque el navegador puede suprimirlo. Confirma tanto eliminar como desactivar.
- **Refresco silencioso**: el spinner solo aparece en la primera carga. Crear/duplicar/eliminar actualiza la lista en su lugar (flag `primeraCarga`).

### Editor de concepto (`EditorConcepto.tsx`)
- Selector de **Periodicidad** (Por período / Mensual / Único).
- Labels dinámicos de condición según periodicidad ("Días trabajados del período" vs "del mes").
- 4 condiciones nuevas en el select.
- Banner con `Shield` cuando es predefinido: explica que no se puede borrar pero sí desactivar.
- Panel "Para qué sirve" con texto educativo por categoría.

---

## 4. Contratos laborales

### Migración nueva
- `sql/087_motivos_no_salida_contratos.sql` — añade `cambio_condiciones` y `renovacion` al CHECK constraint de `contratos_laborales.motivo_fin`.
- `sql/088_unificar_horarios_y_turnos.sql` — `DROP TABLE IF EXISTS horarios CASCADE`. La tabla `horarios` quedó huérfana y todo unificado en `turnos_laborales`.

### Backend
- `GET /api/nominas/contratos` — devuelve `tiene_pagos` por contrato (booleano) para que la UI sepa si puede editar economic fields o tiene que cerrar+crear.
- `POST /api/nominas/contratos`:
  - Acepta `motivo_fin` y `nota_fin` para cerrar el anterior automáticamente.
  - Crea el nuevo vigente con `vigente=true` y los datos pasados.
- `PATCH /api/nominas/contratos/[id]`:
  - `accion='editar'` (default) — modifica campos del contrato; los económicos están bloqueados si ya tiene pagos.
  - `accion='terminar'` — cierra con `vigente=false`, `fecha_fin`, `motivo_fin`, `nota_fin`.

### `/api/nominas/route.ts` integra motor + contratos
Cambio mayor: ahora el endpoint del listado de liquidaciones:
1. Hace **lookups masivos**: `contratoVigentePorMiembro`, `conceptosPorMiembro`, asistencias del mes si necesita.
2. Calcula `metricasPeriodo` y `metricasMes` (cuando es la última del mes).
3. Aplica cada concepto del miembro con su `periodicidad`.
4. Devuelve campos adicionales por fila:
   - `conceptos_aplicados[]` (cada uno con tipo, monto, detalle)
   - `total_haberes`, `total_descuentos_conceptos`
5. `monto_neto = bruto + haberes - descuentos_conceptos - adelantos - saldo_anterior`.

### UI `ContratoVigente.tsx`
- Hero editorial con jerarquía: monto grande, modalidad, período de vigencia.
- **Botón inteligente**: muestra "Editar" si NO hay pagos; "Cambiar condiciones" si los hay.
- Hereda turno del sector si el contrato no tiene `turno_id` propio.

### Modales nuevos
- `ModalEditarContrato.tsx` — edición directa cuando no hay pagos.
- `ModalRenovarContrato.tsx` — renovar con mismas condiciones (motivo `renovacion`).

---

## 5. UI Ficha del empleado (`/nominas/empleado/[id]`)

Reescritura significativa del header y del comportamiento de tabs.

### Header (identidad + datos contractuales)
- **Foto 64×64** (antes 48×48). Carga `perfiles.avatar_url` con fallback a `miembros.foto_kiosco_url` (la foto del kiosco, típica de empleados sin login).
- **Nombre** en `text-2xl font-semibold tracking-tight` (antes `text-lg`).
- **Mini-stats** con label uppercase chiquita + valor + icono:
  - 🏢 SECTOR · Taller
  - 🕐 TURNO · Mañana (oculto si su nombre == sector, evita "Taller · Taller")
  - 💼 MODALIDAD · Por día
  - SUELDO BASE · **$45.000,00** / quincena (destacado, tabular-nums)
  - ESTIMADO MENSUAL · ≈ $990.000 (en color marca, solo si frecuencia ≠ mensual). Calculado con función `estimadoMensual`.
- **Eliminado** el botón "‹ Empleados" redundante con las migajas.
- Migajas, header y tabs separados por respiración real (`pt-6 pb-5`).

### Keep-alive de tabs
**Patrón clave para evitar re-fetches al navegar entre tabs.**

- `tabsVisitadas: Set<TabClave>` arranca con la tab inicial.
- Al cambiar de tab, se agrega al set (no se quita la anterior).
- Render: `{tabsVisitadas.has('X') && <div hidden={tab !== 'X'}>...</div>}`.
- **Resultado**: una tab visitada queda viva en memoria; cambiar de tab solo oculta con CSS, no remonta el componente. Liquidaciones / Licencias / Conceptos no re-fetchean al volver.

### Tab Liquidaciones — eliminadas duplicaciones
`PaginaEditorNominaEmpleado` ahora respeta el prop `embed`:
- ❌ **Sin** `PlantillaEditor` wrapper (que duplicaba el nombre del empleado).
- ❌ **Sin** `CabezaloPersona` interno (foto+nombre+puesto otra vez).
- ❌ **Sin** insignias "Por día / Quincenal" en el header (ya están en el subtítulo del header padre).
- ✅ Barra de acciones (Enviar recibo / Registrar pago) a la derecha.
- ✅ Banner hero del período (selector con flechas ‹ Hoy › + Mes/Quincena/Semana).
- ✅ Banner resumen de cálculo (Corresponde pagar / Bruto − Adelanto = Neto).
- ✅ Grid 2 columnas con Asistencia, Jornadas, Desglose, Compensación base, Adelantos del período, Pagos.

---

## 6. Otras vistas con refresco silencioso

`VistaAdelantos.tsx` aplica el mismo patrón: `primeraCarga` flag para que el spinner solo aparezca en la carga inicial. Crear/cancelar/reasignar adelantos actualiza la lista en su lugar.

`VistaEmpleados.tsx` y `VistaNomina.tsx`: ya tenían comportamiento correcto (la primera tiene cache por filtro Activos/Terminados/Todos, la segunda cache por período).

---

## 7. Datos modificados en BD producción

Cambios aplicados en `flux-dev` (id `nfbjdlmnsmcmtvimjeuo`, empresa `989ce4ef-44a5-4235-a91b-ec1a06c1801a`):

### José Luis Romero (miembro_id `cf30a0c9-bcd6-4e94-befb-be92886cdb46`)
- Contrato `3667e6b0...` cerrado: `fecha_fin=2026-04-30`, `vigente=false`, `motivo_fin='cambio_condiciones'`, `nota_fin='Cambio de jornal: $40.000/día → $45.000/día (frecuencia quincenal sin cambios).'`.
- Contrato nuevo `55cac538...`: `fecha_inicio=2026-05-01`, `vigente=true`, `por_dia $45.000`, `quincenal`, mismo sector, `informal`.
- Conceptos asignados al nuevo: Presentismo + Premio puntualidad.

### Carlos Agustin Costa (miembro_id `5d1f1ca4-e8de-4f65-951f-07c64b749260`)
- Contrato vigente `81e11f28...`: sin cambios.
- Conceptos asignados al vigente: Presentismo + Premio puntualidad.

---

## 8. Pendiente / Próximos pasos sugeridos

- **Tab Adelantos del empleado**: hoy es un `EstadoVacio` "en construcción". Hace falta implementación real (lista de adelantos del miembro, crear/cancelar/reasignar). Sería una versión simplificada de `VistaAdelantos` filtrada por `miembro_id`.
- **Decidir si unificar "Adelantos del período" (columna derecha de Liquidaciones)** con la tab Adelantos lateral. Hoy cumplen funciones distintas (uno es del período, otro es global), pero la separación se siente redundante al usuario.
- **Tests para las condiciones nuevas** (`trabajo_feriado`, `asistencia_perfecta`, `horas_minimas`): el motor está cubierto en casos básicos pero conviene agregar tests específicos.
- **Verificar end-to-end** con datos reales: liquidar mayo 2026 de José y Agustín para confirmar que los conceptos predefinidos se aplican como esperado, y que el feriado del 1° de mayo (día del trabajador) genera el doble pago si configuran un concepto `por_evento + trabajo_feriado`.
- **Commits y push**: hay varios commits locales no pusheados. El usuario explícitamente pidió no pushear después de cada cambio para evitar costos en Vercel. Cuando esté listo, agrupar en uno o dos commits con buenos mensajes y abrir PR.

---

## 9. Archivos clave modificados

```
src/lib/nominas/motor-calculo.ts                 — helpers + condiciones + pago doble
src/lib/nominas/__tests__/motor-calculo.test.ts  — fixtures actualizados
src/tipos/nominas.ts                             — tipos nuevos
src/app/api/nominas/route.ts                     — integración motor + feriados separados
src/app/api/nominas/conceptos/route.ts           — POST duplicar_de
src/app/api/nominas/conceptos/[id]/route.ts      — DELETE inteligente
src/app/api/nominas/contratos/route.ts           — tiene_pagos, motivo_fin
src/app/api/nominas/contratos/[id]/route.ts      — accion editar/terminar
src/app/(flux)/nominas/empleado/[miembro_id]/page.tsx  — header + keep-alive
src/app/(flux)/nominas/_componentes/ContratoVigente.tsx
src/app/(flux)/nominas/_componentes/ModalEditarContrato.tsx       (nuevo)
src/app/(flux)/nominas/_componentes/ModalRenovarContrato.tsx      (nuevo)
src/app/(flux)/nominas/_componentes/EditorConcepto.tsx            — periodicidad + condiciones
src/app/(flux)/nominas/_componentes/VistaConfiguracion.tsx        — UI conceptos
src/app/(flux)/nominas/_componentes/VistaAdelantos.tsx            — refresco silencioso
src/componentes/entidad/_editor_nomina_empleado/PaginaEditorNominaEmpleado.tsx  — modo embed limpio
src/app/(flux)/calendario/configuracion/page.tsx                  — conecta SeccionFeriados
sql/087_motivos_no_salida_contratos.sql           (nuevo)
sql/088_unificar_horarios_y_turnos.sql            (nuevo)
sql/089_periodicidad_conceptos.sql                (nuevo)
sql/090_conceptos_predefinidos.sql                (nuevo)
```

---

## 10. Cómo retomar en otro chat

1. Abrí Claude Code en `/Users/sal/dev/Salix-flux-2.0`.
2. Pedí: *"Leé `NOTAS_NOMINAS.md` y seguimos con el refactor"*.
3. Claude tendrá todo el contexto sin necesidad de re-investigar el código.
