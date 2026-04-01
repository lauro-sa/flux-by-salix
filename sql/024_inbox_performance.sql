-- Migración: optimización de performance del inbox
-- Agrega índices para búsqueda ILIKE y función RPC para contadores agregados

-- Índices para búsqueda rápida en conversaciones
CREATE INDEX IF NOT EXISTS idx_conversaciones_contacto_nombre
  ON conversaciones (empresa_id, contacto_nombre);

CREATE INDEX IF NOT EXISTS idx_conversaciones_asunto
  ON conversaciones (empresa_id, asunto);

-- Índice compuesto para contadores (usado por /api/inbox/correo/contadores)
CREATE INDEX IF NOT EXISTS idx_conversaciones_correo_contadores
  ON conversaciones (empresa_id, tipo_canal, canal_id, estado)
  WHERE tipo_canal = 'correo';

-- Función RPC para contadores agregados (evita traer todas las filas al cliente)
CREATE OR REPLACE FUNCTION contar_correos_inbox(p_empresa_id uuid)
RETURNS TABLE (
  canal_id uuid,
  estado text,
  total bigint,
  sin_leer bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.canal_id,
    c.estado,
    COUNT(*)::bigint AS total,
    COALESCE(SUM(c.mensajes_sin_leer), 0)::bigint AS sin_leer
  FROM conversaciones c
  WHERE c.empresa_id = p_empresa_id
    AND c.tipo_canal = 'correo'
  GROUP BY c.canal_id, c.estado;
$$;
