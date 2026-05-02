import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { esEntidadConEstado } from '@/tipos/estados'

/**
 * GET /api/estados/transiciones-disponibles?entidad_tipo=<tipo>&desde_clave=<clave>
 *
 * Devuelve las transiciones MANUALES disponibles desde un estado actual.
 * Excluye las automáticas (que solo dispara el sistema/workflow).
 *
 * Lo consume `useTransicionesDisponibles()` para mostrar acciones
 * contextuales en la UI (botones tipo "Resolver", "Cancelar", etc.).
 *
 * Internamente llama a la función SQL `obtener_transiciones_disponibles()`,
 * que ya tiene la lógica de prioridad empresa > sistema y filtra por
 * `es_automatica = false`.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const entidadTipo = params.get('entidad_tipo')
    const desdeClave = params.get('desde_clave')

    if (!entidadTipo || !esEntidadConEstado(entidadTipo)) {
      return NextResponse.json(
        { error: `entidad_tipo inválida: "${entidadTipo}"` },
        { status: 400 },
      )
    }
    if (!desdeClave) {
      return NextResponse.json(
        { error: 'desde_clave es obligatoria' },
        { status: 400 },
      )
    }

    const admin = crearClienteAdmin()
    const { data, error } = await admin.rpc('obtener_transiciones_disponibles', {
      p_empresa_id: empresaId,
      p_entidad_tipo: entidadTipo,
      p_desde_clave: desdeClave,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ transiciones: data ?? [] })
  } catch (err) {
    console.error('Error GET /api/estados/transiciones-disponibles:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
