import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

type DireccionFila = { id: string; texto: string | null; lat: number | null; lng: number | null }
type DireccionFilaPrincipal = DireccionFila & { es_principal: boolean }

/**
 * PUT /api/contactos/[id]/direcciones — Reemplaza las direcciones MANUALES de un contacto.
 *
 * IMPORTANTE: solo afecta filas con origen='manual'. Las direcciones con origen='sync_perfil'
 * (sincronizadas del perfil del miembro vinculado) NO se tocan — se administran desde
 * la sección Usuarios. Si el cliente manda items que coinciden por calle+ciudad con la
 * dirección sincronizada, se ignoran para evitar duplicados.
 *
 * PROPAGACIÓN A SNAPSHOTS:
 * Después del reemplazo, este endpoint propaga las nuevas direcciones a los snapshots
 * en presupuestos/órdenes/visitas que apuntaban al contacto, manteniendo viva la
 * dirección elegida cuando se puede matchear por texto. Solo se tocan registros NO
 * cerrados (presupuestos.cerrado=false, órdenes.publicada=false). Los presupuestos
 * afectados ven invalidado su pdf_url para que la próxima visita regenere.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('contactos', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    const { data: contacto } = await admin
      .from('contactos')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

    const { direcciones } = await request.json()

    // Snapshot de direcciones manuales ACTUALES (antes del reemplazo). Lo usamos
    // luego para matchear por texto y reasignar `direccion_id` en los snapshots
    // de presupuestos/órdenes/visitas — los IDs cambian porque hacemos DELETE+INSERT.
    const { data: direccionesAntesData } = await admin
      .from('contacto_direcciones')
      .select('id, texto, lat, lng')
      .eq('contacto_id', id)
    const direccionesAntes: DireccionFila[] = direccionesAntesData || []

    // Detectar si hay una dirección sincronizada del perfil para no duplicar
    const { data: filasSync } = await admin
      .from('contacto_direcciones')
      .select('calle, ciudad')
      .eq('contacto_id', id)
      .eq('origen', 'sync_perfil')
    const claveSync = new Set((filasSync || []).map(d => `${(d.calle || '').toLowerCase()}|${(d.ciudad || '').toLowerCase()}`))

    // Borrar solo las manuales (FK ON DELETE SET NULL deja direccion_id null
    // en presupuestos/órdenes/visitas — lo re-vinculamos abajo).
    await admin
      .from('contacto_direcciones')
      .delete()
      .eq('contacto_id', id)
      .eq('origen', 'manual')

    if (direcciones?.length) {
      const filas = (direcciones as Record<string, unknown>[])
        // Filtrar items que coincidan por calle+ciudad con una dirección sincronizada
        .filter(d => {
          const clave = `${String(d.calle || '').toLowerCase()}|${String(d.ciudad || '').toLowerCase()}`
          return !claveSync.has(clave)
        })
        .map((d, i) => ({
          contacto_id: id,
          tipo: d.tipo || 'principal',
          calle: d.calle || null,
          barrio: d.barrio || null,
          ciudad: d.ciudad || null,
          provincia: d.provincia || null,
          codigo_postal: d.codigo_postal || null,
          pais: d.pais || null,
          piso: d.piso || null,
          departamento: d.departamento || null,
          lat: d.lat || null,
          lng: d.lng || null,
          texto: d.texto || null,
          // La primera dirección manual se marca como principal solo si NO hay sync.
          es_principal: i === 0 && (filasSync || []).length === 0,
          origen: 'manual',
        }))

      if (filas.length > 0) {
        await admin.from('contacto_direcciones').insert(filas)
      }
    }

    // Re-leer direcciones DESPUÉS del reemplazo (con sus IDs nuevos).
    const { data: direccionesDespuesData } = await admin
      .from('contacto_direcciones')
      .select('id, texto, lat, lng, es_principal')
      .eq('contacto_id', id)
    const direccionesDespues: DireccionFilaPrincipal[] = direccionesDespuesData || []

    // Propagar a snapshots — fire-and-forget para no bloquear la respuesta.
    propagarCambioDirecciones(admin, empresaId, id, direccionesAntes, direccionesDespues)
      .catch(err => console.error('Error al propagar direcciones a snapshots:', err))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * Propaga los cambios de direcciones a presupuestos/órdenes/visitas NO cerrados.
 *
 * Algoritmo:
 *   1. Construye mapping (oldId → newId) por match exacto de texto entre la lista
 *      anterior y la nueva. Las direcciones cuyo texto no cambió se re-vinculan.
 *   2. Para cada presupuesto/orden/visita NO cerrado del contacto:
 *      - Si tiene direccion_id viejo y matchea → asigna el nuevo direccion_id +
 *        actualiza el snapshot de texto.
 *      - Si tiene direccion_id viejo pero no matchea (la dirección desapareció)
 *        → fallback a la nueva principal (mantiene una dirección coherente).
 *      - Si tiene direccion_id NULL pero el snapshot de texto coincide con alguna
 *        dirección anterior (caso legacy/backfill) → enlazar al nuevo id si existe.
 *      - Si direccion_id NULL y sin coincidencia → si existe principal, asignarla
 *        (caso legacy sin elección explícita). Sino dejar como está.
 *   3. Invalida pdf_url y pdf_generado_en en cualquier presupuesto que haya
 *      cambiado de snapshot, para forzar regeneración del PDF al próximo acceso.
 *
 * Solo se tocan filas con cerrado=false (presupuestos) o publicada=false (órdenes).
 * Lo emitido / aceptado / publicado se respeta tal como estaba.
 */
type DestinoResuelto = {
  direccion_id: string | null
  contacto_direccion: string | null
  lat: number | null
  lng: number | null
}

async function propagarCambioDirecciones(
  admin: ReturnType<typeof crearClienteAdmin>,
  empresaId: string,
  contactoId: string,
  antes: DireccionFila[],
  despues: DireccionFilaPrincipal[]
) {
  // Mapeo por texto exacto (case-sensitive — los textos los formatea el frontend
  // de manera consistente). Si una dirección desaparece, su id no aparece en el
  // map — es la señal para hacer fallback a principal.
  const mapOldANew = new Map<string, { id: string; texto: string | null; lat: number | null; lng: number | null }>()
  for (const old of antes) {
    if (!old.texto) continue
    const match = despues.find(d => d.texto === old.texto)
    if (match) mapOldANew.set(old.id, { id: match.id, texto: match.texto, lat: match.lat, lng: match.lng })
  }

  const principal = despues.find(d => d.es_principal) || despues[0] || null
  const fallback = principal
    ? { id: principal.id, texto: principal.texto, lat: principal.lat, lng: principal.lng }
    : null

  // Helper: dado el direccion_id y contacto_direccion actuales, decide cuáles
  // serían los nuevos. Devuelve null si no hay cambio (no actualizar).
  function resolverNuevo(
    direccionIdActual: string | null,
    snapshotActual: string | null
  ): DestinoResuelto | null {
    // Caso 1: tiene direccion_id viejo
    if (direccionIdActual) {
      const mapeado = mapOldANew.get(direccionIdActual)
      if (mapeado) {
        // Reasignar al nuevo id; el texto ya coincidía pero lo refrescamos por
        // si en el futuro se permite editar (hoy es DELETE+INSERT pero queda robusto).
        // También refrescamos coords por si fueron geocodificadas/corregidas.
        if (mapeado.id !== direccionIdActual || mapeado.texto !== snapshotActual) {
          return { direccion_id: mapeado.id, contacto_direccion: mapeado.texto, lat: mapeado.lat, lng: mapeado.lng }
        }
        return null
      }
      // No matcheó → la dirección elegida desapareció. Fallback a principal.
      if (fallback) {
        return { direccion_id: fallback.id, contacto_direccion: fallback.texto, lat: fallback.lat, lng: fallback.lng }
      }
      // No hay direcciones nuevas — limpiar.
      return { direccion_id: null, contacto_direccion: null, lat: null, lng: null }
    }
    // Caso 2: direccion_id NULL pero snapshot coincide con una dirección anterior
    // (presupuesto pre-migración que tenía solo el texto, sin id). Re-vincular.
    if (snapshotActual) {
      const matchAntes = antes.find(o => o.texto === snapshotActual)
      if (matchAntes) {
        const mapeado = mapOldANew.get(matchAntes.id)
        if (mapeado) {
          return { direccion_id: mapeado.id, contacto_direccion: mapeado.texto, lat: mapeado.lat, lng: mapeado.lng }
        }
        // El snapshot coincidía con una dirección que desapareció → fallback.
        if (fallback) {
          return { direccion_id: fallback.id, contacto_direccion: fallback.texto, lat: fallback.lat, lng: fallback.lng }
        }
      }
      // Sin match en antes ni mapeo posible — preservar el snapshot histórico.
      return null
    }
    // Caso 3: ambos null. Asignar principal nueva si existe.
    if (fallback) {
      return { direccion_id: fallback.id, contacto_direccion: fallback.texto, lat: fallback.lat, lng: fallback.lng }
    }
    return null
  }

  // Aplicamos las tres entidades en paralelo.
  await Promise.all([
    aplicarPropagacion(admin, 'presupuestos', empresaId, contactoId, resolverNuevo, true),
    aplicarPropagacion(admin, 'ordenes_trabajo', empresaId, contactoId, resolverNuevo, false),
    aplicarPropagacion(admin, 'visitas', empresaId, contactoId, resolverNuevo, false, true),
  ])
}

/**
 * Aplica la propagación a una tabla concreta. Lee las filas candidatas, pasa cada
 * una por `resolver` y actualiza solo las que cambian. Hecho fila-por-fila porque
 * cada una puede recibir un destino diferente (mapeado vs fallback).
 *
 * - presupuestos: filtra cerrado=false; al actualizar, invalida pdf_url y
 *   pdf_generado_en para forzar regeneración. NO tiene snapshot de coords.
 * - ordenes_trabajo: filtra publicada=false. Snapshot de coords en
 *   `contacto_direccion_lat/lng` para que el botón Navegar use lat/lng exactos.
 * - visitas: usa el campo `direccion_texto` (no `contacto_direccion`), y
 *   `direccion_lat/lng` para coords. Sin estado de bloqueo.
 */
async function aplicarPropagacion(
  admin: ReturnType<typeof crearClienteAdmin>,
  tabla: 'presupuestos' | 'ordenes_trabajo' | 'visitas',
  empresaId: string,
  contactoId: string,
  resolver: (
    dirId: string | null,
    snapshot: string | null
  ) => DestinoResuelto | null,
  invalidarPdf: boolean,
  usaDireccionTexto = false
) {
  const campoSnapshot = usaDireccionTexto ? 'direccion_texto' : 'contacto_direccion'
  // Mapping de columnas de coords por tabla. Presupuestos no tiene coords.
  const colsCoords: { lat: string; lng: string } | null = tabla === 'ordenes_trabajo'
    ? { lat: 'contacto_direccion_lat', lng: 'contacto_direccion_lng' }
    : tabla === 'visitas'
      ? { lat: 'direccion_lat', lng: 'direccion_lng' }
      : null

  let query = admin
    .from(tabla)
    .select(`id, direccion_id, ${campoSnapshot}`)
    .eq('empresa_id', empresaId)
    .eq('contacto_id', contactoId)

  if (tabla === 'presupuestos') query = query.eq('cerrado', false)
  if (tabla === 'ordenes_trabajo') query = query.eq('publicada', false)

  const { data: filas } = await query
  if (!filas || filas.length === 0) return

  const updates: PromiseLike<unknown>[] = []
  for (const fila of filas) {
    const f = fila as { id: string; direccion_id: string | null; [k: string]: unknown }
    const snapshotActual = (f[campoSnapshot] as string | null) ?? null
    const nuevo = resolver(f.direccion_id, snapshotActual)
    if (!nuevo) continue

    const update: Record<string, unknown> = {
      direccion_id: nuevo.direccion_id,
      [campoSnapshot]: nuevo.contacto_direccion,
    }
    if (colsCoords) {
      update[colsCoords.lat] = nuevo.lat
      update[colsCoords.lng] = nuevo.lng
    }
    if (invalidarPdf) {
      update.pdf_url = null
      update.pdf_miniatura_url = null
      update.pdf_storage_path = null
      update.pdf_generado_en = null
    }
    updates.push(admin.from(tabla).update(update).eq('id', f.id))
  }

  if (updates.length > 0) await Promise.all(updates)
}
