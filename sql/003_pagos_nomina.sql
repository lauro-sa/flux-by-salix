-- =============================================================
-- Migración: Sistema de Pagos / Nómina
-- Agrega campos de compensación a miembros + tabla pagos_nomina
-- =============================================================

-- 1. Campos de compensación en miembros (si no existen)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'miembros' AND column_name = 'compensacion_tipo') THEN
    ALTER TABLE public.miembros
      ADD COLUMN compensacion_tipo text DEFAULT 'fijo',
      ADD COLUMN compensacion_monto numeric DEFAULT 0,
      ADD COLUMN compensacion_frecuencia text DEFAULT 'mensual',
      ADD COLUMN dias_trabajo integer DEFAULT 5;
  END IF;
END $$;

-- 2. Tabla de pagos de nómina
CREATE TABLE IF NOT EXISTS public.pagos_nomina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  miembro_id uuid NOT NULL REFERENCES public.miembros(id) ON DELETE CASCADE,

  -- Período
  fecha_inicio_periodo date NOT NULL,
  fecha_fin_periodo date NOT NULL,
  concepto text NOT NULL,

  -- Montos
  monto_sugerido numeric NOT NULL DEFAULT 0,
  monto_abonado numeric NOT NULL DEFAULT 0,

  -- Estadísticas del período (snapshot al momento del registro)
  dias_habiles integer NOT NULL DEFAULT 0,
  dias_trabajados integer NOT NULL DEFAULT 0,
  dias_ausentes integer NOT NULL DEFAULT 0,
  tardanzas integer NOT NULL DEFAULT 0,

  -- Comprobante
  comprobante_url text,

  -- Notas
  notas text,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_por_nombre text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  editado_por uuid,
  editado_en timestamptz,

  -- Soft delete
  eliminado boolean NOT NULL DEFAULT false,
  eliminado_en timestamptz,
  eliminado_por uuid
);

-- Índices
CREATE INDEX IF NOT EXISTS pagos_nomina_empresa_idx ON public.pagos_nomina(empresa_id);
CREATE INDEX IF NOT EXISTS pagos_nomina_miembro_idx ON public.pagos_nomina(miembro_id);
CREATE INDEX IF NOT EXISTS pagos_nomina_periodo_idx ON public.pagos_nomina(empresa_id, miembro_id, fecha_inicio_periodo DESC);

-- 3. RLS para pagos_nomina
ALTER TABLE public.pagos_nomina ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro de la empresa puede ver pagos
-- (la restricción ver_propio vs ver_todos se maneja en la app)
CREATE POLICY "pagos_nomina_select" ON public.pagos_nomina
  FOR SELECT USING (empresa_id = empresa_actual());

-- Insertar: solo admin+
CREATE POLICY "pagos_nomina_insert" ON public.pagos_nomina
  FOR INSERT WITH CHECK (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

-- Actualizar: solo admin+
CREATE POLICY "pagos_nomina_update" ON public.pagos_nomina
  FOR UPDATE USING (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

-- Eliminar: solo propietario
CREATE POLICY "pagos_nomina_delete" ON public.pagos_nomina
  FOR DELETE USING (
    empresa_id = empresa_actual()
    AND rol_actual() = 'propietario'
  );

-- 4. Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes-pago', 'comprobantes-pago', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-usuario', 'documentos-usuario', false)
  ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: solo miembros autenticados de la empresa pueden subir/ver
CREATE POLICY "comprobantes_pago_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'comprobantes-pago' AND auth.role() = 'authenticated');

CREATE POLICY "comprobantes_pago_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'comprobantes-pago' AND auth.role() = 'authenticated');

CREATE POLICY "documentos_usuario_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documentos-usuario' AND auth.role() = 'authenticated');

CREATE POLICY "documentos_usuario_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'documentos-usuario' AND auth.role() = 'authenticated');

CREATE POLICY "documentos_usuario_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documentos-usuario' AND auth.role() = 'authenticated');
