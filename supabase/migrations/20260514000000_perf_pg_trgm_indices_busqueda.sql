-- Fase 2.3 del plan de rendimiento: habilitar pg_trgm + índices GIN
-- en columnas que se usan con ILIKE '%texto%' en los listados.
-- Sin pg_trgm, esos ilike son full-scan. Con trigram, índice ~O(log n).
--
-- Aplicada en flux-dev el 2026-05-14 vía mcp__supabase__apply_migration
-- (nombre: perf_pg_trgm_indices_busqueda).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- contactos: buscar por nombre/apellido/correo/teléfono/código
CREATE INDEX IF NOT EXISTS idx_contactos_nombre_trgm
  ON contactos USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contactos_apellido_trgm
  ON contactos USING gin (apellido gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contactos_correo_trgm
  ON contactos USING gin (correo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contactos_telefono_trgm
  ON contactos USING gin (telefono gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contactos_codigo_trgm
  ON contactos USING gin (codigo gin_trgm_ops);

-- presupuestos: número, nombre snapshot, referencia
CREATE INDEX IF NOT EXISTS idx_presupuestos_numero_trgm
  ON presupuestos USING gin (numero gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_presupuestos_contacto_nombre_trgm
  ON presupuestos USING gin (contacto_nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_presupuestos_referencia_trgm
  ON presupuestos USING gin (referencia gin_trgm_ops);

-- actividades: solo titulo (descripción es texto largo, no se busca por ahí)
CREATE INDEX IF NOT EXISTS idx_actividades_titulo_trgm
  ON actividades USING gin (titulo gin_trgm_ops);

-- productos: nombre + código
CREATE INDEX IF NOT EXISTS idx_productos_nombre_trgm
  ON productos USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_productos_codigo_trgm
  ON productos USING gin (codigo gin_trgm_ops);

-- visitas: motivo + nombre snapshot
CREATE INDEX IF NOT EXISTS idx_visitas_motivo_trgm
  ON visitas USING gin (motivo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_visitas_contacto_nombre_trgm
  ON visitas USING gin (contacto_nombre gin_trgm_ops);
