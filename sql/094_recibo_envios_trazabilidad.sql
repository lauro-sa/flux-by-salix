-- ──────────────────────────────────────────────────────────────────
-- Trazabilidad de envíos del recibo de nómina (correo y WhatsApp).
-- ──────────────────────────────────────────────────────────────────
--
-- Hasta acá el botón "Enviar recibo" mandaba el correo / WhatsApp sin
-- dejar huella en `pagos_nomina`. El operador no podía ver, al volver
-- al período, qué empleados ya habían recibido su recibo — riesgo
-- claro de mandar duplicados.
--
-- Este cambio agrega seis columnas que registran el ÚLTIMO envío
-- exitoso por canal (timestamp + destinatario + usuario que lo mandó).
-- Es información de "estado actual", no de historial completo: si el
-- operador re-envía, se sobreescribe el timestamp. El historial
-- detallado vive en la tabla `auditoria` (audit obligatorio en Flux).
--
-- Para WhatsApp el envío también queda en `conversaciones_empleado` ↔
-- `mensajes`; para correo no había nada — esta migración lo resuelve.

ALTER TABLE pagos_nomina
  ADD COLUMN IF NOT EXISTS recibo_correo_enviado_en timestamptz,
  ADD COLUMN IF NOT EXISTS recibo_correo_enviado_a text,
  ADD COLUMN IF NOT EXISTS recibo_correo_enviado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recibo_whatsapp_enviado_en timestamptz,
  ADD COLUMN IF NOT EXISTS recibo_whatsapp_enviado_a text,
  ADD COLUMN IF NOT EXISTS recibo_whatsapp_enviado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para localizar "qué se envió en este período" rápido en la lista
-- de liquidaciones (no tiene WHERE eliminado porque los pagos eliminados
-- igual aparecen en algunos reportes históricos).
CREATE INDEX IF NOT EXISTS pagos_nomina_recibo_enviado_idx
  ON pagos_nomina (empresa_id, fecha_inicio_periodo, fecha_fin_periodo)
  WHERE recibo_correo_enviado_en IS NOT NULL OR recibo_whatsapp_enviado_en IS NOT NULL;

COMMENT ON COLUMN pagos_nomina.recibo_correo_enviado_en IS
  'Timestamp del último envío exitoso del recibo por correo. NULL = nunca enviado por correo.';
COMMENT ON COLUMN pagos_nomina.recibo_correo_enviado_a IS
  'Dirección de correo a la que se envió el último recibo (snapshot del momento del envío).';
COMMENT ON COLUMN pagos_nomina.recibo_correo_enviado_por IS
  'Usuario que disparó el último envío por correo. FK a auth.users.';
COMMENT ON COLUMN pagos_nomina.recibo_whatsapp_enviado_en IS
  'Timestamp del último envío exitoso del recibo por WhatsApp.';
COMMENT ON COLUMN pagos_nomina.recibo_whatsapp_enviado_a IS
  'Teléfono (E.164) al que se envió el último recibo por WhatsApp.';
COMMENT ON COLUMN pagos_nomina.recibo_whatsapp_enviado_por IS
  'Usuario que disparó el último envío por WhatsApp. FK a auth.users.';
