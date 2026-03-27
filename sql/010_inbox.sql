-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 010: MÓDULO INBOX — Mensajería omnicanal
-- WhatsApp, Email (IMAP/OAuth), Interno (canales + DMs + hilos)
-- ═══════════════════════════════════════════════════════════════

-- 1. Módulos activos por empresa (flags premium)
CREATE TABLE IF NOT EXISTS modulos_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  modulo text NOT NULL, -- 'inbox_whatsapp', 'inbox_correo', 'inbox_interno', etc.
  activo boolean NOT NULL DEFAULT true,
  activado_en timestamptz DEFAULT now(),
  desactivado_en timestamptz,
  config jsonb NOT NULL DEFAULT '{}', -- config específica del módulo
  UNIQUE (empresa_id, modulo)
);
CREATE INDEX idx_modulos_empresa ON modulos_empresa(empresa_id);

ALTER TABLE modulos_empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY modulos_empresa_rls ON modulos_empresa
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 2. Canales de inbox — cada conexión configurada (N WhatsApp, N email, etc.)
CREATE TABLE IF NOT EXISTS canales_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'whatsapp', 'correo', 'interno'
  nombre text NOT NULL, -- "WhatsApp Ventas", "info@empresa.com"
  proveedor text, -- 'meta_api', 'twilio', 'imap', 'gmail_oauth'
  activo boolean NOT NULL DEFAULT true,

  -- Configuración de conexión (encriptada en app-level)
  config_conexion jsonb NOT NULL DEFAULT '{}',
  -- IMAP: { host, puerto, usuario, password_cifrada, ssl }
  -- Gmail OAuth: { refresh_token, access_token, email }
  -- WhatsApp Meta: { phone_number_id, access_token, waba_id }
  -- WhatsApp Twilio: { account_sid, auth_token, from_number }

  -- Estado de conexión
  estado_conexion text NOT NULL DEFAULT 'desconectado', -- 'conectado', 'desconectado', 'error', 'reconectando'
  ultimo_error text,
  ultima_sincronizacion timestamptz,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_canales_inbox_empresa ON canales_inbox(empresa_id);
CREATE INDEX idx_canales_inbox_tipo ON canales_inbox(empresa_id, tipo);

ALTER TABLE canales_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY canales_inbox_rls ON canales_inbox
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 3. Agentes asignados a un canal (quién atiende cada canal)
CREATE TABLE IF NOT EXISTS canal_agentes (
  canal_id uuid NOT NULL REFERENCES canales_inbox(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  rol_canal text NOT NULL DEFAULT 'agente', -- 'admin', 'agente'
  asignado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (canal_id, usuario_id)
);
CREATE INDEX idx_canal_agentes_usuario ON canal_agentes(usuario_id);

-- 4. Conversaciones — hilo principal unificado (WhatsApp, email, interno)
CREATE TABLE IF NOT EXISTS conversaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  canal_id uuid NOT NULL REFERENCES canales_inbox(id) ON DELETE CASCADE,
  tipo_canal text NOT NULL, -- 'whatsapp', 'correo', 'interno'

  -- Identificador externo (número WA, email, canal interno)
  identificador_externo text, -- "+5491155551234", "cliente@gmail.com"
  hilo_externo_id text, -- Message-ID de email para threading, wa_id

  -- Contacto vinculado (puede ser null si no se identificó)
  contacto_id uuid REFERENCES contactos(id) ON DELETE SET NULL,
  contacto_nombre text, -- snapshot para mostrar sin JOIN

  -- Estado de la conversación
  estado text NOT NULL DEFAULT 'abierta', -- 'abierta', 'en_espera', 'resuelta', 'spam'
  prioridad text NOT NULL DEFAULT 'normal', -- 'baja', 'normal', 'alta', 'urgente'

  -- Asignación actual
  asignado_a uuid, -- usuario_id del agente
  asignado_a_nombre text, -- snapshot

  -- Correo: asunto del hilo
  asunto text,

  -- Interno: referencia al canal interno
  canal_interno_id uuid, -- FK se agrega después de crear la tabla canales_internos

  -- Último mensaje (desnormalizado para lista rápida)
  ultimo_mensaje_texto text,
  ultimo_mensaje_en timestamptz,
  ultimo_mensaje_es_entrante boolean DEFAULT true,

  -- Contadores
  mensajes_sin_leer integer NOT NULL DEFAULT 0,

  -- SLA
  primera_respuesta_en timestamptz, -- cuándo el agente respondió por primera vez
  tiempo_sin_respuesta_desde timestamptz, -- desde cuándo está esperando respuesta

  -- Etiquetas
  etiquetas text[] DEFAULT '{}',

  -- Preparado para IA
  resumen_ia text, -- resumen generado por IA
  sentimiento text, -- 'positivo', 'neutro', 'negativo'
  idioma_detectado text,

  -- Auditoría
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  cerrado_en timestamptz,
  cerrado_por uuid
);
CREATE INDEX idx_conversaciones_empresa ON conversaciones(empresa_id);
CREATE INDEX idx_conversaciones_canal ON conversaciones(canal_id);
CREATE INDEX idx_conversaciones_estado ON conversaciones(empresa_id, estado);
CREATE INDEX idx_conversaciones_asignado ON conversaciones(empresa_id, asignado_a);
CREATE INDEX idx_conversaciones_contacto ON conversaciones(contacto_id);
CREATE INDEX idx_conversaciones_ultimo_msg ON conversaciones(empresa_id, ultimo_mensaje_en DESC);
CREATE INDEX idx_conversaciones_identificador ON conversaciones(empresa_id, identificador_externo);
CREATE INDEX idx_conversaciones_hilo ON conversaciones(empresa_id, hilo_externo_id);

ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversaciones_rls ON conversaciones
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 5. Mensajes — cada mensaje individual dentro de una conversación
CREATE TABLE IF NOT EXISTS mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  conversacion_id uuid NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,

  -- Dirección
  es_entrante boolean NOT NULL DEFAULT true, -- true = recibido, false = enviado
  remitente_tipo text NOT NULL DEFAULT 'contacto', -- 'contacto', 'agente', 'sistema', 'bot'
  remitente_id uuid, -- usuario_id si es agente
  remitente_nombre text, -- nombre del remitente

  -- Contenido
  tipo_contenido text NOT NULL DEFAULT 'texto', -- 'texto', 'imagen', 'audio', 'video', 'documento', 'sticker', 'ubicacion', 'contacto_compartido', 'email_html'
  texto text, -- texto plano o markdown
  html text, -- para emails con HTML

  -- Correo: campos específicos
  correo_de text,
  correo_para text[], -- destinatarios
  correo_cc text[],
  correo_cco text[],
  correo_asunto text,
  correo_message_id text, -- Message-ID del header
  correo_in_reply_to text, -- In-Reply-To header para threading
  correo_references text[], -- References header

  -- WhatsApp: campos específicos
  wa_message_id text, -- ID del mensaje en WhatsApp
  wa_status text, -- 'sent', 'delivered', 'read', 'failed'
  wa_tipo_mensaje text, -- tipo original de WA

  -- Interno: hilos (respuesta a otro mensaje)
  respuesta_a_id uuid REFERENCES mensajes(id) ON DELETE SET NULL,
  hilo_raiz_id uuid REFERENCES mensajes(id) ON DELETE SET NULL, -- primer mensaje del hilo
  cantidad_respuestas integer NOT NULL DEFAULT 0, -- desnormalizado para mostrar "N respuestas"

  -- Reacciones (solo interno)
  reacciones jsonb DEFAULT '{}', -- { "👍": ["user_id1"], "❤️": ["user_id2"] }

  -- Metadata del mensaje externo
  metadata jsonb DEFAULT '{}', -- datos crudos del proveedor

  -- Estado
  estado text NOT NULL DEFAULT 'enviado', -- 'enviado', 'entregado', 'leido', 'fallido', 'eliminado'
  error_envio text, -- si falló

  -- Plantilla usada (referencia)
  plantilla_id uuid,

  -- Auditoría
  creado_en timestamptz NOT NULL DEFAULT now(),
  editado_en timestamptz,
  eliminado_en timestamptz
);
CREATE INDEX idx_mensajes_conversacion ON mensajes(conversacion_id, creado_en);
CREATE INDEX idx_mensajes_empresa ON mensajes(empresa_id);
CREATE INDEX idx_mensajes_hilo ON mensajes(hilo_raiz_id);
CREATE INDEX idx_mensajes_wa ON mensajes(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX idx_mensajes_correo ON mensajes(correo_message_id) WHERE correo_message_id IS NOT NULL;

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mensajes_rls ON mensajes
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 6. Adjuntos de mensajes
CREATE TABLE IF NOT EXISTS mensaje_adjuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensaje_id uuid NOT NULL REFERENCES mensajes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  nombre_archivo text NOT NULL,
  tipo_mime text NOT NULL, -- 'image/jpeg', 'audio/ogg', 'application/pdf'
  tamano_bytes bigint,
  url text NOT NULL, -- URL en Supabase Storage
  storage_path text NOT NULL, -- path en el bucket
  miniatura_url text, -- thumbnail para imágenes/videos

  -- Para audio/video
  duracion_segundos integer,

  -- Para stickers WA
  es_sticker boolean DEFAULT false,
  es_animado boolean DEFAULT false,

  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_adjuntos_mensaje ON mensaje_adjuntos(mensaje_id);
CREATE INDEX idx_adjuntos_empresa ON mensaje_adjuntos(empresa_id);

ALTER TABLE mensaje_adjuntos ENABLE ROW LEVEL SECURITY;
CREATE POLICY mensaje_adjuntos_rls ON mensaje_adjuntos
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 7. Canales internos (estilo Slack)
CREATE TABLE IF NOT EXISTS canales_internos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL, -- "#general", "#ventas"
  descripcion text,
  tipo text NOT NULL DEFAULT 'publico', -- 'publico', 'privado', 'directo'
  icono text, -- emoji o nombre de icono
  color text,

  -- Para DMs: almacena los participantes como array ordenado
  participantes_dm uuid[], -- solo para tipo='directo', 2 user_ids

  -- Estado
  archivado boolean NOT NULL DEFAULT false,

  -- Último mensaje (desnormalizado)
  ultimo_mensaje_texto text,
  ultimo_mensaje_en timestamptz,
  ultimo_mensaje_por text, -- nombre del autor

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_canales_internos_empresa ON canales_internos(empresa_id);
CREATE UNIQUE INDEX idx_canales_internos_nombre ON canales_internos(empresa_id, nombre) WHERE tipo != 'directo';
CREATE INDEX idx_canales_internos_dm ON canales_internos(empresa_id, participantes_dm) WHERE tipo = 'directo';

ALTER TABLE canales_internos ENABLE ROW LEVEL SECURITY;
CREATE POLICY canales_internos_rls ON canales_internos
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- Agregar FK de conversaciones a canales_internos
ALTER TABLE conversaciones
  ADD CONSTRAINT fk_conversaciones_canal_interno
  FOREIGN KEY (canal_interno_id) REFERENCES canales_internos(id) ON DELETE SET NULL;

-- 8. Miembros de canal interno
CREATE TABLE IF NOT EXISTS canal_interno_miembros (
  canal_id uuid NOT NULL REFERENCES canales_internos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  rol text NOT NULL DEFAULT 'miembro', -- 'admin', 'miembro'
  silenciado boolean NOT NULL DEFAULT false,
  ultimo_leido_en timestamptz, -- para calcular no leídos
  unido_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (canal_id, usuario_id)
);
CREATE INDEX idx_canal_interno_miembros_usuario ON canal_interno_miembros(usuario_id);

-- 9. Plantillas de respuesta rápida
CREATE TABLE IF NOT EXISTS plantillas_respuesta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  nombre text NOT NULL, -- "Saludo inicial", "Confirmación de pedido"
  categoria text, -- agrupación libre
  canal text NOT NULL, -- 'whatsapp', 'correo', 'todos'

  -- Contenido
  asunto text, -- solo para correo
  contenido text NOT NULL, -- con variables {{nombre}}, {{empresa}}, etc.
  contenido_html text, -- versión HTML para correo

  -- Variables disponibles
  variables jsonb DEFAULT '[]', -- [{"clave": "nombre", "etiqueta": "Nombre del contacto", "origen": "contacto.nombre"}]

  -- Dónde se puede usar esta plantilla
  modulos text[] DEFAULT '{}', -- ['inbox', 'presupuestos', 'facturacion'] — vacío = solo inbox

  -- Permisos: quién puede usar esta plantilla
  disponible_para text NOT NULL DEFAULT 'todos', -- 'todos', 'roles', 'usuarios'
  roles_permitidos text[] DEFAULT '{}', -- ['admin', 'gestor', 'vendedor']
  usuarios_permitidos uuid[] DEFAULT '{}',

  -- Estado
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plantillas_empresa ON plantillas_respuesta(empresa_id);
CREATE INDEX idx_plantillas_canal ON plantillas_respuesta(empresa_id, canal);

ALTER TABLE plantillas_respuesta ENABLE ROW LEVEL SECURITY;
CREATE POLICY plantillas_respuesta_rls ON plantillas_respuesta
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 10. Historial de asignaciones (quién atendió cada conversación)
CREATE TABLE IF NOT EXISTS asignaciones_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  conversacion_id uuid NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  usuario_nombre text,
  tipo text NOT NULL DEFAULT 'manual', -- 'manual', 'automatica', 'transferencia'
  asignado_por uuid, -- null si automática
  asignado_por_nombre text,
  notas text, -- motivo de transferencia
  asignado_en timestamptz NOT NULL DEFAULT now(),
  desasignado_en timestamptz
);
CREATE INDEX idx_asignaciones_conversacion ON asignaciones_inbox(conversacion_id);
CREATE INDEX idx_asignaciones_usuario ON asignaciones_inbox(empresa_id, usuario_id);

ALTER TABLE asignaciones_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY asignaciones_inbox_rls ON asignaciones_inbox
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 11. Configuración del inbox por empresa
CREATE TABLE IF NOT EXISTS config_inbox (
  empresa_id uuid PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,

  -- Asignación automática
  asignacion_automatica boolean NOT NULL DEFAULT false,
  algoritmo_asignacion text NOT NULL DEFAULT 'round_robin', -- 'round_robin', 'por_carga', 'manual'

  -- SLA
  sla_primera_respuesta_minutos integer DEFAULT 60, -- tiempo objetivo para primera respuesta
  sla_resolucion_horas integer DEFAULT 24,

  -- Horario de atención
  horario_atencion jsonb DEFAULT '{"lunes":{"inicio":"09:00","fin":"18:00"},"martes":{"inicio":"09:00","fin":"18:00"},"miercoles":{"inicio":"09:00","fin":"18:00"},"jueves":{"inicio":"09:00","fin":"18:00"},"viernes":{"inicio":"09:00","fin":"18:00"}}',
  zona_horaria text DEFAULT 'America/Argentina/Buenos_Aires',

  -- Respuesta automática fuera de horario
  respuesta_fuera_horario boolean NOT NULL DEFAULT false,
  mensaje_fuera_horario text,

  -- Notificaciones
  notificar_nuevo_mensaje boolean NOT NULL DEFAULT true,
  notificar_asignacion boolean NOT NULL DEFAULT true,
  notificar_sla_vencido boolean NOT NULL DEFAULT true,
  sonido_notificacion boolean NOT NULL DEFAULT true,

  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE config_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY config_inbox_rls ON config_inbox
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 12. Suscripciones push (para PWA en iOS/Android)
CREATE TABLE IF NOT EXISTS suscripciones_push (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  endpoint text NOT NULL, -- URL del push service
  p256dh text NOT NULL, -- clave pública
  auth text NOT NULL, -- secret de auth
  user_agent text, -- dispositivo
  activa boolean NOT NULL DEFAULT true,
  creada_en timestamptz NOT NULL DEFAULT now(),
  ultima_notificacion_en timestamptz,
  UNIQUE (usuario_id, endpoint)
);
CREATE INDEX idx_suscripciones_push_usuario ON suscripciones_push(usuario_id, empresa_id);

ALTER TABLE suscripciones_push ENABLE ROW LEVEL SECURITY;
CREATE POLICY suscripciones_push_rls ON suscripciones_push
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 13. Notificaciones en app
CREATE TABLE IF NOT EXISTS notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  tipo text NOT NULL, -- 'nuevo_mensaje', 'asignacion', 'mencion', 'sla_vencido', 'actividad'
  titulo text NOT NULL,
  cuerpo text,
  icono text, -- nombre de icono lucide
  color text, -- color semántico
  url text, -- ruta para navegar al abrir
  leida boolean NOT NULL DEFAULT false,
  -- Referencia al objeto relacionado
  referencia_tipo text, -- 'conversacion', 'mensaje', 'contacto', 'actividad'
  referencia_id uuid,
  creada_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, empresa_id, leida, creada_en DESC);
CREATE INDEX idx_notificaciones_empresa ON notificaciones(empresa_id);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY notificaciones_rls ON notificaciones
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);
