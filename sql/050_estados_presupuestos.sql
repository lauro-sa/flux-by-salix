-- =============================================================
-- Migración 050: Estados configurables de presupuestos
-- =============================================================
-- Conecta presupuestos al sistema genérico (044). Sigue el patrón
-- estándar (cuotas/conversaciones/visitas/órdenes).
--
-- 8 estados reales en uso (verificado contra BD y src/tipos/presupuesto.ts):
--   borrador            → inicial
--   enviado             → activo
--   confirmado_cliente  → activo (cliente confirmó pero falta cargar comprobante)
--   orden_venta         → activo (con comprobante, pendiente de cobro completo)
--   completado          → completado (todas las cuotas pagadas)
--   rechazado           → cancelado (cliente rechazó)
--   vencido             → espera   (se venció la oferta, puede reabrirse)
--   cancelado           → cancelado
--
-- NOTA: el comentario viejo del schema decía "borrador, enviado,
-- aceptado, rechazado, vencido, cancelado" pero NO refleja la realidad.
-- 'aceptado' nunca se usó; en su lugar el flujo real es:
-- enviado → confirmado_cliente → orden_venta → completado.
-- Este comentario se corrige acá.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.estados_presupuesto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  clave text NOT NULL,
  etiqueta text NOT NULL,
  grupo text NOT NULL DEFAULT 'activo',
  icono text NOT NULL DEFAULT 'Circle',
  color text NOT NULL DEFAULT '#6b7280',
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  es_sistema boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estados_presupuesto_empresa_idx
  ON public.estados_presupuesto (empresa_id, clave) WHERE activo = true;
CREATE UNIQUE INDEX IF NOT EXISTS estados_presupuesto_unique_idx
  ON public.estados_presupuesto (COALESCE(empresa_id::text, '__sistema__'), clave);

ALTER TABLE public.estados_presupuesto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estados_presupuesto_select" ON public.estados_presupuesto
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());
CREATE POLICY "estados_presupuesto_insert" ON public.estados_presupuesto
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_presupuesto_update" ON public.estados_presupuesto
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_presupuesto_delete" ON public.estados_presupuesto
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);

INSERT INTO public.estados_presupuesto (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'borrador',           'Borrador',             'inicial',     'FilePen',     '#64748b', 1, true),
  (NULL, 'enviado',             'Enviado',              'activo',      'Send',        '#5b5bd6', 2, true),
  (NULL, 'confirmado_cliente',  'Confirmado',           'activo',      'CircleCheck', '#0891b2', 3, true),
  (NULL, 'orden_venta',         'Orden de venta',       'activo',      'ShoppingCart','#7c3aed', 4, true),
  (NULL, 'completado',          'Completado',           'completado',  'Check',       '#16a34a', 5, true),
  (NULL, 'vencido',             'Vencido',              'espera',      'Clock',       '#d97706', 6, true),
  (NULL, 'rechazado',           'Rechazado',            'cancelado',   'X',           '#dc2626', 7, true),
  (NULL, 'cancelado',           'Cancelado',            'cancelado',   'CircleSlash', '#dc2626', 8, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, requiere_motivo, orden)
VALUES
  -- Desde borrador
  (NULL, 'presupuesto', 'borrador',           'enviado',            'Enviar',                 false, false, 1),
  (NULL, 'presupuesto', 'borrador',           'cancelado',          'Cancelar',               false, true,  2),
  -- Desde enviado
  (NULL, 'presupuesto', 'enviado',            'confirmado_cliente', 'Marcar confirmado',      false, false, 3),
  (NULL, 'presupuesto', 'enviado',            'orden_venta',        'Convertir a orden venta',false, false, 4),
  (NULL, 'presupuesto', 'enviado',            'borrador',           'Volver a borrador',      false, true,  5),
  (NULL, 'presupuesto', 'enviado',            'rechazado',          'Marcar rechazado',       false, true,  6),
  (NULL, 'presupuesto', 'enviado',            'cancelado',          'Cancelar',               false, true,  7),
  (NULL, 'presupuesto', 'enviado',            'vencido',            'Marcar vencido',         true,  false, 8),
  -- Desde confirmado_cliente
  (NULL, 'presupuesto', 'confirmado_cliente', 'orden_venta',        'Convertir a orden venta',false, false, 9),
  (NULL, 'presupuesto', 'confirmado_cliente', 'enviado',            'Volver a enviado',       false, true, 10),
  (NULL, 'presupuesto', 'confirmado_cliente', 'cancelado',          'Cancelar',               false, true, 11),
  -- Desde orden_venta
  (NULL, 'presupuesto', 'orden_venta',        'completado',         'Marcar completado',      true,  false, 12),
  (NULL, 'presupuesto', 'orden_venta',        'confirmado_cliente', 'Volver',                 false, true, 13),
  (NULL, 'presupuesto', 'orden_venta',        'cancelado',          'Cancelar',               false, true, 14),
  -- Desde completado (auto-transición desde pagos cuando se elimina uno)
  (NULL, 'presupuesto', 'completado',         'orden_venta',        'Reabrir',                true,  false, 15),
  (NULL, 'presupuesto', 'completado',         'cancelado',          'Cancelar',               false, true, 16),
  -- Desde vencido
  (NULL, 'presupuesto', 'vencido',            'borrador',           'Volver a borrador',      false, false, 17),
  (NULL, 'presupuesto', 'vencido',            'cancelado',          'Cancelar',               false, true, 18),
  -- Desde rechazado
  (NULL, 'presupuesto', 'rechazado',          'borrador',           'Volver a borrador',      false, false, 19),
  (NULL, 'presupuesto', 'rechazado',          'cancelado',          'Cancelar',               false, true, 20),
  -- Desde cancelado (reactivar)
  (NULL, 'presupuesto', 'cancelado',          'borrador',           'Reactivar',              false, false, 21)
ON CONFLICT DO NOTHING;

ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS estado_id          uuid REFERENCES public.estados_presupuesto(id),
  ADD COLUMN IF NOT EXISTS estado_clave       text,
  ADD COLUMN IF NOT EXISTS estado_anterior_id uuid REFERENCES public.estados_presupuesto(id),
  ADD COLUMN IF NOT EXISTS estado_cambio_at   timestamptz;

CREATE INDEX IF NOT EXISTS presupuestos_estado_clave_idx
  ON public.presupuestos (empresa_id, estado_clave);

-- Backfill
UPDATE public.presupuestos p
SET
  estado_clave = p.estado,
  estado_id = (
    SELECT ep.id FROM public.estados_presupuesto ep
    WHERE ep.clave = p.estado AND ep.empresa_id IS NULL
    LIMIT 1
  ),
  estado_cambio_at = p.actualizado_en
WHERE p.estado_clave IS NULL OR p.estado_id IS NULL;

CREATE OR REPLACE FUNCTION public.resolver_estado_presupuesto_id(
  p_empresa_id uuid,
  p_clave text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.estados_presupuesto
  WHERE clave = p_clave AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_estado_presupuesto_id(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_estado_presupuesto_id(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tr_presupuestos_sincronizar_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_clave text;
  v_id_resuelto uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_clave := COALESCE(NEW.estado_clave, NEW.estado);
  ELSE
    IF NEW.estado_clave IS DISTINCT FROM OLD.estado_clave THEN
      v_clave := NEW.estado_clave;
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
      v_clave := NEW.estado;
    ELSE
      v_clave := COALESCE(NEW.estado_clave, NEW.estado);
    END IF;
  END IF;

  NEW.estado_clave := v_clave;
  NEW.estado := v_clave;

  v_id_resuelto := public.resolver_estado_presupuesto_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_presupuestos_sincronizar_estado: clave de estado inválida: %', v_clave;
  END IF;
  NEW.estado_id := v_id_resuelto;

  IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS presupuestos_sincronizar_estado ON public.presupuestos;
CREATE TRIGGER presupuestos_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.tr_presupuestos_sincronizar_estado();

CREATE OR REPLACE FUNCTION public.tr_presupuestos_registrar_cambio_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_grupo_anterior text;
  v_grupo_nuevo text;
  v_usuario_id uuid;
  v_usuario_nombre text;
  v_origen text;
BEGIN
  IF NEW.estado_clave IS NOT DISTINCT FROM OLD.estado_clave THEN
    RETURN NEW;
  END IF;

  SELECT grupo INTO v_grupo_anterior FROM public.estados_presupuesto WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_presupuesto WHERE id = NEW.estado_id;

  BEGIN
    v_usuario_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  IF v_usuario_id IS NOT NULL THEN
    v_origen := 'manual';
    SELECT trim(coalesce(nombre,'') || ' ' || coalesce(apellido,''))
    INTO v_usuario_nombre
    FROM public.perfiles WHERE id = v_usuario_id;
  ELSE
    v_origen := 'sistema';
  END IF;

  PERFORM public.registrar_cambio_estado(
    p_empresa_id      => NEW.empresa_id,
    p_entidad_tipo    => 'presupuesto',
    p_entidad_id      => NEW.id,
    p_estado_anterior => OLD.estado_clave,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => v_grupo_anterior,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => v_origen,
    p_usuario_id      => v_usuario_id,
    p_usuario_nombre  => NULLIF(v_usuario_nombre, ''),
    p_metadatos       => jsonb_build_object(
      'numero',       NEW.numero,
      'contacto_id',  NEW.contacto_id,
      'total_final',  NEW.total_final
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS presupuestos_registrar_cambio_estado ON public.presupuestos;
CREATE TRIGGER presupuestos_registrar_cambio_estado
  AFTER UPDATE ON public.presupuestos
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_presupuestos_registrar_cambio_estado();

CREATE OR REPLACE FUNCTION public.tr_estados_presupuesto_actualizar_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estados_presupuesto_actualizar_timestamp ON public.estados_presupuesto;
CREATE TRIGGER estados_presupuesto_actualizar_timestamp
  BEFORE UPDATE ON public.estados_presupuesto
  FOR EACH ROW EXECUTE FUNCTION public.tr_estados_presupuesto_actualizar_timestamp();

COMMENT ON TABLE public.estados_presupuesto IS
  'Estados configurables de presupuestos. empresa_id NULL = sistema. Estados reales: borrador, enviado, confirmado_cliente, orden_venta, completado, vencido, rechazado, cancelado.';
COMMENT ON COLUMN public.presupuestos.estado IS
  'Legacy text. Sincronizado con estado_clave vía trigger.';
COMMENT ON COLUMN public.presupuestos.estado_clave IS
  'Source of truth a futuro.';
