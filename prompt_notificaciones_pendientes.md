# Notificaciones — Trabajo pendiente

## Contexto
El sistema de notificaciones de Flux ya tiene toda la infraestructura construida:
- **3 íconos en el header** (MessagesSquare → Inbox, Zap → Actividades, Bell → Sistema) con Popovers
- **Componentes genéricos**: `Popover`, `PanelNotificaciones`, `SelectorRecurrencia`
- **Hook `useNotificaciones`** con Supabase Realtime (escucha INSERT/UPDATE/DELETE en tabla `notificaciones`)
- **Hook `useSonido`** con sonido `notificacion()` que suena al llegar una nueva
- **Modo concentración** (silenciar por ciclo: 30min → 1h → 4h → mañana) en el menú Flux
- **Recordatorios** (mini-app con crear/activos/completados, recurrencia avanzada, alerta modal)
- **API completa**: GET/PATCH/DELETE en `/api/inbox/notificaciones` y CRUD en `/api/recordatorios`
- **Tabla `notificaciones`** en Supabase con RLS por empresa_id + usuario_id
- **Tabla `recordatorios`** en Supabase con RLS
- **Configuración por usuario** en Mi Cuenta > Notificaciones (sonidos por categoría)

## Lo que falta

### 1. TRIGGERS — Crear notificaciones cuando pasan cosas

Cada módulo debe insertar en la tabla `notificaciones` cuando ocurre un evento. La tabla tiene esta estructura:

```sql
notificaciones (
  id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL,
  usuario_id uuid NOT NULL,        -- a quién va dirigida
  tipo text NOT NULL,               -- ver tipos abajo
  titulo text NOT NULL,
  cuerpo text,
  icono text,                       -- nombre de ícono lucide (opcional)
  color text,                       -- color semántico (opcional)
  url text,                         -- ruta para navegar al hacer click
  leida boolean DEFAULT false,
  referencia_tipo text,             -- 'conversacion', 'actividad', 'presupuesto', etc.
  referencia_id uuid,               -- ID del objeto relacionado
  creada_en timestamptz DEFAULT now()
)
```

**Anti-duplicación**: antes de insertar, verificar si ya existe una notificación no leída con el mismo `referencia_tipo + referencia_id`. Si existe, actualizar `creada_en` y `titulo/cuerpo` en vez de crear otra.

#### 1.1 Inbox (correos, WhatsApp, internos)
- **Tipos**: `mensaje_whatsapp`, `mensaje_correo`, `mensaje_interno`, `mencion`
- **Cuándo**: al recibir un mensaje nuevo en una conversación
- **A quién**: al usuario asignado a la conversación. Si no hay asignado, al admin
- **URL**: `/inbox` (idealmente `/inbox?conversacion=ID`)
- **Referencia**: `referencia_tipo: 'conversacion'`, `referencia_id: ID de la conversación`
- **Dónde insertar**: en la API/webhook que recibe mensajes nuevos
  - WhatsApp: `/api/inbox/whatsapp/webhook` o donde se procese el mensaje entrante
  - Correo: `/api/inbox/correo/sincronizar` o el endpoint de sync
  - Interno: al crear un mensaje en un canal interno

#### 1.2 Actividades
- **Tipos**: `actividad_asignada`, `actividad_pronto_vence`, `actividad_vencida`
- **`actividad_asignada`**: cuando alguien asigna una actividad a otro usuario
  - Insertar en: POST `/api/actividades` y PATCH `/api/actividades/[id]` cuando cambia `asignado_a`
  - A quién: al usuario asignado (no al que la creó)
  - URL: `/actividades`
- **`actividad_pronto_vence`**: cuando faltan 24h o 1h para el vencimiento
  - Insertar vía: cron job que revisa actividades con `fecha_vencimiento` próxima
  - A quién: al usuario asignado
- **`actividad_vencida`**: cuando la fecha de vencimiento ya pasó
  - Insertar vía: mismo cron job
  - A quién: al usuario asignado

#### 1.3 Portal (presupuestos y documentos)
- **Tipos**: `portal_vista`, `portal_aceptado`, `portal_rechazado`, `portal_cancelado`
- **`portal_vista`**: cuando el cliente abre el link del portal
  - Insertar en: la página del portal cuando se registra la visita
  - A quién: al usuario que creó/envió el presupuesto
  - URL: `/presupuestos` o `/presupuestos/ID`
  - Referencia: `referencia_tipo: 'presupuesto'`, `referencia_id: ID`
- **`portal_aceptado/rechazado/cancelado`**: cuando el cliente toma acción en el portal
  - Insertar en: la API del portal que procesa la acción del cliente

#### 1.4 Sistema
- **Tipos**: `cumpleanios_colega`, `cumpleanios_propio`, `anuncio`, `actualizacion`
- Cumpleaños: cron diario a las 9:00 que revisa `perfiles.fecha_nacimiento`
- Anuncios: manual desde admin

### 2. TOAST EN TIEMPO REAL — Tarjeta que aparece al llegar notificación

El hook `useNotificaciones` ya recibe notificaciones vía Supabase Realtime y reproduce sonido. Falta mostrar una **tarjeta flotante** (toast) que entre desde arriba a la derecha, debajo del header.

**Qué hacer:**
- En `useNotificaciones.ts`, el callback del INSERT de Realtime ya llama `reproducirSonido(nueva)` y `onNueva?.(nueva)`.
- Crear un componente `ToastNotificacion` que se renderice en el layout principal y escuche `onNueva`.
- Cuando llega una notificación nueva (y no está silenciada por modo concentración):
  1. Suena el ding (ya funciona)
  2. Aparece una tarjeta flotante arriba a la derecha, debajo del header, posición `top: calc(var(--header-alto) + 12px)`, `right: 24px`
  3. La tarjeta muestra: ícono + tipo + título + descripción + timestamp + botones (Descartar | Ver)
  4. Se auto-descarta en 8 segundos
  5. Click en "Ver" → navega a la URL de la notificación
  6. Máximo 3 toasts visibles a la vez, los nuevos empujan a los viejos

**Referencia visual**: ya existe un preview en `RecordatoriosHeader.tsx` (buscar `previewToast`) que tiene el diseño exacto.

### 3. PUSH NOTIFICATIONS (PWA)

Para que suene en iPhone/Android cuando la app está en segundo plano.

**Arquitectura:**
1. **Registro**: el service worker registra la suscripción Push con la Web Push API
2. **Almacenamiento**: guardar el endpoint + keys en la tabla `suscripciones_push` (ya existe en BD)
3. **Envío**: edge function en Supabase que se ejecuta al insertar en `notificaciones` → envía push a todas las suscripciones del usuario
4. **Respeta modo concentración**: verificar si el usuario tiene modo concentración activo antes de enviar

**Tabla existente:**
```sql
suscripciones_push (
  id uuid PRIMARY KEY,
  empresa_id uuid,
  usuario_id uuid,
  endpoint text,
  keys jsonb,        -- { p256dh, auth }
  creada_en timestamptz
)
```

**Pasos:**
1. En `SeccionNotificaciones.tsx` (Mi Cuenta), cuando el usuario activa push, registrar el SW y guardar la suscripción
2. Crear edge function `enviar-push` que reciba { usuario_id, titulo, cuerpo, url } y envíe via Web Push
3. Crear un trigger o database webhook en Supabase que al INSERT en `notificaciones` llame a la edge function

### 4. CRON JOBS

Crear en `/api/cron/` (o Supabase edge functions con cron):

- **`recordatorios`** (cada 5 min): busca recordatorios con `fecha <= hoy` y `hora <= ahora` que no estén completados → crea notificación + si tiene `alerta_modal = true`, marca para abrir modal
- **`actividades-vencimiento`** (cada 1h): busca actividades próximas a vencer o vencidas → crea notificación
- **`cumpleanios`** (diario 9:00): busca perfiles con fecha_nacimiento = hoy → crea notificación para todos los miembros de la empresa
- **`cleanup`** (diario 5:00): borra notificaciones leídas >90 días y descartadas >30 días

### 5. ARCHIVOS CLAVE

```
src/
  componentes/
    ui/
      Popover.tsx                    — Panel flotante genérico
      PanelNotificaciones.tsx        — Lista de notificaciones genérica
      SelectorRecurrencia.tsx        — Selector de recurrencia avanzado
    entidad/
      NotificacionesHeader.tsx       — 3 íconos + popovers del header
      RecordatoriosHeader.tsx        — Mini-app de recordatorios
    feedback/
      Toast.tsx                      — Sistema de toasts existente
  hooks/
    useNotificaciones.ts             — Hook con Realtime + sonido + prefs
    useModoConcentracion.ts          — Modo concentración (silenciar)
    useSonido.tsx                    — Sonidos sintetizados (Web Audio)
  app/
    api/
      inbox/notificaciones/route.ts  — API GET/PATCH/DELETE notificaciones
      recordatorios/route.ts         — API CRUD recordatorios
    (flux)/
      mi-cuenta/secciones/SeccionNotificaciones.tsx — Config sonidos + permisos
  db/
    esquema.ts                       — Tablas notificaciones + recordatorios (Drizzle)
```

### 6. MAPEO DE TIPOS → CATEGORÍAS

En `useNotificaciones.ts` está el mapa que asigna cada tipo a una categoría (para los 3 íconos):

```
INBOX: nuevo_mensaje, mencion, sla_vencido, mensaje_whatsapp, mensaje_correo, mensaje_interno
ACTIVIDADES: actividad, asignacion, actividad_asignada, actividad_pronto_vence, actividad_vencida, recordatorio, calendario
SISTEMA: cumpleanios_propio, cumpleanios_colega, anuncio, portal_vista, portal_aceptado, portal_rechazado, portal_cancelado, documento_estado, actualizacion, usuario_pendiente
```

### 7. ORDEN DE PRIORIDAD SUGERIDO

1. **Triggers de inbox** (correos/WhatsApp ya funcionan, es agregar 1 insert)
2. **Triggers de portal** (presupuestos ya funcionan)
3. **Toast en tiempo real** (para que se vea cuando llega)
4. **Triggers de actividades** (ya funcionan)
5. **Cron de recordatorios** (para que realmente alerten)
6. **Push notifications PWA**
7. **Cron de cumpleaños y cleanup**
