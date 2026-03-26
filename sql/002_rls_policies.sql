-- =============================================================
-- RLS Policies para Flux by Salix
-- Aislamiento multi-tenant por empresa_id en JWT
-- =============================================================

-- Helper: extrae empresa_id del JWT actual
CREATE OR REPLACE FUNCTION public.empresa_actual()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() ->> 'empresa_id')::uuid;
$$;

-- Helper: extrae rol del JWT actual
CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() ->> 'rol';
$$;

-- =============================================================
-- EMPRESAS — solo miembros de la empresa pueden verla
-- =============================================================
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresas_select" ON public.empresas
  FOR SELECT USING (
    id = empresa_actual()
  );

-- Solo propietario puede editar su empresa
CREATE POLICY "empresas_update" ON public.empresas
  FOR UPDATE USING (
    id = empresa_actual()
    AND rol_actual() = 'propietario'
  );

-- Solo propietario puede eliminar su empresa
CREATE POLICY "empresas_delete" ON public.empresas
  FOR DELETE USING (
    id = empresa_actual()
    AND rol_actual() = 'propietario'
  );

-- =============================================================
-- PERFILES — cada usuario ve su propio perfil
-- Admins de la empresa ven perfiles de sus miembros
-- =============================================================
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Un usuario siempre puede ver y editar su propio perfil
CREATE POLICY "perfiles_propio_select" ON public.perfiles
  FOR SELECT USING (
    id = auth.uid()
  );

CREATE POLICY "perfiles_propio_update" ON public.perfiles
  FOR UPDATE USING (
    id = auth.uid()
  );

-- Miembros de la misma empresa pueden ver perfiles de otros miembros
CREATE POLICY "perfiles_empresa_select" ON public.perfiles
  FOR SELECT USING (
    id IN (
      SELECT m.usuario_id FROM public.miembros m
      WHERE m.empresa_id = empresa_actual()
        AND m.activo = true
    )
  );

-- =============================================================
-- MIEMBROS — visibles dentro de la empresa
-- =============================================================
ALTER TABLE public.miembros ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro activo de la empresa puede ver otros miembros
CREATE POLICY "miembros_select" ON public.miembros
  FOR SELECT USING (
    empresa_id = empresa_actual()
  );

-- Un usuario siempre puede ver sus propias membresias (para selector de empresa)
CREATE POLICY "miembros_propio_select" ON public.miembros
  FOR SELECT USING (
    usuario_id = auth.uid()
  );

-- Solo propietario/admin pueden insertar miembros (via invitaciones)
CREATE POLICY "miembros_insert" ON public.miembros
  FOR INSERT WITH CHECK (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

-- Solo propietario puede editar miembros (rol, permisos, activo)
CREATE POLICY "miembros_update" ON public.miembros
  FOR UPDATE USING (
    empresa_id = empresa_actual()
    AND rol_actual() = 'propietario'
  );

-- Administrador puede activar/desactivar miembros (pero no cambiar rol ni permisos)
CREATE POLICY "miembros_admin_update" ON public.miembros
  FOR UPDATE USING (
    empresa_id = empresa_actual()
    AND rol_actual() = 'administrador'
  );

-- Solo propietario puede eliminar miembros
CREATE POLICY "miembros_delete" ON public.miembros
  FOR DELETE USING (
    empresa_id = empresa_actual()
    AND rol_actual() = 'propietario'
  );

-- =============================================================
-- INVITACIONES — visibles para admin+ de la empresa
-- =============================================================
ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitaciones_select" ON public.invitaciones
  FOR SELECT USING (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

CREATE POLICY "invitaciones_insert" ON public.invitaciones
  FOR INSERT WITH CHECK (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

-- =============================================================
-- PERMISOS AUDITORIA — solo propietario puede ver
-- =============================================================
ALTER TABLE public.permisos_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permisos_auditoria_select" ON public.permisos_auditoria
  FOR SELECT USING (
    empresa_id = empresa_actual()
    AND rol_actual() = 'propietario'
  );

CREATE POLICY "permisos_auditoria_insert" ON public.permisos_auditoria
  FOR INSERT WITH CHECK (
    empresa_id = empresa_actual()
    AND rol_actual() = 'propietario'
  );

-- =============================================================
-- PLANTILLA PARA TABLAS DE NEGOCIO
-- Copiar y adaptar para: contactos, actividades, visitas, etc.
-- =============================================================

-- Ejemplo generico para cualquier tabla con empresa_id:
--
-- ALTER TABLE public.{tabla} ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "{tabla}_select" ON public.{tabla}
--   FOR SELECT USING (empresa_id = empresa_actual());
--
-- CREATE POLICY "{tabla}_insert" ON public.{tabla}
--   FOR INSERT WITH CHECK (empresa_id = empresa_actual());
--
-- CREATE POLICY "{tabla}_update" ON public.{tabla}
--   FOR UPDATE USING (empresa_id = empresa_actual());
--
-- CREATE POLICY "{tabla}_delete" ON public.{tabla}
--   FOR DELETE USING (empresa_id = empresa_actual());
--
-- Para tablas con visibilidad "solo lo propio" (vendedor, empleado):
-- La logica de ver_propio vs ver_todos se maneja en la capa de aplicacion
-- (API routes + useRol), no en RLS. RLS solo asegura aislamiento por empresa.
