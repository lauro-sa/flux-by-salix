-- ═══════════════════════════════════════════════════════════════
-- Agregar herramientas de notas a config_salix_ia existentes
-- y actualizar el DEFAULT para nuevas empresas
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar anotar_nota, consultar_notas y modificar_nota a empresas existentes
--    Solo agrega si no las tienen (evita duplicados)
UPDATE config_salix_ia
SET herramientas_habilitadas = (
  SELECT array_agg(DISTINCT herramienta)
  FROM unnest(
    herramientas_habilitadas || ARRAY['anotar_nota', 'consultar_notas', 'modificar_nota']
  ) AS herramienta
),
actualizado_en = now();

-- 2. Actualizar el DEFAULT de la columna para nuevas empresas
ALTER TABLE config_salix_ia
ALTER COLUMN herramientas_habilitadas SET DEFAULT ARRAY[
  'buscar_contactos', 'obtener_contacto', 'crear_contacto',
  'crear_actividad', 'crear_recordatorio', 'crear_visita',
  'consultar_asistencias', 'consultar_calendario',
  'consultar_actividades', 'consultar_visitas',
  'buscar_presupuestos',
  'modificar_actividad', 'modificar_visita',
  'modificar_presupuesto', 'modificar_evento',
  'anotar_nota', 'consultar_notas', 'modificar_nota'
];
