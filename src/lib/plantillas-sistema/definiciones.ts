/**
 * definiciones.ts — Plantillas de correo precargadas del sistema.
 *
 * Cada empresa nueva recibe estas plantillas al crearse.
 * Son editables pero restaurables al original (como Odoo).
 *
 * Las variables usan las claves correctas de src/lib/variables/entidades.ts.
 * Se usa en: seed de onboarding, restaurar plantilla de sistema.
 */

// ─── Tipo de definición ───

export interface DefinicionPlantillaSistema {
  clave: string
  nombre: string
  categoria: string
  asunto: string
  contenido_html: string
  modulos: string[]
  orden: number
}

// ─── Plantillas de presupuestos ───

const ENVIO_PRESUPUESTO: DefinicionPlantillaSistema = {
  clave: 'envio_presupuesto',
  nombre: 'Envío de presupuesto',
  categoria: 'presupuesto',
  asunto: 'Presupuesto {{presupuesto.numero}} | {{contacto.nombre}}',
  contenido_html: `<p>Estimado/a <strong>{{contacto.nombre}}</strong>,</p>
<p></p>
<p>Le compartimos el presupuesto <strong>{{presupuesto.numero}}</strong>, correspondiente al trabajo solicitado en <strong>{{contacto.calle_altura}}</strong>.</p>
<p>Puede revisarlo en formato PDF o acceder directamente desde el portal presionando el botón <strong>"Ver Presupuesto"</strong> aquí arriba.</p>
<p></p>
<p><strong>¿Cómo continuar?</strong></p>
<p>1. Presione <strong>"Ver Presupuesto"</strong> desde este correo o acceda desde la web mediante el botón <strong>"Aceptar y firmar"</strong>.</p>
<p>2. Revise el presupuesto y fírmelo digitalmente para confirmar su aprobación.</p>
<p>3. Una vez firmado, se habilitarán automáticamente <strong>los datos bancarios para realizar el pago.</strong></p>
<p></p>
<p>Una vez realizado el pago, por favor <strong>responda a este correo adjuntando el comprobante.</strong> Luego coordinaremos la fecha de ejecución del trabajo.</p>
<p></p>
<p>Agradecemos su confianza en <strong>{{empresa.nombre}}</strong>.</p>
<p>Quedamos a disposición ante cualquier consulta.</p>
<p></p>
<p>Saludos cordiales</p>`,
  modulos: ['presupuestos'],
  orden: 0,
}

const SOLICITUD_ADELANTO: DefinicionPlantillaSistema = {
  clave: 'solicitud_adelanto',
  nombre: 'Solicitud de adelanto',
  categoria: 'presupuesto',
  asunto: 'Solicitud de adelanto — Presupuesto {{presupuesto.numero}} | {{empresa.nombre}}',
  contenido_html: `<p>Hola <strong>{{contacto.nombre_completo}}</strong>,</p>
<p></p>
<p>Te escribimos en referencia al presupuesto <strong>N.º {{presupuesto.numero}}</strong>, por un importe total de <strong>{{presupuesto.total_final}}</strong>.</p>
<p></p>
<p>Para dar inicio a los trabajos, es necesario abonar el adelanto correspondiente según las condiciones pactadas (<strong>{{presupuesto.condicion_pago_label}}</strong>).</p>
<p>El monto a transferir para comenzar es de <strong>{{presupuesto.adelanto_monto}}</strong>.</p>
<p></p>
<p><strong>Datos de la cuenta bancaria:</strong></p>
<p><em>(Completar con los datos bancarios de la empresa)</em></p>
<p></p>
<p>Por favor, una vez que hayas efectuado la transferencia, te agradeceríamos que nos envíes <strong>el comprobante correspondiente</strong>. Esto nos permitirá <strong>registrar el pago</strong> y <strong>dar inicio formal a la orden de trabajo</strong>.</p>
<p></p>
<p>Gracias por tu confianza en <strong>{{empresa.nombre}}</strong>.</p>`,
  modulos: ['presupuestos'],
  orden: 1,
}

const SOLICITUD_PAGO_FINAL: DefinicionPlantillaSistema = {
  clave: 'solicitud_pago_final',
  nombre: 'Solicitud de pago final',
  categoria: 'presupuesto',
  asunto: 'Solicitud de pago final — Presupuesto {{presupuesto.numero}}',
  contenido_html: `<p>Hola <strong>{{contacto.nombre_completo}}</strong>,</p>
<p></p>
<p>Te escribimos para informarte que el trabajo correspondiente al presupuesto <strong>N.º {{presupuesto.numero}}</strong>, por un importe total de <strong>{{presupuesto.total_final}}</strong>, ha sido finalizado.</p>
<p></p>
<p>De acuerdo con las condiciones pactadas (<strong>{{presupuesto.condicion_pago_label}}</strong>), el saldo pendiente es de <strong>{{presupuesto.pago_final_monto}}</strong>.</p>
<p></p>
<p><strong>Datos de la cuenta bancaria:</strong></p>
<p><em>(Completar con los datos bancarios de la empresa)</em></p>
<p></p>
<p>Por favor, una vez que hayas efectuado la transferencia, te agradeceríamos que nos envíes <strong>el comprobante correspondiente</strong> respondiendo a este correo. Esto nos permitirá <strong>registrar el pago</strong> y proceder al <strong>cierre de la orden de trabajo</strong>.</p>
<p></p>
<p>Gracias por tu confianza en <strong>{{empresa.nombre}}</strong>.</p>`,
  modulos: ['presupuestos'],
  orden: 2,
}

const RECORDATORIO_VENCIMIENTO: DefinicionPlantillaSistema = {
  clave: 'recordatorio_vencimiento',
  nombre: 'Recordatorio de vencimiento',
  categoria: 'presupuesto',
  asunto: 'Recordatorio — Presupuesto {{presupuesto.numero}} próximo a vencer',
  contenido_html: `<p>Hola <strong>{{contacto.nombre_completo}}</strong>,</p>
<p></p>
<p>Te escribimos para recordarte que el presupuesto <strong>N.º {{presupuesto.numero}}</strong>, por un importe de <strong>{{presupuesto.total_final}}</strong>, tiene fecha de vencimiento el <strong>{{presupuesto.fecha_vencimiento}}</strong>.</p>
<p></p>
<p>Si ya tomaste una decisión, podés aceptarlo directamente desde el portal presionando <strong>"Ver Presupuesto"</strong> en este correo.</p>
<p></p>
<p>Si tenés alguna consulta o necesitás ajustes, no dudes en responder a este mensaje.</p>
<p></p>
<p>Quedamos a disposición.</p>
<p>Saludos cordiales,</p>
<p><strong>{{empresa.nombre}}</strong></p>`,
  modulos: ['presupuestos'],
  orden: 3,
}

const REENVIO_PRESUPUESTO: DefinicionPlantillaSistema = {
  clave: 'reenvio_presupuesto',
  nombre: 'Re-envío de presupuesto',
  categoria: 'presupuesto',
  asunto: 'Re-envío — Presupuesto {{presupuesto.numero}} | {{contacto.nombre}}',
  contenido_html: `<p>Hola <strong>{{contacto.nombre}}</strong>,</p>
<p></p>
<p>Te reenviamos el presupuesto <strong>{{presupuesto.numero}}</strong> para tu revisión.</p>
<p>Podés acceder al documento completo presionando el botón <strong>"Ver Presupuesto"</strong> aquí arriba, o descargarlo en formato PDF.</p>
<p></p>
<p>Si tenés alguna consulta, no dudes en responder a este correo.</p>
<p></p>
<p>Saludos cordiales,</p>
<p><strong>{{empresa.nombre}}</strong></p>`,
  modulos: ['presupuestos'],
  orden: 4,
}

const CONFIRMACION_ADELANTO: DefinicionPlantillaSistema = {
  clave: 'confirmacion_adelanto',
  nombre: 'Confirmación de adelanto recibido',
  categoria: 'presupuesto',
  asunto: 'Adelanto recibido — Presupuesto {{presupuesto.numero}} | {{empresa.nombre}}',
  contenido_html: `<p>Hola <strong>{{contacto.nombre_completo}}</strong>,</p>
<p></p>
<p>Te confirmamos que hemos recibido correctamente el comprobante del adelanto correspondiente al presupuesto <strong>N.º {{presupuesto.numero}}</strong>.</p>
<p></p>
<p>El adelanto ha sido registrado y <strong>el trabajo queda confirmado para su ejecución</strong>.</p>
<p></p>
<p>En los próximos días nos estaremos comunicando para coordinar la <strong>fecha de inicio</strong> y los detalles de ejecución del trabajo.</p>
<p></p>
<p>Agradecemos tu confianza en <strong>{{empresa.nombre}}</strong>.</p>
<p>Quedamos a disposición ante cualquier consulta.</p>
<p></p>
<p>Saludos cordiales</p>`,
  modulos: ['presupuestos'],
  orden: 5,
}

// ─── Plantillas de facturación ───

const ENVIO_FACTURA: DefinicionPlantillaSistema = {
  clave: 'envio_factura',
  nombre: 'Envío de factura',
  categoria: 'facturacion',
  asunto: 'Factura del presupuesto {{presupuesto.numero}} | {{empresa.nombre}}',
  contenido_html: `<p>Hola <strong>{{contacto.nombre_completo}}</strong>,</p>
<p></p>
<p>Adjuntamos la factura correspondiente al presupuesto <strong>{{presupuesto.numero}}</strong> por un monto total de <strong>{{presupuesto.total_final}}</strong>.</p>
<p>Quedamos a disposición por cualquier consulta.</p>
<p></p>
<p>Gracias por tu confianza en <strong>{{empresa.nombre}}</strong>.</p>`,
  modulos: ['presupuestos'],
  orden: 5,
}

// ─── Plantilla de nómina ───
// Migrada desde src/lib/plantilla-correo-nomina.ts (constantes hardcodeadas)

const RECIBO_NOMINA: DefinicionPlantillaSistema = {
  clave: 'recibo_nomina',
  nombre: 'Recibo de haberes',
  categoria: 'nomina',
  asunto: 'Recibo de haberes — {{nomina.periodo}}',
  contenido_html: `<p>Hola <strong>{{nomina.nombre_empleado}}</strong>,</p>

<p>Te compartimos el detalle de tu recibo de haberes correspondiente al período <strong>{{nomina.concepto}}</strong>.</p>

<br/>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <!-- Monto a pagar -->
  <tr>
    <td style="padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px 8px 0 0;">
      <p style="margin:0;font-size:11px;color:#15803d;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Monto a pagar</p>
      <p style="margin:6px 0 0;font-size:26px;font-weight:800;color:#166534;">{{nomina.monto_abonado}}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#16a34a;">{{nomina.compensacion_tipo}} · {{nomina.compensacion_detalle}}</p>
    </td>
  </tr>

  <!-- Asistencia (generado condicionalmente — incluye feriados si aplica) -->
  {{nomina.seccion_asistencia}}

  <!-- Horas (generado condicionalmente) -->
  {{nomina.seccion_horas}}

  <!-- Nota almuerzo (solo si hubo fichaje de almuerzo) -->
  {{nomina.seccion_nota}}

</table>

<p style="font-size:13px;color:#64748b;">Si tenés alguna consulta sobre este recibo, no dudes en comunicarte con nosotros.</p>

<p>Saludos,<br/><strong>{{empresa.nombre}}</strong></p>`,
  modulos: ['asistencias'],
  orden: 6,
}

// ─── Plantilla general ───

const BIENVENIDA_CONTACTO: DefinicionPlantillaSistema = {
  clave: 'bienvenida_contacto',
  nombre: 'Bienvenida a nuevo contacto',
  categoria: 'general',
  asunto: 'Bienvenido/a | {{empresa.nombre}}',
  contenido_html: `<p>Hola <strong>{{contacto.nombre}}</strong>,</p>
<p></p>
<p>Es un placer saludarte. Te damos la bienvenida como contacto de <strong>{{empresa.nombre}}</strong>.</p>
<p></p>
<p>A partir de ahora podrás recibir presupuestos, documentos y novedades directamente por este medio.</p>
<p></p>
<p>Si tenés alguna consulta, no dudes en responder a este correo.</p>
<p></p>
<p>Saludos cordiales,</p>
<p><strong>{{empresa.nombre}}</strong></p>`,
  modulos: ['contactos'],
  orden: 7,
}

// ─── Exportar todas las plantillas ───

export const PLANTILLAS_SISTEMA: DefinicionPlantillaSistema[] = [
  ENVIO_PRESUPUESTO,
  SOLICITUD_ADELANTO,
  SOLICITUD_PAGO_FINAL,
  RECORDATORIO_VENCIMIENTO,
  CONFIRMACION_ADELANTO,
  REENVIO_PRESUPUESTO,
  ENVIO_FACTURA,
  RECIBO_NOMINA,
  BIENVENIDA_CONTACTO,
]

/**
 * Obtiene una plantilla de sistema por su clave.
 * Útil para fallback cuando no existe en BD.
 */
export function obtenerPlantillaSistemaPorClave(clave: string): DefinicionPlantillaSistema | undefined {
  return PLANTILLAS_SISTEMA.find(p => p.clave === clave)
}
