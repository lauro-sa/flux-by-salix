'use client'

/**
 * PanelUsoIA — Dashboard de consumo de IA por empresa.
 * Muestra métricas del mes actual: costo estimado, tokens, solicitudes,
 * desglose por modelo/canal/herramientas, y enlace a facturación.
 */

import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, Minus,
  BarChart3, MessageSquare, Wrench, ExternalLink,
  Smartphone, Globe, Bot, Sparkles,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { useEmpresa } from '@/hooks/useEmpresa'
import {
  calcularCostoEstimado,
  formatearTokens,
  formatearCosto,
  ENLACES_FACTURACION,
  PRECIOS_MODELOS,
} from '@/lib/ia/precios'
import { TarjetaSaldoIA } from '@/componentes/ia/TarjetaSaldoIA'

// ==================== TIPOS ====================

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

interface MetricasIA {
  mes: string
  mes_actual: MetricasTotales
  mes_anterior: { tokens_entrada: number; tokens_salida: number; total_solicitudes: number }
  por_modelo: DesglosePorModelo[]
  por_canal: DesglosePorCanal[]
  top_herramientas: HerramientaUso[]
}

// ==================== UTILIDADES ====================

const ICONOS_CANAL: Record<string, typeof Smartphone> = {
  app: Smartphone,
  whatsapp: IconoWhatsApp as unknown as typeof Smartphone,
  web: Globe,
  api: Bot,
}

const NOMBRES_CANAL: Record<string, string> = {
  app: 'App',
  whatsapp: 'WhatsApp',
  web: 'Web',
  api: 'API',
}

/** Nombre legible de herramienta: buscar_contactos → Buscar contactos */
function nombreHerramienta(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

/** Calcula % de cambio entre dos valores */
function porcentajeCambio(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual > 0 ? 100 : null
  return ((actual - anterior) / anterior) * 100
}

// ==================== COMPONENTE PRINCIPAL ====================

export function PanelUsoIA({ proveedorActivo, nombreProveedor }: { proveedorActivo: string; nombreProveedor: string }) {
  const { empresa } = useEmpresa()
  const [metricas, setMetricas] = useState<MetricasIA | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!empresa) return
    const cargar = async () => {
      setCargando(true)
      try {
        const res = await fetch('/api/ia/metricas')
        if (res.ok) {
          const datos = await res.json()
          setMetricas(datos)
        }
      } catch {
        // Silenciar error de red
      }
      setCargando(false)
    }
    cargar()
  }, [empresa])

  if (cargando) return <EsqueletoPanel />

  if (!metricas || metricas.mes_actual.total_solicitudes === 0) {
    return (
      <div className="space-y-5">
        {/* Saldo aunque no haya consumo todavía */}
        <TarjetaSaldoIA
          proveedorActivo={proveedorActivo}
          nombreProveedor={nombreProveedor}
          costoEstimadoMes={0}
        />
        <EstadoSinDatos proveedorActivo={proveedorActivo} />
      </div>
    )
  }

  // Cálculos
  const costoActual = metricas.por_modelo.reduce(
    (acc, m) => acc + calcularCostoEstimado(m.modelo, m.tokens_entrada, m.tokens_salida), 0
  )
  const costoAnterior = calcularCostoEstimado(
    // Aproximación: usar distribución proporcional del mes anterior
    metricas.por_modelo[0]?.modelo || '',
    metricas.mes_anterior.tokens_entrada,
    metricas.mes_anterior.tokens_salida,
  )

  const tokensTotal = metricas.mes_actual.tokens_entrada + metricas.mes_actual.tokens_salida
  const tokensAnterior = metricas.mes_anterior.tokens_entrada + metricas.mes_anterior.tokens_salida

  // Costo del proveedor activo (para la tarjeta de saldo)
  const costoProveedorActivo = metricas.por_modelo
    .filter(m => m.proveedor === proveedorActivo)
    .reduce((acc, m) => acc + calcularCostoEstimado(m.modelo, m.tokens_entrada, m.tokens_salida), 0)

  const enlace = ENLACES_FACTURACION[proveedorActivo]

  return (
    <div className="space-y-5">
      {/* Saldo del proveedor activo */}
      <TarjetaSaldoIA
        proveedorActivo={proveedorActivo}
        nombreProveedor={nombreProveedor}
        costoEstimadoMes={costoProveedorActivo}
      />

      {/* Tarjetas principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TarjetaMetrica
          etiqueta="Costo estimado"
          valor={formatearCosto(costoActual)}
          cambio={porcentajeCambio(costoActual, costoAnterior)}
          invertido // Subir costo = malo
        />
        <TarjetaMetrica
          etiqueta="Tokens usados"
          valor={formatearTokens(tokensTotal)}
          cambio={porcentajeCambio(tokensTotal, tokensAnterior)}
        />
        <TarjetaMetrica
          etiqueta="Consultas"
          valor={metricas.mes_actual.total_solicitudes.toLocaleString('es-AR')}
          cambio={porcentajeCambio(metricas.mes_actual.total_solicitudes, metricas.mes_anterior.total_solicitudes)}
        />
        <TarjetaMetrica
          etiqueta="Tasa de éxito"
          valor={`${metricas.mes_actual.tasa_exito.toFixed(1)}%`}
        />
      </div>

      {/* Desglose por modelo */}
      {metricas.por_modelo.length > 0 && (
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-texto-terciario" />
            <h3 className="text-sm font-semibold text-texto-primario">Consumo por modelo</h3>
          </div>
          <div className="space-y-3">
            {metricas.por_modelo.map(m => {
              const total = m.tokens_entrada + m.tokens_salida
              const maximo = metricas.por_modelo[0].tokens_entrada + metricas.por_modelo[0].tokens_salida
              const porcentaje = maximo > 0 ? (total / maximo) * 100 : 0
              const costo = calcularCostoEstimado(m.modelo, m.tokens_entrada, m.tokens_salida)
              const tienePrecios = !!PRECIOS_MODELOS[m.modelo]

              return (
                <div key={m.modelo}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-texto-primario">{m.modelo}</span>
                      <span className="text-xs text-texto-terciario">{m.solicitudes} consultas</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-texto-terciario">{formatearTokens(total)} tokens</span>
                      <span className="text-xs font-medium text-texto-primario">
                        {tienePrecios ? `~${formatearCosto(costo)}` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-superficie-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-texto-marca rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(porcentaje, 2)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Desglose por canal + Herramientas — lado a lado en desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Por canal */}
        {metricas.por_canal.length > 0 && (
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-texto-terciario" />
              <h3 className="text-sm font-semibold text-texto-primario">Por canal</h3>
            </div>
            <div className="space-y-2.5">
              {metricas.por_canal.map(c => {
                const Icono = ICONOS_CANAL[c.canal] || Sparkles
                const nombre = NOMBRES_CANAL[c.canal] || c.canal
                return (
                  <div key={c.canal} className="flex items-center gap-3 p-2.5 rounded-card bg-superficie-hover/50">
                    <div className="w-8 h-8 rounded-popover bg-superficie-elevada flex items-center justify-center shrink-0">
                      <Icono size={16} className="text-texto-terciario" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-texto-primario block">{nombre}</span>
                      <span className="text-xs text-texto-terciario">{formatearTokens(c.tokens_entrada + c.tokens_salida)} tokens</span>
                    </div>
                    <span className="text-sm font-semibold text-texto-primario">{c.solicitudes}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Herramientas más usadas */}
        {metricas.top_herramientas.length > 0 && (
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench size={16} className="text-texto-terciario" />
              <h3 className="text-sm font-semibold text-texto-primario">Herramientas más usadas</h3>
            </div>
            <div className="space-y-2">
              {metricas.top_herramientas.map((h, i) => {
                const maximo = metricas.top_herramientas[0].usos
                const porcentaje = maximo > 0 ? (h.usos / maximo) * 100 : 0
                return (
                  <div key={h.herramienta}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-texto-secundario">{nombreHerramienta(h.herramienta)}</span>
                      <span className="text-xs font-medium text-texto-terciario">{h.usos}</span>
                    </div>
                    <div className="h-1.5 bg-superficie-hover rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(porcentaje, 3)}%`,
                          backgroundColor: i === 0 ? 'var(--texto-marca)' : 'var(--texto-terciario)',
                          opacity: i === 0 ? 1 : 0.5,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Enlace a facturación del proveedor activo */}
      {enlace && (
        <a
          href={enlace.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-card border border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-hover/50 transition-colors no-underline group"
        >
          <div className="w-9 h-9 rounded-card bg-texto-marca/10 flex items-center justify-center shrink-0">
            <ExternalLink size={16} className="text-texto-marca" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-texto-primario block group-hover:text-texto-marca transition-colors">
              Ver saldo y recargar crédito
            </span>
            <span className="text-xs text-texto-terciario">{enlace.etiqueta}</span>
          </div>
          <ExternalLink size={14} className="text-texto-terciario group-hover:text-texto-marca transition-colors shrink-0" />
        </a>
      )}

      {/* Info de usuarios */}
      <p className="text-xs text-texto-terciario text-center">
        {metricas.mes_actual.usuarios_unicos} usuario{metricas.mes_actual.usuarios_unicos !== 1 ? 's' : ''} usaron IA este mes · Los costos son estimados basados en precios públicos
      </p>
    </div>
  )
}

// ==================== TARJETA DE MÉTRICA ====================

function TarjetaMetrica({
  etiqueta,
  valor,
  cambio,
  invertido = false,
}: {
  etiqueta: string
  valor: string
  cambio?: number | null
  invertido?: boolean
}) {
  const tieneComparacion = cambio !== null && cambio !== undefined

  // Si invertido (costo), subir es malo (rojo), bajar es bueno (verde)
  const esPositivo = tieneComparacion
    ? invertido ? cambio < 0 : cambio > 0
    : null

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4">
      <p className="text-xs text-texto-terciario mb-1">{etiqueta}</p>
      <p className="text-xl font-bold text-texto-primario">{valor}</p>
      {tieneComparacion && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${
          esPositivo ? 'text-insignia-exito' : cambio === 0 ? 'text-texto-terciario' : 'text-insignia-peligro'
        }`}>
          {cambio > 0 ? <TrendingUp size={12} /> : cambio < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span>{Math.abs(cambio).toFixed(0)}% vs mes anterior</span>
        </div>
      )}
    </div>
  )
}

// ==================== ESQUELETO DE CARGA ====================

function EsqueletoPanel() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4">
            <div className="h-3 w-16 bg-superficie-hover rounded mb-2" />
            <div className="h-6 w-20 bg-superficie-hover rounded mb-1.5" />
            <div className="h-3 w-24 bg-superficie-hover rounded" />
          </div>
        ))}
      </div>
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5">
        <div className="h-4 w-32 bg-superficie-hover rounded mb-4" />
        {[1, 2].map(i => (
          <div key={i} className="mb-3">
            <div className="h-3 w-full bg-superficie-hover rounded mb-1.5" />
            <div className="h-2 w-3/4 bg-superficie-hover rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== ESTADO VACÍO ====================

function EstadoSinDatos({ proveedorActivo }: { proveedorActivo: string }) {
  const enlace = ENLACES_FACTURACION[proveedorActivo]

  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <div className="w-14 h-14 rounded-modal bg-superficie-elevada flex items-center justify-center mb-4">
        <BarChart3 size={24} strokeWidth={1.5} className="text-texto-terciario" />
      </div>
      <h3 className="text-base font-semibold text-texto-primario mb-1.5">
        Sin datos de consumo este mes
      </h3>
      <p className="text-sm text-texto-terciario max-w-sm mb-4">
        Cuando tu equipo empiece a usar Salix IA, acá vas a ver el desglose de consumo, costos estimados y tendencias.
      </p>
      {enlace && (
        <a
          href={enlace.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-texto-marca hover:underline no-underline"
        >
          <ExternalLink size={14} />
          {enlace.etiqueta}
        </a>
      )}
    </div>
  )
}
