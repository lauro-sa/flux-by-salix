-- ──────────────────────────────────────────────────────────────────
-- Plantilla recibo_haberes_nomina v2 — extendida con link al PDF.
-- ──────────────────────────────────────────────────────────────────
--
-- IMPORTANTE: esta migración cambia el cuerpo de una plantilla
-- aprobada por Meta. Al aplicarla, el estado_meta vuelve a 'BORRADOR'
-- y los envíos por WhatsApp QUEDAN BLOQUEADOS hasta que la plantilla
-- sea re-aprobada por Meta (24-48 hs aprox).
--
-- Pasos para activar:
--   1. Aplicar este SQL (ver más abajo cómo).
--   2. Ir a Inbox → Configuración → Plantillas WhatsApp → "Recibo de
--      haberes" → "Enviar a Meta para aprobación".
--   3. Esperar el cambio de estado a APPROVED (notificación de Meta).
--   4. Mientras tanto, los envíos por correo siguen funcionando.
--
-- Cambios respecto del cuerpo actual:
--   - Mantenemos el estilo (emojis, secciones, asteriscos para bold)
--     y los 11 slots originales (nombre, días, horario, tardanzas,
--     bruto, descuento_1..4, neto).
--   - Agregamos UN slot nuevo `enlace_recibo` al pie del mensaje:
--     "📎 Ver recibo completo: {{12}}". El backend ya resuelve la
--     variable contra `pagos_nomina.comprobante_url` (firmada 30 días).
--   - Conceptos de contrato (Presentismo/Antigüedad) y bonos siguen
--     fuera del WhatsApp — viven en el PDF al que apunta el link. Ver
--     `seccion_conceptos` del correo y la tabla de haberes del PDF.
--
-- Decisión de scope: NO sumamos slots para haberes/bonos visibles en
-- el WA porque cada slot vacío se rellena con "—" y queda feo en los
-- recibos sin conceptos extra (mayoría). El PDF es la fuente formal,
-- WA es solo la notificación.

-- Asumimos UN solo empresa_id en flux-dev — si se replica a varios
-- tenants, el operador debe ejecutar este UPDATE para cada empresa_id
-- que tenga la plantilla cargada. El WHERE por nombre_api es seguro:
-- si la empresa no tiene la plantilla, no afecta nada.

UPDATE plantillas_whatsapp
SET
  componentes = jsonb_build_object(
    'encabezado', jsonb_build_object(
      'tipo', 'TEXT',
      'texto', 'Recibo — {{1}}',
      'ejemplo', 'Quincena 16-30 Abril 2026',
      'mapeo_variable', 'periodo'
    ),
    'cuerpo', jsonb_build_object(
      'texto', E'Hola *{{1}}*, te compartimos tu recibo de haberes 📄\n\n📊 *Asistencia del período*\n\n✅ Días trabajados: *{{2}} de {{3}}*\n🕘 A horario: {{4}}\n⏰ Tardanzas: {{5}}\n\n*Bruto del período*\n*{{6}}*\n\n➖ *Adelantos y descuentos*\n{{7}}\n{{8}}\n{{9}}\n{{10}}\n\n*Neto a transferir:* {{11}}\n\n📎 Ver recibo completo: {{12}}\n\nCualquier consulta, escribinos 🙌',
      'ejemplos', jsonb_build_array(
        'José Luis Romero',
        '9',
        '11',
        '6',
        '3',
        '$340.000',
        '• A favor del período anterior · −$18.000',
        '• Inyectores cuota 2/2 · 17 abr · −$58.000',
        '• Retiro de cajero · 26 abr · −$50.000',
        '• Adelanto compra ML · 29 abr · −$30.229',
        '$183.771',
        'https://flux.salixweb.com/r/abc123'
      ),
      'mapeo_variables', jsonb_build_array(
        'nombre_empleado',
        'dias_trabajados',
        'dias_laborales',
        'dias_a_horario',
        'dias_tardanza',
        'monto_bruto',
        'descuento_1',
        'descuento_2',
        'descuento_3',
        'descuento_4',
        'monto_neto',
        'enlace_recibo'
      )
    ),
    'pie_pagina', jsonb_build_object(
      'texto', 'Enviado desde Flux by Salix'
    )
  ),
  -- Devuelve la plantilla a BORRADOR — los envíos WA se bloquean hasta
  -- que Meta apruebe la nueva versión. El editor de plantillas tiene
  -- el botón "Enviar a Meta" que dispara la aprobación.
  estado_meta = 'BORRADOR',
  editado_en = now()
WHERE nombre_api = 'recibo_haberes_nomina';

-- Para deshacer (rollback a la versión APPROVED actual):
--   UPDATE plantillas_whatsapp
--   SET estado_meta = 'APPROVED',
--       componentes = '<JSON de la versión vieja>'::jsonb
--   WHERE nombre_api = 'recibo_haberes_nomina';
--
-- La versión vieja queda registrada en `auditoria_plantillas_whatsapp`
-- (triggerada automáticamente). Para recuperarla:
--   SELECT cambios_antes FROM auditoria_plantillas_whatsapp
--   WHERE tabla = 'plantillas_whatsapp'
--     AND registro_id IN (SELECT id FROM plantillas_whatsapp WHERE nombre_api = 'recibo_haberes_nomina')
--   ORDER BY creado_en DESC LIMIT 1;
