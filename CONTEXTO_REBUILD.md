# SalixCRM v2 — Documento de Contexto para Reconstrucción

> Este documento describe TODA la funcionalidad del CRM actual para reconstruirlo desde cero con un stack moderno.

---

## 1. VISIÓN GENERAL

**SalixCRM** es una PWA multi-tenant (multi-empresa) tipo Odoo/Attio para PyMEs.
- Cada empresa tiene sus datos completamente aislados
- Mobile-first, instalable como app
- Dos frontends: CRM principal (`app.salixweb.com`) y Kiosco de fichaje (`kiosco.salixweb.com`)
- Todo el código, variables, funciones y componentes en **español**
- Comentarios en español explicando qué hace cada bloque y dónde se usa

---

## 2. STACK PROPUESTO (v2)

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| **Frontend** | Next.js 15 (App Router) + React 19 + TypeScript | SSR, API routes integradas, PWA con next-pwa |
| **Base de datos** | PostgreSQL via Supabase | Relacional, RLS multi-tenant automático, realtime |
| **Auth** | Supabase Auth | JWT con empresa_id, RLS nativo, OAuth providers |
| **ORM** | Drizzle ORM | Tipado, SQL-first, migraciones automáticas |
| **Realtime** | Supabase Realtime (WebSockets) | Escucha cambios en tablas sin polling |
| **Storage** | Supabase Storage | Archivos, fotos, PDFs con políticas de acceso |
| **Estilos** | Tailwind CSS 4 + sistema de tokens de diseño | Estilo limpio tipo Attio/Linear, dark/light mode |
| **Animaciones** | Framer Motion | Transiciones, modales, expansiones |
| **Editor texto** | Tiptap | Composición de correos y notas rich-text |
| **Correo** | react-email + Resend (o nodemailer) | Correos HTML profesionales y bien armados |
| **Push** | Firebase Cloud Messaging (FCM) | No hay alternativa gratuita mejor para PWA |
| **IA** | Vercel AI SDK + Anthropic/OpenAI/Google | Streaming, tool calling, multi-proveedor |
| **Cron jobs** | Supabase Edge Functions + pg_cron | Auto-checkout, sincronización IMAP, recordatorios |
| **PDF** | @react-pdf/renderer o Puppeteer | Generación de presupuestos, facturas, informes |
| **WhatsApp** | Meta Cloud API (webhook + envío) | Integración directa |
| **Excel** | ExcelJS | Exportación con estilos |

---

## 3. ARQUITECTURA MULTI-TENANT

### Estrategia: Row Level Security (RLS) en una sola DB

```sql
-- Cada tabla tiene columna empresa_id
-- El JWT de Supabase Auth contiene empresa_id
-- Una sola política protege TODA la tabla:

CREATE POLICY aislamiento_empresa ON contactos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- Es IMPOSIBLE que un usuario vea datos de otra empresa
```

### Schema PostgreSQL (estructura base)

```sql
-- Tablas globales (sin RLS)
empresas (id, nombre, logo_url, pais, color_marca, slug, creado_en)
slugs (slug, empresa_id)  -- subdominio → empresa
miembros (usuario_id, empresa_id, rol, unido_en)  -- multi-empresa
invitaciones (token, empresa_id, rol, correo, usado)

-- Todas las demás tablas tienen empresa_id + RLS
```

---

## 4. MÓDULOS Y FUNCIONALIDAD COMPLETA

### 4.1 AUTENTICACIÓN Y MULTI-EMPRESA

**Registro e inicio de sesión:**
- Email/password, Google Sign-In
- Verificación de email
- Recuperación de contraseña
- Multi-cuenta (un usuario puede pertenecer a varias empresas)

**Cambio de empresa:**
- Switcher instantáneo (sin recarga)
- Precarga de datos de empresas al abrir el selector
- JWT se actualiza con nueva empresa_id y rol

**Subdominios:**
- `{slug}.salixweb.com` → resuelve a una empresa
- Tabla `slugs` para lookup O(1)

**Custom claims en JWT:**
- `empresa_id` — empresa activa
- `rol` — rol del usuario en esa empresa
- `es_superadmin` — flag para panel de administración global

---

### 4.2 SISTEMA DE PERMISOS (RBAC)

**25+ módulos con permisos granulares:**

```
contactos, visitas, actividades, calendario, presupuestos, facturas,
informes, inbox_whatsapp, inbox_correo, inbox_interno, usuarios, empresa,
configuracion, auditoria, asistencias, productos, ordenes_trabajo,
config_pipeline, config_actividades, config_documentos, config_contactos,
config_asistencias, config_correo, config_whatsapp, config_ia
```

**Acciones por módulo:**
- `ver_propio` — solo registros creados/asignados al usuario
- `ver_todos` — todos los registros de la empresa
- `crear`, `editar`, `eliminar`
- `completar` — marcar como terminado (visitas, órdenes)
- `enviar` — enviar documentos

**Roles predefinidos:**
| Rol | Descripción |
|-----|------------|
| `propietario` | Acceso total, gestión de empresa |
| `administrador` | Casi todo, sin eliminar empresa |
| `gestor` | Ventas/CRM completo |
| `vendedor` | Solo contactos y actividades propias |
| `supervisor` | Visión de equipo |
| `empleado` | Básico, solo asistencias |
| `invitado` | Módulos específicos |

---

### 4.3 CONTACTOS (CRM)

**Campos:**
- nombre, apellido, correo, telefono, whatsapp, cuit, dni
- tipo: cliente | proveedor | competidor | equipo | prospecto | otro
- codigo secuencial atómico (C-0001, C-0002...)
- etiquetas[] (array de tags)
- etapa (pipeline configurable por empresa)
- seguidores[] (usuarios que reciben notificaciones)
- direcciones[] (array de: calle, numero, piso, ciudad, provincia, pais, codigo_postal)
- campos de búsqueda full-text (nombre, email, teléfono, código, rubro)

**Funcionalidad:**
- Vista tabla / tarjetas / kanban (agrupado por tipo, etiqueta, sector o etapa)
- Búsqueda full-text con debounce 400ms
- Filtros avanzados por tipo, etiqueta, etapa, fecha
- Importación masiva desde Excel/CSV con detección de duplicados
- Acciones masivas (asignar, etiquetar, eliminar)
- Código secuencial con prefijo configurable (C-, CLI-, etc.)
- Auto-seguidor: el creador se agrega automáticamente a seguidores
- Chatter (timeline de notas, cambios, correos) en cada contacto
- Vinculación automática con conversaciones por teléfono/email

---

### 4.4 ACTIVIDADES

**Campos:**
- titulo, descripcion, tipo (configurable), prioridad (baja|normal|alta)
- estado: pendiente | completada | vencida | cancelada
- fecha_vencimiento, fecha_completada
- asignado_a (usuario)
- vinculos[]: array de {tipo: 'contacto'|'usuario'|'visita'|'documento', id, nombre}
- seguidores[], _busqueda[]

**Funcionalidad:**
- Vista tabla / tarjetas
- Tipos y estados configurables por empresa (nombre + color)
- Presets de actividades (plantillas rápidas)
- Vencimientos con alertas
- Vinculación multi-tipo (a contacto, visita, documento, usuario)
- Creación desde chatter de cualquier entidad
- Widget en dashboard con actividades pendientes
- Notificaciones push por vencimiento

---

### 4.5 VISITAS

**Campos:**
- codigo secuencial (VT-0001)
- contacto vinculado, tecnico asignado
- estado: programada | en_progreso | completada | cancelada
- fecha_programada, fecha_realizada
- motivo (configurable), resultado (configurable)
- direccion: {texto, lat, lng}
- duracion_estimada, duracion_real
- notas, fotos[]
- seguidores[], _busqueda[]

**Funcionalidad:**
- Programación con calendario
- Asignación a técnicos/vendedores
- Tracking de ubicación y geo-distancia
- Notificación al cliente de visita programada (email/WhatsApp)
- Chatter con timeline de eventos
- Integración con calendario compartido

---

### 4.6 DOCUMENTOS (Presupuestos, Facturas, Informes)

**Campos comunes:**
- tipo_documento: presupuesto | factura | informe | orden_trabajo
- numero con sistema flexible: prefijo + separador + año + mes + secuencial
- estado: borrador | enviado | confirmado | rechazado | pagado | vencido | cancelado
- contacto vinculado (cliente)
- lineas[]: array de {producto_id, nombre, descripcion, cantidad, precio_unitario, descuento, impuesto, subtotal}
- total_neto, total_impuestos, total, moneda
- notas, terminos_condiciones
- fecha_emision, fecha_vencimiento

**Campos específicos de facturas (Argentina):**
- letra_comprobante: A | B | C
- cuit del emisor y receptor
- tipo_factura_fiscal
- punto_venta

**Sistema de numeración configurable:**
- Componentes: prefijo, separador, año (2 o 4 dígitos), mes, día, secuencial (ancho configurable)
- Reinicio: nunca | anual | mensual
- Ejemplo: `FA-2026-00001`, `PRE/26/03/0001`

**Funcionalidad:**
- Cálculo automático de totales, impuestos, descuentos por línea
- Generación de PDF con plantilla personalizable
- Portal público para clientes (descargar, firmar, pagar, comentar)
- Firma digital
- Envío por email con tracking
- Conversión presupuesto → factura
- Impuestos configurables por empresa (IVA 21%, 10.5%, etc.)
- Monedas configurables

---

### 4.7 PRODUCTOS

**Campos:**
- nombre, descripcion, codigo secuencial (PRD-0001)
- precio_costo, precio_venta
- stock (con tracking y auditoría)
- categoria, subcategoria
- imagenes[], _busqueda[]
- unidad_medida
- activo (boolean)

**Funcionalidad:**
- CRUD con búsqueda por nombre, código, categoría
- Selector de productos en documentos (autocompletado)
- Actualización de stock al confirmar documentos
- Exportación a Excel

---

### 4.8 INBOX (Mensajería Omnicanal)

#### Tres canales:

**WhatsApp:**
- Webhook Meta Cloud API para recibir mensajes
- Envío de texto, imágenes, archivos, audio
- Plantillas aprobadas por Meta (templates)
- Descarga de media (audio, imagen, PDF) desde Meta
- Transcripción de audio con Whisper (OpenAI/Groq)
- Descripción de imágenes con visión (Anthropic/OpenAI/Google)
- Extracción de texto de PDFs

**Correo:**
- Sincronización IMAP (polling configurable)
- Envío SMTP con nodemailer
- Threading (In-Reply-To, References, Message-ID)
- Adjuntos con almacenamiento en Storage
- CC, BCC
- Editor rich-text (Tiptap) con firma configurable
- **IMPORTANTE v2: usar react-email o similar para que los correos se vean profesionales**

**Interno:**
- Mensajes entre empleados de la empresa
- Grupos de conversación

#### Estructura de conversación:
```
conversacion: {
  tipo: 'whatsapp' | 'correo' | 'interno',
  participantes[],
  asignado_a (usuario responsable),
  contacto vinculado,
  etapa (pipeline custom para conversaciones),
  ultimo_mensaje_en, ultimo_mensaje_texto,
  no_leidos: {[usuario_id]: count},
  archivada: boolean
}

mensaje: {
  tipo: 'texto' | 'imagen' | 'video' | 'audio' | 'archivo' | 'plantilla_wa',
  contenido,
  autor_id, autor_nombre,
  adjuntos[]: {url, nombre, tipo, tamano},
  es_entrante: boolean,
  estado: 'enviando' | 'enviado' | 'entregado' | 'leido' | 'error',
  transcripcion (audio → Whisper),
  descripcion_ia (imagen → visión),
  texto_documento (PDF → OCR)
}
```

**Funcionalidad:**
- Lista de conversaciones con filtros por canal, asignado, etapa
- Round-robin automático: distribuye nuevas conversaciones entre agentes del sector
- Contador de no leídos en tiempo real
- Búsqueda de conversaciones
- Archivo de conversaciones
- Permisos: ver_propio vs ver_todos

---

### 4.9 AGENTE IA AUTÓNOMO (Agente Salix)

**Trigger:** Nuevo mensaje entrante en conversación (WhatsApp o correo)

**Proveedores soportados:** Anthropic (Claude), OpenAI (GPT-4), Google (Gemini), Groq

**Configuración por empresa:**
- Habilitado/deshabilitado
- Proveedor + modelo + API key
- Prompt personalizable con variables dinámicas
- Herramientas habilitadas (array vacío = solo texto)
- Horario de operación (24/7, solo fuera de horario, horarios específicos)
- Tiempo de respuesta simulado (min/max) para parecer humano
- Límite de respuestas por conversación (default 30)

**Variables dinámicas en prompts:**
```
{{contacto.nombre}}, {{contacto.telefono}}, {{contacto.correo}}, {{contacto.etapa}}
{{empresa.nombre}}, {{empresa.correoContacto}}
{{conversacion.canal}}, {{conversacion.etapa}}
{{fecha.hoy}}, {{fecha.hora}}, {{fecha.diaSemana}}
```

**Tool Calling (herramientas del agente):**
| Herramienta | Acción |
|-------------|--------|
| `crear_visita` | Programa una cita con fecha, motivo |
| `crear_actividad` | Crea tarea de seguimiento |
| `crear_contacto` | Registra nuevo contacto |
| `actualizar_contacto` | Actualiza datos del contacto |
| `cambiar_etapa` | Mueve conversación en el pipeline |

**Controles de seguridad:**
- Rate limiting: máx 100 respuestas/hora por empresa
- Handoff: detección de palabras clave para transferir a humano
- Auto-pausa: cuando un humano interviene (1h, 8h o desactivar)
- Anti-loop: detección de 3+ respuestas consecutivas sin input del cliente
- Anti-repetición: ignora mensajes duplicados
- Límite por conversación configurable

**Tipos de agente (según contexto):**
- `captador` — contacto nuevo, sin etapa
- `seguimiento` — contacto existente con etapa
- `recurrente` — contacto existente sin etapa

**Procesamiento multimedia:**
- Audio → transcripción Whisper
- Imagen → descripción con visión
- PDF → extracción de texto

**Auditoría:** Cada acción del agente se registra (herramienta, argumentos, resultado, éxito/fallo)

---

### 4.10 ASISTENTE IA COPILOTO (Asistente Salix)

**Tipo:** Botón flotante dentro del CRM (no es el agente del inbox)

**Funcionalidad:**
- Chat conversacional con el usuario del CRM
- Contexto del módulo actual (contactos, pipeline, productos, presupuestos)
- Prompts especializados por módulo
- Búsqueda en base de conocimiento de la empresa
- Soporta los mismos proveedores que el agente

**Configuración independiente:** proveedor, modelo, API key, prompt, variables

---

### 4.11 ASISTENCIAS Y FICHAJE

#### Tres métodos de fichaje:

**1. Manual (por admin):**
- El administrador marca entrada/salida desde la matriz de asistencias
- Edición de horarios pasados

**2. Kiosco (terminal física):**
- Terminal dedicada con lectura RFID/NFC
- Token JWT especial (`kiosco_{empresa_id}_{terminal_id}`)
- PIN de administrador para salir del modo kiosco
- Captura de foto silenciosa (opcional)
- URL: `kiosco.salixweb.com`

**3. Automático (PWA) — El más complejo:**

**Flujo:**
1. Usuario abre la app → hook `useFichajeAutomatico` se monta
2. Si `metodoFichaje === 'automatico'` → marca entrada automáticamente
3. Pestaña visible → heartbeat cada 5 minutos a base de datos realtime
4. Pestaña oculta → inicia timer local de inactividad (default 30 min)
5. Timer expira → marca salida automáticamente
6. Tracking de intervalos de actividad (activo/pausa) con resolución de minutos

**Capas de seguridad (cierre automático):**
| Capa | Mecanismo | Frecuencia |
|------|-----------|-----------|
| 1 | Timer local en el navegador (visibilitychange) | Instantáneo |
| 2 | Flag `salida_pendiente` en DB realtime | Al ocultar pestaña |
| 3 | Cron: revisar heartbeat de sesiones | Cada 15 minutos |
| 4 | Cron: cerrar turnos > 12 horas | 3:00 AM |
| 5 | Cron: marcar ausentes del día | 23:00 PM |

#### Estructura del registro de asistencia:
```
{
  usuario_id, usuario_nombre, fecha (YYYY-MM-DD),
  estado: 'activo' | 'almuerzo' | 'particular' | 'cerrado' | 'auto_cerrado',
  entrada, salida,
  inicio_almuerzo, fin_almuerzo,
  salida_particular, vuelta_particular,
  tipo: 'normal' | 'adelanto' | 'tardanza' | 'feriado',
  metodo_registro: 'manual' | 'kiosco' | 'automatico',
  cierre_automatico: boolean,
  intervalos_actividad: [{tipo: 'activo'|'pausa', desde, hasta, minutos}],
  foto_entrada, foto_salida,
  terminal_id, terminal_nombre,
  puntualidad_min, notas
}
```

#### Heartbeat en DB Realtime:
```
sesiones/{usuario_id}/{session_id} = {
  activa: boolean,
  ultima_actividad: timestamp,
  salida_pendiente: boolean
}
```

#### Configuración de asistencias (por empresa):
```
fichaje_automatico: {
  umbral_inactividad_min: 30,
  permitir_en_fin_de_semana: false,
  permitir_en_feriados: false,
  hora_inicio_permitida: "06:00",
  hora_fin_permitida: "23:00"
}
auto_checkout: {
  habilitado: true,
  duracion_max_horas: 12,
  notificar_admin: true
}
kiosco: {
  habilitado: false,
  metodo_lectura: 'rfid_hid' | 'nfc',
  pin_admin: '1234'
}
```

#### Matriz de asistencias:
- Vista tabular: filas = usuarios, columnas = días del rango
- Cada celda muestra: hora entrada, hora salida, total horas, estado
- Columna de feriados (públicos, bancarios, opcionales) por país
- Exportación a Excel con estilos

#### Widget de jornada (en dashboard):
- Estado actual del fichaje (activo, almuerzo, particular, cerrado)
- Tiempo transcurrido en tiempo real
- Barra visual de intervalos activo/pausa
- Botones: iniciar almuerzo, salida particular, volver

---

### 4.12 CALENDARIO

**Fuentes de eventos:**
- Actividades (por fecha de vencimiento)
- Visitas (por fecha programada)
- Cumpleaños de contactos
- Feriados del país (públicos, bancarios, opcionales)

**Vistas:** Mensual, semanal, diario

**Funcionalidad:**
- Colores por tipo de evento
- Click para crear actividad/visita
- Drag-and-drop para mover eventos
- Feriados offline (librería date-holidays, 199 países)

---

### 4.13 ÓRDENES DE TRABAJO

**Campos:**
- codigo secuencial, titulo, descripcion
- contacto vinculado
- estado general
- etapas[]: array de {id, nombre, completada, fecha_completada, responsable}
- asignados[]

**Funcionalidad:**
- Etapas customizables por empresa
- Progreso visual por etapa
- Asignación a equipos
- Chatter con timeline

---

### 4.14 AUDITORÍA

**Registro automático de:**
- Creación, edición, eliminación de cualquier entidad
- Cambios de permisos y roles
- Acciones del agente IA (herramientas ejecutadas)
- Cambios de configuración

**Campos:**
```
{
  usuario_id, usuario_nombre,
  accion: 'crear' | 'editar' | 'eliminar',
  recurso: 'contactos' | 'actividades' | etc,
  recurso_id, recurso_nombre,
  fecha,
  cambios: { antes: {}, despues: {} }
}
```

**Vista:** Tabla filtrable por recurso, usuario, fecha, acción. Exportable.

---

### 4.15 EMPRESA Y CONFIGURACIÓN

**Datos de empresa:**
- nombre, descripcion, logo, color_marca
- correo_contacto, telefono
- pais (para feriados)
- slug (subdominio)

**Configuraciones modulares:**
- Pipeline: etapas del embudo de ventas [{id, nombre, color}]
- Actividades: tipos + estados personalizados
- Contactos: roles, etiquetas, cargos predefinidos
- Documentos: numeración, impuestos, monedas
- Asistencias: fichaje automático, kiosco, auto-checkout
- WhatsApp: cuentas conectadas (phoneNumberId, accessToken)
- Correo: cuentas SMTP/IMAP
- Agente IA: proveedor, prompt, herramientas, horario
- Asistente IA: proveedor, prompt, variables
- Google Drive: OAuth + sincronización

**Módulos habilitados:** Lista de qué módulos tiene activos la empresa (sistema de apps instalables)

---

### 4.16 USUARIOS Y EQUIPO

**Campos:**
- nombre, correo, whatsapp, foto
- rol (propietario, admin, gestor, vendedor, supervisor, empleado, invitado)
- sector (departamento)
- turno laboral (horario_entrada, horario_salida, dias_laborales[])
- metodo_fichaje: manual | kiosco | automatico
- estado: activo | inactivo
- puesto_nombre

**Funcionalidad:**
- Invitación por token (link único)
- Gestión de roles y permisos
- Configuración de turno laboral por usuario
- Presencia online/offline en tiempo real (WebSocket o RTDB)
- Multi-empresa: un usuario puede pertenecer a N empresas con diferentes roles

---

### 4.17 DASHBOARD

**Widgets personalizables (drag-and-drop, resize):**
- Reloj
- Widget de jornada (fichaje actual)
- Actividades pendientes
- Agenda del día
- Mensajes sin leer
- KPIs: contactos nuevos, presupuestos, facturas, visitas, inbox, productos

**Dos pestañas:** Panel (widgets) y Métricas (KPIs numéricos)

**Onboarding wizard:** Para empresas nuevas, guía los primeros pasos

---

### 4.18 NOTIFICACIONES PUSH (FCM)

**Triggers:**
- Nuevo mensaje en conversación asignada
- Mención en chatter
- Actividad asignada o vencida
- Visita programada
- Recordatorio de fichaje

**Badge count** en el ícono de la app

---

### 4.19 AUTOMATIZACIONES

**Disparadores:**
- Nuevo contacto creado
- Contacto cambia de etapa
- Nueva conversación
- Documento enviado/confirmado

**Acciones:**
- Enviar email con template
- Enviar WhatsApp con template
- Crear actividad automática
- Asignar a usuario

**Templates con variables:** `{{contacto.nombre}}`, `{{documento.numero}}`, etc.

---

### 4.20 INTEGRACIONES EXTERNAS

**Google Drive:**
- OAuth2 (intercambio de código)
- Sincronización de contactos desde Google Sheets
- Sincronización programada (cron)

**AFIP (Argentina):**
- Verificación de CUIT
- Tipos de comprobante (A, B, C)

**Portal público de documentos:**
- URL con token aleatorio (sin autenticación)
- Descargar PDF, firmar, comentar, confirmar pago
- Contraseña opcional

---

## 5. SISTEMA DE UI Y DISEÑO

### 5.1 Filosofía de diseño (v2)

**Inspiración:** Attio CRM, Linear, Notion — interfaces limpias, planas, sin ruido visual.

**Principios:**
- Diseño **plano y limpio** (flat design, sin glassmorphism ni efectos pesados)
- Espaciado generoso, tipografía clara
- Colores sutiles, uso estratégico del color para estados y acciones
- Micro-interacciones suaves (no exageradas)
- Mobile-first, responsive

### 5.2 Sistema de tokens (TODOS centralizados, NADA hardcodeado)

Crear un sistema de tokens semánticos que cubra:

```typescript
// Texto (jerárquico)
texto.primario    // Títulos, contenido principal
texto.secundario  // Cuerpo, descripciones
texto.terciario   // Hints, placeholders, metadata
texto.marca       // Color de marca de la empresa (dinámico)

// Superficies
superficie.app         // Fondo de la app
superficie.tarjeta     // Fondo de tarjetas/paneles
superficie.elevada     // Modales, dropdowns
superficie.sidebar     // Barra lateral

// Bordes
borde.sutil      // Separadores suaves
borde.fuerte     // Bordes de inputs, tarjetas

// Insignias/Badges semánticos (mínimo 10 colores)
insignia.exito, .peligro, .advertencia, .info, .primario, .neutro, etc.

// Canales de mensajería (cada uno con su color)
canal.whatsapp, canal.correo, canal.interno

// Estados de entidades
estado.borrador, .pendiente, .completado, .error, .cancelado

// Colores por sección/módulo
seccion.contactos, .actividades, .documentos, .asistencias, etc.
```

### 5.3 Dark/Light mode
- Automático por preferencia del sistema, con toggle manual
- Persiste en localStorage y base de datos

### 5.4 Color de marca por empresa
- Cada empresa puede configurar su color primario
- Se usa en: sidebar, botones primarios, enlaces, badges activos

---

## 6. COMPONENTES REUTILIZABLES (Biblioteca)

### REGLA: Todo componente que se pueda hacer reutilizable, SE HACE reutilizable.

### 6.1 Primitivas (Nivel base)

| Componente | Descripción |
|-----------|------------|
| `Boton` | Botón con variantes (primario, secundario, peligro, exito, advertencia). Modo solo-ícono, compacto, cargando |
| `Input` | Input unificado (text, email, search, select, textarea, password). Con ícono, etiqueta flotante |
| `Select` | Dropdown portal con variantes (botón, campo, plano). Posicionamiento inteligente |
| `Tabs` | Tabs con indicador animado. Mobile: solo ícono. Desktop: ícono + label |
| `Interruptor` | Toggle switch animado |
| `Insignia` | Badge/chip con color semántico. Removible |
| `SelectorFecha` | Calendario mensual dropdown |
| `SelectorHora` | Selector hora:minuto |
| `SelectorFechaHora` | Combo fecha + hora |
| `Calendario` | Calendario embebido (compacto con dots / expandido) |
| `SelectorIconos` | Grilla visual de íconos |
| `SelectorColor` | Swatches + picker hex |
| `Separador` | Divisor con label opcional |
| `AlertaInline` | Alerta contextual con fondo semántico |
| `Popover` | Portal flotante |
| `Tooltip` | Etiqueta con delay configurable |

### 6.2 Tablas y listas

| Componente | Descripción |
|-----------|------------|
| `TablaBase` | Tabla avanzada: columnas congeladas (sticky), checkbox, orden, expansión mobile, cálculos al pie (SUM/AVG/COUNT), skeleton, estado vacío, responsive |
| `EncabezadoTabla` | Header con título, contador, acciones, paginador, tabs. Sticky |
| `Paginador` | Navegación "1-80 de 234" con botones anterior/siguiente |
| `ThOrdenable` | Header de columna con orden asc/desc |
| `FilaExpandible` | Mobile: tap expande detalles. Desktop: tap navega |
| `VistaKanban` | Tablero horizontal con columnas agrupadas. Badge + contador |
| `ElementoLista` | Fila con avatar, título, subtítulo, acción |
| `PastillasFiltro` | Chips removibles para filtros activos |

### 6.3 Modales

**REGLA: Todos los modales iguales. Más anchos que altos en PC. Responsive.**

| Componente | Descripción |
|-----------|------------|
| `Modal` | Modal portal con backdrop. Tamaños: sm a 5xl, 60%, 80%. **Más anchos que altos en PC.** Subcomponentes: Cuerpo (scroll) + Acciones (footer). Escape + click-outside. **TODOS los modales usan este mismo componente base** |
| `ModalConfirmar` | Confirmación de acción peligrosa/advertencia |

### 6.4 Feedback

| Componente | Descripción |
|-----------|------------|
| `Toast` | Notificación flotante por tipo (exito, error, advertencia, info). Auto-dismiss con hover-pause |
| `EstadoVacio` | Placeholder cuando no hay datos (ícono + mensaje + acción) |

### 6.5 Entidad (patrones de página)

| Componente | Descripción |
|-----------|------------|
| `PlantillaApp` | Layout principal: sidebar + header + main. Migas automáticas. Banners |
| `PanelChatter` | Timeline estilo Odoo: notas, cambios, correos, actividades. Multi-canal |
| `WidgetJornada` | Estado del fichaje, tiempo, intervalos, botones de pausa |
| `ModalCompositorCorreo` | Editor email full-screen con Tiptap, firma, CC/BCC, adjuntos |
| `AvatarUsuario` | Avatar con fallback a iniciales |
| `BarraFlotante` | Dock fijo inferior |
| `SelectorVistas` | Toggle tabla/kanban/calendario |

### 6.6 Vitrina de componentes
- Página dedicada con TODOS los componentes organizados por nivel
- Índice interactivo con scroll a cada sección
- Sirve como documentación viva y referencia de diseño

---

## 7. HOOKS REUTILIZABLES

| Hook | Descripción |
|------|------------|
| `useFichajeAutomatico` | Fichaje automático PWA: entrada/salida, heartbeat, intervalos, timer inactividad |
| `useListaPaginada` | Paginación con cursor, búsqueda debounce, contador total, cache sessionStorage |
| `useListaEscalable` | Infinite scroll con intersection observer |
| `useRol` | Verificación de permisos: `tieneAcceso(modulo, accion)` |
| `useDashboardConfig` | Personalización de widgets (drag-and-drop, resize, persistencia) |
| `useEventosCalendario` | Inyecta actividades, visitas, feriados al calendario |
| `useChatterUnificado` | Timeline unificada de cambios por entidad |
| `useDeteccionVista` | Detecta mobile/tablet/desktop |
| `useVistaModo` | Alterna tabla/tarjetas/kanban |
| `usePresencia` | Estado online/offline de usuarios en tiempo real |
| `useNotificacionesPush` | Registro FCM y permisos |
| `useLongPress` | Detección de long press en móviles |
| `useHaptic` | Vibración táctil |
| `useBottomInset` | Safe area para notch/home indicator |
| `useNavegacionContextual` | Navegación cross-módulo con contexto |
| `useConfigActividades` | Config de tipos y estados de actividades |
| `useConfigContactos` | Config de roles, etiquetas, cargos |
| `useConfigDocumentos` | Config de numeración, impuestos, monedas |

---

## 8. CRON JOBS / FUNCIONES PROGRAMADAS

| Job | Frecuencia | Descripción |
|-----|-----------|------------|
| `autoCheckoutDiario` | 3:00 AM (Argentina) | Cierra turnos abiertos > 12 horas |
| `autoCheckoutPorInactividad` | Cada 15 min | Revisa heartbeat, cierra por inactividad |
| `marcarAusentesNocturno` | 23:00 PM | Marca como ausentes a quienes no ficharon |
| `recordatorioFichaje` | Configurable | Push de recordatorio de fichaje |
| `limpiarNotificaciones` | Diario | Elimina notificaciones antiguas |
| `snapshotMetricasMensuales` | Mensual | Snapshot de KPIs |
| `sincronizarImap` | Configurable | Sincronización de correo entrante |
| `enviarCorreosProgramados` | Cada minuto | Envía correos en cola |
| `limpiarPortalDocumentos` | Diario | Elimina tokens de portal expirados |
| `backupAutomaticoFirestore` | Semanal | Backup de datos |
| `syncProgramadoGoogleDrive` | Configurable | Sincronización con Google Sheets |

---

## 9. BÚSQUEDA FULL-TEXT

**Estrategia actual (Firestore):** Campo `_busqueda` con array de tokens → `array-contains`

**Estrategia v2 (PostgreSQL):**
```sql
-- Columna tsvector con GIN index
ALTER TABLE contactos ADD COLUMN busqueda tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(nombre,'') || ' ' || coalesce(apellido,'') || ' ' || coalesce(correo,'') || ' ' || coalesce(telefono,''))
  ) STORED;

CREATE INDEX idx_contactos_busqueda ON contactos USING GIN (busqueda);

-- Query
SELECT * FROM contactos WHERE busqueda @@ plainto_tsquery('spanish', 'juan perez');
```

---

## 10. PRESENCIA ONLINE/OFFLINE

**Estructura:**
```
presencia/{usuario_id} = {
  estado: 'online' | 'offline',
  estado_manual: 'online' | 'ausente' | 'no_molestar',
  ultima_vez: timestamp
}
```

**Funcionalidad:**
- Heartbeat cada 5 minutos si pestaña visible
- onDisconnect automático al perder conexión
- Soporte multi-sesión (máximo 4 simultáneas)
- Indicador visual en avatares y lista de usuarios

---

## 11. FERIADOS

- Librería `date-holidays` (199 países, offline, sin API)
- Tipos: public (no laborable), bank (bancario), optional (puente/opcional)
- Países: Argentina, México, España, Chile, Colombia, etc.
- Integrado en: calendario, matriz de asistencias, fichaje automático, agente IA

---

## 12. PWA Y OFFLINE

**Manifest:**
- Instalable como app (standalone)
- Tema dinámico por empresa (color de marca)
- Screenshots para app store

**Service Worker:**
- Precaching de assets estáticos
- Cache-first para recursos estáticos
- Network-first para API calls

**Offline:**
- Escrituras pendientes se sincronizan al reconectar
- Lectura fallback a cache

---

## 13. REGLAS DE CÓDIGO (v2)

1. **Todo en español:** componentes, variables, funciones, archivos, props, tipos
2. **Comentarios en español** en cada bloque explicando qué hace y dónde se usa
3. **TypeScript estricto** en todo el proyecto
4. **Componentes reutilizables:** Si algo se repite, se extrae. Un cambio se refleja en todos lados. Solo crear algo específico si se pide explícitamente
5. **Colores NUNCA hardcodeados:** Siempre tokens semánticos del sistema de diseño. Cero hex/rgb sueltos
6. **Modales uniformes:** TODOS los modales usan el mismo componente base. Más anchos que altos en PC. Responsive
7. **Responsive mobile-first:** Diseñar primero para móvil, luego expandir
8. **Correos profesionales:** Usar `react-email` para que se vean bien en Gmail, Outlook, Apple Mail
9. **Sin over-engineering:** Solo lo que se necesita ahora
10. **Estilo visual:** Plano, limpio, tipo Attio/Linear. Sin glassmorphism. Micro-interacciones sutiles
11. **Vitrina de componentes:** Página dedicada con todos los componentes para referencia y consistencia

---

## 14. DEPLOY

**Producción actual:**
- CRM: `app.salixweb.com`
- Kiosco: `kiosco.salixweb.com`

**v2 propuesto:**
- Vercel (Next.js) o Cloudflare Pages
- Supabase (DB + Auth + Storage + Realtime + Edge Functions)
- FCM para push notifications (el único servicio de Firebase que se mantiene)

---

## 15. FLUJOS CRÍTICOS (para no olvidar)

### Flujo de mensaje WhatsApp entrante:
1. Cliente envía mensaje → Meta webhook POST
2. Verificar firma HMAC-SHA256
3. Buscar empresa por phoneNumberId
4. Obtener/crear conversación
5. Auto-vincular contacto por teléfono
6. Descargar media si hay (audio, imagen, PDF)
7. Guardar mensaje
8. Trigger agente IA si habilitado
9. Agente evalúa config, rate limit, horario, handoff
10. Agente genera respuesta (texto o tool calls)
11. Guardar respuesta y enviar via Meta API

### Flujo de fichaje automático PWA:
1. Abrir app → montar hook
2. Si `metodoFichaje === 'automatico'` → marcar entrada
3. Heartbeat cada 5 min (tab visible)
4. Tab oculta → timer inactividad
5. Timer expira → marcar salida
6. Cron 15 min → verificar heartbeats
7. Cron 3 AM → cerrar turnos > 12h
8. Cron 23 PM → marcar ausentes

### Flujo de documento (presupuesto → factura):
1. Crear presupuesto (borrador)
2. Agregar líneas (productos, cantidades, precios)
3. Cálculo automático de totales e impuestos
4. Enviar al cliente (cambia a "enviado")
5. Cliente confirma/rechaza via portal
6. Convertir a factura (hereda líneas)
7. Generar PDF
8. Registrar pago

---

## 16. MÉTRICAS Y CONTADORES

- Contadores atómicos por recurso (códigos secuenciales)
- Contadores del agente IA (respuestas, éxitos, fallos)
- Snapshots mensuales de KPIs
- Auditoría inmutable de todos los cambios

---

## 17. SISTEMA DE NOTIFICACIONES (3 capas)

### 17.1 Notificaciones de Usuario (in-app)

**Colección:** `empresas/{id}/notificacionesUsuario/{notifId}`

```
{
  tipo: string,               // ver tabla de tipos abajo
  destinatario_id: string,    // UID del usuario que la recibe
  titulo: string,
  mensaje: string,
  icono: string,              // Material Symbol
  color: string,              // Tailwind color
  ruta: string,               // URL para navegación al hacer click
  dato: object,               // Metadatos específicos del tipo
  leido: boolean,
  descartado: boolean,        // Oculta sin borrar (con opción "Deshacer")
  fecha_creacion: Timestamp,
  expira_en: Timestamp        // +30 días (auto-limpieza)
}
```

**Tipos de notificación:**

| Tipo | Icono | Color | Trigger |
|------|-------|-------|---------|
| `cumpleanios_propio` | cake | amber | Cron 7AM: detecta cumpleaños del usuario |
| `cumpleanios_colega` | celebration | amber | Cron 7AM: detecta cumpleaños de colegas |
| `anuncio` | campaign | blue | Manual: admin publica anuncio |
| `fichaje` | schedule | purple | Fichaje automático o kiosco |
| `recordatorio` | alarm | teal | Cron cada 5min: procesa recordatorios personales |
| `usuario_pendiente` | person_add | amber | Nuevo usuario solicita acceso |
| `actividad_asignada` | bolt | blue | Trigger: nueva actividad asignada (va a panel de actividades, NO a campana) |
| `actividad_pronto_vence` | timer | red | Cron 8AM: actividades que vencen hoy (va a panel de actividades, NO a campana) |
| `seguidor_agregado` | person_add | blue | Manual: te agregaron como seguidor |
| `portal_vista` | visibility | blue | Trigger: cliente vio el documento en portal |
| `portal_aceptado` | check_circle | emerald | Trigger: cliente aceptó presupuesto |
| `portal_rechazado` | cancel | red | Trigger: cliente rechazó |
| `portal_cancelado` | undo | amber | Trigger: cliente canceló |
| `portal_mensaje` | chat_bubble | blue | Trigger: cliente dejó comentario en portal |
| `portal_comprobante` | receipt_long | teal | Trigger: cliente subió comprobante de pago |
| `portal_comprobante_verificado` | verified | emerald | Trigger IA: comprobante verificado |
| `portal_comprobante_revision` | warning | amber | Trigger IA: requiere revisión manual |
| `portal_comprobante_rechazado` | gpp_bad | red | Trigger IA: comprobante rechazado |
| `automatizacion_ejecutada` | bolt | amber | Trigger: automatización envió algo (+ toast automático) |
| `documento_estado` | description | blue | Trigger: documento cambió de estado |
| `ot_asignada` | engineering | teal | Trigger: orden de trabajo asignada |

### 17.2 Push Notifications (FCM)

**Almacenamiento de tokens FCM:**
- Campo `tokensFCM[]` en `/empresas/{id}/usuarios/{uid}`
- Array de strings (multi-dispositivo)
- Se limpian automáticamente tokens inválidos

**Triggers que generan push:**

| Función Cloud | Trigger | Destinatarios |
|--------------|---------|---------------|
| `enviarPushMensaje` | Nuevo mensaje en conversación | Asignado → seguidores → fallback admins |
| `enviarPushActividad` | Actividad asignada (si responsable ≠ creador) | Responsable |
| `enviarPushVisita` | Visita cambia estado/técnico | Técnico + creador + anterior |
| `enviarPushDocumento` | Documento cambia estado | Creador + seguidores (excluye editor) |
| `enviarPushOrdenTrabajo` | OT asignada | Responsables nuevos |
| `dispararRecordatorios` | Cada 5 min: recordatorios vencidos | Creador del recordatorio |
| `notificarCumpleanios` | 7AM ARG: cumpleaños detectados | Usuario + colegas |
| `alertaVencimientoActividades` | 8AM ARG: actividades que vencen hoy | Responsables |

**Prioridad de destinatarios (mensajes):**
1. `asignadoA` (siempre recibe)
2. `seguidores[]` (suscritos)
3. **Fallback:** config `pushSinAsignar` → 'todos' | 'todos_admins' | UIDs específicos

**Payload push (multi-plataforma):**
```
{
  webpush: { notification: { title, body, icon, badge, tag } },
  apns: { payload: { aps: { alert, sound, badge, content-available } } },
  android: { priority: 'high', notification: { title, body, sound, channelId } }
}
```

### 17.3 Toasts (in-app inmediato)

**Tipos:** exito (verde), error (rojo), advertencia (ámbar), info (azul), mensaje (agrupado por canal)

**Duración:** Simple 4s, mensaje 8s, customizable. Hover pausa el auto-dismiss.

**Con acción:** Botón "Deshacer" con callback (ej: restaurar notificación descartada)

### 17.4 UI de Notificaciones

**3 iconos en el header (campana + badge):**

1. **Mensajes** (PanelMensajes) — conversaciones no leídas del inbox
2. **Actividades** (PanelActividades) — actividades pendientes/vencidas en tiempo real
3. **Notificaciones** (PanelNotificaciones) — centro de notificaciones con tabs "Nuevas" / "Anteriores"

**Centro Unificado (CentroNotificacionesDrawer):**
- Drawer que combina: notificaciones + mensajes + actividades
- Tabs: "Hoy" / "Todas"
- Agrupado por fecha/hora

**Sonidos:**
- Beep al recibir mensaje
- Campana al recibir notificación

**Confeti:** cumpleaños propio dispara confeti al tocar la notificación

### 17.5 Recordatorios Personales

**Colección:** `empresas/{id}/recordatorios/{id}`

```
{
  creador_id, titulo, descripcion,
  fecha_hora: Timestamp,
  estado: 'activo' | 'cancelado' | 'completado',
  notificado: boolean,
  repetir: 'nunca' | 'diario' | 'semanal' | 'mensual',
  todo_el_dia: boolean
}
```

**Flujo:** Cron cada 5 min busca recordatorios vencidos → crea notificación + push → si es repetitivo, calcula próxima fecha y resetea.

### 17.6 Auto-limpieza

**Cron `limpiarNotificaciones` (5AM ARG):**
- Expiradas (expiraEn ≤ ahora)
- Descartadas > 30 días
- Cualquiera > 90 días

---

## 18. SISTEMA DE PERMISOS DETALLADO (RBAC)

### 18.1 Módulos del sistema (35 total)

**Módulos principales (22):**

| ID | Etiqueta | Acciones |
|----|----------|----------|
| `contactos` | Contactos | `ver_propio`, `ver_todos`, `crear`, `editar`, `eliminar` |
| `visitas` | Visitas | `ver_propio`, `ver_todos`, `crear`, `editar`, `eliminar`, `completar` |
| `actividades` | Actividades | `ver_propio`, `ver_todos`, `crear`, `editar`, `eliminar` |
| `calendario` | Calendario | `ver`, `crear`, `editar`, `eliminar` |
| `presupuestos` | Presupuestos | `ver_propio`, `ver_todos`, `crear`, `editar`, `eliminar`, `enviar` |
| `facturas` | Facturas | `ver_propio`, `ver_todos`, `crear`, `editar`, `eliminar`, `enviar` |
| `informes` | Informes | `ver_propio`, `ver_todos`, `crear`, `editar`, `eliminar`, `enviar` |
| `inbox_whatsapp` | WhatsApp | `ver_propio`, `ver_todos`, `enviar` |
| `inbox_correo` | Correo | `ver_propio`, `ver_todos`, `enviar` |
| `inbox_interno` | Mensajes Internos | `ver_propio`, `ver_todos`, `enviar` |
| `usuarios` | Usuarios | `ver`, `invitar`, `aprobar`, `editar`, `eliminar` |
| `empresa` | Empresa | `ver`, `editar` |
| `configuracion` | Configuración | `ver`, `editar` |
| `auditoria` | Auditoría | `ver` |
| `asistencias` | Asistencias | `ver_propio`, `marcar`, `ver_todos`, `editar`, `eliminar` |
| `productos` | Productos | `ver`, `crear`, `editar`, `eliminar` |
| `recorrido` | Modo Visitador | `ver_recorrido`, `autoasignar`, `coordinar` |
| `ordenes_trabajo` | Órdenes de Trabajo | `ver_propio`, `ver_todos`, `crear`, `editar`, `eliminar`, `completar_etapa` |

**Módulos de configuración (15):**
- `config_empresa`, `config_contactos`, `config_visitas`, `config_actividades`, `config_calendario`, `config_presupuestos`, `config_facturas`, `config_informes`, `config_ordenes_trabajo`, `config_usuarios`, `config_asistencias`, `config_productos`, `config_correo`, `config_whatsapp`, `config_interno`
- Cada uno con acciones: `ver`, `editar`

### 18.2 Diccionario de acciones

| Acción | Significado |
|--------|------------|
| `ver_propio` | Solo registros asignados a este usuario |
| `ver_todos` | Todos los registros del equipo |
| `ver` | Acceso general de lectura (sin distinción propio/todos) |
| `crear` | Crear nuevos registros |
| `editar` | Modificar registros existentes |
| `eliminar` | Eliminar registros |
| `enviar` | Enviar mensajes o documentos |
| `invitar` | Invitar nuevos usuarios |
| `aprobar` | Aprobar solicitudes de acceso |
| `marcar` | Registrar entrada/salida de asistencia |
| `completar` | Marcar como completado |
| `completar_etapa` | Avanzar etapas de trabajo |
| `autoasignar` | Asignarse visitas del recorrido |
| `coordinar` | Gestionar recorridos del equipo |
| `ver_recorrido` | Acceso al modo visitador |

### 18.3 Matriz de permisos por rol

**Propietario — Acceso TOTAL sin restricciones:**
- Todos los módulos, todas las acciones
- Único que puede editar permisos de otros usuarios
- Único que puede invitar y eliminar usuarios

**Administrador — Casi total:**
- Igual al propietario EXCEPTO:
  - Usuarios: solo `ver`, `aprobar` (NO invitar, NO editar, NO eliminar)
  - Configuración: solo `ver` (NO editar)
  - Órdenes: sin `completar_etapa`

**Colaborador/Empleado — Acceso limitado:**
```
contactos:      ver_propio (solo asignados a él)
visitas:        ver_propio, completar
actividades:    ver_propio, crear
calendario:     ver, crear, editar, eliminar
asistencias:    ver_propio, marcar
inbox_interno:  ver_propio, enviar
-- Sin acceso: usuarios, empresa, configuracion, auditoria,
--             productos, presupuestos, facturas, informes,
--             inbox_whatsapp, inbox_correo, recorrido, ordenes_trabajo
```

### 18.4 Cómo funciona "ver_propio" vs "ver_todos"

1. Hook `useRol()` retorna `tienePermiso(modulo, accion)`
2. La página verifica: `tienePermiso('contactos', 'ver_todos')`
3. Si NO tiene `ver_todos` → agrega filtro al query: `{ responsableId: usuario.uid }`
4. El servicio filtra: `WHERE responsableIds CONTAINS usuario.uid`
5. Solo ve los registros donde él está en `responsableIds[]`

**Campos usados para "propio":**
- Contactos: `responsableIds[]`
- Visitas: `asignadoId`
- Actividades: `asignadoId`
- Documentos: `creadorId` o `asignadoA[]`
- Asistencias: `usuarioId`
- Conversaciones: `participantes[]`

### 18.5 Permisos personalizables

- El **propietario** puede editar los permisos de cada usuario individualmente
- Se guardan en `empresas/{id}/usuarios/{uid}.permisos` como `{ modulo: [acciones] }`
- Si no hay permisos custom → se usan los defaults del rol
- Cada cambio se audita en `permisosAuditoria: { modulo: { editadoPor, editadoEn } }`

### 18.6 Permisos especiales

**Superadmin** (claim JWT `esSuperadmin: true`):
- Solo para panel de administración global (listar todas las empresas)
- NO tiene acceso a datos de negocio de las empresas

**Kiosco** (UID `kiosco_{empresaId}_{terminalId}`, claim `esKiosco: true`):
- Puede crear/leer/editar asistencias
- No puede acceder a nada más

### 18.7 API del hook `useRol()`

```typescript
const {
  rol,                  // 'propietario' | 'administrador' | 'colaborador' | 'empleado'
  tienePermiso,         // (modulo, accion) => boolean
  tienePermisoConfig,   // (configId, accion) => boolean — atajo para config_*
  permisosEfectivos,    // { modulo: [acciones] }
  esPropietario,        // boolean
  esAdmin,              // boolean (propietario || administrador)
  esColaborador,        // boolean
  etiqueta,             // "Propietario" | "Administrador" | etc.
} = useRol()
```

---

## 19. VÍNCULOS ENTRE CONTACTOS

### 19.1 Tipos de contacto

| Tipo | Icono | Descripción |
|------|-------|-------------|
| `empresa` | business | Empresa/organización |
| `persona` | person | Persona individual |
| `edificio` | apartment | Edificio/inmueble/propiedad |
| `proveedor` | local_shipping | Proveedor de servicios/productos |
| `lead` | person_add | Prospecto/lead sin calificar |
| `equipo` | badge | Miembro de equipo |

### 19.2 Sistema de vínculos bidireccional

Cada contacto tiene un campo `vinculados[]` con la estructura:

```
{
  id: string,                    // ID del contacto vinculado
  nombre: string,
  apellido: string | null,
  tipo: 'empresa' | 'persona' | 'edificio' | 'proveedor' | 'lead' | 'equipo',
  puesto: string | null,         // Rol contextual: "Administrador", "Inquilino", "Técnico"
  correo: string | null,         // Copia para acceso rápido
  telefono: string | null,       // Copia
  cargo: string | null,
  recibe_documentos: boolean,    // Recibe docs por email cuando se envían al contacto principal
  empresa_padre: { id, nombre } | null
}
```

### 19.3 Puestos/roles sugeridos

```
Administrador, Consejo, Propietario, Inquilino, Encargado, Técnico,
Empleado, Gerente, Director, Proveedor, Mantenimiento, Socio, Otro
```
El usuario puede elegir de la lista O escribir texto libre.

### 19.4 Operaciones

| Operación | Bidireccional | Descripción |
|-----------|:------------:|-------------|
| `vincularContacto()` | NO (solo en el base) | Agrega al array `vinculados[]` del contacto base. Si es persona con empresa padre, auto-vincula también la empresa |
| `desvincularContacto()` | SÍ | Elimina de `vinculados[]` en AMBOS documentos |
| `cambiarPuestoVinculado()` | NO (solo en el base) | Actualiza el puesto/rol contextual |
| `toggleRecibeDocumentos()` | SÍ | Marca/desmarca si recibe documentos en ambos |

### 19.5 UI de relaciones

**Tab "Relaciones"** en el detalle de cada contacto:
- Sección "Contactos vinculados" — los que este contacto vinculó (editables)
- Sección "Vinculado en" — contactos donde este aparece (solo lectura)
- Botón "Vincular contacto" → modal de búsqueda con filtros por tipo
- Tarjeta de vinculado: avatar + nombre + badges (tipo, puesto, empresa) + teléfono/email + botón X
- Modal crear/editar: nombre, email, teléfono, puesto, detección de duplicados

### 19.6 Sincronización con conversaciones

Cuando un contacto cambia nombre, apellido o vínculos → se actualiza automáticamente en todas sus conversaciones:
- `contactoNombre` → nombre completo
- `contactoEmpresa` → empresa padre o primera vinculada tipo empresa/edificio
- `contactoCargo` → cargo o puesto en la empresa

### 19.7 Destinatarios de documentos

Los vinculados con `recibeDocumentos: true` y correo válido se agregan automáticamente como destinatarios al enviar presupuestos/facturas por email.

---

## 20. PLANTILLAS DE CORREO

### 20.1 Estructura

**Colección:** `empresas/{id}/plantillasCorreo/{id}`

```
{
  nombre: string,
  asunto: string,                      // Con variables: "Presupuesto {{documento.numero}}"
  contenido: string,                   // HTML rico (Tiptap) con variables
  tipo_documento: null | 'presupuesto' | 'factura' | 'orden_trabajo' | 'recibo' | 'nota_credito' | 'nota_debito' | 'remito' | 'informe',
  es_por_defecto: boolean,             // Se usa automáticamente al enviar este tipo
  sector: string | null,               // Filtro por sector de la empresa
  sectores_disponibles: string[],      // Multi-sector
  es_global: boolean,                  // Visible para todos
  creado_por: uid | null,              // Si null = global
  usuarios_asignados: uid[],           // Visibilidad por usuario
  usa_handlebars: boolean,             // Modo avanzado con #each, #if, helpers
  plantilla_wa_vinculada_id: string | null,  // Vinculación bidireccional con plantilla WA
}
```

### 20.2 Variables disponibles (100+)

**Sintaxis simple:** `{{grupo.campo}}` — ej: `{{contacto.nombre}}`, `{{documento.montoTotal}}`

**Sintaxis Handlebars (avanzada):** `{{#each documento.articulos}}`, `{{#if contacto.correo}}`, helpers personalizados

**Grupos de variables:**

| Grupo | Variables principales |
|-------|---------------------|
| `contacto` | nombre, apellido, correo, telefono, empresa, direccion, calle, localidad, provincia, codigoPostal, cuit, condicionIVA, tipo, cargo, rubro, codigo |
| `documento` | numero, tipo, referencia, estado, moneda, fecha, fechaVencimiento, condicionesPago, subtotal, totalImpuestos, descuento, montoTotal, cantidadArticulos, **articulos** (tabla HTML) |
| `usuario` | nombre, correo, correoEmpresa, cargo, whatsapp, sector |
| `empresa` | nombre, correoContacto, telefono, direccion, logo |
| `visita` | codigo, estado, fechaProgramada, motivo, tecnico, contacto |
| `actividad` | titulo, tipo, prioridad, estado, fechaVencimiento, asignado |
| `producto` | nombre, codigo, precio, stock, categoria |
| `sistema` | fecha, hora, timestamp |

**Formateadores automáticos por tipo:**
- `fecha` → formato argentino (09/03/2026)
- `moneda` → con símbolo y locale ($150.000,00)
- `numero` → locale argentino
- `booleano` → "Sí" / "No"
- `html` → tabla de artículos para correo

**Helpers Handlebars:**
- `{{formatMoneda valor moneda="ARS"}}`
- `{{formatFecha valor}}`
- `{{formatNumero valor}}`
- `{{tablaArticulos lineas moneda="ARS"}}`

### 20.3 Visibilidad

- **Admins:** ven todas las plantillas
- **No-admins:** solo las globales + las propias + las asignadas a su usuario + las de su sector

### 20.4 Nota para v2

**IMPORTANTE:** Usar `react-email` o `@react-email/components` para que los correos se vean profesionales en todos los clientes (Gmail, Outlook, Apple Mail). Los correos actuales son HTML suelto que a veces se rompe en Outlook.

---

## 21. PLANTILLAS DE WHATSAPP

### 21.1 Estructura

**Colección:** `empresas/{id}/plantillasWhatsApp/{id}`

```
{
  nombre: string,
  nombre_api: string,                  // Nombre en Meta (sin espacios, snake_case)
  categoria: 'MARKETING' | 'OTP' | 'UTILITY' | 'AUTHENTICATION',
  idioma: 'es' | 'es_AR' | etc,
  componentes: {
    encabezado: { tipo: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT', texto, ejemplo },
    cuerpo: { texto: string, mapeo_variables: string[], ejemplos: string[] },
    pie_pagina: { texto: string },
    botones: [...]
  },
  estado_meta: 'BORRADOR' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ERROR',
  id_template_meta: string | null,     // ID en Meta tras sincronizar
  error_meta: string | null,
  tipo_documento: string | null,
  es_por_defecto: boolean,
  plantilla_correo_vinculada_id: string | null  // Vinculación bidireccional con plantilla correo
}
```

### 21.2 Diferencias con plantillas de correo

- **Requieren aprobación de Meta** (24-48h)
- **Variables posicionales:** `{{1}}`, `{{2}}`, `{{3}}` (no nombradas)
- **Componentes estructurados:** encabezado + cuerpo + pie + botones (no HTML libre)
- **Sincronización:** Cloud Function `gestionarPlantillaWhatsApp` envía a Meta API y recibe estado

### 21.3 Vinculación bidireccional correo ↔ WhatsApp

Una plantilla de correo puede vincularse a una de WhatsApp y viceversa, para que una automatización envíe por ambos canales usando plantillas coherentes.

---

## 22. AUTOMATIZACIONES DE ENVÍO

### 22.1 Estructura de una regla

**Colección:** `empresas/{id}/automatizacionesEnvio/{id}`

```
{
  nombre: string,
  activo: boolean,

  // DISPARADOR
  tipo_entidad: 'documento' | 'actividad' | 'ejecucion',
  tipo_documento: 'todos' | 'presupuesto' | 'factura' | etc,
  estado_origen: 'cualquiera' | 'borrador' | 'enviado' | etc,
  estado_destino: string,              // Estado al que cambia (REQUERIDO)

  // ACCIÓN
  tipo_accion: 'enviar_mensaje' | 'cambiar_estado',
  programacion: 'inmediato' | '30min' | '1h' | '2h' | '4h' | 'manana_9',

  // Si tipo_accion = 'enviar_mensaje':
  canal: 'correo' | 'whatsapp' | 'ambos',
  id_plantilla: string | null,        // Referencia a plantillasCorreo
  destinatario: 'contacto' | 'usuariosAsignados' | 'emailsEspecificos' | 'contactosSeleccionados',
  emails_especificos: string[],
  contactos_seleccionados: id[],
  incluir_pdf: boolean,
  incluir_portal: boolean,

  // Si tipo_accion = 'cambiar_estado':
  entidad_destino: 'actividades' | null,
  nuevo_estado_entidad: 'completada' | null,
}
```

### 22.2 Disparadores

Ejemplos:
- Presupuesto pasa de `borrador` → `enviado` → enviar email al cliente
- Factura pasa a `pagado` → completar actividades vinculadas
- Actividad pasa a `completada` → enviar WhatsApp de agradecimiento

### 22.3 Programación

| Valor | Ejecución |
|-------|----------|
| `inmediato` | Al instante |
| `30min`, `1h`, `2h`, `4h` | Diferido (Cloud Function scheduler) |
| `manana_9` | Día siguiente a las 9AM (hora empresa) |

### 22.4 Prevención de loops

1. No ejecuta si `editadoPor === 'automatizacion'` (evita cascada)
2. No ejecuta si `editadoPor === 'portal'` (portal maneja sus propias notifs)
3. Deduplicación por timestamp: no ejecuta si pasaron < 5 segundos desde la última

### 22.5 Flujo completo

```
1. Usuario cambia estado de documento (borrador → enviado)
2. Cloud Function trigger detecta el cambio
3. Busca reglas activas que coincidan (entidad + tipo + estadoOrigen → estadoDestino)
4. Para cada regla:
   a. Si programación diferida → agenda para después
   b. Si inmediato:
      - Carga plantilla
      - Resuelve variables contra contexto (documento, contacto, empresa, usuario)
      - Determina destinatarios
      - Envía por correo y/o WhatsApp
      - Registra en chatter como autorId='automatizacion'
      - Notifica con toast al usuario
```

---

## 23. CHATTER (Timeline de entidades)

El **Chatter** es un panel estilo Odoo presente en cada entidad (contacto, visita, actividad, documento, orden de trabajo).

**Subcolección:** `{coleccion}/{id}/chatter/{entradaId}`

**Tipos de entrada:**
- `nota` — Nota interna del equipo
- `cambio_estado` — Cambio automático de estado
- `envio` — Documento/mensaje enviado
- `correo` — Correo capturado (con asunto, cuerpoHTML, cc, bcc)
- `actividad` — Actividad vinculada
- `sistema` — Evento automático

**Funcionalidad:**
- Timeline cronológica inversa
- Filtros por tipo y usuario
- Notas ancladas (pin)
- Adjuntos
- Mención de usuarios
- Integración con envío de correos (composer full-screen)

---

## 24. NOTA IMPORTANTE PARA EL NUEVO CHAT

> **Este proyecto tiene un chat anterior (conversación de Claude Code) con contexto extenso.**
> Si necesitás más información sobre cualquier módulo, flujo o decisión de diseño,
> **preguntale al usuario** — él puede consultar en ese chat y darte la respuesta.
>
> El usuario conoce a fondo todo el sistema y puede responder preguntas como:
> - ¿Por qué se eligió tal enfoque en vez de otro?
> - ¿Cómo funciona internamente tal flujo?
> - ¿Qué problemas tuvo la v1 que hay que evitar en la v2?
> - ¿Cuáles son las reglas de negocio exactas de tal módulo?
>
> **No asumas** — si algo no está claro en este documento, preguntá.

---

## FIN DEL DOCUMENTO

> Este documento contiene TODA la funcionalidad de SalixCRM v1 para reconstruirlo desde cero.
> Stack recomendado: **Next.js + TypeScript + Supabase (PostgreSQL + Auth + Realtime + Storage) + Tailwind + Drizzle ORM + Framer Motion + react-email + FCM**
>
> Secciones cubiertas: Auth, multi-tenant, contactos con vínculos, actividades, visitas, documentos, productos, inbox (WhatsApp + correo + interno), agente IA, asistente IA, asistencias con fichaje automático, calendario, órdenes de trabajo, auditoría, dashboard, usuarios, empresa, notificaciones (3 capas), permisos (RBAC detallado), plantillas de correo y WhatsApp, automatizaciones, chatter, recordatorios, presencia, feriados, PWA, cron jobs, búsqueda full-text, métricas.
