-- =============================================================
-- Migración: Sistema de Presupuestos para Flux by Salix
-- Tablas: presupuestos, lineas_presupuesto, presupuesto_historial,
--         presupuesto_cuotas, config_presupuestos
-- =============================================================

-- =============================================================
-- 1. PRESUPUESTOS (tabla principal)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero text NOT NULL,
  estado text NOT NULL DEFAULT 'borrador',

  -- Contacto vinculado (snapshot al crear)
  contacto_id uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  contacto_nombre text,
  contacto_apellido text,
  contacto_tipo text,
  contacto_identificacion text,
  contacto_condicion_iva text,
  contacto_direccion text,
  contacto_correo text,
  contacto_telefono text,

  -- Dirigido a (persona de contacto dentro de empresa)
  atencion_contacto_id uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  atencion_nombre text,
  atencion_correo text,
  atencion_cargo text,

  -- Referencia interna
  referencia text,

  -- Moneda y condiciones de pago
  moneda text NOT NULL DEFAULT 'ARS',
  cotizacion_cambio numeric DEFAULT 1,
  condicion_pago_id text,
  condicion_pago_label text,
  condicion_pago_tipo text,

  -- Fechas
  fecha_emision timestamptz NOT NULL DEFAULT now(),
  dias_vencimiento integer NOT NULL DEFAULT 30,
  fecha_vencimiento timestamptz,

  -- Totales
  subtotal_neto numeric NOT NULL DEFAULT 0,
  total_impuestos numeric NOT NULL DEFAULT 0,
  descuento_global numeric NOT NULL DEFAULT 0,
  descuento_global_monto numeric NOT NULL DEFAULT 0,
  total_final numeric NOT NULL DEFAULT 0,

  -- Columnas visibles en tabla de líneas
  columnas_lineas jsonb DEFAULT '["producto","descripcion","cantidad","unidad","precio_unitario","descuento","impuesto","subtotal"]',

  -- Notas y condiciones (HTML)
  notas_html text,
  condiciones_html text,
  nota_plan_pago text,

  -- PDF
  pdf_url text,
  pdf_miniatura_url text,
  pdf_storage_path text,
  pdf_generado_en timestamptz,

  -- Vinculación con documento origen
  origen_documento_id uuid,
  origen_documento_numero text,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_por_nombre text,
  editado_por uuid,
  editado_por_nombre text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  -- Soft delete
  activo boolean NOT NULL DEFAULT true,
  en_papelera boolean NOT NULL DEFAULT false,
  papelera_en timestamptz,

  -- Búsqueda full-text
  busqueda tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(numero, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(contacto_nombre, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(contacto_apellido, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(referencia, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(contacto_correo, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(contacto_identificacion, '')), 'B')
  ) STORED,

  UNIQUE(empresa_id, numero)
);

-- Índices
CREATE INDEX IF NOT EXISTS presupuestos_empresa_idx ON public.presupuestos(empresa_id);
CREATE INDEX IF NOT EXISTS presupuestos_contacto_idx ON public.presupuestos(contacto_id);
CREATE INDEX IF NOT EXISTS presupuestos_estado_idx ON public.presupuestos(empresa_id, estado);
CREATE INDEX IF NOT EXISTS presupuestos_fecha_idx ON public.presupuestos(empresa_id, fecha_emision);
CREATE INDEX IF NOT EXISTS presupuestos_busqueda_idx ON public.presupuestos USING gin(busqueda);
CREATE INDEX IF NOT EXISTS presupuestos_papelera_idx ON public.presupuestos(empresa_id) WHERE en_papelera = false;

-- RLS
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuestos_select" ON public.presupuestos
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "presupuestos_insert" ON public.presupuestos
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "presupuestos_update" ON public.presupuestos
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "presupuestos_delete" ON public.presupuestos
  FOR DELETE USING (empresa_id = empresa_actual());


-- =============================================================
-- 2. LÍNEAS DE PRESUPUESTO
-- Tipos: producto (calculable), seccion (separador visual),
--        nota (texto libre), descuento (monto fijo)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.lineas_presupuesto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  tipo_linea text NOT NULL DEFAULT 'producto',
  orden integer NOT NULL DEFAULT 0,

  -- Datos del producto/servicio
  codigo_producto text,
  descripcion text,
  descripcion_detalle text,
  cantidad numeric DEFAULT 1,
  unidad text,
  precio_unitario numeric DEFAULT 0,
  descuento numeric DEFAULT 0,
  impuesto_label text,
  impuesto_porcentaje numeric DEFAULT 0,

  -- Calculados
  subtotal numeric DEFAULT 0,
  impuesto_monto numeric DEFAULT 0,
  total numeric DEFAULT 0,

  -- Para tipo descuento (monto fijo)
  monto numeric,

  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lineas_presupuesto_presupuesto_idx ON public.lineas_presupuesto(presupuesto_id);
CREATE INDEX IF NOT EXISTS lineas_presupuesto_empresa_idx ON public.lineas_presupuesto(empresa_id);
CREATE INDEX IF NOT EXISTS lineas_presupuesto_orden_idx ON public.lineas_presupuesto(presupuesto_id, orden);

-- RLS
ALTER TABLE public.lineas_presupuesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineas_presupuesto_select" ON public.lineas_presupuesto
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "lineas_presupuesto_insert" ON public.lineas_presupuesto
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "lineas_presupuesto_update" ON public.lineas_presupuesto
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "lineas_presupuesto_delete" ON public.lineas_presupuesto
  FOR DELETE USING (empresa_id = empresa_actual());


-- =============================================================
-- 3. HISTORIAL DE ESTADOS
-- =============================================================

CREATE TABLE IF NOT EXISTS public.presupuesto_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  estado text NOT NULL,
  usuario_id uuid NOT NULL,
  usuario_nombre text,
  fecha timestamptz NOT NULL DEFAULT now(),
  notas text
);

CREATE INDEX IF NOT EXISTS presupuesto_historial_presupuesto_idx ON public.presupuesto_historial(presupuesto_id);

ALTER TABLE public.presupuesto_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuesto_historial_select" ON public.presupuesto_historial
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_historial_insert" ON public.presupuesto_historial
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());


-- =============================================================
-- 4. CUOTAS DE PAGO
-- =============================================================

CREATE TABLE IF NOT EXISTS public.presupuesto_cuotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  descripcion text,
  porcentaje numeric NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  dias_desde_emision integer DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendiente',
  fecha_cobro timestamptz,
  cobrado_por_nombre text
);

CREATE INDEX IF NOT EXISTS presupuesto_cuotas_presupuesto_idx ON public.presupuesto_cuotas(presupuesto_id);

ALTER TABLE public.presupuesto_cuotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuesto_cuotas_select" ON public.presupuesto_cuotas
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_cuotas_insert" ON public.presupuesto_cuotas
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_cuotas_update" ON public.presupuesto_cuotas
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_cuotas_delete" ON public.presupuesto_cuotas
  FOR DELETE USING (empresa_id = empresa_actual());


-- =============================================================
-- 5. CONFIGURACIÓN DE PRESUPUESTOS POR EMPRESA
-- =============================================================

CREATE TABLE IF NOT EXISTS public.config_presupuestos (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Impuestos disponibles
  impuestos jsonb NOT NULL DEFAULT '[
    {"id":"iva21","label":"IVA 21%","porcentaje":21,"activo":true},
    {"id":"iva105","label":"IVA 10.5%","porcentaje":10.5,"activo":true},
    {"id":"exento","label":"Exento","porcentaje":0,"activo":true}
  ]',

  -- Monedas disponibles
  monedas jsonb NOT NULL DEFAULT '[
    {"id":"ARS","label":"Peso Argentino","simbolo":"$","activo":true},
    {"id":"USD","label":"Dólar","simbolo":"US$","activo":true},
    {"id":"EUR","label":"Euro","simbolo":"€","activo":true}
  ]',
  moneda_predeterminada text NOT NULL DEFAULT 'ARS',

  -- Condiciones de pago
  condiciones_pago jsonb NOT NULL DEFAULT '[
    {"id":"contado","label":"Contado","tipo":"plazo_fijo","diasVencimiento":0,"hitos":[],"notaPlanPago":"Pago al contado","predeterminado":false},
    {"id":"15dias","label":"15 días","tipo":"plazo_fijo","diasVencimiento":15,"hitos":[],"notaPlanPago":"Pago dentro de 15 días","predeterminado":false},
    {"id":"30dias","label":"30 días","tipo":"plazo_fijo","diasVencimiento":30,"hitos":[],"notaPlanPago":"Pago dentro de 30 días","predeterminado":true},
    {"id":"50_50","label":"50% adelanto + 50% al finalizar","tipo":"hitos","diasVencimiento":0,"hitos":[{"id":"h1","porcentaje":50,"descripcion":"Adelanto","diasDesdeEmision":0},{"id":"h2","porcentaje":50,"descripcion":"Al finalizar","diasDesdeEmision":0}],"predeterminado":false}
  ]',

  -- Defaults
  dias_vencimiento_predeterminado integer NOT NULL DEFAULT 30,
  condiciones_predeterminadas text,
  notas_predeterminadas text,

  -- Unidades de medida
  unidades jsonb NOT NULL DEFAULT '[
    {"id":"un","label":"Unidad","abreviatura":"un"},
    {"id":"hs","label":"Hora","abreviatura":"hs"},
    {"id":"kg","label":"Kilogramo","abreviatura":"kg"},
    {"id":"m","label":"Metro","abreviatura":"m"},
    {"id":"m2","label":"Metro cuadrado","abreviatura":"m²"},
    {"id":"lt","label":"Litro","abreviatura":"lt"},
    {"id":"gl","label":"Global","abreviatura":"gl"}
  ]',

  -- Columnas por defecto en la tabla de líneas
  columnas_lineas_default jsonb DEFAULT '["producto","descripcion","cantidad","unidad","precio_unitario","descuento","impuesto","subtotal"]',

  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- No necesita RLS ya que la PK es empresa_id y se filtra desde la API


-- =============================================================
-- 6. SEED: insertar config default al crear empresa
-- =============================================================

CREATE OR REPLACE FUNCTION public.seed_config_presupuestos(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.config_presupuestos (empresa_id)
  VALUES (p_empresa_id)
  ON CONFLICT (empresa_id) DO NOTHING;

  -- Crear secuencia de presupuestos
  INSERT INTO public.secuencias (empresa_id, entidad, prefijo, siguiente, digitos)
  VALUES (p_empresa_id, 'presupuesto', 'P', 1, 4)
  ON CONFLICT (empresa_id, entidad) DO NOTHING;
END;
$$;
