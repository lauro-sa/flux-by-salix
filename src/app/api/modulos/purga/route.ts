import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/modulos/purga — Ejecutar purga de módulos vencidos.
 * Llamado por un cron externo (Vercel Cron, etc.)
 * Protegido por CRON_SECRET en headers.
 *
 * Lógica:
 * 1. Busca módulos desactivados cuya purga_programada_en ya pasó
 * 2. Marca como purgado = true (los datos se pueden limpiar en un paso futuro)
 * 3. Elimina el registro de modulos_empresa (el módulo desaparece del historial)
 *
 * NOTA: La eliminación real de datos (presupuestos, visitas, etc.) se implementará
 * cuando haya más módulos con datos pesados. Por ahora solo limpiamos el registro.
 */
export async function POST(request: NextRequest) {
  // Verificar secret del cron
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const admin = crearClienteAdmin()

    // 1. Buscar módulos con purga vencida
    const { data: modulosParaPurgar, error: errBuscar } = await admin
      .from('modulos_empresa')
      .select('id, empresa_id, modulo, desactivado_en, purga_programada_en')
      .eq('activo', false)
      .eq('purgado', false)
      .not('purga_programada_en', 'is', null)
      .lte('purga_programada_en', new Date().toISOString())

    if (errBuscar) throw errBuscar

    if (!modulosParaPurgar || modulosParaPurgar.length === 0) {
      return NextResponse.json({ purgados: 0, mensaje: 'Sin módulos para purgar' })
    }

    // 2. Marcar como purgados
    const ids = modulosParaPurgar.map(m => m.id)
    const { error: errPurgar } = await admin
      .from('modulos_empresa')
      .update({ purgado: true })
      .in('id', ids)

    if (errPurgar) throw errPurgar

    // 3. Log de lo que se purgó
    const resumen = modulosParaPurgar.map(m => ({
      empresa_id: m.empresa_id,
      modulo: m.modulo,
      desactivado_en: m.desactivado_en,
    }))

    console.info(`[PURGA] ${resumen.length} módulos purgados:`, JSON.stringify(resumen))

    return NextResponse.json({
      purgados: resumen.length,
      detalle: resumen,
    })
  } catch (err) {
    console.error('Error en purga de módulos:', err)
    return NextResponse.json({ error: 'Error al ejecutar purga' }, { status: 500 })
  }
}
