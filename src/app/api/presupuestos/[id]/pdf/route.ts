import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { generarPdfPresupuesto, congelarPdfExistente } from '@/lib/pdf/generar-pdf'

/**
 * POST /api/presupuestos/[id]/pdf — Generar PDF del presupuesto.
 *
 * Body (opcional):
 *   congelado: boolean — Si true, genera copia inmutable para envío
 *   forzar: boolean — Si true, regenera aunque no haya cambios
 *   vista_previa: boolean — Si true, retorna el PDF inline (no descarga)
 *
 * Lógica:
 * - Si el presupuesto no cambió desde la última generación y no es congelado ni forzado,
 *   retorna la URL del PDF existente sin regenerar.
 * - Si es congelado, sube a ruta separada (congelados/) y NO actualiza el presupuesto.
 * - Si no es congelado, actualiza pdf_url, pdf_storage_path y pdf_generado_en.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: presupuestoId } = await params

    // Autenticación
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Parsear body
    let body: { congelado?: boolean; forzar?: boolean; vista_previa?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      // Body vacío es válido
    }

    const { congelado = false, forzar = false, vista_previa = false } = body

    const admin = crearClienteAdmin()

    // Si es congelado, copiar el PDF existente a ruta de congelados (sin Puppeteer)
    // Si no existe PDF previo, generar uno normal primero y luego congelar
    let resultado
    if (congelado) {
      // Intentar congelar el PDF existente (copia rápida, sin regenerar)
      resultado = await congelarPdfExistente(admin, presupuestoId, empresaId)
      if (!resultado) {
        // No hay PDF existente — generar uno normal primero
        await generarPdfPresupuesto(admin, presupuestoId, empresaId, { congelado: false, forzar: true })
        // Ahora sí congelar la copia
        resultado = await congelarPdfExistente(admin, presupuestoId, empresaId)
        if (!resultado) throw new Error('No se pudo congelar el PDF')
      }
    } else {
      resultado = await generarPdfPresupuesto(admin, presupuestoId, empresaId, { congelado: false, forzar })
    }

    // Si es vista previa, redirigir al PDF
    if (vista_previa && resultado.url) {
      return NextResponse.json({
        url: resultado.url,
        nombre_archivo: resultado.nombre_archivo,
        tamano: resultado.tamano,
        regenerado: resultado.tamano > 0,
      })
    }

    return NextResponse.json({
      url: resultado.url,
      storage_path: resultado.storage_path,
      nombre_archivo: resultado.nombre_archivo,
      tamano: resultado.tamano,
      congelado,
      regenerado: resultado.tamano > 0,
    })
  } catch (err) {
    console.error('Error generando PDF:', err)
    const mensaje = err instanceof Error ? err.message : 'Error al generar PDF'
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}

/**
 * GET /api/presupuestos/[id]/pdf — Obtener URL del PDF existente.
 * No genera uno nuevo, solo retorna el que existe.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: presupuestoId } = await params

    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: presupuesto } = await admin
      .from('presupuestos')
      .select('pdf_url, pdf_storage_path, pdf_generado_en, actualizado_en')
      .eq('id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    const necesitaRegeneracion = !presupuesto.pdf_url
      || !presupuesto.pdf_generado_en
      || new Date(presupuesto.pdf_generado_en).getTime() < new Date(presupuesto.actualizado_en).getTime()

    return NextResponse.json({
      pdf_url: presupuesto.pdf_url,
      pdf_storage_path: presupuesto.pdf_storage_path,
      pdf_generado_en: presupuesto.pdf_generado_en,
      necesita_regeneracion: necesitaRegeneracion,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
