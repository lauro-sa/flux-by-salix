# Implementación Tanda 1 — Features de Negocio Pendientes

> **Modo de operación: AUTÓNOMO.** No hay "chat coordinador". Vos hablás directo con Sebastián (Sal). Este documento es tu única fuente de verdad. No esperes a que otro chat te apruebe nada — las decisiones técnicas las tomás vos, las decisiones de negocio las consultás directo con Sal.

---

## 1. Tu misión

Sos un chat dedicado a implementar 4 features que actualmente son stubs vacíos en `main`. Sal (fundador de Flux by Salix) priorizó estas porque afectan la operación diaria de su empresa.

Las 4 features:
1. **Sembrar tareas en OT** desde un presupuesto.
2. **Sembrar relevamiento en OT** desde una visita.
3. **Secciones de Bitácora y Relevamiento** dentro de la vista de OT.
4. **Plantillas de WhatsApp** para avisos de recorrido (en camino / llegada).

Las 4 son independientes — podés hacerlas en orden o en paralelo. El orden sugerido está en §8.

---

## 2. Cómo operás (modo FULL autónomo)

Sal está cansado del ida y vuelta. **No le pidas validación visual, no le pidas votos, no le pidas luz verde para nada.** Tenés MCP de Supabase, gh CLI, typecheck, suite de tests completa, y este documento. Eso alcanza para operar solo.

### 2.1 Tu protocolo por feature
1. Investigar con MCP de Supabase (`list_tables`, `execute_sql` para SELECT).
2. Implementar el stub + tests unitarios.
3. **Verificar local**: `npx tsc --noEmit` debe pasar limpio. `npx vitest run` debe pasar la suite completa (no solo tus tests — la suite entera).
4. **Auto-review del código**: leé tu propio diff antes de commit. Buscá:
   - Tokens semánticos en lugar de colores hardcodeados.
   - Manejo de empresa_id en todas las queries.
   - Edge cases (vacío, duplicado, tipos desconocidos).
   - Sin imports muertos, sin `console.log`, sin TODOs colgados.
5. Commit + push.
6. `gh pr create --base main --head feat/<nombre>`.
7. Esperá que CI termine (`gh pr checks <num> --watch` si querés).
8. **Si CI pasa verde**: `gh pr merge <num> --squash --delete-branch`. Sin pedir validación.
9. Reportá a Sal en una línea: "Feature N mergeada. PR #X. Arranco N+1." Y arrancá la siguiente.

### 2.2 Decisiones que tomás vos sin preguntar (todo lo técnico)
- Nombres de variables, funciones, archivos, branches, commits.
- Estructura del código.
- Queries SQL.
- Tests.
- Idempotencia: por defecto **skip si ya existe** (no duplicar). Lo dejás documentado en chatter/log.
- Edge cases de UI: orden ASC por fecha, vacío con `EstadoVacio`, autor edita lo suyo, gestor edita todo.
- Rebases triviales sobre main.
- Mergear cuando typecheck + tests + suite completa pasan en CI.
- Migraciones DDL **no destructivas** (CREATE TABLE, ADD COLUMN NULL, ADD INDEX): las aplicás directo con `apply_migration` siguiendo convenciones del repo (RLS, auditoría, índices `(empresa_id, …)`).

### 2.3 Decisiones que SÍ requieren consulta a Sal (muy pocas)
Solo escribile en estos casos:
- **Migración destructiva** (DROP TABLE, DROP COLUMN, ALTER COLUMN destructivo, DELETE masivo).
- **Blocker técnico real** que no podés resolver después de 2-3 intentos: contexto + qué intentaste + hipótesis + qué necesitás.
- **Ambigüedad de producto crítica**: ej. "variables disponibles para plantilla WA al cliente" — si no podés inferirlo del código existente, preguntá con sugerencia + por qué + 2-3 opciones.

Para todo lo demás: decidí vos. Si te equivocás, Sal te lo dice en otro chat y lo arreglás.

### 2.4 Validación
Vos no tenés browser. **Reemplazás validación visual con**:
- Typecheck estricto verde.
- Suite de tests completa verde (no solo los tuyos).
- Lectura crítica del diff (auto-review).
- CI de GitHub Actions verde.

Si los 4 están OK, **mergeás directo**. Sal va a probar después en producción cuando tenga ganas; si encuentra algo, hace otro chat.

---

## 3. Restricciones duras

- **Estado actual del repo**: HEAD de main = `007ccdd` (commit que agregó este documento). Working tree debe estar limpio al arrancar cada feature.
- **Una branch por feature**: `feat/sembrar-tareas-ot`, `feat/sembrar-relevamiento-ot`, `feat/seccion-bitacora-relevamiento-ot`, `feat/plantilla-aviso-recorrido`.
- **Un PR por feature**: cada uno mergeado independiente. NO juntar features en un PR.
- **TypeScript estricto**: `npx tsc --noEmit` limpio antes de cada commit.
- **Tests obligatorios**: cada feature con su suite de tests unitarios.
- **Mantener firma actual del stub**: el caller ya está usando una firma específica (`{ agregadas: number }`, etc.). NO cambies el contrato del export — solo implementás la lógica interna.
- **gh CLI**: `/Users/sal/bin/gh`, autenticado como `lauro-sa`. Usalo para crear/mergear PRs sin pedirle a Sal que clickee.
- **Supabase MCP**: project_id `nfbjdlmnsmcmtvimjeuo` (flux-dev). Usar `apply_migration` para DDL, `execute_sql` solo para SELECT/inspección.
- **Vercel auto-deploy**: cada merge a main triggerea deploy a producción. Por eso siempre pedir validación visual antes.

---

## 4. Convenciones del proyecto (recordatorio crítico)

Leé `CLAUDE.md` en raíz del repo. Lo más crítico para este trabajo:

- **TypeScript estricto**, todo en español: variables, funciones, componentes, comentarios, mensajes de commit, branches.
- **Imports con alias `@/*`** apuntando a `src/`.
- **Tokens semánticos CSS**, nunca colores hardcodeados (`bg-superficie-tarjeta`, `text-texto-primario`, etc.).
- **Auditoría obligatoria en tablas nuevas**: campos `creado_en`, `actualizado_en`, `creado_por`, `actualizado_por`, `version` + tabla `auditoria_*` + IndicadorEditado en UI. Ver `feedback_auditoria_tablas.md` en memoria.
- **RLS multi-tenant**: política `USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)` + índice `(empresa_id, …)`.
- **Soluciones definitivas, no parches**: si una tabla tiene problema de shape, hacé migración. No agregues helpers visuales para tapar inconsistencias. Ver `feedback_soluciones_definitivas.md`.

---

## 5. Feature 1 — `sembrar-tareas-ot.ts`

### 5.1 Estado actual
Stub en `src/lib/sembrar-tareas-ot.ts` que devuelve `{ agregadas: 0 }`.

### 5.2 Caller
`src/app/api/ordenes/generar/route.ts:183-189`:
```ts
const sembradoTareas = await sembrarTareasOT({
  empresaId,
  presupuestoId: presupuesto.id,
  ordenTrabajoId: orden.id as string,
  creadoPor: user.id,
  creadoPorNombre: nombreUsuario,
})
```

Resultado usado en chatter: `metadata: { detalles: { tareas_sembradas: sembradoTareas.agregadas } }`.

### 5.3 Qué tiene que hacer
1. Leer las líneas del presupuesto (`SELECT * FROM presupuesto_lineas WHERE presupuesto_id = ?`).
2. Para cada línea, crear un registro en la tabla de tareas de OT (verificá nombre exacto con `mcp__supabase__list_tables`).
3. Las líneas pueden ser de tipo:
   - **producto**: tarea con estado `pendiente`, hereda nombre/cantidad/etc.
   - **seccion**: tarea tipo `seccion` con estado `no_aplica` (header visual).
   - **nota**: tarea tipo `nota` con estado `no_aplica` (texto informativo).
4. Mantener el orden de las líneas del presupuesto.
5. Devolver `{ agregadas: N }` donde N es la cantidad insertada.

### 5.4 Investigación previa obligatoria (antes de codear)
- Shape de `presupuesto_lineas` (columnas, tipos).
- Shape de la tabla de tareas de OT (nombre exacto, columnas).
- Si hay constraint UNIQUE que impida re-ejecución (idempotencia).

### 5.5 Edge cases
- Presupuesto sin líneas → devolver `{ agregadas: 0 }` sin error.
- Si la OT ya tiene tareas (re-ejecución) → **consultar a Sal**: skip o insertar duplicadas.
- Línea de tipo desconocido → log warn + skip, no romper.

### 5.6 Tests requeridos (en `src/lib/__tests__/sembrar-tareas-ot.test.ts`)
- Presupuesto con 3 productos + 1 sección + 1 nota → 5 tareas creadas con tipos correctos.
- Presupuesto vacío → `{ agregadas: 0 }`.
- Orden de tareas preservado.

---

## 6. Feature 2 — `sembrar-relevamiento-ot.ts`

### 6.1 Estado actual
Stub en `src/lib/sembrar-relevamiento-ot.ts` que devuelve `{ agregados: 0 }`.

### 6.2 Caller
`src/app/api/ordenes/generar/route.ts:248-256`:
```ts
if (presupuesto.visita_id) {
  try {
    const { agregados } = await sembrarRelevamientoOT({
      empresaId,
      visitaId: presupuesto.visita_id as string,
      ordenTrabajoId: orden.id as string,
    })
    if (agregados > 0) {
      // chatter "Se sembraron X items de relevamiento"
    }
  } catch (err) {
    // log y continuar
  }
}
```

### 6.3 Qué tiene que hacer
1. Leer items del relevamiento de la visita (probablemente `visitas_relevamiento` o similar, verificar con MCP).
2. Para cada item, crear copia en `ordenes_trabajo_relevamiento` (verificá nombre real).
3. Items típicos: fotos, notas técnicas, mediciones, observaciones.
4. Devolver `{ agregados: N }`.

### 6.4 Investigación previa obligatoria
- Verificar nombre exacto de las tablas de relevamiento (visita + OT).
- Si las fotos están en Storage, ver si se copian referencias o se duplican archivos (típicamente solo referencias).
- Shape de los items.

### 6.5 Edge cases
- Visita sin relevamiento → `{ agregados: 0 }`.
- OT ya tiene items → **consultar a Sal**: skip o duplicar.

### 6.6 Tests requeridos
- Visita con 3 fotos + 2 notas → 5 items en OT.
- Visita sin items → `{ agregados: 0 }`.

---

## 7. Feature 3 — `SeccionRelevamientoOT.tsx` + `SeccionBitacoraOT.tsx`

### 7.1 Estado actual
Ambos componentes son stubs que renderizan `null`. Viven en `src/app/(flux)/ordenes/_componentes/`.

### 7.2 Caller
`src/app/(flux)/ordenes/_componentes/VistaOrdenTrabajo.tsx:712-742`. Ya está integrado con tabs (`tabActiva === 'relevamiento' | 'bitacora'`).

### 7.3 Props que ya recibe

**`SeccionRelevamientoOT`**:
```tsx
<SeccionRelevamientoOT
  ordenId={ordenId}
  visitaId={orden.visita_id}
  contactoId={orden.contacto_id}
  puedeGestionar={puedeGestionar}
  usuarioActualId={usuarioActualId}
  onVisitaCambio={(nuevaVisitaId: string | null) => { ... }}
/>
```

**`SeccionBitacoraOT`**:
```tsx
<SeccionBitacoraOT
  ordenId={ordenId}
  usuarioActualId={usuarioActualId}
  puedeGestionar={puedeGestionar}
  esAsignado={Boolean(usuarioActualId && asignados.some(a => a.usuario_id === usuarioActualId))}
/>
```

### 7.4 Qué tiene que hacer cada uno

**Relevamiento**: muestra galería + notas técnicas que vinieron del relevamiento de la visita (sembradas por Feature 2). Permite agregar items nuevos si `puedeGestionar=true`. Si `visitaId` es null, mostrar selector para vincular una visita (que dispara `onVisitaCambio`).

**Bitácora**: feed cronológico de avances. Asignados (`esAsignado=true`) pueden agregar fotos + notas durante la ejecución. Cada autor edita lo suyo; los gestores (`puedeGestionar=true`) editan todo. Orden DESC (más nuevo primero).

### 7.5 Tablas BD esperadas
- `ordenes_trabajo_relevamiento` (alimentada por Feature 2 + manual).
- `ordenes_trabajo_bitacora` (solo manual, durante ejecución).

Verificá con MCP si existen y su shape. **Si no existen → consultar a Sal el SQL de migración antes de aplicar.**

### 7.6 Tests requeridos
- Renderiza vacío correctamente.
- Lista items existentes ordenados.
- Botón "agregar" solo aparece con permisos correctos.
- Editar/eliminar respeta ownership (autor) + permisos (gestor).

---

## 8. Feature 4 — `recorrido-plantilla-aviso.ts`

### 8.1 Estado actual
Stub en `src/lib/recorrido-plantilla-aviso.ts`:
```ts
export async function resolverPlantillaAviso(
  _admin: unknown,
  _empresaId: string,
  _tipo: TipoAviso, // 'llegada' | 'en_camino'
): Promise<PlantillaAvisoResuelta | null> {
  return null
}
```

### 8.2 Callers
- `src/app/api/recorrido/aviso-en-camino/route.ts`
- `src/app/api/recorrido/aviso-llegada/route.ts`

Ambos esperan resolver una plantilla Meta de WhatsApp y enviarla al cliente con variables.

### 8.3 Qué tiene que hacer
1. Leer config de la empresa: cuál plantilla Meta usar para `llegada` vs `en_camino` (probablemente en `config_recorrido` o `config_recorrido_avisos`).
2. Resolver la plantilla:
   - Buscar en `plantillas_wa` (o similar) por nombre/id.
   - Verificar que esté `estado_meta='aprobada'`.
   - Devolver shape `PlantillaAvisoResuelta` con `plantilla` + `nombreApi`.
3. Si no hay plantilla configurada o no está aprobada → devolver `null`.

### 8.4 Investigación previa
- Verificar nombres exactos: `config_recorrido`, `plantillas_wa`.
- Shape exacto de `PlantillaAvisoBase` esperado por los callers.
- **Consultar a Sal**: qué variables expone Flux al cliente (nombre contacto, ETA, link de tracking, etc.).

### 8.5 Tests requeridos
- Plantilla configurada y aprobada → devuelve resolución correcta.
- Plantilla configurada pero NO aprobada → devuelve `null`.
- Sin plantilla configurada → devuelve `null`.

---

## 9. Plan de ejecución sugerido

### 9.1 Orden recomendado (por dependencia)
1. **Feature 1** (sembrar-tareas-ot) — independiente, valor alto, ~3 horas.
2. **Feature 2** (sembrar-relevamiento-ot) — independiente, valor alto, ~3 horas.
3. **Feature 3** (Secciones OT) — depende parcialmente de Feature 2, ~6 horas.
4. **Feature 4** (Plantilla aviso recorrido) — independiente, valor alto, ~4 horas.

Total: ~16 horas. **No entra en una sesión de chat sola.** Hacé checkpoint después de cada feature.

### 9.2 Protocolo por feature (full autónomo)
1. **`git checkout main && git pull && git checkout -b feat/<nombre>`**.
2. **Investigación previa** vía MCP (verificar tablas, shapes, edge cases). NO le pegues hallazgos a Sal — son insumo tuyo.
3. **Implementar**: editar el stub, agregar tests.
4. **Verificar local**: `npx tsc --noEmit` + `npx vitest run` (suite completa).
5. **Auto-review del diff**: leé lo que estás por commitear. Limpiá lo que sobra.
6. **Commit + push** con upstream.
7. **Crear PR**: `gh pr create --base main --head feat/<nombre>`.
8. **Esperar CI verde**: `gh pr checks <num> --watch`.
9. **Mergear directo**: `gh pr merge <num> --squash --delete-branch`. Sin pedir validación.
10. **Reportar 1 línea a Sal y arrancar la siguiente**. No esperes confirmación entre features.

---

## 10. Cómo arrancás

1. Leé este documento entero.
2. Verificá estado del repo: `git log --oneline -5` + `git status --short`.
3. Si el working tree no está limpio → reportarle a Sal en 1 línea antes de tocar nada.
4. Arrancá por la feature pendiente más baja (1 → 2 → 3 → 4). No preguntes por cuál — el orden ya está definido en §9.1.
5. Investigá con MCP, implementá, testeá, mergeá, reportá 1 línea, seguí con la próxima.

---

## 11. Después de las 4 features

Cuando las 4 estén mergeadas a main:
- Actualizá `docs/AUDITORIA_POST_INCIDENTE.md` marcando estas 4 como "implementadas".
- Pegale a Sal un resumen final con links a los 4 PRs mergeados.
- Si Sal quiere seguir con Tanda 2 (UX core) o Tanda 3 (Polish), avisale que vas a armar otro plan en `docs/IMPLEMENTACION_TANDA_2.md` siguiendo este mismo formato.

---

## 12. Contacto y dudas

- **Hablás directo con Sal.** No hay coordinador intermedio.
- **Sal está cansado de chequear cada paso.** Reportá solo cuando terminás una feature, en 1 línea. No le pidas validación visual, no le pidas votos.
- Si te trabás en algo después de 2-3 intentos, recién ahí pegale: contexto + qué intentaste + hipótesis + qué necesitás.
- Si una decisión técnica te parece reversible y de bajo riesgo, **tomala vos**. Default a "skip si ya existe" para idempotencia.
- Si es irreversible (DROP/DELETE masivo) o de alto blast radius, **siempre consultar**. Para todo lo demás, avanzá.
