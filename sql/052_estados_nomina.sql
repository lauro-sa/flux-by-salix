-- =============================================================
-- Migración 052: Estados configurables de nómina
-- =============================================================
-- Conecta adelantos_nomina y pagos_nomina al sistema genérico (044).
-- Esta migración cubre los casos de uso de automatización del usuario:
--   • "Cuando se le paga al empleado, mandar plantilla WhatsApp"
--   • "Cuando termina de descontarse un adelanto, notificar al empleado"
--
-- adelantos_nomina YA tenía columna `estado` con 4 valores:
--   pendiente | activo | pagado | cancelado
--
-- pagos_nomina NO tenía columna estado (la creación = el evento).
-- Se agrega columna `estado` con default 'pagado' para uniformizar
-- el modelo y permitir que el motor de workflows reaccione a la
-- transición NULL → pagado vía el trigger AFTER UPDATE estándar.
-- En el futuro pueden sumarse estados (programado, fallido, etc.).
-- =============================================================

-- ─── 1) Tabla estados_adelanto_nomina ─────────────────────────
CREATE TABLE IF NOT EXISTS public.estados_adelanto_nomina (
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

CREATE INDEX IF NOT EXISTS estados_adelanto_nomina_empresa_idx
  ON public.estados_adelanto_nomina (empresa_id, clave) WHERE activo = true;
CREATE UNIQUE INDEX IF NOT EXISTS estados_adelanto_nomina_unique_idx
  ON public.estados_adelanto_nomina (COALESCE(empresa_id::text, '__sistema__'), clave);

ALTER TABLE public.estados_adelanto_nomina ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estados_adelanto_nomina_select" ON public.estados_adelanto_nomina
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());
CREATE POLICY "estados_adelanto_nomina_insert" ON public.estados_adelanto_nomina
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_adelanto_nomina_update" ON public.estados_adelanto_nomina
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_adelanto_nomina_delete" ON public.estados_adelanto_nomina
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);

INSERT INTO public.estados_adelanto_nomina (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'pendiente',  'Pendiente',  'inicial',     'Hourglass',     '#64748b', 1, true),
  (NULL, 'activo',     'Activo',     'activo',      'PiggyBank',     '#0891b2', 2, true),
  (NULL, 'pagado',     'Pagado',     'completado',  'CircleCheck',   '#16a34a', 3, true),
  (NULL, 'cancelado',  'Cancelado',  'cancelado',   'CircleSlash',   '#dc2626', 4, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, requiere_motivo, orden)
VALUES
  (NULL, 'adelanto_nomina', 'pendiente', 'activo',    'Aprobar',         false, false, 1),
  (NULL, 'adelanto_nomina', 'pendiente', 'cancelado', 'Rechazar',        false, true,  2),
  (NULL, 'adelanto_nomina', 'activo',    'pagado',    'Marcar pagado',   true,  false, 3),
  (NULL, 'adelanto_nomina', 'activo',    'cancelado', 'Cancelar',        false, true,  4),
  (NULL, 'adelanto_nomina', 'cancelado', 'activo',    'Reactivar',       false, false, 5)
ON CONFLICT DO NOTHING;


-- ─── 2) Tabla estados_pago_nomina ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.estados_pago_nomina (
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

CREATE INDEX IF NOT EXISTS estados_pago_nomina_empresa_idx
  ON public.estados_pago_nomina (empresa_id, clave) WHERE activo = true;
CREATE UNIQUE INDEX IF NOT EXISTS estados_pago_nomina_unique_idx
  ON public.estados_pago_nomina (COALESCE(empresa_id::text, '__sistema__'), clave);

ALTER TABLE public.estados_pago_nomina ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estados_pago_nomina_select" ON public.estados_pago_nomina
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());
CREATE POLICY "estados_pago_nomina_insert" ON public.estados_pago_nomina
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_pago_nomina_update" ON public.estados_pago_nomina
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_pago_nomina_delete" ON public.estados_pago_nomina
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);

-- Estados de pago_nomina: hoy solo `pagado` (el INSERT mismo es el evento).
-- Se siembran también `programado` y `fallido` como estados disponibles
-- para que las empresas puedan agregarlos al flujo si lo necesitan.
INSERT INTO public.estados_pago_nomina (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'programado', 'Programado', 'inicial',     'Calendar',    '#64748b', 1, true),
  (NULL, 'pagado',     'Pagado',     'completado',  'CircleCheck', '#16a34a', 2, true),
  (NULL, 'fallido',    'Fallido',    'error',       'AlertCircle', '#dc2626', 3, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, requiere_motivo, orden)
VALUES
  (NULL, 'pago_nomina', 'programado', 'pagado',     'Marcar pagado',  false, false, 1),
  (NULL, 'pago_nomina', 'programado', 'fallido',    'Marcar fallido', false, true,  2),
  (NULL, 'pago_nomina', 'fallido',    'pagado',     'Reintentar',     false, false, 3),
  (NULL, 'pago_nomina', 'pagado',     'fallido',    'Marcar fallido', false, true,  4)
ON CONFLICT DO NOTHING;


-- ─── 3) Columnas en adelantos_nomina ──────────────────────────
ALTER TABLE public.adelantos_nomina
  ADD COLUMN IF NOT EXISTS estado_id          uuid REFERENCES public.estados_adelanto_nomina(id),
  ADD COLUMN IF NOT EXISTS estado_clave       text,
  ADD COLUMN IF NOT EXISTS estado_anterior_id uuid REFERENCES public.estados_adelanto_nomina(id),
  ADD COLUMN IF NOT EXISTS estado_cambio_at   timestamptz;

CREATE INDEX IF NOT EXISTS adelantos_nomina_estado_clave_idx
  ON public.adelantos_nomina (empresa_id, estado_clave);

UPDATE public.adelantos_nomina a
SET
  estado_clave = a.estado,
  estado_id = (
    SELECT e.id FROM public.estados_adelanto_nomina e
    WHERE e.clave = a.estado AND e.empresa_id IS NULL LIMIT 1
  ),
  estado_cambio_at = COALESCE(a.editado_en, a.creado_en)
WHERE a.estado_clave IS NULL OR a.estado_id IS NULL;


-- ─── 4) Columnas en pagos_nomina ──────────────────────────────
ALTER TABLE public.pagos_nomina
  ADD COLUMN IF NOT EXISTS estado             text NOT NULL DEFAULT 'pagado',
  ADD COLUMN IF NOT EXISTS estado_id          uuid REFERENCES public.estados_pago_nomina(id),
  ADD COLUMN IF NOT EXISTS estado_clave       text,
  ADD COLUMN IF NOT EXISTS estado_anterior_id uuid REFERENCES public.estados_pago_nomina(id),
  ADD COLUMN IF NOT EXISTS estado_cambio_at   timestamptz;

CREATE INDEX IF NOT EXISTS pagos_nomina_estado_clave_idx
  ON public.pagos_nomina (empresa_id, estado_clave);

UPDATE public.pagos_nomina p
SET
  estado_clave = p.estado,
  estado_id = (
    SELECT e.id FROM public.estados_pago_nomina e
    WHERE e.clave = p.estado AND e.empresa_id IS NULL LIMIT 1
  ),
  estado_cambio_at = COALESCE(p.editado_en, p.creado_en)
WHERE p.estado_clave IS NULL OR p.estado_id IS NULL;


-- ─── 5) Helpers resolver ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolver_estado_adelanto_nomina_id(
  p_empresa_id uuid, p_clave text
) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.estados_adelanto_nomina
  WHERE clave = p_clave AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.resolver_estado_adelanto_nomina_id(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_estado_adelanto_nomina_id(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolver_estado_pago_nomina_id(
  p_empresa_id uuid, p_clave text
) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.estados_pago_nomina
  WHERE clave = p_clave AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.resolver_estado_pago_nomina_id(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_estado_pago_nomina_id(uuid, text) TO authenticated, service_role;


-- ─── 6) Triggers de adelantos_nomina ──────────────────────────
CREATE OR REPLACE FUNCTION public.tr_adelantos_nomina_sincronizar_estado()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_clave text; v_id_resuelto uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_clave := COALESCE(NEW.estado_clave, NEW.estado);
  ELSE
    IF NEW.estado_clave IS DISTINCT FROM OLD.estado_clave THEN v_clave := NEW.estado_clave;
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN v_clave := NEW.estado;
    ELSE v_clave := COALESCE(NEW.estado_clave, NEW.estado);
    END IF;
  END IF;
  NEW.estado_clave := v_clave;
  NEW.estado := v_clave;
  v_id_resuelto := public.resolver_estado_adelanto_nomina_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_adelantos_nomina_sincronizar_estado: clave inválida: %', v_clave;
  END IF;
  NEW.estado_id := v_id_resuelto;
  IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS adelantos_nomina_sincronizar_estado ON public.adelantos_nomina;
CREATE TRIGGER adelantos_nomina_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.adelantos_nomina
  FOR EACH ROW EXECUTE FUNCTION public.tr_adelantos_nomina_sincronizar_estado();

CREATE OR REPLACE FUNCTION public.tr_adelantos_nomina_registrar_cambio_estado()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_grupo_anterior text; v_grupo_nuevo text;
  v_usuario_id uuid; v_usuario_nombre text; v_origen text;
BEGIN
  IF NEW.estado_clave IS NOT DISTINCT FROM OLD.estado_clave THEN RETURN NEW; END IF;
  SELECT grupo INTO v_grupo_anterior FROM public.estados_adelanto_nomina WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_adelanto_nomina WHERE id = NEW.estado_id;
  BEGIN v_usuario_id := auth.uid(); EXCEPTION WHEN OTHERS THEN v_usuario_id := NULL; END;
  IF v_usuario_id IS NOT NULL THEN
    v_origen := 'manual';
    SELECT trim(coalesce(nombre,'') || ' ' || coalesce(apellido,''))
    INTO v_usuario_nombre FROM public.perfiles WHERE id = v_usuario_id;
  ELSE v_origen := 'sistema';
  END IF;
  PERFORM public.registrar_cambio_estado(
    p_empresa_id => NEW.empresa_id, p_entidad_tipo => 'adelanto_nomina', p_entidad_id => NEW.id,
    p_estado_anterior => OLD.estado_clave, p_estado_nuevo => NEW.estado_clave,
    p_grupo_anterior => v_grupo_anterior, p_grupo_nuevo => v_grupo_nuevo,
    p_origen => v_origen, p_usuario_id => v_usuario_id,
    p_usuario_nombre => NULLIF(v_usuario_nombre, ''),
    p_metadatos => jsonb_build_object(
      'miembro_id', NEW.miembro_id, 'tipo', NEW.tipo,
      'monto_total', NEW.monto_total, 'saldo_pendiente', NEW.saldo_pendiente
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS adelantos_nomina_registrar_cambio_estado ON public.adelantos_nomina;
CREATE TRIGGER adelantos_nomina_registrar_cambio_estado
  AFTER UPDATE ON public.adelantos_nomina
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_adelantos_nomina_registrar_cambio_estado();


-- ─── 7) Triggers de pagos_nomina ──────────────────────────────
CREATE OR REPLACE FUNCTION public.tr_pagos_nomina_sincronizar_estado()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_clave text; v_id_resuelto uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_clave := COALESCE(NEW.estado_clave, NEW.estado, 'pagado');
  ELSE
    IF NEW.estado_clave IS DISTINCT FROM OLD.estado_clave THEN v_clave := NEW.estado_clave;
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN v_clave := NEW.estado;
    ELSE v_clave := COALESCE(NEW.estado_clave, NEW.estado);
    END IF;
  END IF;
  NEW.estado_clave := v_clave;
  NEW.estado := v_clave;
  v_id_resuelto := public.resolver_estado_pago_nomina_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_pagos_nomina_sincronizar_estado: clave inválida: %', v_clave;
  END IF;
  NEW.estado_id := v_id_resuelto;
  IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pagos_nomina_sincronizar_estado ON public.pagos_nomina;
CREATE TRIGGER pagos_nomina_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.pagos_nomina
  FOR EACH ROW EXECUTE FUNCTION public.tr_pagos_nomina_sincronizar_estado();

-- Trigger AFTER INSERT también (no solo UPDATE) porque la creación
-- del pago ES el evento principal "se le pagó al empleado".
CREATE OR REPLACE FUNCTION public.tr_pagos_nomina_registrar_cambio_estado()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_grupo_nuevo text; v_grupo_anterior text;
  v_usuario_id uuid; v_usuario_nombre text; v_origen text;
  v_estado_anterior text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_estado_anterior := NULL;
  ELSE
    IF NEW.estado_clave IS NOT DISTINCT FROM OLD.estado_clave THEN RETURN NEW; END IF;
    v_estado_anterior := OLD.estado_clave;
    SELECT grupo INTO v_grupo_anterior FROM public.estados_pago_nomina WHERE id = OLD.estado_id;
  END IF;
  SELECT grupo INTO v_grupo_nuevo FROM public.estados_pago_nomina WHERE id = NEW.estado_id;
  BEGIN v_usuario_id := auth.uid(); EXCEPTION WHEN OTHERS THEN v_usuario_id := NULL; END;
  IF v_usuario_id IS NOT NULL THEN
    v_origen := 'manual';
    SELECT trim(coalesce(nombre,'') || ' ' || coalesce(apellido,''))
    INTO v_usuario_nombre FROM public.perfiles WHERE id = v_usuario_id;
  ELSE v_origen := 'sistema';
  END IF;
  PERFORM public.registrar_cambio_estado(
    p_empresa_id => NEW.empresa_id, p_entidad_tipo => 'pago_nomina', p_entidad_id => NEW.id,
    p_estado_anterior => v_estado_anterior, p_estado_nuevo => NEW.estado_clave,
    p_grupo_anterior => v_grupo_anterior, p_grupo_nuevo => v_grupo_nuevo,
    p_origen => v_origen, p_usuario_id => v_usuario_id,
    p_usuario_nombre => NULLIF(v_usuario_nombre, ''),
    p_metadatos => jsonb_build_object(
      'miembro_id', NEW.miembro_id, 'concepto', NEW.concepto,
      'monto_abonado', NEW.monto_abonado,
      'fecha_inicio_periodo', NEW.fecha_inicio_periodo,
      'fecha_fin_periodo', NEW.fecha_fin_periodo
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pagos_nomina_registrar_cambio_estado ON public.pagos_nomina;
CREATE TRIGGER pagos_nomina_registrar_cambio_estado
  AFTER INSERT OR UPDATE ON public.pagos_nomina
  FOR EACH ROW
  WHEN (
    TG_OP = 'INSERT' OR
    (TG_OP = 'UPDATE' AND OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  )
  EXECUTE FUNCTION public.tr_pagos_nomina_registrar_cambio_estado();


-- ─── 8) Triggers actualizado_en de las tablas configurables ───
CREATE OR REPLACE FUNCTION public.tr_estados_adelanto_nomina_actualizar_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.actualizado_en := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS estados_adelanto_nomina_actualizar_timestamp ON public.estados_adelanto_nomina;
CREATE TRIGGER estados_adelanto_nomina_actualizar_timestamp
  BEFORE UPDATE ON public.estados_adelanto_nomina
  FOR EACH ROW EXECUTE FUNCTION public.tr_estados_adelanto_nomina_actualizar_timestamp();

CREATE OR REPLACE FUNCTION public.tr_estados_pago_nomina_actualizar_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.actualizado_en := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS estados_pago_nomina_actualizar_timestamp ON public.estados_pago_nomina;
CREATE TRIGGER estados_pago_nomina_actualizar_timestamp
  BEFORE UPDATE ON public.estados_pago_nomina
  FOR EACH ROW EXECUTE FUNCTION public.tr_estados_pago_nomina_actualizar_timestamp();


COMMENT ON TABLE public.estados_adelanto_nomina IS
  'Estados configurables de adelantos de nómina. 4 estados: pendiente/activo/pagado/cancelado.';
COMMENT ON TABLE public.estados_pago_nomina IS
  'Estados configurables de pagos de nómina. Por defecto solo pagado (la creación es el evento). Estados extra disponibles: programado, fallido.';
COMMENT ON COLUMN public.pagos_nomina.estado IS
  'Estado del pago. Default pagado (la creación = el evento). Sincronizado con estado_clave vía trigger.';
