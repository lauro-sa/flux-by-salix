-- =============================================================
-- 113: Trigger para disparador `inbox.mensaje_recibido` del motor de flujos
-- =============================================================
-- El motor de Flujos (sql/054) opera sobre la tabla `cambios_estado`:
-- un Database Webhook escucha INSERTs en esa tabla y llama a la Edge
-- Function `dispatcher-workflows`. Esta migración engancha los mensajes
-- entrantes de `mensajes` al mismo carril: cada vez que entra un correo
-- (o un mensaje de otro canal en el futuro), se inserta una fila en
-- `cambios_estado` con entidad_tipo='mensaje', estado_anterior=NULL,
-- estado_nuevo='recibido', y el dispatcher mira los flujos con
-- disparador `inbox.mensaje_recibido` que matcheen.
--
-- Beneficio: cero código nuevo en el dispatcher fuera del shape match
-- — todo el camino INSERT → webhook → edge function → ejecucion_flujo
-- ya existe. Reusamos la infraestructura del PR 14.
--
-- Costo: una fila adicional en `cambios_estado` por cada correo
-- entrante. `cambios_estado` ya recibe writes de presupuestos, visitas,
-- cuotas, etc. — el volumen extra por correos es comparable.
--
-- Filtros aplicados en el trigger (antes de insertar):
--   - Solo mensajes entrantes (es_entrante=true).
--   - Sin notas internas (es_nota_interna=false).
--   - Sin mensajes eliminados (eliminado_en IS NULL).
--   - Solo si la conversación tiene canal_id (sino, no podemos
--     determinar tipo de canal — fallaría el match de canal_ids).
--
-- El `contexto` jsonb llevará suficiente metadata para que el
-- dispatcher pueda matchear por `canal_ids` y el executor pueda usar
-- el mensaje original como base de la respuesta automática (threading,
-- destinatario, cuenta origen).
-- =============================================================

CREATE OR REPLACE FUNCTION public.mensajes_entrantes_a_cambios_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canal_id uuid;
  v_canal_tipo text;
BEGIN
  -- Filtros de entrada.
  IF NEW.es_entrante IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.es_nota_interna IS TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.eliminado_en IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Leer canal de la conversación. Si la conversación no tiene
  -- canal_id (caso defensivo — todas deberían tenerlo), no disparamos.
  SELECT c.canal_id INTO v_canal_id
  FROM conversaciones c
  WHERE c.id = NEW.conversacion_id
    AND c.empresa_id = NEW.empresa_id
  LIMIT 1;

  IF v_canal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Deducir tipo de canal a partir de `tipo_contenido` del mensaje
  -- (no hay columna `canal_tipo` en conversaciones).
  -- `email_html` y `email_text` (futuro) → correo.
  -- `texto`, `imagen`, `audio` con `wa_message_id` no nulo → whatsapp.
  -- Por ahora solo soportamos correo en el motor; whatsapp queda como
  -- extensión futura (cuando se sume al tipo `tipo_canal` del shape).
  IF NEW.tipo_contenido LIKE 'email_%' THEN
    v_canal_tipo := 'correo';
  ELSIF NEW.wa_message_id IS NOT NULL THEN
    v_canal_tipo := 'whatsapp';
  ELSE
    -- Tipo desconocido: no disparamos. Mejor falsos negativos que
    -- disparar con tipo inferido mal.
    RETURN NEW;
  END IF;

  -- INSERT en cambios_estado. El dispatcher (Database Webhook) ya está
  -- configurado para reaccionar a INSERTs en esta tabla y va a recibir
  -- el evento sin más infra.
  INSERT INTO cambios_estado (
    empresa_id,
    entidad_tipo,
    entidad_id,
    estado_anterior,
    estado_nuevo,
    grupo_anterior,
    grupo_nuevo,
    origen,
    usuario_id,
    usuario_nombre,
    motivo,
    metadatos,
    contexto
  ) VALUES (
    NEW.empresa_id,
    'mensaje',
    NEW.id,
    NULL,
    'recibido',
    NULL,
    'recibido',
    'sync_inbox',
    NULL,
    NULL,
    NULL,
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
        'correo_references',
          COALESCE(to_jsonb(NEW.correo_references), '[]'::jsonb),
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
$$;

COMMENT ON FUNCTION public.mensajes_entrantes_a_cambios_estado() IS
  'Engancha mensajes entrantes al motor de Flujos via cambios_estado. '
  'Inserta entidad_tipo=mensaje, estado_nuevo=recibido para que el '
  'dispatcher matchee flujos con disparador inbox.mensaje_recibido.';

-- DROP idempotente para que la migración sea re-ejecutable.
DROP TRIGGER IF EXISTS mensajes_entrantes_a_cambios_estado_trg ON public.mensajes;

CREATE TRIGGER mensajes_entrantes_a_cambios_estado_trg
AFTER INSERT ON public.mensajes
FOR EACH ROW
EXECUTE FUNCTION public.mensajes_entrantes_a_cambios_estado();

COMMENT ON TRIGGER mensajes_entrantes_a_cambios_estado_trg ON public.mensajes IS
  'Dispara flujos con inbox.mensaje_recibido cuando entra un correo. '
  'Filtra entrantes, no internos, no eliminados, con canal_id resoluble.';
