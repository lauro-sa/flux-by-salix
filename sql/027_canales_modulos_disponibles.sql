-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 027: MÓDULOS DISPONIBLES POR CANAL DE CORREO
-- Permite restringir en qué módulos aparece cada cuenta de correo.
-- Array vacío = disponible en todos los módulos (comportamiento actual).
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canales_inbox' AND column_name = 'modulos_disponibles'
  ) THEN
    ALTER TABLE canales_inbox
      ADD COLUMN modulos_disponibles text[] NOT NULL DEFAULT '{}';

    COMMENT ON COLUMN canales_inbox.modulos_disponibles IS
      'Módulos donde este canal está disponible para envío. Array vacío = todos los módulos.';
  END IF;
END $$;
