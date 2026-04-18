import { obtenerAccessToken, escribirSpreadsheet, type ConfigGoogleDrive } from '@/lib/google-drive'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lógica de sincronización de datos a Google Sheets.
 * Transforma datos de cada módulo a formato tabular y los escribe en el spreadsheet correspondiente.
 * Se usa en: sincronización manual (/api/.../sincronizar) y cron automático.
 */

interface ResultadoSync {
  ok: boolean
  modulosSincronizados: string[]
  resumen: Record<string, number>
  error?: string
}

/** Sincroniza todos los módulos activos de una empresa */
export async function sincronizarEmpresa(
  admin: SupabaseClient,
  config: ConfigGoogleDrive,
): Promise<ResultadoSync> {
  const modulosSincronizados: string[] = []
  const resumen: Record<string, number> = {}

  try {
    // Derivar locale de la zona horaria de la empresa para formateo de fechas
    const { data: configRegional } = await admin
      .from('empresas')
      .select('zona_horaria')
      .eq('id', config.empresa_id)
      .maybeSingle()
    const zona = configRegional?.zona_horaria || 'America/Argentina/Buenos_Aires'
    const locale = zona.startsWith('America/Argentina') ? 'es-AR'
      : zona.startsWith('America') ? 'es-MX'
      : 'es'

    // Obtener access token fresco
    const accessToken = await obtenerAccessToken(config.refresh_token!)

    // Actualizar access token en BD
    await admin
      .from('configuracion_google_drive')
      .update({ access_token: accessToken, token_expira_en: new Date(Date.now() + 3600000).toISOString() })
      .eq('empresa_id', config.empresa_id)

    // Sincronizar cada módulo activo
    for (const modulo of config.modulos_activos) {
      const hoja = config.hojas[modulo]
      if (!hoja) continue

      try {
        const { encabezados, filas } = await obtenerDatosModulo(admin, config.empresa_id, modulo, locale)

        await escribirSpreadsheet(
          accessToken,
          hoja.spreadsheet_id,
          hoja.nombre,
          encabezados,
          filas,
        )

        modulosSincronizados.push(modulo)
        resumen[modulo] = filas.length
      } catch (err) {
        console.error(`Error sync módulo ${modulo}:`, err)
      }
    }

    // Actualizar estado en BD
    await admin
      .from('configuracion_google_drive')
      .update({
        ultima_sync: new Date().toISOString(),
        ultimo_error: null,
        resumen,
        actualizado_en: new Date().toISOString(),
      })
      .eq('empresa_id', config.empresa_id)

    return { ok: true, modulosSincronizados, resumen }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)

    // Guardar error en BD
    await admin
      .from('configuracion_google_drive')
      .update({ ultimo_error: errorMsg, actualizado_en: new Date().toISOString() })
      .eq('empresa_id', config.empresa_id)

    return { ok: false, modulosSincronizados, resumen, error: errorMsg }
  }
}

/** Obtiene los datos de un módulo en formato tabular (encabezados + filas) */
async function obtenerDatosModulo(
  admin: SupabaseClient,
  empresaId: string,
  modulo: string,
  locale = 'es-AR',
): Promise<{ encabezados: string[]; filas: (string | number | null)[][] }> {
  switch (modulo) {
    case 'contactos':
      return obtenerDatosContactos(admin, empresaId, locale)
    default:
      return { encabezados: [], filas: [] }
  }
}

/** Transforma contactos a formato tabular para Google Sheets */
async function obtenerDatosContactos(
  admin: SupabaseClient,
  empresaId: string,
  locale = 'es-AR',
): Promise<{ encabezados: string[]; filas: (string | number | null)[][] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contactos } = await admin
    .from('contactos')
    .select(`
      *,
      tipo_contacto:tipos_contacto!tipo_contacto_id(clave, etiqueta),
      direcciones:contacto_direcciones(tipo, calle, numero, ciudad, provincia, codigo_postal, pais, texto, es_principal),
      vinculaciones:contacto_vinculaciones!contacto_vinculaciones_contacto_id_fkey(
        puesto,
        vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(codigo, nombre, apellido),
        tipo_relacion:tipos_relacion(etiqueta)
      )
    `)
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .order('codigo')

  const encabezados = [
    'Código', 'Tipo', 'Nombre', 'Apellido', 'Título',
    'Correo', 'Teléfono', 'WhatsApp', 'Web',
    'Cargo', 'Rubro',
    'Tipo Identificación', 'Nro Identificación',
    'Moneda', 'Idioma', 'Límite Crédito',
    'Plazo Pago Cliente', 'Plazo Pago Proveedor',
    'Etiquetas', 'Notas', 'Origen', 'Estado',
    'Vinculado a', 'Rol Vinculación', 'Puesto',
    'Dirección', 'Ciudad', 'Provincia', 'CP', 'País',
    'Fecha Creación', 'Fecha Modificación',
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (contactos || []).map((c: any) => {
    const tipo = c.tipo_contacto
    const dirs = (c.direcciones || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirPrincipal = dirs.find((d: any) => d.es_principal) || dirs[0]
    const vincs = c.vinculaciones || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const primerVinc = vincs[0] as any

    const formatFecha = (f: string | null) => {
      if (!f) return null
      return new Date(f).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return [
      c.codigo,
      tipo?.etiqueta || '',
      c.nombre,
      c.apellido || '',
      c.titulo || '',
      c.correo || '',
      c.telefono || '',
      c.whatsapp || '',
      c.web || '',
      c.cargo || '',
      c.rubro || '',
      c.tipo_identificacion || '',
      c.numero_identificacion || '',
      c.moneda || '',
      c.idioma || '',
      c.limite_credito,
      c.plazo_pago_cliente || '',
      c.plazo_pago_proveedor || '',
      (c.etiquetas || []).join(', '),
      c.notas || '',
      c.origen || '',
      c.activo ? 'Activo' : 'Inactivo',
      primerVinc?.vinculado ? `${primerVinc.vinculado.nombre || ''} ${primerVinc.vinculado.apellido || ''}`.trim() : '',
      primerVinc?.tipo_relacion?.etiqueta || '',
      primerVinc?.puesto || '',
      dirPrincipal?.texto || [dirPrincipal?.calle, dirPrincipal?.numero, dirPrincipal?.ciudad].filter(Boolean).join(', ') || '',
      dirPrincipal?.ciudad || '',
      dirPrincipal?.provincia || '',
      dirPrincipal?.codigo_postal || '',
      dirPrincipal?.pais || '',
      formatFecha(c.creado_en),
      formatFecha(c.actualizado_en),
    ]
  })

  return { encabezados, filas }
}
