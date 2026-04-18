-- Migración: Auditoría para plantillas de correo.
-- - Agrega campos creado_por_nombre, editado_por, editado_por_nombre a plantillas_correo.
-- - Crea tabla auditoria_plantillas_correo (misma estructura que auditoria_productos/contactos).
-- - RLS multi-tenant por empresa_id.

-- ═══ Campos de auditoría en plantillas_correo ═══
ALTER TABLE plantillas_correo
  ADD COLUMN IF NOT EXISTS creado_por_nombre text,
  ADD COLUMN IF NOT EXISTS editado_por uuid,
  ADD COLUMN IF NOT EXISTS editado_por_nombre text;

-- ═══ Tabla de auditoría ═══
CREATE TABLE IF NOT EXISTS auditoria_plantillas_correo (
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

CREATE INDEX IF NOT EXISTS auditoria_plantillas_correo_plantilla_idx
  ON auditoria_plantillas_correo(plantilla_id);
CREATE INDEX IF NOT EXISTS auditoria_plantillas_correo_empresa_idx
  ON auditoria_plantillas_correo(empresa_id);

ALTER TABLE auditoria_plantillas_correo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_plantillas_correo_empresa" ON auditoria_plantillas_correo;
CREATE POLICY "auditoria_plantillas_correo_empresa" ON auditoria_plantillas_correo
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
