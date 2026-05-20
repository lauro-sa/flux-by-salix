-- =============================================================
-- 112: Identificaciones adicionales para Argentina
-- Antes solo había CUIT/DNI/CUIL. Sumamos Pasaporte, Libreta y Otro
-- para cubrir casos comunes: extranjeros sin DNI argentino, mayores
-- con libreta cívica/enrolamiento y cualquier identificación
-- alternativa (fallback).
-- =============================================================

INSERT INTO public.campos_fiscales_pais
  (pais, clave, etiqueta, tipo_campo, opciones, obligatorio, patron_validacion, mascara, orden, aplica_a, es_identificacion)
VALUES
  ('AR', 'pasaporte', 'Pasaporte', 'texto', NULL, false, NULL, NULL, 7, '{"persona","lead"}', true),
  ('AR', 'libreta',   'Libreta cívica/de enrolamiento', 'texto', NULL, false, '^\d{1,8}$', NULL, 8, '{"persona","lead"}', true),
  ('AR', 'otro_id',   'Otro', 'texto', NULL, false, NULL, NULL, 9, '{"empresa","proveedor","persona","lead","edificio"}', true)
ON CONFLICT (pais, clave) DO NOTHING;
