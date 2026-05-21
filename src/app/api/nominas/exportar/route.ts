import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

/**
 * GET /api/nominas/exportar — Exportar la nómina del período como Excel (.xlsx).
 *
 * Sustituye al uso anterior de `/api/asistencias/exportar` desde el módulo
 * Nóminas. Ese endpoint exporta el detalle día-a-día de asistencias y
 * pertenece conceptualmente al módulo Asistencias. Acá exportamos lo que
 * de verdad le interesa a un encargado de nóminas: por cada empleado del
 * período, sueldo bruto, descuentos, adelantos, saldo anterior y neto.
 *
 * Implementación: hace un fetch interno a /api/nominas (mismo período,
 * sin filtros de empleados) y arma el Excel desde los resultados. Eso
 * garantiza que el Excel siempre cuadre con lo que la grilla muestra.
 *
 * Query params: desde, hasta (YYYY-MM-DD), periodo (mes|quincena|semana, opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('nomina', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')
    const periodo = params.get('periodo') ?? ''
    if (!desde || !hasta) {
      return NextResponse.json({ error: 'desde y hasta requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const { data: empresa } = await admin
      .from('empresas')
      .select('nombre')
      .eq('id', empresaId)
      .single()
    const nombreEmpresa = empresa?.nombre || 'Empresa'

    // Fetch interno al listado para no duplicar el motor de cálculo.
    // Reusa la cookie de auth del request.
    const url = new URL(`/api/nominas?desde=${desde}&hasta=${hasta}${periodo ? `&periodo=${periodo}` : ''}`, request.url)
    const cookie = request.headers.get('cookie') ?? ''
    const r = await fetch(url, { headers: { cookie }, cache: 'no-store' })
    if (!r.ok) {
      return NextResponse.json({ error: 'No se pudo obtener el listado' }, { status: 500 })
    }
    const data = await r.json() as { resultados?: Array<Record<string, unknown>> }
    const resultados = data.resultados ?? []

    // ─── Generar Excel ───
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Flux by Salix'
    const ws = wb.addWorksheet('Nómina')

    // Título
    ws.mergeCells('A1:J1')
    const titulo = ws.getCell('A1')
    titulo.value = `Nómina — ${nombreEmpresa} (${desde} a ${hasta})`
    titulo.font = { size: 14, bold: true }
    titulo.alignment = { vertical: 'middle' }
    ws.getRow(1).height = 30

    // Cabezales
    const headers = [
      'Empleado',
      'Estado',
      'Días trabajados',
      'Días ausentes',
      'Horas netas',
      'Sueldo bruto',
      'Descuento adelanto',
      'Saldo anterior',
      'Neto a cobrar',
      'Fecha pago',
    ]
    const headerRow = ws.addRow(headers)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 25

    // Anchos por columna
    ws.getColumn(1).width = 26
    ws.getColumn(2).width = 14
    ws.getColumn(3).width = 16
    ws.getColumn(4).width = 14
    ws.getColumn(5).width = 14
    ws.getColumn(6).width = 16
    ws.getColumn(7).width = 18
    ws.getColumn(8).width = 16
    ws.getColumn(9).width = 16
    ws.getColumn(10).width = 14

    const ETIQUETA_ESTADO: Record<string, string> = {
      borrador: 'Borrador',
      liquidado: 'Liquidado',
      enviado: 'Enviado',
      pagado: 'Pagado',
    }

    // Filas
    for (const r of resultados) {
      const estado = String(r.estado_liquidacion ?? 'borrador')
      const row = ws.addRow([
        String(r.nombre ?? 'Sin nombre'),
        ETIQUETA_ESTADO[estado] ?? estado,
        Number(r.dias_trabajados ?? 0),
        Number(r.dias_ausentes ?? 0),
        Number(r.horas_netas ?? 0),
        Number(r.monto_pagar ?? 0),
        Number(r.descuento_adelanto ?? 0),
        Number(r.saldo_anterior ?? 0),
        Number(r.monto_neto ?? 0),
        r.pagado_en ? String(r.pagado_en).slice(0, 10) : '',
      ])
      row.alignment = { vertical: 'middle' }

      // Color de fondo según estado de la liquidación.
      if (estado === 'pagado') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      } else if (estado === 'liquidado' || estado === 'enviado') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
      }
    }

    // Total al pie
    if (resultados.length > 0) {
      const filaInicio = 3 // 1 = título, 2 = headers, 3 = primera fila de datos
      const filaFin = filaInicio + resultados.length - 1
      const totalRow = ws.addRow([
        'TOTAL',
        '',
        '',
        '',
        { formula: `SUM(E${filaInicio}:E${filaFin})` },
        { formula: `SUM(F${filaInicio}:F${filaFin})` },
        { formula: `SUM(G${filaInicio}:G${filaFin})` },
        { formula: `SUM(H${filaInicio}:H${filaFin})` },
        { formula: `SUM(I${filaInicio}:I${filaFin})` },
        '',
      ])
      totalRow.font = { bold: true }
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }
    }

    const buffer = await wb.xlsx.writeBuffer()
    const filename = `nomina_${nombreEmpresa.replace(/\s+/g, '_')}_${desde}_${hasta}.xlsx`

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
