'use client'

/**
 * PaginaEditorTurnoLaboral — Editor pantalla completa de turnos laborales.
 * Reemplaza al EditorTurno inline del config de asistencias.
 *
 * Layout:
 * - Panel izq: nombre + flexible + tolerancia + asignación a sectores
 * - Main: grilla grande de días de la semana con hora desde/hasta
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Trash2 } from 'lucide-react'
import { PlantillaEditor } from '@/componentes/entidad/PlantillaEditor'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { useToast } from '@/componentes/feedback/Toast'

// ─── Tipos ───

export interface DiaHorario {
  activo: boolean
  desde: string
  hasta: string
}

export interface DiasConfig {
  lunes: DiaHorario
  martes: DiaHorario
  miercoles: DiaHorario
  jueves: DiaHorario
  viernes: DiaHorario
  sabado: DiaHorario
  domingo: DiaHorario
}

export interface TurnoLaboral {
  id: string
  nombre: string
  es_default: boolean
  flexible: boolean
  tolerancia_min: number
  dias: DiasConfig
  orden?: number
}

const DIAS_SEMANA: { clave: keyof DiasConfig; etiqueta: string }[] = [
  { clave: 'lunes', etiqueta: 'Lunes' },
  { clave: 'martes', etiqueta: 'Martes' },
  { clave: 'miercoles', etiqueta: 'Miércoles' },
  { clave: 'jueves', etiqueta: 'Jueves' },
  { clave: 'viernes', etiqueta: 'Viernes' },
  { clave: 'sabado', etiqueta: 'Sábado' },
  { clave: 'domingo', etiqueta: 'Domingo' },
]

interface Sector {
  id: string
  nombre: string
  turno_id: string | null
}

interface Props {
  turno: TurnoLaboral | null
  sectores: Sector[]
  rutaVolver: string
  textoVolver?: string
}

export function PaginaEditorTurnoLaboral({
  turno,
  sectores,
  rutaVolver,
  textoVolver = 'Turnos laborales',
}: Props) {
  const router = useRouter()
  const { mostrar } = useToast()
  const esEdicion = !!turno

  const [nombre, setNombre] = useState(turno?.nombre || '')
  const [flexible, setFlexible] = useState(turno?.flexible ?? false)
  const [tolerancia, setTolerancia] = useState(turno?.tolerancia_min ?? 10)
  const [dias, setDias] = useState<DiasConfig>(turno?.dias || {
    lunes: { activo: true, desde: '09:00', hasta: '18:00' },
    martes: { activo: true, desde: '09:00', hasta: '18:00' },
    miercoles: { activo: true, desde: '09:00', hasta: '18:00' },
    jueves: { activo: true, desde: '09:00', hasta: '18:00' },
    viernes: { activo: true, desde: '09:00', hasta: '18:00' },
    sabado: { activo: false, desde: '09:00', hasta: '13:00' },
    domingo: { activo: false, desde: '09:00', hasta: '13:00' },
  })
  const [guardando, setGuardando] = useState(false)

  const actualizarDia = (clave: keyof DiasConfig, campo: keyof DiaHorario, valor: boolean | string) => {
    setDias(prev => ({ ...prev, [clave]: { ...prev[clave], [campo]: valor } }))
  }

  // ─── Guardar ───
  const handleGuardar = async () => {
    if (!nombre.trim()) {
      mostrar('error', 'El nombre es obligatorio')
      return
    }
    setGuardando(true)
    try {
      const datos = { nombre: nombre.trim(), flexible, tolerancia_min: tolerancia, dias }
      if (esEdicion && turno) {
        await fetch('/api/asistencias/turnos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: turno.id, ...datos }),
        })
        mostrar('exito', 'Turno actualizado')
      } else {
        await fetch('/api/asistencias/turnos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...datos, es_default: false }),
        })
        mostrar('exito', 'Turno creado')
      }
      router.push(rutaVolver)
    } catch {
      mostrar('error', 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async () => {
    if (!turno || turno.es_default) return
    if (!confirm(`¿Eliminar el turno "${turno.nombre}"? Los empleados con este turno volverán al predeterminado.`)) return
    try {
      await fetch('/api/asistencias/turnos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: turno.id }),
      })
      mostrar('exito', 'Turno eliminado')
      router.push(rutaVolver)
    } catch {
      mostrar('error', 'Error al eliminar')
    }
  }

  // ─── Asignar sector ───
  const asignarSector = async (sectorId: string, turnoId: string | null) => {
    try {
      await fetch('/api/asistencias/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _asignar_sector: { sector_id: sectorId, turno_id: turnoId } }),
      })
      mostrar('exito', 'Sector actualizado')
    } catch {
      mostrar('error', 'Error al asignar sector')
    }
  }

  const sectoresAsignados = sectores.filter(s => s.turno_id === turno?.id)

  const acciones = [
    ...(esEdicion && !turno?.es_default ? [{
      id: 'eliminar',
      etiqueta: 'Eliminar',
      icono: <Trash2 size={14} />,
      onClick: handleEliminar,
      variante: 'peligro' as const,
      alineadoIzquierda: true,
    }] : []),
    {
      id: 'guardar',
      etiqueta: esEdicion ? 'Guardar' : 'Crear turno',
      icono: <Save size={14} />,
      onClick: handleGuardar,
      variante: 'primario' as const,
      cargando: guardando,
      deshabilitado: !nombre.trim(),
    },
  ]

  // ─── Panel izq: config básica + sectores asignados ───
  const panelConfig = (
    <div className="space-y-5">
      {/* Flexible */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Comportamiento
        </label>
        <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-card border border-white/[0.06] bg-white/[0.03]">
          <div>
            <p className="text-xs font-medium text-texto-secundario">Flexible</p>
            <p className="text-[11px] text-texto-terciario mt-0.5">Sin control de puntualidad ni ausencias</p>
          </div>
          <Interruptor activo={flexible} onChange={setFlexible} />
        </div>
      </div>

      {/* Tolerancia */}
      {!flexible && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
            Tolerancia tardanza (min)
          </label>
          <Input
            tipo="number"
            value={String(tolerancia)}
            onChange={(e) => setTolerancia(Math.max(0, Math.min(60, parseInt(e.target.value) || 0)))}
            compacto
          />
          <p className="text-[11px] text-texto-terciario">Minutos de gracia antes de marcar como tardanza</p>
        </div>
      )}

      {/* Sectores asignados */}
      {esEdicion && sectores.length > 0 && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
            Sectores asignados ({sectoresAsignados.length})
          </label>
          {sectoresAsignados.length > 0 ? (
            <div className="space-y-1">
              {sectoresAsignados.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-card border border-white/[0.06] bg-white/[0.03]">
                  <span className="text-xs text-texto-primario truncate">{s.nombre}</span>
                  <button
                    type="button"
                    onClick={() => asignarSector(s.id, null)}
                    className="text-xxs text-insignia-peligro hover:underline cursor-pointer bg-transparent border-none"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-texto-terciario italic">Ningún sector usa este turno todavía.</p>
          )}

          {/* Agregar sector */}
          <Select
            valor=""
            onChange={(v) => v && turno && asignarSector(v, turno.id)}
            placeholder="Asignar a otro sector..."
            opciones={sectores.filter(s => s.turno_id !== turno?.id).map(s => ({ valor: s.id, etiqueta: s.nombre }))}
          />
        </div>
      )}
    </div>
  )

  return (
    <PlantillaEditor
      titulo={esEdicion ? (nombre || turno?.nombre || 'Editar turno') : 'Nuevo turno laboral'}
      subtitulo="Turno laboral — horario que asignás a sectores o miembros individuales"
      volverTexto={textoVolver}
      onVolver={() => router.push(rutaVolver)}
      acciones={acciones}
      panelConfig={panelConfig}
    >
      {/* ═══ NOMBRE ═══ */}
      <div className="space-y-2 pb-4 border-b border-borde-sutil">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Nombre del turno
        </label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Turno mañana, Horario fábrica..."
          autoFocus
          className="!text-base !font-semibold"
        />
      </div>

      {/* ═══ HORARIOS POR DÍA ═══ */}
      <div className="pt-4 space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Horarios por día de la semana
        </label>
        <div className="space-y-1.5">
          {DIAS_SEMANA.map(({ clave, etiqueta }) => {
            const dia = dias[clave]
            return (
              <div
                key={clave}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2 px-3 rounded-card border border-white/[0.06] bg-white/[0.03]"
              >
                <div className="w-full sm:w-32 shrink-0">
                  <Interruptor
                    activo={dia.activo}
                    onChange={(v) => actualizarDia(clave, 'activo', v)}
                    etiqueta={etiqueta}
                  />
                </div>
                {dia.activo ? (
                  <div className="flex items-center gap-2 text-sm pl-12 sm:pl-0">
                    <div className="w-[120px]">
                      <SelectorHora
                        valor={dia.desde || null}
                        onChange={(v) => actualizarDia(clave, 'desde', v || '09:00')}
                        pasoMinutos={15}
                      />
                    </div>
                    <span className="text-texto-terciario shrink-0">a</span>
                    <div className="w-[120px]">
                      <SelectorHora
                        valor={dia.hasta || null}
                        onChange={(v) => actualizarDia(clave, 'hasta', v || '18:00')}
                        pasoMinutos={15}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-texto-terciario italic pl-12 sm:pl-0">No laboral</span>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-texto-terciario">
          Los días desactivados no se consideran laborales. El empleado puede marcarse normal pero no se calcula asistencia.
        </p>
      </div>
    </PlantillaEditor>
  )
}
