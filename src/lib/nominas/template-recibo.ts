/**
 * Template HTML profesional del recibo de nómina.
 *
 * El HTML se renderiza con Puppeteer a PDF (ver `src/lib/pdf/html-a-pdf.ts`)
 * y se sube a Storage en `comprobantes-pago/<empresa>/<año>/<archivo>.pdf`.
 *
 * Diseño:
 *   - Encabezado con logo + nombre + datos fiscales de la empresa.
 *   - Bloque con datos del empleado y resumen del período.
 *   - Tabla de haberes con monto base + conceptos automáticos del motor.
 *   - Tabla de descuentos (conceptos + adelantos).
 *   - Total neto destacado.
 *   - Espacio para firma del empleado y empleador.
 *   - Pie con número de recibo, fecha de emisión, hash corto (no implementado todavía).
 *
 * Tomamos los datos del SNAPSHOT del contrato guardado en el pago, no
 * del contrato vigente actual. Esto garantiza que el comprobante es
 * reproducible aunque después se modifique o borre el contrato real.
 */

import type { ContratoSnapshot } from '@/tipos/nominas'

// ════════════════════════════════════════════════════════════════
// Tipos de entrada
// ════════════════════════════════════════════════════════════════

export interface DatosEmpresaRecibo {
  nombre: string
  logo_url: string | null
  /** JSONB libre: { razon_social, cuit, condicion_iva, direccion, ... }. */
  datos_fiscales: Record<string, unknown> | null
  telefono: string | null
  correo: string | null
  ubicacion: string | null
}

export interface DatosEmpleadoRecibo {
  nombre: string
  apellido: string | null
  numero_empleado: number | null
  documento_tipo: string | null
  documento_numero: string | null
  /** Banco / CBU / alias si lo cargó el operador (opcional). */
  banco: string | null
}

export interface LineaConceptoRecibo {
  nombre: string
  tipo: 'haber' | 'descuento'
  monto: number
  detalle: string | null
  /** Indica si lo aplicó el motor automático o lo agregó el operador. */
  automatico: boolean
}

export interface DatosReciboPdf {
  /** Identificador interno del recibo (UUID del pago). */
  pago_id: string
  /** Etiqueta legible del período: "Quincena 1-15 de abril 2026". */
  concepto: string
  periodo_inicio: string
  periodo_fin: string

  empresa: DatosEmpresaRecibo
  empleado: DatosEmpleadoRecibo

  /** Snapshot del contrato congelado al momento del pago. */
  contrato: ContratoSnapshot | null

  /** Días trabajados, ausencias, tardanzas (snapshot del pago). */
  asistencia: {
    dias_periodo: number
    dias_trabajados: number
    dias_ausentes: number
    tardanzas: number
  }

  /** Suma del haber base + conceptos tipo 'haber'. */
  monto_base: number

  /** Conceptos aplicados (motor automático + manuales del operador). */
  conceptos: LineaConceptoRecibo[]

  /** Total neto a pagar (lo que efectivamente se transfiere). */
  monto_abonado: number

  /** Diferencia con el sugerido por el motor (puede ser ≠ 0 si el operador ajustó). */
  monto_sugerido: number

  /** Fecha de emisión del recibo (YYYY-MM-DD). */
  fecha_emision: string

  notas: string | null
}

// ════════════════════════════════════════════════════════════════
// Render
// ════════════════════════════════════════════════════════════════

const ETIQUETAS_MODALIDAD: Record<string, string> = {
  por_hora: 'Por hora',
  por_dia: 'Por día',
  fijo_semanal: 'Fijo semanal',
  fijo_quincenal: 'Fijo quincenal',
  fijo_mensual: 'Fijo mensual',
}

const ETIQUETAS_FRECUENCIA: Record<string, string> = {
  diaria: 'Diaria',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

const ETIQUETAS_REGIMEN: Record<string, string> = {
  informal: 'Sin relación de dependencia',
  monotributo: 'Monotributo',
  relacion_dependencia: 'Relación de dependencia',
}

/**
 * Renderiza el HTML completo del recibo a partir de los datos.
 *
 * El HTML resultante está pensado para imprimirse en A4 (ver
 * `htmlAPdf` en src/lib/pdf/html-a-pdf.ts para el setup de Puppeteer).
 */
export function renderizarHtmlRecibo(datos: DatosReciboPdf): string {
  const haberes = datos.conceptos.filter(c => c.tipo === 'haber')
  const descuentos = datos.conceptos.filter(c => c.tipo === 'descuento')

  const totalHaberes = datos.monto_base + haberes.reduce((s, c) => s + c.monto, 0)
  const totalDescuentos = descuentos.reduce((s, c) => s + c.monto, 0)
  const neto = totalHaberes - totalDescuentos

  const periodo = formatearPeriodo(datos.periodo_inicio, datos.periodo_fin)
  const nombreCompleto = `${datos.empleado.nombre}${datos.empleado.apellido ? ' ' + datos.empleado.apellido : ''}`.trim() || '—'
  const datosFiscales = datos.empresa.datos_fiscales ?? {}
  const razonSocial = (datosFiscales.razon_social as string) || datos.empresa.nombre
  const cuit = (datosFiscales.cuit as string) || (datosFiscales.identificacion_fiscal as string) || ''
  const direccionEmpresa = (datosFiscales.direccion as string) || datos.empresa.ubicacion || ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Recibo de haberes — ${escaparHtml(nombreCompleto)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1f2937;
    font-size: 10pt;
    line-height: 1.4;
    margin: 0;
    padding: 0;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 12mm;
    border-bottom: 2px solid #111827;
    margin-bottom: 8mm;
  }
  .header .empresa { flex: 1; }
  .header .empresa h1 {
    margin: 0 0 2mm 0;
    font-size: 14pt;
    font-weight: 700;
    color: #111827;
  }
  .header .empresa p {
    margin: 0;
    font-size: 9pt;
    color: #6b7280;
    line-height: 1.5;
  }
  .header .logo {
    max-height: 18mm;
    max-width: 40mm;
    object-fit: contain;
  }
  .header .recibo-meta {
    text-align: right;
    font-size: 9pt;
    color: #6b7280;
  }
  .header .recibo-meta .titulo {
    font-size: 11pt;
    font-weight: 700;
    color: #111827;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .grid-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6mm;
    margin-bottom: 8mm;
  }
  .grid-info .bloque {
    border: 1px solid #e5e7eb;
    border-radius: 2mm;
    padding: 4mm;
  }
  .grid-info .bloque h2 {
    margin: 0 0 2mm 0;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
    font-weight: 600;
  }
  .grid-info .bloque .row {
    display: flex;
    justify-content: space-between;
    margin: 1mm 0;
    font-size: 9.5pt;
  }
  .grid-info .bloque .row .label { color: #6b7280; }
  .grid-info .bloque .row .value { color: #111827; font-weight: 500; text-align: right; }
  table.lineas {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6mm;
    page-break-inside: avoid;
  }
  table.lineas thead th {
    text-align: left;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
    font-weight: 600;
    padding: 2mm 3mm;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  table.lineas tbody td {
    padding: 2.5mm 3mm;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }
  table.lineas tbody td.monto { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.lineas tbody td .detalle {
    display: block;
    font-size: 8pt;
    color: #6b7280;
    margin-top: 0.5mm;
  }
  table.lineas tfoot td {
    padding: 3mm;
    font-weight: 700;
    border-top: 2px solid #111827;
    background: #f9fafb;
  }
  table.lineas tfoot td.monto { text-align: right; font-variant-numeric: tabular-nums; }
  .seccion-titulo {
    margin: 0 0 2mm 0;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #374151;
    font-weight: 700;
  }
  .neto {
    margin-top: 8mm;
    padding: 5mm 6mm;
    background: #111827;
    color: #ffffff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 2mm;
  }
  .neto .label {
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.7;
  }
  .neto .valor {
    font-size: 16pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .firmas {
    margin-top: 16mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16mm;
    page-break-inside: avoid;
  }
  .firma {
    border-top: 1px solid #d1d5db;
    padding-top: 2mm;
    text-align: center;
    font-size: 9pt;
    color: #6b7280;
  }
  .pie {
    margin-top: 12mm;
    padding-top: 4mm;
    border-top: 1px solid #e5e7eb;
    font-size: 7.5pt;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
  }
  .notas {
    margin-top: 6mm;
    padding: 4mm;
    background: #fef9c3;
    border-left: 3px solid #facc15;
    font-size: 9pt;
    color: #713f12;
    border-radius: 1mm;
  }
</style>
</head>
<body>

  <!-- ─── Encabezado ─── -->
  <div class="header">
    <div class="empresa">
      <h1>${escaparHtml(razonSocial)}</h1>
      <p>
        ${cuit ? `CUIT: ${escaparHtml(cuit)}<br>` : ''}
        ${direccionEmpresa ? `${escaparHtml(direccionEmpresa)}<br>` : ''}
        ${datos.empresa.telefono ? `Tel: ${escaparHtml(datos.empresa.telefono)} · ` : ''}${datos.empresa.correo ? escaparHtml(datos.empresa.correo) : ''}
      </p>
    </div>
    ${datos.empresa.logo_url ? `<img class="logo" src="${escaparHtml(datos.empresa.logo_url)}" alt="${escaparHtml(datos.empresa.nombre)}">` : ''}
    <div class="recibo-meta">
      <div class="titulo">Recibo de haberes</div>
      <div>Nº ${escaparHtml(datos.pago_id.slice(0, 8).toUpperCase())}</div>
      <div>Emitido: ${formatearFecha(datos.fecha_emision)}</div>
    </div>
  </div>

  <!-- ─── Datos empleado + período ─── -->
  <div class="grid-info">
    <div class="bloque">
      <h2>Empleado</h2>
      <div class="row"><span class="label">Nombre</span><span class="value">${escaparHtml(nombreCompleto)}</span></div>
      ${datos.empleado.numero_empleado ? `<div class="row"><span class="label">Legajo</span><span class="value">#${datos.empleado.numero_empleado}</span></div>` : ''}
      ${datos.empleado.documento_numero ? `<div class="row"><span class="label">${escaparHtml(datos.empleado.documento_tipo || 'DNI')}</span><span class="value">${escaparHtml(datos.empleado.documento_numero)}</span></div>` : ''}
      ${datos.contrato?.sector ? `<div class="row"><span class="label">Sector</span><span class="value">${escaparHtml(datos.contrato.sector.nombre)}</span></div>` : ''}
      ${datos.contrato?.turno ? `<div class="row"><span class="label">Turno</span><span class="value">${escaparHtml(datos.contrato.turno.nombre)}</span></div>` : ''}
    </div>
    <div class="bloque">
      <h2>Período liquidado</h2>
      <div class="row"><span class="label">Concepto</span><span class="value">${escaparHtml(datos.concepto)}</span></div>
      <div class="row"><span class="label">Período</span><span class="value">${escaparHtml(periodo)}</span></div>
      <div class="row"><span class="label">Días trabajados</span><span class="value">${datos.asistencia.dias_trabajados} de ${datos.asistencia.dias_periodo}</span></div>
      ${datos.asistencia.dias_ausentes > 0 ? `<div class="row"><span class="label">Ausencias</span><span class="value">${datos.asistencia.dias_ausentes}</span></div>` : ''}
      ${datos.asistencia.tardanzas > 0 ? `<div class="row"><span class="label">Tardanzas</span><span class="value">${datos.asistencia.tardanzas}</span></div>` : ''}
      ${datos.contrato ? `<div class="row"><span class="label">Modalidad</span><span class="value">${escaparHtml(ETIQUETAS_MODALIDAD[datos.contrato.modalidad_calculo] || datos.contrato.modalidad_calculo)} · ${escaparHtml(ETIQUETAS_FRECUENCIA[datos.contrato.frecuencia_pago] || datos.contrato.frecuencia_pago)}</span></div>` : ''}
      ${datos.contrato ? `<div class="row"><span class="label">Régimen</span><span class="value">${escaparHtml(ETIQUETAS_REGIMEN[datos.contrato.regimen] || datos.contrato.regimen)}</span></div>` : ''}
    </div>
  </div>

  <!-- ─── Tabla de haberes ─── -->
  <h3 class="seccion-titulo">Haberes</h3>
  <table class="lineas">
    <thead>
      <tr>
        <th style="width:55%">Concepto</th>
        <th style="width:25%">Detalle</th>
        <th style="width:20%; text-align:right;">Monto</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>Haber base</strong>
          ${datos.contrato ? `<span class="detalle">${formatearMonto(datos.contrato.monto_base)} ${escaparHtml(ETIQUETAS_FRECUENCIA[datos.contrato.frecuencia_pago]?.toLowerCase() || datos.contrato.frecuencia_pago)}</span>` : ''}
        </td>
        <td>${datos.contrato ? escaparHtml(ETIQUETAS_MODALIDAD[datos.contrato.modalidad_calculo] || datos.contrato.modalidad_calculo) : '—'}</td>
        <td class="monto">${formatearMonto(datos.monto_base)}</td>
      </tr>
      ${haberes.map(h => `<tr>
        <td><strong>${escaparHtml(h.nombre)}</strong>${h.detalle ? `<span class="detalle">${escaparHtml(h.detalle)}</span>` : ''}</td>
        <td>${h.automatico ? 'Automático' : 'Manual'}</td>
        <td class="monto">${formatearMonto(h.monto)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">Total haberes</td>
        <td class="monto">${formatearMonto(totalHaberes)}</td>
      </tr>
    </tfoot>
  </table>

  ${descuentos.length > 0 ? `
  <!-- ─── Tabla de descuentos ─── -->
  <h3 class="seccion-titulo">Descuentos</h3>
  <table class="lineas">
    <thead>
      <tr>
        <th style="width:55%">Concepto</th>
        <th style="width:25%">Detalle</th>
        <th style="width:20%; text-align:right;">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${descuentos.map(d => `<tr>
        <td><strong>${escaparHtml(d.nombre)}</strong>${d.detalle ? `<span class="detalle">${escaparHtml(d.detalle)}</span>` : ''}</td>
        <td>${d.automatico ? 'Automático' : 'Manual'}</td>
        <td class="monto">−${formatearMonto(d.monto)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">Total descuentos</td>
        <td class="monto">−${formatearMonto(totalDescuentos)}</td>
      </tr>
    </tfoot>
  </table>
  ` : ''}

  <!-- ─── Neto a transferir ─── -->
  <div class="neto">
    <span class="label">Neto a transferir</span>
    <span class="valor">${formatearMonto(datos.monto_abonado)}</span>
  </div>
  ${datos.monto_abonado !== datos.monto_sugerido ? `<p style="margin-top:2mm;font-size:8pt;color:#6b7280;text-align:right;">Sugerido por el sistema: ${formatearMonto(datos.monto_sugerido)} · Diferencia: ${formatearMonto(datos.monto_abonado - datos.monto_sugerido)}</p>` : ''}

  ${datos.notas ? `<div class="notas"><strong>Notas:</strong> ${escaparHtml(datos.notas)}</div>` : ''}

  <!-- ─── Firmas ─── -->
  <div class="firmas">
    <div class="firma">Firma del empleado</div>
    <div class="firma">Firma del empleador</div>
  </div>

  <!-- ─── Pie ─── -->
  <div class="pie">
    <span>Recibo Nº ${escaparHtml(datos.pago_id.slice(0, 8).toUpperCase())} · ${escaparHtml(razonSocial)}</span>
    <span>Emitido el ${formatearFecha(datos.fecha_emision)}</span>
  </div>

</body>
</html>`
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatearMonto(n: number): string {
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${d} de ${meses[m - 1]} de ${y}`
}

function formatearPeriodo(inicio: string, fin: string): string {
  const [yI, mI, dI] = inicio.split('-').map(Number)
  const [yF, mF, dF] = fin.split('-').map(Number)
  if (yI === yF && mI === mF) {
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return `${dI} al ${dF} de ${meses[mI - 1]} de ${yI}`
  }
  return `${formatearFecha(inicio)} al ${formatearFecha(fin)}`
}
