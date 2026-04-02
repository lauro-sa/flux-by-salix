# Flux by Salix — Sistema de Tokens de Diseño

## Tipografía (3 escalas)

| Clase | Normal | Compacto | Cómodo | Uso |
|-------|--------|----------|--------|-----|
| `text-xxs` | 10px | 9px | 11px | Badges, contadores, metadatos mínimos |
| `text-xs` | 11px | 10px | 12px | Labels secundarios, timestamps |
| `text-sm` | 13px | 12px | 14px | UI principal, botones, inputs, nav |
| `text-base` | 14px | 13px | 15px | Cuerpo de texto, párrafos |
| `text-md` | 15px | 14px | 16px | Texto destacado |
| `text-lg` | 17px | 16px | 18px | Títulos de sección (h3) |
| `text-xl` | 20px | 18px | 22px | Títulos de página secundarios (h2) |
| `text-2xl` | 24px | 22px | 26px | Títulos de página principales (h1) |
| `text-3xl` | 30px | 28px | 32px | Héroe / landing |

**Fuentes:** Inter (sans), JetBrains Mono (mono)
**Letter-spacing:** -0.011em (tracking sutil estilo Linear)
**Line-height base:** 1.6

---

## Colores de texto

| Token | Modo Claro | Modo Oscuro | Uso |
|-------|------------|-------------|-----|
| `--texto-primario` | `#1a1a1a` | `#f0f0f0` | Texto principal |
| `--texto-secundario` | `#737373` | `#a1a1a1` | Texto secundario |
| `--texto-terciario` | `#a3a3a3` | `#666666` | Texto terciario, placeholders |
| `--texto-inverso` | `#ffffff` | `#ffffff` | Texto sobre fondos oscuros |
| `--texto-marca` | `#5b5bd6` (índigo) | `#e8922a` (ámbar) | Acento de marca |

---

## Superficies / Fondos

| Token | Modo Claro | Modo Oscuro | Uso |
|-------|------------|-------------|-----|
| `--superficie-app` | `#ffffff` | `#09090b` | Fondo general de la app |
| `--superficie-tarjeta` | `#ffffff` | `#111113` | Tarjetas, paneles |
| `--superficie-elevada` | `#ffffff` | `#18181b` | Modales, dropdowns |
| `--superficie-sidebar` | `#fafafa` | `#09090b` | Sidebar |
| `--superficie-hover` | `#f5f5f5` | `#18181b` | Hover de elementos |
| `--superficie-activa` | `#efefef` | `rgba(255,255,255,0.08)` | Elemento activo/presionado |
| `--superficie-seleccionada` | `rgba(91,91,214,0.08)` | `rgba(232,146,42,0.1)` | Fila/item seleccionado |

### Superficies ancladas (celdas sticky en tablas, siempre opacas)

| Token | Modo Claro | Modo Oscuro |
|-------|------------|-------------|
| `--superficie-anclada` | `#ffffff` | `#111113` |
| `--superficie-anclada-alterna` | `#f9f9f9` | `#18181b` |
| `--superficie-anclada-seleccionada` | `#eeeef8` | `#1a1a2e` |

---

## Bordes

| Token | Modo Claro | Modo Oscuro | Uso |
|-------|------------|-------------|-----|
| `--borde-sutil` | `#e5e5e5` | `#1f1f23` | Separadores, bordes suaves |
| `--borde-fuerte` | `#d4d4d4` | `rgba(255,255,255,0.12)` | Bordes visibles |
| `--borde-foco` | `#5b5bd6` | `#e8922a` | Ring de focus en inputs |

---

## Insignias / Badges (10 variantes)

Cada variante tiene 3 tokens: color base, fondo, texto.

| Variante | Color base | Fondo claro | Fondo oscuro | Texto claro | Texto oscuro |
|----------|-----------|-------------|--------------|-------------|--------------|
| **exito** | `#059669` | `#ecfdf5` | `rgba(5,150,105,0.15)` | `#065f46` | `#6ee7b7` |
| **peligro** | `#dc2626` | `#fef2f2` | `rgba(220,38,38,0.15)` | `#991b1b` | `#fca5a5` |
| **advertencia** | `#d97706` | `#fffbeb` | `rgba(217,119,6,0.15)` | `#92400e` | `#fcd34d` |
| **info** | `#2563eb` | `#eff6ff` | `rgba(37,99,235,0.15)` | `#1e40af` | `#93c5fd` |
| **primario** | `#5b5bd6` | `rgba(91,91,214,0.08)` | `rgba(232,146,42,0.15)` | `#4343a8` | `#fbbf24` |
| **neutro** | `#6b7280` | `#f3f4f6` | `rgba(107,114,128,0.15)` | `#374151` | `#d1d5db` |
| **rosa** | `#db2777` | `#fdf2f8` | `rgba(219,39,119,0.15)` | `#9d174d` | `#f9a8d4` |
| **cyan** | `#0891b2` | `#ecfeff` | `rgba(8,145,178,0.15)` | `#155e75` | `#67e8f9` |
| **violeta** | `#7c3aed` | `#f5f3ff` | `rgba(124,58,237,0.15)` | `#5b21b6` | `#c4b5fd` |
| **naranja** | `#ea580c` | `#fff7ed` | `rgba(234,88,12,0.15)` | `#9a3412` | `#fdba74` |

---

## Canales de mensajería

| Canal | Color | Fondo claro | Fondo oscuro |
|-------|-------|-------------|--------------|
| WhatsApp | `#25d366` | `#ecfdf5` | `rgba(37,211,102,0.12)` |
| Correo | `#2563eb` | `#eff6ff` | `rgba(37,99,235,0.12)` |
| Interno | `#7c3aed` | `#f5f3ff` | `rgba(124,58,237,0.12)` |

---

## Estados de entidades

| Estado | Color | Fondo claro | Fondo oscuro |
|--------|-------|-------------|--------------|
| Borrador | `#9ca3af` | `#f3f4f6` | `rgba(107,114,128,0.15)` |
| Pendiente | `#d97706` | `#fffbeb` | `rgba(217,119,6,0.15)` |
| Completado | `#059669` | `#ecfdf5` | `rgba(5,150,105,0.15)` |
| Error | `#dc2626` | `#fef2f2` | `rgba(220,38,38,0.15)` |
| Cancelado | `#6b7280` | `#f3f4f6` | `rgba(107,114,128,0.15)` |

---

## Colores de secciones/módulos

| Sección | Color |
|---------|-------|
| Contactos | `#5b5bd6` |
| Actividades | `#d97706` |
| Documentos | `#2563eb` |
| Asistencias | `#059669` |
| Visitas | `#7c3aed` |
| Inbox | `#0891b2` |
| Productos | `#db2777` |
| Órdenes | `#ea580c` |
| Calendario | `#0d9488` |
| Auditoría | `#6b7280` |

---

## Sombras

| Token | Modo Claro | Modo Oscuro | Uso |
|-------|------------|-------------|-----|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | `0 1px 2px rgba(0,0,0,0.2)` | Tarjetas |
| `shadow-md` | `0 2px 8px rgba(0,0,0,0.06)` | `0 2px 8px rgba(0,0,0,0.3)` | Dropdowns |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.08)` | `0 8px 24px rgba(0,0,0,0.4)` | Modales |
| `shadow-elevada` | `0 16px 48px rgba(0,0,0,0.12)` | `0 16px 48px rgba(0,0,0,0.5)` | Sheets flotantes |
| `shadow-foco` | `0 0 0 3px var(--insignia-primario-fondo)` | igual | Ring de focus |

---

## Radios de borde

| Token | Valor | Uso |
|-------|-------|-----|
| `rounded-sm` | 6px | Inputs, badges |
| `rounded-md` | 8px | Tarjetas, botones |
| `rounded-lg` | 12px | Modales, paneles |
| `rounded-xl` | 16px | Sheets grandes |
| `rounded-full` | 9999px | Avatares, píldoras |

---

## Transiciones

| Token | Duración | Uso |
|-------|----------|-----|
| `duration-rapida` | 120ms | Hovers, focus |
| `duration-normal` | 200ms | Cambios de estado |
| `duration-lenta` | 300ms | Modales, paneles |

---

## Tamaños de iconos (Lucide React)

| Tamaño | Uso |
|--------|-----|
| 14px | Dentro de texto (badges, labels) |
| 16px | Botones, acciones del header |
| 18px | Navegación del sidebar |
| 48px | Estados vacíos, héroe |

---

## Modo Cristal (efecto glass)

3 niveles: **sólido** (default), **semi-cristal**, **cristal completo**.

| Nivel | Blur panel | Blur flotante | Saturación |
|-------|-----------|---------------|------------|
| Sólido | 0 | 0 | 1 |
| Semi-cristal | 8px | 16px | 1.1–1.2 |
| Cristal | 14px | 32px | 1.3–1.5 |

Se combina con 3 fondos gradiente: **aurora** (violeta+cyan+verde), **medianoche** (azul+índigo), **ámbar** (naranja+dorado).

Las superficies pasan de opacas a translúcidas (ej: tarjeta oscura va de `#111113` opaco a `rgba(17,17,19,0.55)` en cristal completo).

---

## Layout

| Token | Valor |
|-------|-------|
| `--sidebar-ancho` | 240px |
| `--sidebar-ancho-colapsado` | 56px |
| `--header-alto` | 54px |

## Z-Index

| Token | Valor |
|-------|-------|
| `--z-dropdown` | 40 |
| `--z-modal` | 50 |
| `--z-popover` | 9999 |

---

## Notas de uso

- **Stack:** Next.js 15 + React 19 + Tailwind CSS 4 + Framer Motion
- **Clases Tailwind:** Se usan como `bg-superficie-tarjeta`, `text-texto-primario`, `border-borde-sutil`, etc.
- **Nunca** usar colores hex/rgb hardcodeados en componentes
- **Nunca** usar `text-[Xpx]` arbitrarios — solo las clases `text-xxs` a `text-3xl`
- **Estilo visual:** Plano y limpio, inspirado en Attio/Linear/Notion
- **Mobile-first**, dark/light mode automático + toggle manual
- **Micro-interacciones** sutiles con Framer Motion (nunca exageradas)
