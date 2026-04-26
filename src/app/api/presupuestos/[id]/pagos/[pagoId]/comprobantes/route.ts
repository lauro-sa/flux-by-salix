/**
 * POST — Subir uno o más comprobantes adicionales a un pago existente.
 *        Acepta FormData con `archivos` (File[]) y `tipos_archivos` (JSON
 *        array paralelo, valores 'comprobante' | 'percepcion').
 *
 * Se usa desde el modo "editar pago": el usuario adjuntó algo nuevo
 * (ej. el comprobante de las retenciones) después de haber registrado
 * el pago original.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { validarArchivo, TAMANO_MAXIMO_BYTES, comprimirImagen } from '@/lib/comprimir-imagen'
import { verificarCuotaStorage, registrarUsoStorage } from '@/lib/uso-storage'
import type { PresupuestoPagoComprobante, TipoComprobantePago } from '@/tipos/presupuesto-pago'

const TIPOS_VALIDOS: TipoComprobantePago[] = ['comprobante', 'percepcion']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string }> }
) {
  try {
    const { id: presupuestoId, pagoId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Validar pago
    const { data: pago } = await admin
      .from('presupuesto_pagos')
      .select('id')
      .eq('id', pagoId)
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

    const fd = await request.formData()
    const archivos = fd.getAll('archivos').filter((x): x is File => x instanceof File)
    if (archivos.length === 0) {
      return NextResponse.json({ error: 'No se enviaron archivos' }, { status: 400 })
    }

    let tipos: string[] = []
    const tiposJson = fd.get('tipos_archivos')
    if (typeof tiposJson === 'string') {
      try { tipos = JSON.parse(tiposJson) } catch { /* ignore */ }
    }

    const insertados: PresupuestoPagoComprobante[] = []

    for (let i = 0; i < archivos.length; i++) {
      const f = archivos[i]
      const tipoRaw = (tipos[i] as TipoComprobantePago) || 'comprobante'
      const tipo: TipoComprobantePago = TIPOS_VALIDOS.includes(tipoRaw) ? tipoRaw : 'comprobante'

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

      const { error: uploadError } = await admin.storage
        .from('documentos-pdf')
        .upload(storagePath, buffer, { contentType: mimeFinal, upsert: false })

      if (uploadError) {
        return NextResponse.json({ error: `Error al subir comprobante: ${uploadError.message}` }, { status: 500 })
      }

      const { data: urlData } = admin.storage.from('documentos-pdf').getPublicUrl(storagePath)
      registrarUsoStorage(empresaId, 'documentos-pdf', buffer.length)

      const { data: fila, error: errorInsert } = await admin
        .from('presupuesto_pago_comprobantes')
        .insert({
          empresa_id: empresaId,
          pago_id: pagoId,
          tipo,
          url: urlData.publicUrl,
          storage_path: storagePath,
          nombre: f.name,
          mime_tipo: mimeFinal,
          tamano_bytes: buffer.length,
        })
        .select('*')
        .single()

      if (errorInsert || !fila) {
        return NextResponse.json({ error: 'Error al guardar comprobante' }, { status: 500 })
      }
      insertados.push(fila as PresupuestoPagoComprobante)
    }

    return NextResponse.json({ comprobantes: insertados }, { status: 201 })
  } catch (err) {
    console.error('Error al subir comprobantes:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
