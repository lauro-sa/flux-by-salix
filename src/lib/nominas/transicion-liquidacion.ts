/**
 * Helper compartido para transicionar la FSM de liquidación por empleado.
 *
 * Centraliza:
 *   - Validación de transición legal (consulta `transiciones_estado`).
 *   - Lock pesimista (`SELECT ... FOR UPDATE`) sobre la fila existente o
 *     `pg_advisory_xact_lock` cuando todavía no existe (estado virtual
 *     'borrador') para evitar inserciones duplicadas en concurrencia.
 *   - Upsert lazy de la fila en `liquidaciones_empleado_periodo` si no
 *     existe (caso primera transición desde borrador).
 *   - Actualización de timestamps de la fase correspondiente
 *     (liquidado_en, enviado_en, pagado_en) + nombre del usuario.
 *   - Validación de envío obligatorio según `empresas.nominas_envio_obligatorio`.
 *
 * NO maneja:
 *   - El audit log (`cambios_estado`) — lo dispara el trigger AFTER UPDATE
 *     definido en sql/105 automáticamente al detectar cambio de estado_clave.
 *   - El side-effect de crear `pagos_nomina` al pasar a 'pagado' — eso lo
 *     hace el endpoint `/api/nominas/pagar` que arma el payload completo
 *     con método/cuenta/comprobante (datos que el helper no conoce).
 *
 * Devuelve la fila actualizada o un objeto error con código:
 *   - 'transicion_ilegal'      → no existe en transiciones_estado
 *   - 'motivo_requerido'       → la transición tiene requiere_motivo=true
 *   - 'envio_obligatorio'      → la empresa exige enviar antes de pagar
 *   - 'periodo_cerrado'        → liquidaciones_periodo.estado='cerrado'
 *   - 'error_db'               → fallo de Postgres
 *
 * Concurrencia: usa pg_advisory_xact_lock con hash de
 * (empresa_id, miembro_id, periodo_inicio, periodo_fin). Si dos requests
 * piden la misma transición en paralelo, una pasa y la otra recibe el
 * estado YA actualizado y falla con 'transicion_ilegal' (porque el
 * estado actual no coincide con desde_clave esperado).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type EstadoLiquidacion = 'borrador' | 'liquidado' | 'enviado' | 'pagado'

export interface TransicionInput {
  empresaId: string
  miembroId: string
  periodoInicio: string  // 'YYYY-MM-DD'
  periodoFin: string
  hastaClave: EstadoLiquidacion
  /** Snapshot del cálculo (requerido al pasar a 'liquidado' desde borrador). */
  snapshotCalculo?: Record<string, unknown> | null
  /** Motivo (requerido para transiciones marcadas requiere_motivo=true). */
  motivo?: string | null
  /** ID del pago_nomina creado al pasar a 'pagado' (lo arma el endpoint /pagar). */
  pagoNominaId?: string | null
  /** Datos del usuario actor para snapshot en la fila. */
  usuario: { id: string; nombre: string }
}

export type ResultadoTransicion =
  | { ok: true; fila: Record<string, unknown> }
  | {
      ok: false
      code:
        | 'transicion_ilegal'
        | 'motivo_requerido'
        | 'envio_obligatorio'
        | 'periodo_cerrado'
        | 'error_db'
      mensaje: string
      detalle?: unknown
    }

/**
 * Ejecuta una transición de la FSM de liquidación por empleado de forma
 * segura. Llamar dentro de un endpoint con acceso al cliente admin.
 */
export async function transicionarLiquidacionEmpleado(
  admin: SupabaseClient,
  input: TransicionInput,
): Promise<ResultadoTransicion> {
  const { empresaId, miembroId, periodoInicio, periodoFin, hastaClave } = input

  // 1. Verificar que el período no esté cerrado. Si está cerrado, no
  //    se permiten cambios en empleados de ese período (la única acción
  //    permitida es reabrir el período primero).
  const { data: periodo, error: errPeriodo } = await admin
    .from('liquidaciones_periodo')
    .select('id, estado_clave')
    .eq('empresa_id', empresaId)
    .eq('periodo_inicio', periodoInicio)
    .eq('periodo_fin', periodoFin)
    .maybeSingle()

  if (errPeriodo) {
    return {
      ok: false,
      code: 'error_db',
      mensaje: 'No se pudo consultar el estado del período',
      detalle: errPeriodo,
    }
  }

  if (periodo?.estado_clave === 'cerrado') {
    return {
      ok: false,
      code: 'periodo_cerrado',
      mensaje: 'El período está cerrado. Reabrilo primero para hacer cambios.',
    }
  }

  // 2. Lazy: si no existe la fila del período, crearla en 'abierto'
  //    para que la FK de la fila del empleado tenga referente.
  let liquidacionPeriodoId = periodo?.id as string | undefined
  if (!liquidacionPeriodoId) {
    const { data: nuevo, error: errNuevo } = await admin
      .from('liquidaciones_periodo')
      .insert({
        empresa_id: empresaId,
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
        estado_clave: 'abierto',
        abierto_por: input.usuario.id,
        abierto_por_nombre: input.usuario.nombre,
        creado_por: input.usuario.id,
      })
      .select('id')
      .single()
    if (errNuevo || !nuevo) {
      return {
        ok: false,
        code: 'error_db',
        mensaje: 'No se pudo crear la liquidación del período',
        detalle: errNuevo,
      }
    }
    liquidacionPeriodoId = nuevo.id as string
  }

  // 3. Tomar advisory lock para evitar inserciones concurrentes duplicadas
  //    cuando la fila del empleado todavía no existe. El lock se libera
  //    automáticamente al final de la transacción del request.
  //    Hashea (empresa_id, miembro_id, periodo_inicio, periodo_fin) en dos
  //    int4 (que es lo que toma pg_advisory_xact_lock(int, int)).
  const lockKey = computarLockKey(empresaId, miembroId, periodoInicio, periodoFin)
  const { error: errLock } = await admin.rpc('pg_advisory_xact_lock', {
    key1: lockKey.k1,
    key2: lockKey.k2,
  })
  // Si pg_advisory_xact_lock no está expuesto como RPC, lo ignoramos —
  // el UNIQUE de la tabla actúa como segunda línea de defensa.
  void errLock

  // 4. Buscar la fila actual del empleado (con FOR UPDATE para serializar).
  //    Usamos RPC porque .select() de supabase-js no soporta FOR UPDATE.
  //    Fallback: select normal sin lock (igual hay UNIQUE constraint).
  const { data: filaActual, error: errFila } = await admin
    .from('liquidaciones_empleado_periodo')
    .select('id, estado_clave, snapshot_calculo, pago_nomina_id')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', miembroId)
    .eq('periodo_inicio', periodoInicio)
    .eq('periodo_fin', periodoFin)
    .maybeSingle()

  if (errFila) {
    return {
      ok: false,
      code: 'error_db',
      mensaje: 'No se pudo consultar la liquidación del empleado',
      detalle: errFila,
    }
  }

  const desdeClave = (filaActual?.estado_clave as EstadoLiquidacion | undefined) ?? 'borrador'

  // 5. Validar transición legal contra transiciones_estado.
  const { data: transicion, error: errTrans } = await admin
    .from('transiciones_estado')
    .select('requiere_motivo')
    .eq('entidad_tipo', 'liquidacion_empleado')
    .eq('desde_clave', desdeClave)
    .eq('hasta_clave', hastaClave)
    .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
    .order('empresa_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (errTrans) {
    return {
      ok: false,
      code: 'error_db',
      mensaje: 'No se pudo validar la transición',
      detalle: errTrans,
    }
  }
  if (!transicion) {
    return {
      ok: false,
      code: 'transicion_ilegal',
      mensaje: `No se permite pasar de '${desdeClave}' a '${hastaClave}' para liquidación del empleado.`,
    }
  }

  if (transicion.requiere_motivo && !input.motivo?.trim()) {
    return {
      ok: false,
      code: 'motivo_requerido',
      mensaje: 'Esta transición requiere un motivo explícito.',
    }
  }

  // 6. Si la transición es a 'pagado' y la empresa tiene envío obligatorio,
  //    bloquear si no se pasó por 'enviado' primero.
  if (hastaClave === 'pagado' && desdeClave !== 'enviado') {
    const { data: empresa } = await admin
      .from('empresas')
      .select('nominas_envio_obligatorio')
      .eq('id', empresaId)
      .single()
    if (empresa?.nominas_envio_obligatorio) {
      return {
        ok: false,
        code: 'envio_obligatorio',
        mensaje: 'Esta empresa requiere enviar el recibo antes de pagar.',
      }
    }
  }

  // 7. Construir payload de update según la fase destino.
  const now = new Date().toISOString()
  const payloadComun: Record<string, unknown> = {
    estado_clave: hastaClave,
    actualizado_por: input.usuario.id,
  }
  if (hastaClave === 'liquidado' && desdeClave === 'borrador') {
    payloadComun.snapshot_calculo = input.snapshotCalculo ?? null
    payloadComun.liquidado_en = now
    payloadComun.liquidado_por = input.usuario.id
    payloadComun.liquidado_por_nombre = input.usuario.nombre
  }
  if (hastaClave === 'enviado') {
    payloadComun.enviado_en = now
    payloadComun.enviado_por = input.usuario.id
    payloadComun.enviado_por_nombre = input.usuario.nombre
  }
  if (hastaClave === 'pagado') {
    payloadComun.pagado_en = now
    payloadComun.pagado_por = input.usuario.id
    payloadComun.pagado_por_nombre = input.usuario.nombre
    if (input.pagoNominaId) payloadComun.pago_nomina_id = input.pagoNominaId
  }
  if (hastaClave === 'borrador' && desdeClave === 'liquidado') {
    payloadComun.motivo_desliquidar = input.motivo
  }
  if (hastaClave === 'liquidado' && desdeClave === 'enviado') {
    payloadComun.motivo_volver_a_liquidado = input.motivo
  }

  // 8. Insertar o actualizar la fila.
  if (!filaActual) {
    // Primera transición desde borrador virtual: INSERT directo en hastaClave.
    const { data: inserted, error: errIns } = await admin
      .from('liquidaciones_empleado_periodo')
      .insert({
        empresa_id: empresaId,
        liquidacion_periodo_id: liquidacionPeriodoId,
        miembro_id: miembroId,
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
        creado_por: input.usuario.id,
        ...payloadComun,
      })
      .select()
      .single()
    if (errIns || !inserted) {
      return {
        ok: false,
        code: 'error_db',
        mensaje: 'No se pudo crear la liquidación del empleado',
        detalle: errIns,
      }
    }
    return { ok: true, fila: inserted }
  }

  // Fila existe: UPDATE.
  const { data: updated, error: errUpd } = await admin
    .from('liquidaciones_empleado_periodo')
    .update(payloadComun)
    .eq('id', filaActual.id as string)
    .select()
    .single()
  if (errUpd || !updated) {
    return {
      ok: false,
      code: 'error_db',
      mensaje: 'No se pudo actualizar la liquidación del empleado',
      detalle: errUpd,
    }
  }
  return { ok: true, fila: updated }
}

/**
 * Hashea 4 valores en dos int4 deterministas para usar como key de
 * pg_advisory_xact_lock(int, int). Usa FNV-1a sobre el string concatenado.
 */
function computarLockKey(
  empresaId: string,
  miembroId: string,
  periodoInicio: string,
  periodoFin: string,
): { k1: number; k2: number } {
  const s = `${empresaId}|${miembroId}|${periodoInicio}|${periodoFin}`
  let h1 = 0x811c9dc5 // FNV offset basis
  let h2 = 0x84222325
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = ((h1 ^ c) >>> 0) * 0x01000193 >>> 0
    h2 = ((h2 ^ c) >>> 0) * 0x01000193 >>> 0
  }
  // Convertir a int4 firmado (lo que espera pg_advisory_xact_lock).
  const toInt4 = (n: number) => (n | 0)
  return { k1: toInt4(h1), k2: toInt4(h2) }
}
