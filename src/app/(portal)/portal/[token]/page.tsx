import { cache } from 'react'
import type { Metadata } from 'next'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'
import { generarPdfPresupuesto } from '@/lib/pdf/generar-pdf'
import VistaPortal from './_componentes/VistaPortal'
import PortalExpirado from './_componentes/PortalExpirado'
import type { DatosPortal } from '@/tipos/portal'

/**
 * Página pública del portal de presupuestos.
 * Usa cache() de React para deduplicar queries entre generateMetadata y el page.
 * Se usa en: /portal/[token] (público, sin auth)
 */

interface Props {
  params: Promise<{ token: string }>
}

/** Deriva el locale BCP-47 a partir de la zona horaria de la empresa */
function obtenerLocale(zona?: string): string {
  if (!zona) return 'es'
  if (zona.startsWith('America/Argentina')) return 'es-AR'
  if (zona.startsWith('America')) return 'es-MX'
  return 'es'
}

// ── Función cacheada: una sola ejecución por request ──────────────────────
const obtenerDatosPortal = cache(async (token: string): Promise<DatosPortal | null> => {
  try {
    const admin = crearClienteAdmin()

    // 1. Buscar token activo
    const { data: portalToken } = await admin
      .from('portal_tokens')
      .select('*')
      .eq('token', token)
      .eq('activo', true)
      .single()

    if (!portalToken) return null

    // 2. Verificar expiración
    if (new Date(portalToken.expira_en).getTime() < Date.now()) return null

    // 3. Preparar update de vista (siempre incrementar contador)
    const esPrimeraVista = !portalToken.visto_en
    const ahora = new Date().toISOString()

    // Update básico: contador + estado (NO incluye visto_en para primera vista)
    const actualizacionVista: Record<string, unknown> = {
      veces_visto: (portalToken.veces_visto || 0) + 1,
    }
    if ((portalToken.estado_cliente || 'pendiente') === 'pendiente') {
      actualizacionVista.estado_cliente = 'visto'
    }
    // visto_en se maneja por separado con update atómico para evitar race conditions

    // 4. Todo en paralelo: update vista + 6 fetches
    const [
      ,
      { data: presupuesto },
      { data: lineas },
      { data: cuotas },
      { data: empresa },
      { data: config },
      { data: vendedor },
    ] = await Promise.all([
      (async () => {
        // Siempre actualizar contador y estado
        await admin.from('portal_tokens').update(actualizacionVista).eq('id', portalToken.id)

        // Primera vista: update atómico con .is('visto_en', null) para evitar duplicados
        if (esPrimeraVista) {
          try {
            const { data: filaActualizada } = await admin
              .from('portal_tokens')
              .update({ visto_en: ahora })
              .eq('id', portalToken.id)
              .is('visto_en', null)
              .select('id')

            // Si no actualizó nada, otro request ya marcó visto_en — no duplicar notificación
            if (!filaActualizada?.length) return

            const { data: pres } = await admin
              .from('presupuestos')
              .select('numero, contacto_nombre')
              .eq('id', portalToken.presupuesto_id)
              .single()
            await crearNotificacion({
              empresaId: portalToken.empresa_id,
              usuarioId: portalToken.creado_por,
              tipo: 'portal_vista',
              titulo: pres ? `👁️ ${pres.contacto_nombre} abrió el presupuesto #${pres.numero}` : '👁️ El cliente abrió el presupuesto',
              icono: 'Eye',
              color: 'var(--insignia-info-texto)',
              url: '/presupuestos',
              referenciaTipo: 'presupuesto',
              referenciaId: portalToken.presupuesto_id,
            })
          } catch { /* no bloquear renderizado */ }
        }
      })(),
      admin.from('presupuestos').select('*').eq('id', portalToken.presupuesto_id).single(),
      admin.from('lineas_presupuesto').select('*').eq('presupuesto_id', portalToken.presupuesto_id).order('orden'),
      admin.from('presupuesto_cuotas').select('*').eq('presupuesto_id', portalToken.presupuesto_id).order('numero'),
      admin.from('empresas').select('id, nombre, slug, logo_url, color_marca, descripcion, telefono, correo, pagina_web, ubicacion, direccion, datos_fiscales, datos_bancarios, zona_horaria').eq('id', portalToken.empresa_id).single(),
      admin.from('config_presupuestos').select('datos_empresa_pdf, monedas').eq('empresa_id', portalToken.empresa_id).single(),
      admin.from('perfiles').select('nombre, apellido, correo, telefono').eq('id', portalToken.creado_por).single(),
    ])

    if (!presupuesto || !empresa) return null

    // 5. Auto-generar PDF si falta o está desactualizado
    let pdfUrl = presupuesto.pdf_url
    const pdfDesactualizado = !pdfUrl
      || !presupuesto.pdf_generado_en
      || new Date(presupuesto.pdf_generado_en).getTime() < new Date(presupuesto.actualizado_en).getTime()

    if (pdfDesactualizado) {
      try {
        const resultado = await generarPdfPresupuesto(admin, presupuesto.id, portalToken.empresa_id, {
          congelado: false,
          forzar: false,
        })
        pdfUrl = resultado.url
      } catch {
        // Si falla la generación, el portal se muestra igual sin botón de PDF
      }
    }

    // 6. Símbolo de moneda
    const monedas = (config?.monedas || []) as { id: string; simbolo: string }[]
    const monedaSimb = monedas.find(m => m.id === presupuesto.moneda)?.simbolo || '$'

    // 6. Datos bancarios (herencia: empresa → config presupuestos si override)
    const datosEmpPdf = config?.datos_empresa_pdf as Record<string, unknown> | null
    let datosBancarios = null
    if (datosEmpPdf?.mostrar_datos_bancarios) {
      if (datosEmpPdf.usar_datos_empresa !== false) {
        // Herencia: leer de empresa.datos_bancarios
        const bancEmp = (empresa as Record<string, unknown>).datos_bancarios as Record<string, string> | null
        if (bancEmp && (bancEmp.banco || bancEmp.cbu || bancEmp.alias)) {
          datosBancarios = { banco: bancEmp.banco || '', titular: bancEmp.titular || '', numero_cuenta: bancEmp.numero_cuenta || '', cbu: bancEmp.cbu || '', alias: bancEmp.alias || '' }
        }
      } else if (datosEmpPdf.datos_bancarios) {
        // Override: usar datos específicos de config presupuestos
        const db = datosEmpPdf.datos_bancarios as Record<string, string>
        if (db.banco || db.cbu || db.alias) {
          datosBancarios = { banco: db.banco || '', titular: db.titular || '', numero_cuenta: db.numero_cuenta || '', cbu: db.cbu || '', alias: db.alias || '' }
        }
      }
    }

    // 7. Estado y firma
    const estadoCliente = portalToken.estado_cliente || (portalToken.visto_en ? 'visto' : 'pendiente')
    const firma = portalToken.firma_nombre ? {
      url: portalToken.firma_url || null,
      nombre: portalToken.firma_nombre,
      modo: portalToken.firma_modo || null,
    } : null

    return {
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
        pdf_url: pdfUrl,
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
        ubicacion: (() => {
          // Solo mostrar ciudad y país al cliente — nunca la dirección completa
          const dir = empresa.direccion as { ciudad?: string; pais?: string } | null
          if (dir?.ciudad || dir?.pais) {
            return [dir.ciudad, dir.pais].filter(Boolean).join(', ')
          }
          return null
        })(),
        datos_fiscales: empresa.datos_fiscales || null,
      },
      vendedor: {
        nombre: vendedor ? [vendedor.nombre, vendedor.apellido].filter(Boolean).join(' ') : 'Sin asignar',
        correo: vendedor?.correo || null,
        telefono: vendedor?.telefono || null,
      },
      datos_bancarios: datosBancarios,
      moneda_simbolo: monedaSimb,
      locale: obtenerLocale(empresa.zona_horaria),
      estado_cliente: estadoCliente,
      firma,
      aceptado_en: portalToken.aceptado_en || null,
      rechazado_en: portalToken.rechazado_en || null,
      motivo_rechazo: portalToken.motivo_rechazo || null,
      mensajes: portalToken.mensajes || [],
      comprobantes: portalToken.comprobantes || [],
    }
  } catch {
    return null
  }
})

// ── Metadata (usa la misma función cacheada) ──────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const datos = await obtenerDatosPortal(token)

  if (!datos) {
    return { title: 'Enlace no válido — Flux by Salix' }
  }

  const titulo = `Presupuesto ${datos.presupuesto.numero} — ${datos.empresa.nombre}`
  const descripcion = `${datos.empresa.nombre} te envió un presupuesto para tu revisión.`

  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      type: 'website',
      siteName: 'Flux by Salix',
      ...(datos.empresa.logo_url ? {
        images: [{ url: datos.empresa.logo_url, width: 200, height: 200, alt: datos.empresa.nombre }],
      } : {}),
    },
    twitter: {
      card: 'summary',
      title: titulo,
      description: descripcion,
      ...(datos.empresa.logo_url ? { images: [datos.empresa.logo_url] } : {}),
    },
  }
}

// ── Página ────────────────────────────────────────────────────────────────
export default async function PaginaPortal({ params }: Props) {
  const { token } = await params
  const datos = await obtenerDatosPortal(token)

  if (!datos) {
    return <PortalExpirado />
  }

  return <VistaPortal datos={datos} />
}
