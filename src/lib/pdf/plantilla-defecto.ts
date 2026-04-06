/**
 * Plantilla HTML por defecto para la generación de PDF de presupuestos.
 * Basada en el diseño del software anterior, adaptada al motor de plantillas de Flux.
 * Variables: {nombre}, condicionales: {{#if var}}...{{/if}}, loops: {{#each nombre}}...{{/each}}
 * Se usa en: src/lib/pdf/renderizar-html.ts
 */

export const PLANTILLA_PDF_DEFECTO = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  /* ── Reset y base ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page {
    size: A4;
    margin: 0;
  }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    color: #1a1a1a;
    line-height: 1.45;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-scheme: light;
  }

  /* ── Membrete ── */
  .membrete {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 6px;
  }
  .membrete-izquierda { flex-direction: row; }
  .membrete-derecha { flex-direction: row-reverse; }
  .membrete-centro { flex-direction: column; align-items: center; text-align: center; }
  .membrete-logo {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .membrete-centro .membrete-logo { align-items: center; }
  .membrete-derecha .membrete-logo { align-items: flex-end; }
  .membrete-centro .membrete-contenido { width: 100%; }
  .membrete-logo img {
    max-height: 70px;
    object-fit: contain;
  }
  .membrete-contenido {
    flex: 1;
    min-width: 0;
    line-height: 1.25;
    font-weight: 400;
  }
  .membrete-contenido p { margin: 1px 0; }
  .membrete-alinear-derecha, .membrete-alinear-derecha * { text-align: right !important; }
  .membrete-alinear-centro, .membrete-alinear-centro * { text-align: center !important; }
  .membrete-alinear-izquierda, .membrete-alinear-izquierda * { text-align: left !important; }
  .membrete-contenido h1 { font-size: 1.25em; font-weight: normal; margin: 0 0 2px; }
  .membrete-contenido h2 { font-size: 1.1em; font-weight: normal; margin: 0 0 2px; }
  .membrete-contenido h3 { font-size: 1em; font-weight: normal; margin: 0 0 1px; }
  .membrete-contenido h4 { font-size: 0.85em; font-weight: normal; margin: 0 0 1px; }
  .membrete-separador {
    border: none;
    border-top: 1px solid #d1d5db;
    margin: 8px 0 12px;
  }

  /* ── Datos fiscales ── */
  .datos-fiscales {
    font-size: 8pt;
    color: #4b5563;
    margin-bottom: 16px;
    line-height: 1.5;
  }
  .datos-fiscales strong { color: #1a1a1a; }

  /* ── Título documento ── */
  .titulo-doc {
    font-size: 16pt;
    font-weight: 700;
    color: {color_primario};
    margin-bottom: 14px;
  }

  /* ── Info documento + cliente ── */
  .info-grid {
    display: flex;
    gap: 24px;
    margin-bottom: 18px;
  }
  .info-col { flex: 1; }
  .info-col dt {
    font-size: 7.5pt;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 6px;
  }
  .info-col dd {
    font-size: 9pt;
    color: #1f2937;
    margin: 1px 0 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .info-col dd.nombre-contacto {
    font-size: 10.5pt;
    font-weight: 600;
  }

  /* ── Tabla de líneas ── */
  .tabla-lineas {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 8.5pt;
    table-layout: fixed;
  }
  .tabla-lineas thead th {
    background: {color_primario_08};
    color: #4b5563;
    font-size: 7pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 7px 6px;
    border-bottom: 1.5px solid {color_primario_20};
    text-align: left;
    white-space: nowrap;
  }
  .tabla-lineas thead th.num { text-align: right; }
  .tabla-lineas thead th.col-desc { white-space: normal; }
  .tabla-lineas tbody td {
    padding: 6px 6px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .tabla-lineas tbody td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .tabla-lineas tbody tr { page-break-inside: avoid; }

  .linea-seccion td {
    font-weight: 600;
    background: {color_primario_05};
    color: #374151;
    padding-top: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid {color_primario_15};
  }
  .linea-nota td {
    font-style: italic;
    color: #6b7280;
    font-size: 8pt;
    border-bottom: none;
    padding-top: 2px;
    padding-bottom: 2px;
  }
  .desc-detalle {
    display: block;
    font-size: 7.5pt;
    color: #6b7280;
    margin-top: 2px;
  }

  /* ── Totales ── */
  .bloque-totales {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 18px;
  }
  .tabla-totales {
    width: 260px;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .tabla-totales td { padding: 4px 8px; }
  .tabla-totales .label { text-align: left; color: #4b5563; }
  .tabla-totales .valor {
    text-align: right;
    color: #1f2937;
    font-variant-numeric: tabular-nums;
  }
  .tabla-totales .descuento .valor { color: #dc2626; }
  .tabla-totales .total-final td {
    font-size: 11pt;
    font-weight: 700;
    color: {color_primario};
    padding-top: 8px;
    border-top: 2px solid {color_primario};
  }

  /* ── Cuotas de pago ── */
  .seccion-cuotas { margin-bottom: 16px; }
  .seccion-cuotas h3 {
    font-size: 9pt;
    font-weight: 600;
    color: #374151;
    margin-bottom: 6px;
  }
  .tabla-cuotas {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }
  .tabla-cuotas th {
    background: #f9fafb;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    padding: 5px 8px;
    text-align: left;
    border-bottom: 1px solid #d1d5db;
  }
  .tabla-cuotas td {
    padding: 5px 8px;
    border-bottom: 1px solid #e5e7eb;
  }

  /* ── Notas y condiciones ── */
  .seccion-notas { margin-bottom: 14px; page-break-inside: avoid; }
  .seccion-notas h3 {
    font-size: 9pt;
    font-weight: 600;
    color: #374151;
    margin-bottom: 4px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e5e7eb;
  }

  /* ── HTML rico ── */
  .contenido-rico { font-size: 8.5pt; color: #374151; line-height: 1.5; }
  .contenido-rico p { margin: 2px 0; }
  .contenido-rico strong, .contenido-rico b { font-weight: 700 !important; }
  .contenido-rico em { font-style: italic; }
  .contenido-rico u { text-decoration: underline; }
  .contenido-rico a { color: #2563eb; text-decoration: underline; }
  .contenido-rico ul { padding-left: 18px; list-style: disc; }
  .contenido-rico ol { padding-left: 18px; list-style: decimal; }
  .contenido-rico li { margin: 1px 0; }

  /* ── Datos bancarios ── */
  .datos-bancarios {
    margin-bottom: 14px;
    padding: 10px 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    page-break-inside: avoid;
  }
  .datos-bancarios h3 {
    font-size: 9pt;
    font-weight: 600;
    color: #374151;
    margin-bottom: 6px;
  }
  .datos-bancarios .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 16px;
    font-size: 8.5pt;
  }
  .datos-bancarios .lbl { color: #9ca3af; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
  .datos-bancarios .val { color: #1f2937; }

  /* ── Pie de página ── */
  .pie-wrapper {
    position: fixed;
    bottom: 8mm;
    left: 13mm;
    right: 13mm;
  }
  .pie-pagina {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8pt;
    color: #9ca3af;
  }
  .pie-col { flex: 1; }
  .pie-col.centro { text-align: center; }
  .pie-col.derecha { text-align: right; }
  .pie-col img { max-height: 40px; object-fit: contain; }
</style>
</head>
<body>

<!-- ═══════ MEMBRETE ═══════ -->
{{#if mostrar_membrete}}
<div class="membrete membrete-{posicion_logo}">
  {{#if mostrar_logo}}
  <!-- Logo imagen -->
  <div class="membrete-logo" style="max-width: {ancho_logo}%;">
    <img src="{empresa_logo_url}" alt="Logo" style="max-width:100%; max-height:80px;" />
  </div>
  {{/if}}
  {{#if no_mostrar_logo}}
  <!-- Texto como logo (cuando no hay imagen) -->
  <div class="membrete-logo">
    {{#if texto_logo}}
    <div style="font-size: {tamano_texto_logo}px; font-weight: 700; color: #111827; line-height: 1.2;">
      {texto_logo}
    </div>
    {{/if}}
    {{#if subtitulo_logo}}
    <div style="font-size: {tamano_subtitulo}px; color: #6b7280; margin-top: 2px;">
      {subtitulo_logo}
    </div>
    {{/if}}
  </div>
  {{/if}}
  {{#if membrete_contenido_html}}
  <div class="membrete-contenido contenido-rico membrete-alinear-{alineacion_texto}">
    {membrete_contenido_html}
  </div>
  {{/if}}
</div>
{{#if membrete_linea_separadora}}
<hr class="membrete-separador" style="border-top-width: {grosor_linea}px;{{#if color_linea_es_marca}} border-top-color: {color_primario};{{/if}}" />
{{/if}}
{{/if}}

<!-- ═══════ TÍTULO ═══════ -->
<div style="margin-bottom: 14px;">
  <div style="font-size: 7.5pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">{tipo_documento}</div>
  <div class="titulo-doc" style="margin-bottom: 0;">{numero}</div>
</div>

<!-- ═══════ CLIENTE + INFO ═══════ -->
<div class="info-grid">
  <!-- Columna izquierda: Cliente -->
  <div class="info-col">
    <dl>
      {{#if contacto_nombre}}
      <dd class="nombre-contacto" style="margin-top: 0;">{contacto_nombre}</dd>
      {{/if}}
      {{#if contacto_identificacion}}
        <dt>{contacto_identificacion_label}</dt>
        <dd>{contacto_identificacion}{{#if contacto_condicion_fiscal}} · {contacto_condicion_fiscal}{{/if}}</dd>
      {{/if}}
      {{#if contacto_direccion}}
        <dt>Domicilio (principal)</dt>
        <dd>{contacto_direccion}</dd>
      {{/if}}
      {{#if contacto_correo}}
        <dt>Correo</dt>
        <dd>{contacto_correo}</dd>
      {{/if}}
      {{#if contacto_telefono}}
        <dt>Teléfono</dt>
        <dd>{contacto_telefono}</dd>
      {{/if}}
      <!-- Atención: dirigido a -->
      {{#if atencion_nombre}}
      <div style="margin-top: 6px; padding: 5px 8px; border-left: 2px solid {color_primario_60}; background: rgba(0,0,0,0.015); border-radius: 0 3px 3px 0;">
        <div style="font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af;">Atención</div>
        <div style="font-size: 9pt; font-weight: 600; color: #1f2937;">{atencion_nombre}{{#if atencion_cargo}} <span style="font-weight: 400; font-size: 0.85em; color: #6b7280;">({atencion_cargo})</span>{{/if}}</div>
        {{#if atencion_correo}}<div style="font-size: 8pt; color: #6b7280;">{atencion_correo}</div>{{/if}}
      </div>
      {{/if}}
    </dl>
  </div>
  <!-- Columna derecha: Fechas y datos del documento -->
  <div class="info-col" style="text-align: right;">
    <dl style="text-align: right;">
      <dt>Fecha de emisión</dt>
      <dd>{fecha_emision}</dd>
      {{#if fecha_vencimiento}}
        <dt>Vencimiento</dt>
        <dd>{fecha_vencimiento}</dd>
      {{/if}}
      {{#if condicion_pago}}
        <dt>Condición de pago</dt>
        <dd>{condicion_pago}</dd>
      {{/if}}
    </dl>
  </div>
</div>

<!-- ═══════ TABLA DE LÍNEAS ═══════ -->
<table class="tabla-lineas">
  <thead>
    <tr>
      <th class="col-desc">Descripción</th>
      {{#if col_cantidad}}<th class="num" style="width:8%;">Cant.</th>{{/if}}
      {{#if col_unidad}}<th style="width:8%;">U. Medida</th>{{/if}}
      {{#if col_precio_unitario}}<th class="num" style="width:14%;">Precio unit.</th>{{/if}}
      {{#if col_descuento}}<th class="num" style="width:8%;">% Bonif.</th>{{/if}}
      {{#if col_impuesto}}<th style="width:10%;">Impuestos</th>{{/if}}
      <th class="num" style="width:14%;">Importe</th>
    </tr>
  </thead>
  <tbody>
    {{#each lineas}}
      {{#if es_seccion}}
        <tr class="linea-seccion"><td colspan="{colspan_total}">{descripcion}</td></tr>
      {{/if}}
      {{#if es_nota}}
        <tr class="linea-nota"><td colspan="{colspan_total}">{descripcion}</td></tr>
      {{/if}}
      {{#if es_descuento}}
        <tr class="linea-nota"><td colspan="{colspan_total}">Descuento: {descripcion} -{moneda_simbolo} {monto_formateado}</td></tr>
      {{/if}}
      {{#if es_producto}}
        <tr>
          <td>
            {{#if codigo_producto}}<div style="font-size: 7pt; color: #9ca3af;">{codigo_producto}</div>{{/if}}
            {descripcion}
            {{#if descripcion_detalle}}<span class="desc-detalle">{descripcion_detalle}</span>{{/if}}
          </td>
          {{#if col_cantidad}}<td class="num">{cantidad}</td>{{/if}}
          {{#if col_unidad}}<td>{unidad}</td>{{/if}}
          {{#if col_precio_unitario}}<td class="num">{moneda_simbolo} {precio_unitario_formateado}</td>{{/if}}
          {{#if col_descuento}}<td class="num">{{#if tiene_descuento}}{descuento}%{{/if}}</td>{{/if}}
          {{#if col_impuesto}}<td>{impuesto_label}</td>{{/if}}
          <td class="num">{moneda_simbolo} {subtotal_formateado}</td>
        </tr>
      {{/if}}
    {{/each}}
  </tbody>
</table>

<!-- ═══════ TOTALES ═══════ -->
<div class="bloque-totales">
  <table class="tabla-totales">
    <tr>
      <td class="label">Subtotal neto</td>
      <td class="valor">{moneda_simbolo} {subtotal_neto_formateado}</td>
    </tr>
    {{#each impuestos_desglose}}
    <tr>
      <td class="label">{label}</td>
      <td class="valor">{moneda_simbolo} {monto_formateado}</td>
    </tr>
    {{/each}}
    {{#if tiene_descuento_global}}
    <tr class="descuento">
      <td class="label">Descuento ({descuento_global_porcentaje}%)</td>
      <td class="valor">-{moneda_simbolo} {descuento_global_monto_formateado}</td>
    </tr>
    {{/if}}
    <tr class="total-final">
      <td class="label">TOTAL</td>
      <td class="valor">{moneda_simbolo} {total_final_formateado}</td>
    </tr>
  </table>
</div>

<!-- ═══════ CUOTAS DE PAGO ═══════ -->
{{#if tiene_cuotas}}
<div class="seccion-cuotas">
  <h3>Plan de Pagos</h3>
  {{#if nota_plan_pago}}<div class="contenido-rico" style="margin-bottom: 6px;">{nota_plan_pago}</div>{{/if}}
  <table class="tabla-cuotas">
    <thead>
      <tr>
        <th>Descripción</th>
        <th style="width:12%; text-align:right;">%</th>
        <th style="width:18%; text-align:right;">Monto</th>
        <th style="width:14%;">Estado</th>
      </tr>
    </thead>
    <tbody>
      {{#each cuotas}}
      <tr>
        <td>{descripcion}</td>
        <td style="text-align:right;">{porcentaje}%</td>
        <td style="text-align:right;">{moneda_simbolo} {monto_formateado}</td>
        <td>{estado_label}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
</div>
{{/if}}

<!-- ═══════ DATOS BANCARIOS ═══════ -->
{{#if mostrar_datos_bancarios}}
<div class="datos-bancarios">
  <h3>Datos para transferencia</h3>
  <div class="grid">
    {{#if banco}}<div class="lbl">Banco</div><div class="val">{banco}</div>{{/if}}
    {{#if banco_titular}}<div class="lbl">Titular</div><div class="val">{banco_titular}</div>{{/if}}
    {{#if banco_cbu}}<div class="lbl">CBU / Cuenta</div><div class="val">{banco_cbu}</div>{{/if}}
    {{#if banco_alias}}<div class="lbl">Alias</div><div class="val">{banco_alias}</div>{{/if}}
  </div>
</div>
{{/if}}

<!-- ═══════ NOTAS ═══════ -->
{{#if notas_html}}
<div class="seccion-notas">
  <h3>Notas</h3>
  <div class="contenido-rico">{notas_html}</div>
</div>
{{/if}}

<!-- ═══════ CONDICIONES ═══════ -->
{{#if condiciones_html}}
<div class="seccion-notas">
  <h3>Términos y Condiciones</h3>
  <div class="contenido-rico">{condiciones_html}</div>
</div>
{{/if}}

<!-- ═══════ PIE DE PÁGINA ═══════ -->
{{#if mostrar_pie}}
<div class="pie-wrapper">
  {{#if pie_linea_superior}}
  <div style="border-top-width: {pie_grosor_linea}px; border-top-style: solid; border-top-color: {pie_color_linea}; margin-bottom: 6px;"></div>
  {{/if}}
  <div class="pie-pagina" style="font-size: {pie_tamano_texto}px; position: static;">
    <div class="pie-col">{pie_izquierda}</div>
    <div class="pie-col centro">{pie_centro}</div>
    <div class="pie-col derecha">{pie_derecha}</div>
  </div>
</div>
{{/if}}

</body>
</html>`
