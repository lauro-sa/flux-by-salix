-- 083_configuracion_nomina_empresa.sql
--
-- Defaults de envío del módulo Nóminas, una fila por empresa.
-- Lo usa el modal `ModalEnviarReciboNomina` para preseleccionar canal +
-- plantilla al abrir, en lugar de obligar al operador a elegirlos cada
-- vez. La fila se inserta lazily (la primera vez que el usuario guarda
-- desde la sub-tab "Plantillas de envío" en Nóminas → Configuración).
--
-- Las FK con ON DELETE SET NULL significan que si se borra un canal o
-- una plantilla, la config queda con NULL y el modal vuelve al
-- comportamiento sin default (el operador elige manualmente).

CREATE TABLE IF NOT EXISTS configuracion_nomina_empresa (
  empresa_id uuid PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,

  -- Defaults para envío por correo
  canal_correo_default_id uuid REFERENCES canales_correo(id) ON DELETE SET NULL,
  plantilla_correo_default_id uuid REFERENCES plantillas_correo(id) ON DELETE SET NULL,

  -- Defaults para envío por WhatsApp
  canal_whatsapp_default_id uuid REFERENCES canales_whatsapp(id) ON DELETE SET NULL,
  plantilla_whatsapp_default_id uuid REFERENCES plantillas_whatsapp(id) ON DELETE SET NULL,

  -- Auditoría
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES auth.users(id)
);

ALTER TABLE configuracion_nomina_empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY configuracion_nomina_empresa_tenant
  ON configuracion_nomina_empresa
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);
