'use client'

import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Clock, Calendar, Globe, CalendarDays, MapPin } from 'lucide-react'
import { Select } from '@/componentes/ui/Select'
import { IndicadorGuardado } from '@/componentes/ui/IndicadorGuardado'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAutoguardado } from '@/hooks/useAutoguardado'
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-texto-primario mb-1">Regionalización</h2>
          <p className="text-sm text-texto-terciario">
            Estos ajustes definen cómo se muestran las fechas, precios y horarios en toda la app para todos los miembros.
          </p>
        </div>
        <div className="shrink-0">
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
        </div>
      </div>

      {/* Países donde opera */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-insignia-primario/10 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin size={18} className="text-insignia-primario" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-texto-primario">Países donde opera</h3>
            <p className="text-xs text-texto-terciario mt-0.5">
              Define en qué países trabaja tu empresa. Los formularios de contacto mostrarán los campos de identificación y datos fiscales de cada país seleccionado.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAISES_DISPONIBLES.map(p => {
            const activo = paises.includes(p.codigo)
            return (
              <button key={p.codigo} type="button"
                onClick={() => {
                  const nuevos = activo ? paises.filter(c => c !== p.codigo) : [...paises, p.codigo]
                  setPaises(nuevos)
                  guardarInmediato({ paises: nuevos })
                }}
                className={`
                  px-3 py-1.5 text-sm rounded-lg border transition-all cursor-pointer
                  ${activo
                    ? 'bg-texto-marca/10 border-texto-marca/30 text-texto-primario font-medium'
                    : 'bg-transparent border-borde-sutil text-texto-terciario hover:text-texto-secundario hover:border-borde-fuerte'
                  }
                `}>
                <span className="mr-1.5">{p.bandera}</span>
                {p.nombre}
              </button>
            )
          })}
        </div>
        {paises.length === 0 && (
          <p className="text-xs text-insignia-advertencia mt-3">
            Seleccioná al menos un país para habilitar los campos de identificación y datos fiscales en contactos.
          </p>
        )}
      </div>

      {/* Moneda */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-insignia-exito/10 flex items-center justify-center shrink-0 mt-0.5">
            <DollarSign size={18} className="text-insignia-exito" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-texto-primario">Moneda</h3>
            <p className="text-xs text-texto-terciario mt-0.5">
              La moneda principal para presupuestos, facturas y precios de productos.
            </p>
          </div>
        </div>
        <div className="max-w-sm">
          <Select opciones={MONEDAS} valor={moneda} onChange={(v) => { setMoneda(v); guardarInmediato({ moneda: v }) }} />
        </div>
      </div>

      {/* Zona horaria */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-texto-marca/10 flex items-center justify-center shrink-0 mt-0.5">
            <Globe size={18} className="text-texto-marca" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-texto-primario">Zona horaria</h3>
            <p className="text-xs text-texto-terciario mt-0.5">
              Se usa para calcular horarios de atención, fichaje de asistencias, vencimientos y recordatorios.
            </p>
          </div>
        </div>
        <div className="max-w-sm">
          <Select opciones={ZONAS_HORARIAS} valor={zonaHoraria} onChange={(v) => { setZonaHoraria(v); guardarInmediato({ zona_horaria: v }) }} />
        </div>
      </div>

      {/* Formato de fecha y hora */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-insignia-info/10 flex items-center justify-center shrink-0 mt-0.5">
            <Calendar size={18} className="text-insignia-info" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-texto-primario">Formato de fecha y hora</h3>
            <p className="text-xs text-texto-terciario mt-0.5">
              Cómo se muestran las fechas y horas en tablas, calendarios, actividades y documentos.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <Select etiqueta="Fecha" opciones={FORMATOS_FECHA} valor={formatoFecha} onChange={(v) => { setFormatoFecha(v); guardarInmediato({ formato_fecha: v }) }} />
          <Select etiqueta="Hora" opciones={FORMATOS_HORA} valor={formatoHora} onChange={(v) => { setFormatoHora(v); guardarInmediato({ formato_hora: v }) }} />
        </div>
      </div>

      {/* Inicio de semana */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-insignia-advertencia/10 flex items-center justify-center shrink-0 mt-0.5">
            <CalendarDays size={18} className="text-insignia-advertencia" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-texto-primario">Inicio de semana</h3>
            <p className="text-xs text-texto-terciario mt-0.5">
              Define qué día empieza la semana en el calendario, la matriz de asistencias y los reportes semanales.
            </p>
          </div>
        </div>
        <div className="max-w-xs">
          <Select opciones={DIAS_INICIO} valor={diaInicio} onChange={(v) => { setDiaInicio(v); guardarInmediato({ dia_inicio_semana: v }) }} />
        </div>
      </div>
    </div>
  )
}
