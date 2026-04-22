/**
 * API Route: GET /api/ia/metricas
 * Devuelve métricas agregadas de uso de IA para la empresa del usuario.
 * Query params:
 *   - mes: YYYY-MM (default: mes actual)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

interface FilaLog {
  tokens_entrada: number
  tokens_salida: number
  canal: string
  modelo: string
  proveedor: string
  herramientas_usadas: string[]
  exito: boolean
  usuario_id: string
}

interface MetricasTotales {
  tokens_entrada: number
  tokens_salida: number
  total_solicitudes: number
  usuarios_unicos: number
  tasa_exito: number
}

interface DesglosePorModelo {
  modelo: string
  proveedor: string
  tokens_entrada: number
  tokens_salida: number
  solicitudes: number
}

interface DesglosePorCanal {
  canal: string
  tokens_entrada: number
  tokens_salida: number
  solicitudes: number
}

interface HerramientaUso {
  herramienta: string
  usos: number
}

function obtenerRangoMes(mesStr: string): { desde: string; hasta: string } {
  const [anio, mes] = mesStr.split('-').map(Number)
  const desde = new Date(Date.UTC(anio, mes - 1, 1)).toISOString()
  // Primer día del mes siguiente
  const hasta = new Date(Date.UTC(anio, mes, 1)).toISOString()
  return { desde, hasta }
}

function agregarFilas(filas: FilaLog[]) {
  const totales: MetricasTotales = {
    tokens_entrada: 0,
    tokens_salida: 0,
    total_solicitudes: filas.length,
    usuarios_unicos: new Set(filas.map(f => f.usuario_id)).size,
    tasa_exito: filas.length > 0
      ? (filas.filter(f => f.exito).length / filas.length) * 100
      : 100,
  }

  const porModeloMap = new Map<string, DesglosePorModelo>()
  const porCanalMap = new Map<string, DesglosePorCanal>()
  const herramientasMap = new Map<string, number>()

  for (const fila of filas) {
    const te = fila.tokens_entrada ?? 0
    const ts = fila.tokens_salida ?? 0
    totales.tokens_entrada += te
    totales.tokens_salida += ts

    // Por modelo
    const claveModelo = fila.modelo || 'desconocido'
    const existeModelo = porModeloMap.get(claveModelo)
    if (existeModelo) {
      existeModelo.tokens_entrada += te
      existeModelo.tokens_salida += ts
      existeModelo.solicitudes += 1
    } else {
      porModeloMap.set(claveModelo, {
        modelo: claveModelo,
        proveedor: fila.proveedor || 'desconocido',
        tokens_entrada: te,
        tokens_salida: ts,
        solicitudes: 1,
      })
    }

    // Por canal
    const canal = fila.canal || 'app'
    const existeCanal = porCanalMap.get(canal)
    if (existeCanal) {
      existeCanal.tokens_entrada += te
      existeCanal.tokens_salida += ts
      existeCanal.solicitudes += 1
    } else {
      porCanalMap.set(canal, {
        canal,
        tokens_entrada: te,
        tokens_salida: ts,
        solicitudes: 1,
      })
    }

    // Herramientas
    if (fila.herramientas_usadas?.length) {
      for (const h of fila.herramientas_usadas) {
        herramientasMap.set(h, (herramientasMap.get(h) || 0) + 1)
      }
    }
  }

  const por_modelo = Array.from(porModeloMap.values())
    .sort((a, b) => (b.tokens_entrada + b.tokens_salida) - (a.tokens_entrada + a.tokens_salida))

  const por_canal = Array.from(porCanalMap.values())
    .sort((a, b) => b.solicitudes - a.solicitudes)

  const top_herramientas: HerramientaUso[] = Array.from(herramientasMap.entries())
    .map(([herramienta, usos]) => ({ herramienta, usos }))
    .sort((a, b) => b.usos - a.usos)
    .slice(0, 8)

  return { totales, por_modelo, por_canal, top_herramientas }
}

export async function GET(request: NextRequest) {
  const guard = await requerirPermisoAPI('auditoria', 'ver')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId: empresa_id } = guard

  // Determinar mes solicitado
  const mesParam = request.nextUrl.searchParams.get('mes')
  const ahora = new Date()
  const mesActualStr = mesParam || `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`

  // Calcular mes anterior
  const [anio, mes] = mesActualStr.split('-').map(Number)
  const mesAnteriorDate = new Date(Date.UTC(anio, mes - 2, 1))
  const mesAnteriorStr = `${mesAnteriorDate.getFullYear()}-${String(mesAnteriorDate.getMonth() + 1).padStart(2, '0')}`

  const rangoActual = obtenerRangoMes(mesActualStr)
  const rangoAnterior = obtenerRangoMes(mesAnteriorStr)

  const admin = crearClienteAdmin()
  const columnas = 'tokens_entrada, tokens_salida, canal, modelo, proveedor, herramientas_usadas, exito, usuario_id'

  // Fetch en paralelo: mes actual y mes anterior
  const [resActual, resAnterior] = await Promise.all([
    admin
      .from('log_salix_ia')
      .select(columnas)
      .eq('empresa_id', empresa_id)
      .gte('creado_en', rangoActual.desde)
      .lt('creado_en', rangoActual.hasta),
    admin
      .from('log_salix_ia')
      .select('tokens_entrada, tokens_salida, exito, usuario_id')
      .eq('empresa_id', empresa_id)
      .gte('creado_en', rangoAnterior.desde)
      .lt('creado_en', rangoAnterior.hasta),
  ])

  const filasActual = (resActual.data || []) as unknown as FilaLog[]
  const filasAnterior = (resAnterior.data || []) as unknown as Pick<FilaLog, 'tokens_entrada' | 'tokens_salida' | 'exito' | 'usuario_id'>[]

  const actual = agregarFilas(filasActual)

  // Totales del mes anterior (simplificado)
  const mesAnteriorTotales = {
    tokens_entrada: filasAnterior.reduce((s, f) => s + (f.tokens_entrada ?? 0), 0),
    tokens_salida: filasAnterior.reduce((s, f) => s + (f.tokens_salida ?? 0), 0),
    total_solicitudes: filasAnterior.length,
  }

  return NextResponse.json({
    mes: mesActualStr,
    mes_actual: actual.totales,
    mes_anterior: mesAnteriorTotales,
    por_modelo: actual.por_modelo,
    por_canal: actual.por_canal,
    top_herramientas: actual.top_herramientas,
  })
}
