import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/productos/[id] — Obtener detalle de un producto/servicio.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('productos')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/productos/[id] — Actualizar un producto/servicio.
 * Registra cambios en el chatter.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'productos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para editar productos' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Obtener nombre del editor
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : 'Usuario'

    // Actualizar producto
    const { data, error } = await admin
      .from('productos')
      .update({
        ...body,
        editado_por: user.id,
        editado_por_nombre: nombreEditor,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) {
      console.error('Error al actualizar producto:', error)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // Registrar cambio en chatter
    const campos = Object.keys(body).filter(k => !['editado_por', 'editado_por_nombre', 'actualizado_en'].includes(k))
    if (campos.length > 0) {
      const ETIQUETAS_CAMPO: Record<string, string> = {
        nombre: 'nombre', tipo: 'tipo', categoria: 'categoría', precio_unitario: 'precio',
        costo: 'costo', unidad: 'unidad', descripcion: 'descripción', descripcion_venta: 'descripción de venta',
        notas_internas: 'notas internas', activo: 'estado', favorito: 'favorito',
        puede_venderse: 'puede venderse', puede_comprarse: 'puede comprarse',
        impuesto_id: 'impuesto', moneda: 'moneda', peso: 'peso', volumen: 'volumen',
        ubicacion_deposito: 'ubicación depósito', dimensiones: 'dimensiones',
        proveedor_principal: 'proveedor', stock_actual: 'stock actual',
        stock_minimo: 'stock mínimo', stock_maximo: 'stock máximo',
        punto_reorden: 'punto de reorden', alerta_stock_bajo: 'alerta stock bajo',
        referencia_interna: 'referencia interna', codigo_barras: 'código de barras',
        imagen_url: 'imagen', desglose_costos: 'desglose de costos',
      }
      const nombresAmigables = campos.map(c => ETIQUETAS_CAMPO[c] || c).join(', ')

      await registrarChatter({
        empresaId,
        entidadTipo: 'producto',
        entidadId: id,
        contenido: `Editó: ${nombresAmigables}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'campo_editado', detalles: body },
      })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/productos/[id] — Soft delete (enviar a papelera).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'productos', 'eliminar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para eliminar productos' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { error } = await admin
      .from('productos')
      .update({
        en_papelera: true,
        papelera_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('Error al eliminar producto:', error)
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    // Registrar en chatter
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : 'Usuario'

    await registrarChatter({
      empresaId,
      entidadTipo: 'producto',
      entidadId: id,
      contenido: 'Envió a la papelera',
      autorId: user.id,
      autorNombre: nombreEditor,
      metadata: { accion: 'estado_cambiado', estado_anterior: 'activo', estado_nuevo: 'papelera' },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
