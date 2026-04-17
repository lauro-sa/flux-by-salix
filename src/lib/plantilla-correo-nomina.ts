/**
 * plantilla-correo-nomina.ts — Plantilla HTML por defecto para recibos de nómina.
 * Se usa en: ModalEnviarReciboNomina (envío individual y en lote).
 *
 * Genera un correo con desglose completo de asistencia, horas y compensación.
 * Las secciones de almuerzo y salidas particulares solo aparecen si hubo fichaje.
 */

// ─── Asunto por defecto ───

export const ASUNTO_RECIBO_NOMINA = 'Recibo de haberes — {{nomina.periodo}}'

// ─── HTML por defecto del cuerpo ───
// Las variables {{nomina.seccion_horas}} y {{nomina.seccion_nota}} son bloques HTML
// generados condicionalmente por construirContextoNomina según los datos reales.

export const HTML_RECIBO_NOMINA = `<p>Hola <strong>{{nomina.nombre_empleado}}</strong>,</p>

<p>Te compartimos el detalle de tu recibo de haberes correspondiente al período <strong>{{nomina.periodo}}</strong>.</p>

<br/>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <!-- Monto a pagar -->
  <tr>
    <td style="padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px 8px 0 0;">
      <p style="margin:0;font-size:11px;color:#15803d;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Monto a pagar</p>
      <p style="margin:6px 0 0;font-size:26px;font-weight:800;color:#166534;">{{nomina.monto_bruto}}</p>
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

<p>Saludos,<br/><strong>{{empresa.nombre}}</strong></p>`

// ─── Tipos ───

export interface DatosNominaCorreo {
  nombre_empleado: string
  correo_empleado: string
  periodo: string
  dias_trabajados: number
  dias_laborales: number
  dias_ausentes: number
  dias_tardanza: number
  // Horas detalladas
  horas_brutas: string
  horas_netas: string
  horas_almuerzo: string
  horas_particular: string
  promedio_diario: string
  dias_con_almuerzo: number
  dias_con_salida_particular: number
  // Config
  descuenta_almuerzo: boolean
  // Feriados
  dias_feriados: number
  dias_trabajados_feriado: number
  // Asistencia
  porcentaje_asistencia: string
  // Compensación
  compensacion_tipo: string
  compensacion_detalle: string
  monto_bruto: number
}

// ─── Helpers para generar bloques HTML condicionales ───

const FILA = (label: string, valor: string, extra = '') =>
  `<tr><td style="padding:5px 0;${extra}">${label}</td><td style="padding:5px 0;text-align:right;font-weight:600;color:#1e293b;${extra}">${valor}</td></tr>`

const FILA_TOTAL = (label: string, valor: string) =>
  `<tr><td style="padding:5px 0;border-top:1px solid #e2e8f0;padding-top:8px;font-weight:600;color:#1e293b;">${label}</td><td style="padding:5px 0;border-top:1px solid #e2e8f0;padding-top:8px;text-align:right;font-weight:700;color:#166534;font-size:14px;">${valor}</td></tr>`

function construirSeccionAsistencia(datos: DatosNominaCorreo): string {
  const filas: string[] = []

  filas.push(FILA('Días trabajados', `${datos.dias_trabajados} de ${datos.dias_laborales}`))

  // Días a horario y tardanzas
  const diasAHorario = Math.max(0, datos.dias_trabajados - datos.dias_tardanza)
  if (datos.dias_tardanza > 0) {
    filas.push(FILA('A horario', `${diasAHorario} día${diasAHorario !== 1 ? 's' : ''}`))
    filas.push(FILA('Tardanzas', `${datos.dias_tardanza} día${datos.dias_tardanza !== 1 ? 's' : ''}`))
  }

  if (datos.dias_ausentes > 0) {
    filas.push(FILA('Ausencias', `${datos.dias_ausentes} día${datos.dias_ausentes !== 1 ? 's' : ''}`))
  }

  filas.push(FILA('Asistencia', datos.porcentaje_asistencia))

  // Feriados
  if (datos.dias_feriados > 0) {
    if (datos.dias_trabajados_feriado > 0) {
      filas.push(FILA(
        `Feriados trabajados`,
        `${datos.dias_trabajados_feriado} de ${datos.dias_feriados} feriado${datos.dias_feriados !== 1 ? 's' : ''} en el período`,
      ))
    } else {
      filas.push(FILA(
        'Feriados en el período',
        `${datos.dias_feriados} (no trabajado${datos.dias_feriados !== 1 ? 's' : ''})`,
      ))
    }
  }

  return `<tr><td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
    <p style="margin:0 0 10px;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Asistencia</p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:13px;color:#475569;">
      ${filas.join('\n      ')}
    </table>
  </td></tr>`
}

function construirSeccionHoras(datos: DatosNominaCorreo): string {
  const filas: string[] = []
  const huboAlmuerzo = datos.dias_con_almuerzo > 0
  const huboParticular = datos.dias_con_salida_particular > 0
  const hayDesglose = huboAlmuerzo || huboParticular

  if (hayDesglose) {
    // Si hay algo que descontar, mostrar brutas → descuentos → netas
    filas.push(FILA('Horas en oficina', datos.horas_brutas))

    if (huboAlmuerzo && datos.descuenta_almuerzo) {
      filas.push(FILA('Almuerzo descontado', `- ${datos.horas_almuerzo}`))
    }

    if (huboParticular) {
      filas.push(FILA(
        `Salidas particulares (${datos.dias_con_salida_particular} día${datos.dias_con_salida_particular !== 1 ? 's' : ''})`,
        `- ${datos.horas_particular}`,
      ))
    }

    filas.push(FILA_TOTAL('Horas netas trabajadas', datos.horas_netas))
  } else {
    // Sin desglose: mostrar directo las horas trabajadas
    filas.push(FILA('Horas trabajadas', datos.horas_netas, 'font-weight:600;color:#1e293b;'))
  }

  filas.push(FILA('Promedio diario', datos.promedio_diario))

  return `<tr><td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;${!hayDesglose ? 'border-radius:0 0 8px 8px;' : ''}">
    <p style="margin:0 0 10px;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Detalle de horas</p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:13px;color:#475569;">
      ${filas.join('\n      ')}
    </table>
  </td></tr>`
}

function construirSeccionNota(datos: DatosNominaCorreo): string {
  const huboAlmuerzo = datos.dias_con_almuerzo > 0
  const huboParticular = datos.dias_con_salida_particular > 0

  // Si no hubo fichaje de almuerzo ni salidas, no mostrar nota
  if (!huboAlmuerzo && !huboParticular) return ''

  const partes: string[] = []

  if (huboAlmuerzo && datos.descuenta_almuerzo) {
    partes.push(`Se descontaron ${datos.horas_almuerzo} de almuerzo (${datos.dias_con_almuerzo} día${datos.dias_con_almuerzo !== 1 ? 's' : ''} registrados).`)
  } else if (huboAlmuerzo && !datos.descuenta_almuerzo) {
    partes.push(`Se registraron ${datos.horas_almuerzo} de almuerzo pero no se descuentan según la configuración de la empresa.`)
  }

  if (huboParticular) {
    partes.push(`Se registraron ${datos.dias_con_salida_particular} salida${datos.dias_con_salida_particular !== 1 ? 's' : ''} particular${datos.dias_con_salida_particular !== 1 ? 'es' : ''} (${datos.horas_particular} total).`)
  }

  if (!partes.length) return ''

  return `<tr><td style="padding:10px 16px;background:#fefce8;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0;font-size:11px;color:#854d0e;">${partes.join(' ')}</p>
  </td></tr>`
}

/**
 * Construye el contexto de variables para resolver plantillas de nómina.
 * Compatible con el sistema de resolverVariables existente.
 *
 * Las variables seccion_horas y seccion_nota son bloques HTML pre-armados
 * que se inyectan tal cual — esto permite mostrar/ocultar filas de almuerzo
 * y salidas particulares según si hubo fichaje o no.
 */
export function construirContextoNomina(
  datos: DatosNominaCorreo,
  nombreEmpresa: string,
): Record<string, Record<string, unknown>> {
  const etiquetaTipo = datos.compensacion_tipo === 'fijo'
    ? 'Mensual fijo'
    : datos.compensacion_tipo === 'por_dia'
      ? 'Por día'
      : datos.compensacion_tipo === 'por_hora'
        ? 'Por hora'
        : datos.compensacion_tipo

  return {
    nomina: {
      nombre_empleado: datos.nombre_empleado,
      correo_empleado: datos.correo_empleado,
      periodo: datos.periodo,
      dias_trabajados: datos.dias_trabajados,
      dias_laborales: datos.dias_laborales,
      dias_ausentes: datos.dias_ausentes,
      dias_tardanza: datos.dias_tardanza,
      porcentaje_asistencia: datos.porcentaje_asistencia,
      // Horas (disponibles como variables individuales también)
      horas_brutas: datos.horas_brutas,
      horas_netas: datos.horas_netas,
      horas_almuerzo: datos.horas_almuerzo,
      horas_particular: datos.horas_particular,
      promedio_diario: datos.promedio_diario,
      dias_con_salida_particular: datos.dias_con_salida_particular,
      dias_con_almuerzo: datos.dias_con_almuerzo,
      descuenta_almuerzo: datos.descuenta_almuerzo ? 'Sí' : 'No',
      // Bloques HTML condicionales
      seccion_asistencia: construirSeccionAsistencia(datos),
      seccion_horas: construirSeccionHoras(datos),
      seccion_nota: construirSeccionNota(datos),
      // Compensación
      compensacion_tipo: etiquetaTipo,
      compensacion_detalle: datos.compensacion_detalle,
      monto_bruto: datos.monto_bruto,
    },
    empresa: {
      nombre: nombreEmpresa,
    },
  }
}
