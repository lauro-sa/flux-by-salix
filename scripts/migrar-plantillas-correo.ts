/**
 * Script de migración: plantillas de correo de Firebase (viejo) → Supabase (nuevo).
 * Ejecutar con: npx tsx scripts/migrar-plantillas-correo.ts
 *
 * Las plantillas se leen desde Firestore y se insertan en la tabla plantillas_respuesta de Supabase.
 * Las variables se transforman del formato viejo al nuevo.
 */

// ─── Mapeo de variables viejo → nuevo ───

const MAPEO_VARIABLES: Record<string, string> = {
  // documento.* → presupuesto.*
  'documento.numero': 'presupuesto.numero',
  'documento.tipo': 'presupuesto.estado',
  'documento.montoTotal': 'presupuesto.total_con_iva',
  'documento._montoTotal': 'presupuesto.total_con_iva',
  'documento.moneda': 'presupuesto.moneda',
  'documento.fecha': 'presupuesto.fecha_emision',
  'documento.estado': 'presupuesto.estado',
  'documento.condicionesPago': 'presupuesto.condicion_pago_label',
  'documento.fechaVencimiento': 'presupuesto.fecha_vencimiento',
  'documento.subtotal': 'presupuesto.total_neto',
  'documento.totalImpuestos': 'presupuesto.total_impuestos',
  'documento.referencia': 'presupuesto.referencia',
  'documento.destinatario': 'contacto.nombre_completo',
  'documento.direccion': 'contacto.direccion_completa',

  // contacto.* → contacto.* (la mayoría igual)
  'contacto.nombre': 'contacto.nombre_completo',
  'contacto.email': 'contacto.correo',
  'contacto.empresa': 'contacto.empresa_nombre',
  'contacto.telefono': 'contacto.telefono',
  'contacto.direccion': 'contacto.direccion_completa',
  'contacto.cuit': 'contacto.cuit',
  'contacto.condicionIVA': 'contacto.condicion_iva',

  // empresa.* (igual)
  'empresa.nombre': 'empresa.nombre',

  // usuario.* (no migrable directamente)
  'usuario.nombre': 'empresa.nombre',
  'usuario.email': 'empresa.correo_contacto',
  'usuario.sector': 'empresa.nombre',
}

function transformarVariables(contenido: string): string {
  let resultado = contenido

  // 1. Reemplazar Handlebars helpers: {{formatMoneda documento.campo}} → {{presupuesto.campo_mapeado}}
  resultado = resultado.replace(
    /\{\{formatMoneda\s+(\w+)\.(\w+)\}\}/g,
    (_, grupo, campo) => {
      const clave = `${grupo}.${campo}`
      const nueva = MAPEO_VARIABLES[clave]
      return nueva ? `{{${nueva}}}` : `{{${clave}}}`
    }
  )

  // 2. Reemplazar helpers de adelanto/pago: {{formatMoneda documento.adelanto.monto}} etc.
  resultado = resultado.replace(
    /\{\{formatMoneda\s+(\w+)\.(\w+)\.(\w+)\}\}/g,
    (_, grupo, _sub, _campo) => {
      if (grupo === 'documento') return '{{presupuesto.monto_adelanto}}'
      return `{{${grupo}}}`
    }
  )

  // 3. Reemplazar {{#each}}, {{#if}} y {{/each}}, {{/if}} (Handlebars) — quitar
  resultado = resultado.replace(/\{\{#each\s+[^}]+\}\}/g, '')
  resultado = resultado.replace(/\{\{\/each\}\}/g, '')
  resultado = resultado.replace(/\{\{#if\s+[^}]+\}\}/g, '')
  resultado = resultado.replace(/\{\{\/if\}\}/g, '')

  // 4. Reemplazar variables simples: {{grupo.campo}} → {{nuevo_grupo.nuevo_campo}}
  resultado = resultado.replace(
    /\{\{(\w+)\.(\w+)\}\}/g,
    (original, grupo, campo) => {
      const clave = `${grupo}.${campo}`
      const nueva = MAPEO_VARIABLES[clave]
      return nueva ? `{{${nueva}}}` : original
    }
  )

  return resultado
}

function derivarModulos(sector: string | null, tipoDocumento: string | null): string[] {
  if (tipoDocumento === 'presupuesto' || sector === 'presupuestos') return ['presupuestos']
  if (tipoDocumento === 'factura' || sector === 'facturas') return ['facturas']
  if (tipoDocumento === 'orden_trabajo' || sector === 'ordenesTrabajo') return ['ordenes']
  if (tipoDocumento === 'recibo' || sector === 'recibos') return ['recibos']
  if (tipoDocumento === 'informe' || sector === 'informes') return ['informes']
  if (sector === 'contactos') return ['contactos']
  return [] // todos los módulos
}

// ─── Plantillas extraídas de Firestore ───

const PLANTILLAS_FIRESTORE = [
  {
    nombre: 'Envío de presupuesto',
    asunto: 'HE {{documento.numero}}, {{documento.destinatario}} | {{documento.direccion}}',
    contenido: '<p>Estimado/a {{documento.destinatario}},</p><p></p><p>Le compartimos el documento: <strong>{{documento.numero}} </strong>correspondiente al trabajo solicitado en <strong>{{documento.direccion}}</strong></p><p>Puede revisarlo en formato PDF o acceder directamente desde el portal presionando el botón <strong>"Ver Presupuesto" </strong>aquí arriba.</p><p></p><p></p><p><strong>¿Cómo continuar?</strong></p><p>1. Presione <strong>"Ver Presupuesto" </strong>desde este correo o acceda desde la web mediante el botón <strong>"Aceptar y firmar"</strong>.</p><p>2. Revise el presupuesto y fírmelo digitalmente para confirmar su aprobación.</p><p>3. Una vez firmado, se habilitarán automáticamente <strong>los datos bancarios para realizar el pago.</strong><br></p><p><strong>Importante</strong></p><p>Si desea abonar mediante <strong>Mercado Pago o tarjeta</strong>, tenga en cuenta que se aplicarán <strong>recargos adicionales</strong>. En ese caso, le pedimos que nos lo indique previamente para <strong>actualizar el presupuesto antes de su confirmación.</strong></p><p></p><p>Una vez realizado el pago, por favor r<strong>esponda a este correo adjuntando el comprobante.</strong> Luego coordinaremos la fecha de ejecución del trabajo.</p><p></p><p></p><p>Agradecemos su confianza en <strong>{{empresa.nombre}}</strong></p><p>Quedamos a disposición ante cualquier consulta.</p><p></p><p>Saludos cordiales,</p><p>{{usuario.sector}}</p><p></p>',
    sector: 'presupuestos',
    tipoDocumento: 'presupuesto',
    esPorDefecto: true,
    esGlobal: true,
  },
  {
    nombre: 'Solicitud de adelanto',
    asunto: 'Att. {{contacto.nombre}} | Solicitud de adelanto para el presupuesto {{documento.numero}} | {{empresa.nombre}}',
    contenido: '<div style="margin:0; padding:0; font-size:13px;">\n<p style="margin:0; padding:0;">\nHola {{contacto.nombre}},<br/><br/>\n\nTe escribimos en referencia al presupuesto <strong>N.º {{documento.numero}}</strong>, por un importe total de <strong>{{formatMoneda documento.montoTotal}}</strong>.<br/><br/>\n\nPara dar inicio a los trabajos, es necesario abonar el adelanto correspondiente según las condiciones pactadas.\n<br/>De acuerdo con las condiciones (<strong>{{documento.condicionesPago}}</strong>), el monto a transferir para comenzar es de <strong>{{formatMoneda documento.adelanto.monto}}</strong>.<br/><br/>\n\n<strong>Datos de la cuenta bancaria:</strong><br/>\n<strong>Banco:</strong> Santander<br/>\n<strong>Número de cuenta:</strong> 500-066601/3<br/>\n<strong>CBU:</strong> 0720500220000006660136<br/>\n<strong>Alias:</strong> Herreelec.sas<br/>\n<strong>Razón Social:</strong> HERREELEC SAS<br/>\n<strong>CUIT:</strong> 30-71910722-9<br/><br/>\n\nPor favor, una vez que hayas efectuado la transferencia, te agradeceríamos que nos envíes <strong>el comprobante correspondiente</strong>. Esto nos permitirá <strong>registrar el pago</strong> y <strong>dar inicio formal a la orden de trabajo</strong>.<br/><br/>\n\nSi tienes alguna duda o necesitas asistencia adicional, no dudes en consultarnos.<br/><br/>\n\nGracias por tu confianza en <strong>{{empresa.nombre}}</strong>.\n</p>\n</div>\n',
    sector: null,
    tipoDocumento: null,
    esPorDefecto: false,
    esGlobal: true,
  },
  {
    nombre: 'Solicitud de pago final',
    asunto: 'Att. {{contacto.nombre}} | Solicitud de pago final para el presupuesto {{documento.numero}}',
    contenido: '<div style="margin:0; padding:0; font-size:13px;">\n<p style="margin:0; padding:0;">\nHola {{contacto.nombre}},<br/><br/>\n\nTe escribo para recordarte que el trabajo <strong>Nº {{documento.numero}}</strong>, por un importe total de <strong>{{formatMoneda documento.montoTotal}}</strong>, ha sido finalizado.<br/><br/>\n\nDe acuerdo con las condiciones pactadas (<strong>{{documento.condicionesPago}}</strong>), el saldo pendiente es de <strong>{{formatMoneda documento.pagoFinal.monto}}</strong>.<br/><br/>\n\n<strong>Datos de la cuenta bancaria:</strong><br/>\n<strong>Banco:</strong> Santander<br/>\n<strong>Número de cuenta:</strong> 500-066601/3<br/>\n<strong>CBU:</strong> 0720500220000006660136<br/>\n<strong>Alias:</strong> Herreelec.sas<br/>\n<strong>Razón Social:</strong> HERREELEC SAS<br/>\n<strong>CUIT:</strong> 30-71910722-9<br/><br/>\n\nPor favor, una vez que hayas efectuado la transferencia, te agradeceríamos que nos envíes <strong>el comprobante correspondiente</strong> respondiendo a este correo con el comprobante adjunto. Esto nos permitirá <strong>registrar el pago</strong> y proceder al <strong>cierre de la orden de trabajo</strong>.<br/><br/>\n\nSi tienes alguna duda o necesitas asistencia adicional, no dudes en consultarnos.<br/><br/>\n\nGracias por tu confianza en <strong>{{empresa.nombre}}</strong>.\n</p>\n</div>\n',
    sector: null,
    tipoDocumento: null,
    esPorDefecto: false,
    esGlobal: true,
  },
]

// ─── Migrar ───

async function migrar() {
  const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

  console.log(`\n📧 Migrando ${PLANTILLAS_FIRESTORE.length} plantillas de correo...\n`)

  for (const pl of PLANTILLAS_FIRESTORE) {
    const asuntoNuevo = transformarVariables(pl.asunto)
    const contenidoHtmlNuevo = transformarVariables(pl.contenido)
    const contenidoTexto = contenidoHtmlNuevo
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    const modulos = derivarModulos(pl.sector, pl.tipoDocumento)
    const variables = pl.esPorDefecto
      ? [{ clave: '_es_por_defecto', etiqueta: 'Por defecto', origen: 'metadata' }]
      : []

    const datos = {
      nombre: pl.nombre,
      canal: 'correo',
      asunto: asuntoNuevo,
      contenido: contenidoTexto,
      contenido_html: contenidoHtmlNuevo,
      modulos,
      disponible_para: 'todos',
      categoria: pl.tipoDocumento || null,
      variables,
    }

    console.log(`  ✏️  ${pl.nombre}`)
    console.log(`     Asunto: ${asuntoNuevo.substring(0, 60)}...`)
    console.log(`     Módulos: ${modulos.length ? modulos.join(', ') : 'todos'}`)
    console.log(`     Por defecto: ${pl.esPorDefecto ? 'sí' : 'no'}`)
    console.log()

    // Descomentar para ejecutar la inserción real:
    // const res = await fetch(`${BASE_URL}/api/inbox/plantillas`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(datos),
    // })
    // const result = await res.json()
    // console.log(`     → ${res.ok ? '✅ Creada' : '❌ Error'}: ${JSON.stringify(result).substring(0, 80)}`)
  }

  console.log('\n✅ Migración completada (modo dry-run). Descomenta el fetch para insertar.\n')
}

migrar().catch(console.error)
