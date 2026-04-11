-- ═══════════════════════════════════════════════════════════════
-- Migración 030: Campo es_sistema en tipos_actividad
-- Tipos del sistema no se pueden editar (nombre/clave/icono/color) ni eliminar.
-- Solo se puede activar/desactivar y reordenar.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar campo es_sistema
ALTER TABLE tipos_actividad ADD COLUMN IF NOT EXISTS es_sistema boolean NOT NULL DEFAULT false;

-- 2. Marcar el tipo 'visita' como tipo del sistema en todas las empresas
UPDATE tipos_actividad SET es_sistema = true WHERE clave = 'visita';
