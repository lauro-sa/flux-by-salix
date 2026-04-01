-- Migración: búsqueda insensible a acentos/diacríticos
-- Habilita unaccent y recrea las columnas tsvector con config spanish_unaccent
-- para que "administracion" encuentre "Administración" y viceversa.

-- 1. Extensión unaccent
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- 2. Configuración FTS que ignora acentos
DROP TEXT SEARCH CONFIGURATION IF EXISTS spanish_unaccent;
CREATE TEXT SEARCH CONFIGURATION spanish_unaccent (COPY = spanish);
ALTER TEXT SEARCH CONFIGURATION spanish_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;

-- 3. Contactos: recrear columna tsvector
ALTER TABLE public.contactos DROP COLUMN IF EXISTS busqueda;
ALTER TABLE public.contactos ADD COLUMN busqueda tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish_unaccent', coalesce(nombre, '')), 'A') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(apellido, '')), 'A') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(correo, '')), 'B') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(telefono, '')), 'B') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(whatsapp, '')), 'B') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(codigo, '')), 'B') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(cargo, '')), 'C') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(rubro, '')), 'C') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(numero_identificacion, '')), 'C') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(notas, '')), 'D')
  ) STORED;
CREATE INDEX IF NOT EXISTS contactos_busqueda_idx ON public.contactos USING gin(busqueda);

-- 4. Productos: recrear columna tsvector
ALTER TABLE public.productos DROP COLUMN IF EXISTS busqueda;
ALTER TABLE public.productos ADD COLUMN busqueda tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish_unaccent', coalesce(nombre, '')), 'A') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(codigo, '')), 'A') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(descripcion, '')), 'B') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(descripcion_venta, '')), 'B') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(categoria, '')), 'C') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(referencia_interna, '')), 'C') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(codigo_barras, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS productos_busqueda_idx ON public.productos USING gin(busqueda);

-- 5. Presupuestos: recrear columna tsvector
ALTER TABLE public.presupuestos DROP COLUMN IF EXISTS busqueda;
ALTER TABLE public.presupuestos ADD COLUMN busqueda tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish_unaccent', coalesce(numero, '')), 'A') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(contacto_nombre, '')), 'A') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(contacto_apellido, '')), 'A') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(referencia, '')), 'B') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(contacto_correo, '')), 'B') ||
    setweight(to_tsvector('spanish_unaccent', coalesce(contacto_identificacion, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS presupuestos_busqueda_idx ON public.presupuestos USING gin(busqueda);
