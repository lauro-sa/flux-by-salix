-- =============================================================
-- Migración: Sistema de Contactos para Flux by Salix
-- Tablas: tipos_contacto, contactos, contacto_vinculaciones,
--         contacto_direcciones, contacto_etiquetas,
--         contacto_responsables, contacto_seguidores,
--         tipos_relacion, campos_fiscales_pais
-- =============================================================

-- =============================================================
-- 1. TIPOS DE CONTACTO (configurables por empresa)
-- Cada empresa puede crear sus propios tipos además de los default
-- =============================================================

CREATE TABLE IF NOT EXISTS public.tipos_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  clave text NOT NULL,              -- 'persona', 'empresa', 'edificio', etc.
  etiqueta text NOT NULL,           -- 'Persona', 'Empresa', 'Edificio'
  icono text NOT NULL DEFAULT 'user', -- nombre del icono Lucide
  color text NOT NULL DEFAULT 'primario', -- token de color de insignia
  puede_tener_hijos boolean NOT NULL DEFAULT false,
  es_predefinido boolean NOT NULL DEFAULT false, -- los default no se pueden eliminar
  orden integer NOT NULL DEFAULT 0, -- para ordenar en UI
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),

  UNIQUE(empresa_id, clave)
);

CREATE INDEX IF NOT EXISTS tipos_contacto_empresa_idx ON public.tipos_contacto(empresa_id);

-- RLS
ALTER TABLE public.tipos_contacto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_contacto_select" ON public.tipos_contacto
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "tipos_contacto_insert" ON public.tipos_contacto
  FOR INSERT WITH CHECK (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

CREATE POLICY "tipos_contacto_update" ON public.tipos_contacto
  FOR UPDATE USING (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

CREATE POLICY "tipos_contacto_delete" ON public.tipos_contacto
  FOR DELETE USING (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );


-- =============================================================
-- 2. TIPOS DE RELACIÓN (configurables por empresa)
-- Define cómo se relacionan los contactos entre sí
-- =============================================================

CREATE TABLE IF NOT EXISTS public.tipos_relacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  clave text NOT NULL,                -- 'empleado_de', 'administra', 'provee_a'
  etiqueta text NOT NULL,             -- 'Empleado de'
  etiqueta_inversa text NOT NULL,     -- 'Emplea a' (se muestra en el otro contacto)
  es_predefinido boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),

  UNIQUE(empresa_id, clave)
);

CREATE INDEX IF NOT EXISTS tipos_relacion_empresa_idx ON public.tipos_relacion(empresa_id);

-- RLS
ALTER TABLE public.tipos_relacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_relacion_select" ON public.tipos_relacion
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "tipos_relacion_insert" ON public.tipos_relacion
  FOR INSERT WITH CHECK (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

CREATE POLICY "tipos_relacion_update" ON public.tipos_relacion
  FOR UPDATE USING (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

CREATE POLICY "tipos_relacion_delete" ON public.tipos_relacion
  FOR DELETE USING (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );


-- =============================================================
-- 3. CAMPOS FISCALES POR PAÍS
-- Define qué campos fiscales aplican según el país de la empresa
-- =============================================================

CREATE TABLE IF NOT EXISTS public.campos_fiscales_pais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pais text NOT NULL,                 -- 'AR', 'MX', 'CO', 'ES', etc.
  clave text NOT NULL,                -- 'cuit', 'rfc', 'nit', 'cif'
  etiqueta text NOT NULL,             -- 'CUIT', 'RFC', 'NIT'
  tipo_campo text NOT NULL DEFAULT 'texto', -- 'texto', 'select', 'numero'
  opciones jsonb,                     -- para selects: [{"valor": "monotributista", "etiqueta": "Monotributista"}]
  obligatorio boolean NOT NULL DEFAULT false,
  patron_validacion text,             -- regex para validar formato: '^\d{2}-\d{8}-\d$'
  mascara text,                       -- máscara de input: '##-########-#'
  orden integer NOT NULL DEFAULT 0,
  aplica_a text[] NOT NULL DEFAULT '{}', -- tipos de contacto: ['empresa', 'persona', 'proveedor']

  es_identificacion boolean NOT NULL DEFAULT false, -- true = campo de identidad (DNI, CUIT, RFC, etc.)

  UNIQUE(pais, clave)
);

-- Sin RLS — tabla global de referencia (no tiene empresa_id)
-- Se lee desde la app según el país de la empresa


-- =============================================================
-- 4. TABLA PRINCIPAL: CONTACTOS
-- =============================================================

CREATE TABLE IF NOT EXISTS public.contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Tipo (FK a tipos_contacto)
  tipo_contacto_id uuid NOT NULL REFERENCES public.tipos_contacto(id),

  -- Código secuencial por empresa (C-0001, C-0002...)
  codigo text NOT NULL,

  -- Identidad
  nombre text NOT NULL,
  apellido text,                      -- solo personas/leads
  titulo text,                        -- Sr., Dra., Ing.

  -- Contacto directo
  correo text,
  telefono text,
  whatsapp text,
  web text,

  -- Laboral
  cargo text,                         -- puesto laboral (personas)
  rubro text,                         -- industria/actividad (empresas, proveedores)

  -- Comercial
  moneda text DEFAULT 'ARS',
  idioma text DEFAULT 'es',
  zona_horaria text,
  limite_credito numeric,
  plazo_pago_cliente text,            -- 'contado', '30_dias', '60_dias'
  plazo_pago_proveedor text,
  rank_cliente integer,               -- 1-5 estrellas
  rank_proveedor integer,

  -- Identificación fiscal (campos comunes a todos los países)
  tipo_identificacion text,           -- 'cuit', 'rfc', 'nit', 'dni', 'pasaporte'
  numero_identificacion text,

  -- Datos fiscales específicos del país (JSONB flexible)
  -- AR: {"condicion_iva": "monotributista", "tipo_iibb": "local", "numero_iibb": "..."}
  -- MX: {"regimen_fiscal": "601", "uso_cfdi": "G03"}
  datos_fiscales jsonb DEFAULT '{}',

  -- Etiquetas (array nativo PostgreSQL — más simple que tabla intermedia para tags)
  etiquetas text[] DEFAULT '{}',

  -- Notas
  notas text,

  -- Estado
  activo boolean NOT NULL DEFAULT true,
  en_papelera boolean NOT NULL DEFAULT false,
  papelera_en timestamptz,
  es_provisorio boolean NOT NULL DEFAULT false, -- creado por IA, pendiente aprobación

  -- Origen
  origen text NOT NULL DEFAULT 'manual', -- 'manual', 'importacion', 'whatsapp', 'api'

  -- Vínculo con usuario (para tipo 'equipo')
  -- Si no es null, este contacto se sincroniza con el miembro
  miembro_id uuid REFERENCES public.miembros(id) ON DELETE SET NULL,

  -- Auditoría
  creado_por uuid NOT NULL,
  editado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  -- Constraint: código único por empresa
  UNIQUE(empresa_id, codigo)
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS contactos_empresa_idx ON public.contactos(empresa_id);
CREATE INDEX IF NOT EXISTS contactos_tipo_idx ON public.contactos(empresa_id, tipo_contacto_id);
CREATE INDEX IF NOT EXISTS contactos_activo_idx ON public.contactos(empresa_id, activo) WHERE en_papelera = false;
CREATE INDEX IF NOT EXISTS contactos_papelera_idx ON public.contactos(empresa_id, en_papelera) WHERE en_papelera = true;
CREATE INDEX IF NOT EXISTS contactos_miembro_idx ON public.contactos(miembro_id) WHERE miembro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contactos_correo_idx ON public.contactos(empresa_id, correo) WHERE correo IS NOT NULL;
CREATE INDEX IF NOT EXISTS contactos_telefono_idx ON public.contactos(empresa_id, telefono) WHERE telefono IS NOT NULL;
CREATE INDEX IF NOT EXISTS contactos_whatsapp_idx ON public.contactos(empresa_id, whatsapp) WHERE whatsapp IS NOT NULL;
CREATE INDEX IF NOT EXISTS contactos_identificacion_idx ON public.contactos(empresa_id, tipo_identificacion, numero_identificacion) WHERE numero_identificacion IS NOT NULL;

-- Full-text search nativo (reemplaza el hack de tokens del otro software)
ALTER TABLE public.contactos ADD COLUMN IF NOT EXISTS busqueda tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(nombre, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(apellido, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(correo, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(telefono, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(whatsapp, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(codigo, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(cargo, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(rubro, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(numero_identificacion, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(notas, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS contactos_busqueda_idx ON public.contactos USING gin(busqueda);

-- RLS
ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contactos_select" ON public.contactos
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "contactos_insert" ON public.contactos
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "contactos_update" ON public.contactos
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "contactos_delete" ON public.contactos
  FOR DELETE USING (empresa_id = empresa_actual());


-- =============================================================
-- 5. VINCULACIONES ENTRE CONTACTOS
-- Tabla intermedia bidireccional con tipo de relación
-- =============================================================

CREATE TABLE IF NOT EXISTS public.contacto_vinculaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contacto_id uuid NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
  vinculado_id uuid NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,

  -- Tipo de relación (FK a tipos_relacion)
  tipo_relacion_id uuid REFERENCES public.tipos_relacion(id) ON DELETE SET NULL,

  -- Puesto/rol contextual (texto libre complementario)
  puesto text,

  -- Si recibe copias de documentos del contacto principal
  recibe_documentos boolean NOT NULL DEFAULT false,

  creado_en timestamptz NOT NULL DEFAULT now(),

  -- No puede haber duplicados A→B
  UNIQUE(contacto_id, vinculado_id),
  -- No puede vincularse a sí mismo
  CHECK(contacto_id <> vinculado_id)
);

CREATE INDEX IF NOT EXISTS vinculaciones_contacto_idx ON public.contacto_vinculaciones(contacto_id);
CREATE INDEX IF NOT EXISTS vinculaciones_vinculado_idx ON public.contacto_vinculaciones(vinculado_id);
CREATE INDEX IF NOT EXISTS vinculaciones_empresa_idx ON public.contacto_vinculaciones(empresa_id);

-- RLS
ALTER TABLE public.contacto_vinculaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vinculaciones_select" ON public.contacto_vinculaciones
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "vinculaciones_insert" ON public.contacto_vinculaciones
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "vinculaciones_update" ON public.contacto_vinculaciones
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "vinculaciones_delete" ON public.contacto_vinculaciones
  FOR DELETE USING (empresa_id = empresa_actual());


-- =============================================================
-- 6. DIRECCIONES DE CONTACTO
-- =============================================================

CREATE TABLE IF NOT EXISTS public.contacto_direcciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id uuid NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'principal', -- 'principal', 'fiscal', 'entrega', 'otra'
  calle text,
  numero text,
  piso text,
  departamento text,
  barrio text,
  ciudad text,
  provincia text,
  codigo_postal text,
  pais text,
  timbre text,
  lat double precision,
  lng double precision,
  texto text,                         -- dirección completa formateada (autocompletada)
  es_principal boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS direcciones_contacto_idx ON public.contacto_direcciones(contacto_id);

-- RLS via contacto (la dirección hereda el acceso del contacto)
ALTER TABLE public.contacto_direcciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "direcciones_select" ON public.contacto_direcciones
  FOR SELECT USING (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );

CREATE POLICY "direcciones_insert" ON public.contacto_direcciones
  FOR INSERT WITH CHECK (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );

CREATE POLICY "direcciones_update" ON public.contacto_direcciones
  FOR UPDATE USING (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );

CREATE POLICY "direcciones_delete" ON public.contacto_direcciones
  FOR DELETE USING (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );


-- =============================================================
-- 7. RESPONSABLES DE CONTACTO
-- Usuarios asignados a un contacto (ven "sus" contactos)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.contacto_responsables (
  contacto_id uuid NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  asignado_en timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY(contacto_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS responsables_usuario_idx ON public.contacto_responsables(usuario_id);

-- RLS
ALTER TABLE public.contacto_responsables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "responsables_select" ON public.contacto_responsables
  FOR SELECT USING (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );

CREATE POLICY "responsables_insert" ON public.contacto_responsables
  FOR INSERT WITH CHECK (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );

CREATE POLICY "responsables_delete" ON public.contacto_responsables
  FOR DELETE USING (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );


-- =============================================================
-- 8. SEGUIDORES DE CONTACTO
-- Usuarios que reciben notificaciones de cambios
-- =============================================================

CREATE TABLE IF NOT EXISTS public.contacto_seguidores (
  contacto_id uuid NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  modo_copia text,                    -- null = solo notificación, 'CC', 'CCO'
  agregado_en timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY(contacto_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS seguidores_usuario_idx ON public.contacto_seguidores(usuario_id);

-- RLS
ALTER TABLE public.contacto_seguidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seguidores_select" ON public.contacto_seguidores
  FOR SELECT USING (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );

CREATE POLICY "seguidores_insert" ON public.contacto_seguidores
  FOR INSERT WITH CHECK (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );

CREATE POLICY "seguidores_delete" ON public.contacto_seguidores
  FOR DELETE USING (
    contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = empresa_actual())
  );


-- =============================================================
-- 9. SECUENCIA PARA CÓDIGO DE CONTACTO
-- Genera C-0001, C-0002... por empresa (atómico, sin gaps)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.secuencias (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  entidad text NOT NULL,              -- 'contacto', 'presupuesto', 'factura', 'visita', etc.
  prefijo text NOT NULL DEFAULT 'C',  -- 'C', 'PRE', 'FAC', 'VT'
  siguiente integer NOT NULL DEFAULT 1,
  digitos integer NOT NULL DEFAULT 4, -- cantidad de dígitos: 4 → C-0001

  PRIMARY KEY(empresa_id, entidad)
);

-- RLS
ALTER TABLE public.secuencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secuencias_select" ON public.secuencias
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "secuencias_update" ON public.secuencias
  FOR UPDATE USING (empresa_id = empresa_actual());

-- Función para generar el siguiente código de forma atómica
CREATE OR REPLACE FUNCTION public.siguiente_codigo(
  p_empresa_id uuid,
  p_entidad text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  _prefijo text;
  _siguiente integer;
  _digitos integer;
  _codigo text;
BEGIN
  -- Obtener y lockear la fila para evitar race conditions
  UPDATE public.secuencias
  SET siguiente = siguiente + 1
  WHERE empresa_id = p_empresa_id AND entidad = p_entidad
  RETURNING prefijo, siguiente - 1, digitos INTO _prefijo, _siguiente, _digitos;

  -- Si no existe la secuencia, crearla
  IF NOT FOUND THEN
    INSERT INTO public.secuencias (empresa_id, entidad, prefijo, siguiente, digitos)
    VALUES (p_empresa_id, p_entidad, 'C', 2, 4)
    ON CONFLICT (empresa_id, entidad) DO UPDATE
      SET siguiente = public.secuencias.siguiente + 1
    RETURNING prefijo, siguiente - 1, digitos INTO _prefijo, _siguiente, _digitos;
  END IF;

  -- Formatear: C-0001
  _codigo := _prefijo || '-' || lpad(_siguiente::text, _digitos, '0');
  RETURN _codigo;
END;
$$;


-- =============================================================
-- 10. FUNCIÓN: SEED TIPOS DEFAULT AL CREAR EMPRESA
-- Inserta los 6 tipos de contacto y relaciones predefinidas
-- =============================================================

CREATE OR REPLACE FUNCTION public.seed_tipos_contacto(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Tipos de contacto predefinidos
  INSERT INTO public.tipos_contacto (empresa_id, clave, etiqueta, icono, color, puede_tener_hijos, es_predefinido, orden) VALUES
    (p_empresa_id, 'persona',   'Persona',   'user',          'primario',    false, true, 1),
    (p_empresa_id, 'empresa',   'Empresa',   'building-2',    'info',        true,  true, 2),
    (p_empresa_id, 'edificio',  'Edificio',  'building',      'cyan',        true,  true, 3),
    (p_empresa_id, 'proveedor', 'Proveedor', 'truck',         'naranja',     true,  true, 4),
    (p_empresa_id, 'lead',      'Lead',      'user-plus',     'advertencia', false, true, 5),
    (p_empresa_id, 'equipo',    'Equipo',    'badge-check',   'exito',       false, true, 6)
  ON CONFLICT (empresa_id, clave) DO NOTHING;

  -- Tipos de relación predefinidos
  INSERT INTO public.tipos_relacion (empresa_id, clave, etiqueta, etiqueta_inversa, es_predefinido) VALUES
    (p_empresa_id, 'empleado_de',    'Empleado de',    'Emplea a',          true),
    (p_empresa_id, 'administra',     'Administra',     'Administrado por',  true),
    (p_empresa_id, 'provee_a',       'Provee a',       'Proveedor:',        true),
    (p_empresa_id, 'propietario_de', 'Propietario de', 'Propiedad de',      true),
    (p_empresa_id, 'inquilino_de',   'Inquilino de',   'Inquilino:',        true),
    (p_empresa_id, 'socio_de',       'Socio de',       'Socio de',          true),
    (p_empresa_id, 'contacto_de',    'Contacto de',    'Contacto de',       true)
  ON CONFLICT (empresa_id, clave) DO NOTHING;

  -- Secuencia de códigos para contactos
  INSERT INTO public.secuencias (empresa_id, entidad, prefijo, siguiente, digitos)
  VALUES (p_empresa_id, 'contacto', 'C', 1, 4)
  ON CONFLICT (empresa_id, entidad) DO NOTHING;
END;
$$;


-- =============================================================
-- 11. DATOS FISCALES: ARGENTINA (seed inicial)
-- =============================================================

INSERT INTO public.campos_fiscales_pais (pais, clave, etiqueta, tipo_campo, opciones, obligatorio, patron_validacion, mascara, orden, aplica_a, es_identificacion) VALUES
  -- CUIT (empresas, proveedores, personas) — identificación
  ('AR', 'cuit', 'CUIT', 'texto', NULL, false, '^\d{2}-\d{8}-\d$', '##-########-#', 1, '{"empresa","proveedor","persona"}', true),

  -- Condición IVA
  ('AR', 'condicion_iva', 'Condición IVA', 'select',
    '[{"valor":"responsable_inscripto","etiqueta":"Responsable Inscripto"},{"valor":"monotributista","etiqueta":"Monotributista"},{"valor":"exento","etiqueta":"Exento"},{"valor":"consumidor_final","etiqueta":"Consumidor Final"},{"valor":"no_categorizado","etiqueta":"No Categorizado"},{"valor":"no_alcanzado","etiqueta":"No Alcanzado"},{"valor":"exterior","etiqueta":"Exterior"}]'::jsonb,
    false, NULL, NULL, 2, '{"empresa","proveedor","persona"}', false),

  -- Tipo IIBB
  ('AR', 'tipo_iibb', 'Tipo IIBB', 'select',
    '[{"valor":"local","etiqueta":"Local"},{"valor":"convenio_multilateral","etiqueta":"Convenio Multilateral"},{"valor":"exento","etiqueta":"Exento"}]'::jsonb,
    false, NULL, NULL, 3, '{"empresa","proveedor"}', false),

  -- Número IIBB
  ('AR', 'numero_iibb', 'Número IIBB', 'texto', NULL, false, NULL, NULL, 4, '{"empresa","proveedor"}', false),

  -- DNI (personas) — identificación
  ('AR', 'dni', 'DNI', 'texto', NULL, false, '^\d{7,8}$', NULL, 5, '{"persona","lead"}', true),

  -- CUIL (personas) — identificación
  ('AR', 'cuil', 'CUIL', 'texto', NULL, false, '^\d{2}-\d{8}-\d$', '##-########-#', 6, '{"persona","lead"}', true)
ON CONFLICT (pais, clave) DO NOTHING;


-- =============================================================
-- 12. DATOS FISCALES: MÉXICO (seed inicial)
-- =============================================================

INSERT INTO public.campos_fiscales_pais (pais, clave, etiqueta, tipo_campo, opciones, obligatorio, patron_validacion, mascara, orden, aplica_a, es_identificacion) VALUES
  ('MX', 'rfc', 'RFC', 'texto', NULL, false, '^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$', NULL, 1, '{"empresa","proveedor","persona"}', true),

  ('MX', 'regimen_fiscal', 'Régimen Fiscal', 'select',
    '[{"valor":"601","etiqueta":"General de Ley"},{"valor":"603","etiqueta":"Personas Morales sin fines de lucro"},{"valor":"605","etiqueta":"Sueldos y Salarios"},{"valor":"612","etiqueta":"Personas Físicas con Actividad Empresarial"},{"valor":"616","etiqueta":"Sin obligaciones fiscales"},{"valor":"621","etiqueta":"Incorporación Fiscal"},{"valor":"626","etiqueta":"Simplificado de Confianza"}]'::jsonb,
    false, NULL, NULL, 2, '{"empresa","proveedor","persona"}', false),

  ('MX', 'uso_cfdi', 'Uso CFDI', 'select',
    '[{"valor":"G01","etiqueta":"Adquisición de mercancías"},{"valor":"G03","etiqueta":"Gastos en general"},{"valor":"I01","etiqueta":"Construcciones"},{"valor":"P01","etiqueta":"Por definir"},{"valor":"S01","etiqueta":"Sin efectos fiscales"}]'::jsonb,
    false, NULL, NULL, 3, '{"empresa","proveedor","persona"}', false),

  ('MX', 'curp', 'CURP', 'texto', NULL, false, '^[A-Z]{4}\d{6}[HM][A-Z]{5}\d{2}$', NULL, 4, '{"persona"}', true)
ON CONFLICT (pais, clave) DO NOTHING;


-- =============================================================
-- 13. DATOS FISCALES: COLOMBIA (seed inicial)
-- =============================================================

INSERT INTO public.campos_fiscales_pais (pais, clave, etiqueta, tipo_campo, opciones, obligatorio, patron_validacion, mascara, orden, aplica_a, es_identificacion) VALUES
  ('CO', 'nit', 'NIT', 'texto', NULL, false, '^\d{9}-\d$', '#########-#', 1, '{"empresa","proveedor","persona"}', true),

  ('CO', 'regimen_tributario', 'Régimen Tributario', 'select',
    '[{"valor":"responsable_iva","etiqueta":"Responsable de IVA"},{"valor":"no_responsable_iva","etiqueta":"No Responsable de IVA"},{"valor":"regimen_simple","etiqueta":"Régimen Simple de Tributación"}]'::jsonb,
    false, NULL, NULL, 2, '{"empresa","proveedor"}', false),

  ('CO', 'cedula', 'Cédula de Ciudadanía', 'texto', NULL, false, '^\d{6,10}$', NULL, 3, '{"persona"}', true)
ON CONFLICT (pais, clave) DO NOTHING;


-- =============================================================
-- 14. DATOS FISCALES: ESPAÑA (seed inicial)
-- =============================================================

INSERT INTO public.campos_fiscales_pais (pais, clave, etiqueta, tipo_campo, opciones, obligatorio, patron_validacion, mascara, orden, aplica_a, es_identificacion) VALUES
  ('ES', 'cif_nif', 'CIF/NIF', 'texto', NULL, false, '^[A-Z]\d{7}[A-Z\d]$|^\d{8}[A-Z]$', NULL, 1, '{"empresa","proveedor","persona"}', true),

  ('ES', 'regimen_iva', 'Régimen IVA', 'select',
    '[{"valor":"general","etiqueta":"Régimen General"},{"valor":"simplificado","etiqueta":"Régimen Simplificado"},{"valor":"recargo_equivalencia","etiqueta":"Recargo de Equivalencia"},{"valor":"exento","etiqueta":"Exento"}]'::jsonb,
    false, NULL, NULL, 2, '{"empresa","proveedor"}', false)
ON CONFLICT (pais, clave) DO NOTHING;
