# Implementación Tanda 1 — Features de Negocio Pendientes

## 1. Tu misión

Sos un chat dedicado a implementar 4 features que actualmente son stubs vacíos en main. El usuario (Sebastián de Flux by Salix) decidió priorizar estas porque afectan la operación diaria de su empresa.

Las 4 features son:
1. **Sembrar tareas en OT** desde un presupuesto.
2. **Sembrar relevamiento en OT** desde una visita.
3. **Secciones de Bitácora y Relevamiento** dentro de la vista de OT.
4. **Plantillas de WhatsApp** para avisos de recorrido (en camino / llegada).

Las 4 son independientes — podés hacerlas en orden o en paralelo.

## 2. Restricciones duras

- **Estado actual del repo**: HEAD de main = `5a7fd95` (post-cleanup del incidente del 2026-05-13). Working tree limpio salvo archivos untracked del usuario.
- **Una branch por feature**: `feat/sembrar-tareas-ot`, `feat/sembrar-relevamiento-ot`, `feat/seccion-bitacora-relevamiento-ot`, `feat/plantilla-aviso-recorrido`.
- **Un PR por feature**: cada uno mergeado independiente. NO juntar features en un PR.
- **TypeScript estricto**: typecheck limpio antes de cada commit.
- **Tests obligatorios**: cada feature con su suite de tests unitarios (`src/lib/__tests__/<feature>.test.ts`).
- **Mantener firma actual del stub**: el caller ya está usando una firma específica (`{ agregadas: number }`, etc.). NO cambies el contrato del export — solo implementás la lógica interna.
- **Validación visual**: vos no tenés browser. Después del merge, el usuario va a probar en Vercel preview. Pedile siempre que valide visualmente.
- **gh CLI**: `/Users/sal/bin/gh`, autenticado como `lauro-sa`.
- **Supabase MCP**: project_id `nfbjdlmnsmcmtvimjeuo` (flux-dev). Usar `apply_migration` para DDL, `execute_sql` solo para SELECT/inspección.

## 3. Convenciones del proyecto

Leé `CLAUDE.md` en raíz del repo para convenciones generales. Lo más crítico:
- TypeScript estricto, todo en español (variables, funciones, componentes, comentarios).
- Imports con alias `@/*` apuntando a `src/`.
- Tokens semánticos CSS, nunca colores hardcodeados.
- Auditoría obligatoria en tablas nuevas (ver `feedback_auditoria_tablas.md` en memoria del proyecto si está disponible).
- RLS multi-tenant: política `USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)`.

## 4. Feature 1 — `sembrar-tareas-ot.ts`

### 4.1 Estado actual
Stub en `src/lib/sembrar-tareas-ot.ts` que devuelve `{ agregadas: 0 }`.

### 4.2 Caller
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

El resultado se usa en chatter:
```ts
metadata: {
  detalles: { tareas_sembradas: sembradoTareas.agregadas },
}
```

### 4.3 Qué tiene que hacer
1. Leer las líneas del presupuesto (`SELECT * FROM presupuesto_lineas WHERE presupuesto_id = ?`).
2. Para cada línea, crear un registro en `ordenes_trabajo_tareas` (verificá el nombre exacto de la tabla con `mcp__supabase__list_tables`).
3. Las líneas pueden ser de tipo:
   - **producto**: tarea con estado `pendiente`, hereda nombre/cantidad/etc.
   - **seccion**: tarea tipo `seccion` con estado `no_aplica` (header visual).
   - **nota**: tarea tipo `nota` con estado `no_aplica` (texto informativo).
4. Mantener el orden de las líneas del presupuesto.
5. Devolver `{ agregadas: N }` donde N es la cantidad insertada.

### 4.4 Investigación previa obligatoria
Antes de codear, verificá vía MCP:
- Shape de `presupuesto_lineas` (columnas, tipos).
- Shape de la tabla de tareas de OT (nombre exacto, columnas).
- Si hay constraint UNIQUE que impida re-ejecución (idempotencia).

### 4.5 Edge cases a manejar
- Presupuesto sin líneas → devolver `{ agregadas: 0 }` sin error.
- Si la OT ya tiene tareas (re-ejecución) → decidir: skip o insertar duplicadas. Pregunta al usuario antes de elegir.
- Línea de tipo desconocido → log warn + skip, no romper.

### 4.6 Tests requeridos
- Presupuesto con 3 productos + 1 sección + 1 nota → 5 tareas creadas con tipos correctos.
- Presupuesto vacío → `{ agregadas: 0 }`.
- Orden de tareas preservado.

---

## 5. Feature 2 — `sembrar-relevamiento-ot.ts`

### 5.1 Estado actual
Stub en `src/lib/sembrar-relevamiento-ot.ts` que devuelve `{ agregados: 0 }`.

### 5.2 Caller
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

### 5.3 Qué tiene que hacer
1. Leer items del relevamiento de la visita (probablemente `visitas_relevamiento` o similar, verificar con MCP).
2. Para cada item, crear copia en `ordenes_trabajo_relevamiento` (verificá nombre real).
3. Items típicos: fotos, notas técnicas, mediciones, observaciones.
4. Devolver `{ agregados: N }`.

### 5.4 Investigación previa obligatoria
- Verificar nombre exacto de las tablas de relevamiento (visita + OT).
- Si las fotos están en Storage, ver si se copian referencias o se duplican archivos (típicamente solo referencias).
- Shape de los items.

### 5.5 Edge cases
- Visita sin relevamiento → `{ agregados: 0 }`.
- OT ya tiene items → mismo dilema que sembrar-tareas (preguntar antes).

### 5.6 Tests requeridos
- Visita con 3 fotos + 2 notas → 5 items en OT.
- Visita sin items → `{ agregados: 0 }`.

---

## 6. Feature 3 — `SeccionRelevamientoOT.tsx` + `SeccionBitacoraOT.tsx`

### 6.1 Estado actual
Ambos componentes son stubs que renderizan `null`. Viven en `src/app/(flux)/ordenes/_componentes/`.

### 6.2 Caller
`src/app/(flux)/ordenes/_componentes/VistaOrdenTrabajo.tsx:712-742`. Ya está integrado con tabs (`tabActiva === 'relevamiento' | 'bitacora'`).

### 6.3 Props que ya recibe

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

### 6.4 Qué tiene que hacer cada uno

**Relevamiento**: muestra galería + notas técnicas que vinieron del relevamiento de la visita (sembradas por Feature 2). Permite agregar items nuevos si `puedeGestionar=true`. Si `visitaId` es null, mostrar selector para vincular una visita (que dispara `onVisitaCambio`).

**Bitácora**: feed cronológico de avances. Asignados (`esAsignado=true`) pueden agregar fotos + notas durante la ejecución. Cada autor edita lo suyo; los gestores (`puedeGestionar=true`) editan todo. Orden DESC (más nuevo primero).

### 6.5 Tablas BD esperadas
- `ordenes_trabajo_relevamiento` (alimentada por Feature 2 + manual).
- `ordenes_trabajo_bitacora` (solo manual, durante ejecución).

Verificá con MCP si existen y su shape. Si no existen, hay que crear migración.

### 6.6 Tests requeridos
- Renderiza vacío correctamente.
- Lista items existentes ordenados.
- Botón "agregar" solo aparece con permisos correctos.
- Editar/eliminar respeta ownership (autor) + permisos (gestor).

---

## 7. Feature 4 — `recorrido-plantilla-aviso.ts`

### 7.1 Estado actual
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

### 7.2 Callers
- `src/app/api/recorrido/aviso-en-camino/route.ts`
- `src/app/api/recorrido/aviso-llegada/route.ts`

Ambos esperan resolver una plantilla Meta de WhatsApp y enviarla al cliente con variables (nombre, ETA, etc.).

### 7.3 Qué tiene que hacer
1. Leer config de la empresa: cuál plantilla Meta usar para `llegada` vs `en_camino`. Probablemente en `config_recorrido` o `config_recorrido_avisos` (verificar con MCP).
2. Resolver la plantilla:
   - Buscar en `plantillas_wa` (o similar) por nombre/id según config.
   - Verificar que esté `estado_meta='aprobada'`.
   - Devolver shape `PlantillaAvisoResuelta` con `plantilla` + `nombreApi`.
3. Si no hay plantilla configurada o no está aprobada → devolver `null` (los callers ya manejan ese caso).

### 7.4 Investigación previa
- Verificar nombres de tablas: `config_recorrido`, `plantillas_wa`.
- Ver shape exacto de `PlantillaAvisoBase` esperado por los callers.
- Variables disponibles para reemplazar en la plantilla (nombre contacto, ETA, link de tracking, etc.).

### 7.5 Tests requeridos
- Plantilla configurada y aprobada → devuelve resolución correcta.
- Plantilla configurada pero NO aprobada → devuelve `null`.
- Sin plantilla configurada → devuelve `null`.
- Tipo desconocido → error.

---

## 8. Plan de ejecución sugerido

### Orden recomendado (por dependencia)
1. **Feature 1** (sembrar-tareas-ot) — independiente, valor alto, ~3 horas.
2. **Feature 2** (sembrar-relevamiento-ot) — independiente, valor alto, ~3 horas.
3. **Feature 3** (Secciones OT) — depende parcialmente de Feature 2 (los items que muestra vienen de ahí), ~6 horas.
4. **Feature 4** (Plantilla aviso recorrido) — independiente, valor alto, ~4 horas.

Total: ~16 horas.

### Protocolo por feature
1. **Crear branch** desde main: `git checkout -b feat/<nombre>`.
2. **Investigación previa**: vía MCP, verificar tablas, shapes, edge cases. Pegar al usuario lo encontrado + propuesta de implementación. Esperar voto.
3. **Implementar**: editar el stub, agregar tests.
4. **Verificar local**: `npx tsc --noEmit` + `npx vitest run` (suite completa).
5. **Preview pre-commit**: pegar al usuario `git status`, diff stat, mensaje propuesto. Esperar luz verde.
6. **Commit + push** con upstream.
7. **Crear PR**: `gh pr create --base main --head feat/<nombre>`.
8. **Esperar Vercel preview**: pedir al usuario que valide visualmente.
9. **Si aprueba**: `gh pr merge <num> --squash --delete-branch`.
10. **Pasar a la siguiente feature**.

## 9. Cómo arrancar

1. Confirmar que leíste este documento.
2. Confirmar estado del repo: `git log --oneline -5` + `git status --short`.
3. Preguntar al usuario por dónde arrancar (Feature 1 por defecto si no especifica).
4. Iniciar investigación previa de esa feature según §4.4/§5.4/§6.5/§7.4.
5. NO codees hasta tener los hallazgos pegados al usuario y el voto correspondiente.

## 10. Después de las 4 features

Cuando las 4 estén mergeadas a main:
- Actualizá `docs/AUDITORIA_POST_INCIDENTE.md` marcando estas 4 como "implementadas".
- Pegale al usuario un resumen final.
- Si el usuario quiere seguir con Tanda 2 (UX core: indicador guardado, banner sync, PDF sync, selector visita) o Tanda 3 (polish), avisarle y armar otro plan.
