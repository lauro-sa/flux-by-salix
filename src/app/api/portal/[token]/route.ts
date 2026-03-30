import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/portal/[token] — Endpoint público (sin auth).
 * Retorna todos los datos del presupuesto para el portal del cliente.
 * Se usa en: página pública /portal/[token]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const admin = crearClienteAdmin()

    // 1. Buscar token
    const { data: portalToken } = await admin
      .from('portal_tokens')
      .select('*')
      .eq('token', token)
      .eq('activo', true)
      .single()

    if (!portalToken) {
      return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 })
    }

    // 2. Verificar expiración
    if (new Date(portalToken.expira_en).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Enlace expirado' }, { status: 410 })
    }

    // 3. Registrar vista (incrementar contador, marcar primera vista)
    const actualizacionVista: Record<string, unknown> = {
      veces_visto: (portalToken.veces_visto || 0) + 1,
    }
    if (!portalToken.visto_en) {
      actualizacionVista.visto_en = new Date().toISOString()
    }
    admin.from('portal_tokens').update(actualizacionVista).eq('id', portalToken.id).then(() => {})

    // 4. Fetch en paralelo: presupuesto, líneas, cuotas, empresa, config, vendedor
    const [
      { data: presupuesto },
      { data: lineas },
      { data: cuotas },
      { data: empresa },
      { data: config },
      { data: vendedor },
    ] = await Promise.all([
      admin.from('presupuestos').select('*').eq('id', portalToken.presupuesto_id).single(),
      admin.from('lineas_presupuesto').select('*').eq('presupuesto_id', portalToken.presupuesto_id).order('orden'),
      admin.from('presupuesto_cuotas').select('*').eq('presupuesto_id', portalToken.presupuesto_id).order('numero'),
      admin.from('empresas').select('id, nombre, slug, logo_url, color_marca, descripcion, telefono, correo, pagina_web, ubicacion, datos_fiscales').eq('id', portalToken.empresa_id).single(),
      admin.from('config_presupuestos').select('datos_empresa_pdf, monedas').eq('empresa_id', portalToken.empresa_id).single(),
      admin.from('perfiles').select('nombre, apellido, correo, telefono').eq('id', portalToken.creado_por).single(),
    ])

    if (!presupuesto || !empresa) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // 5. Resolver símbolo de moneda
    const monedas = (config?.monedas || []) as { id: string; simbolo: string }[]
    const monedaSimb = monedas.find(m => m.id === presupuesto.moneda)?.simbolo || '$'

    // 6. Datos bancarios (de config empresa PDF)
    const datosEmpPdf = config?.datos_empresa_pdf as Record<string, unknown> | null
    let datosBancarios = null
    if (datosEmpPdf?.mostrar_datos_bancarios && datosEmpPdf.datos_bancarios) {
      const db = datosEmpPdf.datos_bancarios as Record<string, string>
      if (db.banco || db.cbu || db.alias) {
        datosBancarios = {
          banco: db.banco || '',
          titular: db.titular || '',
          cbu: db.cbu || '',
          alias: db.alias || '',
        }
      }
    }

    // 7. Armar respuesta
    return NextResponse.json({
      presupuesto: {
        id: presupuesto.id,
        numero: presupuesto.numero,
        estado: presupuesto.estado,
        fecha_emision: presupuesto.fecha_emision,
        fecha_vencimiento: presupuesto.fecha_vencimiento,
        moneda: presupuesto.moneda,
        referencia: presupuesto.referencia,
        condicion_pago_label: presupuesto.condicion_pago_label,
        nota_plan_pago: presupuesto.nota_plan_pago,
        contacto_nombre: presupuesto.contacto_nombre,
        contacto_apellido: presupuesto.contacto_apellido,
        contacto_identificacion: presupuesto.contacto_identificacion,
        contacto_condicion_iva: presupuesto.contacto_condicion_iva,
        contacto_direccion: presupuesto.contacto_direccion,
        contacto_correo: presupuesto.contacto_correo,
        contacto_telefono: presupuesto.contacto_telefono,
        atencion_nombre: presupuesto.atencion_nombre,
        atencion_cargo: presupuesto.atencion_cargo,
        atencion_correo: presupuesto.atencion_correo,
        subtotal_neto: presupuesto.subtotal_neto,
        total_impuestos: presupuesto.total_impuestos,
        descuento_global: presupuesto.descuento_global,
        descuento_global_monto: presupuesto.descuento_global_monto,
        total_final: presupuesto.total_final,
        notas_html: presupuesto.notas_html,
        condiciones_html: presupuesto.condiciones_html,
        pdf_url: presupuesto.pdf_url,
        lineas: lineas || [],
        cuotas: cuotas || [],
      },
      empresa: {
        nombre: empresa.nombre,
        logo_url: empresa.logo_url,
        color_marca: empresa.color_marca,
        descripcion: empresa.descripcion || null,
        telefono: empresa.telefono || null,
        correo: empresa.correo || null,
        pagina_web: empresa.pagina_web || null,
        ubicacion: empresa.ubicacion || null,
        datos_fiscales: empresa.datos_fiscales || null,
      },
      vendedor: {
        nombre: vendedor ? [vendedor.nombre, vendedor.apellido].filter(Boolean).join(' ') : 'Sin asignar',
        correo: vendedor?.correo || null,
        telefono: vendedor?.telefono || null,
      },
      datos_bancarios: datosBancarios,
      moneda_simbolo: monedaSimb,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
