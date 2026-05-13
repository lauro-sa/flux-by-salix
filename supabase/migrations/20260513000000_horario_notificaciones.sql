-- =============================================================================
-- Migración: horario_notificaciones en empresas y miembros
-- Fecha: 2026-05-13
-- Descripción:
--   Permite que el sistema de notificaciones respete el horario laboral antes
--   de enviar push. Notificaciones diferidas (actividad vencida, recordatorios,
--   cumpleaños, SLA, calendario) se silencian fuera del horario; comunicación
--   entrante de clientes (WhatsApp / correo / llamada) sigue pasando siempre.
--
--   - empresas.horario_notificaciones: default por empresa (JSONB con días).
--   - miembros.horario_notificaciones: override personal (NULL = hereda empresa).
--
--   La zona horaria se resuelve con la existente `empresas.zona_horaria`.
-- =============================================================================


-- =============================================================================
-- 1. Columna en empresas con default operativo (9-18 lun-vie, fin de semana off)
-- =============================================================================

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS horario_notificaciones JSONB NOT NULL DEFAULT
  '{
    "activo": true,
    "dias": {
      "lunes":     {"activo": true,  "desde": "09:00", "hasta": "18:00"},
      "martes":    {"activo": true,  "desde": "09:00", "hasta": "18:00"},
      "miercoles": {"activo": true,  "desde": "09:00", "hasta": "18:00"},
      "jueves":    {"activo": true,  "desde": "09:00", "hasta": "18:00"},
      "viernes":   {"activo": true,  "desde": "09:00", "hasta": "18:00"},
      "sabado":    {"activo": false, "desde": "09:00", "hasta": "13:00"},
      "domingo":   {"activo": false, "desde": "09:00", "hasta": "13:00"}
    }
  }'::jsonb;

COMMENT ON COLUMN empresas.horario_notificaciones IS
  'Horario laboral por defecto de la empresa para filtrar push de notificaciones diferidas. Estructura: { activo: bool, dias: { lunes..domingo: { activo, desde HH:MM, hasta HH:MM } } }. Si activo=false, NO se filtra (todo pasa). La zona horaria se toma de empresas.zona_horaria.';


-- =============================================================================
-- 2. Columna en miembros (NULL = hereda el de la empresa)
-- =============================================================================

ALTER TABLE miembros
  ADD COLUMN IF NOT EXISTS horario_notificaciones JSONB;

COMMENT ON COLUMN miembros.horario_notificaciones IS
  'Override personal del horario de notificaciones del usuario. Misma estructura que empresas.horario_notificaciones. NULL = hereda el de la empresa.';
