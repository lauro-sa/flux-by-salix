import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarRateLimit, obtenerIp } from '@/lib/rate-limit'

/**
 * GET /api/portal/[token] — Endpoint público (sin auth).
 * Retorna todos los datos del presupuesto para el portal del cliente,
 * incluyendo estado persistido, firma, comprobantes y cuotas.
 * Se usa en: página pública /portal/[token]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Rate limit: 30 requests por minuto por IP
    const ip = obtenerIp(_request)
    const { permitido } = verificarRateLimit(`portal:${ip}`, { maximo: 30, ventanaSegundos: 60 })
    if (!permitido) return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
    const admin = crearClienteAdmin()

    // 1. Buscar token con todos los campos nuevos
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

    // 3. Registrar vista (incrementar contador, marcar primera vista, estado → visto)
    const actualizacionVista: Record<string, unknown> = {
      veces_visto: (portalToken.veces_visto || 0) + 1,
    }
    if (!portalToken.visto_en) {
      actualizacionVista.visto_en = new Date().toISOString()
    }
    // Solo transicionar a 'visto' si está en 'pendiente'
    if ((portalToken.estado_cliente || 'pendiente') === 'pendiente') {
      actualizacionVista.estado_cliente = 'visto'
    }
    // 4. Fetch en paralelo + update vista (todo junto, sin fire-and-forget)
    const [
      ,
      { data: presupuesto },
      { data: lineas },
      { data: cuotas },
      { data: empresa },
      { data: config },
      { data: vendedor },
    ] = await Promise.all([
      admin.from('portal_tokens').update(actualizacionVista).eq('id', portalToken.id),
      admin.from('presupuestos').select('*').eq('id', portalToken.presupuesto_id).single(),
      admin.from('lineas_presupuesto').select('*').eq('presupuesto_id', portalToken.presupuesto_id).order('orden'),
      admin.from('presupuesto_cuotas').select('*').eq('presupuesto_id', portalToken.presupuesto_id).order('numero'),
      admin.from('empresas').select('id, nombre, slug, logo_url, color_marca, descripcion, telefono, correo, pagina_web, ubicacion, datos_fiscales, datos_bancarios').eq('id', portalToken.empresa_id).single(),
      admin.from('config_presupuestos').select('datos_empresa_pdf, monedas').eq('empresa_id', portalToken.empresa_id).single(),
      admin.from('perfiles').select('nombre, apellido, correo, telefono').eq('id', portalToken.creado_por).single(),
    ])

    if (!presupuesto || !empresa) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // 5. Resolver símbolo de moneda
    const monedas = (config?.monedas || []) as { id: string; simbolo: string }[]
    const monedaSimb = monedas.find(m => m.id === presupuesto.moneda)?.simbolo || '$'

    // 6. Datos bancarios (herencia: empresa → config presupuestos si override)
    const datosEmpPdf = config?.datos_empresa_pdf as Record<string, unknown> | null
    let datosBancarios = null
    if (datosEmpPdf?.mostrar_datos_bancarios) {
      // Si usar_datos_empresa !== false, leer de empresa.datos_bancarios
      if (datosEmpPdf.usar_datos_empresa !== false) {
        const bancEmp = (empresa as Record<string, unknown>).datos_bancarios as Record<string, string> | null
        if (bancEmp && (bancEmp.banco || bancEmp.cbu || bancEmp.alias)) {
          datosBancarios = {
            banco: bancEmp.banco || '',
            titular: bancEmp.titular || '',
            numero_cuenta: bancEmp.numero_cuenta || '',
            cbu: bancEmp.cbu || '',
            alias: bancEmp.alias || '',
          }
        }
      } else if (datosEmpPdf.datos_bancarios) {
        // Override: usar datos específicos de config presupuestos
        const db = datosEmpPdf.datos_bancarios as Record<string, string>
        if (db.banco || db.cbu || db.alias) {
          datosBancarios = {
            banco: db.banco || '',
            titular: db.titular || '',
            numero_cuenta: db.numero_cuenta || '',
            cbu: db.cbu || '',
            alias: db.alias || '',
          }
        }
      }
    }

    // 7. Estado del portal (usar el estado persistido, fallback a calculado)
    const estadoCliente = portalToken.estado_cliente || (portalToken.visto_en ? 'visto' : 'pendiente')

    // 8. Firma (si existe)
    const firma = portalToken.firma_nombre ? {
      url: portalToken.firma_url || null,
      nombre: portalToken.firma_nombre,
      modo: portalToken.firma_modo || null,
    } : null

    // 9. Armar respuesta
    return NextResponse.json({
      token_id: portalToken.id,
      presupuesto: {
        id: presupuesto.id,
        numero: presupuesto.numero,
        estado: presupuesto.estado,
        fecha_emision: presupuesto.fecha_emision,
        fecha_vencimiento: presupuesto.fecha_vencimiento,
        moneda: presupuesto.moneda,
        referencia: presupuesto.referencia,
        condicion_pago_label: presupuesto.condicion_pago_label,
        condicion_pago_tipo: presupuesto.condicion_pago_tipo,
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
      // Estado persistido del portal
      estado_cliente: estadoCliente,
      firma,
      aceptado_en: portalToken.aceptado_en || null,
      rechazado_en: portalToken.rechazado_en || null,
      motivo_rechazo: portalToken.motivo_rechazo || null,
      mensajes: portalToken.mensajes || [],
      comprobantes: portalToken.comprobantes || [],
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
