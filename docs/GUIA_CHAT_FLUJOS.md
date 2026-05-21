# Guía operativa — Cómo construir Flujos en Flux desde un chat

> **Para quién es esto:** un chat de Claude (o cualquier asistente)
> que reciba el pedido *"ayudame a armar la automatización X"*.
> Leer este archivo antes de tocar nada del módulo de Flujos.
> No es una guía para el usuario final — para eso existe
> [`docs/DOCUMENTACION_FLUJOS.md`](DOCUMENTACION_FLUJOS.md).

Este documento es **vivo**. Cualquier chat puede agregar lecciones
nuevas al final de las secciones correspondientes — mantener el
orden, no borrar entradas viejas (las decisiones tienen contexto),
y dejar fecha en formato ISO al margen.

---

## 1. Resumen ejecutivo (leer siempre)

- **Flux** es un SaaS multi-tenant. Hay varias empresas reales en
  producción. Cualquier flujo que se cree tiene que servir para
  cualquier empresa, no para una sola — nada hardcodeado.
- **Módulo Flujos** ya está en producción con flujos activos
  ejecutándose contra correos y cambios de estado reales. **No es
  un MVP** — los cambios al motor y a los disparadores rompen
  ejecuciones existentes. Probar siempre con dry-run antes de
  activar y nunca asumir que un campo nuevo es opcional sin un
  default seguro.
- **Flujo de trabajo recomendado para un chat:** entender lo que el
  usuario quiere → ver el catálogo de §3 → armar el flujo en el
  editor visual paso a paso → dry-run → activar. Si falta un
  disparador o acción que no está en §3, NO inventar — agregar a la
  lista de "pendientes" de §8.
- **Regla durable:** "nada de parches, todo bien solucionado". Si
  un cambio toca el motor, mirar primero las consecuencias en
  flujos ya guardados (backwards compat) antes de migrar.

---

## 2. Contexto del producto

| Tema | Decisión |
|---|---|
| Multi-tenancy | Toda tabla tiene `empresa_id`. RLS por JWT custom claim. Ningún flujo escribe entre empresas. |
| Idioma de la UI | Español. Tildes correctas siempre (commits, branches, PRs, copy). i18n con `es/en/pt` + `tipos`. |
| Nombre del producto | "Flux" (marca: "Flux by Salix"). Nunca "CRM" ni "SalixCRM". |
| Zona horaria | El servidor corre en UTC. Para "hoy/ayer/ahora" usar `empresas.zona_horaria` + helpers de [`src/lib/formato-fecha.ts`](../src/lib/formato-fecha.ts). |
| Permisos de chat | El chat NO puede mandar correos reales ni activar flujos en producción sin que el usuario lo confirme. Sí puede leer logs, ejecutar dry-run, commitear y mergear (vía `gh`). |
| Trabajo en paralelo | Otros chats están laburando en paralelo en otros módulos. Antes de hacer ramas nuevas, `git fetch` y revisar PRs abiertos en `gh pr list`. |

---

## 3. Catálogo actualizado de disparadores y acciones

Estado: ✅ funcional, 🚧 implementado pero sin UI completa, 🕒 próximamente.

### 3.1 Disparadores (`TipoDisparador`)

Fuente de verdad: [`src/tipos/workflow.ts`](../src/tipos/workflow.ts) (`TipoDisparador`).

| Clave | Estado | Para qué sirve |
|---|---|---|
| `entidad.estado_cambio` | ✅ | El más usado: dispara cuando una entidad pasa a `hasta_clave` (opcionalmente desde `desde_clave`). Sub-campo `solo_creacion` permite separar "creación" de "transición". |
| `entidad.creada` | ✅ | Cuando se crea una entidad nueva del tipo configurado. Convive con `estado_cambio` + `solo_creacion=true` (preferir la última para flujos nuevos). |
| `entidad.campo_cambia` | 🚧 | Cuando cambia un campo específico a un valor opcional. Motor implementado, UI básica. |
| `actividad.completada` | ✅ | Cuando una actividad pasa al estado `completada`. Filtros por `tipo_actividad_id`. |
| `tiempo.cron` | ✅ | Cron tradicional (`*/15 * * * *`, etc.). Se evalúa contra zona horaria de la empresa. |
| `tiempo.relativo_a_campo` | ✅ | "1 día después de `fecha_vencimiento`" — el cron de Vercel encola las acciones. |
| `webhook.entrante` | 🚧 | Endpoint HTTP que dispara el flujo. Backend listo, UI pendiente de pulir. |
| `inbox.correo_recibido` | ✅ | Cuando llega un correo nuevo. Filtra opcionalmente por `canal_ids`. Validado en producción 2026-05-20. |
| `inbox.whatsapp_recibido` | 🕒 | Definido en tipos pero sin handler en dispatcher. **No ofrecer al usuario.** |
| `inbox.interno_recibido` | 🕒 | Idem. |
| `inbox.conversacion_sin_respuesta` | 🕒 | Idem. |

### 3.2 Acciones (`TipoAccion`)

Fuente: [`src/tipos/workflow.ts`](../src/tipos/workflow.ts) (`TipoAccion`).
Mapeo a categorías UI: [`src/lib/workflows/categorias-pasos.ts`](../src/lib/workflows/categorias-pasos.ts).

**Envíos** (panel unificado: el usuario elige modo "texto libre / plantilla / respuesta rápida" dentro del panel — no hay 3 botones separados en el catálogo).

| Clave | Estado | Notas |
|---|---|---|
| `enviar_whatsapp_plantilla` | ✅ | Plantillas aprobadas por WhatsApp Cloud. |
| `enviar_whatsapp_texto` | ✅ | Texto libre dentro de la ventana de 24h. |
| `enviar_correo_plantilla` | ✅ | Oculto del catálogo: se elige modo desde el panel unificado. |
| `enviar_correo_texto` | ✅ | Entrada única "Enviar correo" en el catálogo. |
| `enviar_respuesta_rapida_correo` | ✅ | Modo "respuesta rápida" del panel unificado. Mantiene `In-Reply-To` para no romper el hilo. |

**Creaciones / cambios**

| Clave | Estado |
|---|---|
| `crear_actividad` | ✅ |
| `completar_actividad` | ✅ (panel con plantillas curadas, sub-PR 20.4) |
| `crear_orden_trabajo` | ✅ |
| `crear_visita` | ✅ |
| `cambiar_estado_entidad` | ✅ |
| `asignar_usuario` | ✅ |
| `agregar_etiqueta` / `quitar_etiqueta` | ✅ |

**Notificaciones**

| Clave | Estado |
|---|---|
| `notificar_usuario` | ✅ |
| `notificar_grupo` | ✅ |

**Control de flujo**

| Clave | Estado | Notas |
|---|---|---|
| `condicion_branch` | ✅ | "Si" estilo iOS Atajos. Ramas `Sí`/`No`. Soporta hoja, horario y compuesta. Ramas vacías son válidas. |
| `esperar` | ✅ | Pausa por duración (`5m`, `2h`, etc.). |
| `esperar_evento` | ✅ | Pausa hasta que ocurre un evento externo. |
| `webhook_saliente` | ✅ | POST a una URL configurable. |
| `terminar_flujo` | ✅ | Salida explícita. Útil en una rama del branch. |

---

## 4. Cómo encarar un pedido del usuario

Pasos que tiene que seguir el chat al recibir *"quiero hacer una automatización que..."*:

1. **Entender el "cuando" y el "qué hacer"**. Reformularlo en una
   frase: *"Cuando pase X, hacer Y"*. Si no se puede, el flujo no
   está bien definido todavía — preguntar.
2. **Mapear el "cuando" a un disparador del catálogo §3.1**. Si no
   matchea ninguno, no inventar uno nuevo; preguntar al usuario si
   acepta el más cercano o anotar en §8 como pendiente.
3. **Mapear el "qué hacer" a una secuencia de acciones del §3.2**.
   Si necesita ramas, usar `condicion_branch`. Si necesita esperar
   un tiempo, usar `esperar`.
4. **Verificar que el flujo sirva para cualquier empresa** — no
   hardcodear nombres de canal, IDs de plantilla, ni emails. Todo
   debe seleccionarse desde la UI del editor.
5. **Probar con dry-run** antes de activar. Si el dry-run requiere
   un mensaje sintético (ej: correo), ver §6.4.
6. **Activar y dejarlo corriendo**. Anotar en `CHANGELOG_FLUJOS.md`
   si fue un flujo de sistema (no si es de un usuario puntual).

---

## 5. Arquitectura del módulo (atajo a los archivos clave)

```
src/
  app/(flux)/flujos/                  ← Listado + editor visual
    [id]/_componentes/                ← Canvas, panel, picker, consola
  app/api/workflows/                  ← Endpoints (correr-ejecucion, dry-run, ...)
  lib/workflows/
    contexto.ts                       ← Enrique­cimiento del contexto runtime
    correr-ejecucion.ts               ← Worker principal
    correr-ejecucion-dryrun.ts        ← Worker en modo simulación
    dispatcher.ts                     ← Resuelve qué flujos disparar
    evaluar-condicion.ts              ← Motor de condiciones (hoja/horario/compuesta)
    resolver-variables.ts             ← `{{entidad.nombre}}` → valor real
    validacion-flujo.ts               ← Reglas de "este flujo es válido"
    categorias-pasos.ts               ← Catálogo UX (qué se muestra en "Agregar paso")
    resumen-disparador.ts             ← 1 línea para la tarjeta del canvas
    resumen-condicion.ts              ← Idem para condition_branch
    preview-contexto.ts               ← Contexto sintético para el picker + dry-run
  tipos/workflow.ts                   ← Discriminated unions: fuente de verdad
supabase/functions/dispatcher-workflows/
  index.ts                            ← Edge function que recibe webhooks de Supabase
sql/                                  ← Migrations relevantes:
  054_workflows_schema.sql            ← Schema base
  114_fix_trigger_mensajes_correo_message_id.sql
                                      ← Detección de correos por correo_message_id
```

### Flujo end-to-end (caso `inbox.correo_recibido`)

```
1. Cron Vercel /api/cron/sincronizar-correo (cada 15 min)
       ↓
2. Inserta filas en `mensajes` con correo_message_id
       ↓
3. Trigger SQL detecta correo nuevo → INSERT en `cambios_estado`
       ↓
4. Database Webhook de Supabase → dispatcher-workflows (edge fn)
       ↓
5. Dispatcher busca flujos activos con disparador matching
       ↓
6. Worker /api/workflows/correr-ejecucion ejecuta paso a paso
```

Si el flujo no responde, debuggear en este orden:
1. `select * from mensajes where correo_message_id is not null order by creado_en desc limit 5;` — ¿llegó el correo?
2. `select * from cambios_estado order by creado_en desc limit 5;` — ¿el trigger insertó el evento?
3. Logs de la edge function `dispatcher-workflows` (Supabase dashboard).
4. `select * from ejecuciones_flujo order by creado_en desc limit 5;` — ¿se creó la ejecución?
5. Mirar el detalle de la ejecución en `/flujos/<id>` → Historial.

---

## 6. Patrones de UX establecidos (no romper)

Cualquier panel/tarjeta nueva debe seguir estos patrones. Si necesita
romper alguno, dejarlo anotado en §8 con justificación.

### 6.1 Tarjetas del canvas

- Una tarjeta = un paso del flujo. La primera es siempre el
  disparador, el resto son acciones.
- 3 líneas: título · tipo · resumen del estado configurado.
- El resumen sale de `resumen-disparador.ts` / `resumen-paso.ts`.
  Si todavía no hay resumen, mostrar nada (no IDs crudos).
- Border y fondo: el disparador usa `border-texto-marca/30
  bg-texto-marca/[0.025]` (diferenciación sutil), las acciones
  usan el default. Glow sutil al seleccionar.
- Drag handle: `suppressHydrationWarning` en el botón (workaround
  conocido del `aria-describedby` que asigna dnd-kit).

### 6.2 Panel lateral de edición

- Se abre clickeando una tarjeta del canvas. Click afuera lo cierra.
- El click-outside ignora elementos con `data-selector-portal="true"`,
  `data-flujo-panel-keepalive`, `role="dialog"`. Si vas a crear un
  popover/portal nuevo que NO debe cerrar el panel, agregar uno de
  esos atributos.
- Header del panel: `min-h-[4.25rem]` (68px) e ícono `size-11`
  para alinear con `HeaderEditorFlujo`.

### 6.3 Picker de variables

- Popover de 360px con flip horizontal si se sale del viewport
  (ver `PickerVariables.tsx`).
- Cada variable muestra el preview del valor real, resuelto contra
  el contexto sintético de `preview-contexto.ts`.
- Si el contexto no tiene `entidad` (caso cron/webhook), los
  previews salen vacíos — es aceptado.

### 6.4 Dry-run

- Inyecta `mensaje_disparador` sintético para `inbox.correo_recibido`
  (usa un canal real de la empresa). No requiere que el usuario
  configure `destinatario_override`.
- Tarjetas con stagger entrance (Framer Motion). Loading state usa
  `AnimacionEjecutando` (barrido pulse de íconos del flujo).
- Footer sticky con border-top. Las tarjetas tienen scroll propio.

### 6.5 `condicion_branch` ("Si")

- Estilo iOS Atajos. Dos ramas: `Sí` y `No`. Las ramas vacías son
  válidas semánticamente.
- Tres modos de condición:
  - **Hoja**: `variable operador valor` (`igual`, `contiene`, etc.).
  - **Horario**: días + rango horario + modo `dentro/fuera`. Soporta
    múltiples rangos. Días no marcados nunca matchean.
  - **Compuesta**: lista de condiciones con conector `y`/`o`. Si
    todas son horarios, el resumen las concatena con ` · `.

---

## 7. Errores ya cometidos / lecciones aprendidas

> Para cada lección: fecha, qué se rompió, cómo se arregló, qué evitar.

**2026-05-20 — Trigger SQL filtraba mal correos.** El trigger usaba
`tipo_contenido LIKE 'email_%'` pero los mensajes guardan `'texto'`.
Fix sistémico: detectar por `correo_message_id IS NOT NULL` (sql/114).
Backwards compat: WhatsApp por `wa_message_id`, internos sin nada.
**Evitar:** no filtrar por `tipo_contenido` para distinguir canales.

**2026-05-20 — Dispatcher edge function era legacy (v9).** Usaba
`inbox.mensaje_recibido` con `tipo_canal`, pero el editor ya guardaba
el split en 3 tipos (`inbox.correo_recibido`, etc.). Fix: deploy v10.
**Evitar:** cuando se cambia el shape de un disparador, redeployar
la edge function inmediatamente. Está en
`supabase/functions/dispatcher-workflows/`.

**2026-05-20 — Dry-run fallaba con `DestinatarioFaltante`.** El motor
no recibía `mensaje_disparador` en dry-run y no podía resolver el
destinatario. Fix: `armarContextoPreview` inyecta un mensaje sintético
con canal real.
**Evitar:** cualquier acción nueva que dependa de campos del
mensaje disparador debe verificar que el dry-run también los provea.

**2026-05-20 — `useAutocompleteRemoto` causaba loop infinito.** El
callback `extraer` inline se recreaba cada render y disparaba el
useEffect. Fix: `useRef` interno y sacarlo de las deps.
**Evitar:** cuando un hook custom recibe un callback como prop,
estabilizarlo con `useRef` o documentar que el caller lo memoize.

**2026-05-20 — Hydration mismatch en drag handles.** dnd-kit asigna
IDs incrementales (`DndDescribedBy-1`, `DndDescribedBy-2`) que
difieren server/client. Fix: `suppressHydrationWarning` en los
botones de drag.
**Evitar:** no eliminar el `suppressHydrationWarning` "porque
parece innecesario" — es real.

**2026-05-20 — Validación rechazaba ramas vacías.** Tanto dry-run
como Activar exigían al menos un paso por rama del `condicion_branch`.
Fix: ramas vacías válidas semánticamente; solo la raíz exige paso.
**Evitar:** asumir que "vacío = inválido" en estructuras opcionales.

**2026-05-20 — Merge conflict mal resuelto.** Primer intento
`git checkout --ours` resetó HEAD silenciosamente. Fix correcto:
`git merge origin/main -X ours --no-edit` para conservar la rama
remota como base.
**Evitar:** nunca usar `checkout --ours/--theirs` sobre conflict
markers sin verificar antes.

**2026-05-21 — `setState` durante render en `SidebarCorreo`.** El
updater de `setCuentasExpandidas` llamaba a `guardarConfigInbox` →
`setPreferencias`, disparando el warning de React. Fix: mover el
guardado fuera del updater.
**Evitar:** nunca llamar a otra `setState` dentro del updater de
`setX`. Calcular el resultado afuera o usar `useEffect`.

---

## 8. Pendientes UX y de motor (lista viva)

Agregar acá cuando se identifique algo a mejorar pero no se resuelve
en el momento. Cada entrada: descripción breve + dónde + por qué se
posterga.

- **Columna "Origen" del historial muestra "Cambio de estado".**
  En realidad es el nombre técnico de la tabla webhook. Debería
  mostrar el tipo de disparador real (ej: "Correo recibido").
  Archivo: `app/(flux)/flujos/[id]/historial/`.
- **`inbox.whatsapp_recibido`, `inbox.interno_recibido`,
  `inbox.conversacion_sin_respuesta`** — están en el catálogo de
  tipos pero el dispatcher no los procesa. No ofrecer al usuario
  hasta que tengan handler.
- **`resumirDisparador` solo soporta `inbox.correo_recibido`.**
  Extender a `entidad.estado_cambio` (mostrar entidad+estado),
  `entidad.creada` (mostrar entidad), `tiempo.cron` (mostrar
  expresión legible), etc. Archivo:
  [`src/lib/workflows/resumen-disparador.ts`](../src/lib/workflows/resumen-disparador.ts).
- **Vista previa de payload** sigue mostrando JSON crudo en
  algunos pasos. Falta panel legible.
- **Jerarquía visual del `PanelBranch`** todavía no convence al
  100% (decisión 2026-05-20: aceptado por ahora).
- **Panel de `webhook.entrante`** está funcional pero pelado —
  falta UX para mostrar el endpoint generado, copiar curl, etc.

---

## 9. Reglas duras (no negociables)

1. **Nunca commitear `service_role_key` ni secretos** en el repo.
   Las edge functions usan `WEBHOOK_SECRET` custom, no la SR key.
2. **Nunca skipear hooks** (`--no-verify`, `--no-gpg-sign`) salvo
   pedido explícito del usuario.
3. **Nunca borrar flujos de la BD desde el chat** sin confirmación
   explícita. Los flujos pueden estar activos en producción.
4. **Nunca agregar tablas a `supabase_realtime`** sin validar
   primero writes y filtros (ver `feedback_realtime_tablas_calientes`).
5. **Nunca hardcodear IDs, emails ni nombres de canal** — todo
   selector debe leerse desde la empresa del usuario.
6. **Nunca activar un flujo en producción** sin dry-run previo.
7. **Nunca ofrecer al usuario un disparador o acción que esté
   marcado como 🕒** en §3 (no funciona).
8. **Nunca duplicar variantes de correo en el catálogo** —
   `enviar_correo_plantilla` y `enviar_respuesta_rapida_correo`
   están ocultos del catálogo (`ACCIONES_OCULTAS_EN_CATALOGO`)
   porque se eligen como modo dentro del panel unificado.

---

## 10. Cómo actualizar este documento

Cuando un chat aprenda algo nuevo:

1. **Lección o error**: agregar entrada al final de §7 con fecha
   ISO. No tocar las viejas.
2. **Pendiente UX/motor**: agregar bullet en §8 con archivo y
   razón.
3. **Nuevo disparador/acción**: actualizar la tabla de §3 con su
   estado real. Si todavía no hay UI, marcar 🚧.
4. **Cambio en convenciones UX**: actualizar §6 y dejar referencia
   cruzada al PR que lo introdujo.
5. **Cambio en arquitectura**: actualizar §5 con el archivo
   movido/agregado.

Commits que tocan este archivo: prefijo `docs(flujos):`. PRs en
español con tildes.

---

## 11. Documentos relacionados

- [`docs/DOCUMENTACION_FLUJOS.md`](DOCUMENTACION_FLUJOS.md) — guía
  para el usuario final.
- [`docs/PLAN_UI_FLUJOS.md`](PLAN_UI_FLUJOS.md) — plan UX
  histórico del editor visual.
- [`docs/PLAN_AUTOMATIZACIONES.md`](PLAN_AUTOMATIZACIONES.md) —
  plan general del módulo (decisiones macro).
- [`docs/CHANGELOG_FLUJOS.md`](CHANGELOG_FLUJOS.md) — log
  cronológico de PRs grandes.
- [`docs/ARQUITECTURA.md`](ARQUITECTURA.md) — arquitectura general
  de Flux (no solo flujos).
