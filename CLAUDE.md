# Flux by Salix — Reglas para Claude Code

## Nombre del producto
- El sistema se llama **Flux** (marca completa: "Flux by Salix")
- NUNCA usar "CRM", "SalixCRM" ni ninguna referencia a "CRM" en código, UI ni comentarios

## Idioma
- **Todo en español:** componentes, variables, funciones, archivos, props, tipos, hooks
- Comentarios en español explicando qué hace cada bloque y dónde se usa
- Nombres de archivos en español y snake_case para utilidades, PascalCase para componentes

## Stack
- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript estricto
- **Base de datos:** PostgreSQL via Supabase (RLS multi-tenant con empresa_id)
- **Auth:** Supabase Auth (JWT con empresa_id, rol, es_superadmin)
- **ORM:** Drizzle ORM (tipado, SQL-first)
- **Estilos:** Tailwind CSS 4 + tokens semánticos CSS custom properties
- **Animaciones:** Framer Motion (transiciones sutiles, nada exagerado)
- **Realtime:** Supabase Realtime (WebSockets)
- **Storage:** Supabase Storage

## Estructura de carpetas
```
src/
  app/                    # App Router (páginas y API routes)
    (auth)/               # Grupo: login, registro, recuperar
    (flux)/               # Grupo: app autenticada
      contactos/
      actividades/
      visitas/
      documentos/
      productos/
      inbox/
      asistencias/
      calendario/
      ordenes/
      auditoria/
      configuracion/
      dashboard/
    api/                  # API routes
  componentes/
    ui/                   # Primitivas: Boton, Input, Modal, Select, etc.
    tablas/               # TablaBase, EncabezadoTabla, Paginador, etc.
    entidad/              # PlantillaApp, PanelChatter, WidgetJornada, etc.
    feedback/             # Toast, EstadoVacio
    vitrina/              # Página de vitrina de componentes
  hooks/                  # Hooks reutilizables
  lib/                    # Utilidades, clientes (supabase, etc.)
  tipos/                  # Tipos TypeScript globales
  estilos/                # Tokens, variables CSS, globals
  db/                     # Schema Drizzle, migraciones
```

## Reglas de diseño
- **Estilo visual:** Plano y limpio, inspirado en Attio/Linear/Notion
- **Mobile-first:** Diseñar primero para móvil, luego expandir
- **Colores NUNCA hardcodeados:** Siempre tokens semánticos via CSS custom properties
- **Dark/light mode:** Automático por preferencia del sistema + toggle manual
- **Modales:** TODOS usan el mismo componente base. Más anchos que altos en PC. Responsive
- **Micro-interacciones:** Sutiles con Framer Motion (no exageradas)
- **Espaciado generoso**, tipografía clara, sin ruido visual

## Patrón de diseño para modales de configuración
Referencia visual: `ModalTipoActividad` — aplicar este patrón a todos los modales de config/creación.

### Estructura
```
┌─────────────────────────────────────────────────────┐
│ Título modal                                    [X] │
├─────────────────────────────────────────────────────┤
│ Identidad: [icono] Nombre + Colores inline          │
├─────────── border-white/[0.07] ─────────────────────┤
│ SECCIÓN ANCHO COMPLETO (tags, opciones)             │
├─────────── border-white/[0.07] ─────────────────────┤
│ COL IZQUIERDA     │ 1px │ COL DERECHA              │
│ (campos, config)  │     │ (comportamiento, defaults)│
├─────────────────────────────────────────────────────┤
│                              [Cancelar] [Guardar]   │
└─────────────────────────────────────────────────────┘
```

### Reglas clave
- **Tamaño modal:** `5xl` (1080px) para config, usar todo el ancho
- **Grid 2 columnas:** `grid-cols-1 md:grid-cols-[1fr_1px_1fr]` con divisor `bg-white/[0.07]`
- **Divisores horizontales:** `border-t border-white/[0.07]` (NO border-borde-sutil que es invisible)
- **Labels de sección:** `text-[11px] font-medium text-texto-terciario uppercase tracking-wider`
- **Cards de toggle:** `border-white/[0.06] bg-white/[0.03]` con `rounded-lg py-2 px-2.5`
- **Tags/pills toggleables:** activo = `bg-texto-marca/15 border-texto-marca/40 text-texto-marca`, inactivo = `border-borde-sutil text-texto-terciario`
- **Colores:** bolitas `size-5`, seleccionado con `ring-2 ring-white/80`
- **Icono:** botón clickeable con popover compacto (MiniSelectorIcono), NO el SelectorIcono grande
- **Mobile:** colapsa a 1 columna, divisor vertical se oculta (`hidden md:block`)
- **Espaciado:** `space-y-5` entre secciones, `gap-1.5` entre items compactos

## Reglas de código
- TypeScript estricto en todo el proyecto (`strict: true`)
- Componentes reutilizables: si algo se repite, se extrae
- Un cambio en un componente se refleja en todos los lugares donde se usa
- No crear componentes específicos si se puede resolver con el reutilizable + props
- Sin over-engineering: solo lo necesario ahora
- Imports con alias `@/*` apuntando a `src/`

## Filtros avanzados (patrón estándar para listados)

Todos los listados principales (contactos, actividades, visitas, productos, presupuestos,
órdenes, asistencias, usuarios) usan `TablaDinamica` + `PanelFiltrosAvanzado` con `gruposFiltros`.

### Componentes y helpers clave
- `src/componentes/tablas/TablaDinamica.tsx` — tabla base con prop `filtros` + `gruposFiltros`
- `src/componentes/tablas/PanelFiltrosAvanzado.tsx` — panel de 3 columnas (nav | detalle | contexto)
- `src/lib/validaciones.ts` → `normalizarBusqueda(s)` — quita acentos + lowercase (client-side)
- `src/lib/validaciones.ts` → `normalizarAcentos(s)` — solo quita acentos (backend + FTS)
- `src/lib/presets-fecha.ts` → `resolverRangoFecha(preset)` / `inicioRangoFechaISO(preset)`

### Checklist para agregar filtros a un módulo nuevo

**Backend (`/api/<modulo>/route.ts`):**
1. Importar `sanitizarBusqueda`, `normalizarAcentos` y si usás presets `inicioRangoFechaISO`.
2. Leer params: filtros CSV con `params.get('x')` y `.split(',')` cuando multi.
3. Aplicar `.in(col, arr)` si `arr.length > 1`, sino `.eq(col, arr[0])`.
4. Búsqueda: `normalizarAcentos(busqueda)` + `ilike` en múltiples campos con `.or(...)`.
5. Para JOINs (ej. `tipo_contacto` vía tabla contactos): pre-query que devuelve IDs y después `.in('contacto_id', ids)`. Si devuelve vacío, retornar respuesta vacía.
6. Compat hacia atrás: aceptar tanto `x_id` (single) como `x_ids` / `x` CSV (multi) si ya existen consumidores.

**Frontend (`ContenidoXxx.tsx` o `page.tsx`):**
1. States de filtros con restore desde URL: `useState(() => searchParams.get('...'))`.
2. `useBusquedaDebounce(q, pagina, [TODOS los filtros])` — los filtros como deps para resetear página.
3. `useEffect` que sincroniza filtros → URL con `window.history.replaceState`.
4. `sinFiltros` debe chequear **TODOS** los filtros (si olvidás uno, el SSR gana y no filtra).
5. `useListado({ parametros: { ... TODOS los filtros con `undefined` si vacío } })`.
6. Declarar `filtros: FiltroTabla[]` + `gruposFiltros` en props de `TablaDinamica`.
7. Agregar `descripcion` a cada filtro (el panel avanzado lo muestra al seleccionarlo).
8. `onLimpiarFiltros` que resetea todos los states.

**Tipos de filtro** (ver `FiltroTabla.tipo` en `tipos-tabla.ts`):
- `pills` — 2-5 opciones cortas (ej: Sí/No, tri-state)
- `seleccion-compacto` — single-select con popover (lista larga)
- `multiple-compacto` — multi-select con popover (lista larga)
- `fecha` — selector de fecha
- `seleccion` / `multiple` — listas verticales (usar solo para pocas opciones dentro de grupos)

### Criterio de cuándo usar `gruposFiltros`
- **≥ 3 filtros** → definir grupos (ej: Identidad, Comercial, Fechas) para mejor UX
- **1-2 filtros** → sin grupos, el panel usa layout default simple
- **Listados stub sin backend** → saltear hasta que se implemente el API

## Multi-tenant
- Toda tabla tiene columna `empresa_id`
- RLS con política `USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)`
- JWT custom claims: `empresa_id`, `rol`, `es_superadmin`
- Índices compuestos `(empresa_id, ...)` en toda tabla

## Tokens de diseño (CSS custom properties)
```
--texto-primario, --texto-secundario, --texto-terciario, --texto-marca
--superficie-app, --superficie-tarjeta, --superficie-elevada, --superficie-sidebar
--borde-sutil, --borde-fuerte
--insignia-exito, --insignia-peligro, --insignia-advertencia, --insignia-info
--canal-whatsapp, --canal-correo, --canal-interno
--estado-borrador, --estado-pendiente, --estado-completado, --estado-error
```

## Referencia completa
Ver `CONTEXTO_REBUILD.md` para la especificación detallada de todos los módulos, campos, hooks, componentes y funcionalidad.
