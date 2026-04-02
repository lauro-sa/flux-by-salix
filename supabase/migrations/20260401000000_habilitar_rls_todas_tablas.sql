-- =============================================================================
-- Migración: Habilitar RLS en todas las tablas multi-tenant de Flux
-- Fecha: 2026-04-01
-- Descripción: Activa Row Level Security y crea políticas basadas en empresa_id
--              extraído del JWT de Supabase Auth para aislamiento multi-tenant.
--
-- Tablas con empresa_id directo: política USING (empresa_id = jwt->empresa_id)
-- Tablas child sin empresa_id: política con EXISTS + JOIN a tabla padre
-- Tablas globales (empresas, perfiles, campos_fiscales_pais, catalogo_modulos): excluidas
-- Tabla preferencias_usuario: sin empresa_id, scoped por usuario_id via auth.uid()
-- =============================================================================

-- Helper: expresión reutilizable para extraer empresa_id del JWT
-- (auth.jwt() ->> 'empresa_id')::uuid

-- =============================================================================
-- SECCIÓN 1: Tablas con empresa_id directo
-- Política única para SELECT, INSERT, UPDATE, DELETE
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SISTEMA CORE: miembros, invitaciones, vistas_guardadas, permisos, nómina
-- ─────────────────────���────────────────────────────────���──────────────────────

ALTER TABLE miembros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_miembros_empresa" ON miembros;
CREATE POLICY "rls_miembros_empresa" ON miembros
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_invitaciones_empresa" ON invitaciones;
CREATE POLICY "rls_invitaciones_empresa" ON invitaciones
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE vistas_guardadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_vistas_guardadas_empresa" ON vistas_guardadas;
CREATE POLICY "rls_vistas_guardadas_empresa" ON vistas_guardadas
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE permisos_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_permisos_auditoria_empresa" ON permisos_auditoria;
CREATE POLICY "rls_permisos_auditoria_empresa" ON permisos_auditoria
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE pagos_nomina ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_pagos_nomina_empresa" ON pagos_nomina;
CREATE POLICY "rls_pagos_nomina_empresa" ON pagos_nomina
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─────────���──────────────────��────────────────────────────────────────────────
-- SISTEMA DE CONTACTOS
-- ────���──────────────────────��───────────────────────────────���─────────────────

ALTER TABLE tipos_contacto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_tipos_contacto_empresa" ON tipos_contacto;
CREATE POLICY "rls_tipos_contacto_empresa" ON tipos_contacto
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE tipos_relacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_tipos_relacion_empresa" ON tipos_relacion;
CREATE POLICY "rls_tipos_relacion_empresa" ON tipos_relacion
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_contactos_empresa" ON contactos;
CREATE POLICY "rls_contactos_empresa" ON contactos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE contacto_vinculaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_contacto_vinculaciones_empresa" ON contacto_vinculaciones;
CREATE POLICY "rls_contacto_vinculaciones_empresa" ON contacto_vinculaciones
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE rubros_contacto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_rubros_contacto_empresa" ON rubros_contacto;
CREATE POLICY "rls_rubros_contacto_empresa" ON rubros_contacto
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE etiquetas_contacto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_etiquetas_contacto_empresa" ON etiquetas_contacto;
CREATE POLICY "rls_etiquetas_contacto_empresa" ON etiquetas_contacto
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─────���───────────────────────────────────────────────────────────────────────
-- SECUENCIAS
-- ──────────────────────────────────────────────────────���──────────────────────

ALTER TABLE secuencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_secuencias_empresa" ON secuencias;
CREATE POLICY "rls_secuencias_empresa" ON secuencias
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ────���──────────��──────────────────────────────────���──────────────────────────
-- SISTEMA DE PRESUPUESTOS
-- ───��──────────────��─────────────────────────────��────────────────────────────

ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_presupuestos_empresa" ON presupuestos;
CREATE POLICY "rls_presupuestos_empresa" ON presupuestos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE lineas_presupuesto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_lineas_presupuesto_empresa" ON lineas_presupuesto;
CREATE POLICY "rls_lineas_presupuesto_empresa" ON lineas_presupuesto
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE presupuesto_historial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_presupuesto_historial_empresa" ON presupuesto_historial;
CREATE POLICY "rls_presupuesto_historial_empresa" ON presupuesto_historial
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE presupuesto_cuotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_presupuesto_cuotas_empresa" ON presupuesto_cuotas;
CREATE POLICY "rls_presupuesto_cuotas_empresa" ON presupuesto_cuotas
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE config_presupuestos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_config_presupuestos_empresa" ON config_presupuestos;
CREATE POLICY "rls_config_presupuestos_empresa" ON config_presupuestos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ��─────────────────────────────��──────────────────────────────────────────────
-- MÓDULOS Y SUSCRIPCIONES
-- ──────��────────────────────────────────��─────────────────────────────────────

ALTER TABLE modulos_empresa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_modulos_empresa_empresa" ON modulos_empresa;
CREATE POLICY "rls_modulos_empresa_empresa" ON modulos_empresa
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_suscripciones_empresa" ON suscripciones;
CREATE POLICY "rls_suscripciones_empresa" ON suscripciones
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_portal_tokens_empresa" ON portal_tokens;
CREATE POLICY "rls_portal_tokens_empresa" ON portal_tokens
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─��────────────────────────────────────────���──────────────────────────────────
-- CHATTER
-- ───────────────────────────────────────────────────────────���─────────────────

ALTER TABLE chatter ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_chatter_empresa" ON chatter;
CREATE POLICY "rls_chatter_empresa" ON chatter
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ──��──────────────────────────────────────────────────���───────────────────────
-- PRODUCTOS
-- ────��─────────────────���──────────────────────────────────────────────────────

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_productos_empresa" ON productos;
CREATE POLICY "rls_productos_empresa" ON productos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE config_productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_config_productos_empresa" ON config_productos;
CREATE POLICY "rls_config_productos_empresa" ON config_productos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ───────────���────────────────────────────────────��────────────────────────────
-- ACTIVIDADES
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE tipos_actividad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_tipos_actividad_empresa" ON tipos_actividad;
CREATE POLICY "rls_tipos_actividad_empresa" ON tipos_actividad
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE estados_actividad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_estados_actividad_empresa" ON estados_actividad;
CREATE POLICY "rls_estados_actividad_empresa" ON estados_actividad
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE config_actividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_config_actividades_empresa" ON config_actividades;
CREATE POLICY "rls_config_actividades_empresa" ON config_actividades
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_actividades_empresa" ON actividades;
CREATE POLICY "rls_actividades_empresa" ON actividades
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ───��───────────────────────────────────��─────────────────────────��───────────
-- NOTIFICACIONES Y RECORDATORIOS
-- ─────────��────────────────────────────��──────────────────────────────────────

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_notificaciones_empresa" ON notificaciones;
CREATE POLICY "rls_notificaciones_empresa" ON notificaciones
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE recordatorios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_recordatorios_empresa" ON recordatorios;
CREATE POLICY "rls_recordatorios_empresa" ON recordatorios
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE suscripciones_push ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_suscripciones_push_empresa" ON suscripciones_push;
CREATE POLICY "rls_suscripciones_push_empresa" ON suscripciones_push
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ───���────────────────────────────────────────��────────────────────────────────
-- INBOX / MENSAJERÍA (tablas con empresa_id directo)
-- ───────��──────────────────────────────────────────────────��──────────────────

ALTER TABLE canales_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_canales_inbox_empresa" ON canales_inbox;
CREATE POLICY "rls_canales_inbox_empresa" ON canales_inbox
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE canales_internos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_canales_internos_empresa" ON canales_internos;
CREATE POLICY "rls_canales_internos_empresa" ON canales_internos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_conversaciones_empresa" ON conversaciones;
CREATE POLICY "rls_conversaciones_empresa" ON conversaciones
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_mensajes_empresa" ON mensajes;
CREATE POLICY "rls_mensajes_empresa" ON mensajes
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE mensaje_adjuntos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_mensaje_adjuntos_empresa" ON mensaje_adjuntos;
CREATE POLICY "rls_mensaje_adjuntos_empresa" ON mensaje_adjuntos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE asignaciones_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_asignaciones_inbox_empresa" ON asignaciones_inbox;
CREATE POLICY "rls_asignaciones_inbox_empresa" ON asignaciones_inbox
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE etiquetas_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_etiquetas_inbox_empresa" ON etiquetas_inbox;
CREATE POLICY "rls_etiquetas_inbox_empresa" ON etiquetas_inbox
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE config_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_config_inbox_empresa" ON config_inbox;
CREATE POLICY "rls_config_inbox_empresa" ON config_inbox
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE correos_programados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_correos_programados_empresa" ON correos_programados;
CREATE POLICY "rls_correos_programados_empresa" ON correos_programados
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE plantillas_respuesta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_plantillas_respuesta_empresa" ON plantillas_respuesta;
CREATE POLICY "rls_plantillas_respuesta_empresa" ON plantillas_respuesta
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE reglas_correo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_reglas_correo_empresa" ON reglas_correo;
CREATE POLICY "rls_reglas_correo_empresa" ON reglas_correo
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE metricas_correo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_metricas_correo_empresa" ON metricas_correo;
CREATE POLICY "rls_metricas_correo_empresa" ON metricas_correo
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ──────────────────────────────────��──────────────────────────────────────────
-- INTELIGENCIA ARTIFICIAL
-- ─────────────────���────────────────────���──────────────────────────────────────

ALTER TABLE config_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_config_ia_empresa" ON config_ia;
CREATE POLICY "rls_config_ia_empresa" ON config_ia
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE config_agente_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_config_agente_ia_empresa" ON config_agente_ia;
CREATE POLICY "rls_config_agente_ia_empresa" ON config_agente_ia
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE config_chatbot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_config_chatbot_empresa" ON config_chatbot;
CREATE POLICY "rls_config_chatbot_empresa" ON config_chatbot
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE base_conocimiento_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_base_conocimiento_ia_empresa" ON base_conocimiento_ia;
CREATE POLICY "rls_base_conocimiento_ia_empresa" ON base_conocimiento_ia
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE log_agente_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_log_agente_ia_empresa" ON log_agente_ia;
CREATE POLICY "rls_log_agente_ia_empresa" ON log_agente_ia
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ��──────────────────────────���──────────────────────────────��──────────────────
-- RRHH / ESTRUCTURA ORGANIZACIONAL
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_asistencias_empresa" ON asistencias;
CREATE POLICY "rls_asistencias_empresa" ON asistencias
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE sectores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_sectores_empresa" ON sectores;
CREATE POLICY "rls_sectores_empresa" ON sectores
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE horarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_horarios_empresa" ON horarios;
CREATE POLICY "rls_horarios_empresa" ON horarios
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE puestos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_puestos_empresa" ON puestos;
CREATE POLICY "rls_puestos_empresa" ON puestos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

ALTER TABLE puestos_contacto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_puestos_contacto_empresa" ON puestos_contacto;
CREATE POLICY "rls_puestos_contacto_empresa" ON puestos_contacto
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─────────────────────────────────────────────────────────────��───────────────
-- BANCOS (ya tiene RLS en catalogo_bancos.sql, pero incluimos por idempotencia)
-- ───────────────────────────────────────���─────────────────────────────────────

ALTER TABLE bancos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bancos_empresa" ON bancos;
CREATE POLICY "bancos_empresa" ON bancos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ───���──────────────────────────��──────────────────────────────────────────────
-- GOOGLE DRIVE
-- ───────────────────���────────────────────────────���────────────────────────────

ALTER TABLE configuracion_google_drive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_configuracion_google_drive_empresa" ON configuracion_google_drive;
CREATE POLICY "rls_configuracion_google_drive_empresa" ON configuracion_google_drive
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);


-- =============================================================================
-- SECCIÓN 2: Tablas child SIN empresa_id (políticas con EXISTS + JOIN)
-- Estas tablas heredan el aislamiento multi-tenant a través de su FK padre.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- contacto_direcciones -> contactos (via contacto_id)
-- ───���─────────────────────────────────────────────────────────────────────────

ALTER TABLE contacto_direcciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_contacto_direcciones_empresa" ON contacto_direcciones;
CREATE POLICY "rls_contacto_direcciones_empresa" ON contacto_direcciones
  USING (
    EXISTS (
      SELECT 1 FROM contactos
      WHERE contactos.id = contacto_direcciones.contacto_id
        AND contactos.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contactos
      WHERE contactos.id = contacto_direcciones.contacto_id
        AND contactos.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ──────��──────────────────────────────────────────────────────────────────────
-- contacto_responsables -> contactos (via contacto_id)
-- ──────��─────────────────────────���────────────────────────────────────────────

ALTER TABLE contacto_responsables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_contacto_responsables_empresa" ON contacto_responsables;
CREATE POLICY "rls_contacto_responsables_empresa" ON contacto_responsables
  USING (
    EXISTS (
      SELECT 1 FROM contactos
      WHERE contactos.id = contacto_responsables.contacto_id
        AND contactos.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contactos
      WHERE contactos.id = contacto_responsables.contacto_id
        AND contactos.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- contacto_seguidores -> contactos (via contacto_id)
-- ─────���────────────────────────────────��──────────────────────────────────────

ALTER TABLE contacto_seguidores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_contacto_seguidores_empresa" ON contacto_seguidores;
CREATE POLICY "rls_contacto_seguidores_empresa" ON contacto_seguidores
  USING (
    EXISTS (
      SELECT 1 FROM contactos
      WHERE contactos.id = contacto_seguidores.contacto_id
        AND contactos.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contactos
      WHERE contactos.id = contacto_seguidores.contacto_id
        AND contactos.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ────────���────────────────────��───────────────────────────────────────────────
-- mensaje_lecturas -> mensajes (via mensaje_id)
-- ─────��───────────────��───────────────────────────────────────────────────────

ALTER TABLE mensaje_lecturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_mensaje_lecturas_empresa" ON mensaje_lecturas;
CREATE POLICY "rls_mensaje_lecturas_empresa" ON mensaje_lecturas
  USING (
    EXISTS (
      SELECT 1 FROM mensajes
      WHERE mensajes.id = mensaje_lecturas.mensaje_id
        AND mensajes.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mensajes
      WHERE mensajes.id = mensaje_lecturas.mensaje_id
        AND mensajes.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ────────────────────────────────────────────────────���────────────────────────
-- canal_interno_miembros -> canales_internos (via canal_id)
-- ──────��──────────────────��─────────────────────────────────────���─────────────

ALTER TABLE canal_interno_miembros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_canal_interno_miembros_empresa" ON canal_interno_miembros;
CREATE POLICY "rls_canal_interno_miembros_empresa" ON canal_interno_miembros
  USING (
    EXISTS (
      SELECT 1 FROM canales_internos
      WHERE canales_internos.id = canal_interno_miembros.canal_id
        AND canales_internos.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM canales_internos
      WHERE canales_internos.id = canal_interno_miembros.canal_id
        AND canales_internos.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ───��─────────────────────────────────────────��───────────────────────────────
-- canal_agentes -> canales_inbox (via canal_id)
-- ��────────────────────────────────���───────────────────────────────────────────

ALTER TABLE canal_agentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_canal_agentes_empresa" ON canal_agentes;
CREATE POLICY "rls_canal_agentes_empresa" ON canal_agentes
  USING (
    EXISTS (
      SELECT 1 FROM canales_inbox
      WHERE canales_inbox.id = canal_agentes.canal_id
        AND canales_inbox.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM canales_inbox
      WHERE canales_inbox.id = canal_agentes.canal_id
        AND canales_inbox.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ──────────────────────────────────��──────────────────────────────────────────
-- conversacion_etiquetas -> conversaciones (via conversacion_id)
-- ──────────────────────────────────────────────────────────────────���──────────

ALTER TABLE conversacion_etiquetas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_conversacion_etiquetas_empresa" ON conversacion_etiquetas;
CREATE POLICY "rls_conversacion_etiquetas_empresa" ON conversacion_etiquetas
  USING (
    EXISTS (
      SELECT 1 FROM conversaciones
      WHERE conversaciones.id = conversacion_etiquetas.conversacion_id
        AND conversaciones.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversaciones
      WHERE conversaciones.id = conversacion_etiquetas.conversacion_id
        AND conversaciones.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ───────────────────���─────────────────────────────────────────────────────────
-- contactos_emergencia -> miembros (via miembro_id)
-- ─���───────��──────────────────────────────���───────────────────────────────���────

ALTER TABLE contactos_emergencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_contactos_emergencia_empresa" ON contactos_emergencia;
CREATE POLICY "rls_contactos_emergencia_empresa" ON contactos_emergencia
  USING (
    EXISTS (
      SELECT 1 FROM miembros
      WHERE miembros.id = contactos_emergencia.miembro_id
        AND miembros.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM miembros
      WHERE miembros.id = contactos_emergencia.miembro_id
        AND miembros.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ───────────────────────────────��─────────────────────────────────────────────
-- documentos_usuario -> miembros (via miembro_id)
-- ���───────────────────────────────────────────────────��────────────────────────

ALTER TABLE documentos_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_documentos_usuario_empresa" ON documentos_usuario;
CREATE POLICY "rls_documentos_usuario_empresa" ON documentos_usuario
  USING (
    EXISTS (
      SELECT 1 FROM miembros
      WHERE miembros.id = documentos_usuario.miembro_id
        AND miembros.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM miembros
      WHERE miembros.id = documentos_usuario.miembro_id
        AND miembros.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ─��───────────────────────────────────────────────────────────────────────────
-- educacion_usuario -> miembros (via miembro_id)
-- ───────��─────────────────────────────────────────────────────────────────��───

ALTER TABLE educacion_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_educacion_usuario_empresa" ON educacion_usuario;
CREATE POLICY "rls_educacion_usuario_empresa" ON educacion_usuario
  USING (
    EXISTS (
      SELECT 1 FROM miembros
      WHERE miembros.id = educacion_usuario.miembro_id
        AND miembros.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM miembros
      WHERE miembros.id = educacion_usuario.miembro_id
        AND miembros.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ──���────────────────────────────────────────────────────���─────────────────────
-- info_bancaria -> miembros (via miembro_id)
-- ─���──────────────────────────────────────────────────────────────────────��────

ALTER TABLE info_bancaria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_info_bancaria_empresa" ON info_bancaria;
CREATE POLICY "rls_info_bancaria_empresa" ON info_bancaria
  USING (
    EXISTS (
      SELECT 1 FROM miembros
      WHERE miembros.id = info_bancaria.miembro_id
        AND miembros.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM miembros
      WHERE miembros.id = info_bancaria.miembro_id
        AND miembros.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- ──────���──────────────────────────────────────────────────────────────────────
-- miembros_sectores -> sectores (via sector_id, sectores tiene empresa_id)
-- ──────���────────────────────────────────────────────────────────────────────���─

ALTER TABLE miembros_sectores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_miembros_sectores_empresa" ON miembros_sectores;
CREATE POLICY "rls_miembros_sectores_empresa" ON miembros_sectores
  USING (
    EXISTS (
      SELECT 1 FROM sectores
      WHERE sectores.id = miembros_sectores.sector_id
        AND sectores.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sectores
      WHERE sectores.id = miembros_sectores.sector_id
        AND sectores.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );


-- =============================================================================
-- SECCIÓN 3: Tabla preferencias_usuario (sin empresa_id, scoped por auth.uid())
-- No es multi-tenant sino personal por usuario autenticado.
-- =============================================================================

ALTER TABLE preferencias_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_preferencias_usuario_propio" ON preferencias_usuario;
CREATE POLICY "rls_preferencias_usuario_propio" ON preferencias_usuario
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());


-- =============================================================================
-- FIN DE MIGRACIÓN
-- Total: 48 tablas con RLS habilitado + 1 tabla con política por auth.uid()
-- Tablas excluidas (globales): empresas, perfiles, campos_fiscales_pais, catalogo_modulos
-- =============================================================================
