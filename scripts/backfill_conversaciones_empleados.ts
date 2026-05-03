/**
 * Backfill: migra `conversaciones_salix_ia` (canal='whatsapp') a la tabla
 * principal `conversaciones` + `mensajes`, vinculadas al miembro vía `miembro_id`.
 *
 * Cómo funciona:
 *  1. Lista todas las conversaciones de Salix IA en WhatsApp (agrupadas por usuario).
 *  2. Para cada usuario, resuelve `miembro_id` y crea UNA conversación perpetua
 *     en `conversaciones` (idempotente: si ya existe, no la duplica).
 *  3. Convierte cada mensaje del array JSONB a una fila en `mensajes`,
 *     ordenado cronológicamente.
 *  4. Refresca el cache de la conversación (último mensaje, tiene_mensaje_entrante).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/backfill_conversaciones_empleados.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/backfill_conversaciones_empleados.ts --apply    # aplica cambios
 *
 * Variables de entorno requeridas:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const APLICAR = process.argv.includes('--apply')

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !SERVICE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// Estructura de un mensaje en `conversaciones_salix_ia.mensajes` (JSONB array).
interface MensajeJSONB {
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string | Array<{ type: string; text?: string; [k: string]: unknown }>
  timestamp?: string
}

interface ConvSalixIA {
  id: string
  empresa_id: string
  usuario_id: string
  canal: string
  titulo: string
  mensajes: MensajeJSONB[] | null
  creado_en: string
  actualizado_en: string
}

interface MiembroLite {
  id: string
  telefono: string | null
  telefono_empresa: string | null
  canal_notif_telefono: string
}

// Extrae el texto plano de un campo `content` (puede ser string o array de bloques).
// Solo conserva bloques de tipo 'text' — los tool_use/tool_result se descartan
// porque no son contenido visible para el empleado.
function extraerTexto(content: MensajeJSONB['content']): string {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n')
      .trim()
  }
  return ''
}

async function backfillEmpresa(empresa_id: string) {
  // 1. Listar conversaciones Salix IA de WhatsApp ordenadas por fecha.
  const { data: convsIA, error } = await supabase
    .from('conversaciones_salix_ia')
    .select('id, empresa_id, usuario_id, canal, titulo, mensajes, creado_en, actualizado_en')
    .eq('empresa_id', empresa_id)
    .eq('canal', 'whatsapp')
    .order('creado_en', { ascending: true })
    .returns<ConvSalixIA[]>()

  if (error) {
    console.error(`  Error listando: ${error.message}`)
    return
  }
  if (!convsIA?.length) {
    console.log('  Sin conversaciones de Salix IA en WhatsApp')
    return
  }

  // 2. Agrupar por usuario_id.
  const porUsuario = new Map<string, ConvSalixIA[]>()
  for (const c of convsIA) {
    const arr = porUsuario.get(c.usuario_id) || []
    arr.push(c)
    porUsuario.set(c.usuario_id, arr)
  }

  // 3. Procesar cada usuario.
  for (const [usuario_id, convs] of porUsuario) {
    const totalMensajes = convs.reduce(
      (acc, c) => acc + (c.mensajes?.length || 0),
      0
    )
    console.log(`\n  Usuario ${usuario_id}: ${convs.length} conv(s), ${totalMensajes} mensaje(s) en JSONB`)

    // Resolver miembro
    const { data: miembro } = await supabase
      .from('miembros')
      .select('id, telefono, telefono_empresa, canal_notif_telefono')
      .eq('empresa_id', empresa_id)
      .eq('usuario_id', usuario_id)
      .maybeSingle<MiembroLite>()

    if (!miembro) {
      console.log(`    Sin miembro asociado, skip`)
      continue
    }

    // Buscar conversación de empleado existente (idempotencia)
    const { data: convExistente } = await supabase
      .from('conversaciones')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('miembro_id', miembro.id)
      .eq('tipo_canal', 'whatsapp')
      .maybeSingle()

    if (convExistente) {
      console.log(`    Conversación de empleado ya existe (${convExistente.id}), skip`)
      continue
    }

    const telefono =
      miembro.canal_notif_telefono === 'personal'
        ? miembro.telefono
        : miembro.telefono_empresa || miembro.telefono

    // Convertir todos los mensajes de todas las conversaciones a filas
    const filas: Array<Record<string, unknown>> = []
    for (const conv of convs) {
      const mensajes = conv.mensajes || []
      for (const m of mensajes) {
        if (m.role !== 'user' && m.role !== 'assistant') continue
        const texto = extraerTexto(m.content)
        if (!texto) continue
        const esEntrante = m.role === 'user'
        filas.push({
          empresa_id,
          es_entrante: esEntrante,
          remitente_tipo: esEntrante ? 'contacto' : 'ia',
          tipo_contenido: 'texto',
          texto,
          estado: 'enviado',
          creado_en: m.timestamp || conv.creado_en,
        })
      }
    }

    if (!filas.length) {
      console.log(`    Sin mensajes válidos en JSONB, skip`)
      continue
    }

    // Cache del último mensaje
    const ultimoTexto = filas[filas.length - 1]!.texto as string
    const ultimoEs = filas[filas.length - 1]!.es_entrante as boolean
    const ultimoEn = filas[filas.length - 1]!.creado_en as string
    const algunoEntrante = filas.some((f) => f.es_entrante === true)

    if (!APLICAR) {
      console.log(`    [DRY] Crearía conversación + ${filas.length} mensajes (último: "${ultimoTexto.slice(0, 60)}")`)
      continue
    }

    // Crear conversación
    const { data: nueva, error: errConv } = await supabase
      .from('conversaciones')
      .insert({
        empresa_id,
        tipo_canal: 'whatsapp',
        miembro_id: miembro.id,
        identificador_externo: telefono,
        contacto_nombre: null,
        estado: 'abierta',
        ultimo_mensaje_texto: ultimoTexto.slice(0, 500),
        ultimo_mensaje_en: ultimoEn,
        ultimo_mensaje_es_entrante: ultimoEs,
        tiene_mensaje_entrante: algunoEntrante,
      })
      .select('id')
      .single()

    if (errConv || !nueva) {
      console.error(`    Error creando conversación: ${errConv?.message}`)
      continue
    }

    // Insertar mensajes con la conversación recién creada
    const filasConId = filas.map((f) => ({ ...f, conversacion_id: nueva.id }))
    const { error: errMsgs } = await supabase.from('mensajes').insert(filasConId)
    if (errMsgs) {
      console.error(`    Error insertando mensajes: ${errMsgs.message}`)
      continue
    }

    console.log(`    OK: conv ${nueva.id} con ${filas.length} mensaje(s)`)
  }
}

async function main() {
  console.log(APLICAR ? '\nMODO APLICAR\n' : '\nMODO DRY-RUN (usar --apply para escribir)\n')

  // Empresas con datos a migrar
  const { data: empresas } = await supabase
    .from('conversaciones_salix_ia')
    .select('empresa_id')
    .eq('canal', 'whatsapp')

  const ids = [...new Set(empresas?.map((e) => e.empresa_id as string) || [])]

  if (!ids.length) {
    console.log('No hay datos de Salix IA en WhatsApp para migrar.')
    return
  }

  for (const empresa_id of ids) {
    console.log(`\nEmpresa ${empresa_id}`)
    await backfillEmpresa(empresa_id)
  }

  console.log('\nFin.\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
