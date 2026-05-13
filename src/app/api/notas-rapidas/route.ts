import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { sanitizarHtmlNota } from '@/lib/notas/html'

/**
 * GET /api/notas-rapidas — Listar notas del usuario (propias + compartidas).
 * POST /api/notas-rapidas — Crear nueva nota.
 *
 * Se usa en: PanelNotas (botón flotante de notas rápidas).
 */

export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('notas', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const params = request.nextUrl.searchParams
    const enPapelera = params.get('en_papelera') === 'true'

    // Modo papelera: devolver solo notas eliminadas de toda la empresa
    if (enPapelera) {
      const { data: notas } = await admin
        .from('notas_rapidas')
        .select('id, titulo, contenido, creador_id, papelera_en, actualizado_en, actualizado_por')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', true)
        .order('papelera_en', { ascending: false })

      return NextResponse.json({ notas: notas || [] })
    }

    // Notas propias (no archivadas, no en papelera)
    const { data: propias } = await admin
      .from('notas_rapidas')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('creador_id', user.id)
      .eq('archivada', false)
      .eq('en_papelera', false)
      .order('fijada', { ascending: false })
      .order('actualizado_en', { ascending: false })

    // Notas compartidas conmigo
    const { data: compartidas_raw } = await admin
      .from('notas_rapidas_compartidas')
      .select('*, nota:notas_rapidas(*)')
      .eq('usuario_id', user.id)

    // Filtrar compartidas no archivadas, no en papelera, y agregar info
    // de compartido. Distinguimos:
    //  - `_es_nueva`: te la compartieron y nunca la abriste (`leido_en`
    //     null). Render como badge "Nuevo" en la tarjeta.
    //  - `_tiene_cambios`: la abriste pero hubo edits posteriores. Render
    //     como puntito rojo. NOTA: para retro-compatibilidad mantiene el
    //     comportamiento histórico de incluir las nuevas, así otros
    //     consumidores (header, useNotasRapidas) siguen funcionando.
    const compartidas = (compartidas_raw ?? [])
      .filter((c) => c.nota && !c.nota.archivada && !c.nota.en_papelera)
      .map((c) => {
        const esNueva = !c.leido_en
        const huboCambiosDespuesDeLeer = !!(c.nota.actualizado_en && c.leido_en
          && new Date(c.nota.actualizado_en) > new Date(c.leido_en))
        return {
          ...c.nota,
          _compartida: true,
          _puede_editar: c.puede_editar,
          _leido_en: c.leido_en,
          _compartida_id: c.id,
          _es_nueva: esNueva,
          _tiene_cambios: esNueva || huboCambiosDespuesDeLeer,
        }
      })

    // Para cada nota propia, obtener con quién está compartida
    const notaIds = (propias ?? []).map((n) => n.id)
    let compartidos_por_nota: Record<string, Array<{ usuario_id: string; puede_editar: boolean }>> = {}

    if (notaIds.length > 0) {
      const { data: shares } = await admin
        .from('notas_rapidas_compartidas')
        .select('nota_id, usuario_id, puede_editar')
        .in('nota_id', notaIds)

      if (shares) {
        for (const s of shares) {
          if (!compartidos_por_nota[s.nota_id]) compartidos_por_nota[s.nota_id] = []
          compartidos_por_nota[s.nota_id].push({ usuario_id: s.usuario_id, puede_editar: s.puede_editar })
        }
      }
    }

    const propias_con_shares = (propias ?? []).map((n) => ({
      ...n,
      _compartida: false,
      _compartidos_con: compartidos_por_nota[n.id] ?? [],
    }))

    // Indicador global: ¿hay notas compartidas con cambios no leídos?
    const tiene_cambios_sin_leer = compartidas.some((c) => c._tiene_cambios)

    return NextResponse.json({
      propias: propias_con_shares,
      compartidas,
      tiene_cambios_sin_leer,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('notas', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const { titulo, contenido, color, compartir_con } = body

    const admin = crearClienteAdmin()

    // Crear la nota — el contenido es HTML de Tiptap; sanitizamos antes
    // de persistir para bloquear scripts/iframes/eventos inline. El
    // título queda como texto plano (no admite formato).
    const { data: nota, error } = await admin
      .from('notas_rapidas')
      .insert({
        empresa_id: empresaId,
        creador_id: user.id,
        titulo: typeof titulo === 'string' ? titulo : '',
        contenido: sanitizarHtmlNota(typeof contenido === 'string' ? contenido : ''),
        color: color || 'amarillo',
        actualizado_por: user.id,
      })
      .select()
      .single()

    if (error || !nota) {
      return NextResponse.json({ error: 'Error al crear nota' }, { status: 500 })
    }

    // Compartir si se indicaron usuarios
    if (compartir_con && Array.isArray(compartir_con) && compartir_con.length > 0) {
      const compartidos = compartir_con.map((usuario_id: string) => ({
        nota_id: nota.id,
        usuario_id,
        puede_editar: true,
      }))

      await admin.from('notas_rapidas_compartidas').insert(compartidos)
    }

    return NextResponse.json(nota)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
