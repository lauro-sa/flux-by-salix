# 🔄 Cómo crear automatizaciones (Flujos) en Flux

Una guía paso a paso para que cualquier persona, sin saber programar, pueda armar automatizaciones que ahorren horas de trabajo manual.

---

## 🤔 ¿Qué es un Flujo?

Un Flujo es como una **receta automática** que Flux sigue cuando pasa algo específico. Pensalo así:

> *"Cuando un cliente firma un presupuesto, mandame un WhatsApp y avisale al técnico."*

Eso es un Flujo. Vos lo armás una vez, y a partir de ahí Flux lo hace solo cada vez que se cumple la condición.

Cada Flujo tiene **dos partes**:

1. 🎯 **Disparador (el "cuando"):** la condición que activa el flujo.
2. ⚙️ **Acciones (el "qué hacer"):** lo que Flux ejecuta automáticamente.

---

## 🚀 Paso 1: Entrar al módulo Flujos

1. En el menú lateral izquierdo (la barra negra de la izquierda), buscá la sección **"Admin"**.
2. Click en **"Flujos"**.
3. Te abre el listado de todos los flujos creados (la primera vez está vacío, eso está bien).

---

## ✨ Paso 2: Crear tu primer flujo

Hay dos formas de empezar:

### Opción A — Desde una plantilla (recomendado al principio)

1. Click en el botón verde **"+ Nuevo flujo"** arriba a la derecha.
2. Se abre una ventana con dos pestañas:
   - **"Plantillas"** → flujos pre-armados para casos comunes.
   - **"Desde cero"** → empezás con un flujo vacío.
3. Mirá las plantillas. Hay para presupuestos, cuotas, visitas, inbox de WhatsApp, etc.
4. Click en la que más se parezca a lo que querés hacer.
5. ¡Listo! Te lleva directo al editor con el flujo pre-armado.

### Opción B — Desde cero

1. En la ventana, click en la pestaña **"Desde cero"**.
2. Ponele un nombre, ejemplo: *"Recordatorio de pago vencido"*.
3. Click en **"Crear"**.
4. Te lleva al editor con un flujo vacío.

---

## 🎯 Paso 3: Configurar el disparador

El disparador es **lo que activa el flujo**. Algunos ejemplos típicos:

| Tipo | Para qué sirve |
|------|----------------|
| 🕐 **Por tiempo** | "Todos los días a las 9 AM" |
| 📋 **Por cambio de estado** | "Cuando una cuota cambia a 'Vencida'" |
| 🆕 **Por creación** | "Cuando se crea un presupuesto nuevo" |
| 📨 **Por mensaje de inbox** | "Cuando llega un mensaje sin respuesta" |
| ⏰ **Tiempo relativo a un campo** | "1 día después de la fecha de vencimiento de la cuota" |

### Cómo configurarlo

1. En el editor vas a ver una primera tarjeta arriba que dice **"Disparador"**.
2. Click sobre ella → se abre un panel a la derecha.
3. Elegí qué tipo de disparador querés.
4. Llená los campos según el tipo (ej. fecha, hora, qué entidad observar, etc.).

---

## ⚙️ Paso 4: Agregar acciones

Las acciones son **lo que Flux hace** cuando el disparador se activa.

### Acciones disponibles

| Acción | Qué hace |
|--------|----------|
| 📱 **Enviar WhatsApp** | Manda un mensaje WhatsApp a un cliente o miembro |
| ✉️ **Enviar correo** | Manda un email (con plantilla o texto libre) |
| 📝 **Crear actividad** | Genera una tarea o seguimiento |
| 🔔 **Notificar usuario** | Notificación interna en la campanita |
| 🔄 **Cambiar estado** | Mueve un presupuesto, cuota, etc. a otro estado |
| ⏱️ **Esperar** | Pausa el flujo X tiempo antes de seguir |
| 🌳 **Condición (Branch)** | Si pasa X, hago A; si no, hago B |
| 🏷️ **Agregar/quitar etiqueta** | Marca a un contacto u otra entidad |
| 👤 **Asignar usuario** | Pone responsable a alguien |
| 🛑 **Terminar flujo** | Corta el flujo en este punto |

### Cómo agregar una acción

1. Debajo del disparador, click en **"+ Agregar paso"**.
2. Se abre una ventana con todas las acciones disponibles.
3. Elegí la que quieras → se agrega como tarjeta debajo.
4. Click sobre la tarjeta nueva → se abre el panel a la derecha para configurarla.
5. Llená los campos y listo.

Podés agregar **todas las acciones que quieras**. Se ejecutan en orden, una después de la otra.

---

## 💬 Paso 5: Usar variables `{{ }}` para personalizar mensajes

Las variables te permiten que los mensajes se **adapten al cliente real**, en vez de ser texto fijo.

### Sin variables (mal)

> "Hola, te recuerdo tu pago"

### Con variables (bien)

> "Hola **{{ contacto.nombre }}**, te recuerdo tu pago de **{{ cuota.monto | moneda }}** con vencimiento **{{ cuota.fecha_vencimiento | fecha_corta }}**"

Cuando el flujo corre, Flux reemplaza automáticamente:

- `{{ contacto.nombre }}` → "Juan Pérez"
- `{{ cuota.monto | moneda }}` → "$ 150.000"
- `{{ cuota.fecha_vencimiento | fecha_corta }}` → "12/05"

### Cómo usarlas

1. En cualquier campo de texto (mensaje, asunto, etc.), tipeá `{{`.
2. Se abre un selector con todas las variables disponibles.
3. Elegí la que quieras (nombre, monto, fecha, email, etc.).
4. Opcionalmente agregá un **"helper"** para formatear:
   - `| moneda` → formato de plata: $1.500.000
   - `| fecha_corta` → formato fecha: 12/05/2026
   - `| nombre_corto` → solo el primer nombre: "Juan"
   - `| mayusculas` → TODO EN MAYÚSCULAS
   - `| minusculas` → todo en minúsculas

> 💡 **Tip:** podés combinar helpers, ejemplo `{{ contacto.nombre | nombre_corto | mayusculas }}` da "JUAN".

---

## 🧪 Paso 6: Probar el flujo (Sandbox)

**Nunca actives un flujo sin probarlo antes.** Flux tiene una consola de prueba que te permite verificar todo.

1. En el editor, click en el botón **"Probar"** arriba a la derecha.
2. Se abre la consola Sandbox abajo de la pantalla.
3. Tenés dos modos:

### 🔍 Vista previa

Te muestra **cómo se vería cada paso** con datos de ejemplo. No envía ni hace nada real.

Útil para verificar:
- ¿El mensaje de WhatsApp se ve bien?
- ¿Las variables se reemplazan correctamente?
- ¿La actividad tiene el título esperado?

### ▶️ Dry-run (ejecución de prueba)

**Ejecuta el flujo de verdad** pero sin efectos reales:

- ❌ NO envía WhatsApps reales.
- ❌ NO manda correos reales.
- ❌ NO crea actividades en la base.
- ❌ NO cambia estados.
- ✅ SÍ te muestra paso a paso qué HARÍA cada acción.

Es la forma segura de comprobar que el flujo entero funciona como esperás.

---

## ✅ Paso 7: Activar el flujo

Cuando ya lo probaste y estás conforme:

1. Click en el botón **"Activar"** arriba a la derecha.
2. Confirmá.
3. El flujo pasa de **Borrador** a **Activo**.

A partir de ese momento, cada vez que el disparador se cumpla, el flujo corre automáticamente. Vos no tenés que hacer nada más.

---

## 📊 Paso 8: Ver el historial de ejecuciones

Una vez activo, podés ver **cada vez que el flujo corrió**:

1. En el editor, click en la pestaña **"Historial"** arriba.
2. Te muestra la lista de ejecuciones con:
   - 📅 Cuándo corrió.
   - ✅/❌ Estado (completado, fallado, esperando, cancelado).
   - 👤 Qué/quién lo disparó.
3. Click en cualquier fila → te abre el detalle paso a paso.

> 💡 **Tip:** mirá el historial los primeros días después de activar para confirmar que todo corre bien.

---

## ✏️ Paso 9: Editar un flujo activo

¿Querés cambiar algo de un flujo que ya está corriendo?

1. Abrí el flujo desde el listado.
2. Modificá lo que necesites (mensaje, acción, condición, lo que sea).
3. Vas a ver un **banner amarillo** que dice *"Tenés cambios sin publicar"*.
4. **Importante:** mientras tengas el banner amarillo, el flujo **sigue corriendo con la versión anterior**.
5. Cuando estés conforme, click en **"Publicar"** → los cambios entran en vigor.
6. Si te arrepentís, click en **"Descartar"** → volvés a la versión activa.

> ⚠️ Esto es muy útil porque podés editar tranquilo sin romper la producción. Solo cambia cuando vos decidís.

---

## 🎨 Estados del flujo

| Estado | Color | Qué significa |
|--------|-------|---------------|
| 📝 **Borrador** | Gris | Lo estás armando. Todavía no funciona. |
| ✅ **Activo** | Verde | Está corriendo automáticamente. |
| ⏸️ **Pausado** | Naranja | Está congelado. No se dispara. |

Para pasar de **Activo** a **Pausado**: click en *"Pausar"* arriba a la derecha. Para volver a activarlo: *"Reactivar"*.

---

## 🌟 Ejemplo completo: "Recordatorio de pago vencido"

Vamos a armar un flujo paso a paso, de principio a fin.

**🎯 Objetivo:** Cuando una cuota vence y no fue pagada, mandarle WhatsApp al contacto recordándole, esperar 1 hora, y crear una actividad para que el cobrador llame.

### 1️⃣ Disparador

- **Tipo:** Tiempo relativo a un campo.
- **Entidad:** Cuota.
- **Campo:** `fecha_vencimiento`.
- **Cuándo:** 1 día después de la fecha.
- **Filtro:** Solo si la cuota está en estado "Vencida".

### 2️⃣ Acción 1 — Enviar WhatsApp

- **A:** `{{ contacto.telefono_movil }}`
- **Mensaje:**

```
Hola {{ contacto.nombre | nombre_corto }},

Te recordamos que tu cuota de {{ cuota.monto | moneda }} venció
el {{ cuota.fecha_vencimiento | fecha_corta }}.

Si ya la pagaste, ignorá este mensaje.

Saludos!
```

### 3️⃣ Acción 2 — Esperar

- **Duración:** 1 hora.

### 4️⃣ Acción 3 — Crear actividad

- **Tipo:** Llamado de cobranza.
- **Asignada a:** El cobrador del contacto.
- **Título:** `Llamar a {{ contacto.nombre }} por cuota vencida`.
- **Descripción:** `Cuota de {{ cuota.monto | moneda }} con vencimiento {{ cuota.fecha_vencimiento | fecha_corta }} no fue pagada.`

### 5️⃣ Probar

1. Click *"Probar"* → modo *Vista previa*.
2. Verificás que el WhatsApp se vería bien con los datos.
3. Cambiás a *Dry-run*.
4. Verificás que se ejecuta paso a paso sin errores.

### 6️⃣ Activar

1. Click *"Activar"*.
2. ¡Listo! Cada día, Flux revisa las cuotas vencidas hace 1 día y dispara el flujo.

---

## ❓ Preguntas frecuentes

### ¿Puedo modificar un flujo activo sin que pare?

Sí. Tus cambios se guardan como **borrador interno**. Solo entran en vigor cuando hacés click en *"Publicar"*. Mientras tanto, el flujo sigue corriendo con la versión vieja.

### ¿Qué pasa si el flujo falla?

La falla queda registrada en el **Historial** con el detalle del error. Otros flujos no se ven afectados — cada ejecución es independiente.

### ¿Puedo pausar un flujo temporalmente?

Sí. Click en *"Pausar"*. El flujo queda congelado. Click en *"Reactivar"* para volver.

### ¿Puedo duplicar un flujo?

Sí. En el listado de flujos, click en los **3 puntos `...`** de cualquier flujo → *"Duplicar"*. Se crea una copia que podés editar.

### ¿Cuántos flujos puedo tener?

No hay límite. Pueden coexistir cientos de flujos activos al mismo tiempo.

### ¿El sandbox manda mensajes reales?

❌ **No.** La vista previa nunca envía nada. El dry-run ejecuta el flujo entero pero sin efectos reales. Es 100% seguro probar.

### ¿Puedo armar un flujo con condiciones tipo "si pasa X hacé A, si no hacé B"?

Sí. Usá la acción **🌳 Branch (Condición)**. Te permite ramificar el flujo según una variable.

### ¿Puedo integrar Flujos con servicios externos (Zapier, n8n, etc.)?

Sí, vía **Webhook saliente** (acción) o **Webhook entrante** (disparador). Necesitás configurar la URL del servicio externo.

---

## 💡 Tips y buenas prácticas

✅ **Empezá con plantillas.** Adaptá una plantilla existente antes de armar uno desde cero. Las plantillas tienen los patrones correctos.

✅ **Probá siempre con dry-run** antes de activar. Cero excepciones.

✅ **Nombres descriptivos.** Ponele al flujo un nombre que diga claramente qué hace, ej. *"Recordatorio cuota vencida + 1 día"*. Cuando tengas 30 flujos vas a agradecerlo.

✅ **Variables con helpers.** Usá `| moneda`, `| fecha_corta`, `| nombre_corto` para que los textos queden bien formateados.

✅ **Branches para casos especiales.** Si el flujo necesita "si X hacé esto, sino hacé aquello", usá la acción **Condición** en lugar de armar dos flujos separados.

✅ **Mirá el historial regularmente** los primeros días después de activar. Te asegura que todo corre como esperás.

✅ **Pausá antes de borrar.** Si dudás de un flujo, pausalo primero. Solo eliminá cuando estés 100% seguro.

✅ **Plantillas para el equipo.** Si tu equipo va a usar Flujos, armá vos las plantillas base y que ellos las dupliquen y adapten. Evita errores.

---

## 🆘 ¿Necesitás ayuda?

Si tenés dudas, querés armar un flujo específico, o algo no funciona como esperás, contactá al soporte.

---

*Documentación de Flux by Salix. Última actualización: 2026-05-07.*
