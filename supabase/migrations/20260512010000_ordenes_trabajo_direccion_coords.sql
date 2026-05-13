-- Snapshot de coordenadas de la dirección en órdenes de trabajo.
--
-- PROBLEMA QUE RESUELVE
-- El botón "Navegar" en órdenes le pasaba a Google Maps el texto crudo de la
-- dirección (`contacto_direccion`). Cuando el texto era ambiguo (por ejemplo
-- "Doctor A. R. Vidal 5048, San Martín" — hay decenas de "San Martín" en
-- Argentina) Maps elegía cualquier coincidencia y mandaba al visitador a otro
-- lado. Igual problema con direcciones sin código postal o sin provincia.
--
-- SOLUCIÓN
-- Agregar columnas snapshot de lat/lng en ordenes_trabajo, mismo patrón que
-- visitas (que ya las tiene como `direccion_lat/lng`). La UI usa las coords
-- para construir el URL de Maps cuando están disponibles, y cae al texto sólo
-- como último recurso.
--
-- PROPAGACIÓN
-- Mientras la OT no esté publicada, los cambios de la dirección apuntada por
-- `direccion_id` siguen propagándose automáticamente desde el endpoint de
-- contactos (ver propagarCambioDirecciones en /api/contactos/[id]/direcciones).
-- Esa función se actualiza para incluir lat/lng en el mismo update.

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS contacto_direccion_lat double precision,
  ADD COLUMN IF NOT EXISTS contacto_direccion_lng double precision;

-- 1. Backfill primero por direccion_id (caso normal: OT ya vinculada a una
-- dirección estructurada). Se copian las coords aunque la OT esté publicada
-- — son datos consistentes con la dirección que ya estaba elegida.
UPDATE public.ordenes_trabajo o
SET contacto_direccion_lat = cd.lat,
    contacto_direccion_lng = cd.lng
FROM public.contacto_direcciones cd
WHERE o.direccion_id = cd.id
  AND o.contacto_direccion_lat IS NULL
  AND cd.lat IS NOT NULL
  AND cd.lng IS NOT NULL;

-- 2. Backfill por match de texto exacto contra alguna dirección del contacto
-- (caso legacy: OT con `contacto_direccion` como texto suelto pero con
-- `contacto_id` válido). Vincula también `direccion_id` para que la
-- propagación viva pueda mantener todo coherente. Solo OTs no publicadas
-- — las publicadas se respetan tal como se emitieron aunque el snapshot
-- quede sin coords.
UPDATE public.ordenes_trabajo o
SET contacto_direccion_lat = sub.lat,
    contacto_direccion_lng = sub.lng,
    direccion_id = sub.dir_id
FROM (
  SELECT DISTINCT ON (oo.id) oo.id AS oid, cd.id AS dir_id, cd.lat, cd.lng
  FROM public.ordenes_trabajo oo
  JOIN public.contacto_direcciones cd ON cd.contacto_id = oo.contacto_id
  WHERE oo.contacto_direccion IS NOT NULL
    AND cd.texto = oo.contacto_direccion
    AND oo.contacto_direccion_lat IS NULL
    AND cd.lat IS NOT NULL
    AND cd.lng IS NOT NULL
  ORDER BY oo.id, cd.es_principal DESC, cd.creado_en
) sub
WHERE o.id = sub.oid
  AND o.publicada = false;

-- 3. Para OTs no publicadas con `contacto_id` que aún no tienen coords ni
-- direccion_id (ni siquiera por match de texto), tomar la dirección principal
-- del contacto si tiene coords. Mismo fallback que aplica `propagarCambioDirecciones`.
UPDATE public.ordenes_trabajo o
SET contacto_direccion_lat = sub.lat,
    contacto_direccion_lng = sub.lng,
    direccion_id = sub.dir_id,
    contacto_direccion = sub.texto
FROM (
  SELECT DISTINCT ON (oo.id) oo.id AS oid, cd.id AS dir_id, cd.lat, cd.lng, cd.texto
  FROM public.ordenes_trabajo oo
  JOIN public.contacto_direcciones cd ON cd.contacto_id = oo.contacto_id
  WHERE oo.contacto_direccion_lat IS NULL
    AND oo.direccion_id IS NULL
    AND cd.lat IS NOT NULL
    AND cd.lng IS NOT NULL
    AND oo.publicada = false
  ORDER BY oo.id, cd.es_principal DESC, cd.creado_en
) sub
WHERE o.id = sub.oid;

-- 4. Backfill adicional para OTs publicadas: SOLO coords (no toca texto ni
-- direccion_id) y SOLO cuando hay match exacto de texto contra una dirección
-- del contacto. Es seguro porque las coords son metadata operativa para
-- navegación, no parte del documento emitido. Si el texto no matchea, se
-- respeta tal cual estaba (lo emitido manda).
UPDATE public.ordenes_trabajo o
SET contacto_direccion_lat = sub.lat,
    contacto_direccion_lng = sub.lng
FROM (
  SELECT DISTINCT ON (oo.id) oo.id AS oid, cd.lat, cd.lng
  FROM public.ordenes_trabajo oo
  JOIN public.contacto_direcciones cd ON cd.contacto_id = oo.contacto_id
  WHERE oo.contacto_direccion IS NOT NULL
    AND cd.texto = oo.contacto_direccion
    AND oo.contacto_direccion_lat IS NULL
    AND cd.lat IS NOT NULL
    AND cd.lng IS NOT NULL
    AND oo.publicada = true
  ORDER BY oo.id, cd.es_principal DESC, cd.creado_en
) sub
WHERE o.id = sub.oid;

COMMENT ON COLUMN public.ordenes_trabajo.contacto_direccion_lat IS
  'Snapshot de latitud de la dirección. Se completa al crear/editar la OT desde contacto_direcciones.lat. Mientras la OT no esté publicada, los cambios de la dirección apuntada se propagan automáticamente.';

COMMENT ON COLUMN public.ordenes_trabajo.contacto_direccion_lng IS
  'Snapshot de longitud de la dirección. Ver comentario de contacto_direccion_lat.';
