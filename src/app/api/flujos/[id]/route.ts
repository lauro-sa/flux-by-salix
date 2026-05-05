/**
 * API REST de Flujos — detalle, edición, eliminación (PR 18.1).
 *
 *   GET    /api/flujos/[id]   — devuelve la fila + flags `permisos`
 *                                granulares para que la UI muestre
 *                                botones de editar / eliminar /
 *                                activar según corresponda.
 *
 *   PUT    /api/flujos/[id]   — patch parcial. Implementa el modelo
 *                                "borrador interno" decidido en §5.3
 *                                de docs/PLAN_UI_FLUJOS.md:
 *
 *     • flujo en 'borrador' → escribe in-place sobre las columnas
 *       publicadas (todavía no se publicó nada, no hay qué proteger).
 *
 *     • flujo en 'activo' o 'pausado' → los campos del modelo lógico
 *       (disparador / condiciones / acciones / nodos_json) se
 *       desvían a `borrador_jsonb`, que se mergea sobre la versión
 *       publicada para tener una versión COMPLETA lista para
 *       publicar. nombre y descripcion son metadata y se editan
 *       in-place siempre.
 *
 *   DELETE /api/flujos/[id]  — cancela ejecuciones activas primero,
 *                                deja un row en `auditoria_flujos`
 *                                con `campo_modificado='eliminacion'`,
 *                                después borra. La FK ON DELETE
 *                                CASCADE de sql/054 limpia
 *                                ejecuciones_flujo y acciones_pendientes.
 *                                La FK ON DELETE SET NULL de sql/057
 *                                preserva el log de auditoría
 *                                post-delete (decisión explícita del
 *                                usuario al revisar el plan).
 *
 * Patrón de auth: requerirPermisoAPI('flujos', '<accion>') del
 * resto de Flux. RLS sobre `flujos` y `auditoria_flujos` es la red
 * adicional, pero filtramos manualmente por empresa_id en cada query
 * para fail-fast y query plans simples.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  obtenerYVerificarPermiso,
  requerirPermisoAPI,
  verificarVisibilidad,
} from '@/lib/permisos-servidor'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { esBodyActualizarFlujo } from '@/tipos/workflow'

type ParamsPromise = Promise<{ id: string }>

const CAMPOS_JSONB = ['disparador', 'condiciones', 'acciones', 'nodos_json'] as const
type CampoJsonb = (typeof CAMPOS_JSONB)[number]

// =============================================================
// GET /api/flujos/[id]
// =============================================================

export async function GET(_request: NextRequest, { params }: { params: ParamsPromise }) {
  const { id } = await params

  const { user } = await obtenerUsuarioRuta()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) {
    return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
  }

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'flujos')
  if (!visibilidad) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = crearClienteAdmin()
  const { data: flujo } = await admin
    .from('flujos')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!flujo) {
    // 404 también si el usuario tiene 'ver_propio' y no es creador.
    // No filtramos existencia con 403 (memoria del patrón de
    // permisos-servidor.ts).
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }
  if (visibilidad.soloPropio && flujo.creado_por !== user.id) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }

  // Flags granulares para la UI.
  const [
    { permitido: puedeEditar },
    { permitido: puedeEliminar },
    { permitido: puedeActivar },
  ] = await Promise.all([
    obtenerYVerificarPermiso(user.id, empresaId, 'flujos', 'editar'),
    obtenerYVerificarPermiso(user.id, empresaId, 'flujos', 'eliminar'),
    obtenerYVerificarPermiso(user.id, empresaId, 'flujos', 'activar'),
  ])

  return NextResponse.json({
    flujo: {
      ...flujo,
      permisos: {
        editar: puedeEditar,
        eliminar: puedeEliminar,
        activar: puedeActivar,
      },
    },
  })
}

// =============================================================
// PUT /api/flujos/[id]
// =============================================================

export async function PUT(request: NextRequest, { params }: { params: ParamsPromise }) {
  const { id } = await params

  const guard = await requerirPermisoAPI('flujos', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (!esBodyActualizarFlujo(body)) {
    return NextResponse.json(
      {
        error:
          'Body inválido. Recordá que estado se cambia con /activar y /pausar, ' +
          'y que `borrador_jsonb` y `activo` son internos: no se setean directo.',
      },
      { status: 400 },
    )
  }

  const admin = crearClienteAdmin()
  const { data: original } = await admin
    .from('flujos')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!original) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }

  // Editor para denormalizar.
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', user.id)
    .maybeSingle()
  const editadoPorNombre = perfil
    ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() || null
    : null

  // Construcción del UPDATE + lista de auditorías a registrar.
  const updateFields: Record<string, unknown> = {
    editado_por: user.id,
    editado_por_nombre: editadoPorNombre,
  }
  const auditorias: Array<{
    campo_modificado: string
    valor_anterior: string | null
    valor_nuevo: string | null
  }> = []

  // ── nombre y descripcion: in-place siempre (metadata) ─────────
  if ('nombre' in body && body.nombre !== undefined) {
    const nuevo = body.nombre.trim()
    if (nuevo !== original.nombre) {
      updateFields.nombre = nuevo
      auditorias.push({
        campo_modificado: 'nombre',
        valor_anterior: original.nombre,
        valor_nuevo: nuevo,
      })
    }
  }
  if ('descripcion' in body) {
    const nuevo = body.descripcion === null
      ? null
      : (body.descripcion?.trim() || null)
    if (nuevo !== original.descripcion) {
      updateFields.descripcion = nuevo
      auditorias.push({
        campo_modificado: 'descripcion',
        valor_anterior: original.descripcion,
        valor_nuevo: nuevo,
      })
    }
  }

  // ── icono y color: metadata visual, in-place siempre (no entra al
  // modelo borrador interno aunque el flujo esté activo, porque no
  // afecta la ejecución del motor — es solo cómo se ve en el listado
  // y en el header del editor). Auditoría individual por campo.
  //
  // Consecuencia esperada del tratamiento in-place: "Descartar cambios"
  // (POST /descartar-borrador) NO revierte icono/color, porque nunca
  // pasaron por el borrador. Es decisión consciente, no un bug —
  // tratarlos como contenido editable obligaría a versionar metadata
  // visual y agregaría complejidad sin valor. Si el usuario quiere
  // revertir el ícono, lo cambia manualmente como cualquier otra
  // metadata (mismo modelo que nombre y descripción).
  if ('icono' in body && body.icono !== undefined) {
    const nuevo = body.icono === null ? null : body.icono.trim()
    if (nuevo !== original.icono) {
      updateFields.icono = nuevo
      auditorias.push({
        campo_modificado: 'icono',
        valor_anterior: original.icono,
        valor_nuevo: nuevo,
      })
    }
  }
  if ('color' in body && body.color !== undefined) {
    const nuevo = body.color === null ? null : body.color.trim()
    if (nuevo !== original.color) {
      updateFields.color = nuevo
      auditorias.push({
        campo_modificado: 'color',
        valor_anterior: original.color,
        valor_nuevo: nuevo,
      })
    }
  }

  // ── disparador / condiciones / acciones / nodos_json ──────────
  // Detectar cuáles vienen en el body y cuáles realmente cambian.
  const camposJsonbConCambios: CampoJsonb[] = []
  for (const campo of CAMPOS_JSONB) {
    if (!(campo in body)) continue
    const previo = original[campo]
    const nuevo = (body as Record<string, unknown>)[campo]
    if (JSON.stringify(previo) !== JSON.stringify(nuevo)) {
      camposJsonbConCambios.push(campo)
    }
  }

  if (camposJsonbConCambios.length > 0) {
    if (original.estado === 'borrador') {
      // Edición in-place. Un row de auditoría por campo.
      for (const campo of camposJsonbConCambios) {
        const nuevo = (body as Record<string, unknown>)[campo]
        updateFields[campo] = nuevo
        auditorias.push({
          campo_modificado: campo,
          valor_anterior: JSON.stringify(original[campo]),
          valor_nuevo: JSON.stringify(nuevo),
        })
      }
    } else {
      // Modelo borrador interno: escribir a borrador_jsonb mergeando
      // sobre la versión publicada. Si ya había borrador en curso, se
      // toma como base (el usuario está iterando sobre el mismo).
      // Si no, se inicializa con la versión publicada para que el
      // borrador siempre tenga forma completa lista para publicar.
      const baseBorrador =
        original.borrador_jsonb &&
        typeof original.borrador_jsonb === 'object' &&
        !Array.isArray(original.borrador_jsonb)
          ? (original.borrador_jsonb as Record<string, unknown>)
          : {
              disparador: original.disparador,
              condiciones: original.condiciones,
              acciones: original.acciones,
              nodos_json: original.nodos_json,
            }
      const nuevoBorrador: Record<string, unknown> = { ...baseBorrador }
      for (const campo of camposJsonbConCambios) {
        nuevoBorrador[campo] = (body as Record<string, unknown>)[campo]
      }
      updateFields.borrador_jsonb = nuevoBorrador

      // Auditoría: una row por campo modificado dentro del borrador.
      for (const campo of camposJsonbConCambios) {
        auditorias.push({
          campo_modificado: `borrador_jsonb.${campo}`,
          valor_anterior: JSON.stringify(baseBorrador[campo] ?? null),
          valor_nuevo: JSON.stringify((body as Record<string, unknown>)[campo]),
        })
      }
    }
  }

  // Si no hay nada que actualizar fuera de editado_por, no hay cambios
  // reales. Devolvemos la fila tal cual sin tocar nada (idempotente).
  const huboCambioReal = auditorias.length > 0
  if (!huboCambioReal) {
    return NextResponse.json({ flujo: original })
  }

  const { data: actualizado, error: errUpd } = await admin
    .from('flujos')
    .update(updateFields)
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .select()
    .single()

  if (errUpd) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_actualizar_flujo',
      flujo_id: id,
      detalle: errUpd.message,
    }))
    return NextResponse.json({ error: 'Error al actualizar flujo' }, { status: 500 })
  }

  // Auditoría: insertamos todos los rows de una. Si falla, lo
  // logueamos pero no rollbackeamos el UPDATE (el cambio en el
  // flujo es la operación principal; perder un row de log es
  // recuperable, perder una edición no).
  if (auditorias.length > 0) {
    const filas = auditorias.map((a) => ({
      empresa_id: empresaId,
      flujo_id: id,
      editado_por: user.id,
      campo_modificado: a.campo_modificado,
      valor_anterior: a.valor_anterior,
      valor_nuevo: a.valor_nuevo,
    }))
    const { error: errAud } = await admin.from('auditoria_flujos').insert(filas)
    if (errAud) {
      console.error(JSON.stringify({
        nivel: 'warn',
        mensaje: 'error_auditoria_flujo',
        flujo_id: id,
        detalle: errAud.message,
      }))
    }
  }

  return NextResponse.json({ flujo: actualizado })
}

// =============================================================
// DELETE /api/flujos/[id]
// =============================================================

export async function DELETE(_request: NextRequest, { params }: { params: ParamsPromise }) {
  const { id } = await params

  const guard = await requerirPermisoAPI('flujos', 'eliminar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  const admin = crearClienteAdmin()
  const { data: flujo } = await admin
    .from('flujos')
    .select('id, nombre')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!flujo) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }

  // 1) Cancelar ejecuciones activas. Antes que la cascade las borre,
  //    queremos dejarlas marcadas 'cancelado' y cancelar también las
  //    acciones_pendientes asociadas, así un worker en pleno vuelo
  //    que lea el row y vea 'cancelado' aborte limpio en lugar de
  //    encontrarse con un flujo inexistente. Idempotente: si no hay
  //    activas, la query no afecta nada.
  const { data: ejecucionesCanceladas } = await admin
    .from('ejecuciones_flujo')
    .update({ estado: 'cancelado', fin_en: new Date().toISOString() })
    .eq('flujo_id', id)
    .in('estado', ['pendiente', 'esperando', 'corriendo'])
    .select('id')

  if (ejecucionesCanceladas && ejecucionesCanceladas.length > 0) {
    const ids = ejecucionesCanceladas.map((e) => e.id as string)
    await admin
      .from('acciones_pendientes')
      .update({ estado: 'cancelada' })
      .in('ejecucion_id', ids)
      .eq('estado', 'pendiente')
  }

  // 2) Auditoría: dejamos el row antes del DELETE así flujo_id queda
  //    seteado. La cascade de empresas no aplica acá; el ON DELETE
  //    SET NULL de auditoria_flujos.flujo_id (sql/057) deja la fila
  //    vivir post-delete con flujo_id=NULL — eso es la trazabilidad
  //    que pidió el usuario.
  await admin.from('auditoria_flujos').insert({
    empresa_id: empresaId,
    flujo_id: id,
    editado_por: user.id,
    campo_modificado: 'eliminacion',
    valor_anterior: flujo.nombre,
    valor_nuevo: null,
  })

  // 3) DELETE. Cascade borra ejecuciones_flujo y acciones_pendientes
  //    (cuyo cancelado ya quedó registrado en BD por un instante).
  const { error: errDel } = await admin
    .from('flujos')
    .delete()
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (errDel) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_eliminar_flujo',
      flujo_id: id,
      detalle: errDel.message,
    }))
    return NextResponse.json({ error: 'Error al eliminar flujo' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ejecuciones_canceladas: ejecucionesCanceladas?.length ?? 0 })
}
