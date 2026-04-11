-- Agregar campo config (jsonb) a recorridos para permisos del visitador
-- Almacena: {puede_reordenar, puede_cambiar_duracion, puede_agregar_paradas, puede_quitar_paradas, puede_cancelar}
ALTER TABLE recorridos ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}';
