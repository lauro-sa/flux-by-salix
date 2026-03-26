-- =============================================================
-- 005: Identificación dinámica por país + multi-país en empresas
-- =============================================================

-- 1. Agregar es_identificacion a campos_fiscales_pais
ALTER TABLE public.campos_fiscales_pais
  ADD COLUMN IF NOT EXISTS es_identificacion boolean NOT NULL DEFAULT false;

-- Marcar campos de identificación existentes
UPDATE public.campos_fiscales_pais SET es_identificacion = true
WHERE clave IN ('cuit', 'dni', 'cuil', 'rfc', 'curp', 'nit', 'cedula', 'cif_nif');

-- Agregar CUIL para Argentina (si no existe)
INSERT INTO public.campos_fiscales_pais (pais, clave, etiqueta, tipo_campo, opciones, obligatorio, patron_validacion, mascara, orden, aplica_a, es_identificacion) VALUES
  ('AR', 'cuil', 'CUIL', 'texto', NULL, false, '^\d{2}-\d{8}-\d$', '##-########-#', 6, '{"persona","lead"}', true)
ON CONFLICT (pais, clave) DO NOTHING;

-- 2. Agregar columna paises (array) a empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS paises text[] NOT NULL DEFAULT '{}';

-- Migrar datos existentes: copiar pais actual a paises si no está vacío
UPDATE public.empresas
  SET paises = ARRAY[pais]
  WHERE pais IS NOT NULL AND pais != '' AND paises = '{}';
