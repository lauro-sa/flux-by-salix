-- ═══════════════════════════════════════════════════════════════
-- MÓDULO DE PRODUCTOS Y SERVICIOS
-- Migración: productos + config_productos
-- ═══════════════════════════════════════════════════════════════

-- Tabla principal de productos/servicios
CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'servicio', -- 'servicio' | 'producto' (default: servicio)

  -- Categorización
  categoria text,
  favorito boolean NOT NULL DEFAULT false,
  referencia_interna text,
  codigo_barras text,
  imagen_url text,

  -- Precios e impuestos
  precio_unitario numeric,
  moneda text,
  costo numeric,
  desglose_costos jsonb NOT NULL DEFAULT '[]',
  impuesto_id text,
  impuesto_compra_id text,
  unidad text NOT NULL DEFAULT 'unidad',

  -- Descripciones
  descripcion text,
  descripcion_venta text,
  notas_internas text,

  -- Logística (solo tipo = 'producto')
  peso numeric,
  volumen numeric,

  -- Capacidades
  puede_venderse boolean NOT NULL DEFAULT true,
  puede_comprarse boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,

  -- Soft delete
  en_papelera boolean NOT NULL DEFAULT false,
  papelera_en timestamptz,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_por_nombre text,
  editado_por uuid,
  editado_por_nombre text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  -- Full-text search
  busqueda tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(nombre, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(codigo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(descripcion, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(descripcion_venta, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(categoria, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(referencia_interna, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(codigo_barras, '')), 'C')
  ) STORED
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS productos_empresa_codigo_idx ON productos(empresa_id, codigo);
CREATE INDEX IF NOT EXISTS productos_empresa_idx ON productos(empresa_id);
CREATE INDEX IF NOT EXISTS productos_tipo_idx ON productos(empresa_id, tipo);
CREATE INDEX IF NOT EXISTS productos_categoria_idx ON productos(empresa_id, categoria);
CREATE INDEX IF NOT EXISTS productos_activo_idx ON productos(empresa_id, activo);
CREATE INDEX IF NOT EXISTS productos_papelera_idx ON productos(empresa_id, en_papelera);
CREATE INDEX IF NOT EXISTS productos_favorito_idx ON productos(empresa_id, favorito) WHERE favorito = true;
CREATE INDEX IF NOT EXISTS productos_busqueda_idx ON productos USING gin(busqueda);

-- RLS
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_empresa_policy" ON productos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─── Configuración de productos por empresa ───

CREATE TABLE IF NOT EXISTS config_productos (
  empresa_id uuid PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,

  -- Categorías de producto/servicio
  categorias jsonb NOT NULL DEFAULT '[
    {"id":"general","label":"General"},
    {"id":"tecnologia","label":"Tecnología"},
    {"id":"limpieza","label":"Limpieza"},
    {"id":"mantenimiento","label":"Mantenimiento"},
    {"id":"consultoria","label":"Consultoría"},
    {"id":"insumos","label":"Insumos"}
  ]',

  -- Unidades de medida
  unidades jsonb NOT NULL DEFAULT '[
    {"id":"unidad","label":"Unidad","abreviatura":"un"},
    {"id":"hora","label":"Hora","abreviatura":"hs"},
    {"id":"servicio","label":"Servicio","abreviatura":"srv"},
    {"id":"metro","label":"Metro","abreviatura":"m"},
    {"id":"kg","label":"Kilogramo","abreviatura":"kg"},
    {"id":"litro","label":"Litro","abreviatura":"lt"},
    {"id":"dia","label":"Día","abreviatura":"día"},
    {"id":"mes","label":"Mes","abreviatura":"mes"},
    {"id":"global","label":"Global","abreviatura":"gl"},
    {"id":"m2","label":"Metro cuadrado","abreviatura":"m²"}
  ]',

  -- Prefijos de código (cada uno con su secuencia)
  prefijos jsonb NOT NULL DEFAULT '[
    {"id":"producto","prefijo":"PRD","label":"Producto","siguiente":1},
    {"id":"servicio","prefijo":"SRV","label":"Servicio","siguiente":1}
  ]',

  -- Categorías de desglose de costos
  categorias_costo jsonb NOT NULL DEFAULT '[
    {"id":"mano_obra","label":"Mano de obra"},
    {"id":"materiales","label":"Materiales"},
    {"id":"horas_hombre","label":"Horas hombre"},
    {"id":"movilidad","label":"Movilidad"},
    {"id":"flete","label":"Flete"},
    {"id":"seguros","label":"Seguros"},
    {"id":"repuestos","label":"Repuestos"},
    {"id":"traslado","label":"Traslado"}
  ]',

  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE config_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_productos_empresa_policy" ON config_productos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─── Secuencia para productos (si no existe) ───
-- Las secuencias ya usan la tabla `secuencias` existente.
-- Insertar filas por defecto para empresas existentes que activen el módulo.
