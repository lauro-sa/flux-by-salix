/**
 * Endpoints de pagos de un presupuesto.
 * GET  — listar todos los pagos del presupuesto (hidrata `comprobantes[]`).
 * POST — registrar un pago nuevo. Acepta JSON o FormData (con N comprobantes).
 *        Crea entrada en chatter automáticamente.
 *
 * FormData esperado:
 *  - `datos` (string JSON con los campos del pago)
 *  - `archivos` (File, repetido — múltiples adjuntos)
 *  - `tipos_archivos` (string JSON tipo `["comprobante","percepcion"]`,
 *    paralelo a `archivos`. Default si falta: todos 'comprobante')
 *
 *  Compat: si viene un único campo `archivo` (legacy), se trata como un
 *  solo comprobante de tipo 'comprobante'.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarChatter } from '@/lib/chatter'
import { sincronizarEstadoPresupuesto } from '@/lib/presupuesto-auto-transicion'
import { validarArchivo, TAMANO_MAXIMO_BYTES, comprimirImagen } from '@/lib/comprimir-imagen'
import { verificarCuotaStorage, registrarUsoStorage } from '@/lib/uso-storage'
import { CrearPagoSchema, parsearPago } from '@/lib/schemas/pago'
import { verificarRateLimit } from '@/lib/rate-limit'
import type {
  MetodoPago,
  PresupuestoPagoComprobante,
  TipoComprobantePago,
} from '@/tipos/presupuesto-pago'

const TIPOS_COMPROBANTE_VALIDOS: TipoComprobantePago[] = ['comprobante', 'percepcion']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'presupuestos')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Validar que el presupuesto pertenece a la empresa y respetar soloPropio
    const { data: presupuesto } = await admin
      .from('presupuestos')
      .select('id, creado_por')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!presupuesto) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    if (visibilidad.soloPropio && presupuesto.creado_por !== user.id) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // Por defecto excluimos pagos en papelera; si la UI quiere ver la
    // lista completa (vista de auditoría), pasa ?incluir_eliminados=true.
    const incluirEliminados = request.nextUrl.searchParams.get('incluir_eliminados') === 'true'

    let q = admin
      .from('presupuesto_pagos')
      .select('*')
      .eq('presupuesto_id', id)
      .eq('empresa_id', empresaId)
    if (!incluirEliminados) q = q.is('eliminado_en', null)
    const { data: pagos, error } = await q.order('fecha_pago', { ascending: false })

    if (error) {
      console.error('Error al listar pagos:', error)
      return NextResponse.json({ error: 'Error al listar' }, { status: 500 })
    }

    // Hidratar comprobantes[] de la tabla relacionada
    const lista = pagos || []
    if (lista.length > 0) {
      const ids = lista.map((p) => p.id)
      const { data: comprobantes } = await admin
        .from('presupuesto_pago_comprobantes')
        .select('*')
        .eq('empresa_id', empresaId)
        .in('pago_id', ids)
        .order('creado_en', { ascending: true })

      const porPago = new Map<string, PresupuestoPagoComprobante[]>()
      for (const c of comprobantes || []) {
        const arr = porPago.get(c.pago_id) || []
        arr.push(c as PresupuestoPagoComprobante)
        porPago.set(c.pago_id, arr)
      }
      for (const p of lista) {
        ;(p as Record<string, unknown>).comprobantes = porPago.get(p.id) || []
      }
    }

    return NextResponse.json({ pagos: lista })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: presupuestoId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para registrar pagos' }, { status: 403 })

    // Rate limit: máximo 30 pagos por minuto por usuario+empresa. Suficiente
    // para flujos legítimos (carga masiva manual) y bloquea scripts.
    const rl = verificarRateLimit(`pagos-post:${empresaId}:${user.id}`, {
      maximo: 30,
      ventanaSegundos: 60,
    })
    if (!rl.permitido) {
      return NextResponse.json(
        {
          error: 'Demasiados pagos en poco tiempo. Esperá un momento e intentá de nuevo.',
          reseteaEn: rl.reseteaEn,
        },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reseteaEn - Date.now()) / 1000)) } }
      )
    }

    const admin = crearClienteAdmin()

    // Verificar presupuesto (incluyendo campos necesarios para materializar
    // cuotas sintéticas si vienen como cuota_id="sintetico-N")
    const { data: presupuesto } = await admin
      .from('presupuestos')
      .select('id, numero, moneda, estado, fecha_aceptacion, total_final, condicion_pago_id, condicion_pago_tipo')
      .eq('id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!presupuesto) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })

    // Aceptar JSON o FormData (con N comprobantes)
    const contentType = request.headers.get('content-type') || ''
    let datos: Record<string, unknown> = {}
    const archivos: { file: File; tipo: TipoComprobantePago }[] = []

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData()
      const datosJson = fd.get('datos')
      if (typeof datosJson === 'string') datos = JSON.parse(datosJson)

      // Formato nuevo: getAll('archivos') + JSON paralelo en 'tipos_archivos'
      const lista = fd.getAll('archivos').filter((x): x is File => x instanceof File)
      let tipos: string[] = []
      const tiposJson = fd.get('tipos_archivos')
      if (typeof tiposJson === 'string') {
        try { tipos = JSON.parse(tiposJson) } catch { /* ignore */ }
      }
      for (let i = 0; i < lista.length; i++) {
        const t = (tipos[i] as TipoComprobantePago) || 'comprobante'
        archivos.push({
          file: lista[i],
          tipo: TIPOS_COMPROBANTE_VALIDOS.includes(t) ? t : 'comprobante',
        })
      }

      // Compat: campo único `archivo`
      if (archivos.length === 0) {
        const archivoField = fd.get('archivo')
        if (archivoField instanceof File) {
          archivos.push({ file: archivoField, tipo: 'comprobante' })
        }
      }
    } else {
      datos = await request.json()
    }

    // Validación con Zod (monto > 0, percepciones <= monto, método válido,
    // fecha no futura, coherencia es_adicional/cuota_id, etc.). El schema
    // unifica las reglas que antes estaban dispersas en el endpoint.
    const parseado = parsearPago(CrearPagoSchema, datos)
    if (!parseado.ok) {
      return NextResponse.json(
        { error: parseado.error, detalles: parseado.detalles },
        { status: 400 }
      )
    }
    const datosVal = parseado.datos
    const monto = datosVal.monto
    const montoPercepciones = datosVal.monto_percepciones ?? 0
    const metodo: MetodoPago = (datosVal.metodo ?? 'transferencia') as MetodoPago
    const moneda = datosVal.moneda || presupuesto.moneda || 'ARS'
    const cotizacion = datosVal.cotizacion_cambio ?? 1
    const fechaPago = datosVal.fecha_pago ? new Date(datosVal.fecha_pago) : new Date()

    // Si el cliente mandó una moneda explícita, validamos que esté entre
    // las monedas activas configuradas para la empresa. La del presupuesto
    // siempre se acepta (puede ser legacy si la config cambió después).
    if (datosVal.moneda && datosVal.moneda !== presupuesto.moneda) {
      const { data: cfg } = await admin
        .from('config_presupuestos')
        .select('monedas')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      const monedasActivas = ((cfg?.monedas as Array<{ id: string; activo?: boolean }>) || [])
        .filter((m) => m.activo !== false)
        .map((m) => m.id)
      if (monedasActivas.length > 0 && !monedasActivas.includes(datosVal.moneda)) {
        return NextResponse.json(
          { error: `Moneda "${datosVal.moneda}" no está habilitada para esta empresa` },
          { status: 400 }
        )
      }
    }

    const esAdicional = !!datosVal.es_adicional
    const conceptoAdicional = esAdicional
      ? (datosVal.concepto_adicional?.trim() || null)
      : null

    // Validar cuota_id. Soporta IDs reales (uuid) y sintéticos (formato
    // "sintetico-N") generados en el GET cuando la condición de pago es de
    // tipo "hitos" pero todavía no se materializaron las cuotas en BD.
    // Si llega un ID sintético, primero materializamos todas las cuotas
    // según la configuración y mapeamos al ID real correspondiente.
    let cuotaId = datosVal.cuota_id || null

    // Adicional → cuota_id ignorado (siempre null)
    if (esAdicional) cuotaId = null

    if (cuotaId && cuotaId.startsWith('sintetico-')) {
      const indice = parseInt(cuotaId.replace('sintetico-', ''), 10)
      if (!isFinite(indice) || indice < 0) {
        return NextResponse.json({ error: 'Cuota sintética inválida' }, { status: 400 })
      }

      // ¿Ya hay cuotas reales? (race condition / segunda llamada)
      const { data: existentes } = await admin
        .from('presupuesto_cuotas')
        .select('id, numero')
        .eq('presupuesto_id', presupuestoId)
        .eq('empresa_id', empresaId)
        .order('numero', { ascending: true })

      if (existentes && existentes.length > 0) {
        const real = existentes.find((c) => c.numero === indice + 1)
        if (!real) return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 400 })
        cuotaId = real.id
      } else {
        // Materializar cuotas desde la condición de pago configurada
        if (presupuesto.condicion_pago_tipo !== 'hitos' || !presupuesto.condicion_pago_id) {
          return NextResponse.json({ error: 'El presupuesto no tiene cuotas configuradas' }, { status: 400 })
        }

        const { data: config } = await admin
          .from('config_presupuestos')
          .select('condiciones_pago')
          .eq('empresa_id', empresaId)
          .single()

        const condiciones = (config?.condiciones_pago || []) as Array<{
          id: string
          tipo: string
          hitos: Array<{ porcentaje: number; descripcion?: string; diasDesdeEmision?: number }>
        }>
        const condicion = condiciones.find((c) => c.id === presupuesto.condicion_pago_id)

        if (!condicion || condicion.tipo !== 'hitos' || !condicion.hitos?.length) {
          return NextResponse.json({ error: 'Condición de pago sin hitos válidos' }, { status: 400 })
        }

        const totalFinal = Number(presupuesto.total_final) || 0
        const filasNuevas = condicion.hitos.map((h, i) => ({
          presupuesto_id: presupuestoId,
          empresa_id: empresaId,
          numero: i + 1,
          descripcion: h.descripcion || `Cuota ${i + 1}`,
          porcentaje: String(h.porcentaje),
          monto: String((totalFinal * h.porcentaje) / 100),
          dias_desde_emision: h.diasDesdeEmision || 0,
          estado: 'pendiente',
        }))

        const { data: insertadas, error: errorMat } = await admin
          .from('presupuesto_cuotas')
          .insert(filasNuevas)
          .select('id, numero')

        if (errorMat || !insertadas) {
          console.error('Error materializando cuotas:', errorMat)
          return NextResponse.json({ error: 'Error al materializar cuotas' }, { status: 500 })
        }

        const real = insertadas.find((c) => c.numero === indice + 1)
        if (!real) return NextResponse.json({ error: 'Cuota no encontrada tras materializar' }, { status: 500 })
        cuotaId = real.id
      }
    } else if (cuotaId) {
      // ID real: validar que pertenezca al presupuesto
      const { data: cuota } = await admin
        .from('presupuesto_cuotas')
        .select('id')
        .eq('id', cuotaId)
        .eq('presupuesto_id', presupuestoId)
        .eq('empresa_id', empresaId)
        .single()
      if (!cuota) return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 400 })
    }

    // Subir comprobantes a Storage. Validamos cada archivo y luego subimos.
    type ArchivoSubido = {
      tipo: TipoComprobantePago
      bucket: string
      url: string
      storagePath: string
      nombre: string
      mimeTipo: string
      tamanoBytes: number
    }
    const subidos: ArchivoSubido[] = []

    for (const item of archivos) {
      const f = item.file
      const errorValidacion = validarArchivo(f.type, f.size, TAMANO_MAXIMO_BYTES)
      if (errorValidacion) return NextResponse.json({ error: errorValidacion }, { status: 400 })

      const errorCuota = await verificarCuotaStorage(empresaId, f.size)
      if (errorCuota) return NextResponse.json({ error: errorCuota }, { status: 413 })

      const bufferOriginal = Buffer.from(await f.arrayBuffer())
      const { buffer, tipo: mimeFinal } = await comprimirImagen(bufferOriginal, f.type, {
        anchoMaximo: 1600,
        calidad: 80,
      })

      const nombreBase = f.name.replace(/\.[^.]+$/, '')
      const extension = mimeFinal === 'image/webp' ? '.webp'
        : mimeFinal === 'image/jpeg' && f.type !== 'image/jpeg' ? '.jpg'
        : `.${f.name.split('.').pop()}`
      const nombreFinal = `${nombreBase}${extension}`.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${empresaId}/presupuesto-pagos/${presupuestoId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${nombreFinal}`

      // Bucket privado dedicado: solo el backend puede leer/escribir,
      // y al servir los archivos genera signed URLs cortas (5 min).
      const bucket = 'comprobantes-pago'
      const { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(storagePath, buffer, { contentType: mimeFinal, upsert: false })

      if (uploadError) {
        return NextResponse.json({ error: `Error al subir comprobante: ${uploadError.message}` }, { status: 500 })
      }

      // url queda vacío para los del bucket privado: la URL real se genera
      // bajo demanda en /comprobantes/[id]/descargar. Lo dejamos como cadena
      // vacía para no violar el NOT NULL de la columna mientras el frontend
      // migra al endpoint nuevo.
      subidos.push({
        tipo: item.tipo,
        bucket,
        url: '',
        storagePath,
        nombre: f.name,
        mimeTipo: mimeFinal,
        tamanoBytes: buffer.length,
      })
      registrarUsoStorage(empresaId, bucket, buffer.length)
    }

    // Nombre del usuario
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, avatar_url')
      .eq('id', user.id)
      .single()
    const nombreUsuario = perfil ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() : 'Usuario'

    // El primer comprobante de tipo 'comprobante' se guarda también en los
    // campos legacy del pago para no romper consumidores antiguos.
    const principal = subidos.find((s) => s.tipo === 'comprobante') || subidos[0] || null

    // Auto-vincular OT: si el cliente la mandó explícitamente la respetamos
    // (validando ownership), si no buscamos la OT activa única del presupuesto.
    let ordenTrabajoId: string | null = null
    if (datosVal.orden_trabajo_id) {
      const { data: otCliente } = await admin
        .from('ordenes_trabajo')
        .select('id')
        .eq('id', datosVal.orden_trabajo_id)
        .eq('presupuesto_id', presupuestoId)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (otCliente) ordenTrabajoId = otCliente.id
    } else {
      const { data: otsActivas } = await admin
        .from('ordenes_trabajo')
        .select('id')
        .eq('presupuesto_id', presupuestoId)
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .neq('estado', 'cancelada')
      // Solo auto-vinculamos si hay UNA sola OT viva: si hay varias no
      // sabemos cuál; queda en null y el usuario puede asignarla luego.
      if (otsActivas && otsActivas.length === 1) ordenTrabajoId = otsActivas[0].id
    }

    // Insertar el pago. monto_en_moneda_presupuesto incluye percepciones
    // porque desde el cliente sale igual (forman parte del cobrado real).
    const montoEnPresupuesto = Math.round((monto + montoPercepciones) * cotizacion * 100) / 100
    const { data: pagoCreado, error: errorInsert } = await admin
      .from('presupuesto_pagos')
      .insert({
        empresa_id: empresaId,
        presupuesto_id: presupuestoId,
        cuota_id: cuotaId,
        orden_trabajo_id: ordenTrabajoId,
        monto: String(monto),
        monto_percepciones: String(montoPercepciones),
        moneda,
        cotizacion_cambio: String(cotizacion),
        monto_en_moneda_presupuesto: String(montoEnPresupuesto),
        fecha_pago: fechaPago.toISOString(),
        metodo,
        referencia: datosVal.referencia || null,
        descripcion: datosVal.descripcion || null,
        es_adicional: esAdicional,
        concepto_adicional: conceptoAdicional,
        mensaje_origen_id: datosVal.mensaje_origen_id || null,
        chatter_origen_id: datosVal.chatter_origen_id || null,
        creado_por: user.id,
        creado_por_nombre: nombreUsuario,
      })
      .select('*')
      .single()

    if (errorInsert || !pagoCreado) {
      console.error('Error al insertar pago:', errorInsert)
      return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 })
    }

    // Insertar comprobantes en su tabla
    let comprobantesGuardados: PresupuestoPagoComprobante[] = []
    if (subidos.length > 0) {
      const filas = subidos.map((s) => ({
        empresa_id: empresaId,
        pago_id: pagoCreado.id,
        tipo: s.tipo,
        bucket: s.bucket,
        url: s.url,
        storage_path: s.storagePath,
        nombre: s.nombre,
        mime_tipo: s.mimeTipo,
        tamano_bytes: s.tamanoBytes,
      }))
      const { data: insertados } = await admin
        .from('presupuesto_pago_comprobantes')
        .insert(filas)
        .select('*')
      comprobantesGuardados = (insertados || []) as PresupuestoPagoComprobante[]
    }

    // Obtener info de la cuota para mostrar "Cuota N de M" en la timeline.
    const infoCuota: { numero: number | null; total: number | null; descripcion: string | null } = {
      numero: null,
      total: null,
      descripcion: null,
    }
    if (cuotaId) {
      const { data: todasCuotas } = await admin
        .from('presupuesto_cuotas')
        .select('id, numero, descripcion')
        .eq('presupuesto_id', presupuestoId)
        .eq('empresa_id', empresaId)
        .order('numero', { ascending: true })
      if (todasCuotas) {
        infoCuota.total = todasCuotas.length
        const actual = todasCuotas.find((c) => c.id === cuotaId)
        if (actual) {
          infoCuota.numero = actual.numero
          infoCuota.descripcion = actual.descripcion || null
        }
      }
    }

    // Adjuntos para el chatter — mostramos todos los comprobantes.
    // url va vacía porque el bucket es privado: el frontend pide la signed
    // URL al endpoint de descarga (resuelta on-demand, dura 5 min).
    const adjuntos = comprobantesGuardados.map((c) => ({
      url: '',
      nombre: c.nombre,
      tipo: c.mime_tipo || 'application/octet-stream',
      tamano: c.tamano_bytes || 0,
      endpoint_descarga: `/api/presupuestos/${presupuestoId}/pagos/${pagoCreado.id}/comprobantes/${c.id}/descargar`,
    }))

    const formatoMonto = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: 2,
    }).format(monto)

    const contenido = esAdicional
      ? `Adicional cobrado: ${formatoMonto}${conceptoAdicional ? ` — ${conceptoAdicional}` : ''}`
      : `Pago registrado: ${formatoMonto}${
          datosVal.descripcion ? ` — ${datosVal.descripcion}` : ''
        }`

    await registrarChatter({
      empresaId,
      entidadTipo: 'presupuesto',
      entidadId: presupuestoId,
      contenido,
      autorId: user.id,
      autorNombre: nombreUsuario,
      autorAvatarUrl: perfil?.avatar_url || null,
      adjuntos,
      metadata: {
        accion: 'pago_confirmado',
        cuota_id: cuotaId || undefined,
        monto_pago: String(monto),
        descripcion_pago: datosVal.descripcion || undefined,
        // La timeline del chatter ordena por este campo si está presente,
        // así un pago con fecha anterior a la de carga queda en el lugar correcto.
        fecha_evento: fechaPago.toISOString(),
        pago_id: pagoCreado.id,
        pago_metodo: metodo,
        pago_moneda: moneda,
        pago_fecha: fechaPago.toISOString(),
        // Info de cuota para render "Cuota N de M" en la timeline
        cuota_numero: infoCuota.numero,
        cuotas_total: infoCuota.total,
        cuota_descripcion: infoCuota.descripcion,
        // Marca de adicional + percepciones para que la timeline las muestre
        ...(esAdicional ? { es_adicional: true, concepto_adicional: conceptoAdicional || undefined } : {}),
        ...(montoPercepciones > 0 ? { monto_percepciones: String(montoPercepciones) } : {}),
        // Vínculo al mensaje/correo origen (si el pago se registró desde el chatter).
        // El frontend lo cruza con la entrada del correo para mostrar el chip
        // "Registrado como pago $X" en el correo, evitando que parezca un
        // pago duplicado del que llegó por email.
        ...(datosVal.chatter_origen_id ? { mensaje_origen_chatter_id: datosVal.chatter_origen_id } : {}),
      } as Record<string, unknown>,
    })

    // Auto-transición de estado del presupuesto según completitud de cobro.
    // Los adicionales no entran en el cómputo (cuota_id null + es_adicional)
    // así que esta lógica sigue siendo correcta.
    await sincronizarEstadoPresupuesto({
      admin,
      presupuestoId,
      empresaId,
      usuarioId: user.id,
      usuarioNombre: nombreUsuario,
      razon: 'pago completo registrado',
    })

    return NextResponse.json(
      { ...pagoCreado, comprobantes: comprobantesGuardados },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error al registrar pago:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
