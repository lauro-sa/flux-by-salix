import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'
import { ETIQUETA_METODO } from '@/lib/constantes/asistencias'
import { resolverNombresMiembros } from '@/lib/miembros/nombres'

// i18n: estos headers deberían respetar el idioma del usuario cuando se implemente i18n server-side
const ENCABEZADOS_EXCEL = ['Empleado', 'Fecha', 'Entrada', 'Salida', 'Duración', 'Estado', 'Tipo', 'Método', 'Notas'] as const

/**
 * GET /api/asistencias/exportar — Exportar asistencias como Excel (.xlsx).
 * Query params: desde, hasta (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    // Exportar datos del equipo requiere ver_todos
    const guard = await requerirPermisoAPI('asistencias', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')

    const admin = crearClienteAdmin()

    // Empresa
    const { data: empresa } = await admin
      .from('empresas')
      .select('nombre, formato_hora')
      .eq('id', empresaId)
      .single()

    const nombreEmpresa = empresa?.nombre || 'Empresa'
    const fmt24 = empresa?.formato_hora !== '12h'

    // Nombres de miembros (perfil con fallback a contacto equipo)
    const miembroNombres = await resolverNombresMiembros(admin, empresaId)

    // Asistencias
    let query = admin
      .from('asistencias')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false })
      .order('hora_entrada', { ascending: false })
      .limit(5000)

    if (desde) query = query.gte('fecha', desde)
    if (hasta) query = query.lte('fecha', hasta)

    const { data: asistencias } = await query

    // Crear Excel
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Flux by Salix'
    const ws = wb.addWorksheet('Asistencias')

    // Título
    ws.mergeCells('A1:I1')
    const titulo = ws.getCell('A1')
    titulo.value = `Asistencias — ${nombreEmpresa}${desde && hasta ? ` (${desde} a ${hasta})` : ''}`
    titulo.font = { size: 14, bold: true }
    titulo.alignment = { vertical: 'middle' }
    ws.getRow(1).height = 30

    // Headers
    const headers = [...ENCABEZADOS_EXCEL]
    const headerRow = ws.addRow(headers)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 25

    // Anchos
    ws.getColumn(1).width = 25  // Empleado
    ws.getColumn(2).width = 14  // Fecha
    ws.getColumn(3).width = 10  // Entrada
    ws.getColumn(4).width = 10  // Salida
    ws.getColumn(5).width = 12  // Duración
    ws.getColumn(6).width = 14  // Estado
    ws.getColumn(7).width = 12  // Tipo
    ws.getColumn(8).width = 12  // Método
    ws.getColumn(9).width = 30  // Notas

    const fmtHora = (iso: unknown): string => {
      if (!iso || typeof iso !== 'string') return ''
      const d = new Date(iso)
      if (fmt24) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      const h = d.getHours() % 12 || 12
      const ampm = d.getHours() < 12 ? 'AM' : 'PM'
      return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`
    }

    const calcDuracion = (entrada: unknown, salida: unknown): string => {
      if (!entrada || !salida || typeof entrada !== 'string' || typeof salida !== 'string') return ''
      const min = Math.round((new Date(salida).getTime() - new Date(entrada).getTime()) / 60000)
      if (min < 0) return ''
      const h = Math.floor(min / 60)
      const m = min % 60
      if (h === 0) return `${m}min`
      return m > 0 ? `${h}h ${m}min` : `${h}h`
    }

    const ETIQUETA_ESTADO: Record<string, string> = {
      activo: 'En turno', cerrado: 'Cerrado', auto_cerrado: 'Sin salida',
      ausente: 'Ausente', almuerzo: 'Almorzando', particular: 'Trámite',
    }

    // Filas
    for (const a of (asistencias || [])) {
      const r = a as Record<string, unknown>
      const row = ws.addRow([
        miembroNombres.get(r.miembro_id as string) || 'Sin nombre',
        r.fecha,
        fmtHora(r.hora_entrada),
        fmtHora(r.hora_salida),
        calcDuracion(r.hora_entrada, r.hora_salida),
        ETIQUETA_ESTADO[r.estado as string] || r.estado,
        (r.tipo as string)?.charAt(0).toUpperCase() + (r.tipo as string)?.slice(1),
        ETIQUETA_METODO[r.metodo_registro as string] || r.metodo_registro,
        r.notas || '',
      ])
      row.alignment = { vertical: 'middle' }

      // Color de fondo según estado
      if (r.estado === 'ausente') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } }
      } else if (r.estado === 'auto_cerrado') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
      }
    }

    // Generar buffer
    const buffer = await wb.xlsx.writeBuffer()

    const filename = `asistencias_${nombreEmpresa.replace(/\s+/g, '_')}${desde ? `_${desde}` : ''}${hasta ? `_${hasta}` : ''}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
