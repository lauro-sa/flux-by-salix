import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/contactos/importar — Importar contactos desde CSV.
 * Recibe FormData con archivo CSV. Crea contactos en batch.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const formData = await request.formData()
    const archivo = formData.get('archivo') as File | null

    if (!archivo) return NextResponse.json({ error: 'Archivo obligatorio' }, { status: 400 })

    const texto = await archivo.text()
    const lineas = texto.split('\n').filter(l => l.trim())

    if (lineas.length < 2) return NextResponse.json({ error: 'El archivo no tiene datos' }, { status: 400 })

    // Parsear CSV
    const encabezados = parsearLineaCSV(lineas[0]).map(h => h.toLowerCase().trim())
    const filas = lineas.slice(1).map(l => parsearLineaCSV(l))

    const admin = crearClienteAdmin()

    // Obtener tipos de contacto para mapear
    const { data: tipos } = await admin.from('tipos_contacto').select('id, clave').eq('empresa_id', empresaId)
    const mapasTipo: Record<string, string> = {}
    for (const t of (tipos || [])) {
      mapasTipo[t.clave] = t.id
      mapasTipo[t.clave.charAt(0).toUpperCase() + t.clave.slice(1)] = t.id // "Persona" → id
    }

    let creados = 0
    let errores = 0
    const detalleErrores: string[] = []

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i]
      const dato: Record<string, string> = {}
      encabezados.forEach((h, j) => { dato[h] = fila[j] || '' })

      // Mapear campos
      const nombre = dato['nombre'] || dato['name'] || ''
      if (!nombre.trim()) { errores++; detalleErrores.push(`Fila ${i + 2}: sin nombre`); continue }

      const tipoClave = (dato['tipo'] || dato['type'] || 'persona').toLowerCase()
      const tipoId = mapasTipo[tipoClave] || mapasTipo['persona']

      if (!tipoId) { errores++; detalleErrores.push(`Fila ${i + 2}: tipo no válido "${tipoClave}"`); continue }

      // Generar código
      const { data: codigoData } = await admin.rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'contacto' })

      const contacto = {
        empresa_id: empresaId,
        tipo_contacto_id: tipoId,
        codigo: codigoData as string,
        nombre: nombre.trim(),
        apellido: (dato['apellido'] || dato['surname'] || '').trim() || null,
        correo: (dato['correo'] || dato['email'] || '').trim().toLowerCase() || null,
        telefono: (dato['teléfono'] || dato['telefono'] || dato['phone'] || '').trim() || null,
        whatsapp: (dato['whatsapp'] || '').trim() || null,
        cargo: (dato['cargo'] || dato['puesto'] || '').trim() || null,
        rubro: (dato['rubro'] || dato['industria'] || '').trim() || null,
        web: (dato['web'] || dato['sitio web'] || '').trim() || null,
        tipo_identificacion: (dato['tipo identificación'] || dato['tipo identificacion'] || '').trim() || null,
        numero_identificacion: (dato['nro identificación'] || dato['nro identificacion'] || dato['cuit'] || dato['dni'] || '').trim() || null,
        etiquetas: dato['etiquetas'] ? dato['etiquetas'].split(',').map(e => e.trim()).filter(Boolean) : [],
        notas: (dato['notas'] || '').trim() || null,
        origen: 'importacion',
        creado_por: user.id,
      }

      const { error } = await admin.from('contactos').insert(contacto)
      if (error) { errores++; detalleErrores.push(`Fila ${i + 2}: ${error.message}`); continue }

      creados++
    }

    return NextResponse.json({
      creados,
      errores,
      total: filas.length,
      detalleErrores: detalleErrores.slice(0, 20), // máximo 20 errores de detalle
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
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
