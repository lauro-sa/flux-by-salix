# Plan de auditoría y mejora de rendimiento — Flux by Salix

**Estado:** Fases 1, 2.3 y 3 implementadas (2026-05-14). Fase 2.1 (RPCs) pivoteada por costo/beneficio. Fase 4 sin ejecutar todavía (riesgo alto, beneficio diferido).
**Fecha de auditoría:** 2026-05-13
**Sensación reportada:** listados de contactos / presupuestos / actividades tardan 3-5 s, navegación entre rutas se siente "congelada", crear/editar tarda en reflejarse.

## Implementado a la fecha

| PR | Fase | Resumen |
|----|------|---------|
| [#30](https://github.com/lauro-sa/flux-by-salix/pull/30) | 1 | Suspense + SkeletonListado + prefetch al hover + `count: 'estimated'` en 14 endpoints |
| [#31](https://github.com/lauro-sa/flux-by-salix/pull/31) | 2.3 | `pg_trgm` + 13 índices GIN trigram en columnas de búsqueda |
| [#32](https://github.com/lauro-sa/flux-by-salix/pull/32) | 3 | `staleTime` 20 s → 60 s + helper `useCacheListado` aplicado a 4 mutaciones (papelera/etiqueta de contactos, papelera/estado de presupuestos) |

### Pivot Fase 2.1 (RPCs `fn_listar_*`)
Tras analizar la complejidad de `/api/contactos/route.ts` (430 líneas, 12+ pre-queries condicionales), reescribir a SQL puro duplicaba la lógica sin un retorno proporcional **para la escala actual de Flux** (una empresa, miles de filas). El trigram de Fase 2.3 ya cubre el principal cuello de búsqueda. Si la escala crece (miles de empresas o cientos de miles de contactos), vuelve a evaluarse.

### Fase 4 pendiente — alto riesgo
Refactor de 13 providers a Server Component + code-split de TablaDinamica/framer/recharts/tiptap + migración del detalle [id] a Server Component híbrido + barrel de iconos. Trabajo de varios días, invasivo, con riesgo de regresión amplia. **Saltado en esta tanda**; revaluar cuando el TTI móvil sea bloqueante o cuando se agregue otra empresa al sistema.

---

---

## Veredicto

La base de datos está **bien**. El problema está en la suma de decisiones del frontend + API routes que apilan latencia. Con una sola empresa y pocos datos no deberíamos estar arriba de 800 ms en ninguna pantalla.

Causas raíz, en orden de impacto:

1. **Las páginas no usan Suspense** → Next.js mantiene la pantalla anterior congelada durante toda la navegación. Ya está comentado explícitamente en [src/app/(flux)/contactos/page.tsx:12](src/app/(flux)/contactos/page.tsx#L12).
2. **API routes hacen queries secuenciales pre-filtrado** + `count: 'exact'` + N+1 al enriquecer → 1-2 s extra por listado.
3. **Invalidación global de React Query** → crear/editar refetchea el listado entero en vez de hacer update local.
4. **Layout cliente con 12 providers anidados** → cada navegación rehidrata todo.
5. **Bundle no code-splitteado** (framer-motion, recharts, tiptap, TablaDinamica de 2053 líneas).

---

## Estructura del plan

Cuatro fases en orden de impacto. Cada fase es un PR independiente. Implementar **una fase, validar, mergear, pasar a la siguiente.**

| Fase | Foco | Duración estimada | Impacto en latencia percibida |
|------|------|-------------------|-------------------------------|
| 1 | Suspense + prefetch + `count` | 1-2 días | -1 a -2 s (sensación instantánea) |
| 2 | API routes: queries y enriquecimiento | 2-3 días | -0.8 a -1.5 s (datos reales más rápidos) |
| 3 | Caché y mutaciones cliente | 2-3 días | -0.5 a -1 s + UX premium |
| 4 | Bundle, providers, componentes | 3-5 días | -1 s en TTI móvil + escalabilidad |

**Meta final:** listados < 500 ms percibidos, navegación instantánea, crear/editar reflejado en < 100 ms.

---

## Fase 1 — Sentir velocidad (PR 1)

**Objetivo:** que el sistema *se sienta* rápido aunque los datos tarden lo mismo. Skeleton inmediato + prefetch de detalles + eliminar `count: 'exact'`.

### 1.1 Agregar Suspense a páginas principales

Las páginas son Server Components que hacen `await` a Supabase antes de devolver JSX. Sin Suspense, Next.js no muestra nada hasta que termina. Con Suspense + `loading.tsx`, el skeleton aparece al instante.

**Archivos a tocar:**
- [src/app/(flux)/contactos/page.tsx](src/app/(flux)/contactos/page.tsx) — quitar comentario "Sin Suspense"
- [src/app/(flux)/presupuestos/page.tsx](src/app/(flux)/presupuestos/page.tsx)
- [src/app/(flux)/actividades/page.tsx](src/app/(flux)/actividades/page.tsx)
- [src/app/(flux)/productos/page.tsx](src/app/(flux)/productos/page.tsx)
- [src/app/(flux)/visitas/page.tsx](src/app/(flux)/visitas/page.tsx)
- [src/app/(flux)/documentos/page.tsx](src/app/(flux)/documentos/page.tsx)

**Patrón:**
```tsx
// page.tsx
import { Suspense } from 'react'
import SkeletonListado from '@/componentes/feedback/SkeletonListado'

export default function Pagina() {
  return (
    <Suspense fallback={<SkeletonListado />}>
      <ContenidoConDatos />
    </Suspense>
  )
}

async function ContenidoConDatos() {
  // toda la lógica de fetch + HydrationBoundary que hoy está en page.tsx
}
```

**Verificar:** que cada ruta ya tenga su `loading.tsx`. Si no, crear uno con el mismo skeleton.

### 1.2 Skeleton genérico de listado

Crear `src/componentes/feedback/SkeletonListado.tsx` que replique la estructura visual de `TablaDinamica` (header + 10 filas grises animadas). Reutilizable por todas las páginas.

### 1.3 Prefetch de detalles al hover

En [src/componentes/tablas/TablaDinamica.tsx](src/componentes/tablas/TablaDinamica.tsx), agregar `onMouseEnter` que llame a `router.prefetch(href)` para la fila. Cuando el usuario hace click, el JS y los datos ya están cacheados.

**Pseudocódigo:**
```tsx
const router = useRouter()
<tr
  onMouseEnter={() => fila.href && router.prefetch(fila.href)}
  ...
>
```

### 1.4 Eliminar `count: 'exact'` de listados

Cambiar a `count: 'estimated'` o quitar el count y mostrar "1-50" sin total. El total exacto se puede obtener con un endpoint separado, cacheado por 5 minutos, o calcularse aproximado con `pg_class.reltuples` si lo necesitamos exacto.

**Archivos:**
- [src/app/api/contactos/route.ts:106](src/app/api/contactos/route.ts#L106) — `{ count: 'exact' }` → quitar o `'estimated'`
- [src/app/api/presupuestos/route.ts:98](src/app/api/presupuestos/route.ts#L98)
- [src/app/api/actividades/route.ts:64](src/app/api/actividades/route.ts#L64)
- [src/app/(flux)/contactos/page.tsx:44](src/app/(flux)/contactos/page.tsx#L44) — SSR también lo usa
- Buscar otras ocurrencias con `grep -r "count: 'exact'" src/`

**Decisión a tomar antes de implementar:** ¿mostramos total aproximado, total exacto cacheado, o solo "página X"?

### 1.5 Criterio de éxito Fase 1

- [ ] Al navegar entre rutas (`/contactos` → `/presupuestos`), aparece skeleton al instante
- [ ] Hover sobre fila de contacto → click → la página carga < 200 ms
- [ ] Listado de contactos vacía a paginado < 600 ms en network "Fast 3G" (DevTools)
- [ ] `EXPLAIN ANALYZE` del SELECT principal de contactos sin `count: exact` debe bajar al menos 50%

---

## Fase 2 — Backend eficiente (PR 2)

**Objetivo:** reducir las queries por request en API routes. De 7-8 round trips a 1-2.

### 2.1 Refactor de `/api/contactos`

**Problema actual** ([src/app/api/contactos/route.ts](src/app/api/contactos/route.ts)):
- Cada filtro (tipo, etapa, presupuesto, actividades, canal, provincia) ejecuta una query separada que devuelve IDs, y después la query principal filtra con `.in()`.
- Con 6 filtros = 7-8 round trips serializados.

**Solución:**
Crear una función SQL en Postgres (`fn_listar_contactos`) que reciba todos los filtros como parámetros y devuelva los contactos con sus enriquecimientos en **una sola query**. Drizzle puede invocarla con `.rpc()` de Supabase.

**Estructura propuesta:**
```sql
-- sql/funciones/fn_listar_contactos.sql
CREATE OR REPLACE FUNCTION fn_listar_contactos(
  p_empresa_id UUID,
  p_busqueda TEXT DEFAULT NULL,
  p_tipo_ids UUID[] DEFAULT NULL,
  p_etapa_ids UUID[] DEFAULT NULL,
  p_responsable_ids UUID[] DEFAULT NULL,
  p_con_presupuesto BOOLEAN DEFAULT NULL,
  p_provincia TEXT DEFAULT NULL,
  p_canales TEXT[] DEFAULT NULL,
  p_solo_propio_de UUID DEFAULT NULL,
  p_pagina INT DEFAULT 1,
  p_por_pagina INT DEFAULT 50
)
RETURNS TABLE (... columnas + actividades_activas JSON + ultima_etapa JSON ...)
LANGUAGE sql STABLE
AS $$
  WITH base AS (
    SELECT c.*
    FROM contactos c
    WHERE c.empresa_id = p_empresa_id
      AND c.en_papelera = false
      AND (p_solo_propio_de IS NULL OR c.creado_por = p_solo_propio_de)
      AND (p_tipo_ids IS NULL OR c.tipo_contacto_id = ANY(p_tipo_ids))
      AND (p_busqueda IS NULL OR (
        unaccent(c.nombre) ILIKE '%' || unaccent(p_busqueda) || '%'
        OR ...
      ))
      -- filtros con EXISTS en lugar de pre-queries:
      AND (p_etapa_ids IS NULL OR EXISTS (
        SELECT 1 FROM conversaciones cv
        WHERE cv.contacto_id = c.id AND cv.etapa_id = ANY(p_etapa_ids)
      ))
      AND (p_con_presupuesto IS NULL OR ...)
    ORDER BY c.codigo DESC
    LIMIT p_por_pagina OFFSET (p_pagina - 1) * p_por_pagina
  )
  SELECT
    b.*,
    -- subqueries de enriquecimiento integradas:
    (SELECT json_build_object(...) FROM ultima_etapa_view WHERE ...) AS ultima_etapa,
    (SELECT json_agg(...) FROM actividades_activas_view WHERE ...) AS actividades_activas,
    (SELECT count(*) FROM visitas WHERE ...) AS cantidad_visitas_activas
  FROM base b;
$$;
```

**Archivos a modificar:**
- Crear `sql/funciones/fn_listar_contactos.sql` + migración Supabase
- Crear `sql/funciones/fn_listar_presupuestos.sql` (mismo patrón)
- Crear `sql/funciones/fn_listar_actividades.sql`
- Refactor [src/app/api/contactos/route.ts](src/app/api/contactos/route.ts) → llamar a `admin.rpc('fn_listar_contactos', { ... })`
- Refactor [src/app/api/presupuestos/route.ts](src/app/api/presupuestos/route.ts)
- Refactor [src/app/api/actividades/route.ts](src/app/api/actividades/route.ts)
- Refactor [src/app/(flux)/contactos/page.tsx:30-65](src/app/(flux)/contactos/page.tsx#L30-L65) → usar el mismo RPC
- Mantener [src/lib/enriquecer-contactos.ts](src/lib/enriquecer-contactos.ts) solo para casos puntuales (no listado)

### 2.2 Eliminar N+1 de `enriquecerContactos`

[src/lib/enriquecer-contactos.ts](src/lib/enriquecer-contactos.ts) hoy hace 3 queries paralelas + 1 de perfiles. Una vez integrado al RPC (sección 2.1), este helper queda para casos donde no se usa el RPC (ej. detalle de un único contacto). En ese caso, también consolidar en una sola query con `select` embebido.

### 2.3 Búsqueda con `pg_trgm`

Hoy [src/app/api/contactos/route.ts:310-311](src/app/api/contactos/route.ts#L310) usa `ilike '%texto%'` sin índice especializado. En tablas grandes esto es full-scan.

**Solución:**
- Habilitar extensión `pg_trgm` en Supabase (si no está)
- Crear índices GIN en columnas buscables: `nombre`, `apellido`, `correo`, `telefono` de `contactos`; `numero`, `notas` de `presupuestos`; etc.
- Cambiar `ilike '%x%'` por operador `%` o mantener `ilike` (trgm acelera ambos)

**Migración SQL:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_contactos_nombre_trgm ON contactos USING gin (nombre gin_trgm_ops);
CREATE INDEX idx_contactos_apellido_trgm ON contactos USING gin (apellido gin_trgm_ops);
CREATE INDEX idx_contactos_correo_trgm ON contactos USING gin (correo gin_trgm_ops);
-- mismo patrón para presupuestos, actividades, productos
```

### 2.4 Cliente Supabase server: reusar entre requests

Verificar [src/lib/supabase/servidor.ts](src/lib/supabase/servidor.ts) y [src/lib/supabase/admin.ts](src/lib/supabase/admin.ts) — si se crea un cliente nuevo por request, hay overhead. Idealmente: singleton para `admin` (que no usa sesión), instancia por request para `servidor` (sí usa cookies).

### 2.5 Criterio de éxito Fase 2

- [ ] Listado de contactos con 6 filtros activos pasa de 7-8 queries a 1 (verificar en Supabase logs)
- [ ] Tiempo de respuesta de `/api/contactos?busqueda=algo` baja al menos 50%
- [ ] Búsqueda por nombre con `ilike` en 5000+ contactos < 100 ms (con índice trgm)
- [ ] No hay diferencia visual ni de datos vs. la versión anterior

---

## Fase 3 — Caché y mutaciones cliente (PR 3)

**Objetivo:** que crear / editar / eliminar se vea reflejado al instante (< 100 ms percibidos), no esperando refetch del listado.

### 3.1 Optimistic updates en mutaciones

**Problema actual** ([src/app/(flux)/contactos/_componentes/ContenidoContactos.tsx:379,434](src/app/(flux)/contactos/_componentes/ContenidoContactos.tsx#L379)):
```ts
// Al crear/editar contacto:
queryClient.invalidateQueries({ queryKey: ['contactos'] })
// → tira TODA la caché de contactos y refetchea el listado entero
```

**Solución:**
```ts
// Optimistic update:
queryClient.setQueryData(
  ['contactos', filtrosActuales],
  (old) => ({
    ...old,
    contactos: [nuevoContacto, ...old.contactos],
    total: old.total + 1,
  })
)
// En background, recargar solo cuando sea necesario (no inmediato)
```

**Archivos a tocar (todos los onSubmit / onMutate que llaman `invalidateQueries`):**
- [src/app/(flux)/contactos/_componentes/ContenidoContactos.tsx](src/app/(flux)/contactos/_componentes/ContenidoContactos.tsx) — crear/editar/eliminar
- [src/app/(flux)/presupuestos/_componentes/ContenidoPresupuestos.tsx](src/app/(flux)/presupuestos/_componentes/ContenidoPresupuestos.tsx)
- [src/app/(flux)/actividades/_componentes/ContenidoActividades.tsx](src/app/(flux)/actividades/_componentes/ContenidoActividades.tsx)
- [src/app/(flux)/productos/_componentes/ContenidoProductos.tsx](src/app/(flux)/productos/_componentes/ContenidoProductos.tsx)
- [src/app/(flux)/visitas/_componentes/ContenidoVisitas.tsx](src/app/(flux)/visitas/_componentes/ContenidoVisitas.tsx)
- Buscar otros con `grep -r "invalidateQueries" src/app/(flux)/`

**Patrón estándar:** crear un helper `useMutacionListado` en `src/hooks/` que abstraiga el optimistic update + rollback en error.

### 3.2 Subir `staleTime` a 60-120 s

[src/hooks/useListado.ts:78](src/hooks/useListado.ts#L78) tiene `staleTime: 20_000`. Para listados que cambian poco (contactos, productos), 60-120 s es razonable. React Query refetchea silencioso en background al cambiar de ventana.

```ts
// useListado.ts
staleTime: 60_000,  // 1 min para listados
```

Y para configuración (`useConfig`) ya está bien en 5 min.

### 3.3 Paralelizar fetches en detalles

[src/app/(flux)/contactos/[id]/page.tsx](src/app/(flux)/contactos/[id]/page.tsx) hace 6-15 `fetch()` secuenciales. Convertir a `Promise.all` o, mejor, **un único endpoint `/api/contactos/[id]/contexto`** que devuelva todo lo necesario para el detalle en una sola respuesta.

**Mejor: refactor de detalle a Server Component**
El detalle también es `'use client'`, lo que impide usar Suspense ahí. Como Fase 4 lo tocará en serio, en Fase 3 solo paralelizamos. Fase 4 lo migra a hybrid.

### 3.4 Criterio de éxito Fase 3

- [ ] Crear un contacto → aparece en la lista < 100 ms (optimistic)
- [ ] Eliminar contacto → desaparece al instante, vuelve si falla
- [ ] Navegar volver a un listado ya visto → instantáneo (sin spinner)
- [ ] Abrir detalle de contacto → primera pintura < 300 ms

---

## Fase 4 — Bundle y arquitectura (PR 4)

**Objetivo:** TTI móvil < 2 s, navegación sin overhead de providers, listados se code-splittean.

### 4.1 Refactorizar layout `(flux)`

**Problema actual** ([src/app/(flux)/layout.tsx](src/app/(flux)/layout.tsx)): 13 providers anidados, todos `'use client'`. Cada navegación interna los rehidrata.

**Solución:**
1. Convertir el layout a **Server Component** que haga el `auth.getUser()` + carga de empresa + permisos una sola vez.
2. Pasar esos datos como **props serializables** a un único provider cliente (`<ProveedoresCliente datos={...}>{children}</ProveedoresCliente>`).
3. Los providers de UI puros (Tema, Toast, IndicadorGuardado, Idioma) van adentro del provider cliente.
4. Los providers que cargan datos del servidor (Empresa, Permisos, Modulos, Preferencias) reciben datos iniciales por props y no hacen fetch en cliente.

**Estructura propuesta:**
```
src/app/(flux)/layout.tsx           ← Server Component
  └─ <ProveedoresCliente            ← 'use client' único wrapper
       usuario={...}
       empresa={...}
       permisos={...}
       modulos={...}
       preferencias={...}
     >
       <ProveedorQuery>
         <ProveedorTema>
           <ProveedorToast>
             <PlantillaApp>{children}</PlantillaApp>
           ...
```

**Archivos a tocar:**
- [src/app/(flux)/layout.tsx](src/app/(flux)/layout.tsx) — pasar a Server Component
- Crear `src/app/(flux)/_componentes/ProveedoresCliente.tsx`
- Refactor de [src/hooks/useEmpresa.ts](src/hooks/useEmpresa.ts), [src/hooks/usePermisosActuales.ts](src/hooks/usePermisosActuales.ts), [src/hooks/useModulos.ts](src/hooks/useModulos.ts), [src/hooks/usePreferencias.ts](src/hooks/usePreferencias.ts) para aceptar datos iniciales por props

### 4.2 Code-split de TablaDinamica y filtros

[src/componentes/tablas/TablaDinamica.tsx](src/componentes/tablas/TablaDinamica.tsx) tiene **2053 líneas en un archivo**. Partirla:

- `TablaDinamica.tsx` — el shell (header, body, paginación)
- `TablaDinamica.AccionesLote.tsx` — barra de acciones cuando hay selección
- `TablaDinamica.Filtros.tsx` — todo el panel de filtros inline
- `PanelFiltrosAvanzado.tsx` — ya separado, pero cargarlo con `next/dynamic` (solo cuando el usuario abre el panel)

```tsx
const PanelFiltrosAvanzado = dynamic(
  () => import('@/componentes/tablas/PanelFiltrosAvanzado'),
  { ssr: false, loading: () => <SkeletonPanel /> }
)
```

### 4.3 Code-split de librerías pesadas

- `framer-motion` (5.5 MB): solo usar `motion` donde realmente haga falta. Considerar reemplazar animaciones simples con CSS / Tailwind transitions. Para las complejas, `dynamic` import.
- `recharts` (8.5 MB): cargar dinámico solo en dashboard / reporting.
- `@tiptap/*` (7.3 MB): cargar dinámico solo en editor de notas / descripciones.

**Verificar con `next build`** que estos paquetes no aparezcan en el bundle principal (`/contactos`, `/presupuestos`).

### 4.4 Detalle [id] a Server Component híbrido

Migrar [src/app/(flux)/contactos/[id]/page.tsx](src/app/(flux)/contactos/[id]/page.tsx) (y equivalentes de presupuestos, actividades) a Server Component que:
1. Hace la query principal en server
2. Pasa datos por props al `<ContenidoDetalle datosIniciales={...} />` cliente
3. Permite usar Suspense + `loading.tsx` para skeleton instantáneo

### 4.5 Auditoría de iconos lucide

Confirmar tree-shaking. Si el bundle final tiene > 50 KB de lucide, considerar:
- Crear un barrel custom `src/lib/iconos.ts` que reexporte solo los usados
- O usar `lucide-react/icons/X` (importación directa por archivo)

### 4.6 Criterio de éxito Fase 4

- [ ] Bundle de `/contactos` baja al menos 30% (medir con `next build` + analyzer)
- [ ] TTI en móvil 3G < 2 s
- [ ] Layout no rehidrata providers en navegación interna (verificar con React DevTools Profiler)
- [ ] Detalle de contacto pinta skeleton instantáneo y datos en < 400 ms

---

## Orden de ejecución cuando arranquemos

1. **Antes de tocar nada:** medir baseline con DevTools en `/contactos`, `/presupuestos`, `/actividades`. Capturar:
   - Tiempo a primera pintura (FCP)
   - Tiempo a interactivo (TTI)
   - Tiempo total del XHR de listado
   - Cantidad de queries en Supabase logs por request
2. **PR 1 (Fase 1)** — Suspense + prefetch + sin `count: 'exact'`
3. **Validar y medir** — debería verse "instantáneo" aunque los datos tarden parecido
4. **PR 2 (Fase 2)** — RPCs en Postgres + trigram
5. **Validar y medir** — listados con filtros deberían bajar a < 300 ms server-side
6. **PR 3 (Fase 3)** — optimistic updates
7. **Validar y medir** — crear/editar instantáneo
8. **PR 4 (Fase 4)** — refactor de layout + bundle
9. **Validar final** — comparar con baseline, debería estar 4-5× más rápido

---

## Decisiones que necesito que tomes antes de arrancar

1. **`count: 'exact'`** — ¿lo eliminamos y mostramos solo "página X", o mantenemos un total aproximado (`pg_class.reltuples`), o lo cacheamos por 5 min?
2. **RPCs vs Drizzle** — ¿OK con escribir las funciones SQL puras y llamarlas con `.rpc()` de Supabase, o preferís consolidar todo en queries Drizzle (más tipado pero menos potente)?
3. **`pg_trgm`** — ¿OK habilitarlo? Es estándar de Postgres, sin riesgo, pero ocupa espacio en disco.
4. **Refactor de providers en layout (Fase 4)** — es el cambio más invasivo. Si querés evitarlo, podemos parar después de Fase 3 y va a estar ya muy rápido. Solo es necesario si querés "perfeccionismo Linear-level".
5. **Optimistic updates** — ¿OK con que un contacto aparezca al instante en la lista y se "rollbackee" si falla el guardado? Es UX premium pero requiere manejar bien el error.

---

## Lo que NO está en este plan (intencionalmente)

- **No tocar la DB schema/índices** — ya está bien (243 índices, RLS optimizada).
- **No tocar realtime** — no hay suscripciones masivas activas.
- **No reescribir nada que funcione** — sólo arreglos de raíz puntuales.
- **No agregar caches HTTP / Redis / etc.** — innecesario hoy. Si después de las 4 fases hace falta, lo evaluamos con datos.

---

**Cuando me digas "arrancamos", empiezo por la Fase 1. No toco nada hasta que me avises.**
