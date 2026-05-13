-- Habilita las nuevas herramientas de Salix IA para vinculaciones entre contactos
-- en todas las empresas que ya tenían config_salix_ia.
--
-- CONTEXTO
-- Cuando una empresa configura el copiloto por primera vez, el frontend pobla
-- `herramientas_habilitadas` con todas las claves disponibles. Pero las empresas
-- que ya tenían config guardada quedan con el array viejo y no ven las tools
-- recién agregadas hasta que las activen manualmente desde Configuración → IA.
--
-- TOOLS NUEVAS QUE AGREGA ESTA MIGRACIÓN
--   - consultar_vinculaciones_contacto: listar contactos vinculados a un contacto
--     (hijos o padres), con tipo de relación y puesto.
--   - vincular_contactos: vincular o desvincular dos contactos existentes
--     (unidireccional contacto_id → vinculado_id).
--
-- COMPORTAMIENTO
-- Para cada fila de config_salix_ia, agregamos las claves nuevas SOLO si no
-- estaban ya presentes (idempotente). El array se ordena alfabéticamente para
-- mantener diffs limpios al exportar config.

update config_salix_ia
set herramientas_habilitadas = (
  select array_agg(distinct elem order by elem)
  from unnest(
    herramientas_habilitadas
    || array['consultar_vinculaciones_contacto', 'vincular_contactos']::text[]
  ) as elem
),
actualizado_en = now()
where not (
  'consultar_vinculaciones_contacto' = any(herramientas_habilitadas)
  and 'vincular_contactos' = any(herramientas_habilitadas)
);

-- Actualizar el default de la columna para nuevas filas creadas directo en BD
-- (sin pasar por el frontend). El frontend igual pobla el array completo al
-- crear la config, pero este default sirve de red de seguridad.
alter table config_salix_ia
  alter column herramientas_habilitadas set default ARRAY[
    'buscar_contactos',
    'obtener_contacto',
    'crear_contacto',
    'consultar_vinculaciones_contacto',
    'vincular_contactos',
    'crear_actividad',
    'crear_recordatorio',
    'crear_visita',
    'consultar_asistencias',
    'consultar_calendario',
    'consultar_actividades',
    'consultar_visitas',
    'buscar_presupuestos',
    'modificar_actividad',
    'modificar_visita',
    'modificar_presupuesto',
    'modificar_evento',
    'anotar_nota',
    'consultar_notas'
  ];
