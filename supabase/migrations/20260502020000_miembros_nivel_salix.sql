-- Reemplaza el toggle binario `salix_ia_habilitado` (deprecado) por un nivel
-- de 3 valores que define la capacidad del asistente para cada miembro:
--
--   'ninguno'  → sin acceso (el endpoint corta antes de invocar el modelo)
--   'personal' → solo tools personales sobre los datos del propio empleado
--                (recibo del periodo, próximo pago, días trabajados, tardanzas,
--                inasistencias). No accede a datos de otros usuarios ni a
--                acciones de gestión.
--   'completo' → todas las tools, scope-eadas por el rol/permisos del miembro
--                como hasta ahora.
--
-- Los flags de canal `salix_ia_web` y `salix_ia_whatsapp` siguen separados:
-- deciden DÓNDE puede usar Salix (app web vs WhatsApp), ortogonal al nivel.
-- Cuando `nivel_salix = 'ninguno'`, los flags de canal no tienen efecto.

ALTER TABLE public.miembros
  ADD COLUMN IF NOT EXISTS nivel_salix text NOT NULL DEFAULT 'ninguno'
    CHECK (nivel_salix IN ('completo', 'personal', 'ninguno'));

-- Backfill desde el toggle binario deprecado: quien tenía Salix habilitado
-- pasa a 'completo' (mantiene el comportamiento previo). El resto queda en
-- 'ninguno' por el default.
UPDATE public.miembros
   SET nivel_salix = 'completo'
 WHERE salix_ia_habilitado = true;

-- Eliminamos la columna deprecada. Hoy solo la mantenía sincronizada la UI
-- de TabInformacion como espejo de los flags de canal: ningún consumidor la
-- usa para decidir acceso, así que el drop es seguro.
ALTER TABLE public.miembros DROP COLUMN salix_ia_habilitado;

COMMENT ON COLUMN public.miembros.nivel_salix IS
  'Nivel de acceso al asistente Salix IA: ninguno | personal | completo. Personal expone solo tools sobre datos propios del empleado.';
