-- Agrega módulos 'notas' y 'recordatorios' al sistema de permisos.
-- Son features personales del shell: cada miembro ve solo lo suyo, sin ver_todos.
-- Para miembros con permisos_custom (overrides manuales del admin) los módulos
-- nuevos no existen en su mapa y `resolverPermiso` devolvería false. Esta
-- migración inyecta los defaults para que no queden capados tras el deploy.
--
-- No toca miembros sin permisos_custom — esos ya heredan los defaults del rol
-- desde PERMISOS_POR_ROL en src/lib/permisos-constantes.ts.

UPDATE miembros
SET permisos_custom = permisos_custom || jsonb_build_object(
  'notas', to_jsonb(ARRAY['ver_propio','crear','editar','eliminar']),
  'recordatorios', to_jsonb(ARRAY['ver_propio','crear','editar','eliminar','completar'])
)
WHERE permisos_custom IS NOT NULL
  AND (
    NOT (permisos_custom ? 'notas')
    OR NOT (permisos_custom ? 'recordatorios')
  );
