-- 041: Agregar soft-delete (papelera) a recorridos
-- Los recorridos eliminados van a la papelera en vez de borrarse definitivamente.

ALTER TABLE recorridos
  ADD COLUMN IF NOT EXISTS en_papelera boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS papelera_en timestamptz;

-- Índice para consultas de papelera eficientes
CREATE INDEX IF NOT EXISTS recorridos_papelera_idx
  ON recorridos (empresa_id, en_papelera);
