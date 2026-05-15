-- 086_setting_empleados_terminados.sql
--
-- Setting por empresa: en la lista de Liquidaciones, ¿mostramos los
-- empleados cuyo contrato terminó antes del período?
--
-- Default false (no mostrar): el caso más limpio para el día a día.
-- Si la empresa quiere verlos en gris con $0 (útil para cierre de mes
-- o auditoría), lo activa desde Configuración → Plantillas de envío
-- (la sub-tab donde ya viven los settings de envío del módulo).
--
-- El motor ya tiene la lógica: si el contrato vigente del miembro
-- terminó antes del período, el detalle del recibo es $0 + advertencia.
-- Lo único que cambia este setting es la VISIBILIDAD en el listado.

ALTER TABLE configuracion_nomina_empresa
  ADD COLUMN mostrar_empleados_terminados boolean NOT NULL DEFAULT false;
