'use client'

import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Clock, Calendar, Globe, CalendarDays, MapPin } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { IndicadorGuardado } from '@/componentes/ui/IndicadorGuardado'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAutoguardado } from '@/hooks/useAutoguardado'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { PAISES_DISPONIBLES } from '@/lib/paises'

/**
 * Sección Regionalización — autoguardado inmediato al cambiar cualquier select.
 * Incluye selector de países donde opera la empresa (multi-select con chips).
 */

const MONEDAS = [
  { valor: 'ARS', etiqueta: 'ARS — Peso argentino' },
  { valor: 'USD', etiqueta: 'USD — Dólar estadounidense' },
  { valor: 'EUR', etiqueta: 'EUR — Euro' },
  { valor: 'BRL', etiqueta: 'BRL — Real brasileño' },
  { valor: 'CLP', etiqueta: 'CLP — Peso chileno' },
  { valor: 'COP', etiqueta: 'COP — Peso colombiano' },
  { valor: 'MXN', etiqueta: 'MXN — Peso mexicano' },
  { valor: 'UYU', etiqueta: 'UYU — Peso uruguayo' },
  { valor: 'PEN', etiqueta: 'PEN — Sol peruano' },
]

const FORMATOS_FECHA = [
  { valor: 'DD/MM/YYYY', etiqueta: 'DD/MM/YYYY — 25/03/2026' },
  { valor: 'MM/DD/YYYY', etiqueta: 'MM/DD/YYYY — 03/25/2026' },
  { valor: 'YYYY-MM-DD', etiqueta: 'YYYY-MM-DD — 2026-03-25' },
]

const FORMATOS_HORA = [
  { valor: '24h', etiqueta: '24 horas — 14:30' },
  { valor: '12h', etiqueta: '12 horas — 2:30 PM' },
]

const DIAS_INICIO = [
  { valor: 'lunes', etiqueta: 'Lunes' },
  { valor: 'domingo', etiqueta: 'Domingo' },
  { valor: 'sabado', etiqueta: 'Sábado' },
]

const ZONAS_HORARIAS = [
  { valor: 'America/Argentina/Buenos_Aires', etiqueta: 'Buenos Aires (GMT-3)' },
  { valor: 'America/Santiago', etiqueta: 'Santiago (GMT-4)' },
  { valor: 'America/Bogota', etiqueta: 'Bogotá (GMT-5)' },
  { valor: 'America/Mexico_City', etiqueta: 'Ciudad de México (GMT-6)' },
  { valor: 'America/Sao_Paulo', etiqueta: 'São Paulo (GMT-3)' },
  { valor: 'America/Lima', etiqueta: 'Lima (GMT-5)' },
  { valor: 'America/Montevideo', etiqueta: 'Montevideo (GMT-3)' },
  { valor: 'America/New_York', etiqueta: 'Nueva York (GMT-5)' },
  { valor: 'Europe/Madrid', etiqueta: 'Madrid (GMT+1)' },
  { valor: 'UTC', etiqueta: 'UTC' },
]

export function SeccionRegional() {
  const { t } = useTraduccion()
  const { empresa } = useEmpresa()
  const supabase = crearClienteNavegador()

  const [paises, setPaises] = useState<string[]>([])
  const [moneda, setMoneda] = useState('ARS')
  const [formatoFecha, setFormatoFecha] = useState('DD/MM/YYYY')
  const [formatoHora, setFormatoHora] = useState('24h')
  const [diaInicio, setDiaInicio] = useState('lunes')
  const [zonaHoraria, setZonaHoraria] = useState('America/Argentina/Buenos_Aires')

  const guardarEnServidor = useCallback(async (datos: Record<string, unknown>) => {
    const res = await fetch('/api/empresas/actualizar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    return res.ok
  }, [])

  const { estado, puedeDeshacer, guardarInmediato, setSnapshot, deshacer } = useAutoguardado({ onGuardar: guardarEnServidor })

  useEffect(() => {
    if (!empresa) return

    const cargar = async () => {
      const { data } = await supabase
        .from('empresas')
        .select('paises, pais, moneda, formato_fecha, formato_hora, dia_inicio_semana, zona_horaria')
        .eq('id', empresa.id)
        .single()

      if (data) {
        const paisesActuales = data.paises?.length ? data.paises : data.pais ? [data.pais] : []
        setPaises(paisesActuales)
        setMoneda(data.moneda || 'ARS')
        setFormatoFecha(data.formato_fecha || 'DD/MM/YYYY')
        setFormatoHora(data.formato_hora || '24h')
        setDiaInicio(data.dia_inicio_semana || 'lunes')
        setZonaHoraria(data.zona_horaria || 'America/Argentina/Buenos_Aires')
        setSnapshot({
          paises: paisesActuales,
          moneda: data.moneda || 'ARS',
          formato_fecha: data.formato_fecha || 'DD/MM/YYYY',
          formato_hora: data.formato_hora || '24h',
          dia_inicio_semana: data.dia_inicio_semana || 'lunes',
          zona_horaria: data.zona_horaria || 'America/Argentina/Buenos_Aires',
        })
      }
    }

    cargar()
  }, [empresa, supabase])

  return (
    <div className="space-y-6">
      <EncabezadoSeccion
        titulo="Regionalización"
        descripcion="Estos ajustes definen cómo se muestran las fechas, precios y horarios en toda la app para todos los miembros."
        accion={
          <IndicadorGuardado estado={estado} puedeDeshacer={puedeDeshacer} onDeshacer={async () => {
            const restaurados = await deshacer()
            if (restaurados) {
              if ('paises' in restaurados) setPaises(restaurados.paises as string[])
              if ('moneda' in restaurados) setMoneda(restaurados.moneda as string)
              if ('formato_fecha' in restaurados) setFormatoFecha(restaurados.formato_fecha as string)
              if ('formato_hora' in restaurados) setFormatoHora(restaurados.formato_hora as string)
              if ('dia_inicio_semana' in restaurados) setDiaInicio(restaurados.dia_inicio_semana as string)
              if ('zona_horaria' in restaurados) setZonaHoraria(restaurados.zona_horaria as string)
            }
          }} />
        }
      />

      {/* Panel unificado con secciones separadas por divisores */}
      <div className="border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.07]">

        {/* Países donde opera */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(74,144,226,0.15)' }}>
              <Globe size={15} style={{ color: '#4A90E2' }} />
            </div>
            <div>
              <h3 className="text-[13px] font-medium text-texto-primario">Países donde opera</h3>
              <p className="text-[11px] text-texto-terciario mt-0.5">Define en qué países trabaja tu empresa. Los formularios mostrarán los campos de identificación y datos fiscales de cada país.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PAISES_DISPONIBLES.map(p => {
              const activo = paises.includes(p.codigo)
              return (
                <button key={p.codigo} type="button"
                  onClick={() => {
                    const nuevos = activo ? paises.filter(c => c !== p.codigo) : [...paises, p.codigo]
                    setPaises(nuevos)
                    guardarInmediato({ paises: nuevos })
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                    activo
                      ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                      : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario hover:border-white/[0.12] hover:text-texto-secundario'
                  }`}>
                  <span className="text-sm leading-none">{p.bandera}</span>
                  {p.nombre}
                </button>
              )
            })}
          </div>
          {paises.length === 0 && (
            <p className="text-[11px] text-insignia-advertencia mt-3">Seleccioná al menos un país.</p>
          )}
        </div>

        {/* Moneda principal */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(76,175,80,0.15)' }}>
              <DollarSign size={15} style={{ color: '#4CAF50' }} />
            </div>
            <div>
              <h3 className="text-[13px] font-medium text-texto-primario">Moneda principal</h3>
              <p className="text-[11px] text-texto-terciario mt-0.5">Se usa en presupuestos, facturas y precios de productos.</p>
            </div>
          </div>
          <div className="max-w-sm">
            <Select opciones={MONEDAS} valor={moneda} onChange={(v) => { setMoneda(v); guardarInmediato({ moneda: v }) }} />
          </div>
        </div>

        {/* Zona horaria */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(91,71,224,0.15)' }}>
              <Clock size={15} style={{ color: '#8B78F0' }} />
            </div>
            <div>
              <h3 className="text-[13px] font-medium text-texto-primario">Zona horaria</h3>
              <p className="text-[11px] text-texto-terciario mt-0.5">Se usa para calcular horarios de atención, fichaje, vencimientos y recordatorios.</p>
            </div>
          </div>
          <div className="max-w-sm">
            <Select opciones={ZONAS_HORARIAS} valor={zonaHoraria} onChange={(v) => { setZonaHoraria(v); guardarInmediato({ zona_horaria: v }) }} />
          </div>
        </div>

        {/* Formato de fecha y hora */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(74,144,226,0.15)' }}>
              <Calendar size={15} style={{ color: '#4A90E2' }} />
            </div>
            <div>
              <h3 className="text-[13px] font-medium text-texto-primario">Formato de fecha y hora</h3>
              <p className="text-[11px] text-texto-terciario mt-0.5">Cómo se muestran las fechas y horas en tablas, calendarios, actividades y documentos.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <div>
              <p className="text-[11px] text-texto-terciario mb-1.5">Fecha</p>
              <Select opciones={FORMATOS_FECHA} valor={formatoFecha} onChange={(v) => { setFormatoFecha(v); guardarInmediato({ formato_fecha: v }) }} />
            </div>
            <div>
              <p className="text-[11px] text-texto-terciario mb-1.5">Hora</p>
              <Select opciones={FORMATOS_HORA} valor={formatoHora} onChange={(v) => { setFormatoHora(v); guardarInmediato({ formato_hora: v }) }} />
            </div>
          </div>
        </div>

        {/* Inicio de semana */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(240,146,58,0.15)' }}>
              <CalendarDays size={15} style={{ color: '#F0923A' }} />
            </div>
            <div>
              <h3 className="text-[13px] font-medium text-texto-primario">Inicio de semana</h3>
              <p className="text-[11px] text-texto-terciario mt-0.5">Define qué día empieza la semana en el calendario, la matriz de asistencias y los reportes semanales.</p>
            </div>
          </div>
          <div className="max-w-xs">
            <Select opciones={DIAS_INICIO} valor={diaInicio} onChange={(v) => { setDiaInicio(v); guardarInmediato({ dia_inicio_semana: v }) }} />
          </div>
        </div>
      </div>
    </div>
  )
}
