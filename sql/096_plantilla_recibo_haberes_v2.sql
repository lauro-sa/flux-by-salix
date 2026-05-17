-- ──────────────────────────────────────────────────────────────────
-- Plantilla recibo_haberes_nomina v2 — desglose completo + link al PDF.
-- ──────────────────────────────────────────────────────────────────
--
-- IMPORTANTE: esta migración cambia el cuerpo de una plantilla
-- aprobada por Meta. Al aplicarla, el estado_meta vuelve a 'BORRADOR'
-- y los envíos por WhatsApp QUEDAN BLOQUEADOS hasta que la plantilla
-- sea re-aprobada por Meta (24-48 hs aprox).
--
-- Cambios respecto del cuerpo aprobado actual (12 vars):
--   - Sumamos secciones de Haberes (Presentismo, Antigüedad, etc.) y
--     Bonos del período, además de los Descuentos del contrato
--     (Uniforme, Cuota sindical) separados de los adelantos puntuales.
--   - Reordenamos cada bullet con monto-adelante-bold para escaneo rápido:
--     `• *±$X* · Descripción · cuota X/Y · DD-mmm`
--   - Bajamos slots de adelantos puntuales de 4 a 3 (el slot 3 concatena
--     excedentes), por eso el cuerpo tiene 18 variables en total.
--   - Sumamos `enlace_recibo` (link firmado al PDF, 30 días).
--
-- Pasos para activar:
--   1. Aplicar este SQL (vía MCP supabase o psql).
--   2. Ir a Inbox → Configuración → Plantillas WhatsApp → "Recibo de
--      haberes" → "Re-enviar a Meta".
--   3. Esperar el cambio a APPROVED (notificación de Meta).
--   4. Mientras tanto, los envíos por correo siguen funcionando.

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
      'texto', E'Hola *{{1}}*, te compartimos tu recibo de haberes 📄\n\n📊 *Asistencia del período*\n\n✅ Días trabajados: *{{2}} de {{3}}*\n🕘 A horario: {{4}}\n⏰ Tardanzas: {{5}}\n\n💰 *Haberes*\nBruto base: *{{6}}*\n{{7}}\n{{8}}\n{{9}}\n\n🎁 *Bonos del período*\n{{10}}\n{{11}}\n\n➖ *Adelantos y descuentos*\n{{12}}\n{{13}}\n{{14}}\n{{15}}\n{{16}}\n\n*Neto a transferir:* {{17}}\n\n📎 Ver recibo completo: {{18}}\n\nCualquier consulta, escribinos 🙌',
      'ejemplos', jsonb_build_array(
        'José Luis Romero',
        '9',
        '11',
        '6',
        '3',
        '$340.000',
        '• *+$15.200* · Presentismo (10/11 días)',
        '• *+$12.000* · Antigüedad (3 años)',
        '—',
        '• *+$25.000* · Bono producción · 30-abr',
        '—',
        '• *−$8.500* · Uniforme cuota 2/3',
        '• *−$3.500* · Cuota sindical',
        '• *−$18.000* · A favor del período anterior',
        '• *−$58.000* · Inyectores cuota 2/2 · 17-abr',
        '• *−$50.000* · Retiro de cajero · 26-abr',
        '$235.971',
        'https://flux.salixweb.com/r/abc123'
      ),
      'mapeo_variables', jsonb_build_array(
        'nombre_empleado',
        'dias_trabajados',
        'dias_laborales',
        'dias_a_horario',
        'dias_tardanza',
        'monto_bruto',
        'haber_1',
        'haber_2',
        'haber_3',
        'bono_1',
        'bono_2',
        'descuento_contrato_1',
        'descuento_contrato_2',
        'descuento_1',
        'descuento_2',
        'descuento_3',
        'monto_neto',
        'enlace_recibo'
      )
    ),
    'pie_pagina', jsonb_build_object(
      'texto', 'Enviado desde Flux by Salix'
    )
  ),
  -- Devuelve la plantilla a BORRADOR — los envíos WA se bloquean hasta
  -- que Meta apruebe la nueva versión. El editor tiene el botón
  -- "Re-enviar a Meta" que dispara la aprobación.
  estado_meta = 'BORRADOR',
  actualizado_en = now()
WHERE nombre_api = 'recibo_haberes_nomina';

-- Para rollback (vuelta a la versión APPROVED actual de 11 vars):
--   ver `auditoria_plantillas_whatsapp` con el ultimo cambios_antes.
