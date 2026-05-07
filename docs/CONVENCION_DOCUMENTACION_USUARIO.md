# 📘 Convención para escribir documentación de usuario (por módulo)

Este documento define cómo escribir la documentación de usuario final que se muestra dentro de la app en `/documentacion/<modulo>`. Mantenelo actualizado a medida que el patrón evolucione, así toda la documentación queda consistente.

---

## 🎯 Filosofía

Las guías se escriben **para usuarios finales** (no técnicos). El lector puede ser:

- Una persona que abre Flux por primera vez.
- Un cliente que contrata Flux y nunca usó un CRM.
- Un empleado nuevo de una empresa que ya usa Flux.

Reglas base:

- ✅ **Lenguaje claro y directo.** Frases cortas. Sin jerga técnica.
- ✅ **Tono cercano.** Tutealos ("vos", "tenés", "podés").
- ✅ **Ejemplos concretos siempre.** Mostrar el caso real, no descripciones abstractas.
- ✅ **Saltos de línea generosos.** Que respire visualmente.
- ✅ **Emojis moderados** para señalizar secciones (tabla más abajo).
- ❌ **No mencionar tecnologías internas** (Supabase, Next.js, Postgres, etc.).
- ❌ **No referenciar archivos de código** ni rutas técnicas.

---

## 📂 Convención de naming

| Elemento | Formato | Ejemplo |
|---|---|---|
| Archivo MD | `docs/DOCUMENTACION_<MODULO>.md` (MAYÚSCULAS) | `docs/COMO_USAR_PRESUPUESTOS.md` |
| Slug en código | `<modulo>` (minúsculas, singular) | `'flujos'`, `'presupuestos'`, `'contactos'` |
| URL de la página | `/documentacion/<modulo>` | `/ayuda/presupuestos` |

El slug del MD y el slug pasado a `accionDocumentacionModulo('<modulo>', t)` **deben coincidir** (en minúsculas).

---

## 🏗️ Estructura recomendada

Toda guía debe seguir esta estructura. Adaptá secciones según corresponda al módulo, pero respetá el orden general.

### 1. Encabezado

```markdown
# 🔄 Cómo usar <Módulo> en Flux

Una frase descriptiva de qué cubre la guía. No más de dos líneas.

---
```

### 2. ¿Qué es / Para qué sirve?

```markdown
## 🤔 ¿Qué es <Módulo>?

Explicación de 2-3 párrafos cortos sobre qué es y por qué importa.
Incluí una analogía cotidiana si ayuda a entender.
```

### 3. Pasos (numerados)

Dividir el flujo de uso en pasos claros y secuenciales. Cada paso debe ser una sección H2:

```markdown
## 🚀 Paso 1: Entrar al módulo

Instrucciones concretas con clicks.

## ✨ Paso 2: Crear el primer X

Etcétera.

## ⚙️ Paso 3: Configurar Y

...
```

### 4. Ejemplo completo end-to-end

Una sección de "Ejemplo: caso real" con un caso completo de inicio a fin. Debe incluir:

- Objetivo claro.
- Cada paso con valores reales (no placeholders abstractos).
- Resultado final que se ve.

### 5. Preguntas frecuentes

```markdown
## ❓ Preguntas frecuentes

### ¿Pregunta corta?
Respuesta directa, 1-3 líneas.

### ¿Otra pregunta?
Respuesta.
```

### 6. Tips y buenas prácticas

```markdown
## 💡 Tips y buenas prácticas

✅ **Tip 1.** Explicación corta.

✅ **Tip 2.** Explicación corta.
```

### 7. Footer

```markdown
---

## 🆘 ¿Necesitás ayuda?

Si tenés dudas, contactá al soporte.

---

*Documentación de Flux by Salix. Última actualización: YYYY-MM-DD.*
```

---

## 🎨 Elementos visuales recomendados

### Tablas

Usar para enumerar **opciones, estados, tipos** o cualquier listado con dos o más columnas.

```markdown
| Estado | Color | Qué significa |
|---|---|---|
| Borrador | Gris | Lo estás armando |
| Activo | Verde | Está corriendo |
```

### Bloques de código

Usar para mostrar **ejemplos de input** (mensajes con variables, fórmulas, comandos del usuario):

```markdown
"Hola {{ contacto.nombre | nombre_corto }}, tu pago de
{{ cuota.monto | moneda }} venció el {{ cuota.fecha_vencimiento | fecha_corta }}"
```

### Blockquotes

Usar para **tips, advertencias, notas importantes**:

```markdown
> 💡 **Tip:** podés combinar helpers, ejemplo `{{ contacto.nombre | nombre_corto | mayusculas }}`.

> ⚠️ **Importante:** mientras el banner amarillo esté visible, el flujo sigue corriendo con la versión anterior.
```

### Listas con iconos al inicio

Para listar acciones o características:

```markdown
- 📱 **Enviar WhatsApp** — manda un mensaje a un cliente.
- ✉️ **Enviar correo** — manda un email con plantilla.
- 📝 **Crear actividad** — genera una tarea.
```

---

## 🌈 Convención de emojis

Usá emojis para **señalizar secciones y conceptos**, no para decorar. Repetí los mismos emojis para los mismos conceptos en todas las guías.

### Categorías generales

| Concepto | Emoji |
|---|---|
| Inicio / Empezar | 🚀 |
| Crear / Nuevo | ✨ |
| Configurar | ⚙️ |
| Probar / Sandbox | 🧪 |
| Activar | ✅ |
| Pausar | ⏸️ |
| Eliminar / Cancelar | 🛑 |
| Editar | ✏️ |
| Ver / Listar | 📋 |
| Filtrar / Buscar | 🔍 |
| Estadísticas / Historial | 📊 |
| FAQs | ❓ |
| Tips | 💡 |
| Advertencia | ⚠️ |
| Soporte | 🆘 |
| Tiempo / Programado | 🕐 |
| Disparador / Trigger | 🎯 |
| Canales | 📱 ✉️ 🔔 |
| Importante | ⭐ |
| Idea / Concepto | 🤔 |

### Por módulo (sugerencias)

| Módulo | Emoji principal |
|---|---|
| Flujos / Automatizaciones | 🔄 |
| Presupuestos | 💰 |
| Contactos | 👥 |
| Actividades | 📝 |
| Visitas | 🚗 |
| Órdenes | 📦 |
| Inbox WhatsApp | 💬 |
| Asistencias | 🕒 |
| Calendario | 📅 |
| Documentos | 📄 |
| Productos | 🛍️ |

---

## 🔌 Cómo conectar la guía a la app

Una vez escrita la guía:

### 1. Crear el MD

Crear `docs/DOCUMENTACION_<MODULO>.md` siguiendo esta convención.

### 2. Agregar el botón al listado

En el componente del listado (típicamente `_componentes/Contenido<Modulo>.tsx`), donde está el `<PlantillaListado>`:

```tsx
import { accionDocumentacionModulo } from '@/lib/acciones-comunes/documentacion-modulo'

<PlantillaListado
  titulo={t('<modulo>.titulo')}
  accionPrincipal={...}
  acciones={[
    accionDocumentacionModulo('<modulo>', t),
    // ... otras acciones que ya tengas
  ]}
>
  {/* tabla */}
</PlantillaListado>
```

Listo. El botón "Guía de uso" aparece en el menú de acciones del header. Click → te lleva a `/documentacion/<modulo>` que carga el MD automáticamente.

---

## 🔄 Mantenimiento

- Cuando se **agreguen features** al módulo, actualizar el MD correspondiente.
- Cuando cambien **convenciones globales** (íconos, tono, estructura), actualizar este documento y revisar las guías existentes para mantener consistencia.
- Cuando se cree una **nueva guía**, agregar el módulo a la tabla de "Por módulo" más arriba.

---

## ✅ Checklist antes de publicar una guía nueva

- [ ] El archivo se llama `docs/DOCUMENTACION_<MODULO>.md` con MODULO en mayúsculas.
- [ ] Tiene encabezado con emoji + frase descriptiva.
- [ ] Sigue la estructura recomendada (¿qué es?, pasos, ejemplo, FAQs, tips).
- [ ] Lenguaje cercano, sin jerga técnica.
- [ ] Al menos un **ejemplo end-to-end** completo.
- [ ] Tablas para enumerar opciones / estados.
- [ ] Emojis consistentes con la convención.
- [ ] Footer con fecha de última actualización.
- [ ] El botón está agregado al listado del módulo via `accionDocumentacionModulo('<slug>', t)`.
- [ ] Probado en `/documentacion/<modulo>` que carga bien.

---

*Convención mantenida por el equipo Flux. Última actualización: 2026-05-07.*
