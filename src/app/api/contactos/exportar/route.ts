import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearFormato } from '@/lib/formato-regional'
import ExcelJS from 'exceljs'

/**
 * GET /api/contactos/exportar — Exportar contactos como Excel (.xlsx).
 * Genera archivo Excel estilizado con todos los campos, vinculaciones y direcciones.
 * Se usa en: página de contactos → menú acciones → "Exportar Excel".
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Obtener nombre y config regional de empresa para el título y formateo
    const { data: empresa } = await admin
      .from('empresas')
      .select('nombre, zona_horaria')
      .eq('id', empresaId)
      .single()

    const nombreEmpresa = empresa?.nombre || 'Empresa'
    const fmt = crearFormato({ zona_horaria: empresa?.zona_horaria })

    // Obtener contactos con relaciones
    const { data: contactos } = await admin
      .from('contactos')
      .select(`
        *,
        tipo_contacto:tipos_contacto!tipo_contacto_id(clave, etiqueta),
        direcciones:contacto_direcciones(tipo, calle, numero, piso, departamento, barrio, ciudad, provincia, codigo_postal, pais, texto, es_principal),
        vinculaciones:contacto_vinculaciones!contacto_vinculaciones_contacto_id_fkey(
          puesto,
          recibe_documentos,
          vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(codigo, nombre, apellido),
          tipo_relacion:tipos_relacion(etiqueta)
        ),
        responsables:contacto_responsables(
          perfil:perfiles!contacto_responsables_usuario_id_fkey(nombre, apellido)
        )
      `)
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .order('codigo')

    if (!contactos?.length) {
      return new Response('No hay contactos para exportar', { status: 404 })
    }

    // Obtener tipos y etiquetas para la sección de referencia
    const [{ data: tipos }, { data: etiquetasConfig }] = await Promise.all([
      admin.from('tipos_contacto').select('clave, etiqueta').eq('empresa_id', empresaId).eq('activo', true),
      admin.from('etiquetas_contacto').select('nombre').eq('empresa_id', empresaId).eq('activo', true),
    ])

    // ── Crear libro Excel ──
    const libro = new ExcelJS.Workbook()
    libro.creator = 'Flux by Salix'
    libro.created = new Date()

    const hoja = libro.addWorksheet('Contactos', {
      views: [{ state: 'frozen', ySplit: 2 }],
    })

    // Color de la empresa (azul por defecto)
    const colorEmpresa = '2563EB'

    const encabezados = [
      'Código', 'Tipo', 'Nombre', 'Apellido', 'Título',
      'Correo', 'Teléfono', 'WhatsApp', 'Web',
      'Cargo', 'Rubro',
      'Tipo Identificación', 'Nro Identificación',
      'Moneda', 'Idioma', 'Zona Horaria',
      'Límite Crédito', 'Plazo Pago Cliente', 'Plazo Pago Proveedor',
      'Rank Cliente', 'Rank Proveedor',
      'Etiquetas', 'Notas', 'Origen', 'Estado',
      'Vinculado a (Código)', 'Vinculado a (Nombre)', 'Rol Vinculación', 'Puesto Vinculación',
      'Asignado a',
      'Dirección Principal', 'Ciudad', 'Provincia', 'Código Postal', 'País',
      'Fecha Creación', 'Fecha Modificación',
    ]

    const anchos = [
      12, 14, 22, 18, 10,
      28, 18, 18, 24,
      18, 18,
      18, 18,
      10, 10, 16,
      16, 18, 20,
      14, 14,
      24, 30, 14, 10,
      18, 22, 18, 18,
      22,
      36, 16, 16, 14, 14,
      18, 18,
    ]

    // Aplicar anchos de columna
    anchos.forEach((ancho, i) => { hoja.getColumn(i + 1).width = ancho })

    // ── Fila 1: Título fusionado ──
    const ahora = new Date()
    const fechaHora = fmt.fecha(ahora) + ' ' + fmt.hora(ahora)

    const filaTitulo = hoja.addRow([`Contactos — ${nombreEmpresa} — ${fechaHora}`])
    hoja.mergeCells(1, 1, 1, encabezados.length)
    filaTitulo.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
    filaTitulo.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${colorEmpresa}` } }
    filaTitulo.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
    filaTitulo.height = 32

    // ── Fila 2: Encabezados ──
    const filaEncabezados = hoja.addRow(encabezados)
    filaEncabezados.eachCell((celda) => {
      celda.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${colorEmpresa}` } }
      celda.alignment = { vertical: 'middle', horizontal: 'left' }
      celda.border = { bottom: { style: 'thin', color: { argb: 'FF1E40AF' } } }
    })
    filaEncabezados.height = 26

    // ── Filas de datos ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contactos.forEach((c: any, idx: number) => {
      const tipo = c.tipo_contacto
      const dirs = (c.direcciones || []) as Record<string, unknown>[]
      const dirPrincipal = dirs.find((d: Record<string, unknown>) => d.es_principal) || dirs[0]
      const vincs = (c.vinculaciones || []) as Record<string, unknown>[]
      const primerVinc = vincs[0] as Record<string, unknown> | undefined
      const resps = (c.responsables || []) as Record<string, unknown>[]

      const vinculado = primerVinc?.vinculado as Record<string, unknown> | undefined
      const tipoRelacion = primerVinc?.tipo_relacion as Record<string, unknown> | undefined

      const nombresResp = resps.map((r: Record<string, unknown>) => {
        const p = r.perfil as Record<string, unknown> | undefined
        return p ? `${p.nombre || ''} ${p.apellido || ''}`.trim() : ''
      }).filter(Boolean).join(', ')

      const valores = [
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
        c.zona_horaria || '',
        c.limite_credito || '',
        c.plazo_pago_cliente || '',
        c.plazo_pago_proveedor || '',
        c.rank_cliente || '',
        c.rank_proveedor || '',
        (c.etiquetas || []).join(', '),
        c.notas || '',
        c.origen || '',
        c.activo ? 'Activo' : 'Inactivo',
        vinculado?.codigo || '',
        vinculado ? `${vinculado.nombre || ''}${vinculado.apellido ? ` ${vinculado.apellido}` : ''}`.trim() : '',
        tipoRelacion?.etiqueta || '',
        (primerVinc?.puesto as string) || '',
        nombresResp,
        dirPrincipal ? (dirPrincipal.texto || [dirPrincipal.calle, dirPrincipal.numero, dirPrincipal.ciudad, dirPrincipal.provincia].filter(Boolean).join(', ')) : '',
        (dirPrincipal?.ciudad as string) || '',
        (dirPrincipal?.provincia as string) || '',
        (dirPrincipal?.codigo_postal as string) || '',
        (dirPrincipal?.pais as string) || '',
        c.creado_en ? fmt.fecha(c.creado_en, { conHora: true }) : '',
        c.actualizado_en ? fmt.fecha(c.actualizado_en, { conHora: true }) : '',
      ]

      const fila = hoja.addRow(valores)

      // Colores alternados
      const colorFondo = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF'
      fila.eachCell({ includeEmpty: true }, (celda) => {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFondo } }
        celda.alignment = { vertical: 'middle' }
        celda.font = { size: 10 }
      })
    })

    // ── Auto-filtro en fila de encabezados ──
    hoja.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: encabezados.length },
    }

    // ── Sección de referencia al final ──
    const filaEspaciador = hoja.rowCount + 3
    const filaRefTitulo = hoja.getRow(filaEspaciador)
    filaRefTitulo.getCell(1).value = 'VALORES DE REFERENCIA'
    filaRefTitulo.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF374151' } }

    // Tipos válidos
    const filaRefTipos = hoja.getRow(filaEspaciador + 1)
    filaRefTipos.getCell(1).value = 'Tipos válidos:'
    filaRefTipos.getCell(1).font = { bold: true, size: 10 }
    filaRefTipos.getCell(2).value = (tipos || []).map((t: Record<string, unknown>) => t.etiqueta).join(', ')

    // Etiquetas
    const filaRefEtiquetas = hoja.getRow(filaEspaciador + 2)
    filaRefEtiquetas.getCell(1).value = 'Etiquetas:'
    filaRefEtiquetas.getCell(1).font = { bold: true, size: 10 }
    filaRefEtiquetas.getCell(2).value = (etiquetasConfig || []).map((e: Record<string, unknown>) => e.nombre).join(', ')

    // Identificación
    const filaRefId = hoja.getRow(filaEspaciador + 3)
    filaRefId.getCell(1).value = 'Tipo identificación:'
    filaRefId.getCell(1).font = { bold: true, size: 10 }
    filaRefId.getCell(2).value = 'cuit, cuil, dni, pasaporte, cedula, rut, ruc, nit'

    // Orígenes
    const filaRefOrigen = hoja.getRow(filaEspaciador + 4)
    filaRefOrigen.getCell(1).value = 'Orígenes:'
    filaRefOrigen.getCell(1).font = { bold: true, size: 10 }
    filaRefOrigen.getCell(2).value = 'manual, importacion, whatsapp, api'

    // ── Generar buffer ──
    const buffer = await libro.xlsx.writeBuffer()

    const nombreArchivo = `Contactos - ${nombreEmpresa} - ${ahora.toISOString().slice(0, 10)} ${ahora.toTimeString().slice(0, 5).replace(':', '')}.xlsx`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      },
    })
  } catch (err) {
    console.error('Error exportar Excel:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
