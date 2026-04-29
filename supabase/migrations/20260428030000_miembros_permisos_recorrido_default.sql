-- Permisos default del visitador para sus recorridos.
--
-- Hasta ahora los permisos del recorrido (puede_reordenar, puede_agregar_paradas,
-- puede_quitar_paradas, puede_cambiar_duracion, puede_cancelar) se guardaban solo
-- en `recorridos.config` y aplicaban únicamente al recorrido del día. Eso obligaba
-- al coordinador a configurarlos cada día para cada visitador.
--
-- Con esta columna el visitador tiene un set de permisos por DEFAULT que se aplica
-- a todos sus recorridos futuros. El modal del recorrido permite al coordinador
-- elegir si los cambios aplican solo al día (recorridos.config) o también como
-- nuevo default del visitador (esta columna).

ALTER TABLE public.miembros
  ADD COLUMN IF NOT EXISTS permisos_recorrido_default jsonb;
