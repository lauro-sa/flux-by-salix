/**
 * POST /api/nominas/recibo-preview
 *
 * Genera el PDF del recibo en modo BORRADOR (sin pago grabado) y
 * devuelve la URL firmada. Pensado para la previsualización en la
 * UI: el operador toca "Ver recibo" antes de pagar y ve el PDF
 * real que se va a generar — con todos los ajustes del período,
 * conceptos, neto, etc.
 *
 * El borrador se sobreescribe en cada llamada para el mismo
 * (miembro, período): no acumula basura en Storage.
 *
 * Body: { miembro_id, periodo_inicio, periodo_fin }
 *
 * Si ya hay un pago grabado para este período, conviene usar
 * `/api/nominas/pagos/[id]/pdf` que devuelve el PDF definitivo —
 * pero acá igual funciona y genera un borrador con los datos
 * calculados en vivo (puede diferir si el motor cambió de criterio).
 *
 * Auth: `nomina:ver_propio` para el propio miembro o `ver_todos`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { calcularReciboDesdeBD } from '@/lib/nominas/motor-calculo'
import { generarPdfReciboCalculado } from '@/lib/nominas/generar-pdf-recibo'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface Payload {
  miembro_id: string
  periodo_inicio: string
  periodo_fin: string
}

export async function POST(request: NextRequest) {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: Payload
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (!body.miembro_id) return NextResponse.json({ error: 'miembro_id requerido' }, { status: 400 })
  if (!ISO_DATE.test(body.periodo_inicio ?? '')) return NextResponse.json({ error: 'periodo_inicio inválido' }, { status: 400 })
  if (!ISO_DATE.test(body.periodo_fin ?? '')) return NextResponse.json({ error: 'periodo_fin inválido' }, { status: 400 })

  const admin = crearClienteAdmin()

  // Reuse de la lógica de visibilidad: si el caller solo puede ver lo
  // suyo, confirmar que `miembro_id` es su propio miembro.
  if (vis.soloPropio) {
    const { data: miembroPropio } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!miembroPropio || miembroPropio.id !== body.miembro_id) {
      return NextResponse.json({ error: 'Sin permiso para este recibo' }, { status: 403 })
    }
  }

  try {
    // Calcular con el motor unificado (incluye ajustes del período).
    const detalle = await calcularReciboDesdeBD(admin, {
      miembroId: body.miembro_id,
      empresaId,
      periodoInicio: body.periodo_inicio,
      periodoFin: body.periodo_fin,
    })

    // Etiqueta legible del período. Reproducimos la lógica del listado
    // para coherencia con el resto de la UI.
    const concepto = etiquetaPeriodo(body.periodo_inicio, body.periodo_fin)

    const conceptosBorrador = [
      ...detalle.conceptos_aplicados.map(c => ({
        nombre: c.nombre,
        tipo: c.tipo,
        monto: c.monto,
        detalle: c.detalle,
        automatico: c.automatico,
      })),
      // Adelantos/bonos/descuentos puntuales como líneas extra.
      ...detalle.adelantos_aplicados.map(a => ({
        nombre: a.tipo === 'bono' ? 'Bono extra'
          : a.tipo === 'descuento' ? 'Descuento manual'
          : `Adelanto · cuota ${a.numero_cuota}`,
        tipo: (a.tipo === 'bono' ? 'haber' : 'descuento') as 'haber' | 'descuento',
        monto: a.monto,
        detalle: null,
        automatico: true,
      })),
    ]

    const resultado = await generarPdfReciboCalculado(admin, empresaId, {
      miembro_id: body.miembro_id,
      fecha_inicio_periodo: body.periodo_inicio,
      fecha_fin_periodo: body.periodo_fin,
      concepto,
      contrato_snapshot: detalle.contrato.snapshot,
      dias_habiles: detalle.asistencia.dias_periodo,
      dias_trabajados: detalle.asistencia.dias_trabajados,
      dias_ausentes: detalle.asistencia.dias_ausentes,
      tardanzas: detalle.asistencia.tardanzas,
      monto_sugerido: detalle.neto,
      monto_abonado: detalle.neto,
      conceptos: conceptosBorrador,
      notas: null,
    })

    return NextResponse.json({
      url: resultado.url,
      storage_path: resultado.storagePath,
      tamano: resultado.tamano,
      borrador: true,
    })
  } catch (err) {
    console.error('[nominas/recibo-preview] error:', err)
    const mensaje = err instanceof Error ? err.message : 'Error al generar el preview'
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}

/** Etiqueta legible del período: "Quincena 1-15 de abril 2026". */
function etiquetaPeriodo(desde: string, hasta: string): string {
  const d = new Date(desde + 'T12:00:00')
  const h = new Date(hasta + 'T12:00:00')
  const mesD = d.getMonth(), mesH = h.getMonth()
  const anioD = d.getFullYear(), anioH = h.getFullYear()
  if (d.getDate() === 1 && h.getDate() === new Date(anioH, mesH + 1, 0).getDate() && mesD === mesH && anioD === anioH) {
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
  }
  if (mesD === mesH && anioD === anioH) {
    if (d.getDate() === 1 && h.getDate() === 15) return `Quincena 1-15 de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
    if (d.getDate() === 16) return `Quincena 16-${h.getDate()} de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
  }
  return `${d.getDate()}/${mesD + 1} — ${h.getDate()}/${mesH + 1}`
}
