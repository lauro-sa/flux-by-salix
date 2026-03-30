-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  019 — Portal: acciones del cliente (firma, rechazo, chat)    ║
-- ║  Agrega campos para persistir estado, firma, mensajes y       ║
-- ║  comprobantes de pago en portal_tokens.                       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ── Estado del cliente en el portal ──────────────────────────────
-- pendiente → visto → aceptado | rechazado
-- cancelado = el cliente revirtió su aceptación
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS estado_cliente text NOT NULL DEFAULT 'pendiente';

-- ── Firma digital ───────────────────────────────────────────────
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS firma_url text;
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS firma_nombre text;
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS firma_modo text; -- 'auto' | 'dibujar' | 'subir'
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS firma_metadata jsonb; -- IP, user-agent, geo, timestamp

-- ── Fechas de acción ────────────────────────────────────────────
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS aceptado_en timestamptz;
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS rechazado_en timestamptz;

-- ── Rechazo ─────────────────────────────────────────────────────
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS motivo_rechazo text;

-- ── Mensajes (chat embebido, JSON array) ────────────────────────
-- Cada mensaje: { id, autor: 'cliente'|'vendedor', autor_nombre, contenido, creado_en }
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS mensajes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── Comprobantes de pago (JSON array) ───────────────────────────
-- Cada comprobante: { id, url, nombre_archivo, tipo, cuota_id, monto, creado_en, estado: 'pendiente'|'confirmado'|'rechazado' }
ALTER TABLE portal_tokens ADD COLUMN IF NOT EXISTS comprobantes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Índice para filtrar por estado del cliente
CREATE INDEX IF NOT EXISTS portal_tokens_estado_cliente_idx ON portal_tokens(estado_cliente);
