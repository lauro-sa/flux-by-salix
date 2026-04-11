import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/presupuestos/asistente — Asistente Salix para armar presupuestos.
 * Recibe una descripción libre del trabajo y devuelve líneas propuestas
 * matcheadas con el catálogo de productos/servicios.
 */

interface LineaPropuesta {
  producto_id: string | null
  codigo: string
  referencia_interna: string | null
  nombre: string
  descripcion_venta: string
  unidad: string
  impuesto_id: string | null
  es_nuevo: boolean
  categoria_sugerida: string | null
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { descripcion, modo = 'detallado' } = await request.json()
    if (!descripcion?.trim()) {
      return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 })
    }

    const esSimple = modo === 'simple'
    const esPaquete = modo === 'paquete'
    const admin = crearClienteAdmin()

    // Obtener API key de la config de IA de la empresa
    const { data: configIA } = await admin
      .from('config_ia')
      .select('api_key_anthropic, modelo_anthropic, prompt_asistente_presupuestos')
      .eq('empresa_id', empresaId)
      .single()

    const apiKey = configIA?.api_key_anthropic
    const promptPersonalizado = configIA?.prompt_asistente_presupuestos || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'No hay API key de Anthropic configurada. Configurala en Configuración → IA.' }, { status: 400 })
    }

    const modelo = configIA?.modelo_anthropic || 'claude-sonnet-4-20250514'

    // Cargar catálogo de productos activos
    const { data: productos } = await admin
      .from('productos')
      .select('id, codigo, referencia_interna, nombre, tipo, categoria, descripcion_venta, unidad, impuesto_id')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .eq('en_papelera', false)
      .eq('puede_venderse', true)
      .order('nombre')

    let catalogoTexto = ''
    let categoriasTexto = ''

    if (!esSimple || esPaquete) {
      const { data: configData } = await admin
        .from('config_productos')
        .select('categorias')
        .eq('empresa_id', empresaId)
        .single()

      const categorias = (configData?.categorias || []) as { id: string; label: string }[]

      catalogoTexto = (productos || []).map(p =>
        `- [${p.referencia_interna || p.codigo}] ${p.nombre} (${p.tipo}, cat: ${p.categoria || 'general'}) → ${p.descripcion_venta || ''}`
      ).join('\n')

      categoriasTexto = categorias.map(c => `${c.id}: ${c.label}`).join(', ')
    }

    // Construir prompt según modo
    const promptSimple = `Sos el Asistente Salix, un asistente de presupuestos integrado en Flux by Salix.
${promptPersonalizado ? `\nINSTRUCCIONES DE LA EMPRESA:\n${promptPersonalizado}\n` : ''}
DESCRIPCIÓN DEL TRABAJO:
"${descripcion}"

INSTRUCCIONES:
1. Tomá la descripción del trabajo y redactala de forma profesional
2. Creá UNA SOLA línea de presupuesto con todo el trabajo descrito en un párrafo
3. El párrafo debe ser claro, técnico, profesional, sin saltos de línea
4. Corregí errores de ortografía y gramática
5. No hagas el texto más largo de lo necesario
6. Mantené el contenido original, solo mejorá la redacción

Respondé SOLO con un JSON array con UN elemento, sin texto adicional ni markdown:
[{
  "codigo_catalogo": null,
  "nombre": "Servicio",
  "descripcion_venta": "párrafo profesional con todo el trabajo",
  "unidad": "unidad",
  "es_nuevo": false,
  "codigo_sugerido": null,
  "categoria_sugerida": null
}]`

    // Obtener códigos existentes para que la IA no pise numeración
    const codigosExistentes = (productos || [])
      .map(p => p.referencia_interna)
      .filter(Boolean)
      .join(', ')

    const promptDetallado = `Sos el Asistente Salix, un asistente de presupuestos integrado en Flux by Salix.
${promptPersonalizado ? `\nINSTRUCCIONES DE LA EMPRESA:\n${promptPersonalizado}\n` : ''}
CATÁLOGO DE SERVICIOS/PRODUCTOS DISPONIBLES:
${catalogoTexto}

CATEGORÍAS DISPONIBLES: ${categoriasTexto}

CÓDIGOS DE REFERENCIA YA USADOS (no repetir): ${codigosExistentes}

DESCRIPCIÓN DEL TRABAJO:
"${descripcion}"

REGLAS IMPORTANTES:
- Respetá EXACTAMENTE lo que el usuario describió. Una PUERTA no es un PORTÓN. Una REJA no es una BARANDA. No cambies el objeto del trabajo.
- DESGLOSÁ el trabajo en servicios individuales. Si el usuario menciona escuadrar + cambiar bisagras + ajustar cierre, son 3 servicios separados.
- Solo matcheá con el catálogo si el servicio coincide EXACTAMENTE con lo descrito. Si hay duda, marcalo como nuevo (es_nuevo=true).
- NO fuerces un match. Es preferible crear un servicio nuevo a asignar uno incorrecto.
- Si creás un servicio nuevo, revisá los códigos existentes y usá el siguiente número disponible en la serie que corresponda.
- Cada servicio nuevo DEBE tener un codigo_sugerido coherente (ej: HE-01, HE-02, etc.).
- Nomenclatura de códigos existente:
  * RP-PG-XX = Reparación portón general
  * RP-PL-XX = Reparación portón levadizo
  * RP-PC-XX = Reparación portón corredizo
  * RP-PCC-XX = Reparación portón curvo corredizo
  * RP-PA-XX = Reparación portón abatible
  * HE-XX = Herrería general (puertas, rejas, barandas, etc.)
  * FAB-XX = Fabricación a medida
  * TI = Traslado e instalación
  * MNT-XX = Mantenimiento
- Si el trabajo es sobre puertas, rejas, barandas u otro que NO sea portón, usá HE-XX o FAB-XX según corresponda.

INSTRUCCIONES:
1. Analizá la descripción del trabajo
2. Identificá cada servicio/producto individual que se menciona
3. Para cada uno, buscá si existe en el catálogo (por código o nombre EXACTO)
4. Si existe y coincide exactamente, usá el código y nombre del catálogo
5. Si NO existe o no coincide bien, marcalo como nuevo (es_nuevo=true) y sugerí código, nombre, categoría y descripción
6. Redactá la descripcion_venta de forma profesional: claro, técnico, un párrafo, sin saltos de línea

Respondé SOLO con un JSON object (no array), sin texto adicional ni markdown:
{
  "lineas": [
    {
      "codigo_catalogo": "RP-PG-01 o null si es nuevo",
      "nombre": "nombre del servicio",
      "descripcion_venta": "párrafo profesional describiendo el trabajo",
      "unidad": "unidad",
      "es_nuevo": false,
      "codigo_sugerido": "solo si es_nuevo=true",
      "categoria_sugerida": "solo si es_nuevo=true, id de categoría"
    }
  ],
  "sugerencias": [
    {
      "codigo_catalogo": "código del servicio del catálogo que PODRÍA haber matcheado",
      "nombre_catalogo": "nombre del servicio en el catálogo",
      "razon": "por qué podría coincidir pero no estás seguro (ej: 'Es similar pero el usuario dijo puerta, no portón')",
      "para_linea": 0
    }
  ]
}

El campo "sugerencias" son servicios del catálogo que se parecen a lo que el usuario describió pero NO coinciden exactamente. Siempre incluí al menos las 3 coincidencias más cercanas del catálogo para cada línea nueva. "para_linea" es el índice (0-based) de la línea a la que se refiere la sugerencia.`

    const promptPaquete = `Sos el Asistente Salix, un asistente de presupuestos integrado en Flux by Salix.
${promptPersonalizado ? `\nINSTRUCCIONES DE LA EMPRESA:\n${promptPersonalizado}\n` : ''}
CATÁLOGO DE SERVICIOS/PRODUCTOS DISPONIBLES:
${catalogoTexto}

CATEGORÍAS DISPONIBLES: ${categoriasTexto}

CÓDIGOS YA USADOS (no repetir): ${codigosExistentes}

DESCRIPCIÓN DEL TRABAJO:
"${descripcion}"

MODO PAQUETE: Creá UN SOLO servicio que englobe todo el trabajo descrito. NO desglosar en servicios separados.

INSTRUCCIONES:
1. Analizá la descripción completa del trabajo
2. Creá UN servicio nuevo con nombre descriptivo y específico (NO usar "Servicio" genérico)
3. El nombre debe describir el trabajo completo (ej: "Reubicación de motor corredizo de piso a riel superior")
4. Sugerí un código coherente con la nomenclatura existente y que NO se repita
5. Sugerí una categoría apropiada
6. Redactá la descripcion_venta como un párrafo profesional que detalle todo lo que incluye el trabajo
7. Buscá en el catálogo si ya existe un servicio similar — si existe, usalo en vez de crear uno nuevo

Respondé SOLO con un JSON object, sin texto adicional ni markdown:
{
  "lineas": [
    {
      "codigo_catalogo": "código si existe en catálogo, null si es nuevo",
      "nombre": "nombre descriptivo del paquete de trabajo",
      "descripcion_venta": "párrafo profesional describiendo TODO el trabajo incluido",
      "unidad": "unidad",
      "es_nuevo": true,
      "codigo_sugerido": "código sugerido coherente con la nomenclatura",
      "categoria_sugerida": "id de categoría"
    }
  ],
  "sugerencias": []
}`

    // Llamar a Claude
    const anthropic = new Anthropic({ apiKey })

    const respuesta = await anthropic.messages.create({
      model: modelo,
      max_tokens: 2000,
      messages: [{ role: 'user', content: esSimple ? promptSimple : esPaquete ? promptPaquete : promptDetallado }],
    })

    // Parsear respuesta
    const textoRespuesta = respuesta.content[0].type === 'text' ? respuesta.content[0].text : ''

    let lineasIA: Array<{
      codigo_catalogo: string | null
      nombre: string
      descripcion_venta: string
      unidad: string
      es_nuevo: boolean
      codigo_sugerido?: string
      categoria_sugerida?: string
    }>

    let sugerenciasIA: Array<{
      codigo_catalogo: string
      nombre_catalogo: string
      razon: string
      para_linea: number
    }> = []

    try {
      const jsonLimpio = textoRespuesta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonLimpio)

      // Soportar ambos formatos: array directo (backward compat) o {lineas, sugerencias}
      if (Array.isArray(parsed)) {
        lineasIA = parsed
      } else {
        lineasIA = parsed.lineas || []
        sugerenciasIA = parsed.sugerencias || []
      }
    } catch {
      return NextResponse.json({ error: 'Error al procesar respuesta de IA', raw: textoRespuesta }, { status: 500 })
    }

    // Para modo simple, matchear con el servicio genérico "Servicio" [S]
    if (esSimple) {
      // Buscar servicio genérico en catálogo
      const { data: servicioGenerico } = await admin
        .from('productos')
        .select('id, codigo, referencia_interna, nombre, unidad, impuesto_id')
        .eq('empresa_id', empresaId)
        .eq('referencia_interna', 'S')
        .eq('activo', true)
        .single()

      const lineasPropuestas: LineaPropuesta[] = lineasIA.map(linea => ({
        producto_id: servicioGenerico?.id || null,
        codigo: servicioGenerico?.codigo || 'SRV-0064',
        referencia_interna: 'S',
        nombre: servicioGenerico?.nombre || 'Servicio',
        descripcion_venta: linea.descripcion_venta || '',
        unidad: servicioGenerico?.unidad || 'unidad',
        impuesto_id: servicioGenerico?.impuesto_id || null,
        es_nuevo: false,
        categoria_sugerida: null,
      }))

      return NextResponse.json({
        lineas: lineasPropuestas,
        total: lineasPropuestas.length,
        existentes: lineasPropuestas.length,
        nuevos: 0,
      })
    }

    // Modo detallado: matchear con catálogo
    const lineasPropuestas: LineaPropuesta[] = lineasIA.map(linea => {
      if (!linea.es_nuevo && linea.codigo_catalogo) {
        const producto = (productos || []).find(p =>
          p.referencia_interna === linea.codigo_catalogo ||
          p.codigo === linea.codigo_catalogo
        )

        if (producto) {
          return {
            producto_id: producto.id,
            codigo: producto.codigo,
            referencia_interna: producto.referencia_interna,
            nombre: producto.nombre,
            descripcion_venta: linea.descripcion_venta || producto.descripcion_venta || '',
            unidad: producto.unidad || 'unidad',
            impuesto_id: producto.impuesto_id,
            es_nuevo: false,
            categoria_sugerida: null,
          }
        }
      }

      return {
        producto_id: null,
        codigo: linea.codigo_sugerido || '',
        referencia_interna: linea.codigo_sugerido || null,
        nombre: linea.nombre,
        descripcion_venta: linea.descripcion_venta || '',
        unidad: linea.unidad || 'unidad',
        impuesto_id: null,
        es_nuevo: true,
        categoria_sugerida: linea.categoria_sugerida || null,
      }
    })

    // Mapear sugerencias con datos del catálogo
    const sugerenciasMapeadas = sugerenciasIA.map(s => {
      const producto = (productos || []).find(p =>
        p.referencia_interna === s.codigo_catalogo || p.codigo === s.codigo_catalogo
      )
      return {
        producto_id: producto?.id || null,
        codigo: producto?.codigo || s.codigo_catalogo,
        referencia_interna: producto?.referencia_interna || s.codigo_catalogo,
        nombre: producto?.nombre || s.nombre_catalogo,
        descripcion_venta: producto?.descripcion_venta || '',
        unidad: producto?.unidad || 'unidad',
        impuesto_id: producto?.impuesto_id || null,
        razon: s.razon,
        para_linea: s.para_linea,
      }
    })

    return NextResponse.json({
      lineas: lineasPropuestas,
      sugerencias: sugerenciasMapeadas,
      total: lineasPropuestas.length,
      existentes: lineasPropuestas.filter(l => !l.es_nuevo).length,
      nuevos: lineasPropuestas.filter(l => l.es_nuevo).length,
    })
  } catch (err) {
    console.error('Error asistente Salix:', err)
    return NextResponse.json({ error: 'Error interno del asistente' }, { status: 500 })
  }
}
