-- Habilita las nuevas herramientas de movimientos de nómina (adelantos y descuentos)
-- en Salix IA para todas las empresas que ya tenían config_salix_ia.
--
-- TOOLS NUEVAS QUE AGREGA ESTA MIGRACIÓN
--   - consultar_movimientos_nomina: lista adelantos/descuentos con flag es_editable
--     y motivo_no_editable. Soporta filtros por miembro, tipo, estado y rango de fechas.
--   - crear_movimiento_nomina: crea adelanto o descuento + genera cuotas programadas
--     según frecuencia (semanal/quincenal/mensual). Los descuentos siempre son de 1 cuota.
--   - modificar_movimiento_nomina: edita monto/cuotas/descripción aplicando reglas
--     inteligentes (no toca cuotas ya descontadas, bloquea si está pagado).
--   - eliminar_movimiento_nomina: cancela el movimiento + cuotas pendientes. Si tiene
--     cuotas ya descontadas, las preserva en el histórico (no se pueden revertir desde acá).
--
-- COMPORTAMIENTO
-- Idempotente: agrega las 4 claves a herramientas_habilitadas solo si no estaban.
-- Reordena alfabéticamente para mantener diffs limpios.

update config_salix_ia
set herramientas_habilitadas = (
  select array_agg(distinct elem order by elem)
  from unnest(
    herramientas_habilitadas
    || array[
      'consultar_movimientos_nomina',
      'crear_movimiento_nomina',
      'modificar_movimiento_nomina',
      'eliminar_movimiento_nomina'
    ]::text[]
  ) as elem
),
actualizado_en = now()
where not (
  'consultar_movimientos_nomina' = any(herramientas_habilitadas)
  and 'crear_movimiento_nomina' = any(herramientas_habilitadas)
  and 'modificar_movimiento_nomina' = any(herramientas_habilitadas)
  and 'eliminar_movimiento_nomina' = any(herramientas_habilitadas)
);

-- Actualizar default de la columna para nuevas filas
alter table config_salix_ia
  alter column herramientas_habilitadas set default ARRAY[
    'anotar_nota',
    'buscar_contactos',
    'buscar_direccion',
    'buscar_presupuestos',
    'consultar_actividades',
    'consultar_asistencias',
    'consultar_calendario',
    'consultar_equipo',
    'consultar_movimientos_nomina',
    'consultar_notas',
    'consultar_productos',
    'consultar_vinculaciones_contacto',
    'consultar_visitas',
    'crear_actividad',
    'crear_contacto',
    'crear_movimiento_nomina',
    'crear_recordatorio',
    'crear_visita',
    'eliminar_movimiento_nomina',
    'modificar_actividad',
    'modificar_contacto',
    'modificar_evento',
    'modificar_movimiento_nomina',
    'modificar_nota',
    'modificar_presupuesto',
    'modificar_visita',
    'obtener_contacto',
    'obtener_presupuesto',
    'vincular_contactos'
  ];
