-- 040: Agregar soft-delete (papelera) a notas_rapidas
-- Las notas eliminadas van a la papelera en vez de borrarse definitivamente.

ALTER TABLE notas_rapidas
  ADD COLUMN IF NOT EXISTS en_papelera boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS papelera_en timestamptz;

-- Índice para consultas de papelera eficientes
CREATE INDEX IF NOT EXISTS notas_rapidas_papelera_idx
  ON notas_rapidas (empresa_id, en_papelera);
