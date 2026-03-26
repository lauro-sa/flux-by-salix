# Flux by Salix — Arquitectura técnica

> Documentación técnica de la arquitectura del sistema.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Next.js (App Router) + React + TypeScript | 16 / 19 |
| Estilos | Tailwind CSS + tokens CSS custom properties | 4 |
| Animaciones | Framer Motion | 12 |
| Base de datos | PostgreSQL via Supabase | - |
| Auth | Supabase Auth | - |
| ORM | Drizzle ORM | - |
| Realtime | Supabase Realtime (WebSockets) | - |
| Storage | Supabase Storage | - |

---

## Estructura del proyecto

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Grupo: login, registro, recuperar
│   │   ├── login/
│   │   └── registro/
│   ├── (flux)/                  # Grupo: app autenticada
│   │   ├── contactos/
│   │   ├── actividades/
│   │   ├── visitas/
│   │   ├── documentos/
│   │   ├── productos/
│   │   ├── inbox/
│   │   ├── asistencias/
│   │   ├── calendario/
│   │   ├── ordenes/
│   │   ├── auditoria/
│   │   ├── configuracion/
│   │   ├── dashboard/
│   │   └── vitrina/           # Vitrina de componentes (dev)
│   ├── api/                    # API routes
│   ├── globals.css
│   ├── layout.tsx              # Layout raíz
│   └── page.tsx                # Página de inicio
├── componentes/
│   ├── ui/                     # Primitivas: Boton, Input, Modal, etc.
│   ├── tablas/                 # TablaBase, Paginador, Kanban, etc.
│   ├── entidad/                # PlantillaApp, Chatter, etc.
│   └── feedback/               # Toast, EstadoVacio
├── hooks/                      # Hooks reutilizables
├── lib/
│   └── i18n/                   # Sistema de internacionalización
│       ├── tipos.ts            # Tipos TypeScript de traducciones
│       ├── es.ts               # Español (default)
│       ├── en.ts               # English
│       ├── pt.ts               # Português
│       └── index.tsx           # Provider + hook useTraduccion
├── tipos/                      # Tipos TypeScript globales
├── estilos/
│   └── tokens.css              # Sistema de tokens de diseño
└── db/                         # Schema Drizzle + migraciones
```

---

## Sistema de diseño

### Tokens CSS

Todos los colores, tipografía, espaciado y sombras están centralizados en `src/estilos/tokens.css` como CSS custom properties.

**Regla:** NUNCA usar hex/rgb directo en componentes. Siempre tokens.

Categorías de tokens:
- `--texto-*` — Colores de texto (primario, secundario, terciario, marca)
- `--superficie-*` — Fondos (app, tarjeta, elevada, sidebar, hover)
- `--borde-*` — Bordes (sutil, fuerte, foco)
- `--insignia-*` — 10 colores semánticos para badges (exito, peligro, advertencia, info, primario, neutro, rosa, cyan, violeta, naranja)
- `--canal-*` — Colores por canal de mensajería (whatsapp, correo, interno)
- `--estado-*` — Estados de entidades (borrador, pendiente, completado, error, cancelado)
- `--seccion-*` — Color por módulo (contactos, actividades, documentos, etc.)
- `--sombra-*` — Sombras (sm, md, lg, elevada)
- `--radio-*` — Border radius (sm, md, lg, xl, completo)
- `--transicion-*` — Duraciones (rapida, normal, lenta)
- `--texto-*` (tamaños) — Tipografía (xs a 3xl)
- `--espacio-*` — Espaciado (1 a 12)

### Dark/Light mode

- Automático por `prefers-color-scheme`
- Override manual con `data-tema="oscuro"` o `data-tema="claro"` en `<html>`
- Todos los tokens cambian automáticamente

### Componentes base

| Componente | Archivo | Descripción |
|-----------|---------|------------|
| `Boton` | `componentes/ui/Boton.tsx` | 6 variantes, 3 tamaños, cargando, solo-ícono |
| `Input` | `componentes/ui/Input.tsx` | Etiqueta, error, ayuda, íconos |
| `Insignia` | `componentes/ui/Insignia.tsx` | 10 colores semánticos, removible |
| `Modal` | `componentes/ui/Modal.tsx` | Portal, 10 tamaños, escape, backdrop |
| `Toast` | `componentes/feedback/Toast.tsx` | 4 tipos, auto-dismiss, hover-pause |
| `EstadoVacio` | `componentes/feedback/EstadoVacio.tsx` | Placeholder con ícono y acción |

---

## Internacionalización (i18n)

### Cómo funciona

1. `<ProveedorIdioma>` envuelve toda la app
2. `useTraduccion()` da acceso a `t()` y al idioma actual
3. `t('contactos.titulo')` devuelve el texto en el idioma activo

### Agregar un nuevo idioma

1. Crear `src/lib/i18n/{codigo}.ts` implementando el type `Traducciones`
2. Importarlo en `src/lib/i18n/index.tsx` y agregarlo al mapa
3. Agregar el código al tipo `Idioma` en `tipos.ts`

### Idiomas soportados

- `es` — Español (default)
- `en` — English
- `pt` — Português

---

## Multi-tenant

### Estrategia: Row Level Security (RLS)

- Una sola base de datos compartida
- Cada tabla tiene columna `empresa_id`
- RLS policy filtra automáticamente por empresa
- El JWT de Supabase Auth contiene `empresa_id` y `rol`

### Escalabilidad

| Escala | Solución |
|--------|----------|
| < 5K empresas | RLS single DB (actual) |
| 5K-50K | Connection pooling + read replicas |
| 50K+ | Sharding por región |

---

## Convenciones de código

1. Todo en español: componentes, variables, funciones, archivos
2. TypeScript estricto (`strict: true`)
3. Imports con alias `@/*` → `src/*`
4. Componentes reutilizables: si se repite, se extrae
5. Mobile-first responsive
6. Modales uniformes (mismo componente base)
