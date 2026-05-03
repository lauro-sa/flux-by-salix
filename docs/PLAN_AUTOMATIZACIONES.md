# Plan de Automatizaciones / Workflows en Flux

> Documento de referencia. Se mantiene en el repo para que sirva como
> contexto cargable en cualquier sesión nueva (incluso si se pierde la
> memoria del chat). Refleja el estado actual + el plan completo hasta
> llegar al motor de workflows funcional.
>
> Última actualización: 2026-05-02 · Branch `feat/estados-configurables`

---

## 1. Qué problema resolvemos

Hoy en Flux muchas acciones se hacen a mano:

- Cuando un presupuesto pasa a "aceptado", el vendedor escribe a mano un WhatsApp al cliente con el agradecimiento.
- Cuando se le paga la nómina a un empleado, hay que mandar a mano la plantilla "ya transferimos tu liquidación".
- Cuando se completa la actividad "presupuestar", hay que crear a mano la actividad siguiente "enviar presupuesto".
- Cuando un cliente confirma un presupuesto por correo, alguien tiene que cambiar el estado y recordar enviar el adjunto firmado.
- Cuando una conversación de inbox lleva 24 horas sin respuesta, alguien tiene que notificar al supervisor.

Todo eso es repetitivo, error-proneable, y ocupa tiempo de gente que podría estar haciendo trabajo de mayor valor.

**El motor de automatizaciones permite que la empresa defina reglas tipo:**

> *"Cuando [pasa esto] [si se cumple esto] entonces [hacer esto, esto y esto]"*

Y el sistema lo ejecuta solo, registrando todo en el chatter para auditoría.

---

## 2. Casos de uso concretos (ejemplos reales)

Estos son escenarios reales que el motor tiene que poder cubrir. Sirven como guía para validar el diseño.

### 2.1 Nómina — "se le pagó al empleado"

- **Trigger:** El estado de la nómina (o adelanto) de un empleado cambia a `pagado` / `transferido`.
- **Condición:** Por defecto, ninguna. Opcional: solo si el empleado tiene WhatsApp validado.
- **Acción:** Enviar plantilla WhatsApp **`pago_nomina_realizado`** al empleado, con variables como nombre, monto, periodo (semanal/quincenal/mensual/diario — dinámico según el empleado).

**Por qué es interesante:** los datos cambian por empleado (frecuencia, monto, fecha del periodo). Las **variables** de la plantilla se resuelven dinámicamente desde la nómina misma + el empleado.

### 2.2 Presupuesto — "fue aceptado"

- **Trigger:** `presupuestos.estado` pasa a `aceptado`.
- **Condición:** Por defecto, ninguna.
- **Acciones (en serie):**
  1. Enviar plantilla correo **`presupuesto_aceptado_gracias`** al contacto principal.
  2. Enviar plantilla WhatsApp **`presupuesto_aceptado_seguimiento`** al móvil del contacto si lo tiene.
  3. Crear orden de trabajo automáticamente desde el presupuesto.
  4. Crear actividad de seguimiento "Confirmar fecha de inicio" asignada al vendedor.
  5. Notificar al admin de la empresa.

### 2.3 Presupuesto — "lleva enviado X días sin respuesta"

- **Trigger:** Tiempo. Cron diario.
- **Condición:** Estado = `enviado` y han pasado N días sin cambio (configurable).
- **Acción:** Enviar plantilla WhatsApp **`recordatorio_presupuesto`** al contacto.

### 2.4 Actividad — "se completó X, crear Y"

- **Trigger:** Actividad con `tipo_clave = 'presupuestar'` se completa (estado pasa a `completada`).
- **Condición:** Ninguna por defecto.
- **Acción:** Crear nueva actividad de tipo `enviar_presupuesto` para el mismo contacto, asignada al mismo responsable.

### 2.5 Inbox — "conversación abierta sin respuesta"

- **Trigger:** Tiempo. Cron cada hora.
- **Condición:** `conversaciones.estado = 'abierta'` y han pasado >24h desde el último mensaje entrante sin respuesta saliente.
- **Acción:** Notificar al supervisor del sector en su panel de notificaciones.

### 2.6 Visita — "completada, agendar revisión"

- **Trigger:** `visitas.estado` pasa a `completada`.
- **Condición:** El tipo de visita es "instalación" (campo `tipo_visita`).
- **Acción:** Crear actividad "Revisión post-instalación" para 7 días después.

### 2.7 Cuota — "vence en 3 días"

- **Trigger:** Tiempo. Cron diario.
- **Condición:** Cuota está `pendiente` o `parcial` y `fecha_vencimiento` es dentro de 3 días.
- **Acción:** Enviar plantilla WhatsApp **`recordatorio_pago_proximo`** al contacto del presupuesto.

### 2.8 Asistencia — "auto-cierre por inactividad"

- **Trigger:** Estado pasa a `auto_cerrado`.
- **Acciones:** Notificar al usuario afectado + notificar a su supervisor inmediato + crear actividad de revisión.

### 2.9 Contacto — "se agregó tag X"

- **Trigger:** Contacto agrega/cambia un campo (etiqueta, tipo, sector).
- **Condición:** El nuevo valor coincide con uno marcado como "interesante".
- **Acciones:** Asignarlo a un usuario específico + crear actividad de bienvenida.

### 2.10 Conversación inbox — "marcada como resuelta"

- **Trigger:** `conversaciones.estado` pasa a `resuelta`.
- **Condición:** El cliente no recibió respuesta de cierre todavía.
- **Acción:** Enviar plantilla "encuesta de satisfacción" al cliente.

---

## 3. Estado actual del proyecto (donde estamos parados)

> Branch: `feat/estados-configurables` · Hasta acá, 5 PRs cerrados, 1 en curso.

### 3.1 Lo que YA construimos (PRs 1-5 ✓)

**PR 1 — Infraestructura genérica**
Tablas y funciones SQL transversales:
- `cambios_estado` — auditoría unificada de todo cambio de estado de cualquier entidad. **Es la fuente única de eventos sobre la que se va a colgar el motor de workflows.**
- `transiciones_estado` — catálogo de transiciones válidas por entidad. Sistema (todas las empresas) + propias por empresa.
- `registrar_cambio_estado()` / `validar_transicion_estado()` / `obtener_transiciones_disponibles()` — funciones SQL que las entidades usan.

**PR 2 — Cuotas migradas**
Primer caso real con doble escritura `estado` ↔ `estado_clave`. Validó que el patrón funciona sin romper código existente.

**PR 3 — Conversaciones inbox migradas**
Primer caso de **transiciones manuales** (el usuario las cambia desde la UI). Trigger captura usuario y origen heurístico.

**PR 4 — Helper backend + hooks client-side**
- `aplicarTransicionEstado()` — helper único que valida + aplica + persiste motivo.
- `useEstados()` / `useTransicionesDisponibles()` — hooks React Query.
- Endpoints `/api/estados` y `/api/estados/transiciones-disponibles`.

**PR 5 — Historial de estados visible en chatter**
- Componente `<HistorialEstados>` reutilizable (timeline visual con bolita de color, usuario, motivo, origen).
- Se integra automáticamente en `PanelChatter` para entidades migradas.
- **Cuando los workflows ejecuten acciones, las van a mostrar acá con badge "Automatización" + nombre del flujo.**

**PR 6 — UI configuración de estados (en curso, sin commit todavía)**
Cada módulo de configuración (`/presupuestos/configuracion`, `/inbox/configuracion`, etc.) tiene una sección **"Estados"** donde el admin puede ver los estados de sistema (read-only) y crear/editar/eliminar los propios de la empresa.

### 3.2 Lo que ya existe en el proyecto y se va a integrar (no hay que construirlo)

- **Plantillas WhatsApp** (`plantillas_whatsapp`) — con sincronización a Meta API y estado de aprobación.
- **Plantillas Correo** (`plantillas_correo`) — con HTML + variables.
- **Respuestas rápidas** (correo y WhatsApp).
- **Tipos y estados de actividad** (`tipos_actividad`, `estados_actividad`) — con `accion_destino` y `evento_auto_completar` que ya esbozan workflows internos.
- **Notificaciones** (`notificaciones` + `crearNotificacion()`).
- **Funciones de envío** (`enviarTextoWhatsApp`, `enviarPlantillaWhatsApp`, `enviarCorreoGmail`, etc.).
- **Auditoría granular** (tablas `auditoria_*`).
- **Webhooks de WhatsApp Meta** y de chatter.
- **Crons de Vercel** — ya hay 3 crons activos (`enviar-programados`, `sincronizar-correo`, `recordatorios`). Se puede agregar uno para workflows time-based.

### 3.3 Lo que falta migrar al sistema de estados (PRs 7-12)

| PR | Entidad | Por qué importante |
|----|---------|-------------------|
| 7 | Actividades | Integrar el sistema viejo `estados_actividad` con `cambios_estado` |
| 8 | Visitas | Estados con muchos triggers existentes |
| 9 | Órdenes | Renombre `esperando` → `en_espera` |
| 10 | Presupuestos | Alto volumen de hardcodeados (~270 ocurrencias) |
| 11 | Asistencias | El más pesado: 100+ ocurrencias + renombres |
| 12 | Cleanup final | Drop columnas `estado` legacy |

---

## 4. Lo que falta construir para que existan los workflows (PR 13+)

### 4.1 Modelo de datos (tablas nuevas)

```
flujos
──────
id              uuid PK
empresa_id      uuid FK   (multi-empresa)
nombre          text      ('Presupuesto aceptado → enviar gracias')
descripcion     text
activo          bool      (apagar sin borrar)
trigger         jsonb     (ver §4.2)
condiciones     jsonb     (array, ver §4.3)
acciones        jsonb     (array secuencial o nodos, ver §4.4)
nodos_json      jsonb     (representación visual del editor React Flow)
creado_en, actualizado_en, creado_por

ejecuciones_flujo
─────────────────
id              uuid PK
empresa_id      uuid FK
flujo_id        uuid FK
estado          text      ('pendiente' | 'corriendo' | 'completado' | 'fallado' | 'cancelado')
disparado_por   text      (id del cambios_estado que la disparó, o cron, o manual)
contexto_inicial jsonb    (snapshot de la entidad disparadora + variables)
log             jsonb     (paso a paso: qué se ejecutó, resultados, errores)
inicio_en       timestamptz
fin_en          timestamptz
proximo_paso_en timestamptz   (para flujos con delay)
intentos        int           (para reintentos)
dedupe_key      text          (idempotencia)

acciones_pendientes
───────────────────
id              uuid PK
ejecucion_id    uuid FK ejecuciones_flujo
empresa_id      uuid FK
tipo_accion     text      ('enviar_whatsapp', 'crear_actividad', 'esperar', etc.)
parametros      jsonb
ejecutar_en     timestamptz
estado          text      ('pendiente' | 'ejecutando' | 'ok' | 'fallo')
resultado       jsonb
intentos        int
```

### 4.2 Catálogo de triggers (qué dispara un flujo)

Triggers disponibles (configurables por empresa):

| Tipo | Configuración | Ejemplo |
|------|---------------|---------|
| `entidad.estado_cambio` | entidad_tipo + desde_clave (opcional) + hasta_clave | "presupuesto pasa a aceptado" |
| `entidad.creada` | entidad_tipo | "se crea una conversación" |
| `entidad.campo_cambia` | entidad_tipo + campo + valor (opcional) | "contacto cambia tipo" |
| `actividad.completada` | tipo_clave (opcional) | "se completa una actividad de tipo presupuestar" |
| `tiempo.cron` | expresión cron + scope (entidad/condición) | "cada día a las 9, ver cuotas que vencen en 3 días" |
| `webhook.entrante` | URL personalizada de la empresa | "recibimos un POST de Tally" |
| `inbox.mensaje_recibido` | canal_id (opcional) + filtros | "llega un WhatsApp de número conocido" |
| `inbox.conversacion_sin_respuesta` | tiempo + canal | "abierta hace >24h sin responder" |

**Cómo se conecta a la infraestructura de estados (PRs 1-5):**

Para `entidad.estado_cambio`, el motor escucha la tabla `cambios_estado` (vía LISTEN/NOTIFY de PostgreSQL o Realtime de Supabase). Cada INSERT en esa tabla puede disparar uno o más flujos cuya configuración matchea con el `(entidad_tipo, hasta_clave)` registrado.

### 4.3 Condiciones (filtros adicionales después del trigger)

Operadores soportados sobre cualquier campo de la entidad o relacionados:

- `igual` / `distinto`
- `mayor` / `menor` / `mayor_o_igual` / `menor_o_igual`
- `contiene` / `no_contiene` (texto)
- `existe` / `no_existe` (campo es null o no)
- `en_lista` / `no_en_lista`
- `entre` (rangos numéricos o de fecha)
- `dias_desde` / `dias_hasta` (cálculos de tiempo)

**Ejemplo de condición:**
```jsonc
{
  "operador": "y",
  "condiciones": [
    { "campo": "monto", "operador": "mayor", "valor": 100000 },
    { "campo": "contacto.tipo", "operador": "igual", "valor": "premium" }
  ]
}
```

Soporte para:
- Anidamiento (Y / O)
- Acceso a campos relacionados con dot notation (`contacto.email`, `presupuesto.contacto.tipo`)
- Variables del contexto (`{{actor.nombre}}`, `{{empresa.zona_horaria}}`)

### 4.4 Catálogo de acciones (qué hace un flujo)

| Acción | Parámetros | Resultado |
|--------|-----------|-----------|
| `enviar_whatsapp_plantilla` | plantilla_id, destinatario, variables | mensaje enviado al contacto |
| `enviar_whatsapp_texto` | texto, destinatario | mensaje libre |
| `enviar_correo_plantilla` | plantilla_id, destinatario, variables, adjuntos | correo enviado |
| `enviar_correo_texto` | asunto, cuerpo, destinatario | correo libre |
| `crear_actividad` | tipo_id, titulo, descripcion, asignado_a, fecha, contacto_id | actividad creada |
| `cambiar_estado_entidad` | entidad_tipo, entidad_id, hasta_clave, motivo | usa `aplicarTransicionEstado()` (PR 4) |
| `asignar_usuario` | entidad_tipo, entidad_id, usuario_id | reasignación |
| `agregar_etiqueta` / `quitar_etiqueta` | entidad_tipo, entidad_id, etiqueta | mutación de array |
| `notificar_usuario` | usuario_id, titulo, mensaje, url | notificación in-app + push |
| `notificar_grupo` | rol o sector, titulo, mensaje | varias notificaciones |
| `crear_orden_trabajo` | desde_presupuesto_id | conversión documental |
| `crear_visita` | parámetros de la visita | nueva entrada |
| `webhook_saliente` | url, método, body | POST a sistema externo |
| `esperar` | duración (5m, 1h, 3d) o hasta_fecha | delay antes de la siguiente acción |
| `esperar_evento` | trigger del flujo | pausar hasta que pase X |
| `condicion_branch` | sub-condiciones + ramas | if/then/else |
| `terminar_flujo` | (sin params) | finaliza este branch |

### 4.5 Variables y contexto

Cada ejecución de flujo arranca con un **contexto** que incluye:

```jsonc
{
  "trigger": {
    "tipo": "entidad.estado_cambio",
    "cambios_estado_id": "...",
    "fecha": "2026-05-02T15:30:00Z"
  },
  "entidad": { /* snapshot completo de la entidad disparadora */ },
  "actor": { /* usuario que disparó (si aplica) */ },
  "empresa": { /* datos de la empresa: zona horaria, nombre, etc. */ }
}
```

A medida que el flujo ejecuta acciones, se enriquece el contexto:

- Variables explícitas declaradas en el flujo (`{{nombre_cliente}}`)
- Resultados de acciones previas (`{{paso_2.respuesta_id}}`)

Las plantillas WhatsApp/correo usan estas variables para personalizar mensajes con sintaxis `{{ruta.al.campo}}`.

### 4.6 Motor de ejecución

**Opción recomendada: Supabase Edge Functions + cola.**

```
LISTEN/NOTIFY (PostgreSQL)  ──► dispatcher (Edge Function)
                                       │
                                       ▼
                           encolar en pgmq (queue de Postgres)
                                       │
                                       ▼
                           worker (Edge Function que procesa)
                                       │
                                       ▼
                           ejecutar acciones en orden,
                           registrar log en ejecuciones_flujo,
                           agendar próximas acciones (delays)
```

Ventajas:
- Todo en Supabase, sin servidor extra.
- Reintentos y dedupe ya resueltos por `pgmq`.
- Costo cero adicional para empresas chicas.

Alternativa si queda corto: usar Vercel Cron + endpoint dedicado.

### 4.7 UI del editor de flujos (PR 14+)

> **Nota:** según indicación del usuario (2026-05-02), NO tocamos UI de
> automatizaciones hasta que lleguemos a esa fase. Cuando lleguemos a PR
> 14+ paramos antes y planteamos la UI con el usuario en frío.

Plan tentativo:

- **Editor visual con React Flow** (open-source, ya elegido). Nodos draggables: Trigger, Condición, Acciones, Espera, Branch.
- **Modo "lista de pasos"** alternativo para flujos lineales simples (sin canvas).
- **Sandbox de prueba**: simular un flujo con un evento real reciente sin ejecutar acciones (dry-run).
- **Catálogo de plantillas de flujos**: presets que la empresa puede activar con un click ("Recordatorio de cuota próxima a vencer", "Encuesta NPS post-resolución", etc.).
- **Historial visual de ejecuciones**: cada flujo lista sus últimas N ejecuciones con timeline.

---

## 5. Multi-empresa (cómo escala)

Todo el sistema está diseñado pensando que cada empresa es independiente:

- **Estados configurables por empresa** (PR 6) — ya cubierto.
- **Plantillas WhatsApp/correo por empresa** — ya existe.
- **Flujos por empresa** (`flujos.empresa_id`) — RLS multi-tenant.
- **Catálogo de triggers/acciones es global** (definido por el sistema) — todas las empresas ven los mismos.
- **Variables disponibles por empresa** — el contexto incluye campos de `empresas` (zona horaria, slug, etc.).
- **Crons compartidos** pero filtran por empresa antes de disparar flujos.

Casos especiales:

- **Plantillas globales del sistema vs. propias**: como hicimos con estados (sistema NULL + propias), las plantillas de flujos seguirán el mismo patrón.
- **Empresas con frecuencias distintas de nómina**: las variables del contexto (`empleado.frecuencia_pago`) cubren esto naturalmente. La acción usa la plantilla configurada por la empresa, que puede tener variantes.
- **Permisos**: solo roles con permiso `automatizaciones:editar` pueden modificar flujos. Solo `automatizaciones:ver` para ver historial.

---

## 6. Plan de implementación (orden de PRs)

### Fase 1 — Estados configurables (en curso)

```
PR 1   ✓  Infraestructura genérica (cambios_estado + transiciones_estado)
PR 2   ✓  Cuotas migradas
PR 3   ✓  Conversaciones inbox migradas
PR 4   ✓  Helper backend + hooks client-side
PR 5   ✓  Historial de estados en chatter
PR 6   ⌛ UI configuración de estados (sección dentro de cada /modulo/configuracion)
PR 7      Actividades (integrar estados_actividad con cambios_estado)
PR 8      Visitas
PR 9      Órdenes (renombre esperando → en_espera)
PR 10     Presupuestos (alto volumen)
PR 11     Asistencias (el más pesado)
PR 12     Cleanup final (drop columnas legacy)
```

### Fase 2 — Motor de workflows (PRs 13-19)

```
PR 13     Schema: tablas flujos + ejecuciones_flujo + acciones_pendientes
PR 14     Catálogo de triggers + dispatcher SQL (LISTEN/NOTIFY de cambios_estado)
PR 15     Catálogo de acciones + worker (Edge Function que ejecuta)
PR 16     Sistema de variables y contexto + resolución de plantillas con {{vars}}
PR 17     Triggers de tiempo (cron diario que evalúa flujos time-based)
PR 18     Endpoints CRUD de flujos + permisos
PR 19     [PAUSA] Diseño de UI con el usuario antes de implementar
PR 20+    Editor visual React Flow + sandbox + historial de ejecuciones
```

### Fase 3 — Templates y onboarding

```
PR 21     Catálogo de plantillas de flujos prearmados (los del §2)
PR 22     Onboarding: al crear empresa, sembrar flujos sugeridos como inactivos
PR 23     Métricas y dashboard de automatizaciones
```

---

## 7. Integración con piezas existentes (qué reusamos)

El motor NO arranca de cero. Conecta lo que ya hay:

| Pieza existente | Cómo se usa |
|-----------------|-------------|
| `cambios_estado` (PR 1) | Fuente única de eventos para triggers `entidad.estado_cambio` |
| `transiciones_estado` (PR 1) | Generador del catálogo de triggers expuestos en el editor |
| `aplicarTransicionEstado()` (PR 4) | Acción `cambiar_estado_entidad` la invoca directo |
| `enviarPlantillaWhatsApp()` | Acción `enviar_whatsapp_plantilla` la invoca |
| `enviarCorreoGmail()` | Acción `enviar_correo_plantilla` la invoca |
| `crearNotificacion()` | Acción `notificar_usuario` la invoca |
| `auto-completar-actividad` (lib) | Acción `crear_actividad` reusa la lógica |
| Plantillas WhatsApp con `{{vars}}` | Variables del contexto se pasan al renderer |
| Plantillas Correo con `variables jsonb` | Idem |
| Crons existentes (Vercel) | Se agrega uno para evaluar triggers de tiempo |
| Sistema de auditoría | Las ejecuciones de flujo dejan rastro en `cambios_estado` con `origen='workflow'` |

**Lo único realmente nuevo** son las tablas `flujos`/`ejecuciones_flujo`/`acciones_pendientes` y el dispatcher/worker.

---

## 8. Riesgos y consideraciones de diseño

### 8.1 Idempotencia

Si un flujo se dispara dos veces por el mismo evento (race condition, reintento), las acciones no deben ejecutarse dos veces. Solución: cada acción tiene un `dedupe_key` calculado de `flujo_id + cambios_estado_id + paso_n`. El worker verifica antes de ejecutar.

### 8.2 Loops infinitos

Un flujo que cambia un estado puede disparar otro flujo que cambia otro estado que dispara el primero. Defensa:
- Límite duro de N ejecuciones de flujo por entidad por minuto.
- Detector de ciclos: si un flujo se está disparando por una cadena de cambios_estado, abortar después de profundidad 5.

### 8.3 Errores en acciones

Si una acción falla (ej: WhatsApp Meta devuelve error), el flujo debe poder:
- Reintentar N veces con backoff exponencial.
- Saltarse esa acción y seguir.
- Pausar todo el flujo y notificar al admin.

Configurable por flujo y por acción.

### 8.4 Costo de WhatsApp / correo

Cada acción de envío tiene costo (Meta cobra por plantilla, Gmail tiene cuotas). Defensas:
- Quotas configurables por empresa.
- Modo "dry run" en el editor antes de activar.
- Alertas si un flujo dispara más de N envíos por hora.

### 8.5 Privacidad de datos

Los flujos pueden incluir variables con datos sensibles (montos, datos personales). Las plantillas con `{{vars}}` deben:
- Sanitizar antes de enviar (no inyección).
- Loggear el envío sin loggear el cuerpo completo (solo los IDs).
- Respetar RLS multi-tenant: un flujo de una empresa NUNCA debe acceder a datos de otra.

### 8.6 Estados configurables × workflows

Cuando un admin agrega un estado custom (`en_revision` para presupuestos), los flujos existentes que apuntan a `enviado → aceptado` no se rompen. Pero los flujos nuevos pueden aprovechar el estado custom. El editor de flujos ofrece todos los estados (sistema + propios) en su catálogo.

---

## 9. Cómo retomar este plan en otra sesión

Si abrís un chat nuevo y querés retomar este plan:

1. Cargar este archivo: `docs/PLAN_AUTOMATIZACIONES.md`
2. Cargar la memoria: `~/.claude/projects/-Users-sal-dev-Salix-flux-2-0/memory/project_estados_configurables.md`
3. Revisar el estado del branch: `git log --oneline feat/estados-configurables` muestra hasta dónde se llegó.
4. El próximo PR pendiente es el primero después del último commit de la rama.

Si hay diferencia entre lo que dice este documento y lo que está en el código (porque el código avanzó), **el código es la fuente de verdad**. Este documento se actualiza al final de cada fase.

---

## 10. Decisiones tomadas (referencia rápida)

| Decisión | Cuándo | Por qué |
|----------|--------|---------|
| Hacer estados configurables antes que workflows | 2026-05-01 | El motor depende del catálogo de triggers que viene de los estados |
| Sin parches: refactor profundo desde BD | 2026-05-01 | Multi-tenant en producción no tolera deuda técnica |
| Patrón doble escritura `estado` ↔ `estado_clave` | PR 2 | Permite migrar entidad por entidad sin romper código existente |
| UI configuración de estados dentro de cada `/modulo/configuracion` | PR 6 | Consistencia con `/actividades/configuracion` ya existente |
| Motor de workflows arranca después de PR 12 (todas las entidades migradas) | 2026-05-02 | Workflows con solo 2-3 entidades migradas frustra al usuario |
| NO tocar UI de workflows hasta PR 19 | 2026-05-02 | Ahí parar y plantear bien la UX con el usuario |
| Multi-empresa: catálogo global, flujos por empresa | base del proyecto | Software multi-tenant desde el inicio |
| Editor visual con React Flow (open-source) | 2026-04-XX | Gratis, ya validado en otros productos |
| Motor: Supabase Edge Functions + pgmq | 2026-04-XX | Sin servidor extra, todo en Supabase |
