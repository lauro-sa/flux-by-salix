-- Presets del modal "Nueva actividad" por usuario+empresa+tipo.
-- Diferencia con presets_visitas: cada tipo de actividad (Llamada, Reunión, Nota, etc.)
-- tiene su propio set de presets independiente. Cada usuario puede guardar hasta 3
-- presets por tipo, con nombre y un favorito ("aplicar al abrir") por tipo.
-- Al eliminar un tipo de actividad, se eliminan sus presets (ON DELETE CASCADE).

CREATE TABLE IF NOT EXISTS public.presets_actividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_id uuid NOT NULL REFERENCES public.tipos_actividad(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  -- Orden visual dentro de la lista (0, 1, 2)
  orden integer NOT NULL DEFAULT 0,
  -- Blob con los valores preseleccionados. Estructura libre (cada campo se aplica solo
  -- si el tipo de actividad tiene habilitado el campo_X correspondiente):
  --   { asignados[], prioridad, descripcion_plantilla, checklist[], duracion_estimada_min }
  valores jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Si true, se aplica automáticamente al abrir el modal CON ESE TIPO activo.
  -- Un usuario puede tener un favorito por cada tipo (no es un único favorito global).
  aplicar_al_abrir boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Un usuario no puede tener dos presets con el mismo nombre para el mismo tipo.
CREATE UNIQUE INDEX IF NOT EXISTS presets_actividades_nombre_unico_idx
  ON public.presets_actividades (empresa_id, usuario_id, tipo_id, lower(nombre));

-- Solo un preset por (usuario, empresa, tipo) puede estar marcado "aplicar al abrir".
CREATE UNIQUE INDEX IF NOT EXISTS presets_actividades_aplicar_unico_idx
  ON public.presets_actividades (empresa_id, usuario_id, tipo_id)
  WHERE aplicar_al_abrir = true;

-- Índice para listar presets del usuario para un tipo específico.
CREATE INDEX IF NOT EXISTS presets_actividades_usuario_tipo_idx
  ON public.presets_actividades (empresa_id, usuario_id, tipo_id, orden);

-- RLS: aislamiento por empresa y por usuario (cada uno ve solo los suyos).
ALTER TABLE public.presets_actividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_presets_actividades_usuario" ON public.presets_actividades;
CREATE POLICY "rls_presets_actividades_usuario" ON public.presets_actividades
  USING (
    empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    AND usuario_id = auth.uid()
  )
  WITH CHECK (
    empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    AND usuario_id = auth.uid()
  );
