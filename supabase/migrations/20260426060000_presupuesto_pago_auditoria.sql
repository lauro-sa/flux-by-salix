-- Auditoría inmutable de cambios sobre presupuesto_pagos para trazabilidad
-- fiscal y reconciliación contable. Cada INSERT/UPDATE/DELETE genera una fila.
--
-- Para Contaduría: permite reconstruir cualquier pago en cualquier momento del
-- pasado, ver qué cambió y quién lo cambió. No reemplaza el chatter (que es
-- narrativo), sino que es el log estructurado de bajo nivel.

CREATE TABLE IF NOT EXISTS presupuesto_pago_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  -- pago_id NO usa FK: queremos conservar el rastro aunque se elimine el pago.
  pago_id uuid NOT NULL,
  presupuesto_id uuid NOT NULL,
  accion text NOT NULL CHECK (accion IN ('insert', 'update', 'delete')),
  -- Snapshots completos: en INSERT solo `nuevo`, en UPDATE ambos, en DELETE solo `anterior`.
  pago_anterior jsonb,
  pago_nuevo jsonb,
  -- Usuario que ejecutó la acción. Capturado del JWT cuando hay sesión; NULL
  -- si fue una operación service_role (ej. backfill).
  usuario_id uuid,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presupuesto_pago_auditoria_empresa_idx
  ON presupuesto_pago_auditoria(empresa_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS presupuesto_pago_auditoria_pago_idx
  ON presupuesto_pago_auditoria(pago_id);
CREATE INDEX IF NOT EXISTS presupuesto_pago_auditoria_presupuesto_idx
  ON presupuesto_pago_auditoria(presupuesto_id);

ALTER TABLE presupuesto_pago_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_presupuesto_pago_auditoria_empresa ON presupuesto_pago_auditoria;
CREATE POLICY rls_presupuesto_pago_auditoria_empresa ON presupuesto_pago_auditoria
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- Función que captura el cambio. Extrae el usuario del JWT (auth.uid())
-- cuando hay sesión; NULL si la operación viene de service_role.
CREATE OR REPLACE FUNCTION public.registrar_auditoria_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_usuario_id uuid;
BEGIN
  -- auth.uid() devuelve NULL en contexto service_role; eso es lo esperado.
  BEGIN
    v_usuario_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.presupuesto_pago_auditoria
      (empresa_id, pago_id, presupuesto_id, accion, pago_nuevo, usuario_id)
    VALUES
      (NEW.empresa_id, NEW.id, NEW.presupuesto_id, 'insert', to_jsonb(NEW), v_usuario_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo registramos si algo cambió realmente (evita ruido por updates noop).
    IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
      INSERT INTO public.presupuesto_pago_auditoria
        (empresa_id, pago_id, presupuesto_id, accion, pago_anterior, pago_nuevo, usuario_id)
      VALUES
        (NEW.empresa_id, NEW.id, NEW.presupuesto_id, 'update', to_jsonb(OLD), to_jsonb(NEW), v_usuario_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.presupuesto_pago_auditoria
      (empresa_id, pago_id, presupuesto_id, accion, pago_anterior, usuario_id)
    VALUES
      (OLD.empresa_id, OLD.id, OLD.presupuesto_id, 'delete', to_jsonb(OLD), v_usuario_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_presupuesto_pago_auditoria ON presupuesto_pagos;
CREATE TRIGGER trg_presupuesto_pago_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON presupuesto_pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_auditoria_pago();
