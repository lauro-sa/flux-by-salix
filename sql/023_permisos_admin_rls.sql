-- Migración: Admins tienen acceso completo (igual que propietario, excepto eliminar empresa)
-- Fecha: 2026-04-01
-- Estado: EJECUTADA en Supabase

-- EMPRESAS — admins pueden editar
DROP POLICY IF EXISTS "empresas_update" ON public.empresas;
CREATE POLICY "empresas_update" ON public.empresas
  FOR UPDATE USING (
    id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

-- MIEMBROS — admins pueden actualizar (rol, permisos, activo)
DROP POLICY IF EXISTS "miembros_update" ON public.miembros;
CREATE POLICY "miembros_update" ON public.miembros
  FOR UPDATE USING (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

-- Eliminar política limitada de admin
DROP POLICY IF EXISTS "miembros_admin_update" ON public.miembros;

-- Admins pueden eliminar miembros (el API valida que no eliminen a otro admin)
DROP POLICY IF EXISTS "miembros_delete" ON public.miembros;
CREATE POLICY "miembros_delete" ON public.miembros
  FOR DELETE USING (
    empresa_id = empresa_actual()
    AND rol_actual() IN ('propietario', 'administrador')
  );

-- NOTA: permisos_auditoria no existe aún — agregar políticas cuando se cree la tabla
