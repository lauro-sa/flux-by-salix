import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { normalizarTelefono } from '@/lib/validaciones'
import ExcelJS from 'exceljs'

/**
 * POST /api/contactos/importar — Importar contactos desde Excel/CSV.
 * Recibe FormData con archivo + mapeo de columnas confirmado por el usuario.
 * Si un contacto tiene código existente → actualiza. Si es nuevo → crea.
 * Se usa en: ModalImportar paso 4 (importación real).
 */
export async function POST(request: NextRequest) {
  try {
    // Importar crea masivamente contactos → requiere crear
    const guard = await requerirPermisoAPI('contactos', 'crear')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const formData = await request.formData()
    const archivo = formData.get('archivo') as File | null
    const mapeoJson = formData.get('mapeo') as string | null

    if (!archivo) return NextResponse.json({ error: 'Archivo obligatorio' }, { status: 400 })
    if (!mapeoJson) return NextResponse.json({ error: 'Mapeo obligatorio' }, { status: 400 })

    // mapeo: { "0": "nombre", "1": "correo", "3": null, ... }
    const mapeo: Record<string, string | null> = JSON.parse(mapeoJson)

    const nombre = archivo.name.toLowerCase()
    let encabezados: string[] = []
    let filas: string[][] = []

    // ── Parsear según formato ──
    if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
      const arrayBuffer = await archivo.arrayBuffer()
      const libro = new ExcelJS.Workbook()
      await libro.xlsx.load(arrayBuffer)
      const hoja = libro.worksheets[0]
      if (!hoja) return NextResponse.json({ error: 'El archivo no tiene hojas' }, { status: 400 })

      let filaEncabezado = 1
      hoja.eachRow((fila, numFila) => {
        if (encabezados.length > 0) return
        const celdas = fila.values as (string | number | null | undefined)[]
        const noVacias = celdas.filter(c => c != null && String(c).trim() !== '')
        if (noVacias.length >= 3) {
          encabezados = celdas.slice(1).map(c => String(c || '').trim())
          filaEncabezado = numFila
        }
      })

      hoja.eachRow((fila, numFila) => {
        if (numFila <= filaEncabezado) return
        const valores = fila.values as (string | number | null | undefined)[]
        const filaDatos = valores.slice(1).map(c => {
          if (c != null && typeof c === 'object' && 'toISOString' in c) return (c as Date).toISOString()
          return String(c ?? '').trim()
        })
        if (filaDatos.some(v => v !== '')) filas.push(filaDatos)
      })
    } else {
      const texto = await archivo.text()
      const lineas = texto.split('\n').filter(l => l.trim())
      if (lineas.length < 2) return NextResponse.json({ error: 'El archivo no tiene datos' }, { status: 400 })
      encabezados = parsearLineaCSV(lineas[0])
      filas = lineas.slice(1).map(l => parsearLineaCSV(l))
    }

    const admin = crearClienteAdmin()

    // Obtener tipos de contacto
    const { data: tipos } = await admin.from('tipos_contacto').select('id, clave').eq('empresa_id', empresaId)
    const mapasTipo: Record<string, string> = {}
    for (const t of (tipos || [])) {
      mapasTipo[t.clave] = t.id
      // Variantes comunes
      const variantes: Record<string, string> = {
        company: 'empresa', individual: 'persona', vendor: 'proveedor',
        supplier: 'proveedor', building: 'edificio', contact: 'persona',
      }
      for (const [en, es] of Object.entries(variantes)) {
        if (t.clave === es) mapasTipo[en] = t.id
      }
      mapasTipo[t.clave.charAt(0).toUpperCase() + t.clave.slice(1)] = t.id
    }
    const tipoPersonaId = mapasTipo['persona']

    // Obtener códigos existentes para detectar duplicados
    const { data: existentes } = await admin
      .from('contactos')
      .select('id, codigo')
      .eq('empresa_id', empresaId)

    const mapaExistentes: Record<string, string> = {}
    for (const c of (existentes || [])) {
      mapaExistentes[c.codigo] = c.id
    }

    let creados = 0
    let actualizados = 0
    let errores = 0
    const detalleErrores: string[] = []

    // ── Procesar filas ──
    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i]

      // Construir objeto mapeado
      const dato: Record<string, string> = {}
      for (const [indice, campo] of Object.entries(mapeo)) {
        if (campo && fila[Number(indice)] !== undefined) {
          dato[campo] = fila[Number(indice)]
        }
      }

      // Validar nombre obligatorio
      const nombre = (dato.nombre || '').trim()
      if (!nombre) {
        errores++
        detalleErrores.push(`Fila ${i + 2}: sin nombre`)
        continue
      }

      // Resolver tipo
      const tipoClave = (dato.tipo || 'persona').toLowerCase().trim()
      const tipoId = mapasTipo[tipoClave] || tipoPersonaId
      if (!tipoId) {
        errores++
        detalleErrores.push(`Fila ${i + 2}: tipo no válido "${tipoClave}"`)
        continue
      }

      // Procesar campos especiales
      const correo = procesarCorreo(dato.correo)
      const etiquetas = dato.etiquetas ? dato.etiquetas.split(',').map(e => e.trim()).filter(Boolean) : []
      const limiteCredito = dato.limite_credito ? parseFloat(dato.limite_credito.replace(/[.,]/g, (m, o, s) => o === s.lastIndexOf(m) ? '.' : '')) : null
      const rankCliente = dato.rank_cliente ? parseInt(dato.rank_cliente) : null
      const rankProveedor = dato.rank_proveedor ? parseInt(dato.rank_proveedor) : null

      // Estado activo
      let activo = true
      if (dato.activo) {
        const val = dato.activo.toLowerCase().trim()
        activo = !['inactivo', 'inactive', 'no', 'false', '0'].includes(val)
      }

      // ── Determinar si crear o actualizar ──
      const codigoExistente = dato.codigo ? dato.codigo.trim() : ''
      const idExistente = codigoExistente ? mapaExistentes[codigoExistente] : null

      const campos = {
        tipo_contacto_id: tipoId,
        nombre,
        apellido: dato.apellido?.trim() || null,
        titulo: dato.titulo?.trim() || null,
        correo,
        telefono: normalizarTelefono(dato.telefono),
        whatsapp: normalizarTelefono(dato.whatsapp),
        web: dato.web?.trim() || null,
        cargo: dato.cargo?.trim() || null,
        rubro: dato.rubro?.trim() || null,
        tipo_identificacion: dato.tipo_identificacion?.trim() || null,
        numero_identificacion: dato.numero_identificacion?.trim() || null,
        moneda: dato.moneda?.trim() || null,
        idioma: dato.idioma?.trim() || null,
        zona_horaria: dato.zona_horaria?.trim() || null,
        limite_credito: isNaN(limiteCredito as number) ? null : limiteCredito,
        plazo_pago_cliente: dato.plazo_pago_cliente?.trim() || null,
        plazo_pago_proveedor: dato.plazo_pago_proveedor?.trim() || null,
        rank_cliente: isNaN(rankCliente as number) ? null : rankCliente,
        rank_proveedor: isNaN(rankProveedor as number) ? null : rankProveedor,
        etiquetas,
        notas: dato.notas?.trim() || null,
        activo,
      }

      try {
        if (idExistente) {
          // Actualizar contacto existente
          const { error } = await admin.from('contactos')
            .update({ ...campos, editado_por: user.id, actualizado_en: new Date().toISOString() })
            .eq('id', idExistente)

          if (error) throw error

          // Actualizar dirección si hay datos de dirección
          if (dato.calle || dato.ciudad || dato.provincia) {
            await actualizarDireccion(admin, idExistente, dato)
          }

          actualizados++
        } else {
          // Crear nuevo contacto
          const { data: codigoData } = await admin.rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'contacto' })

          const { data: nuevoContacto, error } = await admin.from('contactos').insert({
            empresa_id: empresaId,
            ...campos,
            codigo: codigoData as string,
            origen: 'importacion',
            creado_por: user.id,
          }).select('id').single()

          if (error) throw error

          // Crear dirección si hay datos
          if (nuevoContacto && (dato.calle || dato.ciudad || dato.provincia)) {
            await crearDireccion(admin, nuevoContacto.id, dato)
          }

          // Registrar como responsable
          if (nuevoContacto) {
            await admin.from('contacto_responsables').insert({
              contacto_id: nuevoContacto.id,
              usuario_id: user.id,
            })
          }

          creados++
        }
      } catch (err) {
        errores++
        const msg = err instanceof Error ? err.message : String(err)
        detalleErrores.push(`Fila ${i + 2}: ${msg}`)
      }
    }

    return NextResponse.json({
      creados,
      actualizados,
      errores,
      total: filas.length,
      detalleErrores: detalleErrores.slice(0, 50),
    })
  } catch (err) {
    console.error('Error importar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** Procesa correo: toma el primero si hay múltiples separados por ; o , */
function procesarCorreo(correo?: string): string | null {
  if (!correo) return null
  const limpio = correo.trim().toLowerCase()
  if (!limpio) return null
  // Si hay múltiples, tomar el primero
  const separadores = /[;,]/
  if (separadores.test(limpio)) {
    return limpio.split(separadores)[0].trim() || null
  }
  return limpio
}

/** Crea dirección principal para un contacto nuevo */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function crearDireccion(admin: any, contactoId: string, dato: Record<string, string>) {
  await admin.from('contacto_direcciones').insert({
    contacto_id: contactoId,
    tipo: 'principal',
    calle: dato.calle?.trim() || null,
    numero: dato.numero_dir?.trim() || null,
    piso: dato.piso?.trim() || null,
    departamento: dato.departamento?.trim() || null,
    barrio: dato.barrio?.trim() || null,
    ciudad: dato.ciudad?.trim() || null,
    provincia: dato.provincia?.trim() || null,
    codigo_postal: dato.codigo_postal?.trim() || null,
    pais: dato.pais?.trim() || null,
    es_principal: true,
  })
}

/** Actualiza la dirección principal de un contacto existente */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function actualizarDireccion(admin: any, contactoId: string, dato: Record<string, string>) {
  const { data: dirExistente } = await admin
    .from('contacto_direcciones')
    .select('id')
    .eq('contacto_id', contactoId)
    .eq('es_principal', true)
    .single()

  const campos = {
    calle: dato.calle?.trim() || null,
    numero: dato.numero_dir?.trim() || null,
    piso: dato.piso?.trim() || null,
    departamento: dato.departamento?.trim() || null,
    barrio: dato.barrio?.trim() || null,
    ciudad: dato.ciudad?.trim() || null,
    provincia: dato.provincia?.trim() || null,
    codigo_postal: dato.codigo_postal?.trim() || null,
    pais: dato.pais?.trim() || null,
  }

  if (dirExistente) {
    await admin.from('contacto_direcciones').update(campos).eq('id', dirExistente.id)
  } else {
    await admin.from('contacto_direcciones').insert({
      contacto_id: contactoId,
      tipo: 'principal',
      es_principal: true,
      ...campos,
    })
  }
}

/** Parsea una línea CSV respetando comillas */
function parsearLineaCSV(linea: string): string[] {
  const resultado: string[] = []
  let actual = ''
  let enComillas = false

  for (let i = 0; i < linea.length; i++) {
    const char = linea[i]
    if (char === '"') {
      if (enComillas && linea[i + 1] === '"') { actual += '"'; i++; continue }
      enComillas = !enComillas
    } else if (char === ',' && !enComillas) {
      resultado.push(actual.trim())
      actual = ''
    } else {
      actual += char
    }
  }
  resultado.push(actual.trim())
  return resultado
}
