-- Presets del modal "Nueva visita" por usuario+empresa.
-- Cada usuario puede guardar hasta 3 configuraciones con nombre (ej: "Técnico Juan", "Comercial")
-- que preseleccionan asignado, hora, duración, prioridad, checklist y notas al abrir el modal.
-- Tabla propia del módulo visitas: al desinstalar el módulo se va con él (módulos independientes).

CREATE TABLE IF NOT EXISTS public.presets_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  -- Orden visual dentro de la barra de chips (0, 1, 2). No se usa para identificar.
  orden integer NOT NULL DEFAULT 0,
  -- Blob con los valores preseleccionados del modal.
  -- Estructura libre para permitir evolución sin migrar: { asignado_a, asignado_nombre,
  --   hora, duracion_estimada_min, prioridad, checklist, notas }
  valores jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Si true, se aplica automáticamente al abrir el modal (solo uno por usuario).
  aplicar_al_abrir boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Un usuario no puede tener dos presets con el mismo nombre en la misma empresa.
CREATE UNIQUE INDEX IF NOT EXISTS presets_visitas_nombre_unico_idx
  ON public.presets_visitas (empresa_id, usuario_id, lower(nombre));

-- Solo un preset puede estar marcado "aplicar al abrir" por usuario+empresa.
CREATE UNIQUE INDEX IF NOT EXISTS presets_visitas_aplicar_unico_idx
  ON public.presets_visitas (empresa_id, usuario_id)
  WHERE aplicar_al_abrir = true;

-- Índice para listar los presets del usuario actual ordenados.
CREATE INDEX IF NOT EXISTS presets_visitas_usuario_idx
  ON public.presets_visitas (empresa_id, usuario_id, orden);

-- RLS: aislamiento por empresa y por usuario (cada uno ve solo los suyos).
ALTER TABLE public.presets_visitas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_presets_visitas_usuario" ON public.presets_visitas;
CREATE POLICY "rls_presets_visitas_usuario" ON public.presets_visitas
  USING (
    empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    AND usuario_id = auth.uid()
  )
  WITH CHECK (
    empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    AND usuario_id = auth.uid()
  );
