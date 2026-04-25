/**
 * Endpoints de pagos de un presupuesto.
 * GET  — listar todos los pagos del presupuesto
 * POST — registrar un pago nuevo. Acepta JSON o FormData (con comprobante).
 *        Crea entrada en chatter automáticamente.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { registrarChatter } from '@/lib/chatter'
import { sincronizarEstadoPresupuesto } from '@/lib/presupuesto-auto-transicion'
import { validarArchivo, TAMANO_MAXIMO_BYTES, comprimirImagen } from '@/lib/comprimir-imagen'
import { verificarCuotaStorage, registrarUsoStorage } from '@/lib/uso-storage'
import type { MetodoPago } from '@/tipos/presupuesto-pago'

const METODOS_VALIDOS: MetodoPago[] = ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'deposito', 'otro']

export async function GET(
  _request: NextRequest,
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

    const { data: pagos, error } = await admin
      .from('presupuesto_pagos')
      .select('*')
      .eq('presupuesto_id', id)
      .eq('empresa_id', empresaId)
      .order('fecha_pago', { ascending: false })

    if (error) {
      console.error('Error al listar pagos:', error)
      return NextResponse.json({ error: 'Error al listar' }, { status: 500 })
    }

    return NextResponse.json({ pagos: pagos || [] })
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

    // Aceptar JSON o FormData (con comprobante)
    const contentType = request.headers.get('content-type') || ''
    let datos: Record<string, unknown> = {}
    let archivo: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData()
      const archivoField = fd.get('archivo')
      archivo = archivoField instanceof File ? archivoField : null
      const datosJson = fd.get('datos')
      if (typeof datosJson === 'string') datos = JSON.parse(datosJson)
    } else {
      datos = await request.json()
    }

    // Validaciones
    const monto = Number(datos.monto)
    if (!isFinite(monto) || monto <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
    }
    const metodo = (datos.metodo as MetodoPago) || 'transferencia'
    if (!METODOS_VALIDOS.includes(metodo)) {
      return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })
    }
    const moneda = (datos.moneda as string) || presupuesto.moneda || 'ARS'
    const cotizacion = Number(datos.cotizacion_cambio) || 1
    if (cotizacion <= 0) return NextResponse.json({ error: 'Cotización inválida' }, { status: 400 })

    const fechaPago = datos.fecha_pago ? new Date(datos.fecha_pago as string) : new Date()
    if (isNaN(fechaPago.getTime())) {
      return NextResponse.json({ error: 'Fecha de pago inválida' }, { status: 400 })
    }
    if (fechaPago.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'La fecha del pago no puede ser futura' }, { status: 400 })
    }

    // Validar cuota_id. Soporta IDs reales (uuid) y sintéticos (formato
    // "sintetico-N") generados en el GET cuando la condición de pago es de
    // tipo "hitos" pero todavía no se materializaron las cuotas en BD.
    // Si llega un ID sintético, primero materializamos todas las cuotas
    // según la configuración y mapeamos al ID real correspondiente.
    let cuotaId = (datos.cuota_id as string | null | undefined) || null

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

    // Subir comprobante si vino archivo
    let comprobanteUrl: string | null = null
    let comprobanteStoragePath: string | null = null
    let comprobanteNombre: string | null = null
    let comprobanteTipo: string | null = null
    let comprobanteTamanoBytes: number | null = null

    if (archivo) {
      const errorValidacion = validarArchivo(archivo.type, archivo.size, TAMANO_MAXIMO_BYTES)
      if (errorValidacion) return NextResponse.json({ error: errorValidacion }, { status: 400 })

      const errorCuota = await verificarCuotaStorage(empresaId, archivo.size)
      if (errorCuota) return NextResponse.json({ error: errorCuota }, { status: 413 })

      const bufferOriginal = Buffer.from(await archivo.arrayBuffer())
      const { buffer, tipo } = await comprimirImagen(bufferOriginal, archivo.type, {
        anchoMaximo: 1600,
        calidad: 80,
      })

      const nombreBase = archivo.name.replace(/\.[^.]+$/, '')
      const extension = tipo === 'image/webp' ? '.webp'
        : tipo === 'image/jpeg' && archivo.type !== 'image/jpeg' ? '.jpg'
        : `.${archivo.name.split('.').pop()}`
      const nombreFinal = `${nombreBase}${extension}`.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${empresaId}/presupuesto-pagos/${presupuestoId}/${Date.now()}_${nombreFinal}`

      const { error: uploadError } = await admin.storage
        .from('documentos-pdf')
        .upload(storagePath, buffer, { contentType: tipo, upsert: false })

      if (uploadError) {
        return NextResponse.json({ error: `Error al subir comprobante: ${uploadError.message}` }, { status: 500 })
      }

      const { data: urlData } = admin.storage.from('documentos-pdf').getPublicUrl(storagePath)
      comprobanteUrl = urlData.publicUrl
      comprobanteStoragePath = storagePath
      comprobanteNombre = archivo.name
      comprobanteTipo = tipo
      comprobanteTamanoBytes = buffer.length
      registrarUsoStorage(empresaId, 'documentos-pdf', buffer.length)
    }

    // Nombre del usuario
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, avatar_url')
      .eq('id', user.id)
      .single()
    const nombreUsuario = perfil ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() : 'Usuario'

    // Insertar el pago
    const montoEnPresupuesto = monto * cotizacion
    const { data: pagoCreado, error: errorInsert } = await admin
      .from('presupuesto_pagos')
      .insert({
        empresa_id: empresaId,
        presupuesto_id: presupuestoId,
        cuota_id: cuotaId,
        monto: String(monto),
        moneda,
        cotizacion_cambio: String(cotizacion),
        monto_en_moneda_presupuesto: String(montoEnPresupuesto),
        fecha_pago: fechaPago.toISOString(),
        metodo,
        referencia: (datos.referencia as string) || null,
        descripcion: (datos.descripcion as string) || null,
        comprobante_url: comprobanteUrl,
        comprobante_storage_path: comprobanteStoragePath,
        comprobante_nombre: comprobanteNombre,
        comprobante_tipo: comprobanteTipo,
        comprobante_tamano_bytes: comprobanteTamanoBytes,
        mensaje_origen_id: (datos.mensaje_origen_id as string) || null,
        chatter_origen_id: (datos.chatter_origen_id as string) || null,
        creado_por: user.id,
        creado_por_nombre: nombreUsuario,
      })
      .select('*')
      .single()

    if (errorInsert || !pagoCreado) {
      console.error('Error al insertar pago:', errorInsert)
      return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 })
    }

    // Obtener info de la cuota para mostrar "Cuota N de M" en la timeline.
    // `cuotaId` ya puede ser el id real (nuevo o preexistente). Buscamos el
    // número + descripción + total de cuotas del presupuesto.
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

    // Registrar entrada en chatter (con el comprobante como adjunto si lo hay)
    const adjuntos = comprobanteUrl
      ? [{
          url: comprobanteUrl,
          nombre: comprobanteNombre || 'comprobante',
          tipo: comprobanteTipo || 'application/octet-stream',
          tamano: comprobanteTamanoBytes || 0,
        }]
      : []

    const formatoMonto = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: 2,
    }).format(monto)

    const contenido = `Pago registrado: ${formatoMonto}${
      datos.descripcion ? ` — ${datos.descripcion as string}` : ''
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
        descripcion_pago: (datos.descripcion as string) || undefined,
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
      },
    })

    // Auto-transición de estado del presupuesto según completitud de cobro
    await sincronizarEstadoPresupuesto({
      admin,
      presupuestoId,
      empresaId,
      usuarioId: user.id,
      usuarioNombre: nombreUsuario,
      razon: 'pago completo registrado',
    })

    return NextResponse.json(pagoCreado, { status: 201 })
  } catch (err) {
    console.error('Error al registrar pago:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
