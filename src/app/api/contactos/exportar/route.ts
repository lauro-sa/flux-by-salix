import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/contactos/exportar — Exportar contactos como CSV.
 * Devuelve archivo CSV con todos los contactos activos de la empresa.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: contactos } = await admin
      .from('contactos')
      .select(`
        *,
        tipo_contacto:tipos_contacto!tipo_contacto_id(clave, etiqueta),
        direcciones:contacto_direcciones(tipo, calle, ciudad, provincia, codigo_postal, pais, piso, departamento, texto)
      `)
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .order('codigo')

    if (!contactos?.length) {
      return new Response('No hay contactos para exportar', { status: 404 })
    }

    // Generar CSV
    const columnas = [
      'Código', 'Tipo', 'Nombre', 'Apellido', 'Correo', 'Teléfono', 'WhatsApp',
      'Cargo', 'Rubro', 'Web', 'Tipo Identificación', 'Nro Identificación',
      'Moneda', 'Idioma', 'Límite Crédito', 'Plazo Cliente', 'Plazo Proveedor',
      'Etiquetas', 'Notas', 'Origen', 'Estado', 'Dirección Principal',
      'Fecha Creación',
    ]

    const filas = contactos.map((c: Record<string, unknown>) => {
      const tipo = c.tipo_contacto as Record<string, unknown> | null
      const dirs = (c.direcciones as Record<string, unknown>[]) || []
      const dirPrincipal = dirs[0]

      return [
        c.codigo,
        tipo?.etiqueta || '',
        c.nombre,
        c.apellido || '',
        c.correo || '',
        c.telefono || '',
        c.whatsapp || '',
        c.cargo || '',
        c.rubro || '',
        c.web || '',
        c.tipo_identificacion || '',
        c.numero_identificacion || '',
        c.moneda || '',
        c.idioma || '',
        c.limite_credito || '',
        c.plazo_pago_cliente || '',
        c.plazo_pago_proveedor || '',
        ((c.etiquetas as string[]) || []).join(', '),
        c.notas || '',
        c.origen || '',
        c.activo ? 'Activo' : 'Inactivo',
        dirPrincipal ? (dirPrincipal.texto || [dirPrincipal.calle, dirPrincipal.ciudad, dirPrincipal.provincia].filter(Boolean).join(', ')) : '',
        c.creado_en ? new Date(c.creado_en as string).toLocaleDateString('es-AR') : '',
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`)
    })

    const csv = [columnas.map(c => `"${c}"`).join(','), ...filas.map(f => f.join(','))].join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="contactos_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
