-- =============================================================
-- Migración 107: Toggle de empresa "envío obligatorio antes de pagar"
-- =============================================================
-- Cuando esta bandera está activa, la transición
--   liquidacion_empleado.liquidado → pagado
-- queda bloqueada hasta que la liquidación pase por 'enviado'. Es
-- decir, fuerza el orden Liquidar → Enviar → Pagar.
--
-- Default false: la mayoría de empresas chicas pagan sin trámite
-- previo de "enviar el recibo digital al empleado". El toggle se
-- expone en Configuración › Nómina y la decisión es de la empresa.
--
-- La validación se ejecuta server-side en /api/nominas/pagar. El
-- UI también respeta el toggle: el CTA contextual del hero cambia
-- entre "Pagar (N)" y "Enviar (N)" según corresponda.
-- =============================================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS nominas_envio_obligatorio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresas.nominas_envio_obligatorio IS
  'Si true, fuerza el envío del recibo (WhatsApp/correo) antes de poder registrar el pago. Default false.';
