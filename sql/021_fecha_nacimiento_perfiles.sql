-- 021: Agregar fecha_nacimiento a perfiles (para cron de cumpleaños)
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS fecha_nacimiento date;

-- Índice parcial para encontrar cumpleaños rápidamente
CREATE INDEX IF NOT EXISTS idx_perfiles_fecha_nacimiento
  ON perfiles (fecha_nacimiento) WHERE fecha_nacimiento IS NOT NULL;
