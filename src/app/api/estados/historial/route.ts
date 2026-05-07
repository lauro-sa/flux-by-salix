import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { TABLA_ESTADOS_POR_ENTIDAD } from '@/lib/estados/mapeo'
import { esEntidadConEstado } from '@/tipos/estados'

/**
 * GET /api/estados/historial?entidad_tipo=X&entidad_id=Y
 *
 * Devuelve el historial de cambios de estado de una entidad puntual,
 * enriquecido con la etiqueta + color + icono del estado anterior y nuevo
 * (lookup contra `estados_<entidad>`). Ordenado del más reciente al más viejo.
 *
 * Lo consume `useHistorialEstados()` y el componente <HistorialEstados />.
 *
 * Estructura de respuesta:
 *   { historial: Array<{
 *       id, creado_en,
 *       estado_anterior, estado_nuevo,
 *       etiqueta_anterior, etiqueta_nuevo,
 *       color_anterior, color_nuevo,
 *       grupo_anterior, grupo_nuevo,
 *       origen, usuario_id, usuario_nombre, motivo, metadatos,
 *     }>
 *   }
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const entidadTipo = params.get('entidad_tipo')
    const entidadId = params.get('entidad_id')

    if (!entidadTipo || !esEntidadConEstado(entidadTipo)) {
      return NextResponse.json({ error: `entidad_tipo inválida: "${entidadTipo}"` }, { status: 400 })
    }
    if (!entidadId) {
      return NextResponse.json({ error: 'entidad_id es obligatorio' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // 1) Cargar el historial de la entidad
    const { data: cambios, error } = await admin
      .from('cambios_estado')
      .select('id, creado_en, estado_anterior, estado_nuevo, grupo_anterior, grupo_nuevo, origen, usuario_id, usuario_nombre, motivo, metadatos')
      .eq('empresa_id', empresaId)
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId)
      .order('creado_en', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 2) Enriquecer con etiqueta/color/icono desde estados_<entidad>
    const tablaEstados = TABLA_ESTADOS_POR_ENTIDAD[entidadTipo]
    let mapaEstados: Map<string, { etiqueta: string; color: string; icono: string }> = new Map()

    if (tablaEstados && cambios && cambios.length > 0) {
      // Recolectar todas las claves que aparecen (anterior y nuevo)
      const claves = new Set<string>()
      for (const c of cambios) {
        if (c.estado_anterior) claves.add(c.estado_anterior)
        if (c.estado_nuevo) claves.add(c.estado_nuevo)
      }

      const { data: estadosLookup } = await admin
        .from(tablaEstados)
        .select('clave, etiqueta, color, icono, empresa_id')
        .in('clave', Array.from(claves))
        .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)

      if (estadosLookup) {
        // Si hay duplicados (sistema + propio), preferir el propio
        for (const e of estadosLookup) {
          const existente = mapaEstados.get(e.clave)
          if (!existente || (existente && e.empresa_id === empresaId)) {
            mapaEstados.set(e.clave, {
              etiqueta: e.etiqueta,
              color: e.color,
              icono: e.icono,
            })
          }
        }
      }
    }

    // 3) Componer respuesta
    const historial = (cambios ?? []).map(c => {
      const anterior = c.estado_anterior ? mapaEstados.get(c.estado_anterior) : null
      const nuevo = c.estado_nuevo ? mapaEstados.get(c.estado_nuevo) : null
      return {
        id: c.id,
        creado_en: c.creado_en,
        estado_anterior: c.estado_anterior,
        estado_nuevo: c.estado_nuevo,
        etiqueta_anterior: anterior?.etiqueta ?? c.estado_anterior,
        etiqueta_nuevo: nuevo?.etiqueta ?? c.estado_nuevo,
        color_anterior: anterior?.color ?? null,
        color_nuevo: nuevo?.color ?? null,
        icono_anterior: anterior?.icono ?? null,
        icono_nuevo: nuevo?.icono ?? null,
        grupo_anterior: c.grupo_anterior,
        grupo_nuevo: c.grupo_nuevo,
        origen: c.origen,
        usuario_id: c.usuario_id,
        usuario_nombre: c.usuario_nombre,
        motivo: c.motivo,
        metadatos: c.metadatos,
      }
    })

    return NextResponse.json({ historial })
  } catch (err) {
    console.error('Error GET /api/estados/historial:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
