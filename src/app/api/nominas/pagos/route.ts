/**
 * POST /api/nominas/pagos — Grabar un pago de nómina.
 *
 * Body:
 *   {
 *     miembro_id: string,
 *     periodo_inicio: 'YYYY-MM-DD',
 *     periodo_fin:    'YYYY-MM-DD',
 *     monto_abonado:  number,             // lo que efectivamente se paga (puede diferir del neto sugerido)
 *     concepto?:      string,             // opcional, ej "Quincena 1-15"
 *     notas?:         string | null,
 *     comprobante_url?: string | null,
 *     // Datos del cobro real (sql/092):
 *     metodo_pago?:      'efectivo' | 'transferencia' | 'cuenta_digital' | 'cheque' | 'otro',
 *     fecha_pago?:       'YYYY-MM-DD',    // default: hoy
 *     referencia?:       string | null,    // nro de operación / cheque
 *     info_bancaria_id?: string | null,    // cuenta destino (si no es efectivo)
 *     conceptos_extra?: Array<{           // conceptos manuales agregados desde la UI
 *       nombre: string,
 *       tipo: 'haber' | 'descuento',
 *       monto: number,
 *       detalle?: string | null,
 *     }>,
 *   }
 *
 * Flujo:
 *   1. Recalcula el recibo desde BD para tener el desglose autoritativo.
 *   2. Inserta una fila en `pagos_nomina` con:
 *      - estadísticas del período (días trabajados/ausentes, tardanzas).
 *      - `contrato_id` y `contrato_snapshot` (JSONB inmutable).
 *      - `monto_sugerido` (neto del cálculo) y `monto_abonado` (del payload).
 *   3. Por cada concepto aplicado (haber o descuento del motor) y por cada
 *      `conceptos_extra` del payload, inserta `conceptos_aplicados_pago`.
 *   4. Por cada cuota de adelanto aplicada, marca la cuota como
 *      `estado='descontada'`, `fecha_descontada=hoy`, `pago_nomina_id=...`.
 *
 * Auth: requiere `nomina:editar`.
 *
 * Ver src/lib/nominas/motor-calculo.ts y PLAN_MODULO_NOMINAS.md (PR 7).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { calcularReciboDesdeBD } from '@/lib/nominas/motor-calculo'
import { transicionarLiquidacionEmpleado } from '@/lib/nominas/transicion-liquidacion'
import { obtenerFilaListadoParaSnapshot } from '@/lib/nominas/obtener-fila-listado'

interface ConceptoExtra {
  nombre: string
  tipo: 'haber' | 'descuento'
  monto: number
  detalle?: string | null
}

type MetodoPago = 'efectivo' | 'transferencia' | 'cuenta_digital' | 'cheque' | 'otro'

interface Payload {
  miembro_id: string
  periodo_inicio: string
  periodo_fin: string
  monto_abonado: number
  concepto?: string
  notas?: string | null
  comprobante_url?: string | null
  metodo_pago?: MetodoPago
  fecha_pago?: string
  referencia?: string | null
  info_bancaria_id?: string | null
  conceptos_extra?: ConceptoExtra[]
}

const METODOS_VALIDOS: MetodoPago[] = ['efectivo', 'transferencia', 'cuenta_digital', 'cheque', 'otro']

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: Payload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // ─── Validaciones ───
  if (!body.miembro_id) return NextResponse.json({ error: 'miembro_id requerido' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.periodo_inicio ?? '')) {
    return NextResponse.json({ error: 'periodo_inicio inválido (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.periodo_fin ?? '')) {
    return NextResponse.json({ error: 'periodo_fin inválido (YYYY-MM-DD)' }, { status: 400 })
  }
  if (body.periodo_fin < body.periodo_inicio) {
    return NextResponse.json({ error: 'periodo_fin debe ser >= periodo_inicio' }, { status: 400 })
  }
  if (typeof body.monto_abonado !== 'number' || body.monto_abonado < 0) {
    return NextResponse.json({ error: 'monto_abonado debe ser un número ≥ 0' }, { status: 400 })
  }
  const conceptosExtra: ConceptoExtra[] = Array.isArray(body.conceptos_extra) ? body.conceptos_extra : []
  for (const ce of conceptosExtra) {
    if (!ce.nombre || (ce.tipo !== 'haber' && ce.tipo !== 'descuento') || typeof ce.monto !== 'number') {
      return NextResponse.json({ error: 'concepto_extra inválido' }, { status: 400 })
    }
  }

  // Método de pago: default 'efectivo' si no viene. La UI debería
  // mandarlo siempre, pero contemplamos el caso para no romper
  // consumidores viejos durante el rollout.
  const metodoPago: MetodoPago = METODOS_VALIDOS.includes(body.metodo_pago as MetodoPago)
    ? (body.metodo_pago as MetodoPago)
    : 'efectivo'

  // Fecha de pago: default a hoy. Aceptamos `YYYY-MM-DD` o vacío.
  const fechaPago = body.fecha_pago && /^\d{4}-\d{2}-\d{2}$/.test(body.fecha_pago)
    ? body.fecha_pago
    : new Date().toISOString().slice(0, 10)

  // Coherencia: si el método es efectivo o cheque, info_bancaria_id no
  // tiene sentido; lo limpiamos para no guardar referencias absurdas.
  // Si es transferencia o cuenta_digital, lo dejamos pasar tal cual
  // (la validación de que la cuenta exista la hace el FK).
  const infoBancariaId =
    metodoPago === 'efectivo' || metodoPago === 'cheque'
      ? null
      : body.info_bancaria_id ?? null

  const admin = crearClienteAdmin()

  // Confirmar que el miembro pertenece a la empresa.
  const { data: miembro } = await admin
    .from('miembros')
    .select('id, usuario_id')
    .eq('id', body.miembro_id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!miembro) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })

  // ─── 1) Calcular el recibo (autoritativo) ───
  const detalle = await calcularReciboDesdeBD(admin, {
    miembroId: body.miembro_id,
    empresaId,
    periodoInicio: body.periodo_inicio,
    periodoFin: body.periodo_fin,
  })

  // ─── 2) Insertar pagos_nomina ───
  // Nombre del creador para la columna `creado_por_nombre` (legacy).
  // El creador siempre tiene cuenta de Flux (necesita permiso nomina:editar),
  // así que leemos directo de `perfiles`.
  const { data: perfilCreador } = await admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', user.id)
    .maybeSingle()
  const nombreCreador = perfilCreador
    ? `${perfilCreador.nombre ?? ''} ${perfilCreador.apellido ?? ''}`.trim() || 'Sistema'
    : 'Sistema'

  const conceptoLegible = body.concepto?.trim() || `Período ${body.periodo_inicio} a ${body.periodo_fin}`

  const { data: pago, error: errPago } = await admin
    .from('pagos_nomina')
    .insert({
      empresa_id: empresaId,
      miembro_id: body.miembro_id,
      fecha_inicio_periodo: body.periodo_inicio,
      fecha_fin_periodo: body.periodo_fin,
      concepto: conceptoLegible,
      monto_sugerido: detalle.neto,
      monto_abonado: body.monto_abonado,
      dias_habiles: detalle.asistencia.dias_periodo,
      dias_trabajados: detalle.asistencia.dias_trabajados,
      dias_ausentes: detalle.asistencia.dias_ausentes,
      tardanzas: detalle.asistencia.tardanzas,
      comprobante_url: body.comprobante_url ?? null,
      notas: body.notas ?? null,
      metodo_pago: metodoPago,
      fecha_pago: fechaPago,
      referencia: body.referencia?.trim() || null,
      info_bancaria_id: infoBancariaId,
      contrato_id: detalle.contrato.id,
      contrato_snapshot: detalle.contrato.snapshot,
      creado_por: user.id,
      creado_por_nombre: nombreCreador,
    })
    .select()
    .single()

  if (errPago || !pago) {
    console.error('[nominas/pagos] error al crear pago:', errPago)
    return NextResponse.json({ error: 'No se pudo crear el pago' }, { status: 500 })
  }

  // ─── 3) Insertar conceptos_aplicados_pago ───
  //
  // Snapshot inmutable: aunque después se borre el concepto del catálogo
  // o el adelanto, este registro mantiene los valores históricos.
  //
  // Para los ajustes one-off del período (adelantos, descuentos, bonos)
  // resolvemos su `tipo` y `notas` desde `adelantos_nomina` antes de
  // snappear. Así el PDF muestra los bonos como haberes y los
  // adelantos/descuentos como descuentos, sin necesidad de joins
  // futuros que podrían fallar si se borra el adelanto.
  const adelantoIds = Array.from(new Set(detalle.adelantos_aplicados.map(a => a.adelanto_id)))
  const ajustesMeta = new Map<string, { tipo: 'adelanto' | 'descuento' | 'bono'; notas: string | null }>()
  if (adelantoIds.length > 0) {
    const { data: ajustes } = await admin
      .from('adelantos_nomina')
      .select('id, tipo, notas')
      .in('id', adelantoIds)
    for (const a of ajustes ?? []) {
      ajustesMeta.set(a.id as string, {
        tipo: ((a.tipo as string) ?? 'adelanto') as 'adelanto' | 'descuento' | 'bono',
        notas: (a.notas as string) ?? null,
      })
    }
  }

  const filasConceptos = [
    // Conceptos automáticos del motor (vienen del contrato)
    ...detalle.conceptos_aplicados.map(c => ({
      empresa_id: empresaId,
      pago_nomina_id: pago.id,
      concepto_id: c.concepto_id,
      nombre_snapshot: c.nombre,
      tipo: c.tipo,
      monto: c.monto,
      automatico: true,
      detalle: c.detalle,
    })),
    // Ajustes del período (adelantos / descuentos / bonos):
    //   - bono       → snapshot como tipo 'haber' (suma al neto).
    //   - adelanto / descuento → snapshot como tipo 'descuento' (resta).
    // El nombre_snapshot describe el origen para que el recibo lo
    // muestre como una línea más.
    ...detalle.adelantos_aplicados.map(a => {
      const meta = ajustesMeta.get(a.adelanto_id)
      const esBono = meta?.tipo === 'bono'
      const esDesc = meta?.tipo === 'descuento'
      const nombreBase = esBono ? 'Bono extra'
        : esDesc ? 'Descuento manual'
        : `Adelanto · cuota ${a.numero_cuota}`
      return {
        empresa_id: empresaId,
        pago_nomina_id: pago.id,
        concepto_id: null,
        nombre_snapshot: meta?.notas?.trim() || nombreBase,
        tipo: esBono ? 'haber' : 'descuento',
        monto: a.monto,
        automatico: true,
        detalle: meta?.notas?.trim() && nombreBase !== meta.notas.trim() ? nombreBase : null,
      }
    }),
    // Conceptos extra agregados manualmente desde la UI
    ...conceptosExtra.map(c => ({
      empresa_id: empresaId,
      pago_nomina_id: pago.id,
      concepto_id: null,
      nombre_snapshot: c.nombre.trim(),
      tipo: c.tipo,
      monto: c.monto,
      automatico: false,
      detalle: c.detalle ?? null,
    })),
  ]

  if (filasConceptos.length > 0) {
    const { error: errConceptos } = await admin
      .from('conceptos_aplicados_pago')
      .insert(filasConceptos)
    if (errConceptos) {
      // Log pero no fallamos: el pago ya está creado. Mejor un registro
      // de pago sin desglose detallado que perderlo todo.
      console.error('[nominas/pagos] error al insertar conceptos aplicados:', errConceptos)
    }
  }

  // ─── 4) Marcar cuotas de adelanto como descontadas ───
  if (detalle.adelantos_aplicados.length > 0) {
    const hoy = new Date().toISOString().slice(0, 10)
    const cuotaIds = detalle.adelantos_aplicados.map(a => a.cuota_id)
    const { error: errCuotas } = await admin
      .from('adelantos_cuotas')
      .update({
        estado: 'descontada',
        fecha_descontada: hoy,
        pago_nomina_id: pago.id,
        actualizado_en: new Date().toISOString(),
      })
      .in('id', cuotaIds)
    if (errCuotas) {
      console.error('[nominas/pagos] error al marcar cuotas:', errCuotas)
    }

    // Recalcular cuotas_descontadas + saldo_pendiente + estado de los
    // adelantos afectados. Una pasada por adelanto único.
    const adelantoIds = Array.from(new Set(detalle.adelantos_aplicados.map(a => a.adelanto_id)))
    for (const adelantoId of adelantoIds) {
      const { data: ad } = await admin
        .from('adelantos_nomina')
        .select('id, monto_total, cuotas_totales')
        .eq('id', adelantoId)
        .maybeSingle()
      if (!ad) continue

      const { count: cuotasDescontadasCount } = await admin
        .from('adelantos_cuotas')
        .select('id', { count: 'exact', head: true })
        .eq('adelanto_id', adelantoId)
        .eq('estado', 'descontada')

      const cuotasDescontadas = cuotasDescontadasCount ?? 0
      const saldoPendiente = Math.max(
        0,
        Number(ad.monto_total) * (1 - cuotasDescontadas / Number(ad.cuotas_totales)),
      )
      const estado = cuotasDescontadas >= Number(ad.cuotas_totales) ? 'pagado' : 'activo'

      await admin
        .from('adelantos_nomina')
        .update({
          cuotas_descontadas: cuotasDescontadas,
          saldo_pendiente: saldoPendiente,
          estado,
          editado_por: user.id,
          editado_en: new Date().toISOString(),
        })
        .eq('id', adelantoId)
    }
  }

  // ─── 5) Limpiar ajustes_concepto_periodo del período ───
  //
  // Los ajustes (override/excluir/agregar) son "intenciones del
  // operador para el próximo cálculo". Cuando se graba el pago, esos
  // ajustes ya quedaron snapshoteados en `conceptos_aplicados_pago`
  // (snapshot inmutable que es lo que vale para auditoría). La fila
  // de `ajustes_concepto_periodo` ya no aporta valor — peor: si
  // queda, una próxima visualización del recibo NO pagado mostraría
  // los ajustes como "pendientes de aplicar" cuando ya se aplicaron.
  //
  // Decisión: borrarlos al pagar. Si después el operador elimina el
  // pago para corregir, los ajustes no se restauran — el motor vuelve
  // a aplicar el cálculo del contrato sin ajustes. El operador puede
  // volver a configurar lo que quiera.
  //
  // Cada ajuste borrado deja una entrada en `auditoria_ajustes_concepto_periodo`
  // con accion='limpiar_al_pagar' para preservar la trazabilidad.
  const { data: ajustesABorrar } = await admin
    .from('ajustes_concepto_periodo')
    .select('id, miembro_id, concepto_id, periodo_inicio, periodo_fin, tipo_ajuste, monto_override, motivo')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', body.miembro_id)
    .eq('periodo_inicio', body.periodo_inicio)
    .eq('periodo_fin', body.periodo_fin)

  if (ajustesABorrar && ajustesABorrar.length > 0) {
    const { error: errAjustes } = await admin
      .from('ajustes_concepto_periodo')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('miembro_id', body.miembro_id)
      .eq('periodo_inicio', body.periodo_inicio)
      .eq('periodo_fin', body.periodo_fin)
    if (errAjustes) {
      console.error('[nominas/pagos] error al limpiar ajustes del período:', errAjustes)
    } else {
      // Auditoría best-effort: una entrada por ajuste limpiado.
      await admin.from('auditoria_ajustes_concepto_periodo').insert(
        ajustesABorrar.map(a => ({
          empresa_id: empresaId,
          ajuste_id: a.id,
          miembro_id: a.miembro_id,
          concepto_id: a.concepto_id,
          periodo_inicio: a.periodo_inicio,
          periodo_fin: a.periodo_fin,
          editado_por: user.id,
          accion: 'limpiar_al_pagar' as const,
          estado_anterior: a,
          estado_nuevo: null,
        }))
      )
    }
  }

  // ─── 4) Side-effect: transicionar liquidaciones_empleado_periodo → 'pagado' ───
  //
  // El flujo nuevo (sql/103) exige pasar por 'liquidado' antes de 'pagado'.
  // Por compatibilidad con consumidores que llaman directo a /api/nominas/pagos
  // sin haber liquidado primero, hacemos un fallback: si la fila no existe (estado
  // virtual 'borrador'), crearla en 'pagado' linkeada al pago_nomina recién creado,
  // saltando borrador/liquidado/enviado. El snapshot se guarda con el cálculo
  // recién hecho. Audit en cambios_estado captura el salto.
  //
  // Si la fila ya existe en 'liquidado' o 'enviado', transicionar a 'pagado'
  // con el helper estándar.
  //
  // Si la fila existe en 'borrador' (caso raro: alguien creó la fila pero no
  // liquidó), tratarlo igual que liquidar+pagar en un solo movimiento.
  // Fila completa del listado para snapshot enriquecido v3.1. Permite
  // que /api/nominas GET reconstruya la card sin pasar por el motor.
  // Si la fila no existe (red caída u otro motivo), guardamos snapshot
  // sin ella: los GET futuros caerán a cálculo en vivo (compat v3.0).
  const filaListadoSnapshot = await obtenerFilaListadoParaSnapshot(
    request, body.miembro_id, body.periodo_inicio, body.periodo_fin,
  )
  const snapshot = {
    version_motor: 'v3.1',
    calculado_en: new Date().toISOString(),
    monto_neto: detalle.neto,
    monto_abonado: body.monto_abonado,
    detalle,
    fila_listado: filaListadoSnapshot,
  } as unknown as Record<string, unknown>

  const { data: filaExistente } = await admin
    .from('liquidaciones_empleado_periodo')
    .select('id, estado_clave')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', body.miembro_id)
    .eq('periodo_inicio', body.periodo_inicio)
    .eq('periodo_fin', body.periodo_fin)
    .maybeSingle()

  const estadoActual = (filaExistente?.estado_clave as string | undefined) ?? 'borrador'

  // Si está en borrador, primero liquidar (con el snapshot recién calculado).
  if (estadoActual === 'borrador') {
    await transicionarLiquidacionEmpleado(admin, {
      empresaId,
      miembroId: body.miembro_id,
      periodoInicio: body.periodo_inicio,
      periodoFin: body.periodo_fin,
      hastaClave: 'liquidado',
      snapshotCalculo: snapshot,
      usuario: { id: user.id, nombre: nombreCreador },
    })
  }

  // Y después pasar a pagado linkeando al pago recién creado.
  const transicion = await transicionarLiquidacionEmpleado(admin, {
    empresaId,
    miembroId: body.miembro_id,
    periodoInicio: body.periodo_inicio,
    periodoFin: body.periodo_fin,
    hastaClave: 'pagado',
    pagoNominaId: pago.id as string,
    usuario: { id: user.id, nombre: nombreCreador },
  })

  // Si la transición falla (ej: envio_obligatorio activo y no se envió),
  // la fila pagos_nomina ya está creada — sería raro hacer rollback porque
  // el dinero ya se transfirió. Devolvemos warning para que el operador
  // sepa que el estado quedó desincronizado.
  const warning = transicion.ok ? null : transicion.mensaje

  return NextResponse.json({ pago, detalle, warning }, { status: 201 })
}
