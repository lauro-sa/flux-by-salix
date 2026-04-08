'use client'

import { useState, useEffect } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Download, Loader2, DollarSign, Clock, UserCheck, UserX, AlertTriangle, Send } from 'lucide-react'
import { ModalEnviarReciboNomina } from './ModalEnviarReciboNomina'

// ─── Tipos ───────────────────────────────────────────────────

interface ResultadoNomina {
  miembro_id: string
  nombre: string
  correo: string
  compensacion_tipo: string
  compensacion_monto: number
  compensacion_frecuencia?: string
  dias_laborales: number
  dias_trabajados: number
  dias_ausentes: number
  dias_tardanza: number
  // Horas detalladas
  horas_brutas: number
  horas_netas: number
  horas_almuerzo: number
  horas_particular: number
  horas_totales: number // = netas (compatibilidad)
  promedio_horas_diario: number
  dias_con_almuerzo: number
  dias_con_salida_particular: number
  descuenta_almuerzo: boolean
  duracion_almuerzo_config: number
  dias_feriados: number
  dias_trabajados_feriado: number
  // Pago
  monto_pagar: number
  monto_detalle: string
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  desde: string
  hasta: string
  etiquetaPeriodo: string
  /** Si se seleccionaron empleados específicos */
  empleadosSeleccionados?: string[]
  /** Si se seleccionaron días específicos */
  diasSeleccionados?: string[]
}

// ─── Helpers ─────────────────────────────────────────────────

const fmtMonto = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtHoras = (h: number) => { const hrs = Math.floor(h); const min = Math.round((h - hrs) * 60); return min > 0 ? `${hrs}h ${min}m` : `${hrs}h` }

const COLORES_AVATAR = [
  'bg-indigo-500/25 text-indigo-400',
  'bg-emerald-500/25 text-emerald-400',
  'bg-amber-500/25 text-amber-400',
  'bg-red-500/25 text-red-400',
  'bg-purple-500/25 text-purple-400',
  'bg-cyan-500/25 text-cyan-400',
]

function inicial(nombre: string): string {
  return nombre.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// ─── Componente ──────────────────────────────────────────────

export function ModalNomina({ abierto, onCerrar, desde, hasta, etiquetaPeriodo, empleadosSeleccionados, diasSeleccionados }: PropiedadesModal) {
  const [cargando, setCargando] = useState(true)
  const [resultados, setResultados] = useState<ResultadoNomina[]>([])
  const [diasLaborales, setDiasLaborales] = useState(0)
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [modalEnvioAbierto, setModalEnvioAbierto] = useState(false)

  useEffect(() => {
    if (!abierto || !desde || !hasta) return
    setCargando(true)
    const params = new URLSearchParams({ desde, hasta })
    if (empleadosSeleccionados?.length) params.set('empleados', empleadosSeleccionados.join(','))
    if (diasSeleccionados?.length) params.set('dias', diasSeleccionados.join(','))
    fetch(`/api/asistencias/nomina?${params}`)
      .then(r => r.json())
      .then(data => {
        setResultados(data.resultados || [])
        setDiasLaborales(data.dias_laborales || 0)
        setNombreEmpresa(data.nombre_empresa || '')
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [abierto, desde, hasta, empleadosSeleccionados, diasSeleccionados])

  const totalPagar = resultados.reduce((s, r) => s + r.monto_pagar, 0)
  const totalHoras = resultados.reduce((s, r) => s + r.horas_totales, 0)

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Nómina — ${etiquetaPeriodo}`}
      tamano="lg"
      acciones={
        <div className="flex items-center justify-between w-full">
          <div className="text-sm">
            <span className="text-texto-terciario">Total a pagar: </span>
            <span className="text-lg font-bold text-emerald-400">{fmtMonto(totalPagar)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Boton variante="secundario" tamano="sm" onClick={() => {
              window.open(`/api/asistencias/exportar?desde=${desde}&hasta=${hasta}`, '_blank')
            }}>
              <Download size={13} className="mr-1" /> Exportar
            </Boton>
            <Boton
              tamano="sm"
              onClick={() => setModalEnvioAbierto(true)}
              disabled={resultados.length === 0 || cargando}
            >
              <Send size={13} className="mr-1" /> Enviar recibo
            </Boton>
            <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cerrar</Boton>
          </div>
        </div>
      }
    >
      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-texto-terciario" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumen general */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-superficie-elevada/30 rounded-lg px-3 py-3 text-center">
              <DollarSign size={16} className="mx-auto text-emerald-400 mb-1" />
              <p className="text-lg font-bold text-texto-primario">{fmtMonto(totalPagar)}</p>
              <p className="text-[10px] text-texto-terciario">Total a pagar</p>
            </div>
            <div className="bg-superficie-elevada/30 rounded-lg px-3 py-3 text-center">
              <Clock size={16} className="mx-auto text-sky-400 mb-1" />
              <p className="text-lg font-bold text-texto-primario">{fmtHoras(totalHoras)}</p>
              <p className="text-[10px] text-texto-terciario">Horas totales</p>
            </div>
            <div className="bg-superficie-elevada/30 rounded-lg px-3 py-3 text-center">
              <UserCheck size={16} className="mx-auto text-emerald-400 mb-1" />
              <p className="text-lg font-bold text-texto-primario">{diasLaborales}</p>
              <p className="text-[10px] text-texto-terciario">Días laborales</p>
            </div>
          </div>

          {/* Lista de empleados */}
          <div className="space-y-2">
            {resultados.map((r, idx) => {
              const colorAvatar = COLORES_AVATAR[idx % COLORES_AVATAR.length]
              const pctAsistencia = r.dias_laborales > 0 ? Math.round((r.dias_trabajados / r.dias_laborales) * 100) : 0

              return (
                <div key={r.miembro_id} className="bg-superficie-elevada/20 border border-borde-sutil rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colorAvatar}`}>
                        {inicial(r.nombre)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-texto-primario">{r.nombre}</p>
                        <p className="text-[10px] text-texto-terciario">{r.monto_detalle}</p>
                      </div>
                    </div>
                    <span className="text-base font-bold text-emerald-400">{fmtMonto(r.monto_pagar)}</span>
                  </div>

                  {/* Métricas */}
                  <div className="flex items-center gap-4 text-[11px] flex-wrap">
                    <span className="flex items-center gap-1 text-texto-secundario">
                      <UserCheck size={11} className="text-emerald-400" />
                      {r.dias_trabajados}/{r.dias_laborales} días
                    </span>
                    {r.dias_ausentes > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <UserX size={11} />
                        {r.dias_ausentes} ausencia{r.dias_ausentes !== 1 ? 's' : ''}
                      </span>
                    )}
                    {r.dias_tardanza > 0 && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle size={11} />
                        {r.dias_tardanza} tardanza{r.dias_tardanza !== 1 ? 's' : ''}
                      </span>
                    )}
                    {r.dias_feriados > 0 && (
                      <span className="flex items-center gap-1 text-violet-400">
                        {r.dias_feriados} feriado{r.dias_feriados !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-texto-terciario">
                      <Clock size={11} />
                      {fmtHoras(r.horas_totales)}
                    </span>
                    <span className="ml-auto text-texto-terciario">{pctAsistencia}% asistencia</span>
                  </div>
                </div>
              )
            })}
          </div>

          {resultados.length === 0 && (
            <p className="text-center text-sm text-texto-terciario py-8">No hay empleados con datos de compensación configurados.</p>
          )}
        </div>
      )}

      {/* Modal de envío de recibos */}
      <ModalEnviarReciboNomina
        abierto={modalEnvioAbierto}
        onCerrar={() => setModalEnvioAbierto(false)}
        resultados={resultados}
        etiquetaPeriodo={etiquetaPeriodo}
        nombreEmpresa={nombreEmpresa}
      />
    </Modal>
  )
}
