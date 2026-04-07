import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearFormato } from '@/lib/formato-regional'

/**
 * GET /api/inbox/exportar?conversacion_id=xxx&formato=csv|txt
 * Exporta el historial de mensajes de una conversación.
 * - csv: tabla con columnas (fecha, remitente, tipo, texto)
 * - txt: formato legible estilo chat (para PDF o lectura)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const conversacionId = params.get('conversacion_id')
    const formato = params.get('formato') || 'csv'

    if (!conversacionId) {
      return NextResponse.json({ error: 'conversacion_id requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener config regional de la empresa
    const { data: empresa } = await admin
      .from('empresas')
      .select('zona_horaria')
      .eq('id', empresaId)
      .single()
    const fmt = crearFormato({ zona_horaria: empresa?.zona_horaria })

    // Obtener conversación
    const { data: conversacion } = await admin
      .from('conversaciones')
      .select('contacto_nombre, identificador_externo, tipo_canal, creado_en')
      .eq('id', conversacionId)
      .eq('empresa_id', empresaId)
      .single()

    if (!conversacion) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    // Obtener todos los mensajes
    const { data: mensajes } = await admin
      .from('mensajes')
      .select('es_entrante, remitente_nombre, remitente_tipo, tipo_contenido, texto, es_nota_interna, creado_en')
      .eq('conversacion_id', conversacionId)
      .eq('empresa_id', empresaId)
      .is('eliminado_en', null)
      .order('creado_en', { ascending: true })

    if (!mensajes || mensajes.length === 0) {
      return NextResponse.json({ error: 'Sin mensajes' }, { status: 400 })
    }

    const nombreContacto = conversacion.contacto_nombre || conversacion.identificador_externo || 'Desconocido'

    if (formato === 'csv') {
      // CSV con BOM para Excel
      const bom = '\uFEFF'
      const cabecera = 'Fecha,Hora,Remitente,Tipo,Contenido,Nota interna\n'
      const filas = mensajes.map(m => {
        const fecha = new Date(m.creado_en)
        const fechaStr = fmt.fecha(fecha)
        const horaStr = fmt.hora(fecha)
        const remitente = m.es_entrante ? nombreContacto : (m.remitente_nombre || 'Agente')
        const tipo = m.tipo_contenido
        const texto = (m.texto || '').replace(/"/g, '""').replace(/\n/g, ' ')
        const nota = m.es_nota_interna ? 'Sí' : ''
        return `"${fechaStr}","${horaStr}","${remitente}","${tipo}","${texto}","${nota}"`
      }).join('\n')

      const csv = bom + cabecera + filas
      const nombreArchivo = `conversacion_${nombreContacto.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')}_${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        },
      })
    }

    // Formato TXT (legible, para copiar o imprimir)
    const lineas: string[] = []
    lineas.push(`═══ Conversación con ${nombreContacto} ═══`)
    lineas.push(`Canal: ${conversacion.tipo_canal} | Inicio: ${fmt.fecha(conversacion.creado_en)}`)
    lineas.push(`Exportado: ${fmt.fecha(new Date(), { conHora: true })}`)
    lineas.push(`Total mensajes: ${mensajes.length}`)
    lineas.push('')
    lineas.push('─'.repeat(50))
    lineas.push('')

    let diaActual = ''
    for (const m of mensajes) {
      const fecha = new Date(m.creado_en)
      const dia = fmt.fecha(fecha)
      const hora = fmt.hora(fecha)

      if (dia !== diaActual) {
        diaActual = dia
        lineas.push(`── ${dia} ──`)
        lineas.push('')
      }

      const remitente = m.es_entrante ? nombreContacto : (m.remitente_nombre || 'Agente')
      const prefijo = m.es_nota_interna ? '[NOTA INTERNA] ' : ''
      const tipoTag = m.tipo_contenido !== 'texto' ? ` [${m.tipo_contenido}]` : ''

      lineas.push(`[${hora}] ${prefijo}${remitente}${tipoTag}:`)
      lineas.push(m.texto || `(${m.tipo_contenido})`)
      lineas.push('')
    }

    const txt = lineas.join('\n')
    const nombreArchivo = `conversacion_${nombreContacto.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')}_${new Date().toISOString().split('T')[0]}.txt`

    return new NextResponse(txt, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      },
    })
  } catch (err) {
    console.error('Error al exportar:', err)
    return NextResponse.json({ error: 'Error al exportar' }, { status: 500 })
  }
}
