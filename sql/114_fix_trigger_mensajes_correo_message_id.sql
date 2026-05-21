-- =============================================================
-- sql/114 — Fix trigger mensajes_entrantes_a_cambios_estado
-- =============================================================
-- Aplicado a flux-dev el 2026-05-20 vía MCP supabase tras diagnosticar
-- que el flujo "Respuesta automática fuera de horario" de Herreelec
-- nunca disparaba aunque el correo llegaba al inbox.
--
-- BUG ORIGINAL (sql/113):
--   El trigger detectaba correos por `tipo_contenido LIKE 'email_%'`,
--   pero los mensajes de correo entrantes se guardan con
--   `tipo_contenido = 'texto'` (no hay distinción específica para
--   email en ese campo). Resultado: el trigger nunca insertaba en
--   `cambios_estado` para correos → dispatcher nunca se enteraba →
--   flujos con disparador `inbox.correo_recibido` no se ejecutaban.
--
-- FIX:
--   Detectar el canal por la presencia de campos específicos del
--   proveedor: `correo_message_id IS NOT NULL` para correo,
--   `wa_message_id IS NOT NULL` para WhatsApp. Es la misma heurística
--   que ya usa el resto del código (executor.ts, dispatcher edge
--   function).
--
-- BACKWARDS COMPAT:
--   • WhatsApp sigue detectándose igual (wa_message_id).
--   • Mensajes internos (sin correo_message_id ni wa_message_id)
--     siguen sin generar cambios_estado.
--   • El payload del cambios_estado generado es idéntico al anterior:
--     mismos campos en metadatos y contexto, solo cambia la lógica
--     de detección del `canal_tipo`.
--
-- VER TAMBIÉN: project_flujos_correo_recibido_diagnostico.md
-- =============================================================

CREATE OR REPLACE FUNCTION public.mensajes_entrantes_a_cambios_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_canal_id uuid;
  v_canal_tipo text;
BEGIN
  IF NEW.es_entrante IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.es_nota_interna IS TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.eliminado_en IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.canal_id INTO v_canal_id
  FROM conversaciones c
  WHERE c.id = NEW.conversacion_id
    AND c.empresa_id = NEW.empresa_id
  LIMIT 1;

  IF v_canal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Detección por campos específicos del proveedor.
  IF NEW.correo_message_id IS NOT NULL THEN
    v_canal_tipo := 'correo';
  ELSIF NEW.wa_message_id IS NOT NULL THEN
    v_canal_tipo := 'whatsapp';
  ELSE
    -- Mensaje interno u otro tipo: no genera cambios_estado.
    RETURN NEW;
  END IF;

  INSERT INTO cambios_estado (
    empresa_id, entidad_tipo, entidad_id, estado_anterior, estado_nuevo,
    grupo_anterior, grupo_nuevo, origen, usuario_id, usuario_nombre,
    motivo, metadatos, contexto
  ) VALUES (
    NEW.empresa_id, 'mensaje', NEW.id, NULL, 'recibido',
    NULL, 'recibido', 'sync_inbox', NULL, NULL, NULL,
    jsonb_build_object(
      'canal_id', v_canal_id::text,
      'canal_tipo', v_canal_tipo,
      'conversacion_id', NEW.conversacion_id::text
    ),
    jsonb_build_object(
      'mensaje_disparador', jsonb_build_object(
        'id', NEW.id::text,
        'canal_id', v_canal_id::text,
        'canal_tipo', v_canal_tipo,
        'conversacion_id', NEW.conversacion_id::text,
        'tipo_contenido', NEW.tipo_contenido,
        'asunto', NEW.correo_asunto,
        'correo_de', NEW.correo_de,
        'correo_message_id', NEW.correo_message_id,
        'correo_references', COALESCE(to_jsonb(NEW.correo_references), '[]'::jsonb),
        'texto_preview',
          CASE
            WHEN NEW.texto IS NOT NULL AND length(NEW.texto) > 500
              THEN substring(NEW.texto from 1 for 500) || '…'
            ELSE NEW.texto
          END
      )
    )
  );
  RETURN NEW;
END;
$function$;
