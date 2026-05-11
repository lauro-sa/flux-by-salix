# CHANGELOG — Módulo Flujos

Historia de cambios del motor de workflows y los flujos del sistema.
Sub-PRs numerados en orden cronológico. Para cada uno: qué cambia,
qué reemplaza, qué deuda queda.

---

## PR 20 — Cierre del helper legacy `auto-completar-actividad`

**Fecha:** 2026-05 · **Estado:** mergeado (al cerrar este sub-PR).

Reemplaza el helper TS `src/lib/auto-completar-actividad.ts` (que
acoplaba la lógica de auto-cierre de actividades a 4 endpoints de
presupuestos/visitas) por **flujos del sistema** sembrados por empresa.
La lógica deja de vivir en código duro y pasa a ser configuración:
el admin puede ver, editar o desactivar cada flujo desde el editor.

Plan: 5 sub-PRs in-branch + 1 sub-PR independiente post-merge (20.6
para `actividades.vinculos` jsonb).

### Sub-PRs internos

#### 20.1 — Acción `completar_actividad` con criterio runtime
- Nuevo tipo `AccionCompletarActividad` con criterio polimórfico
  (`tipo_actividad_id` o `relacionada_a` + opciones `si_multiple` /
  `si_no_encuentra`).
- Handler en el executor + tests unitarios.

#### 20.2 — `actividades_relaciones` + auto-enriquecimiento + resolver
- Nueva tabla `actividades_relaciones` (N:M actividad ↔ entidad
  polimórfica) con UNIQUE (empresa_id, actividad_id, entidad_tipo,
  entidad_id).
- `crear_actividad` registra la relación al disparar el flujo
  (auto-enriquecimiento desde el contexto disparador).
- `completar_actividad.relacionada_a` resuelve via la tabla nueva.

#### 20.3 — Backfill + seed pausado
- Backfill de `actividades_relaciones` desde el legacy
  `actividad_origen_id` (presupuestos + visitas).
- Seed de 2 flujos del sistema por empresa, en `estado='pausado'`
  para evitar doble-disparo con el helper legacy aún vivo:
  - `autocompletar_al_enviar_presupuesto`
  - `autocompletar_al_finalizar_visita`
- Columna `flujos.clave_sistema` con UNIQUE parcial.

#### 20.4 — Panel UI dedicado + plantillas curadas
- Panel UI específico para configurar la acción `completar_actividad`
  desde el editor de Flujos.
- Plantillas curadas (sugerencias) para que el admin parta de un
  shape válido.

#### 20.5 — Cierre del ciclo (7 commits internos)

| Commit | Hash | Resumen |
|---|---|---|
| 1 | `d302429` | Motor: `solo_creacion?: boolean` en `entidad.estado_cambio` (semántica explícita para distinguir creación de re-transición — H10.C). Edge Function `dispatcher-workflows` v8 deployada. 2 flujos `al_crear` agregados al catálogo. |
| 2 | `553e171` | Migrar 4 handlers (POST/PATCH presupuestos+visitas) de `actividad_origen_id` legacy a `actividades_relaciones`. |
| 3 | `3169daa` | Eliminar `evento_auto_completar` de UI/API + cartel informativo en editor de tipo. |
| 4 | `226d155` | Migración SQL 068: triggers ON INSERT, activar flujos sembrados, sembrar `al_crear`, DROP COLUMN. Sync esquema TS limitado al scope. |
| 5 | `cfc26c8` | Eliminar helper legacy `auto-completar-actividad.ts`. |
| 6 | `285eb73` | `sembrarFlujosSistema(admin, empresaId)` + hook en `POST /api/empresas/crear`. Catálogo unificado activo. |
| 7 | (este) | Test cross-flujo end-to-end + CHANGELOG. |

### Decisiones arquitectónicas relevantes

**H10.C — `solo_creacion?: boolean`** (commit 1): el motor del PR 14
interpretaba `desde_clave=null/undefined` como "matchea cualquier
estado_anterior". Para distinguir creación (estado_anterior IS NULL)
de re-transición a un estado inicial, se agregó el flag
`solo_creacion`. Backcompat 100% con flujos custom existentes.

**D1.b — `entidad.creada` via cambios_estado** (en lugar de Database
Webhook directo): los triggers SQL ON INSERT escriben a
`cambios_estado` con `estado_anterior=NULL`. Reusa el webhook +
dispatcher + idempotencia ya existentes desde el PR 14.

**D2 — Cambio brusco con paridad funcional**: en lugar de migrar
gradualmente el campo `evento_auto_completar`, se reemplazó por flujos
sembrados activos. Empresa con `evento_auto_completar='al_crear'`
configurado pierde la columna pero recibe el flujo sembrado equivalente
sin intervención manual.

**D3 — `actividades.vinculos` jsonb fuera de scope**: el refactor
(UI ModalActividad + Salix IA + notificaciones, ~50 referencias) se
movió a sub-PR 20.6 independiente post-merge a main. Mantiene el
scope del PR 20 acotado.

**C-seed-2 voto A — Catálogo unificado activo** (commit 6): el campo
`estado_inicial` se restringió al literal `'activo'`. Empresas nuevas
reciben el comportamiento "moderno" sin pasar por el estado pausado
que las migradas tuvieron temporalmente.

### Verificación E2E (commit 4)

Aplicada via `mcp__supabase__apply_migration` en flux-dev:
- ✅ 4 flujos del sistema activos (`al_crear_*` + `al_enviar` +
  `al_finalizar`).
- ✅ 3 columnas dropeadas (`presupuestos.actividad_origen_id`,
  `visitas.actividad_origen_id`, `tipos_actividad.evento_auto_completar`).
- ✅ 2 triggers nuevos creados (`*_registrar_creacion`).
- ✅ INSERT prueba: trigger escribió `cambios_estado` con
  `estado_anterior=NULL`.
- ✅ Dispatcher + matcher: matchearon `autocompletar_al_crear_presupuesto`
  con `solo_creacion=true`.
- ⚠️ Worker: rebotó la acción con `AccionInvalida` — esperable
  (ver C-mig-7/C-mig-9 abajo).
- Test cross-flujo (commit 7): cubre el end-to-end vía mocks SIN
  depender del worker.

### Bug evitado

**`flujos.activo` es generated column** (descubierto durante el
desarrollo del 20.5 commit 4 — mismo hallazgo que en el 20.3 commit
5709c99). La columna se deriva de `(estado = 'activo')`. Se eliminó de
UPDATE/INSERT del SQL antes de aplicar la migración 068. Cualquier
seed o UPDATE futuro debe respetar esta convención.

### Deudas acumuladas (no del scope del PR 20)

- **C-mig-7 — Verificación E2E parcial:** la verificación end-to-end
  vía MCP en flux-dev solo llegó hasta el matcher (worker pendiente
  de deploy). Cubierto por el test cross-flujo del commit 7.

- **C-mig-9 — Worker pendiente de deploy:** el worker en Vercel
  (corriendo el código de `main`, pre-PR 20) desconoce las acciones
  `crear_actividad` y `completar_actividad` introducidas en 20.1. Al
  mergear el PR 20 a main + redeploy de Vercel, el worker recibe el
  código nuevo. El estado de "fallado" observado en flux-dev durante
  el commit 4 es esperable y previsto.

- **C-mig-10 — Deuda diferida en `database.types.ts`:** la BD de
  flux-dev tiene cambios pre-existentes del WIP del usuario
  (`visita_id` en presupuestos + ordenes_trabajo, otras migraciones
  manuales) que no se reflejan en el TS checked-in. El generador
  moderno de Supabase también emite un nuevo campo `SetofOptions: {}`
  por tabla/función. Quedan fuera del PR 20 para mantener scope
  limpio (commit 4 solo eliminó las 4 columnas dropeadas, -23 líneas).
  La próxima regen post-merge del usuario sincronizará todo.

- **Deuda i18n — `PaginaEditorTipoActividad.tsx` hardcoded en
  español:** el cartel informativo agregado en commit 3 sigue el
  estilo del archivo (sin `useTraduccion`). Migrar la página entera
  a i18n queda como sub-PR aparte cuando se priorice multi-idioma
  para módulo configuración.

- **Deuda link `/flujos`:** el cartel del commit 3 apunta a `/flujos`
  plano. Sumar filtro `?clave_sistema=autocompletar_*` para que el
  link aterrice directo en el subset de flujos del sistema queda
  como sub-PR menor de UX post-merge.

- **Deuda cleanup comentarios motor:** `executor.ts:515,727` y
  `workflow.ts:318` aún mencionan el helper legacy
  (`auto-completar-actividad`, `evento_auto_completar`) como
  referencia histórica. Se dejan como están (documentan la transición
  para el lector futuro). Cleanup opcional cuando se priorice limpieza
  de legacy.

- **`actividades.vinculos` jsonb:** sub-PR 20.6 independiente
  post-merge a main. Refactor de UI (ModalActividad), Salix IA
  (consultar-actividades + crear-actividad), notificaciones. ~50
  referencias en ~10 archivos. Drop de la columna en migración 069
  cuando todo esté migrado.

### Procedimiento de rollback

Si el PR 20 rompe en producción después del merge:

1. **Revert del merge:**
   ```bash
   git revert -m 1 <merge-sha-del-pr-20>
   git push origin main
   ```

2. **Pausar los 4 flujos sembrados** (evita ejecuciones huérfanas
   contra código revertido):
   ```sql
   UPDATE flujos SET estado='pausado'
   WHERE clave_sistema IS NOT NULL;
   ```

3. **Restaurar columnas dropeadas** mediante migración inversa
   numerada `sql/069_rollback_flujos_pr20.sql` (a escribir cuando
   se necesite). Debe ser idempotente y NULL-safe:
   ```sql
   ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS actividad_origen_id uuid;
   ALTER TABLE visitas      ADD COLUMN IF NOT EXISTS actividad_origen_id uuid;
   ALTER TABLE tipos_actividad ADD COLUMN IF NOT EXISTS evento_auto_completar text;
   -- Re-poblar desde actividades_relaciones (preserva el historial):
   UPDATE presupuestos p
      SET actividad_origen_id = ar.actividad_id
     FROM actividades_relaciones ar
    WHERE ar.empresa_id = p.empresa_id
      AND ar.entidad_tipo = 'presupuesto'
      AND ar.entidad_id = p.id
      AND p.actividad_origen_id IS NULL;
   -- Idem para visitas.
   -- Re-instalar el helper legacy desde git history del PR 20.
   ```

4. **Redeploy Edge Function** con la versión pre-`solo_creacion` (la
   versión 7 está en el historial del MCP).

### Procedimiento de deploy post-merge

1. **Vercel:** deploy automático del frontend + backend al mergear
   a `main`. Verificar el deploy preview antes del merge si CI lo
   provee.

2. **Edge Function `dispatcher-workflows`:** redeploy manual via
   `mcp__supabase__deploy_edge_function` en flux-prod (ya está
   deployada en flux-dev como version 8). El código mirror del
   matcher con `solo_creacion` debe estar activo en prod ANTES de
   que la primera empresa cree un presupuesto/visita post-merge.

3. **Verificación post-deploy:** crear presupuesto de prueba en una
   empresa real y verificar via Supabase dashboard que:
   - `cambios_estado` recibe la fila con `estado_anterior=NULL`.
   - `ejecuciones_flujo` muestra una ejecución exitosa
     (`estado='completada'`) del flujo
     `autocompletar_al_crear_presupuesto`.

---

## PRs anteriores

Para historia previa al PR 20, ver commit history:
```bash
git log --oneline --grep="feat(flujos)\|feat(workflows)" main
```

Sub-PRs cubiertos:
- PR 14 — Motor de workflows fase 2 (dispatcher).
- PR 15.1 — Worker (executor + 4 acciones + endpoint Next).
- PR 16 — Enriquecimiento de contexto (resolver de variables).
- PR 17 — Disparadores time-driven (cron + relativo a campo).
- PR 18 — Validación + auditoría + listado avanzado.
- PR 19 — Editor visual + sandbox + plantillas + dry-run.
