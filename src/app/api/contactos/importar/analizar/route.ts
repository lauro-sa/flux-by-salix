import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

/**
 * POST /api/contactos/importar/analizar — Analiza archivo Excel/CSV y devuelve
 * columnas detectadas, auto-mapeo sugerido y las primeras 10 filas de preview.
 * Se usa en: ModalImportar paso 2 (mapeo de columnas).
 */

// ── Alias de mapeo: variantes en español, inglés y formato Odoo ──
const ALIAS_CAMPOS: Record<string, string[]> = {
  nombre:               ['nombre', 'name', 'razón social', 'razon social', 'nombre completo', 'full name', 'contact name'],
  apellido:             ['apellido', 'surname', 'last name', 'lastname', 'family name'],
  tipo:                 ['tipo', 'type', 'tipo de contacto', 'contact type', 'category'],
  titulo:               ['titulo', 'título', 'title', 'prefix', 'tratamiento', 'sr', 'sra'],
  correo:               ['correo', 'email', 'mail', 'e-mail', 'correo electrónico', 'correo electronico', 'email address'],
  telefono:             ['teléfono', 'telefono', 'phone', 'tel', 'fono', 'phone number', 'landline', 'fijo'],
  whatsapp:             ['whatsapp', 'wa', 'celular', 'cel', 'mobile', 'cell', 'móvil', 'movil', 'mobile phone'],
  web:                  ['web', 'website', 'sitio web', 'url', 'página web', 'pagina web', 'homepage'],
  cargo:                ['cargo', 'puesto', 'position', 'job title', 'function', 'job position', 'función', 'funcion'],
  rubro:                ['rubro', 'industria', 'industry', 'sector', 'giro', 'actividad'],
  tipo_identificacion:  ['tipo identificación', 'tipo identificacion', 'id type', 'document type', 'tipo documento', 'tipo doc'],
  numero_identificacion:['nro identificación', 'nro identificacion', 'número identificación', 'numero identificacion',
                         'identification', 'id number', 'document number', 'nro documento', 'tax id', 'vat',
                         'cuit', 'cuil', 'dni', 'rut', 'ruc', 'nit', 'rfc', 'pasaporte', 'cedula', 'cédula'],
  moneda:               ['moneda', 'currency', 'divisa'],
  idioma:               ['idioma', 'language', 'lang', 'idioma preferido'],
  zona_horaria:         ['zona horaria', 'timezone', 'time zone', 'tz'],
  limite_credito:       ['límite crédito', 'limite credito', 'credit limit', 'crédito', 'credito'],
  plazo_pago_cliente:   ['plazo pago cliente', 'customer payment terms', 'payment terms', 'plazo pago', 'condiciones pago'],
  plazo_pago_proveedor: ['plazo pago proveedor', 'supplier payment terms', 'vendor payment terms'],
  rank_cliente:         ['rank cliente', 'customer rank', 'client rank', 'prioridad cliente'],
  rank_proveedor:       ['rank proveedor', 'supplier rank', 'vendor rank', 'prioridad proveedor'],
  etiquetas:            ['etiquetas', 'tags', 'labels', 'categorías', 'categorias', 'categories'],
  notas:                ['notas', 'notes', 'comentarios', 'description', 'descripción', 'descripcion', 'observaciones'],
  origen:               ['origen', 'origin', 'source', 'fuente'],
  activo:               ['estado', 'activo', 'status', 'active'],
  calle:                ['calle', 'street', 'dirección', 'direccion', 'address', 'domicilio', 'street1', 'via'],
  numero_dir:           ['número', 'numero', 'nro', 'number', 'street number', 'altura'],
  piso:                 ['piso', 'floor', 'planta'],
  departamento:         ['departamento', 'depto', 'dpto', 'apt', 'apartment', 'unidad', 'oficina'],
  barrio:               ['barrio', 'neighborhood', 'colonia', 'zona'],
  ciudad:               ['ciudad', 'city', 'localidad', 'municipio', 'town'],
  provincia:            ['provincia', 'state', 'estado', 'departamento_dir', 'region', 'región'],
  codigo_postal:        ['código postal', 'codigo postal', 'cp', 'zip', 'zip code', 'postal code', 'postal'],
  pais:                 ['país', 'pais', 'country', 'nación', 'nacion'],
  vinculado_codigo:     ['vinculado a (código)', 'vinculado a (codigo)', 'empresa padre', 'parent', 'parent_id',
                         'company', 'empresa', 'company_name', 'parent company'],
  codigo:               ['código', 'codigo', 'code', 'id externo', 'external id', 'ref', 'referencia'],
}

/** Normaliza texto quitando tildes, pasando a minúsculas y limpiando separadores */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-/\\]/g, ' ')
    .trim()
}

/** Auto-mapea una columna del archivo a un campo del sistema */
function autoMapear(columnaArchivo: string): string | null {
  const norm = normalizar(columnaArchivo)

  for (const [campo, aliases] of Object.entries(ALIAS_CAMPOS)) {
    // Match exacto
    if (aliases.some(a => normalizar(a) === norm)) return campo

    // Empieza con
    if (aliases.some(a => norm.startsWith(normalizar(a)))) return campo
  }

  // Contiene (segundo paso, menos preciso)
  for (const [campo, aliases] of Object.entries(ALIAS_CAMPOS)) {
    if (aliases.some(a => norm.includes(normalizar(a)))) return campo
  }

  return null
}

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

      // Detectar fila de encabezados (primera fila no vacía con ≥3 celdas con texto)
      let filaEncabezado = 1
      hoja.eachRow((fila, numFila) => {
        if (encabezados.length > 0) return
        const celdas = fila.values as (string | number | null | undefined)[]
        const noVacias = celdas.filter(c => c != null && String(c).trim() !== '')
        if (noVacias.length >= 3) {
          encabezados = celdas.slice(1).map(c => String(c || '').trim()) // slice(1) porque ExcelJS usa índice 1
          filaEncabezado = numFila
        }
      })

      if (encabezados.length === 0) {
        return NextResponse.json({ error: 'No se detectaron encabezados en el archivo' }, { status: 400 })
      }

      // Leer filas de datos
      hoja.eachRow((fila, numFila) => {
        if (numFila <= filaEncabezado) return
        const valores = fila.values as (string | number | null | undefined)[]
        const filaDatos = valores.slice(1).map(c => String(c ?? '').trim())
        // Solo filas con al menos un dato
        if (filaDatos.some(v => v !== '')) {
          filas.push(filaDatos)
        }
      })
    } else {
      // CSV
      const texto = await archivo.text()
      const lineas = texto.split('\n').filter(l => l.trim())
      if (lineas.length < 2) return NextResponse.json({ error: 'El archivo no tiene datos' }, { status: 400 })

      encabezados = parsearLineaCSV(lineas[0])
      filas = lineas.slice(1).map(l => parsearLineaCSV(l))
    }

    // ── Auto-mapeo ──
    const admin = crearClienteAdmin()
    const { data: tipos } = await admin.from('tipos_contacto').select('clave, etiqueta').eq('empresa_id', empresaId).eq('activo', true)

    const mapeo: Record<number, string | null> = {}
    const camposUsados = new Set<string>()

    encabezados.forEach((enc, i) => {
      const campo = autoMapear(enc)
      if (campo && !camposUsados.has(campo)) {
        mapeo[i] = campo
        camposUsados.add(campo)
      } else {
        mapeo[i] = null
      }
    })

    // Campos disponibles para mapeo manual
    const camposDisponibles = Object.keys(ALIAS_CAMPOS).map(clave => ({
      clave,
      etiqueta: ALIAS_CAMPOS[clave][0].charAt(0).toUpperCase() + ALIAS_CAMPOS[clave][0].slice(1),
    }))

    return NextResponse.json({
      encabezados,
      totalFilas: filas.length,
      preview: filas.slice(0, 10), // primeras 10 filas para preview
      mapeo,
      camposDisponibles,
      tiposContacto: tipos || [],
    })
  } catch (err) {
    console.error('Error analizar importación:', err)
    return NextResponse.json({ error: 'Error al analizar el archivo' }, { status: 500 })
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
