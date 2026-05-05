# Plan UX — UI del módulo Flujos

> **Contexto:** branch `feat/estados-configurables`, post-PR 17. El motor backend está completo end-to-end (PR 13 a 17, 150 tests, motor de ejecución funcionando en producción Preview con disparadores event-driven y time-driven, variables `{{vars}}`, control de flujo, cron de cola diferida).
>
> Este documento captura las decisiones de UX para la **UI del módulo de Flujos** (lo que falta construir: PR 18 backend CRUD + PR 19 frontend). Es el resultado de una sesión de planning conjunta antes de tocar código.
>
> **Reglas transversales (aplican a todo el documento):**
> - Cero componentes hardcodeados.
> - Reuso máximo de componentes existentes en Flux.
> - Estilo visual consistente con CLAUDE.md (Attio/Linear/Notion).
> - Estilo moderno, no genérico, textos guía claros, todo bien marcado, microcopy en cada formulario.
> - Animaciones sutiles (memoria del proyecto: `feedback_animaciones.md`).
> - Auditoría obligatoria en tablas nuevas.

---

## 1. Decisiones cerradas

### 1.1 Identidad y permisos del módulo

- **Módulo instalable** como el resto de Flux (Inbox, Visitas, Calendario, etc.). Parte de un plan superior.
- **Permisos por usuario** (configurables en la sección de permisos de cada usuario):
  - Ver flujos
  - Crear flujos
  - Editar flujos
  - Eliminar flujos
  - Activar/Desactivar flujos (operación, distinto de editar)
- **Dueño y administradores** tienen los 5 permisos por default.

### 1.2 Ubicación en la app

**Doble entrada:**

1. **Sidebar centralizado: "Flujos"** (al nivel de Inbox, Visitas, etc.). Acá viven todos los flujos juntos, con tabla densa + filtros.
2. **Sección dentro de configuración de cada módulo** (ej: `/presupuestos/configuracion → Flujos`). Solo lectura + atajo a crear/editar (al click se abre el editor centralizado con el flujo cargado).

Patrón consistente con cómo se hizo Estados configurables (PR 6: sección dentro de cada `/modulo/configuracion`).

### 1.3 Naming

**"Flujos"** (no "Workflows", "Recetas", "Automatizaciones").

Razones:
- Conecta con la marca "Flux".
- Es corto, una palabra, fácil de meter en sidebar/breadcrumbs.
- Más amigable que "Workflows" (anglicismo) y más serio que "Recetas" (consumer-grade).
- Semánticamente preciso (un flujo = secuencia de pasos automáticos).

### 1.4 Listado de flujos

- **Tabla densa** usando `TablaDinamica` + `PanelFiltrosAvanzado` (componentes existentes).
- **Columnas (orden de izquierda a derecha):**
  1. **Estado** (pill: Activo / Pausado / Borrador con tokens semánticos)
  2. **Nombre** (texto + ícono pequeño + punto amarillo si tiene borrador interno sin publicar)
  3. **Módulo** asociado (pill suave con ícono del módulo)
  4. **Disparador** (badge: "Cambio de estado", "Cron diario", "Relativo a fecha")
  5. **Última ejecución** (fecha relativa: "hace 5 min", "ayer 14:32", "sin ejecutar")
  6. **Ejecuciones del mes** (número crudo, sin sparkline en primer release)
  7. **Acciones** (menú tres puntos: Editar / Duplicar / Activar o Pausar / Eliminar)
- **Toolbar de la tabla:** buscador + pills tri-state (`Todos`, `Activos`, `Pausados`, `Borradores`) + botón "Filtros avanzados" + contador.
- **Filtros avanzados** (panel lateral derecho): grupos Identidad / Comportamiento / Actividad — módulo, etiquetas, estado, tipo de disparador, fecha de última ejecución, fecha de creación.

#### 1.4.1 Botón "+ Nuevo flujo"

Abre **modal previo** *"¿Desde dónde querés arrancar?"* con dos opciones:
- **"Desde una plantilla"** — lista de plantillas (filtradas por módulos instalados de la empresa).
- **"Desde cero"** — abre el editor con un flujo vacío.

Razón: dirigir al usuario a plantillas reduce el caso "creé un flujo vacío y no sé qué hacer". Patrón usado por Zapier y HubSpot. Si más adelante el modal molesta, se baja a "directo al editor" trivialmente.

#### 1.4.2 Estado vacío (empresa sin flujos)

Tarjeta hero centrada con:
- Ícono grande arriba.
- Título: *"Todavía no creaste ningún flujo"*.
- Bajada educativa explicando qué son los flujos con ejemplos concretos.
- **3 mini-cards** con plantillas sugeridas **filtradas por módulos instalados** (si la empresa no tiene Cuotas, no aparece la plantilla de cuotas). Si tras filtrar no hay 3 disponibles, muestra 1-2.
- Botón **"Crear flujo desde cero"** debajo.

#### 1.4.3 Indicador de borrador interno

Punto amarillo al lado del nombre del flujo cuando un flujo Activo tiene `borrador_jsonb` con cambios sin publicar. Tooltip: *"Tiene cambios sin publicar"*.

**Visibilidad:** lo ve cualquier usuario con permiso de ver (no solo quien edita), porque es información operativa relevante para todos.

#### 1.4.4 Permisos (UI condicional)

- Sin `crear` → botón "+ Nuevo flujo" oculto, plantillas del estado vacío sin botón de crear.
- Sin `editar` → click en fila abre editor en **modo solo lectura** con banner *"Tenés permiso de ver pero no de editar"*.
- Sin `eliminar` → ítem "Eliminar" del menú no aparece.
- Sin `activar` → ítems "Activar/Pausar" del menú no aparecen.
- Sin `ver` → redirect a `/`.

### 1.5 Estados del flujo

**Tres estados:**

| Estado | Comportamiento |
|---|---|
| **Borrador** | Default al crear. Edita libremente, NO se dispara aunque pase el evento. |
| **Activo** | Se dispara cuando matchea evento/tiempo. Para editar, se entra a "modo edición" sin afectar la versión activa hasta publicar (ver §1.6.3). |
| **Pausado** | Estado intermedio: mantiene config sin ejecutar. Útil para "lo desactivo temporalmente sin volver a borrador". |

### 1.6 Editor visual

#### 1.6.1 Estilo general

**Estilo Zapier vertical**: pasos verticales lineales, lectura arriba-abajo. NO React Flow ni canvas libre estilo n8n.

Razones:
- Los flujos típicos son lineales (5-8 acciones en serie). Branches son la excepción.
- Usuario no es desarrollador: n8n/Make abruman.
- Evita el problema del canvas vacío.
- Mapea perfecto a la estructura del motor (`acciones[]` array + `condicion_branch.acciones_si/acciones_no`).

#### 1.6.2 Anatomía de un paso

**Cards medias** (tarjetas con tres elementos visibles):
- Ícono (representativo del tipo de acción/disparador)
- Nombre del paso (descriptivo, generado o personalizado)
- 1 línea de resumen (truncada agresivamente — ver §3.1 pendiente)

**Click en la card** → abre panel lateral derecho con campos editables.

#### 1.6.3 Edición de un Activo (modelo "borrador interno")

Un flujo es **una sola entidad** con dos versiones internas:
- Versión publicada (`disparador/condiciones/acciones` — la que el motor ejecuta)
- Versión borrador (`borrador_jsonb` — la que se está editando)

Cuando se edita un flujo Activo:
- Banner amarillo arriba: **"Estás editando este flujo. Tus cambios no afectan al flujo activo hasta que clickees Publicar."**
- Botón "Publicar cambios" reemplaza la versión publicada con la del borrador.
- Botón "Descartar cambios" tira el borrador y vuelve a la versión publicada.

Sin nombres técnicos confusos como "draft" o "versionado" en la UI. Solo "borrador" y "publicar".

#### 1.6.4 Branches (`condicion_branch`)

**Sub-flujos colapsables verticales con sangría visual.**

El paso "Si condición X" tiene dos secciones plegables:
- "Si SÍ → [pasos]"
- "Si NO → [pasos]"

El flujo sigue siendo lineal vertical. Branches anidadas (motor permite hasta 3 niveles) se entienden como sangría visual igual que código indentado.

#### 1.6.5 Agregar pasos

**Doble interacción:**
- **"+" intermedio** entre cada paso (visible al hover entre tarjetas) → inserta paso en esa posición.
- **"+ Agregar paso" fijo abajo** del último paso → siempre visible, agrega al final.

Selección del tipo de paso: modal/popover con catálogo agrupado por categorías (Eventos, Tiempo, Acciones de envío, Acciones de creación, Control de flujo).

#### 1.6.6 Reordenamiento

Drag-and-drop de pasos usando **`dnd-kit`** (lib liviana ~30kb).

**Drag handle siempre visible** (6 puntos verticales chicos a la derecha de cada tarjeta, en gris claro, intensifica al hover). Razón: descubribilidad + soporte mobile (donde no hay hover). Patrón Linear.

El disparador (primera tarjeta) no es draggable (siempre primero).

#### 1.6.7 Layout general del editor

- **Pantalla completa** con `PlantillaEditor` (existente).
- **Header sticky** con: migajas a la izquierda + ícono clickeable (`MiniSelectorIcono`) + nombre del flujo inline editable + pill de estado + indicador "tiene cambios sin publicar" si corresponde. A la derecha: botón "Probar", botón "Historial", indicador de guardado, y botones de acción según estado (Activar / Publicar+Descartar / Pausar / Reactivar) + menú tres puntos (Duplicar / Eliminar).
- **Banner contextual** debajo del header (condicional): edición de Activo con borrador interno (amarillo), modo solo lectura (gris), o errores de validación al activar/publicar (rojo con resumen).
- **Layout de cuerpo de dos columnas asimétricas:**
  - Sin paso seleccionado: canvas ocupa 100% (max 720px centrado).
  - Paso seleccionado: canvas flex-1 + panel lateral derecho fijo de 480px.
- **Canvas vertical centrado, max-width 720px** (no adaptable a ventana ancha). Razón: legibilidad — flujos de 15 pasos se leen mejor en columna controlada que extendidos. Patrón Notion/Zapier/HubSpot.

#### 1.6.8 Disparador en el canvas

El disparador es **la primera tarjeta del canvas vertical**, no una card aparte fija arriba.

Diferenciación visual sin romper la metáfora "todo es un paso vertical":
- Borde superior coloreado (`border-t-2 border-texto-marca`).
- Etiqueta uppercase arriba: *"DISPARADOR"*.
- Ícono dentro de círculo `bg-texto-marca/10`.

Razón: mantiene la lectura lineal arriba-abajo. Zapier hace esto.

#### 1.6.9 Interacción con tarjetas (selección y panel)

**Click en cualquier parte de la tarjeta** (excepto drag-handle) abre el panel lateral derecho con los campos editables del paso. La tarjeta seleccionada se resalta con border `texto-marca` + sombra suave.

**Cierre del panel:** click en la X, click afuera, o tecla `Esc`.

Razón: convención Notion/Linear/Airtable. Click directo reduce fricción del caso 90% (editar). Si solo quieren leer sin editar, cierran con Esc.

#### 1.6.10 Botón "Probar"

Botón único en el header con menú al click (no split-button). Dos opciones:
- *"Vista previa"* — render estático de cada paso con variables resueltas, sin ejecutar nada.
- *"Ejecución de prueba"* — corre el flujo end-to-end con `dry_run: true`.

Razón: las dos acciones son semánticamente distintas y merecen elección consciente. Split-button confunde sobre qué hace el click directo.

#### 1.6.11 Atajos de teclado (primer release acotado)

Solo dos atajos en PR 19:
- `Esc` — cierra panel lateral o vuelve al listado si no hay panel.
- `Cmd/Ctrl + S` — fuerza guardar si autoguardado tiene pendiente.

`Cmd+Z` (undo), `Cmd+D` (duplicar), `Delete` (eliminar con undo de 5s) quedan para iteración posterior. Razón: undo/redo requiere infraestructura considerable; los demás suman complejidad sin ser core. Se evalúan después de feedback de uso.

#### 1.6.12 Modo solo lectura

Cuando el usuario tiene permiso `ver` pero no `editar`:
- Mismo layout que modo edición.
- Todas las acciones deshabilitadas: sin botón Activar/Pausar/Publicar, sin botones "+", sin drag, sin botones de acción en tarjetas.
- Banner gris arriba: *"Tenés permiso de ver pero no de editar."*

Razón: cuando le den permiso de edición ve exactamente la misma pantalla con acciones habilitadas, sin re-aprender layout.

### 1.7 Edición de campos del paso

#### 1.7.1 Panel lateral derecho

Slide-in desde la derecha al clickear un paso. Ancho fijo **480px** en desktop. Cierre con X, click afuera o tecla `Esc`.

Razones (vs inline o modal):
- No perdés contexto del flujo (ves todos los pasos a la izquierda mientras editás).
- Convención del mercado (Zapier, Notion, Airtable, Linear).

**Estructura interna del panel:**
- **Header:** ícono del tipo de paso (40x40px) + nombre editable inline + botón cerrar.
- **Sub-header:** chips informativos (tipo, posición "Paso 3 de 7", contexto si está dentro de branch).
- **Cuerpo scrolleable:** secciones colapsables con labels uppercase (`text-[11px] tracking-wider`). Las secciones varían por tipo de paso (ver §1.7.5).
- **Footer:** botón texto rojo "Eliminar paso" a la izquierda + botón "Cerrar" a la derecha.

#### 1.7.2 Picker de variables `{{vars}}` (componente `PickerVariables`)

**Dos formas de invocar (mismo componente):**

1. **Tipear `{{`** — abre autocomplete tipo VS Code. Para power users.
2. **Ícono `{}` dentro del input** a la derecha (no botón al lado del label) — abre dropdown jerárquico. Para descubrir. Tooltip al hover: *"Insertar variable"*.

**Dropdown del picker (popover 360px, max-height 400px):**
- Buscador arriba con foco automático.
- Tabs horizontales por fuente: Entidad / Contacto / Empresa / Sistema / Cambio.
- Lista vertical con cada variable: nombre `{{path}}` en mono + badge de tipo + preview del valor (resuelto vía §5.2).
- **Helpers inline en el mismo dropdown:** al hover sobre una variable, expande sub-lista con helpers compatibles según tipo (fecha → formato_corto, formato_largo, relativo...; número → moneda, porcentaje...; texto → mayusculas, capitalizar, truncar...). Click en helper inserta `{{path | helper}}`.
- Para tipeo `|` directo después de una variable: mismo popover se abre filtrado a helpers.

**Pill visual de variable insertada:** una vez insertada, la variable se renderiza como **pill coloreada** (`bg-texto-marca/15 text-texto-marca`) dentro del input, no como `{{path | helper}}` en texto crudo. Click en la pill reabre el picker para editar/eliminar. Al copiar el contenido, se serializa de vuelta a texto plano.

Razón pill vs texto crudo: usuario objetivo no es desarrollador. Patrón estándar moderno (Notion, Linear, Slack).

#### 1.7.3 Constructor de condiciones para Branch

Cuando el paso es Branch (`condicion_branch`), las condiciones se construyen visualmente:

- Cada condición es una fila: variable (con `PickerVariables`) + operador (select: `=`, `≠`, `>`, `<`, `≥`, `≤`, `contiene`, `empieza con`, `está vacío`, `no está vacío`) + valor (input que admite variable también).
- Botón "+ Agregar condición" abajo.
- Selector "Y" / "O" entre filas (operador uniforme — sin paréntesis anidados en primer release).

Razón operador uniforme: cubre 90% de casos reales. Paréntesis anidados se suman después con toggle "modo avanzado" si aparece la necesidad.

#### 1.7.4 Validación de campos

**Híbrida:**
- **Tiempo real:** warnings amarillos no bloqueantes (variable inexistente, helper desconocido, plantilla WhatsApp pendiente).
- **Al activar/publicar:** mismos warnings se vuelven rojos y bloquean. Banner top con resumen + botón "Ver errores" que scrollea al primer paso con error.

#### 1.7.5 Secciones del panel por tipo de paso

**Acción "Enviar WhatsApp":**
1. Básicos (etiqueta, descripción interna).
2. Destinatario (pills tri-state: Contacto del evento / Usuario asignado / Número específico).
3. Plantilla WhatsApp (selector con autocomplete + estado de aprobación + preview con valores resueltos).
4. Variables de la plantilla (mapeo de `{{1}}`, `{{2}}` con `PickerVariables`).
5. Avanzado (acordeón colapsado por default): toggle marcar atendida, toggle asignar conversación, clave de idempotencia editable.

**Disparador "Cambio de estado":** módulo, estado origen (multi), estado destino (multi), filtros adicionales tipo "y donde tipo_contacto = X".

**Disparador "Cron diario":** hora HH:MM, días de la semana (toggle pills L M M J V S D), zona horaria read-only.

**Disparador "Relativo a fecha":** campo fecha del módulo, cuándo (Antes/Después/Mismo día), cantidad + unidad (min/hora/día).

**Acción "Enviar correo":** destinatario, asunto (con `PickerVariables`), cuerpo (editor de texto rico con `PickerVariables`).

**Acción "Crear notificación interna":** destinatario (usuario/grupo), título, mensaje, tipo de notificación.

**Acción "Crear actividad":** tipo de actividad, asignar a, fecha (con offset), descripción.

**Acción "Cambiar estado":** módulo (auto del disparador), nuevo estado, razón opcional.

**Acción "Esperar":** cantidad + unidad (min/hora/día) + leyenda explicativa.

**Acción "Terminar":** solo etiqueta + leyenda *"El flujo termina acá."*

**Sección "Avanzado":** colapsada por default (panel limpio para usuarios novatos). Razón: opciones avanzadas son edge cases que el 80% no toca.

#### 1.7.6 Modo solo lectura del panel

Cuando el usuario tiene `ver` pero no `editar`:
- Panel abre normal, **todos los campos disabled**.
- Banner gris arriba del cuerpo: *"Modo solo lectura"*.
- Footer sin botón "Eliminar paso", solo "Cerrar".

Razón: el panel sigue siendo útil para inspeccionar la configuración del paso. Sin panel, el usuario no puede entender el flujo en detalle.

#### 1.7.7 Autoguardado vs Publicar

- **Borrador:** autoguardado al salir del campo (consistente con `feedback_autoguardado.md`). Debounce 500ms.
- **Activo:** autoguardado dentro de la versión borrador interna (§1.6.3). NO afecta al motor hasta clickear "Publicar cambios".
- Indicador de guardado en el header del editor: *"Guardando..."* / *"Guardado hace 2s"*.

### 1.8 Sandbox / testing

**Modo dry-run con flag `dry_run: true` en `correr-ejecucion`.** Skipea acciones de envío externo (WhatsApp, correo) y solo loguea "se hubiera enviado X".

**Acceso unificado:** botón "Probar" en el header del editor abre menú con dos opciones (no split-button). Razón en §1.6.10.

**UI de la sandbox:** ambas herramientas se ejecutan en un **panel inferior tipo consola** que slide-in desde abajo, ocupa **40% de la altura** del viewport, no tapa el canvas. Cierre con botón "Cerrar consola" arriba a la derecha o tecla `Esc`.

#### 1.8.1 Selector de evento de prueba

Arriba del panel inferior, una fila con:
- Texto: *"Evento de prueba:"* + chip con resumen del evento default (último registro del estado-objetivo, §5.2).
- Dropdown **"Cambiar"** que permite elegir otro evento (búsqueda por entidad). Útil para testear casos límite.

#### 1.8.2 Vista previa estática

Timeline horizontal scrolleable dentro del panel inferior:
- Cada paso renderizado como card compacta con valores resueltos (ej: WhatsApp con la plantilla rellena, correo con asunto y cuerpo, condición resuelta a SÍ/NO con valores).
- Click en card expande el detalle inline.
- Sin animación de ejecución (es vista estática).

#### 1.8.3 Ejecución dry-run completa

Log en vivo dentro del panel inferior:
- Cada paso aparece secuencialmente con animación de "ejecutándose" → "completado" (check verde) o "saltado" (gris) o "error" (rojo con detalle).
- Indicador de tiempo total acumulado.
- Para acciones de envío: mensaje *"[dry-run] Se hubiera enviado WhatsApp `recordatorio_cuota_3dias` a +54 9 11..."* en lugar de enviar.
- Al final: resumen con cantidad de pasos completados, saltados, errores.
- Botón **"Volver a ejecutar"** + botón **"Editar flujo"** (cierra consola y vuelve al canvas).

### 1.9 Historial de ejecuciones

#### 1.9.1 Ubicaciones

- **Pestaña "Historial"** dentro del editor del flujo (ejecuciones de ese flujo específico).
- **Sección "Flujos disparados"** en el chatter de cada entidad (ejecuciones que tuvieron a esa entidad como disparadora).

**No hay sección global "Ejecuciones" en sidebar** en el primer release (ver §3.6 pendiente).

#### 1.9.2 Vista híbrida

- **Lista compacta** por default: estado, fecha, duración, entidad disparadora resumida.
- **Drawer expandible** al click → timeline visual de pasos con detalle.

#### 1.9.3 Detalle expandido por ejecución

- Timeline visual de pasos (similar al editor pero con valores resueltos)
- Para cada paso: variables, helpers aplicados, resultado, duración, errores con detalle (status + raw_class del PR 16)
- Link a la entidad disparadora (presupuesto / conversación / etc.)
- Botón "Volver a ejecutar" (ver §3.4 pendiente para semántica)

#### 1.9.4 Filtros del historial

Reuso de `PanelFiltrosAvanzado`:
- Estado (completado / fallado / esperando / corriendo / cancelado)
- Flujo (autocomplete con flujos de la empresa)
- Fecha (rango)
- Entidad disparadora (autocomplete según módulo)
- Error específico (raw_class: VariableFaltante, HelperTipoInvalido, HelperDesconocido, etc.)

#### 1.9.5 Acciones por ejecución

- **Reejecutar** — abre mini-modal con dos opciones (§5.4 cerrado).
- **Ver entidad** — link al chatter del presupuesto/conversación/etc.
- **Cancelar** — solo si estado es `esperando`. Marca cancelado y elimina fila de `acciones_pendientes`.
- **Copiar log JSON** — para soporte / debugging avanzado.

#### 1.9.6 Drawer expandible al click en fila

Click en fila de la tabla → abre **drawer lateral derecho** (mismo patrón visual que `PanelEdicionPaso`, ancho 480px, slide desde la derecha).

Contenido del drawer:
- **Header:** estado de la ejecución (pill grande), fecha + hora, duración total, link a entidad disparadora.
- **Cuerpo:** timeline vertical de pasos con valores resueltos (similar al canvas del editor pero solo lectura, cada paso muestra estado + duración + variables resueltas + errores con detalle si hubo).
- **Footer:** acciones de §1.9.5 (Reejecutar / Ver entidad / Cancelar si aplica / Copiar log JSON).

Razón: la tabla densa muestra muchas ejecuciones de un vistazo, el drawer da el detalle profundo sin perder el listado.

### 1.10 Sección por módulo en `/modulo/configuracion`

Vive dentro de la configuración de cada módulo (ej: `/presupuestos/configuracion?seccion=flujos`). Patrón consistente con Estados configurables.

Layout vertical en dos bloques:

#### 1.10.1 Bloque "Flujos de este módulo"

- Tabla compacta (3-5 columnas: estado, nombre, última ejecución, ejecuciones del mes, atajo abrir).
- Botón **"Ver todos"** arriba a la derecha → linkea al listado central `/flujos?modulo=presupuestos`.
- Click en fila → abre el editor central del flujo.
- Solo lectura (no se crea ni edita desde acá, solo se ve y se navega).

#### 1.10.2 Bloque "Plantillas sugeridas"

- Grid de **2-3 columnas** de cards medias.
- Cada card: ícono + título + descripción corta (1-2 líneas) + badge del módulo + botón **"Crear flujo basado en esta plantilla"**.
- Click → abre editor central pre-cargado con la plantilla en estado Borrador.
- Plantillas filtradas automáticamente por módulos instalados de la empresa.

### 1.11 Modal "+ Nuevo flujo" (selector de origen)

Modal centrado tamaño `4xl` (~960px), no full-screen.

**Estructura:**
- Header con título *"Crear nuevo flujo"* + botón cerrar.
- **Dos pestañas arriba** (default: "Desde una plantilla"):
  - **"Desde una plantilla"**: buscador + filtro por módulo + grid de cards con plantillas. Click en card → cierra modal y abre editor con plantilla pre-cargada.
  - **"Desde cero"**: input *"Nombre del flujo"* + select de módulo + botón **"Crear y editar"**. Click → crea flujo Borrador vacío y abre editor.

Razón pestañas vs columnas paralelas: forzar un toggle consciente entre dos caminos distintos. Mantiene el modal limpio y legible.

### 1.12 Notas operativas finales

- **Atajos en mobile:** todos deshabilitados (sin teclado físico relevante).
- **Toasts de feedback:** todas las acciones críticas (publicar, descartar borrador, eliminar paso, reejecutar real) emiten toast con confirmación + undo de 5s donde aplique.
- **Sticky elements:** header del editor, header del listado, header del panel lateral.
- **Cero hardcodeo de strings sensibles:** todos los textos van por `messages`/i18n desde el inicio (memoria: `feedback_documentacion.md`).

---

## 2. Componentes existentes a reusar

| Componente | Función |
|---|---|
| `TablaDinamica` + `PanelFiltrosAvanzado` | Listado de flujos + listado de ejecuciones |
| `PlantillaListado` + `PlantillaEditor` | Patrón listado→editor pantalla completa (memoria: `project_patron_listado_editor.md`) |
| `PanelChatter` | Chatter de entidad donde sumamos sección "Flujos disparados" |
| `HistorialEstados` | Patrón de timeline (puede extenderse para `TimelineEjecucion`) |
| `SelectorIcono` | Para elegir ícono de cada flujo en el listado |
| `PALETA_COLORES_ETIQUETA` | Colores de tipos de pasos / estados de ejecución |
| `Toast` / `Modal` | Confirmaciones (publicar, reejecutar, cancelar) |
| `InputMoneda` / `CampoNumero` | Campos numéricos en formularios de pasos |
| Tokens semánticos CSS (`--texto-marca`, `--insignia-exito`, etc.) | Colores de la UI |
| Patrón modal config (estilo `ModalTipoActividad` per CLAUDE.md) | Modales de creación/edición |
| Auditoría obligatoria | Tablas de flujos y ejecuciones con campos audit + tabla auditoria + IndicadorEditado |

---

## 3. Componentes nuevos necesarios

| Componente | Función | Reusable a futuro? |
|---|---|---|
| `EditorFlujo` | Pantalla completa con canvas vertical de pasos | Específico de flujos |
| `TarjetaPaso` | Card media con ícono + nombre + resumen | Específico de flujos |
| `PanelEdicionPaso` | Panel lateral derecho para editar campos del paso | Específico de flujos |
| `PickerVariables` | Autocomplete de `{{vars}}` con preview de valor | **Sí** — cualquier campo con interpolación de variables (correos masivos, plantillas) |
| `BotonAgregarPaso` | "+" intermedio + "+ Agregar paso" fijo abajo | Específico de flujos |
| `PreviewRendering` | Vista previa estática de cómo queda cada paso con valores resueltos | Específico de flujos |
| `TimelineEjecucion` | Timeline visual de pasos de una ejecución | **Sí** — cualquier proceso multi-paso a futuro |
| `BannerEdicionActivo` | Banner amarillo "estás editando un flujo activo" | **Sí** — cualquier entidad con publicación |
| `ModalReejecutar` | Modal con opción dry-run vs real + confirmación | Específico de flujos |
| `CatalogoPasos` | Modal/popover para elegir tipo de paso a agregar (agrupado por categorías) | Específico de flujos |

---

## 4. Tecnología descartada

### React Flow

El plan original (memoria del proyecto) mencionaba React Flow para el editor visual. **Descartado.**

Razones:
- Zapier-style vertical NO necesita canvas libre.
- React Flow agrega ~200kb al bundle por funcionalidad que no usamos.
- Reemplazado por: CSS grid/flex (layout vertical) + `dnd-kit` ~30kb (drag-and-drop reorder).

---

## 5. Decisiones de re-evaluación crítica (cerradas el 2026-05-04)

### 5.1 ✓ Truncado de la "1 línea de resumen" en cards medias

**Decisión:** Truncar agresivamente. Mostrar solo lo esencial:
> WhatsApp a contacto • `recordatorio_cuota_3dias`

Detalles completos solo en panel lateral. Variables, condiciones específicas, etc. NO aparecen en la card.

### 5.2 ✓ Preview de valor en picker de variables — búsqueda automática

**Decisión:** Buscar automáticamente la **última entidad del módulo en el estado-objetivo** del disparador (ej: si el flujo se dispara cuando un presupuesto pasa a `aceptado`, tomar el último presupuesto en `aceptado` de la empresa). Si no hay ninguna → mostrar la variable sin preview, solo el nombre.

Esto se carga al abrir el editor; queda cacheado durante la sesión de edición. El usuario no tiene que elegir nada manualmente.

### 5.3 ✓ Modelo "borrador interno" para editar Activo

**Decisión:** El flujo es una sola entidad con dos versiones internas:
- Versión publicada (`disparador/condiciones/acciones` — la que ejecuta el motor)
- Versión borrador (`borrador_jsonb` — la que se está editando)

UI cuando se edita un flujo Activo:
- Banner amarillo arriba: **"Estás editando este flujo. Tus cambios no afectan al flujo activo hasta que clickees Publicar."**
- Botón **"Publicar cambios"** reemplaza la versión publicada con la del borrador.
- Botón **"Descartar cambios"** tira el borrador y vuelve a la versión publicada.

Sin terminología técnica ("draft", "versionado") en la UI. Solo "borrador" y "publicar".

### 5.4 ✓ Reejecutar desde el historial — doble botón + idempotencia

**Decisión:** Botón "Reejecutar" abre mini-modal con dos opciones:
- **"Modo prueba (dry-run)"** — ejecuta sin envíos reales. **Default seleccionado.**
- **"Ejecución real"** — requiere confirmación adicional ("Esto va a ejecutar las acciones de nuevo, incluyendo enviar WhatsApp/correo a destinatarios reales. ¿Confirmar?").

Si la ejecución original ya envió un WhatsApp con misma `clave_idempotencia`, warning adicional: "Ya se envió un mensaje similar el [fecha]. ¿Querés enviar otro?".

### 5.5 ✓ Sección por módulo con plantillas sugeridas

**Decisión:** La sección "Flujos de [Módulo]" dentro de cada `/modulo/configuracion` muestra:

1. **Lista de flujos del módulo** (solo lectura, click para abrir editor central).
2. **Plantillas sugeridas del módulo** (curadas por nosotros): cards con título, descripción corta, y botón "Crear flujo basado en esta plantilla" que abre el editor central pre-cargado con la plantilla.

Ejemplos de plantillas por módulo:
- **Presupuestos:** "Recordatorio 3 días antes del vencimiento", "Notificar al vendedor cuando el cliente acepta", "Crear orden de venta automática al aceptar presupuesto".
- **Visitas:** "Confirmar visita 1 día antes via WhatsApp", "Crear actividad de seguimiento al completar visita".
- **Cuotas:** "Recordatorio de cuota próxima a vencer", "Notificar al cliente cuando se registra el pago".
- **Conversaciones inbox:** "Asignar a supervisor si lleva 2hs sin respuesta", "Marcar como spam si X palabras".

**Costo asumido:** mantener la lista de plantillas curadas como parte del producto. Ver §6 sobre PR específico de plantillas.

### 5.6 ✓ Sin sección global "Ejecuciones" en sidebar (primer release)

**Decisión:** No agregar sección global "Ejecuciones" al sidebar en el primer release.

Las ejecuciones se ven desde:
1. Pestaña "Historial" dentro del editor de cada flujo.
2. Sección "Flujos disparados" en chatter de cada entidad.

Si en algún momento aparece la necesidad real de monitoreo operativo a nivel admin ("¿cuántas ejecuciones fallaron hoy en toda mi empresa?"), se suma una vista en `/configuracion → Salud del motor` en una versión futura. **No entra en el primer release.**

### 5.7 ✓ React Flow descartado definitivamente

**Decisión:** No usar React Flow. Verificado: no está instalado en `package.json` (la mención original en la memoria era del plan inicial, antes de armar el motor).

**Reemplazo técnico:**
- **CSS grid/flex** + tokens semánticos de Flux para el layout vertical de pasos.
- **`dnd-kit`** (~30kb, lib liviana usada por Linear) para drag-and-drop al reordenar pasos.
- **Framer Motion** (ya instalado en Flux) para animaciones sutiles entre estados.

**Garantía de "look profesional":** invertir en una sesión de mockup descriptivo detallado antes de tirar código de PR 19 (ver §7). Si el mockup no convence, se reevalúa React Flow como opción B antes de codear.

**Referencias visuales:** Zapier, HubSpot Workflows, Pipedrive — todos editores verticales custom (no React Flow), look premium.

---

## 6. Próximos PRs

### PR 18 — CRUD endpoints (backend)

- `/api/flujos` (GET listar, POST crear)
- `/api/flujos/[id]` (GET detalle, PUT actualizar, DELETE)
- `/api/flujos/[id]/publicar` (POST: borrador_jsonb → versión publicada)
- `/api/flujos/[id]/descartar-borrador` (POST)
- `/api/flujos/[id]/activar` (POST)
- `/api/flujos/[id]/pausar` (POST)
- `/api/flujos/[id]/probar` (POST con flag `dry_run` y opcional `evento_id`)
- `/api/ejecuciones` (GET listar con filtros)
- `/api/ejecuciones/[id]` (GET detalle)
- `/api/ejecuciones/[id]/reejecutar` (POST)
- `/api/ejecuciones/[id]/cancelar` (POST)
- Schema migration: agregar columna `borrador_jsonb` a `flujos`.
- Tests unit + E2E de cada endpoint.

### Sesión de mockup descriptivo (entre PR 18 y PR 19)

Antes de tocar código de UI, hacemos una sesión donde describo en texto detallado cada pantalla:
- Layout (qué va arriba/medio/abajo, tamaños relativos).
- Tipografía y tokens semánticos a usar.
- Animaciones puntuales (qué se anima, en qué momento, con qué duración).
- Microcopy de cada label, helper text, estado vacío, mensaje de error.
- Comportamiento de hovers, focus, disabled, loading.

El usuario valida el mockup. Si algo no convence, se ajusta en texto (gratis) antes de codear (caro).

**Si después del mockup descriptivo el usuario no se siente convencido del look:** se reevalúa **React Flow** como opción B antes de empezar PR 19.

### PR 19 — UI (frontend)

Implementación visual de todo lo descrito en §1 + §5. Orden tentativo de sub-PRs:

1. **19.1** — Listado tabla + filtros + estado vacío educativo
2. **19.2** — Pantalla editor (canvas vertical de pasos, agregar/eliminar/reordenar con dnd-kit)
3. **19.3** — Panel lateral de edición de cada paso + picker de variables (`{{vars}}`)
4. **19.4** — Validación tiempo real + bloqueo al activar + banner edición activo
5. **19.5** — Sandbox: vista previa rendering + ejecución dry-run
6. **19.6** — Historial: pestaña en editor + sección en chatter de entidad
7. **19.7** — Sección dentro de configuración por módulo + plantillas sugeridas (§5.5)

### PR 20+ (futuro, no urgente)

- `tiempo.diario` con UI amigable (hora + días de la semana)
- Disparador `webhook` entrante
- Vista global de monitoreo (si aparece la necesidad)
- Tests E2E reales con WhatsApp posta (sesión coordinada con número de prueba)

---

## 7. Reglas durante la implementación

- **Cada PR de UI tiene su E2E real** en Vercel Preview antes de cerrar (igual que se hizo con PR 14 a PR 17).
- **Cada PR genera screenshots** del happy path para incluir en el body del commit.
- **Memoria del proyecto** se actualiza al cierre de cada sub-PR con hash + resumen.
- **CLAUDE.md** se actualiza al final con la sección "Patrón UI de Flujos" si surgen patrones reutilizables.
- **Pendientes operacionales acumulados al cierre del refactor** (de la memoria del proyecto): swap legacy JWT, sacar `NEXT_APP_URL`, reactivar Deployment Protection, rotar `CRON_SECRET`. Se hacen al merge final a main.
