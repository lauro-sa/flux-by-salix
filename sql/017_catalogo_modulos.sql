-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 017: CATÁLOGO DE MÓDULOS + SISTEMA DE APLICACIONES
-- Permite que cada empresa instale solo los módulos que necesita.
-- Base preparada para pagos y suscripciones futuras.
-- ═══════════════════════════════════════════════════════════════

-- 1. Catálogo maestro de módulos disponibles en Flux (tabla global, sin RLS)
CREATE TABLE IF NOT EXISTS catalogo_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE, -- 'inbox', 'contactos', 'whatsapp', 'visitas', etc.
  nombre text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  icono text NOT NULL DEFAULT 'box', -- nombre del ícono de Lucide
  categoria text NOT NULL DEFAULT 'operacional', -- 'base', 'operacional', 'documentos', 'comunicacion', 'admin', 'premium'
  es_base boolean NOT NULL DEFAULT false, -- módulos base no se pueden desinstalar
  requiere text[] NOT NULL DEFAULT '{}', -- dependencias: slugs de módulos requeridos
  orden integer NOT NULL DEFAULT 0, -- orden en la tienda

  -- Preparado para pagos futuros (sin lógica por ahora)
  precio_mensual_usd numeric DEFAULT 0, -- 0 = incluido en plan base
  precio_anual_usd numeric DEFAULT 0,
  tier text NOT NULL DEFAULT 'free', -- 'free', 'starter', 'pro', 'enterprise'

  -- Metadata
  version text NOT NULL DEFAULT '1.0.0',
  destacado boolean NOT NULL DEFAULT false, -- para destacar en la tienda
  visible boolean NOT NULL DEFAULT true, -- ocultar módulos en desarrollo
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- 2. Expandir modulos_empresa con campos para el sistema de aplicaciones
-- Agregar columnas si no existen
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modulos_empresa' AND column_name = 'catalogo_modulo_id') THEN
    ALTER TABLE modulos_empresa ADD COLUMN catalogo_modulo_id uuid REFERENCES catalogo_modulos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modulos_empresa' AND column_name = 'instalado_por') THEN
    ALTER TABLE modulos_empresa ADD COLUMN instalado_por uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modulos_empresa' AND column_name = 'version') THEN
    ALTER TABLE modulos_empresa ADD COLUMN version text DEFAULT '1.0.0';
  END IF;
END $$;

-- 3. Tabla de suscripciones (preparada para Stripe, sin lógica aún)
CREATE TABLE IF NOT EXISTS suscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free', -- 'free', 'starter', 'pro', 'enterprise'
  estado text NOT NULL DEFAULT 'activa', -- 'activa', 'trial', 'vencida', 'cancelada'

  -- Stripe (se llena cuando se integre pagos)
  stripe_customer_id text,
  stripe_subscription_id text,

  -- Fechas
  inicio_en timestamptz NOT NULL DEFAULT now(),
  vence_en timestamptz, -- null = sin vencimiento (free)
  trial_hasta timestamptz,
  cancelado_en timestamptz,

  -- Límites del plan (se puede extender)
  limite_usuarios integer, -- null = ilimitado
  limite_contactos integer,
  limite_storage_mb integer,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id)
);

ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY suscripciones_rls ON suscripciones
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 4. Seed: catálogo inicial de módulos

-- Módulos BASE (siempre incluidos, no se desinstalan)
INSERT INTO catalogo_modulos (slug, nombre, descripcion, icono, categoria, es_base, orden, tier) VALUES
  ('inbox', 'Inbox', 'Correo electrónico y mensajes internos entre miembros del equipo.', 'mail', 'base', true, 1, 'free'),
  ('contactos', 'Contactos', 'Gestión completa de contactos, empresas y vinculaciones.', 'users', 'base', true, 2, 'free'),
  ('actividades', 'Actividades', 'Seguimiento de tareas, llamadas, reuniones y actividades comerciales.', 'zap', 'base', true, 3, 'free'),
  ('calendario', 'Calendario', 'Vista calendario de actividades, visitas y eventos.', 'calendar', 'base', true, 4, 'free')
ON CONFLICT (slug) DO NOTHING;

-- Módulos INSTALABLES (la empresa elige cuáles activar)
INSERT INTO catalogo_modulos (slug, nombre, descripcion, icono, categoria, es_base, orden, tier) VALUES
  ('whatsapp', 'WhatsApp', 'Canal de WhatsApp para comunicación directa con contactos.', 'message-circle', 'comunicacion', false, 10, 'starter'),
  ('visitas', 'Visitas', 'Planificación y registro de visitas comerciales con geolocalización.', 'map-pin', 'operacional', false, 11, 'starter'),
  ('recorrido', 'Recorrido', 'Optimización de rutas y seguimiento de recorridos del equipo.', 'route', 'operacional', false, 12, 'starter'),
  ('productos', 'Productos', 'Catálogo de productos y servicios con precios y unidades.', 'package', 'documentos', false, 13, 'starter'),
  ('presupuestos', 'Presupuestos', 'Creación y envío de cotizaciones profesionales con PDF.', 'file-text', 'documentos', false, 14, 'starter'),
  ('informes', 'Informes', 'Informes técnicos y reportes vinculados a contactos.', 'file-bar-chart', 'documentos', false, 15, 'starter'),
  ('ordenes_trabajo', 'Órdenes de trabajo', 'Gestión de órdenes con etapas, asignación y seguimiento.', 'wrench', 'documentos', false, 16, 'starter'),
  ('asistencias', 'Asistencias', 'Control de asistencia, fichaje y gestión de jornada laboral.', 'clock', 'admin', false, 17, 'starter'),
  ('auditoria', 'Auditoría', 'Registro completo de cambios y acciones en el sistema.', 'shield', 'admin', false, 18, 'starter')
ON CONFLICT (slug) DO NOTHING;

-- Módulos PREMIUM
INSERT INTO catalogo_modulos (slug, nombre, descripcion, icono, categoria, es_base, orden, tier, precio_mensual_usd) VALUES
  ('inteligencia_artificial', 'Inteligencia Artificial', 'Agente IA que responde mensajes, agenda visitas y gestiona contactos automáticamente.', 'brain', 'premium', false, 30, 'pro', 29),
  ('portal_clientes', 'Portal de clientes', 'Portal web donde tus clientes ven presupuestos, aceptan y firman online.', 'globe', 'premium', false, 31, 'pro', 19),
  ('marketing', 'Marketing', 'Campañas de correo y WhatsApp masivos, tracking web con pixel de seguimiento y analíticas.', 'megaphone', 'comunicacion', false, 20, 'pro', 39)
ON CONFLICT (slug) DO NOTHING;

-- 5. Función helper: instalar módulos base automáticamente al crear empresa
CREATE OR REPLACE FUNCTION instalar_modulos_base()
RETURNS TRIGGER AS $$
DECLARE
  modulo_base RECORD;
BEGIN
  -- Insertar todos los módulos base como activos
  FOR modulo_base IN
    SELECT id, slug FROM catalogo_modulos WHERE es_base = true
  LOOP
    INSERT INTO modulos_empresa (empresa_id, modulo, activo, catalogo_modulo_id, activado_en)
    VALUES (NEW.id, modulo_base.slug, true, modulo_base.id, now())
    ON CONFLICT (empresa_id, modulo) DO NOTHING;
  END LOOP;

  -- Crear suscripción free por defecto
  INSERT INTO suscripciones (empresa_id, plan, estado)
  VALUES (NEW.id, 'free', 'activa')
  ON CONFLICT (empresa_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: al crear empresa → instalar módulos base
DROP TRIGGER IF EXISTS trigger_instalar_modulos_base ON empresas;
CREATE TRIGGER trigger_instalar_modulos_base
  AFTER INSERT ON empresas
  FOR EACH ROW
  EXECUTE FUNCTION instalar_modulos_base();

-- 6. Instalar módulos base para empresas existentes que no los tengan
INSERT INTO modulos_empresa (empresa_id, modulo, activo, catalogo_modulo_id, activado_en)
SELECT e.id, cm.slug, true, cm.id, now()
FROM empresas e
CROSS JOIN catalogo_modulos cm
WHERE cm.es_base = true
ON CONFLICT (empresa_id, modulo) DO NOTHING;

-- Crear suscripciones free para empresas existentes
INSERT INTO suscripciones (empresa_id, plan, estado)
SELECT id, 'free', 'activa'
FROM empresas
ON CONFLICT (empresa_id) DO NOTHING;
