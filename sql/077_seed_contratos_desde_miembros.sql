-- 077_seed_contratos_desde_miembros.sql
-- PR 2 del plan "Módulo Nóminas" (ver PLAN_MODULO_NOMINAS.md).
--
-- Genera un contrato vigente por cada miembro existente que tenga
-- compensación cargada en los campos legacy de `miembros`. Después
-- de este seed, todo miembro con sueldo en sistema tiene su contrato
-- y la app puede empezar a leer desde `contratos_laborales` en vez
-- de los campos legacy.
--
-- Mapeo legacy → nuevo modelo:
--   - compensacion_tipo='fijo'   + frecuencia=semanal     → fijo_semanal
--   - compensacion_tipo='fijo'   + frecuencia=quincenal   → fijo_quincenal
--   - compensacion_tipo='fijo'   + frecuencia=mensual/eventual → fijo_mensual
--   - compensacion_tipo='por_dia'                         → por_dia
--   - compensacion_tipo='por_hora'                        → por_hora
--
-- frecuencia_pago (nuevo enum) se deriva de compensacion_frecuencia:
--   - 'semanal'  → 'semanal'
--   - 'quincenal'→ 'quincenal'
--   - 'mensual'  → 'mensual'
--   - 'eventual' → 'mensual'  (default razonable; el usuario la
--                              corrige en la ficha laboral si hace falta)
--   - NULL       → 'mensual'
--
-- Sector: se toma de `miembros_sectores` donde es_primario=true.
-- Turno:  se toma de `miembros.turno_id`.
-- Fecha de inicio: `unido_en::date` (cuando el miembro se unió a la
-- empresa). Esto evita usar fechas inventadas y respeta el histórico
-- real.
--
-- Régimen: 'informal' por default (Fase 3 introduce los demás).
-- Motivo: 'Migración inicial desde campos legacy en miembros'.
--
-- Idempotente: si el miembro ya tiene contrato vigente, no inserta.

WITH miembros_a_migrar AS (
  SELECT
    m.id            AS miembro_id,
    m.empresa_id,
    m.unido_en::date AS fecha_inicio,
    m.compensacion_tipo,
    m.compensacion_frecuencia,
    m.compensacion_monto,
    m.turno_id,
    (
      SELECT ms.sector_id
      FROM miembros_sectores ms
      WHERE ms.miembro_id = m.id AND ms.es_primario = true
      LIMIT 1
    ) AS sector_id
  FROM miembros m
  WHERE m.compensacion_monto IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM contratos_laborales c
      WHERE c.miembro_id = m.id AND c.vigente = true
    )
)
INSERT INTO contratos_laborales (
  empresa_id, miembro_id,
  fecha_inicio, vigente,
  condicion, modalidad_calculo, monto_base, frecuencia_pago,
  sector_id, turno_id,
  regimen, motivo_cambio
)
SELECT
  empresa_id,
  miembro_id,
  fecha_inicio,
  true,
  'tiempo_indeterminado',
  CASE
    WHEN compensacion_tipo = 'por_hora' THEN 'por_hora'
    WHEN compensacion_tipo = 'por_dia'  THEN 'por_dia'
    WHEN compensacion_tipo = 'fijo' AND compensacion_frecuencia = 'semanal'   THEN 'fijo_semanal'
    WHEN compensacion_tipo = 'fijo' AND compensacion_frecuencia = 'quincenal' THEN 'fijo_quincenal'
    ELSE 'fijo_mensual'
  END,
  compensacion_monto,
  CASE
    WHEN compensacion_frecuencia = 'semanal'   THEN 'semanal'
    WHEN compensacion_frecuencia = 'quincenal' THEN 'quincenal'
    ELSE 'mensual'
  END,
  sector_id,
  turno_id,
  'informal',
  'Migración inicial desde campos legacy en miembros'
FROM miembros_a_migrar;
