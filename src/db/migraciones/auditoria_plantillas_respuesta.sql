-- Migración: Auditoría para plantillas de respuesta rápida.
-- - Agrega campos creado_por_nombre, editado_por, editado_por_nombre a plantillas_respuesta.
-- - Crea tabla auditoria_plantillas_respuesta (misma estructura que otras auditorías).
-- - RLS multi-tenant por empresa_id.

-- ═══ Campos de auditoría en plantillas_respuesta ═══
ALTER TABLE plantillas_respuesta
  ADD COLUMN IF NOT EXISTS creado_por_nombre text,
  ADD COLUMN IF NOT EXISTS editado_por uuid,
  ADD COLUMN IF NOT EXISTS editado_por_nombre text;

-- ═══ Tabla de auditoría ═══
CREATE TABLE IF NOT EXISTS auditoria_plantillas_respuesta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plantilla_id uuid NOT NULL,
  editado_por uuid NOT NULL,
  campo_modificado text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_plantillas_respuesta_plantilla_idx
  ON auditoria_plantillas_respuesta(plantilla_id);
CREATE INDEX IF NOT EXISTS auditoria_plantillas_respuesta_empresa_idx
  ON auditoria_plantillas_respuesta(empresa_id);

ALTER TABLE auditoria_plantillas_respuesta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_plantillas_respuesta_empresa" ON auditoria_plantillas_respuesta;
CREATE POLICY "auditoria_plantillas_respuesta_empresa" ON auditoria_plantillas_respuesta
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
