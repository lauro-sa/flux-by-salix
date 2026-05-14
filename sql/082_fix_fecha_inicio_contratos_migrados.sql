-- 082_fix_fecha_inicio_contratos_migrados.sql
--
-- Fix de los contratos generados por sql/077_seed_contratos_desde_miembros.sql.
--
-- Problema: el seed inicial usó `miembros.unido_en` como fecha_inicio.
-- En la práctica `unido_en` corresponde a la fecha en que el miembro
-- fue cargado en Flux, NO a la fecha real en que arrancó la relación
-- laboral. Por ejemplo: un empleado que vino trabajando desde enero
-- pero fue alta en el sistema el 30 de marzo quedó con un contrato que
-- "empezaba" el 30 de marzo, lo cual es incorrecto.
--
-- Solución: para contratos migrados (motivo_cambio = 'Migración inicial
-- desde campos legacy en miembros') que sigan vigentes, dejar
-- fecha_inicio = MIN(unido_en, primer_fichaje). Si no hay fichajes,
-- mantener unido_en.
--
-- Solo se tocan los contratos del seed inicial — cualquier contrato
-- creado por el usuario desde la ficha laboral mantiene su fecha
-- intacta (motivo_cambio nunca repite ese string literal).
--
-- Idempotente: si ya fue corregido, el LEAST devuelve el mismo valor.

WITH primer_fichaje AS (
  SELECT miembro_id, MIN(fecha) AS fecha_min
  FROM asistencias
  GROUP BY miembro_id
)
UPDATE contratos_laborales c
SET fecha_inicio = LEAST(c.fecha_inicio, pf.fecha_min)
FROM primer_fichaje pf
WHERE c.miembro_id = pf.miembro_id
  AND c.vigente = true
  AND c.motivo_cambio = 'Migración inicial desde campos legacy en miembros'
  AND pf.fecha_min < c.fecha_inicio;
