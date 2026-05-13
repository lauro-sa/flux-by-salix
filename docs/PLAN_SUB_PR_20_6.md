# Sub-PR 20.6 — Drop `actividades.vinculos jsonb` + refactor consumidores

**Estado**: PENDIENTE (plan documentado el 2026-05-11, post-merge del PR 20).
**Tipo**: PR independiente. NO es sub-PR del PR 20 (que ya cerró en `77e5299`).
**Branch sugerida**: `feat/flujos-vinculos-relaciones`.
**Dependencias**: PR 20 mergeado (provee `actividades_relaciones`).

---

## 1. Contexto del refactor

El PR 20 (mergeado el 2026-05-11) creó la tabla `actividades_relaciones` con shape N:M para vincular actividades con cualquier entidad (presupuesto, visita, contacto, etc.). El auto-enriquecimiento y el resolver de `completar_actividad.criterio.relacionada_a` ya usan esta tabla.

Pero `actividades.vinculos jsonb` (legacy) sigue vivo: 10+ archivos consumidores lo leen/escriben directamente. Mantener ambas representaciones es deuda — eventualmente divergen y aparecen bugs sutiles.

**Objetivo del 20.6**: migrar todos los consumidores a `actividades_relaciones` + dropear `vinculos` y `vinculo_ids` de `actividades`.

**NO se toca**: `visitas.vinculos` ni `eventos_calendario.vinculos`. Son tablas independientes, fuera del scope.

---

## 2. Shape actual vs nuevo

### Shape actual (`actividades.vinculos`)

```ts
type VinculoLegacy = {
  tipo: 'contacto' | 'presupuesto' | 'visita' | 'orden' | 'conversacion' | ...
  id: string  // UUID de la entidad vinculada
  nombre: string  // Cacheado para mostrar sin JOIN
}

// En BD:
actividades.vinculos    jsonb NOT NULL DEFAULT '[]'    // Array de VinculoLegacy
actividades.vinculo_ids text[] NOT NULL DEFAULT '{}'   // Paralelo, solo IDs para queries
```

### Shape nuevo (`actividades_relaciones`)

```sql
CREATE TABLE actividades_relaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  actividad_id uuid NOT NULL REFERENCES actividades ON DELETE CASCADE,
  entidad_tipo text NOT NULL,  -- 'contacto', 'presupuesto', 'visita', etc.
  entidad_id uuid NOT NULL,
  creado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now()
  -- UNIQUE (empresa_id, actividad_id, entidad_tipo, entidad_id)
)
```

**Decisión clave a tomar en el sub-PR 20.6**:

### D1 — ¿Cachear nombre o JOIN?

- **Opción A (recomendada)**: agregar columna `entidad_nombre text` a `actividades_relaciones`. Mantiene paridad con `vinculos.nombre` (lectura rápida sin JOIN). Sync flow idéntico (al renombrar contacto, UPDATE relaciones SET entidad_nombre).
- **Opción B**: NO cachear, JOIN a la entidad al renderizar. Schema más limpio, lectura más lenta, más queries.

**Voto**: A. Razón: el sync de contactos ya está implementado para `vinculos`; replicarlo a `actividades_relaciones` con columna `entidad_nombre` mantiene el mismo flow sin cambios algorítmicos. Opción B obligaría a refactorizar todos los SELECT para incluir JOIN (más cambio del estrictamente necesario).

Migración SQL:
```sql
ALTER TABLE actividades_relaciones
  ADD COLUMN IF NOT EXISTS entidad_nombre text;

-- Backfill desde vinculos actuales
UPDATE actividades_relaciones ar
SET entidad_nombre = v.nombre
FROM actividades a, jsonb_array_elements(a.vinculos) AS elem,
     LATERAL (SELECT
       elem->>'tipo' AS tipo,
       (elem->>'id')::uuid AS id,
       elem->>'nombre' AS nombre
     ) v
WHERE a.id = ar.actividad_id
  AND v.tipo = ar.entidad_tipo
  AND v.id = ar.entidad_id;
```

---

## 3. Blast radius detallado

**Total**: 28 archivos con refs a `vinculos`, de los cuales:
- **14 son de `actividades.vinculos`** (target del refactor).
- **3 son de `eventos_calendario.vinculos`** (fuera de scope).
- **3 son de `visitas.vinculos`** (fuera de scope).
- **8 son tipos/i18n/database.types** (auto-derivados o tocados con i18n).

### Top archivos a refactorizar (priorizados por refs)

| # | Archivo | Refs | Qué hace | Riesgo |
|---|---|---|---|---|
| 1 | `src/app/(flux)/actividades/_componentes/ModalActividad.tsx` | 22 | UI principal: state local de vinculos, picker, render | 🔴 Alto |
| 2 | `src/app/api/actividades/[id]/route.ts` | 18 | PATCH/GET: lee+escribe vinculos | 🔴 Alto |
| 3 | `src/app/(flux)/actividades/_componentes/ContenidoActividades.tsx` | 8 | Listado: muestra chips de vinculos | 🟡 Medio |
| 4 | `src/componentes/entidad/_panel_chatter/EntradaTimeline.tsx` | 7 | Renderiza entradas de chatter con menciones a vinculos | 🟡 Medio |
| 5 | `src/app/api/actividades/route.ts` | 6 | POST: escribe vinculos | 🟡 Medio |
| 6 | `src/lib/salix-ia/herramientas/ejecutores/consultar-actividades.ts` | 4 | SELECT + filtro `vinculos::text.ilike` + lectura `.find(v => v.tipo === ...)` | 🟡 Medio |
| 7 | `src/lib/salix-ia/herramientas/ejecutores/crear-actividad.ts` | 4 | Construye vinculos[] al crear | 🟢 Bajo |
| 8 | `src/componentes/entidad/PanelChatter.tsx` | 4 | Renderiza menciones | 🟡 Medio |
| 9 | `src/componentes/entidad/ModalVistaActividad.tsx` | 4 | Vista de actividad (sin edición) | 🟡 Medio |
| 10 | `src/app/api/contactos/[id]/route.ts` | 4 | Sync `vinculos.nombre` al renombrar contacto | 🔴 Crítico |

### Patrones de uso detectados

**Pattern 1 — Construir vinculos al crear**:
```ts
const vinculos: { tipo, id, nombre }[] = []
const vinculo_ids: string[] = []

if (params.contacto_id) {
  // Fetch contacto, push vinculo
  vinculos.push({ tipo: 'contacto', id, nombre })
  vinculo_ids.push(id)
}

await admin.from('actividades').insert({ ...todos los campos..., vinculos, vinculo_ids })
```

**Reemplazo**: post-INSERT a `actividades`, hacer batch INSERT a `actividades_relaciones`.

**Pattern 2 — Filtro con `vinculos::text.ilike`** (Salix IA):
```ts
query = query.or(`titulo.ilike.%${busq}%,vinculos::text.ilike.%${busq}%`)
```

**Reemplazo**: hacer pre-query a `actividades_relaciones` con `entidad_nombre ILIKE %X%`, después filtrar IDs. O usar PostgREST embed query si soporta.

**Pattern 3 — Lectura `.find(v => v.tipo === 'X')`**:
```ts
const contactoNombre = vinculos.find(v => v.tipo === 'contacto')?.nombre
```

**Reemplazo**: pre-fetch de relaciones por actividad agrupadas por tipo:
```ts
const { data: relaciones } = await admin
  .from('actividades_relaciones')
  .select('actividad_id, entidad_tipo, entidad_id, entidad_nombre')
  .in('actividad_id', actividadIds)
  .eq('empresa_id', empresaId)

const relsPorActividad = groupBy(relaciones, 'actividad_id')
// Después: relsPorActividad[act.id]?.find(r => r.entidad_tipo === 'contacto')?.entidad_nombre
```

**Pattern 4 — Sync de nombre al renombrar contacto** (`api/contactos/[id]/route.ts:555`):
```ts
const { data: actividades } = await admin
  .from('actividades')
  .select('id, vinculos')
  .contains('vinculo_ids', [contactoId])

for (const act of actividades) {
  // Mutar vinculos[].nombre
  // UPDATE actividades SET vinculos = nuevoArray
}
```

**Reemplazo**:
```ts
await admin
  .from('actividades_relaciones')
  .update({ entidad_nombre: nombreCompleto })
  .eq('empresa_id', empresaId)
  .eq('entidad_tipo', 'contacto')
  .eq('entidad_id', contactoId)
```

**Más simple que el actual**. Bien.

**Pattern 5 — UI ModalActividad state**:
- State local `vinculos[]` que el user edita con un picker.
- Al guardar, PATCH a `/api/actividades/[id]` con body.vinculos.
- Render: chips con nombre clickeables.

**Reemplazo**:
- State local sigue siendo `vinculos[]` (UI no cambia).
- Al guardar, PATCH ahora hace upsert/delete en `actividades_relaciones` desde el backend.
- Al cargar, GET hace pre-query a `actividades_relaciones` y devuelve `vinculos` shape adaptado (para no romper el componente).

**Estrategia adaptador**: el endpoint GET sigue devolviendo `vinculos: [{tipo, id, nombre}]` shape pero construido desde `actividades_relaciones`. La UI no necesita cambiar. Bajo riesgo.

---

## 4. Plan de commits internos (8 commits — actualizado tras H2)

> **Nota:** la versión original del plan tenía 6 commits. Tras el barrido completo de
> consumidores durante la ejecución (Hallazgo H2, ver §12), se descubrió que el plan
> §5 original subestimaba el blast radius en 6 archivos. La tabla revisada queda:
>
> | # | Commit | Archivos principales |
> |---|---|---|
> | 1 | Migración SQL (070+071): `entidad_nombre` + backfill + resync legacy | `sql/070_*.sql`, `sql/071_*.sql` |
> | 2 | Backend POST/PATCH/GET actividades | `api/actividades/route.ts`, `api/actividades/[id]/route.ts` |
> | 3 | Motor `executor.ts` (escritura + lectura) + mocks de tests del motor | `lib/workflows/executor.ts`, `lib/__tests__/workflows-executor-completar-actividad.test.ts` |
> | 4 | Backend contactos completo (sync + enriquecimiento + filtros) | `api/contactos/[id]/route.ts`, `api/contactos/route.ts`, `lib/enriquecer-contactos.ts` |
> | 5 | Salix IA (consultar + crear) | `lib/salix-ia/herramientas/ejecutores/consultar-actividades.ts`, `…/crear-actividad.ts` |
> | 6 | Frontend UI (ModalActividad + chatter + listado + vista) | 5 archivos del plan §5 |
> | — | **PAUSA — usuario commitea WIP completo a main** | — |
> | 7 | Refactor `visitas-sync.ts` + `presupuestos/enriquecer-listado.ts` (post-rebase sobre main con WIP) | 2 archivos del WIP del usuario |
> | 8 | Drop columnas legacy + regen `database.types.ts` | `sql/072_*.sql`, `src/db/esquema.ts`, `src/db/database.types.ts` |

### Commit 1 — Migración SQL: `actividades_relaciones.entidad_nombre` + backfill

**Archivo nuevo**: `sql/070_actividades_relaciones_entidad_nombre.sql`

**Contenido**:
```sql
-- Paso 1: Agregar columna entidad_nombre
ALTER TABLE actividades_relaciones
  ADD COLUMN IF NOT EXISTS entidad_nombre text;

-- Paso 2: Backfill desde vinculos jsonb (idempotente)
UPDATE actividades_relaciones ar
SET entidad_nombre = elem.nombre
FROM actividades a,
     jsonb_array_elements(a.vinculos) AS v,
     LATERAL (SELECT
       v->>'tipo' AS tipo,
       (v->>'id')::uuid AS id,
       v->>'nombre' AS nombre
     ) elem
WHERE a.id = ar.actividad_id
  AND elem.tipo = ar.entidad_tipo
  AND elem.id = ar.entidad_id
  AND ar.entidad_nombre IS NULL;

-- Paso 3: Backfill de relaciones faltantes (actividades con vinculos pero sin filas en relaciones)
INSERT INTO actividades_relaciones
  (empresa_id, actividad_id, entidad_tipo, entidad_id, entidad_nombre, creado_por, creado_en)
SELECT
  a.empresa_id,
  a.id AS actividad_id,
  v->>'tipo' AS entidad_tipo,
  (v->>'id')::uuid AS entidad_id,
  v->>'nombre' AS entidad_nombre,
  a.creado_por,
  a.creado_en
FROM actividades a, jsonb_array_elements(a.vinculos) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM actividades_relaciones ar
  WHERE ar.empresa_id = a.empresa_id
    AND ar.actividad_id = a.id
    AND ar.entidad_tipo = v->>'tipo'
    AND ar.entidad_id = (v->>'id')::uuid
);

COMMENT ON COLUMN actividades_relaciones.entidad_nombre IS
  'Nombre cacheado de la entidad vinculada (mismo patrón que vinculos.nombre legacy). Se sincroniza al renombrar la entidad — ver api/contactos/[id]/route.ts.';
```

Verificar via MCP: `SELECT count(*) FROM actividades_relaciones WHERE entidad_nombre IS NOT NULL` debe matchear `SELECT count(*) FROM actividades_relaciones`.

### Commit 2 — Backend: refactor POST/PATCH/GET de actividades

**Archivos**:
- `src/app/api/actividades/route.ts` (POST)
- `src/app/api/actividades/[id]/route.ts` (PATCH + GET)

**Cambios POST**:
- Después del INSERT a `actividades`, hacer batch INSERT a `actividades_relaciones` por cada item de `body.vinculos`.
- Setear `entidad_nombre` con el nombre que viene del body (o pre-fetch del contacto si solo viene id).
- Eliminar `vinculos` y `vinculo_ids` del INSERT a `actividades`.

**Cambios PATCH**:
- Recibir body.vinculos (UI no cambia).
- Diff con el estado actual de `actividades_relaciones`:
  - Nuevos: INSERT.
  - Eliminados: DELETE.
  - Modificados (nombre): UPDATE.
- Eliminar `.update({ vinculos })` del UPDATE a `actividades`.

**Cambios GET**:
- LEFT JOIN a `actividades_relaciones` agrupado.
- Construir shape `vinculos: [{tipo: entidad_tipo, id: entidad_id, nombre: entidad_nombre}]` desde las filas.
- Devolver mismo shape que antes (compat UI).

**Tests**: cubrir
- POST con vinculos crea relaciones.
- PATCH agregando vinculo: diff produce INSERT.
- PATCH eliminando vinculo: diff produce DELETE.
- PATCH cambiando nombre: diff produce UPDATE.
- GET devuelve vinculos en shape legacy.

### Commit 3 — Backend: sync nombre al renombrar contacto

**Archivo**: `src/app/api/contactos/[id]/route.ts`

**Cambio**: reemplazar el for-loop de actualización jsonb por un UPDATE directo a `actividades_relaciones`:

```ts
await admin
  .from('actividades_relaciones')
  .update({ entidad_nombre: nombreCompleto })
  .eq('empresa_id', empresaId)
  .eq('entidad_tipo', 'contacto')
  .eq('entidad_id', contactoId)
```

Más simple y rápido que el for-loop actual.

**Tests**:
- Renombrar contacto → todas las relaciones con ese contacto reflejan nuevo nombre.
- Multi-tenant: solo afecta relaciones de la empresa correcta.

### Commit 4 — Salix IA: refactor consultas

**Archivos**:
- `src/lib/salix-ia/herramientas/ejecutores/consultar-actividades.ts`
- `src/lib/salix-ia/herramientas/ejecutores/crear-actividad.ts`

**Cambios consultar-actividades**:
- Quitar `vinculos` del SELECT a `actividades`.
- Reemplazar filtro `vinculos::text.ilike.%X%` por pre-query a `actividades_relaciones` con `entidad_nombre ILIKE %X%`, luego filtrar IDs en query principal.
- Hacer pre-query a `actividades_relaciones` por las actividades del resultado, agrupar por actividad_id.
- Construir `contacto_vinculado`, `presupuesto_vinculado` desde las relaciones agrupadas.

**Cambios crear-actividad**:
- Construir `vinculos` array igual que antes (UI no cambia).
- Después del INSERT a `actividades`, hacer batch INSERT a `actividades_relaciones`.
- Eliminar `vinculos` y `vinculo_ids` del INSERT a `actividades`.

**Tests**:
- Consultar con búsqueda matchea contactos vinculados.
- Crear actividad con contacto_id genera relación.
- Listar actividades devuelve contacto_vinculado correcto.

### Commit 5 — Frontend: ModalActividad + ContenidoActividades + chatter

**Archivos**:
- `src/app/(flux)/actividades/_componentes/ModalActividad.tsx` (22 refs)
- `src/app/(flux)/actividades/_componentes/ContenidoActividades.tsx` (8 refs)
- `src/componentes/entidad/_panel_chatter/EntradaTimeline.tsx` (7 refs)
- `src/componentes/entidad/PanelChatter.tsx` (4 refs)
- `src/componentes/entidad/ModalVistaActividad.tsx` (4 refs)

**Estrategia**: dado que el endpoint GET ya devuelve `vinculos` en shape legacy (commit 2), estos componentes NO requieren cambios funcionales. Solo:

- Eliminar referencias al campo `vinculo_ids` (deprecated tras commit 2).
- Verificar que ningún componente escribe directamente `vinculos` a la BD (todo va via API).
- Test de no-regresión visual.

**Caveat crítico**: validar visualmente en preview de Vercel.

### Commit 6 — Migración SQL final: drop columnas legacy + sync esquema TS

**Archivo nuevo**: `sql/071_drop_actividades_vinculos.sql`

**Contenido**:
```sql
-- =============================================================
-- Migración 071: Drop legacy vinculos + vinculo_ids
-- =============================================================
-- Después de los commits 2-5 del sub-PR 20.6, todos los consumidores
-- (POST/PATCH/GET, Salix IA, sync contactos, UI) usan
-- actividades_relaciones. Las columnas legacy ya no se leen ni escriben.
--
-- Verificación pre-DROP: grep -r "\.vinculos\|vinculos:" src/ debe
-- devolver SOLO matches en visitas.vinculos, eventos_calendario.vinculos,
-- y comentarios históricos.
-- =============================================================

ALTER TABLE actividades
  DROP COLUMN IF EXISTS vinculos,
  DROP COLUMN IF EXISTS vinculo_ids;
```

**También en este commit**:
- `src/db/esquema.ts`: remover los 3 campos `vinculos`/`vinculo_ids` de la tabla `actividades`.
- Regenerar `src/db/database.types.ts` via MCP.

---

## 5. Casos edge identificados

### CE-1 — Actividades con vinculos pero sin filas en actividades_relaciones

Posible si: el auto-enriquecimiento del 20.2 fue después de que algunas actividades ya tenían vinculos. El commit 1 (backfill INSERT) maneja esto.

### CE-2 — Actividades sin vinculos (vinculos = `[]`)

Trivial: 0 filas en relaciones. El endpoint GET devuelve `vinculos: []`. Sin breaking change.

### CE-3 — vinculos con `nombre` desactualizado

Si el contacto fue renombrado antes de la migración pero el sync de contactos no propagó: el backfill copia el nombre desactualizado. **Mitigación**: post-backfill, correr un re-sync masivo de nombres desde la tabla `contactos`:

```sql
UPDATE actividades_relaciones ar
SET entidad_nombre = TRIM(c.nombre || ' ' || COALESCE(c.apellido, ''))
FROM contactos c
WHERE ar.entidad_tipo = 'contacto'
  AND ar.entidad_id = c.id
  AND ar.empresa_id = c.empresa_id;
```

Incluir como Paso 4 opcional del commit 1.

### CE-4 — vinculos con `tipo` no soportado por `EntidadRelacionable`

`EntidadRelacionable` en TS define un set cerrado (`contacto, presupuesto, orden, visita, conversacion, asistencia, cuota, actividad, adelanto_nomina, pago_nomina`). Si `vinculos` legacy tiene tipos fuera de esa lista (raro pero posible si el shape no se validaba), el backfill los ignora.

**Verificación pre-commit**:
```sql
SELECT DISTINCT elem->>'tipo' AS tipo
FROM actividades, jsonb_array_elements(vinculos) elem
WHERE elem->>'tipo' NOT IN ('contacto', 'presupuesto', 'orden', 'visita', 'conversacion', 'asistencia', 'cuota', 'actividad', 'adelanto_nomina', 'pago_nomina');
```

Si devuelve filas, decidir caso por caso (extender `EntidadRelacionable` o ignorar).

### CE-5 — Búsqueda full-text de Salix IA con caracteres especiales

`vinculos::text.ilike.%X%` matcheaba texto raw en jsonb. Caracteres especiales como comillas o slashes podían matchear sin escape. El reemplazo con `entidad_nombre ILIKE %X%` solo busca en nombre. Si Salix IA dependía de matchear shape jsonb completo, hay regresión.

**Mitigación**: revisar uso real de Salix IA con queries de búsqueda. Probablemente solo matchea nombres, sin issue.

### CE-6 — Concurrent edits

Si 2 users editan la misma actividad simultáneamente, los diffs de vinculos pueden chocar. Esto YA pasa con vinculos legacy (last-write-wins). No regresión.

---

## 6. Tests requeridos

### Backend (commits 2-4)

- POST actividad con vinculos → relaciones creadas.
- POST actividad sin vinculos → 0 relaciones.
- PATCH agregar vinculo → INSERT a relaciones.
- PATCH eliminar vinculo → DELETE de relaciones.
- PATCH cambiar nombre vinculo → UPDATE en relaciones.
- GET actividad devuelve vinculos en shape legacy.
- GET listado con búsqueda matchea por entidad_nombre.
- Multi-tenant: empresa A no ve relaciones de B.
- Salix IA crear-actividad con contacto_id → relación contacto creada.
- Salix IA consultar-actividades busca por nombre del contacto vinculado.
- Sync contactos: renombrar → UPDATE masivo a relaciones (entidad_nombre actualizado).

### Frontend (commit 5)

- ModalActividad render con vinculos legacy → sin regresión visual.
- ModalActividad agregar/quitar vinculo → PATCH correcto.
- Chatter timeline muestra menciones a vinculos.

### Migración (commit 6)

- Migración 070 idempotente: re-correr no rompe.
- Backfill cubre 100% de vinculos legacy.
- Migración 071 dropea columnas, vista flujos_con_estadisticas sigue funcionando (no las usa).

---

## 7. Validación visual (requiere browser)

**OBLIGATORIO antes del commit 6 (drop final)**:

1. Abrir actividad existente con vinculos en preview de Vercel.
2. Verificar que se renderizan chips de contactos/presupuestos.
3. Agregar un vinculo nuevo, guardar, recargar página → vinculo sigue ahí.
4. Quitar un vinculo, guardar, recargar → vinculo desaparece.
5. Renombrar un contacto → actividad refleja nuevo nombre al recargar.
6. Salix IA: pedir "actividades con contacto X" → devuelve resultados correctos.
7. Salix IA: crear actividad vinculada a un contacto → contacto aparece en la actividad.
8. Chatter de presupuesto: las actividades creadas aparecen como entradas con menciones correctas.

**Sin pasar estos 8 puntos, NO mergear el sub-PR 20.6 a main.**

---

## 8. Procedimiento de rollback

Si el sub-PR rompe producción:

1. **Rollback código**: `git revert <merge-sha>` del PR del 20.6 + push.
2. **Rollback BD**: crear migración inversa `sql/072_rollback_vinculos.sql`:
   ```sql
   -- Restaurar columnas
   ALTER TABLE actividades
     ADD COLUMN IF NOT EXISTS vinculos jsonb NOT NULL DEFAULT '[]',
     ADD COLUMN IF NOT EXISTS vinculo_ids text[] NOT NULL DEFAULT '{}';

   -- Backfill vinculos desde actividades_relaciones (reverso del commit 1)
   UPDATE actividades a
   SET vinculos = (
     SELECT jsonb_agg(jsonb_build_object(
       'tipo', ar.entidad_tipo,
       'id', ar.entidad_id,
       'nombre', ar.entidad_nombre
     ))
     FROM actividades_relaciones ar
     WHERE ar.actividad_id = a.id
   );

   -- Backfill vinculo_ids
   UPDATE actividades a
   SET vinculo_ids = (
     SELECT array_agg(ar.entidad_id::text)
     FROM actividades_relaciones ar
     WHERE ar.actividad_id = a.id
   );
   ```
3. **NO eliminar** la columna `actividades_relaciones.entidad_nombre` en el rollback — sirve a otros usos (auto-enriquecimiento del 20.2 puede haber escrito ahí).

---

## 9. Convenciones para el chat ejecutor

- **R1 NO aplica** (PR 20 ya cerró). Acá podés modificar tests existentes del motor si fuera necesario, aunque preferible NO tocar tests del PR 14-20 sin razón fuerte.
- **Working tree del usuario**: probablemente con WIP (visita_id, condicion_pago, etc.). Usar stash + 3way igual que en el PR 20.
- **Branch nueva**: `feat/flujos-vinculos-relaciones` desde `main`.
- **Push y PR vía gh CLI**: el sistema tiene gh instalado en `/Users/sal/bin/gh`, autenticado como `lauro-sa`.
- **Coordinación con coordinador**: si se decide reactivar modelo coordinador-ejecutores, pedir luz verde por commit. Si trabajás solo, sub-commits con tests verde antes de cada uno.
- **Migración SQL aplicar via**: `mcp__supabase__apply_migration` (project_id `nfbjdlmnsmcmtvimjeuo`).
- **Edge Function**: NO se toca en el 20.6. La columna `actividades.vinculos` no la lee el motor.

---

## 10. Resumen ejecutivo

| Sección | Resumen |
|---|---|
| **Scope** | Drop `actividades.vinculos` jsonb + `vinculo_ids` text[]. Migrar 14 archivos consumidores. |
| **Strategy** | Adaptador en endpoint GET para preservar shape `vinculos[]` legacy en la respuesta. UI no cambia. |
| **Commits** | 6 internos (SQL + backend + sync + Salix IA + frontend + drop final). |
| **Riesgo** | Alto sin browser para validar UI. Recomendado: validar visualmente en preview antes del commit 6. |
| **Tiempo estimado** | 3-5 horas con validación visual extensiva. |
| **Bloqueante para producción?** | No. La feature funciona con vinculos legacy. Sub-PR limpia deuda técnica. |
| **Dependencias** | PR 20 mergeado (provee `actividades_relaciones`). |

---

## 11. Checklist final antes de cerrar 20.6

- [ ] Commit 1 (migración 070 + backfill) aplicada via MCP + verificada.
- [ ] Commit 2 (backend actividades) con tests verde.
- [ ] Commit 3 (sync contactos) con tests verde.
- [ ] Commit 4 (Salix IA) con tests verde.
- [ ] Commit 5 (frontend) sin cambios visuales aparentes.
- [ ] Validación visual de los 8 puntos del §7 en Vercel preview.
- [ ] Grep limpio: `grep -r "actividades\.vinculos\|vinculos:" src/` solo devuelve matches de visitas/eventos_calendario/comentarios.
- [ ] Commit 6 (drop SQL + sync TS) aplicado.
- [ ] PR a main con título `feat(flujos): drop actividades.vinculos jsonb + refactor consumidores (sub-PR 20.6)`.
- [ ] CHANGELOG_FLUJOS.md actualizado con cierre del 20.6.
- [ ] Memoria del proyecto (`project_workflows.md`) actualizada — quitar el item de "Sub-PR 20.6 pendiente" y agregar cierre con hash del merge.

---

**Generado por el coordinador el 2026-05-11 post-merge del PR 20 (hash `77e5299`).**

---

## 12. Hallazgo H2 — Blast radius extendido (descubierto durante ejecución)

**Fecha**: 2026-05-12, durante el barrido pre-Commit 2 del ejecutor.

**Resumen**: el grep completo de `actividades.vinculos` / `vinculos:` / `vinculo_ids` reveló 6 archivos críticos no anticipados en el §5 original. El plan se rebalanceó de 6 a 8 commits para cubrir el motor del PR 20 + el listado de contactos + dos archivos del WIP del usuario.

### 12.1 Archivos no anticipados en plan §5

| # | Archivo | Riesgo | Commit asignado |
|---|---|---|---|
| 1 | `src/lib/workflows/executor.ts` | 🔴 Crítico — motor del PR 20: lee `vinculo_ids` para `completar_actividad`, escribe `vinculos`+`vinculo_ids` al crear actividad desde flow | 3 |
| 2 | `src/lib/enriquecer-contactos.ts` | 🔴 Listado de contactos: agrupa actividades pendientes por contacto via `vinculo_ids` con `.filter('vinculo_ids', 'ov', '{…}')` | 4 |
| 3 | `src/app/api/contactos/route.ts` | 🔴 Filtros `con_pendientes`/`sin_pendientes` agg `vinculo_ids` para listado de contactos | 4 |
| 4 | `src/lib/visitas-sync.ts` | 🟡 WIP del usuario, MODIFICADO: INSERT/UPDATE de actividad vinculada a visita con `vinculos`+`vinculo_ids` | 7 (post-PAUSA) |
| 5 | `src/lib/presupuestos/enriquecer-listado.ts` | 🟡 WIP del usuario, NUEVO untracked: enriquece listado de presupuestos con actividades pendientes via `vinculo_ids` | 7 (post-PAUSA) |
| 6 | `src/lib/__tests__/workflows-executor-completar-actividad.test.ts` | 🟡 Mocks de actividad con `vinculo_ids`. Hay que actualizar el shape | 3 (junto con motor) |

### 12.2 Justificación de la PAUSA antes del Commit 7

Los archivos del WIP del usuario (`visitas-sync.ts` modificado + `presupuestos/enriquecer-listado.ts` nuevo untracked) NO pueden refactorizarse sin colisionar con su trabajo en progreso. `git apply --3way` resuelve adjacentes pero NO archivos nuevos untracked. La estrategia: ejecutar commits 2-6, pausar, pedir al usuario commitear su WIP completo a main, rebasear la branch, y recién después ejecutar commits 7 y 8.

### 12.3 Validación visual del §7

La validación visual se hace **después del Commit 8** (drop final), no después del 6 como sugería el plan original. Durante el período entre Commit 6 y Commit 8, el preview de Vercel mostrará inconsistencias para los flujos de visitas y listado de presupuestos — esto es esperable.

### 12.4 Deudas externas anotadas durante el 20.6

- Migración `20260512230114_ordenes_trabajo_direccion_coords` aplicada en BD pero sin archivo en `sql/`. Es WIP del usuario, fuera de scope del 20.6, debe quedar INTACTA. El usuario decide cuándo volcarla a `sql/` al commitear su WIP.

---

**Hallazgo H2 documentado por el ejecutor el 2026-05-12 con voto del coordinador.**
