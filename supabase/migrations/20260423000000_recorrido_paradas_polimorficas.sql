-- Paradas polimórficas del recorrido.
-- Antes: cada parada era siempre una visita a un contacto (visita_id NOT NULL).
-- Ahora: una parada puede ser una visita real (tipo='visita') o una "parada genérica"
-- (tipo='parada') que NO cuenta como visita al cliente — sirve para logística del día
-- (cargar combustible, pasar por depósito, café, etc.) con dirección a mano o tomada
-- de un contacto sin generar una visita real.

-- 1) visita_id deja de ser obligatorio.
ALTER TABLE public.recorrido_paradas
  ALTER COLUMN visita_id DROP NOT NULL;

-- 2) El índice único anterior asumía visita_id NOT NULL. Lo reemplazamos por uno parcial.
DROP INDEX IF EXISTS public.recorrido_paradas_unico_idx;
CREATE UNIQUE INDEX recorrido_paradas_unico_visita_idx
  ON public.recorrido_paradas(recorrido_id, visita_id)
  WHERE visita_id IS NOT NULL;

-- 3) Columnas nuevas — sostienen la parada genérica con datos propios.
ALTER TABLE public.recorrido_paradas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'visita',
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS direccion_texto text,
  ADD COLUMN IF NOT EXISTS direccion_lat double precision,
  ADD COLUMN IF NOT EXISTS direccion_lng double precision,
  ADD COLUMN IF NOT EXISTS direccion_id uuid REFERENCES public.contacto_direcciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contacto_id uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contacto_nombre text,
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'programada',
  ADD COLUMN IF NOT EXISTS fecha_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_llegada timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_completada timestamptz,
  ADD COLUMN IF NOT EXISTS creado_por uuid;

-- 4) Integridad: el tipo define si hay visita vinculada o no.
ALTER TABLE public.recorrido_paradas
  DROP CONSTRAINT IF EXISTS recorrido_paradas_tipo_chk;
ALTER TABLE public.recorrido_paradas
  ADD CONSTRAINT recorrido_paradas_tipo_chk CHECK (
    (tipo = 'visita' AND visita_id IS NOT NULL) OR
    (tipo = 'parada' AND visita_id IS NULL)
  );

-- 5) Índice para filtrar por tipo dentro de un recorrido.
CREATE INDEX IF NOT EXISTS recorrido_paradas_tipo_idx
  ON public.recorrido_paradas(recorrido_id, tipo);

-- 6) Contadores separados: las paradas genéricas no contaminan las métricas de visitas al cliente.
ALTER TABLE public.recorridos
  ADD COLUMN IF NOT EXISTS total_paradas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paradas_completadas integer NOT NULL DEFAULT 0;
