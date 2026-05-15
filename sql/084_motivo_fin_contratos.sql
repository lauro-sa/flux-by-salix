-- 084_motivo_fin_contratos.sql
--
-- Agrega contexto formal al cierre de un contrato laboral.
--
-- Antes de este PR, "terminar un contrato" se hacía únicamente seteando
-- `fecha_fin` + `vigente=false`, pero no quedaba registro de POR QUÉ se
-- terminó (renuncia, despido, fin de plazo, etc.). Esto es importante:
--   - Legalmente, el motivo define indemnización y obligaciones.
--   - Operativamente, permite reportes "rotación de personal por causa".
--   - Para el operador, ver el motivo en la card del contrato terminado
--     es información de contexto crítica que antes había que buscar en
--     notas libres.
--
-- `nota_fin` es opcional para detalles libres (ej. número de telegrama,
-- nombre del nuevo empleador en el caso de renuncia, etc.).

ALTER TABLE contratos_laborales
  ADD COLUMN motivo_fin text CHECK (motivo_fin IN (
    'renuncia',
    'despido_con_causa',
    'despido_sin_causa',
    'fin_plazo',
    'mutuo_acuerdo',
    'abandono',
    'jubilacion',
    'fallecimiento',
    'otro'
  )),
  ADD COLUMN nota_fin text;

-- Solo tiene sentido un motivo_fin si el contrato está cerrado.
ALTER TABLE contratos_laborales
  ADD CONSTRAINT contratos_motivo_fin_consistente CHECK (
    (motivo_fin IS NULL AND nota_fin IS NULL) OR
    (vigente = false AND fecha_fin IS NOT NULL)
  );
