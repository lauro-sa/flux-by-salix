/**
 * POST /api/nominas/pagos/[id]/pdf
 *
 * Genera (o regenera) el PDF del recibo y devuelve la URL firmada. La
 * URL se persiste en `pagos_nomina.comprobante_url`.
 *
 * GET con el mismo path devuelve la URL existente si el archivo ya
 * está generado, o la genera bajo demanda si todavía no existe.
 *
 * Auth: requiere `nomina:editar` para POST (regenerar) y
 *       `nomina:ver_propio`/`ver_todos` para GET.
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 8).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad, requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { generarPdfRecibo } from '@/lib/nominas/generar-pdf-recibo'

interface Params { params: Promise<{ id: string }> }

// ════════════════════════════════════════════════════════════════
// POST — regenerar
// ════════════════════════════════════════════════════════════════

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId } = guard

  try {
    const admin = crearClienteAdmin()
    const resultado = await generarPdfRecibo(admin, id, empresaId)
    return NextResponse.json({
      url: resultado.url,
      storage_path: resultado.storagePath,
      tamano: resultado.tamano,
    })
  } catch (err) {
    console.error('[nominas/pagos/pdf] error:', err)
    const mensaje = err instanceof Error ? err.message : 'Error al generar el PDF'
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}

// ════════════════════════════════════════════════════════════════
// GET — obtener URL firmada (genera si no existe)
// ════════════════════════════════════════════════════════════════

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = crearClienteAdmin()

  // Validar pertenencia + soloPropio.
  const { data: pago } = await admin
    .from('pagos_nomina')
    .select('id, miembro_id, comprobante_url')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  if (vis.soloPropio) {
    const { data: miembroPropio } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!miembroPropio || miembroPropio.id !== pago.miembro_id) {
      return NextResponse.json({ error: 'Sin permiso para este recibo' }, { status: 403 })
    }
  }

  try {
    // Siempre generar/refrescar: el URL firmado expira y el contenido
    // del recibo podría haber cambiado (correcciones manuales). El costo
    // de Puppeteer en cada GET es asumible para un endpoint que solo se
    // dispara cuando alguien pide explícitamente el recibo.
    const resultado = await generarPdfRecibo(admin, id, empresaId)
    return NextResponse.json({
      url: resultado.url,
      storage_path: resultado.storagePath,
      tamano: resultado.tamano,
    })
  } catch (err) {
    console.error('[nominas/pagos/pdf] error:', err)
    const mensaje = err instanceof Error ? err.message : 'Error al generar el PDF'
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
