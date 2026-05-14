# Auditoría post-incidente del 2026-05-13

## 1. Tu misión

Sos un chat de auditoría. El usuario (Sebastián, dueño de Flux by Salix) tuvo una sesión caótica el 2026-05-13 donde:

- Varios chats trabajaron en paralelo en distintas branches.
- Hubo confusión con cambios de branches mientras se ejecutaba el sub-PR 20.6.
- Un commit gigante de WIP mezcló trabajo de 8+ áreas distintas.
- Algunas features quedaron como "stubs vacíos" (renderizan `null` o son pass-through).
- El layout principal de la app quedó visualmente roto (sidebar tapa el contenido).

Tu trabajo: **auditar el estado actual del repo, identificar todo lo que está roto, identificar trabajo no mergeado que pueda recuperarse, y proponer un plan ordenado para dejar todo correcto sin perder cambios reales.**

NO ejecutes nada destructivo (no merges, no rebases, no drops, no force-push) sin aprobación explícita del usuario. Primero auditás, después proponés, después ejecutás.

## 2. Lo que sabés con certeza

### 2.1 Estado de `main` (al cierre de la sesión problemática)

HEAD = `bafe954`. Últimos commits relevantes:

| Hash | PR | Qué hace |
|---|---|---|
| `bafe954` | #11 | Sub-PR 20.6 — drop `actividades.vinculos` + migración a `actividades_relaciones` |
| `fc04541` | #7 | "notificaciones horario laboral" — pero realmente mergeó un WIP gigante de 176 archivos mezclados |
| `945a322` | #10 | fix: sincronizar cuotas al cambiar condición de pago |
| `c061a32` | #9 | feat: filtrar plantillas WhatsApp por módulo |
| `9e2f74d` | #6 | docs: brief del coordinador persistente |
| `1693f57` | #5 | docs: plan del sub-PR 20.6 |
| `51cac71` | #4 | fix: tooltip kiosco-only |
| `e07ffb4` | #3 | fix: vista flujos_con_estadisticas |
| `77e5299` | #2 | PR 20 completo (sub-PR 20.1-20.5) |

**El problema gordo está en el PR #7** (`fc04541`). El título dice "notificaciones horario laboral" pero el commit incluye 176 archivos modificados: presupuestos, recorrido, salix-ia, whatsapp, plantillas, asistencias, sidebar, layout, mapa, tokens visuales, panel chatter, notas rápidas, OT, etc. Es un dump del WIP del usuario, no un commit limpio del scope nombrado.

### 2.2 Migraciones SQL aplicadas en flux-dev (BD)

Las migraciones del sub-PR 20.6 están aplicadas en BD:

- `070_actividades_relaciones_entidad_nombre` — agrega columna `entidad_nombre` a `actividades_relaciones`.
- `071_actividades_relaciones_resync_nombre_legacy` — backfill de nombres desde tablas reales.
- `072_actividades_drop_vinculos_legacy` — DROP de `actividades.vinculos` y `actividades.vinculo_ids`.

`actividades_relaciones` tiene 63 filas con `entidad_nombre` no nulo (verificado).

### 2.3 Stashes preservados como backup

```
stash@{0}: On feat/notificaciones-horario: wip-notificaciones-horario-arrastrado-20260513-0023
stash@{1}: On feat/flujos-vinculos-relaciones: wip-api-actividades-id-commit2
```

NO los borres sin que el usuario confirme.

### 2.4 Stubs vacíos en main (archivos pequeños que renderizan null o pass-through)

Estos archivos fueron traídos desde `wip/recovery-multiples-chats` para destrabar el build de Vercel cuando se mergeó el PR #7. La intención era reemplazarlos con versiones reales cuando los chats correspondientes commiteen:

| Archivo | Tamaño | Estado |
|---|---|---|
| `src/lib/actividades-sync.ts` | 615 B | Stub |
| `src/lib/recorrido-plantilla-aviso.ts` | 1.3 KB | **Implementado (Tanda 1, PR #16)** |
| `src/lib/sembrar-relevamiento-ot.ts` | 619 B | **Implementado (Tanda 1, PR #14)** |
| `src/lib/sembrar-tareas-ot.ts` | 693 B | **Implementado (Tanda 1, PR #13)** |
| `src/lib/whatsapp/modulos-plantilla.ts` | 3.4 KB | Stub (PR #9 lo reemplazó con versión real, verificá) |
| `src/lib/presupuestos/enriquecer-listado.ts` | 542 B | Stub pass-through |
| `src/lib/presupuestos/sincronizar-recursos-envio.ts` | 1.2 KB | **Implementado (Tanda 2, PR #20)** |
| `src/componentes/entidad/_enviar_documento/BannerSincronizacion.tsx` | — | **Implementado (Tanda 2, PR #20)** |
| `src/componentes/entidad/IndicadorGuardadoHeader.tsx` | — | **Implementado (Tanda 2, PR #18)** |
| `src/componentes/entidad/PreviewSeccionExterna.tsx` | — | Stub |
| `src/app/(flux)/ordenes/_componentes/SeccionBitacoraOT.tsx` | — | **Implementado (Tanda 1, PR #15)** |
| `src/app/(flux)/ordenes/_componentes/SeccionRelevamientoOT.tsx` | — | **Implementado (Tanda 1, PR #15)** |
| `src/app/(flux)/presupuestos/_componentes/SelectorVisitaPresupuesto.tsx` | — | **Implementado (Tanda 2, PR #19)** |
| `src/hooks/useTituloPestana.ts` | — | **Implementado (Tanda 2, PR #21)** |
| `src/hooks/useIndicadorGuardado.tsx` | — | **Implementado (Tanda 2, PR #18)** |

**Excepción**: `src/lib/sincronizar-cuotas-presupuesto.ts` y `src/lib/whatsapp/modulos-plantilla.ts` fueron mergeados con código real vía PR #9 y #10 — verificá que la versión actual no sea el stub.

### 2.5 Bug visual confirmado por el usuario

El sidebar (que usa `position: fixed`) tapa el contenido principal. El usuario subió 2 capturas mostrando títulos cortados ("enas tardes, Sebastian" en lugar de "Buenas tardes, Sebastian", flujos "ctividades al enviar presupuesto" en lugar de "Actividades al enviar presupuesto", etc.).

La regla CSS responsable está en `src/app/globals.css:195-198`:

```css
@media (min-width: 768px) {
  .contenido-principal {
    margin-left: var(--ancho-sidebar-actual, 0px);
    transition: margin-left 200ms ease;
  }
}
```

`--ancho-sidebar-actual` se setea inline en `src/componentes/entidad/PlantillaApp.tsx:267`:

```tsx
style={{ '--ancho-sidebar-actual': anchoSidebarReal } as React.CSSProperties}
```

Donde `anchoSidebarReal` es `'var(--sidebar-ancho)'` (240px) o `'var(--sidebar-ancho-colapsado)'` (56px).

Hipótesis no confirmadas:
- Cache del navegador sirviendo CSS viejo + JS nuevo (probable — pedile al usuario hacer hard refresh `Cmd+Shift+R`).
- Bug real donde la variable CSS no llega al elemento.
- Conflicto con CSS de `src/estilos/salix-glass.css` (que cambió +206 líneas en el WIP).

### 2.6 Tests fallidos en CI

`src/lib/salix-ia/__tests__/permisos.test.ts`: 2 fail / 30 total.

Razón: el WIP del usuario agregó 2 tools nuevas (`consultar_vinculaciones_contacto`, `vincular_contactos`) a `HERRAMIENTAS_SALIX_IA` en `src/lib/salix-ia/herramientas/definiciones.ts` sin agregar las entries correspondientes en el mapa de permisos. Resultado: el test espera 30 herramientas filtradas y recibe 28.

Fix: agregar las 2 entries faltantes en el mapa de permisos.

### 2.7 Branches sin mergear con commits propios

```
origin/feat/inbox-whatsapp-v2
origin/feat/visitas-recorrido
origin/feature/agente-ia-v2
origin/feature/calendario
origin/feature/modulo-inbox
origin/feature/rediseno-modal-plantilla-correo
origin/feat/salix-ia-copiloto-vinculaciones  ← PR #8 abierto
origin/fix/coords-recorrido-ordenes-2026-05-13
origin/fix/fullscreen-viewport-ios
origin/fix/inbox-movil-nativo
origin/fix/sincronizar-cuotas-presupuesto  (probablemente ya mergeado vía PR #10)
origin/fix/visitas-cleanup-hardcoded
origin/mejoras/ajustes-generales  (1 commit ahead local pushed)
origin/mejoras/pwa-vista-movil
origin/optimizacion/fase-2a-recalcular-totales  (2 commits ahead local pushed)
origin/wip/recovery-multiples-chats  ← "bolsa de stash" con stubs + intentos
origin/feat/estados-configurables  (mergeado vía PR #1 pero branch sigue)
origin/feat/flujos-pr-20  (mergeado vía PR #2 pero branch sigue)
origin/feat/plantillas-whatsapp-filtrado-por-modulo  (mergeado vía PR #9 pero branch sigue)
```

**ALGUNAS DE ESTAS BRANCHES PUEDEN TENER LA VERSIÓN REAL DE LOS STUBS.** Por ejemplo:

- `fix/coords-recorrido-ordenes-2026-05-13` (commit `7732687`) creó originalmente `src/lib/geocoding.ts` con código real (que sí lo traje a main).
- `feat/salix-ia-copiloto-vinculaciones` (commit `79ffdc7`) creó las 2 tools nuevas de Salix IA con código real.
- Otras branches podrían tener `BannerSincronizacion`, `SeccionBitacoraOT`, etc. con código real.

**Tarea crítica**: para cada stub listado en §2.4, buscar en cada branch si existe una versión más completa.

### 2.8 PRs abiertos

```
#8 — feat/salix-ia-copiloto-vinculaciones → main (abierto, sin tocar)
```

## 3. Plan sugerido (no ejecutar sin aprobación)

### Fase A — Auditoría (read-only, sin tocar nada)

1. Confirmar el estado actual del repo:
   ```bash
   git log main --oneline -30
   git stash list
   git branch -a
   ```

2. Para cada stub en §2.4, buscar versión real en otras branches:
   ```bash
   for b in $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes); do
     lines=$(git show "$b":src/lib/presupuestos/enriquecer-listado.ts 2>/dev/null | wc -l)
     [[ "$lines" -gt 30 ]] && echo "$b: $lines líneas"
   done
   ```
   Repetir para cada stub. Si aparece una branch con >50 líneas, esa branch tiene la versión real.

3. Para PR #8 y todas las branches con commits propios, listar qué archivos modifica vs main:
   ```bash
   git diff main...origin/feat/salix-ia-copiloto-vinculaciones --stat
   ```

4. Verificar consistencia BD ↔ código:
   - `mcp__supabase__list_migrations` y comparar con `ls sql/` (¿hay migraciones aplicadas en BD que no estén en sql/? ¿al revés?).
   - `mcp__supabase__list_tables` y verificar que el código no referencie columnas dropeadas.

5. Verificar el bug del layout:
   - Pedirle al usuario hacer `Cmd+Shift+R` (hard refresh).
   - Si persiste, pedirle captura de DevTools mostrando el elemento `<div class="contenido-principal ...">` con su panel "Computed" abierto.
   - Reportar si `margin-left` está computando 0px o 240px.

6. Verificar que los 2 tests fallidos de Salix IA son solo deuda de permisos (no algo más grave):
   ```bash
   npx vitest run src/lib/salix-ia/__tests__/permisos.test.ts
   ```

### Fase B — Pasarle al usuario el resumen

Antes de tocar NADA, pasarle al usuario:

- Mapa completo: stub → branch con versión real (si existe).
- Diagnóstico del layout (cache vs bug real).
- Plan ordenado de qué arreglar primero, segundo, etc.
- Estimación de riesgo de cada acción.

El usuario decide qué hacer.

### Fase C — Ejecución (solo con aprobación)

Orden sugerido (no obligatorio):

1. **Fix del layout** (urgente, lo bloquea para usar la app). Si es cache, hard refresh. Si es bug real, identificar la regla CSS rota y arreglar.

2. **Fix del test de Salix IA permisos**: agregar las 2 entries faltantes en el mapa de permisos. Es probable que la fuente esté en `feat/salix-ia-copiloto-vinculaciones` (PR #8) — verificar.

3. **Reemplazar stubs con versiones reales** (uno por uno, priorizar lo que el usuario use):
   - Buscar en qué branch vive la versión real de cada stub.
   - Cherry-pick o checkout selectivo del archivo.
   - Verificar typecheck + tests por cada cambio.
   - Commit individual por feature.

4. **Cerrar PR #8 o mergear si su contenido es relevante** (Salix IA copiloto). Algunos archivos de PR #8 ya están en main (los 2 archivos de vinculaciones), verificar qué falta.

5. **Limpiar branches obsoletas**: borrar branches locales y remotas que ya estén mergeadas (`feat/estados-configurables`, `feat/flujos-pr-20`, `feat/flujos-vinculos-relaciones`, etc.).

6. **Dividir el commit gigante `fc04541` (PR #7) por scope** (opcional, cosmético): si el usuario quiere historia limpia, se puede dividir vía `git revert` + commits separados sobre nuevo HEAD. Es trabajo grande, no urgente.

7. **Dropear stashes** una vez se confirme que no hay nada que recuperar.

## 4. Restricciones duras

- **Working tree del usuario**: el usuario tiene `.respaldo-route-presupuestos-2026-05-13.patch` como untracked. NO borrarlo sin OK.
- **Identidad git**: usa machine identity (`sal@MacBook-Pro-de-Sebastian.local`). NO modificar config global.
- **Stashes**: stash@{0} y stash@{1} son backup histórico. NO dropear sin OK.
- **Branches mergeadas**: NO borrar sin verificar primero que sus commits están en main vía `git log main --oneline | grep <hash>`.
- **gh CLI**: path `/Users/sal/bin/gh`, autenticado como `lauro-sa`.
- **Supabase MCP**: project_id `nfbjdlmnsmcmtvimjeuo` (flux-dev). Usar `apply_migration` para DDL, `execute_sql` solo para SELECT.
- **Vercel**: auto-deploya `main`. Cualquier merge a main impacta producción inmediatamente.

## 5. Cosas que NO sabés y que tenés que averiguar

- Cuántas branches tienen versión real de los stubs vs cuántas están vacías.
- Si el bug del layout es cache del navegador o bug real en el código.
- Si el WIP del usuario (commit gigante `31df220` adentro del PR #7 ahora squasheado en `fc04541`) tiene features importantes deshabilitadas/rotas además de los stubs.
- Si hay PRs de chats paralelos esperando ser mergeados.
- Si el usuario quiere preservar el historial Git (dividir el commit gigante por scope) o no le importa.

## 6. Cómo arrancar

1. Saluda al usuario y confirmá que leíste este documento.
2. Corré los comandos de Fase A.
3. Pegale al usuario un resumen estructurado con:
   - Estado de cada stub (versión real existe / no existe / dónde está).
   - Estado del bug del layout (cache / bug real / desconocido hasta hard refresh).
   - Estado del test fallido (entries de permisos faltantes confirmadas / otro problema).
   - Lista de branches con trabajo no mergeado y qué contienen.
   - Recomendación de orden de ejecución.

4. Esperá su decisión antes de actuar.

NO te apures. El usuario está frustrado por el caos previo. Lo más valioso que podés hacer es **darle un mapa claro de qué está pasando** antes que ejecutar cosas.

## 7. Contexto histórico (qué pasó en la sesión problemática)

Para que entiendas por qué hay este caos, acá va el resumen de lo que pasó el 2026-05-13:

1. **Estado inicial**: 5+ chats trabajando en paralelo en branches distintas. Working tree con ~150 archivos modificados (WIP del usuario mezclado de varios chats).

2. **Sub-PR 20.6 (drop actividades.vinculos)** estaba en ejecución. Un chat ejecutor había hecho Commits 1 y 2.

3. **Incidente**: hubo confusión con cambios de branch durante el trabajo. El working tree con WIP del usuario terminó arrastrándose entre branches. Otros chats trabajaron en paralelo modificando el mismo working tree.

4. **Cleanup masivo**: el coordinador (chat anterior al tuyo) decidió:
   - Pushear todas las branches con commits sin pushear.
   - Hacer un commit gigante de TODO el working tree en `feat/notificaciones-horario` (149 archivos) para preservar el WIP.
   - Mergear ese PR #7 a main como squash → `fc04541`.
   - Continuar el 20.6 desde Commit 3.
   - Para destrabar el build de Vercel del PR #7, traer stubs vacíos desde `wip/recovery-multiples-chats`.

5. **Sub-PR 20.6 completado**: Commits 3-8 + migración 072 (drop columnas). PR #11 mergeado a main → `bafe954`.

6. **Resultado**: Flujos funciona, pero el WIP del usuario quedó en un commit gigante mezclado, varios archivos quedaron como stubs vacíos, layout visualmente roto.

El usuario está frustrado porque "ayer andaba todo bien" — sí, porque ayer su WIP no estaba en main. Hoy se mergeó y trajo todos los problemas con él.

Tu trabajo: dejar todo correcto sin perder lo que el usuario realmente quería tener.
