# Changelog del módulo de Flujos

Cambios cronológicos del módulo `/flujos` (motor + UI). Las entradas
marcan transiciones importantes — se actualizan al cierre de cada
sub-PR cuando dejan estado intermedio relevante.

Para detalle de implementación de cada PR, ver `project_workflows.md`
en la memoria del proyecto.

---

## 2026-05-08 — Sub-PR 20.4 cerrado: panel UI dedicado + plantillas curadas

**Branch:** `feat/flujos-pr-20` (sigue acumulando hasta 20.5).

### Qué se hizo

1. **`PanelCompletarActividad.tsx`** — panel UI dedicado para la acción
   `completar_actividad`. Reemplaza el JSON crudo del 19.3d como camino
   primario. 4 secciones siguiendo el patrón existente del editor:
   - CRITERIO (abierto): tipo de actividad (SelectorTipoActividad),
     vinculada a entidad (`SelectorPopoverBase` con 11 opciones —
     "Sin vínculo" + 10 `EntidadRelacionable`; pills hubieran sido
     caóticas), contacto, asignado (SelectorMiembro), estado actual
     (3 pills canónicos).
   - COMPORTAMIENTO (abierto): si_multiple (4 pills), si_no_encuentra
     (2 pills).
   - PLANTILLAS: 4 cards. Arranca abierta cuando los filtros positivos
     del usuario (`tipo_actividad_id` + `relacionada_a`) están vacíos;
     colapsada apenas hay alguno. Defaults de comportamiento NO cuentan
     como "criterio vacío".
   - AVANZADO (cerrado): motivo, continuar_si_falla.

2. **Catálogo de plantillas curadas** en
   `src/lib/workflows/plantillas-completar-actividad.ts`:
   - `cerrar_al_enviar_presupuesto` (espejo del flujo del sistema del 20.3).
   - `cerrar_al_completar_visita` (idem).
   - `cerrar_mas_antigua_del_contacto` (granular, requiere tipo del user).
   - `cerrar_todas_mias_del_tipo` (usa `{{actor.usuario_id}}`).

3. **Validación inline** que replica la regla del validador del 20.1.
   Mensaje ubicado debajo de "Vinculada a", junto al primer campo
   afectado (no al final del bloque). El banner global del editor
   (19.4) sigue siendo fuente de verdad para errores de publicación.

4. **i18n completo** en es/en/pt (38 claves nuevas + 3 secciones).
   Descripciones legibles para admin, sin nombres de tabla SQL en UI
   (jerga `actividades_relaciones` removida del texto visible).

5. **Branch agregado a `PanelEdicionPaso.tsx`** para enrutar al panel
   dedicado cuando el tipo de paso es `completar_actividad`. Antes
   caía al fallback `PanelTipoPendiente` (deuda dejada por 20.1).

### Qué NO se hizo

- Cero modificación a `executor.ts`, `validacion-flujo.ts` o tipos del
  20.1/20.2 (R1 mantenida).
- Modal de plantillas extra: descartado por H3 — sumar uno crearía
  precedente no existente en el editor (todas las acciones se editan
  in-panel después del CatalogoPasos). Las plantillas viven como
  sección colapsable dentro del panel propio.
- Sugerencia contextual de plantilla basada en disparador: deferida
  a sub-PR posterior (mejora UX, no prioridad ahora).

### Deudas detectadas en validación visual (NO del 20.4)

Bugs/UX issues identificados al validar el panel en browser que
**NO son del scope del 20.4** y se anotan acá para tracking. Ninguna
es bloqueante para 20.4 ni 20.5.

1. **Bug visual en `SelectorTipoActividad` (sub-PR 19.3c).** Los items
   del popover renderizan pero el texto es invisible — token de color
   afectado por diagnosticar (probablemente `text-color = bg-color` en
   estado hover/no-hover). Reproducible en `PanelCrearActividad` (ya
   en main). Fix: sub-PR aparte.

2. **UX en `SelectorMiembro` (sub-PR 19.3c).** El componente filtra
   miembros con `usuario_id IS NULL` (kiosco-only) silenciosamente. La
   intención es correcta — sin cuenta no podés ser dueño de una
   actividad — pero el comportamiento es opaco para el admin que ve
   un listado más corto que el de `/usuarios`. Fix: sumar tooltip
   "Solo se muestran usuarios con cuenta" en el placeholder/label del
   selector. Sub-PR aparte.

3. **Bug pre-existente en vista `flujos_con_estadisticas`** (entre
   PR 18.4 y PR 19.1). La vista se creó en `sql/059` con
   `SELECT f.*` cuando `flujos` no tenía `icono`/`color`; la
   migración `sql/060` agregó esas columnas a la tabla pero NO
   recreó la vista. Postgres congela la expansión de `*` al momento
   del `CREATE VIEW`, así que `flujos_con_estadisticas` no las
   tiene — y `GET /api/flujos` falla con
   `column flujos_con_estadisticas.icono does not exist`. Fix:
   `CREATE OR REPLACE VIEW` con columnas explícitas (mejor que
   reusar `f.*`). Hotfix dedicado.

---

## 2026-05-08 — Sub-PR 20.3 cerrado: backfill + seed pausado

**Branch:** `feat/flujos-pr-20` (sigue acumulando hasta 20.5).

**Migración:** `sql/067_flujos_sistema_autocompletar.sql`. Aplicada en
flux-dev vía Supabase MCP.

### Qué se hizo

1. **Columna `flujos.clave_sistema text NULL`** + `UNIQUE (empresa_id,
   clave_sistema) WHERE clave_sistema IS NOT NULL`. Identificador
   estable para flujos preconfigurados que sub-PRs futuros pueden
   referenciar sin matchear por nombre (renombrable por el usuario).

2. **Backfill de `actividades_relaciones`** desde `actividad_origen_id`
   histórico de `presupuestos` y `visitas`. Idempotente por el UNIQUE
   compuesto del 20.2. Verificación post-aplicación: 5 relaciones
   `entidad_tipo='presupuesto'` (= `presupuestos` con
   `actividad_origen_id IS NOT NULL`), 0 relaciones de visitas (no
   había visitas con `actividad_origen_id` en flux-dev).

3. **2 flujos del sistema sembrados PAUSADOS por empresa** en
   `public.flujos`:

   | clave_sistema | Disparador | Acción |
   |---|---|---|
   | `autocompletar_al_enviar_presupuesto` | `entidad.estado_cambio { presupuesto → enviado }` | `completar_actividad { criterio.relacionada_a: presupuesto, si_multiple: 'todas', si_no_encuentra: 'continuar' }` |
   | `autocompletar_al_finalizar_visita` | `entidad.estado_cambio { visita → completada }` | `completar_actividad { criterio.relacionada_a: visita, si_multiple: 'todas', si_no_encuentra: 'continuar' }` |

   Estado inicial: `pausado` (no disparan hasta que el admin los active
   desde el editor o sub-PR 20.5 los habilite formalmente).

4. **Catálogo TS espejo** en `src/lib/workflows/flujos-sistema.ts` con
   shape declarativo. Tests garantizan que cada flujo pasa
   `validarPublicable` (mismo gate que `/activar`).

### Qué NO se hizo (deudas explícitas para 20.5)

> El PR 20 NO se mergea a `main` hasta que 20.5 cierre estos puntos.
> Restricción dura del coordinador.

1. **Implementar disparador `entidad.creada` en el motor.** Es prerrequisito
   para migrar los call-sites de `POST /api/visitas` y `POST
   /api/presupuestos` (eventos `'al_crear'` del helper legacy).
2. **Migrar los 4 call-sites** de `auto-completar-actividad.ts`:
   - PATCH `/api/presupuestos/[id]` → ya cubierto por flujo del sistema 1.
   - PATCH `/api/visitas/[id]` → ya cubierto por flujo del sistema 2.
   - POST `/api/presupuestos` (al crear desde actividad) → necesita `entidad.creada`.
   - POST `/api/visitas` (al programar desde actividad) → necesita `entidad.creada`.
3. **Activar los flujos sembrados** (UPDATE estado='activo' WHERE
   clave_sistema IN (...)) atómicamente con eliminar los call-sites
   en presupuestos/visitas. Evita doble-disparo durante la transición.
4. **Eliminar `src/lib/auto-completar-actividad.ts`** una vez los 4
   call-sites estén migrados.
5. **DROP de columnas legacy** (en orden seguro, requiere refactor
   coordinado del UI flow):
   - `actividades.actividad_origen_id` (usado en 20+ archivos UI/APIs).
   - `actividades.vinculos` jsonb (usado por UI chatter).
   - `tipos_actividad.evento_auto_completar` (usado por UI editor de tipo).
6. **Seed-on-empresa-create:** la migración 067 sembró sólo empresas
   existentes. Las nuevas (post-20.3) NO tienen los flujos del sistema
   automáticamente. 20.5 (o sub-PR posterior) debe agregar trigger
   `AFTER INSERT ON empresas` o lógica en el endpoint de crear empresa.

### Cambio de comportamiento esperado en 20.5

Los flujos del sistema cierran TODAS las actividades vinculadas a la
entidad disparadora (vía `relacionada_a`) sin importar el campo
`evento_auto_completar` del tipo de actividad. **Esto cambia el
comportamiento vs el helper legacy**, que sólo cerraba si el tipo
tenía `evento_auto_completar` configurado para ese evento específico.

Tres caminos posibles a votar en el plan de 20.5:

- **(a) Cambio brusco aceptado** — los flujos del sistema cierran
  todas. Empresas con tipos de actividad que tenían
  `evento_auto_completar = null` van a empezar a ver auto-cierre
  automático. La granularidad por tipo se pierde para los flujos del
  sistema; la empresa que la quiera usa flujos personalizados.

- **(b) Sembrar 1 flujo por tipo de actividad con `evento_auto_completar`
  seteado.** Granularidad preservada al costo de exploding seed
  (empresa con 5 tipos `al_enviar` = 5 flujos sembrados).

- **(c) Extender `completar_actividad.criterio` con `tipo_actividad_ids:
  string[]`** (multi-tipo). Sembrar un flujo por evento que filtra por
  el set de tipos con `evento_auto_completar` correspondiente.

Decisión del coordinador para el plan de 20.5.

---

## 2026-05-08 — Sub-PR 20.2 cerrado: actividades_relaciones + auto-enriquecimiento

Hash: `f7b4438`. Tabla N:M. Auto-enriquecimiento desde `crear_actividad`.
Resolver real de `relacionada_a`. Stub `PendienteSubPR20_2` eliminado.

## 2026-05-08 — Sub-PR 20.1 cerrado: acción completar_actividad

Hash: `f372a78`. Catálogo de acción + type guard + executor + dry-run +
validador con D1 caveat + tests + i18n.

## 2026-05-07 — PR 19 cerrado: UI completa de Flujos

Mergeado a `main` en commit `e3349d0`. Listado, editor visual, panel de
edición, validación tiempo real, sandbox dry-run, historial, sección
por módulo + plantillas curadas. 1365 tests verde al cierre.

## 2026-05-05 — Backend del motor (PR 13-18) cerrado

Schema + dispatcher + worker + variables + triggers tiempo + CRUD +
transiciones + ejecuciones + duplicar.
