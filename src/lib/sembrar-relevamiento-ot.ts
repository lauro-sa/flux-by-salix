/**
 * Al generar una OT desde un presupuesto con `visita_id`, copia el
 * relevamiento técnico (fotos + notas) de la visita al chatter de la OT
 * como entradas con `metadata.subtipo='relevamiento'`.
 *
 * El relevamiento de la visita son entradas del chatter de la visita con
 *   - `tipo='visita'` (entrada principal: "Visita completada" con fotos + notas
 *     técnicas + metadata rica de la visita)
 *   - `tipo='nota_interna'` (notas manuales del visitador con fotos)
 *
 * Las entradas de tipo `'sistema'` y `'whatsapp'` NO se copian (eventos
 * automáticos y chat con cliente, no son relevamiento).
 *
 * Idempotencia: cada entrada copiada guarda `metadata.origen_chatter_id`
 * con el id de la entrada original. Si el helper se reejecuta sobre la
 * misma OT, las entradas ya sembradas se omiten — patrón "skip si ya existe"
 * usando el campo previsto en `tipos/chatter.ts:87`.
 *
 * Best-effort: el caller `/api/ordenes/generar/route.ts` envuelve esta
 * llamada en try-catch porque el relevamiento es nice-to-have; si falla,
 * la OT se crea igual y el admin puede re-sembrar manualmente.
 */

import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { AdjuntoChatter, MetadataChatter, TipoChatter } from '@/tipos/chatter'

interface ArgsSembrarRelevamientoOT {
  empresaId: string
  visitaId: string
  ordenTrabajoId: string
}

interface ResultadoSembrarRelevamientoOT {
  agregados: number
}

interface EntradaVisitaChatter {
  id: string
  tipo: TipoChatter
  contenido: string
  autor_id: string | null
  autor_nombre: string
  autor_avatar_url: string | null
  adjuntos: AdjuntoChatter[] | null
  metadata: MetadataChatter | null
  creado_en: string
}

interface EntradaOTConOrigen {
  metadata: MetadataChatter | null
}

const TIPOS_RELEVAMIENTO: ReadonlySet<TipoChatter> = new Set<TipoChatter>([
  'visita',
  'nota_interna',
])

export async function sembrarRelevamientoOT(
  args: ArgsSembrarRelevamientoOT,
): Promise<ResultadoSembrarRelevamientoOT> {
  const { empresaId, visitaId, ordenTrabajoId } = args
  const admin = crearClienteAdmin()

  // 1. Leer chatter de la visita: solo entradas con material de relevamiento.
  const { data: entradasVisita, error: errorVisita } = await admin
    .from('chatter')
    .select('id, tipo, contenido, autor_id, autor_nombre, autor_avatar_url, adjuntos, metadata, creado_en')
    .eq('empresa_id', empresaId)
    .eq('entidad_tipo', 'visita')
    .eq('entidad_id', visitaId)
    .in('tipo', Array.from(TIPOS_RELEVAMIENTO))
    .order('creado_en', { ascending: true })

  if (errorVisita) {
    console.error('[sembrarRelevamientoOT] Error al leer chatter de visita:', errorVisita)
    throw new Error(`No se pudo leer el chatter de la visita: ${errorVisita.message}`)
  }

  const entradasVisitaNorm = (entradasVisita ?? []) as EntradaVisitaChatter[]
  if (entradasVisitaNorm.length === 0) {
    return { agregados: 0 }
  }

  // 2. Leer entradas ya sembradas en la OT para detectar duplicados por origen.
  //    Filtramos en cliente sobre metadata.subtipo + metadata.origen_chatter_id,
  //    porque la columna es jsonb y no tiene índice expresion.
  const { data: entradasOT, error: errorOT } = await admin
    .from('chatter')
    .select('metadata')
    .eq('empresa_id', empresaId)
    .eq('entidad_tipo', 'orden_trabajo')
    .eq('entidad_id', ordenTrabajoId)

  if (errorOT) {
    console.error('[sembrarRelevamientoOT] Error al leer chatter de OT:', errorOT)
    throw new Error(`No se pudo leer el chatter de la OT: ${errorOT.message}`)
  }

  const yaSembrados = new Set<string>()
  for (const entrada of ((entradasOT ?? []) as EntradaOTConOrigen[])) {
    if (entrada.metadata?.subtipo === 'relevamiento' && entrada.metadata.origen_chatter_id) {
      yaSembrados.add(entrada.metadata.origen_chatter_id)
    }
  }

  // 3. Construir las nuevas entradas, omitiendo las ya sembradas y las que
  //    no aportan material (sin contenido ni adjuntos).
  const filasNuevas: Array<Record<string, unknown>> = []
  for (const entrada of entradasVisitaNorm) {
    if (yaSembrados.has(entrada.id)) continue

    const adjuntos = Array.isArray(entrada.adjuntos) ? entrada.adjuntos : []
    const contenido = (entrada.contenido ?? '').trim()
    if (adjuntos.length === 0 && contenido.length === 0) {
      // Entrada de sistema sin material visual ni texto → no es relevamiento.
      continue
    }

    // Preservamos el contenido tal cual, salvo la entrada principal "Visita
    // completada" donde el texto útil para el técnico vive en
    // `metadata.visita_notas` (las notas que dejó el visitador). Si está vacío,
    // se cae al `contenido` original.
    const notasVisita = (entrada.metadata?.visita_notas ?? '').trim()
    const contenidoFinal = entrada.tipo === 'visita' && notasVisita.length > 0
      ? notasVisita
      : contenido

    if (adjuntos.length === 0 && contenidoFinal.length === 0) {
      continue
    }

    const metadataNueva: MetadataChatter = {
      subtipo: 'relevamiento',
      origen_chatter_id: entrada.id,
      accion: 'relevamiento_sembrado',
      visita_id: visitaId,
    }

    filasNuevas.push({
      empresa_id: empresaId,
      entidad_tipo: 'orden_trabajo',
      entidad_id: ordenTrabajoId,
      tipo: 'nota_interna' satisfies TipoChatter,
      contenido: contenidoFinal,
      autor_id: entrada.autor_id,
      autor_nombre: entrada.autor_nombre,
      autor_avatar_url: entrada.autor_avatar_url,
      adjuntos,
      metadata: metadataNueva,
    })
  }

  if (filasNuevas.length === 0) {
    return { agregados: 0 }
  }

  const { error: errorInsert } = await admin.from('chatter').insert(filasNuevas)
  if (errorInsert) {
    console.error('[sembrarRelevamientoOT] Error al insertar entradas en OT:', errorInsert)
    throw new Error(`No se pudieron sembrar las entradas de relevamiento: ${errorInsert.message}`)
  }

  return { agregados: filasNuevas.length }
}
