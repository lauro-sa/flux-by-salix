-- =============================================================================
-- Seguridad: cierre de advisores de RLS reportados por el linter de Supabase
-- Aplicado: 2026-04-22
-- =============================================================================
-- Este archivo consolida cuatro cambios aplicados a producción por MCP para
-- cerrar los ERRORs de seguridad del advisor:
--
--   1. Eliminar políticas RLS permisivas (USING/WITH CHECK = true) que anulaban
--      las políticas correctas en contactos_emergencia, documentos_usuario e
--      info_bancaria.
--   2. Habilitar RLS en empresas, perfiles, campos_fiscales_pais y
--      catalogo_modulos (ya tenían políticas pero RLS deshabilitado).
--   3. Cambiar vista canales_unificados a SECURITY INVOKER para que respete
--      RLS de las tablas subyacentes.
--   4. Fijar search_path = public, pg_temp en funciones del proyecto para
--      prevenir inyección por manipulación del search_path del caller.
-- =============================================================================

-- ── 1. Eliminar políticas permisivas duplicadas ─────────────────────────────
DROP POLICY IF EXISTS contactos_emergencia_insert ON public.contactos_emergencia;
DROP POLICY IF EXISTS contactos_emergencia_update ON public.contactos_emergencia;
DROP POLICY IF EXISTS contactos_emergencia_select ON public.contactos_emergencia;

DROP POLICY IF EXISTS documentos_usuario_tbl_insert ON public.documentos_usuario;
DROP POLICY IF EXISTS documentos_usuario_tbl_update ON public.documentos_usuario;
DROP POLICY IF EXISTS documentos_usuario_tbl_select ON public.documentos_usuario;
DROP POLICY IF EXISTS documentos_usuario_tbl_delete ON public.documentos_usuario;

DROP POLICY IF EXISTS info_bancaria_insert ON public.info_bancaria;
DROP POLICY IF EXISTS info_bancaria_update ON public.info_bancaria;
DROP POLICY IF EXISTS info_bancaria_select ON public.info_bancaria;

-- ── 2. Habilitar RLS en tablas base ─────────────────────────────────────────
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campos_fiscales_pais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_modulos ENABLE ROW LEVEL SECURITY;

-- catalogo_modulos no tenía políticas: todos los autenticados lo leen (es
-- catálogo estático que alimenta /api/modulos para armar el sidebar).
CREATE POLICY "Usuarios autenticados pueden leer catálogo de módulos"
  ON public.catalogo_modulos
  FOR SELECT
  TO authenticated
  USING (true);

-- ── 3. Vista canales_unificados como SECURITY INVOKER ───────────────────────
ALTER VIEW public.canales_unificados SET (security_invoker = true);

-- ── 4. search_path fijo en funciones del proyecto ───────────────────────────
ALTER FUNCTION public.actualizar_contadores_visita_direccion() SET search_path = public, pg_temp;
ALTER FUNCTION public.actualizar_conteo_producto_estado() SET search_path = public, pg_temp;
ALTER FUNCTION public.actualizar_conteo_producto_linea() SET search_path = public, pg_temp;
ALTER FUNCTION public.actualizar_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.actualizar_timestamp_salix_ia() SET search_path = public, pg_temp;
ALTER FUNCTION public.actualizar_timestamp_visitas() SET search_path = public, pg_temp;
ALTER FUNCTION public.buscar_conocimiento_similar(p_empresa_id uuid, p_embedding vector, p_limite integer, p_umbral double precision) SET search_path = public, pg_temp;
ALTER FUNCTION public.contar_correos_inbox(p_empresa_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.custom_access_token_hook(event jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.empresa_actual() SET search_path = public, pg_temp;
ALTER FUNCTION public.immutable_array_to_string(arr text[], sep text) SET search_path = public, pg_temp;
ALTER FUNCTION public.instalar_modulos_base() SET search_path = public, pg_temp;
ALTER FUNCTION public.limpiar_historial_recientes() SET search_path = public, pg_temp;
ALTER FUNCTION public.programar_purga_modulo() SET search_path = public, pg_temp;
ALTER FUNCTION public.recalcular_totales_presupuesto(p_presupuesto_id uuid, p_usuario_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.rol_actual() SET search_path = public, pg_temp;
ALTER FUNCTION public.seed_actividades_config() SET search_path = public, pg_temp;
ALTER FUNCTION public.seed_config_presupuestos(p_empresa_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.seed_tipos_contacto(p_empresa_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.seed_tipos_evento_calendario(p_empresa_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.siguiente_codigo(p_empresa_id uuid, p_entidad text) SET search_path = public, pg_temp;
