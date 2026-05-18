-- ──────────────────────────────────────────────────────────────────
-- Enlaces públicos cortos para recibos de nómina (WhatsApp).
-- ──────────────────────────────────────────────────────────────────
--
-- ¿Por qué existe esta tabla?
-- Los signed URLs de Supabase Storage miden 800+ caracteres y se ven
-- horribles en WhatsApp ("https://nfbjdlmnsmcmtvimjeuo.supabase.co/
-- storage/v1/object/sign/comprobantes-pago/...?token=eyJraWQ...").
-- Esta tabla mapea un token corto (10 chars) a un `pago_nomina` para
-- que el WhatsApp lleve "flux.salixweb.com/r/aB3xK9Lm".
--
-- El flujo del lado del empleado:
--   1. Recibe el mensaje con el link corto.
--   2. Lo toca → la ruta /r/[token] busca el registro, valida vigencia
--      y genera un signed URL fresh contra Supabase Storage.
--   3. Redirect 302 al PDF (el signed URL se descarta tras el uso).
--
-- Auditoría: cada acceso incrementa `accesos_count` y actualiza
-- `ultimo_acceso_en`. Sirve para detectar abusos (un link compartido
-- masivamente) y para confirmar que el empleado abrió el recibo.
--
-- Multi-tenant: aunque el lookup público (sin auth) usa service role,
-- el `empresa_id` queda en el registro para auditoría y reportes.
-- RLS: solo lectura/escritura desde service role; el cliente nunca
-- accede directamente.

CREATE TABLE IF NOT EXISTS public.recibo_enlaces_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Token alfanumérico URL-safe de 10 chars (crypto.randomBytes).
  -- Cabe en ~62^10 = 8.4×10^17 combinaciones → colisiones imposibles
  -- en la práctica. Unique en toda la tabla (no por empresa) para que
  -- el lookup público sea un solo índice.
  token text NOT NULL UNIQUE,
  pago_id uuid NOT NULL REFERENCES public.pagos_nomina(id) ON DELETE CASCADE,
  miembro_id uuid REFERENCES public.miembros(id) ON DELETE SET NULL,
  -- Caducidad opcional: si NULL, no expira. Por defecto ponemos 90
  -- días desde la creación para evitar links eternos. Se renueva
  -- generando un nuevo enlace en el próximo envío.
  expira_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accesos_count int NOT NULL DEFAULT 0,
  ultimo_acceso_en timestamptz
);

-- Índice principal: lookup por token (ya está vía UNIQUE).
-- Índice secundario: buscar todos los enlaces de un pago (para
-- "reusar el último activo" en vez de generar uno nuevo cada envío).
CREATE INDEX IF NOT EXISTS idx_recibo_enlaces_pago
  ON public.recibo_enlaces_publicos (pago_id, creado_en DESC);

-- Índice para limpieza: borrar caducados en un cron futuro.
CREATE INDEX IF NOT EXISTS idx_recibo_enlaces_expira
  ON public.recibo_enlaces_publicos (expira_en)
  WHERE expira_en IS NOT NULL;

-- RLS: solo service role escribe/lee. El cliente nunca consulta esta
-- tabla directamente — la ruta pública /r/[token] usa el admin client.
ALTER TABLE public.recibo_enlaces_publicos ENABLE ROW LEVEL SECURITY;

-- Comentario para futuros desarrolladores.
COMMENT ON TABLE public.recibo_enlaces_publicos IS
  'Short links para recibos de nómina enviados por WhatsApp. Mapea un token de 10 chars al pago_id correspondiente. La ruta /r/[token] resuelve y redirige al signed URL de Storage.';
