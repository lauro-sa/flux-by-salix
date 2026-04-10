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
