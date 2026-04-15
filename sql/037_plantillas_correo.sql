-- Separar plantillas de correo de las respuestas rápidas (WhatsApp/inbox)
-- Las plantillas de correo son documentos con asunto + HTML, no tienen nada que ver
-- con las respuestas rápidas de WhatsApp que son texto plano.

BEGIN;

-- 1. Crear tabla independiente para plantillas de correo
CREATE TABLE IF NOT EXISTS plantillas_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  categoria text,
  asunto text NOT NULL DEFAULT '',
  contenido text NOT NULL, -- texto plano (fallback)
  contenido_html text NOT NULL DEFAULT '',
  variables jsonb DEFAULT '[]',
  modulos text[] DEFAULT '{}',
  -- Permisos de acceso
  disponible_para text NOT NULL DEFAULT 'todos', -- 'todos', 'roles', 'usuarios'
  roles_permitidos text[] DEFAULT '{}',
  usuarios_permitidos uuid[] DEFAULT '{}',
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plantillas_correo_empresa_idx ON plantillas_correo(empresa_id);

-- 2. Migrar plantillas de correo existentes desde plantillas_respuesta
INSERT INTO plantillas_correo (
  id, empresa_id, nombre, categoria, asunto, contenido, contenido_html,
  variables, modulos, disponible_para, roles_permitidos, usuarios_permitidos,
  activo, orden, creado_por, creado_en, actualizado_en
)
SELECT
  id, empresa_id, nombre, categoria,
  COALESCE(asunto, ''),
  contenido,
  COALESCE(contenido_html, ''),
  variables, modulos, disponible_para, roles_permitidos, usuarios_permitidos,
  activo, orden, creado_por, creado_en, actualizado_en
FROM plantillas_respuesta
WHERE canal = 'correo'
  OR (canal = 'todos' AND contenido_html IS NOT NULL AND contenido_html != '')
ON CONFLICT (id) DO NOTHING;

-- 3. Eliminar las plantillas de correo de la tabla de respuestas rápidas
DELETE FROM plantillas_respuesta WHERE canal = 'correo';

-- 4. RLS
ALTER TABLE plantillas_correo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_plantillas_correo_empresa" ON plantillas_correo;
CREATE POLICY "rls_plantillas_correo_empresa" ON plantillas_correo
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

COMMIT;
