import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/presupuestos/[id]/pdf/archivo/[nombre] — Sirve el PDF con el nombre correcto.
 *
 * El [nombre] en la URL es el nombre del archivo (ej: "Pres 26-077, RS Autotronic.pdf").
 * Chrome usa el último segmento de la URL como nombre por defecto en "Guardar como"
 * y en el diálogo de impresión, así el nombre aparece correcto en ambos casos.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; nombre: string }> }
) {
  try {
    const { id: presupuestoId, nombre } = await params

    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: presupuesto } = await admin.from('presupuestos')
      .select('pdf_url')
      .eq('id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!presupuesto?.pdf_url) {
      return NextResponse.json({ error: 'PDF no encontrado' }, { status: 404 })
    }

    // Descargar PDF desde Storage
    const resPdf = await fetch(presupuesto.pdf_url)
    if (!resPdf.ok) {
      return NextResponse.json({ error: 'No se pudo obtener el PDF' }, { status: 502 })
    }

    const pdfBuffer = await resPdf.arrayBuffer()
    const nombreArchivo = decodeURIComponent(nombre || 'documento.pdf')
    const nombreEncoded = encodeURIComponent(nombreArchivo)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombreArchivo}"; filename*=UTF-8''${nombreEncoded}`,
        'Content-Length': String(pdfBuffer.byteLength),
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (err) {
    console.error('Error sirviendo PDF:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
