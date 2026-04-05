-- Migración: Plantillas de WhatsApp (Meta Business Templates)
-- Tabla local que sincroniza con Meta Graph API
-- Fecha: 2026-04-05

CREATE TABLE IF NOT EXISTS plantillas_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  canal_id UUID REFERENCES canales_inbox(id) ON DELETE SET NULL,

  -- Identidad (Meta)
  nombre TEXT NOT NULL,
  nombre_api TEXT NOT NULL, -- lowercase_underscore, max 512 chars
  categoria TEXT NOT NULL DEFAULT 'UTILITY', -- MARKETING | UTILITY | AUTHENTICATION
  idioma TEXT NOT NULL DEFAULT 'es',

  -- Componentes (estructura Meta)
  componentes JSONB NOT NULL DEFAULT '{}',
  -- { encabezado: {tipo, texto, ejemplo}, cuerpo: {texto, ejemplos[], mapeo_variables[]},
  --   pie_pagina: {texto}, botones: [{tipo, texto, url?, telefono?}] }

  -- Estado Meta
  estado_meta TEXT NOT NULL DEFAULT 'BORRADOR', -- BORRADOR | PENDING | APPROVED | REJECTED | DISABLED | PAUSED | ERROR
  id_template_meta TEXT,
  error_meta TEXT,
  ultima_sincronizacion TIMESTAMPTZ,

  -- Disponibilidad
  modulos TEXT[] DEFAULT '{}',
  es_por_defecto BOOLEAN DEFAULT false,
  disponible_para TEXT DEFAULT 'todos', -- todos | roles | usuarios
  roles_permitidos TEXT[] DEFAULT '{}',
  usuarios_permitidos UUID[] DEFAULT '{}',

  -- Auditoría
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_por UUID,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_plantillas_wa_empresa ON plantillas_whatsapp(empresa_id);
CREATE INDEX idx_plantillas_wa_estado ON plantillas_whatsapp(empresa_id, estado_meta);
CREATE UNIQUE INDEX idx_plantillas_wa_nombre_api ON plantillas_whatsapp(empresa_id, canal_id, nombre_api);

-- RLS
ALTER TABLE plantillas_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plantillas_whatsapp_empresa" ON plantillas_whatsapp
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
