-- ──────────────────────────────────────────────────────────────────
-- Hash del PDF del recibo para evitar regenerarlo sin cambios.
-- ──────────────────────────────────────────────────────────────────
--
-- Hoy `GET /api/nominas/pagos/[id]/pdf` regenera el PDF con
-- Puppeteer en CADA llamada — costoso (varios segundos por pago) e
-- innecesario cuando los datos no cambiaron. Agregamos un hash de
-- los inputs (snapshot del contrato, conceptos aplicados, datos del
-- cobro, etc.) que se calcula al generar y se compara en próximas
-- llamadas:
--
--   • Mismo hash + archivo en Storage → solo emitir nueva signed URL.
--   • Hash distinto o archivo ausente → regenerar.
--
-- Esto reduce CPU del servidor (Puppeteer no corre), latencia (la
-- URL firmada es ~100ms vs ~3-5s del Puppeteer) y costo (en Vercel,
-- la función serverless termina mucho más rápido).

ALTER TABLE pagos_nomina
  ADD COLUMN IF NOT EXISTS comprobante_hash text,
  ADD COLUMN IF NOT EXISTS comprobante_path text;

COMMENT ON COLUMN pagos_nomina.comprobante_hash IS
  'Hash SHA-256 (hex, 64 chars) de los inputs del PDF. Si coincide en una nueva llamada, el PDF cacheado en Storage sigue siendo válido y no se regenera.';
COMMENT ON COLUMN pagos_nomina.comprobante_path IS
  'Path del PDF en el bucket comprobantes-pago. Lo guardamos por separado de comprobante_url (que es la URL firmada con expiración) para poder firmar nuevas URLs sin re-hacer el path.';
