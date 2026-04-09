# Auditoría de Codebase — Flux by Salix

**Fecha:** 2026-04-08
**Alcance:** Todo el directorio `src/` del proyecto
**Método:** Análisis estático automatizado por área

---

## Tabla de contenidos

1. [Internacionalización (i18n)](#1-internacionalización-i18n)
2. [Colores hardcodeados](#2-colores-hardcodeados)
3. [Tipografía hardcodeada](#3-tipografía-hardcodeada)
4. [Valores mágicos / hardcodeados](#4-valores-mágicos--hardcodeados)
5. [Reutilización de componentes](#5-reutilización-de-componentes)
6. [Código muerto](#6-código-muerto)
7. [Comentarios y notas](#7-comentarios-y-notas)
8. [Documentación en español](#8-documentación-en-español)
9. [Responsividad](#9-responsividad)
10. [Accesibilidad básica](#10-accesibilidad-básica)
11. [Consistencia de estilos](#11-consistencia-de-estilos)
12. [Dependencias y configuración](#12-dependencias-y-configuración)
13. [Resumen ejecutivo](#resumen-ejecutivo)

---

## 1. Internacionalización (i18n)

### Estado actual
El sistema i18n está bien estructurado (`src/lib/i18n/`) con archivos para `es`, `en`, `pt`, tipos y un hook `useTraduccion()`. Sin embargo, **decenas de textos en JSX están hardcodeados en español** sin pasar por el sistema de traducción, y hay **11 claves faltantes** entre idiomas.

### Prioridad: **Alta**

### Hallazgos

#### A. Textos hardcodeados en JSX (~62+ instancias)

| Archivo | Línea(s) | Texto(s) |
|---------|----------|----------|
| `src/app/(flux)/calendario/configuracion/secciones/SeccionTiposEvento.tsx` | 252, 349 | "Editar", "Guardar", "Crear" |
| `src/app/(flux)/actividades/_componentes/ContenidoActividades.tsx` | 330, 810 | "Eliminar" |
| `src/app/(flux)/actividades/_componentes/ModalActividad.tsx` | 349 | "Guardar", "Crear y agendar", "Crear actividad" |
| `src/app/(flux)/actividades/configuracion/secciones/SeccionEstados.tsx` | 192, 243 | "Editar", "Guardar", "Crear estado" |
| `src/app/(flux)/inbox/_componentes/SeccionAgenteIA.tsx` | 739-740, 1579-1580 | "Editar", "Eliminar" |
| `src/app/(flux)/inbox/_componentes/CompositorCorreo.tsx` | 90 | "Eliminar" |
| `src/app/(flux)/inbox/_componentes/ModalEtiquetas.tsx` | 250 | "Cancelar" |
| `src/app/(flux)/inbox/_componentes/ModalNuevoWhatsApp.tsx` | 250 | "Sin plantillas aprobadas" |
| `src/app/(flux)/inbox/_componentes/SeccionAgenteIA.tsx` | 49 | "Te voy a comunicar con un agente..." |
| `src/app/(flux)/configuracion/secciones/SeccionEstructura.tsx` | 231-232, 813 | "Editar", "Eliminar", "Guardar", "Crear" |
| `src/app/(flux)/productos/_componentes/ModalProducto.tsx` | 330 | "Guardar", "Crear" |
| `src/componentes/entidad/_panel_chatter/EditorNota.tsx` | 212 | "Guardar", "Registrar" |
| `src/componentes/ui/SelectCreable.tsx` | 203, 226, 229 | "Cancelar", "Editar", "Eliminar" |
| `src/componentes/ui/ModalConfirmacion.tsx` | 51 | "Cancelar" (default prop) |

#### B. Headers de tablas/exportación hardcodeados

| Archivo | Línea(s) | Contenido |
|---------|----------|-----------|
| `src/app/api/contactos/exportar/route.ts` | 76-89 | 'Código', 'Tipo', 'Nombre', 'Apellido', 'Título', 'Correo', 'Teléfono', etc. |
| `src/app/api/asistencias/exportar/route.ts` | 80 | ['Empleado', 'Fecha', 'Entrada', 'Salida', 'Duración', 'Estado', 'Tipo', 'Método', 'Notas'] |
| `src/app/(flux)/presupuestos/_componentes/ContenidoPresupuestos.tsx` | 209 | ['Número', 'Estado', 'Cliente', 'Referencia', 'Moneda', 'Total', etc.] |
| `src/app/(flux)/contactos/_componentes/ContenidoContactos.tsx` | 245 | ['Código', 'Nombre', 'Tipo', 'Correo', 'WhatsApp', 'Teléfono', 'Dirección'] |
| `src/app/(flux)/inbox/_componentes/PanelInfoContacto.tsx` | 1183-1192 | 'Nombre', 'Teléfono', 'Correo', 'Dirección' |

#### C. Claves faltantes entre idiomas (11 claves)

Presentes en `es.ts` pero ausentes en `en.ts` y `pt.ts`:

- `calendario.vistas.agenda_corta`
- `calendario.vistas.anio_corta`
- `calendario.vistas.calendario_agenda`
- `calendario.vistas.calendario_quincenal`
- `calendario.vistas.calendario_semanal`
- `calendario.vistas.equipo_corta`
- `calendario.vistas.quincenal_corta`
- `calendario.vistas.semana_corta`
- `calendario.a11y.eventos_en_dia`
- `calendario.a11y.ir_a_hoy`
- `calendario.a11y.ir_dia_anterior`

#### D. Locales hardcodeados en formateo de fechas (12+ instancias)

| Archivo | Línea | Locale |
|---------|-------|--------|
| `src/app/api/kiosco/identificar/route.ts` | 34 | `'en-CA'` |
| `src/app/api/kiosco/fichar/route.ts` | 35 | `'en-CA'` |
| `src/app/api/asistencias/recordatorio/route.ts` | 30 | `'en-CA'` |
| `src/app/api/asistencias/heartbeat/route.ts` | 42 | `'en-CA'` |
| `src/app/api/asistencias/fichar/route.ts` | 35, 298 | `'en-CA'` |
| `src/app/api/asistencias/cron/route.ts` | 216 | `'en-CA'` |
| `src/app/(flux)/calendario/configuracion/secciones/SeccionFeriados.tsx` | 68, 74 | `'es'` |
| `src/app/(flux)/asistencias/_componentes/ModalCrearFichaje.tsx` | 159 | `'es-AR'` |
| `src/app/(flux)/presupuestos/_componentes/EditorPresupuesto.tsx` | 1143 | `'es-AR'` |
| `src/componentes/ui/IndicadorEditado.tsx` | 105 | `'es-AR'` |
| `src/componentes/kiosco/PantallaSolicitud.tsx` | 44 | `'es-AR'` |
| `src/lib/agente-ia/pipeline.ts` | 542 | `'en-US'` |

> **Nota:** Los `'en-CA'` en rutas API son para obtener formato `YYYY-MM-DD` (ISO-like), lo cual es un patrón válido pero debería documentarse o usar una función utilitaria.

### Recomendación
1. Crear claves de traducción para todas las acciones comunes (`acciones.guardar`, `acciones.cancelar`, `acciones.eliminar`, etc.) y reemplazar strings hardcodeados
2. Sincronizar las 11 claves faltantes en `en.ts` y `pt.ts`
3. Crear una utilidad `formatearFechaISO()` para reemplazar los `toLocaleDateString('en-CA')`
4. Mover headers de exportación al sistema de traducción

---

## 2. Colores hardcodeados

### Estado actual
El proyecto tiene un excelente sistema de design tokens en `src/estilos/tokens.css` con variables CSS semánticas. Sin embargo, los **componentes de kiosco son el mayor infractor** con ~90+ valores hex hardcodeados. También hay colores hardcodeados en la preview de WhatsApp y algunos componentes de portal.

### Prioridad: **Alta**

### Hallazgos

#### A. Componentes Kiosco (~80+ violaciones)

El subsistema kiosco usa colores hex inline extensivamente en lugar de tokens:

| Archivo | Violaciones | Colores frecuentes |
|---------|-------------|-------------------|
| `src/componentes/kiosco/PantallaSolicitud.tsx` | ~30+ | `#18181b`, `#27272a`, `#a1a1aa`, `#f4f4f5`, `#52525b`, `#d4d4d8` |
| `src/componentes/kiosco/PantallaAcciones.tsx` | ~20+ | `#fcd34d`, `#7dd3fc`, `#86efac`, `#fca5a5`, `#f4f4f5` |
| `src/componentes/kiosco/PantallaConfirmacion.tsx` | ~10+ | `#4ade80`, `#fb923c`, `#facc15`, confeti con 8 colores hex |
| `src/componentes/kiosco/PantallaEspera.tsx` | ~8 | `#18181b`, `#27272a`, `#a1a1aa`, `#4ade80` |
| `src/componentes/kiosco/TecladoPIN.tsx` | ~8 | `#f8fafc`, `#27272a`, `#18181b`, `#94a3b8` |

> **Nota:** `globals.css` (líneas 714-742) ya define variables `--kiosco-*` pero los componentes no las usan, usando hex directo en su lugar.

#### B. Preview WhatsApp (~12 violaciones)

| Archivo | Línea(s) | Descripción |
|---------|----------|-------------|
| `src/app/(flux)/inbox/_componentes/ModalEditorPlantillaWA.tsx` | 1019-1074 | Colores de interfaz WhatsApp: `#075e54`, `#e5ddd5`, `#fff`, `#999`, `#8696a0`, `#00a5f4`, `#f0f2f5` |
| `src/app/(flux)/inbox/_componentes/PanelWhatsApp.tsx` | 80-81 | `#53bdeb` (check de lectura WhatsApp) |

#### C. Otros componentes

| Archivo | Línea | Color |
|---------|-------|-------|
| `src/app/kiosco/page.tsx` | 103 | `borderColor: '#333'` |
| `src/componentes/marca/SplashSalix.tsx` | 45 | `z-[9999]` (no color, pero z-index excesivo) |

### Recomendación
1. **Prioridad 1:** Migrar componentes kiosco a usar las variables `--kiosco-*` ya definidas en globals.css
2. **Prioridad 2:** Extraer colores de WhatsApp a variables `--whatsapp-*` en tokens.css
3. **Prioridad 3:** Centralizar `COLORES_CONFETI` como constante referenciando tokens

---

## 3. Tipografía hardcodeada

### Estado actual
La mayoría del proyecto usa clases Tailwind correctamente. Los principales infractores son los componentes kiosco (con `clamp()` inline), `global-error.tsx` y la preview de PDF.

### Prioridad: **Media**

### Hallazgos

#### A. Font sizes hardcodeados

| Archivo | Línea(s) | Valor |
|---------|----------|-------|
| `src/app/global-error.tsx` | 52, 55, 58, 72, 97 | `3.5rem`, `1.25rem`, `0.875rem`, `0.7rem` |
| `src/componentes/kiosco/PantallaConfirmacion.tsx` | 209, 214, 218 | `clamp(1.5rem, 5vw, 2.5rem)`, `clamp(0.9rem, 2.5vw, 1.25rem)` |
| `src/componentes/kiosco/PantallaEspera.tsx` | 84 | `clamp(1rem, 2.5vw, 1.25rem)` |
| `src/componentes/kiosco/TecladoPIN.tsx` | 51 | `clamp(1.25rem, 4vw, 1.75rem)` |
| `src/componentes/ui/_editor_texto/ToolbarEditorTexto.tsx` | 229 | `fontSize: t.px \|\| '14px'` |
| `src/app/(flux)/presupuestos/_componentes/PreviewsPdf.tsx` | 97, 102, 330 | `10px`, `7px`, `0.65em` (contexto de PDF — parcialmente legítimo) |

#### B. Font weight hardcodeado

| Archivo | Línea(s) | Valor |
|---------|----------|-------|
| `src/app/global-error.tsx` | 55, 71, 86 | `600`, `500`, `500` |
| `src/componentes/kiosco/PantallaSolicitud.tsx` | 164, 176 | Ternario `700 : 400` inline |

#### C. Font family hardcodeado

| Archivo | Línea | Valor |
|---------|-------|-------|
| `src/app/global-error.tsx` | 41 | `'system-ui, -apple-system, sans-serif'` (debería usar `var(--fuente-sans)`) |

### Recomendación
1. Extraer valores `clamp()` de kiosco a clases CSS utilitarias o variables
2. Refactorizar `global-error.tsx` para usar tokens/Tailwind (es la página de error global, altamente visible)
3. Los font sizes de PreviewsPdf.tsx son parcialmente legítimos (configurables por usuario) — documentar cuáles son dinámicos

---

## 4. Valores mágicos / hardcodeados

### Estado actual
Hay **timeouts numéricos dispersos** por todo el codebase sin constantes nombradas, **URLs de APIs externas** hardcodeadas en archivos de implementación, y **constantes duplicadas** entre archivos.

### Prioridad: **Alta**

### Hallazgos

#### A. Timeouts sin constante nombrada

| Valor | Ocurrencias | Archivos ejemplo |
|-------|-------------|-----------------|
| `5000ms` | 9 | Múltiples hooks y componentes |
| `3000ms` | 5 | Delays de carga/acción |
| `2000ms` | 6 | Transiciones varias |
| `1500ms` | 3 | Delays específicos |
| `300ms` | 8 | Debounce/animación |
| `8000ms` | 2 | `src/middleware.ts:54` (timeout de auth) |
| `60000ms` | 2 | Intervalo de heartbeat |
| `4000ms` | 2 | `src/componentes/kiosco/PantallaConfirmacion.tsx:123`, `src/hooks/useAutoguardado.tsx:39` |

Archivos destacados:
- `src/hooks/useSonido.tsx` (líneas 62-100): Frecuencias de audio hardcodeadas (600, 400, 250, 700, 900, 659, 784...)
- `src/middleware.ts:54`: Timeout de auth `8000ms`

#### B. URLs/endpoints hardcodeados

| Archivo | Línea | URL/Servicio |
|---------|-------|-------------|
| `src/lib/whatsapp.ts` | 8 | Meta Graph API URL |
| `src/lib/pdf/generar-pdf.ts` | 79 | URL de descarga Chromium v143.0.4 |
| `src/lib/outlook.ts` | 16-17 | MS Graph URLs |
| `src/lib/google-drive.ts` | 15-17 | Google Drive auth scopes |
| `src/lib/agente-ia/validar-direccion.ts` | 27, 49 | Google Places API URLs |
| `src/lib/agente-ia/embeddings.ts` | 15 | OpenAI embeddings URL |
| `src/lib/agente-ia/pipeline.ts` | 645 | OpenAI chat completions URL |
| `src/componentes/entidad/WidgetJornada.tsx` | 299 | OpenStreetMap reverse geocoding URL |
| `src/componentes/entidad/Header.tsx` | 283 | URL de contacto WhatsApp con teléfono hardcodeado |
| `src/app/api/kiosco/terminales/route.ts` | 60, 181 | URLs de setup con dominio hardcodeado |
| `src/app/(portal)/portal/[token]/_componentes/PiePortal.tsx` | 82 | URL website Salix |

#### C. Constantes duplicadas entre archivos

| Constante | Archivos |
|-----------|----------|
| `ETIQUETA_METODO` | `ModalEditarFichaje.tsx:119`, `ContenidoAsistencias.tsx:45`, `api/asistencias/exportar/route.ts:122` |
| `MAX_TODO_DIA = 2` | `VistaCalendarioQuincenal.tsx:45`, `VistaCalendarioSemana.tsx:50` |

#### D. Z-index sin escala definida

| Archivo | Línea | Valor |
|---------|-------|-------|
| `src/componentes/marca/SplashSalix.tsx` | 45 | `z-[9999]` (excesivo) |
| `src/app/globals.css` | 577-613 | Múltiples `z-50` |
| `src/app/(flux)/inbox/page.tsx` | 1997 | `z-10` |
| `src/app/(flux)/contactos/[id]/page.tsx` | 1171, 1290 | `z-20` |

### Recomendación
1. Crear `src/lib/constantes/timeouts.ts` con nombres descriptivos (`TIMEOUT_AUTH`, `DEBOUNCE_BUSQUEDA`, etc.)
2. Crear `src/lib/constantes/api-urls.ts` para centralizar URLs externas
3. Consolidar `ETIQUETA_METODO` en un archivo compartido
4. Definir escala de z-index en tokens (`--z-dropdown`, `--z-modal`, `--z-splash`, etc.)

---

## 5. Reutilización de componentes

### Estado actual
Excelente librería de 55+ componentes base en `src/componentes/ui/` y 28+ hooks custom. Sin embargo, hay **componentes excesivamente grandes** (hasta 2,800 líneas), **~51 inputs raw** que no usan el componente `Input`, y **407 instancias de `style=` inline** en componentes.

### Prioridad: **Media**

### Hallazgos

#### A. Componentes excesivamente grandes (>500 líneas)

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `src/app/(flux)/usuarios/[id]/page.tsx` | 2,808 | Página de detalle usuario — monolítica |
| `src/app/(flux)/inbox/configuracion/page.tsx` | 2,636 | Configuración de inbox |
| `src/app/(flux)/presupuestos/_componentes/EditorPresupuesto.tsx` | 2,388 | Editor de presupuestos |
| `src/app/(flux)/inbox/page.tsx` | 2,179 | Página principal de inbox |
| `src/app/(flux)/inbox/_componentes/SeccionAgenteIA.tsx` | 2,037 | Configuración agente IA |
| `src/componentes/ui/SelectorIcono.tsx` | 714 | Selector de iconos |
| `src/componentes/ui/SelectorFecha.tsx` | 547 | Date picker |
| `src/componentes/ui/SelectorVariables.tsx` | 504 | Selector de variables |
| `src/componentes/ui/SelectorHora.tsx` | 399 | Time picker |
| `src/componentes/ui/SelectorColor.tsx` | 395 | Color picker |

#### B. Inputs raw en lugar del componente Input (~51 instancias)

| Archivo | Descripción |
|---------|-------------|
| `src/app/kiosco/page.tsx` | Líneas 193-208: inputs de texto/password con estilos inline |
| `src/app/(flux)/calendario/_componentes/ModalEvento.tsx` | Inputs raw de texto |
| `src/app/(flux)/inbox/_componentes/ModalNuevoWhatsApp.tsx` | Inputs custom |
| Múltiples archivos en `src/app/` | ~51 elementos `<input>` que no usan el componente `Input` |

#### C. Estilos inline excesivos

- **407 instancias** de `style=` en `src/componentes/`
- Muchos son para colores dinámicos (parcialmente legítimo) pero deberían extraerse a un hook/wrapper
- Portal: todos los componentes en `src/app/(portal)/portal/[token]/_componentes/` aplican `colorMarca` manualmente

#### D. Padding/spacing inconsistente

- `gap-1`: 370 usos, `gap-2`: 494, `gap-3`: 249, `gap-4`: 71, `gap-5`: 3, `gap-6`: 11
- `px-2`: 146, `px-3`: 226, `px-4`: 138, `px-5`: 63, `px-6`: 25
- No hay escala de spacing consistente documentada

### Recomendación
1. Dividir los componentes >2,000 líneas en sub-componentes composables
2. Reemplazar inputs raw por el componente `Input` base
3. Crear un `useColorMarca()` hook o `<TemaPortal>` wrapper para eliminar inline styles repetidos
4. Documentar escala de spacing (4, 8, 12, 16, 24, 32, 48)

---

## 6. Código muerto

### Estado actual
El codebase está relativamente limpio. No se detectaron bloques grandes de código comentado ni archivos huérfanos. Los console statements son mayoritariamente `console.error` en manejadores de errores (legítimos). Solo se encontraron **2 TODOs** pendientes y **1 variable siempre-true**.

### Prioridad: **Baja**

### Hallazgos

#### A. TODOs sin resolver

| Archivo | Línea | Contenido |
|---------|-------|-----------|
| `src/app/(flux)/inbox/_componentes/_helpers/validarRequisitosEtapa.ts` | 33 | `// TODO: requiere datos expandidos del contacto con direccion` — validación stubbed (`() => true`) |
| `src/componentes/entidad/PanelChatter.tsx` | 589 | `// TODO: abrir modal de edición con la actividad cargada` — feature incompleto |

#### B. Variables siempre-true

| Archivo | Línea | Descripción |
|---------|-------|-------------|
| `src/componentes/entidad/PanelChatter.tsx` | 359 | `const tieneWhatsApp = true` — constante siempre true, debería eliminarse o implementarse la lógica real |

#### C. Console statements

- **~353 console statements** en total, casi todos `console.error` y `console.warn` en handlers de error — **legítimos para producción**
- No se detectaron `console.log` de debug abandonados

#### D. Constante duplicada (también en sección 4)

- `ETIQUETA_METODO` definida en 3 archivos distintos — una sola fuente de verdad bastaría

### Recomendación
1. Resolver los 2 TODOs o convertirlos en issues tracked
2. Eliminar o implementar `tieneWhatsApp` en PanelChatter
3. Consolidar `ETIQUETA_METODO` en archivo compartido

---

## 7. Comentarios y notas

### Estado actual
Solo 2 TODOs encontrados (listados en sección 6). No se detectaron bloques significativos de código comentado ni mensajes de debug olvidados.

### Prioridad: **Baja**

### Hallazgos

- Los 2 TODOs están documentados en la sección 6.A
- No se encontraron FIXME, HACK, ni XXX
- No se encontraron bloques de código comentado significativos
- Los console.error son apropiados para manejo de errores en producción

### Recomendación
Mantener la disciplina actual. Los TODOs deberían resolverse o moverse a issues.

---

## 8. Documentación en español

### Estado actual
El proyecto sigue correctamente la convención de nombrar todo en español. El sistema de i18n tiene tipos bien definidos en `tipos.ts` (1,206 líneas). Los componentes base en `src/componentes/ui/` tienen buena arquitectura con interfaces TypeScript.

### Prioridad: **Baja**

### Hallazgos

- La estructura de archivos, nombres de funciones, variables y componentes siguen la convención español
- Los hooks tienen nombres descriptivos en español (`useAutoguardado`, `useSonido`, `useModoConcentracion`)
- Los componentes base (`Boton`, `Input`, `Modal`, `Select`) tienen interfaces TypeScript correctas
- **Oportunidad de mejora:** Los componentes >1,000 líneas se beneficiarían de un bloque JSDoc al inicio explicando la arquitectura interna

### Recomendación
Agregar bloques descriptivos al inicio de los archivos más complejos (>1,000 líneas) explicando la estructura y responsabilidades.

---

## 9. Responsividad

### Estado actual
El proyecto usa Tailwind pero con **cobertura responsive muy limitada** — solo ~49 clases responsive (`sm:`, `md:`, `lg:`) en todo `src/app/`. Hay componentes con anchos fijos que pueden romper en móvil, y touch targets demasiado pequeños.

### Prioridad: **Alta**

### Hallazgos

#### A. Componentes con anchos fijos problemáticos

| Archivo | Línea(s) | Valor | Problema |
|---------|----------|-------|----------|
| `src/componentes/kiosco/TecladoPIN.tsx` | 71, 104 | `w-[280px]` | Desborda en pantallas <320px |
| `src/app/(flux)/inbox/_componentes/VistaPipeline.tsx` | 182, 242 | `w-[260px] sm:w-[280px]` | Solo 2 breakpoints, sin escalado para pantallas grandes |
| `src/app/(flux)/asistencias/_componentes/VistaMatriz.tsx` | 548 | `w-[120px]`/`w-[160px]`/`w-[140px]` | Múltiples anchos fijos condicionados |
| `src/app/(flux)/asistencias/matriz/page.tsx` | 189, 196 | `min-w-[140px]`, `w-[100px]` | Se comprime en tablets portrait |
| `src/app/(flux)/presupuestos/_componentes/TablaLineas.tsx` | 201, 203, 329 | `w-[100px]`, `min-w-[80px]` | Puede romper en <375px |
| `src/app/(flux)/presupuestos/configuracion/plantilla/page.tsx` | 462 | `w-[220px]` | Sidebar sin variante responsive |
| `src/app/(flux)/presupuestos/configuracion/page.tsx` | 824, 851 | `max-w-[100px]`, `max-w-[120px]` | Inputs muy estrechos, texto truncado |

#### B. Componentes sin variantes responsive

| Archivo | Línea(s) | Descripción |
|---------|----------|-------------|
| `src/app/(flux)/vitrina/page.tsx` | 980, 992, 1149, 1435 | `max-w-[400px]`, `max-w-[1000px]` sin breakpoints |
| `src/app/(flux)/asistencias/configuracion/page.tsx` | 216, 234, 478, 502, 605 | Múltiples `max-w-[200-400px]` sin variantes responsive |

#### C. Touch targets demasiado pequeños

| Archivo | Línea | Tamaño | Mínimo recomendado |
|---------|-------|--------|-------------------|
| `src/componentes/ui/Insignia.tsx` | 39 | `size-3.5` (14px) | 44px |
| `src/componentes/entidad/NotificationsHeader.tsx` | 153 | `min-w-[16px] h-4` (16px) | 44px |

#### D. Tablas con overflow horizontal

- `src/app/(flux)/asistencias/matriz/page.tsx`: La tabla matriz con columnas de fecha necesita scroll horizontal en móvil (tiene `overflow-auto`, pero la experiencia no es ideal)
- `src/app/(flux)/presupuestos/_componentes/TablaLineas.tsx`: Tabla de productos con scroll horizontal

### Recomendación
1. Aumentar touch targets a mínimo 44px (especialmente Insignia y NotificationsHeader)
2. Agregar variantes `sm:`/`md:` a componentes con anchos fijos
3. Hacer el TecladoPIN responsive (`w-full max-w-[280px]`)
4. Revisar las páginas de configuración para mejorar layout en móvil

---

## 10. Accesibilidad básica

### Estado actual
El componente `Modal.tsx` tiene excelente implementación de accesibilidad (focus trap, escape, aria-modal). El componente `Boton.tsx` implementa aria-label fallback. Sin embargo, hay **inputs sin labels**, **imágenes sin alt** y **muy pocos aria-labels** en general (~40 total en todo el proyecto).

### Prioridad: **Alta**

### Hallazgos

#### A. Formularios sin labels (WCAG 2.1 Level A)

| Archivo | Línea(s) | Descripción |
|---------|----------|-------------|
| `src/app/kiosco/page.tsx` | 193-208 | 2 inputs (texto y password) solo con placeholder, sin `<label>` ni `aria-label` |
| Múltiples archivos | — | ~51 inputs raw sin componente Input (que sí maneja labels) |

#### B. Imágenes sin alt o con alt vacío

| Archivo | Línea(s) | Descripción |
|---------|----------|-------------|
| `src/app/(flux)/inbox/_componentes/PanelWhatsApp.tsx` | 1613, 1681, 2034 | `alt=""` en imágenes de contenido (mensajes de chat) — debería ser descriptivo |
| `src/app/(flux)/inbox/_componentes/PanelInterno.tsx` | — | Imágenes sin verificación de alt |
| `src/app/(flux)/inbox/_componentes/PanelCorreo.tsx` | — | Imágenes sin alt |

#### C. Botones de solo icono sin label accesible

- Solo **13 instancias** de `aria-label` en `src/componentes/` y **27 en `src/app/`**
- Muchos botones `soloIcono` probablemente carecen de aria-label
- `Boton.tsx` tiene el mecanismo (línea 102) pero los consumidores no siempre lo usan

#### D. Divs con onClick sin soporte de teclado

- Algunos divs con `onClick` sin `role="button"`, `tabIndex`, ni `onKeyDown`
- Especialmente en componentes de portal y kiosco

### Recomendación
1. Agregar `aria-label` a los inputs de `kiosco/page.tsx`
2. Reemplazar `alt=""` por texto descriptivo en imágenes de contenido en PanelWhatsApp
3. Auditar todos los `soloIcono` buttons y agregar aria-labels
4. Agregar `role="button"` y soporte de teclado a divs clickeables

---

## 11. Consistencia de estilos

### Estado actual
Buena decisión arquitectónica: **Tailwind puro** sin mezcla de CSS modules ni styled-components. CSS global solo en `globals.css`. Sin embargo, hay **407 inline styles** en componentes y las **clases responsive son muy escasas** (~49 en total).

### Prioridad: **Media**

### Hallazgos

#### A. Mezcla Tailwind + inline styles

- **407 instancias** de `style=` en `src/componentes/`
- Legítimos: colores dinámicos (`colorMarca`, `tipo.color`, etc.)
- Evitables: fondos, bordes y tipografía hardcodeada (especialmente en kiosco)

#### B. Cobertura responsive insuficiente

- Solo ~49 clases responsive en `src/app/` — muy bajo para una app mobile-first
- Algunos componentes usan `max-w-*` sin breakpoints
- No hay estrategia mobile-first documentada

#### C. Variables CSS vs clases Tailwind

- Se usan ambos: `var(--texto-marca)` en inline styles y `text-texto-primario` en clases Tailwind
- No hay regla clara de cuándo usar cada uno

### Recomendación
1. Documentar regla: clases Tailwind para estáticos, `var()` solo para valores dinámicos
2. Incrementar cobertura responsive como parte de sprints de UI
3. Extraer patrones de estilos inline repetidos a clases utilitarias

---

## 12. Dependencias y configuración

### Estado actual
El proyecto está bien organizado en sus dependencias principales. Se detectaron **2-3 dependencias potencialmente no usadas** y todas las demás están correctamente justificadas.

### Prioridad: **Baja**

### Hallazgos

#### A. Dependencias potencialmente no usadas

| Paquete | Versión | Estado |
|---------|---------|--------|
| `pdf-parse` | v2.4.5 | **No se encontraron imports** en `src/` — probablemente sin usar |
| `puppeteer-core` + `@sparticuz/chromium-min` | v24.40.0 / v143.0.4 | **No visible en imports directos** — puede estar usado via `require()` dinámico en rutas API de PDF |

#### B. Dependencias legítimas verificadas

| Paquete | Uso |
|---------|-----|
| `date-fns` | 4 archivos — formateo de fechas general |
| `date-holidays` | 4 archivos — cálculo de feriados |
| `firebase` + `firebase-admin` | 2 archivos — push notifications (client + server) |
| `@supabase/supabase-js` + `@supabase/ssr` | Separación correcta client/server |
| `drizzle-orm` + `postgres` + `drizzle-kit` | Stack de ORM completo |
| `@tanstack/react-query` | Caching de datos |
| `lucide-react` | Iconografía consistente |
| `@tiptap/*` | Editor de texto rico |
| `@dnd-kit/*` | Drag and drop |
| `@breezystack/lamejs` | Conversión de audio (1 archivo) |

### Recomendación
1. Verificar `pdf-parse` — si no se usa, eliminar del `package.json`
2. Verificar `puppeteer-core` en rutas API de generación PDF (puede usar `require()` dinámico)

---

## Resumen ejecutivo

### Los 5 problemas más críticos

| # | Problema | Impacto | Archivos afectados | Esfuerzo estimado |
|---|---------|---------|--------------------|--------------------|
| **1** | **Textos hardcodeados sin i18n** — 62+ strings en JSX + headers de exportación que rompen al cambiar idioma | Alto — la app no es funcional en EN/PT | ~20 archivos | Medio (2-3 días) |
| **2** | **Colores hex hardcodeados en kiosco** — 90+ violaciones de design tokens, dificultando temas y mantenimiento | Medio — afecta consistencia visual y dark mode | 6 archivos kiosco | Medio (1-2 días) |
| **3** | **Accesibilidad básica** — inputs sin labels, imágenes sin alt, botones sin aria-label | Alto — incumple WCAG 2.1 Level A | ~15 archivos | Bajo (1 día) |
| **4** | **Valores mágicos dispersos** — timeouts, URLs, constantes duplicadas sin centralizar | Medio — dificulta mantenimiento y configuración | ~30 archivos | Bajo (1 día) |
| **5** | **Componentes >2,000 líneas** — 4 archivos monolíticos difíciles de mantener y testear | Medio — deuda técnica creciente | 4 archivos | Alto (3-5 días) |

### Métricas generales

| Métrica | Valor |
|---------|-------|
| Textos hardcodeados en JSX | ~62+ |
| Claves i18n faltantes | 11 |
| Colores hex hardcodeados | ~90+ |
| Font sizes hardcodeados | ~25+ |
| Instancias de inline `style=` | ~407 |
| Timeouts sin constante | ~40+ |
| URLs hardcodeadas | ~15 |
| TODOs sin resolver | 2 |
| Console statements (legítimos) | ~353 |
| Inputs raw sin componente Input | ~51 |
| Touch targets < 44px | 2 |
| Componentes >2,000 líneas | 4 |
| Clases responsive en src/app/ | ~49 (muy bajo) |
| Dependencias potencialmente sin usar | 1-2 |

### Plan de acción sugerido

**Sprint 1 — Fundamentos (1 semana):**
- Centralizar textos de acciones en i18n (`acciones.guardar`, `acciones.cancelar`, etc.)
- Sincronizar claves faltantes en EN/PT
- Agregar aria-labels y form labels faltantes
- Crear `constantes/timeouts.ts` y `constantes/api-urls.ts`

**Sprint 2 — Design system (1 semana):**
- Migrar componentes kiosco a usar variables `--kiosco-*`
- Aumentar touch targets a 44px mínimo
- Reemplazar inputs raw por componente `Input`
- Consolidar constantes duplicadas

**Sprint 3 — Refactoring (2 semanas):**
- Dividir componentes >2,000 líneas en sub-componentes
- Extraer hook `useColorMarca()` para portal
- Mejorar cobertura responsive con clases `sm:`/`md:`/`lg:`
- Eliminar dependencias no usadas
