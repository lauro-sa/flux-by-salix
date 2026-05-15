'use client'

/**
 * TabTurnos — Reemplaza al viejo TabHorarios.
 *
 * Antes había dos entidades distintas en el modelo:
 *   - Tabla `horarios` (general / por sector) — editada acá pero
 *     huérfana, no la consumía nadie en cálculo de nómina.
 *   - Tabla `turnos_laborales` — la que realmente se usa (asistencias,
 *     contratos, snapshot de recibos).
 *
 * Esta subtab unifica el modelo: listamos los `turnos_laborales` de la
 * empresa con un editor inline (modal) para crear/editar/eliminar, y
 * mostramos a cuántos sectores aplica cada uno. La asignación
 * sector→turno predeterminado se hace en el editor del sector, no acá.
 *
 * Para validaciones más finas (orden, asignaciones masivas), el módulo
 * Asistencias tiene su listado dedicado en
 * /asistencias/configuracion/turnos.
 */

import { useState } from 'react'
import { Clock, Plus, Pencil, Trash2 } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { Modal } from '@/componentes/ui/Modal'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useToast } from '@/componentes/feedback/Toast'
import type { Sector } from './tipos'

interface DiaHorario {
  activo: boolean
  desde: string
  hasta: string
}

interface DiasConfig {
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
}

interface PropsTabTurnos {
  sectores: Sector[]
  /**
   * Turnos cargados por el padre (SeccionEstructura). Recibirlos como
   * prop evita que TabTurnos haga su propio fetch cada vez que se monta
   * — al cambiar de subtab y volver, antes parpadeaba la lista.
   */
  turnos: TurnoLaboral[]
  /** Refresca el padre cuando hay cambios (para re-cargar sectores y turnos). */
  onCambio?: () => void
}

const DIAS_SEMANA: { clave: keyof DiasConfig; etiqueta: string; corto: string }[] = [
  { clave: 'lunes',     etiqueta: 'Lunes',     corto: 'L' },
  { clave: 'martes',    etiqueta: 'Martes',    corto: 'M' },
  { clave: 'miercoles', etiqueta: 'Miércoles', corto: 'X' },
  { clave: 'jueves',    etiqueta: 'Jueves',    corto: 'J' },
  { clave: 'viernes',   etiqueta: 'Viernes',   corto: 'V' },
  { clave: 'sabado',    etiqueta: 'Sábado',    corto: 'S' },
  { clave: 'domingo',   etiqueta: 'Domingo',   corto: 'D' },
]

const DIAS_DEFAULT: DiasConfig = {
  lunes:     { activo: true,  desde: '09:00', hasta: '18:00' },
  martes:    { activo: true,  desde: '09:00', hasta: '18:00' },
  miercoles: { activo: true,  desde: '09:00', hasta: '18:00' },
  jueves:    { activo: true,  desde: '09:00', hasta: '18:00' },
  viernes:   { activo: true,  desde: '09:00', hasta: '18:00' },
  sabado:    { activo: false, desde: '09:00', hasta: '13:00' },
  domingo:   { activo: false, desde: '09:00', hasta: '13:00' },
}

/** Resumen compacto: "L-V · 09:00 a 18:00" o "Sin días activos". */
export function resumirDias(dias: DiasConfig): string {
  const activos = DIAS_SEMANA.filter(d => dias[d.clave]?.activo)
  if (activos.length === 0) return 'Sin días activos'
  const primero = dias[activos[0].clave]
  const todosIguales = activos.every(d => dias[d.clave].desde === primero.desde && dias[d.clave].hasta === primero.hasta)
  const etiquetaDias = activos.map(d => d.corto).join('')
  return todosIguales
    ? `${etiquetaDias} · ${primero.desde} a ${primero.hasta}`
    : `${etiquetaDias} · horarios variables`
}

export function TabTurnos({ sectores, turnos, onCambio }: PropsTabTurnos) {
  const toast = useToast()
  const [editando, setEditando] = useState<TurnoLaboral | 'nuevo' | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<TurnoLaboral | null>(null)

  // ─── Eliminar ───
  const handleEliminar = async () => {
    if (!confirmarEliminar) return
    try {
      const res = await fetch('/api/asistencias/turnos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmarEliminar.id }),
      })
      if (!res.ok) throw new Error()
      toast.mostrar('exito', 'Turno eliminado')
      setConfirmarEliminar(null)
      onCambio?.()
    } catch {
      toast.mostrar('error', 'No se pudo eliminar el turno')
    }
  }

  // ─── Render ───
  return (
    <div className="space-y-4">
      <p className="text-xs text-texto-terciario">
        Los turnos definen el horario laboral que se asigna a un sector o a un empleado
        directamente. Los empleados con <strong>horario flexible</strong> en su perfil no quedan
        sujetos a un turno para el fichaje, pero siguen contando como horas trabajadas.
      </p>

      <div className="space-y-2">
        {turnos.length === 0 ? (
          <div className="rounded-card border border-dashed border-borde-sutil p-8 text-center">
            <Clock size={32} strokeWidth={1.5} className="mx-auto text-texto-terciario mb-3" />
            <p className="text-sm text-texto-secundario mb-1">Sin turnos creados</p>
            <p className="text-xs text-texto-terciario">
              Creá un turno para definir el horario de uno o varios sectores.
            </p>
          </div>
        ) : (
          turnos.map(t => {
            const sectoresAsignados = sectores.filter(s => s.turno_id === t.id).length
            return (
              <article
                key={t.id}
                className="group rounded-card border border-borde-sutil bg-superficie-tarjeta px-4 py-3 flex items-center gap-3 hover:border-borde-fuerte transition-colors"
              >
                <div className="size-9 rounded-md flex items-center justify-center bg-texto-marca/15 text-texto-marca shrink-0">
                  <Clock size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-medium text-texto-primario truncate">{t.nombre}</h4>
                    {t.es_default && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-insignia-exito/15 text-insignia-exito">
                        Predeterminado
                      </span>
                    )}
                    {t.flexible && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-insignia-info/15 text-insignia-info">
                        Flexible
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-texto-terciario mt-0.5">
                    {resumirDias(t.dias)}
                    {' · '}
                    {sectoresAsignados === 0
                      ? 'sin sectores asignados'
                      : sectoresAsignados === 1
                        ? '1 sector asignado'
                        : `${sectoresAsignados} sectores asignados`}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    soloIcono
                    icono={<Pencil size={13} />}
                    titulo="Editar"
                    onClick={() => setEditando(t)}
                  />
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    soloIcono
                    icono={<Trash2 size={13} />}
                    titulo="Eliminar"
                    onClick={() => setConfirmarEliminar(t)}
                    className="!text-insignia-peligro"
                  />
                </div>
              </article>
            )
          })
        )}
      </div>

      <div className="flex justify-end">
        <Boton
          variante="secundario"
          tamano="sm"
          icono={<Plus size={14} />}
          onClick={() => setEditando('nuevo')}
        >
          Nuevo turno
        </Boton>
      </div>

      {editando && (
        <ModalEditarTurno
          turno={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            onCambio?.()
          }}
        />
      )}

      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar turno"
        descripcion={
          confirmarEliminar
            ? `Se eliminará "${confirmarEliminar.nombre}". Los sectores y empleados con este turno volverán al predeterminado.`
            : ''
        }
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        onConfirmar={handleEliminar}
        onCerrar={() => setConfirmarEliminar(null)}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Modal de edición/creación de turno
// ════════════════════════════════════════════════════════════════

interface PropsModalEditarTurno {
  turno: TurnoLaboral | null
  onCerrar: () => void
  onGuardado: () => void
}

function ModalEditarTurno({ turno, onCerrar, onGuardado }: PropsModalEditarTurno) {
  const toast = useToast()
  const esEdicion = !!turno
  const [nombre, setNombre] = useState(turno?.nombre ?? '')
  const [flexible, setFlexible] = useState(turno?.flexible ?? false)
  const [tolerancia, setTolerancia] = useState(turno?.tolerancia_min ?? 10)
  const [dias, setDias] = useState<DiasConfig>(turno?.dias ?? DIAS_DEFAULT)
  const [guardando, setGuardando] = useState(false)

  const actualizarDia = (clave: keyof DiasConfig, campo: keyof DiaHorario, valor: boolean | string) => {
    setDias(prev => ({ ...prev, [clave]: { ...prev[clave], [campo]: valor } }))
  }

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      toast.mostrar('error', 'El nombre es obligatorio')
      return
    }
    setGuardando(true)
    try {
      const payload = { nombre: nombre.trim(), flexible, tolerancia_min: tolerancia, dias }
      const res = await fetch('/api/asistencias/turnos', {
        method: esEdicion ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esEdicion ? { id: turno!.id, ...payload } : payload),
      })
      if (!res.ok) throw new Error()
      toast.mostrar('exito', esEdicion ? 'Turno actualizado' : 'Turno creado')
      onGuardado()
    } catch {
      toast.mostrar('error', 'No se pudo guardar el turno')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={() => { if (!guardando) onCerrar() }}
      titulo={esEdicion ? 'Editar turno' : 'Nuevo turno'}
      tamano="3xl"
      accionPrimaria={{ etiqueta: 'Guardar', onClick: handleGuardar, cargando: guardando }}
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
    >
      <div className="space-y-5">
        {/* Identidad */}
        <section>
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Identidad</h3>
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3">
            <Input
              etiqueta="Nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Mañana, Tarde, Taller, etc."
            />
            <Input
              tipo="number"
              etiqueta="Tolerancia por fichaje (min)"
              value={String(tolerancia)}
              onChange={e => setTolerancia(Math.max(0, Number(e.target.value) || 0))}
              ayuda="Minutos de gracia para llegada o salida sin marcar tardanza."
            />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-card border border-borde-sutil bg-superficie-tarjeta px-3 py-2">
            <div>
              <p className="text-sm text-texto-primario">Horario flexible</p>
              <p className="text-xs text-texto-terciario">
                Sin restricciones de hora de entrada/salida.
              </p>
            </div>
            <Interruptor activo={flexible} onChange={setFlexible} />
          </div>
        </section>

        {/* Días */}
        <section className="pt-4 border-t border-white/[0.07]">
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
            Días y horarios
          </h3>
          <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden divide-y divide-borde-sutil">
            {DIAS_SEMANA.map(d => {
              const valor = dias[d.clave]
              return (
                <div key={d.clave} className={`flex items-center gap-3 px-4 py-2.5 ${!valor.activo ? 'opacity-50' : ''}`}>
                  <div className="w-28 flex items-center gap-2 shrink-0">
                    <Interruptor
                      activo={valor.activo}
                      onChange={(v) => actualizarDia(d.clave, 'activo', v)}
                    />
                    <span className="text-sm text-texto-primario">{d.etiqueta}</span>
                  </div>
                  {valor.activo ? (
                    <div className="flex items-center gap-2 flex-1">
                      <SelectorHora
                        valor={valor.desde}
                        onChange={(v) => actualizarDia(d.clave, 'desde', v || '09:00')}
                      />
                      <span className="text-xs text-texto-terciario">a</span>
                      <SelectorHora
                        valor={valor.hasta}
                        onChange={(v) => actualizarDia(d.clave, 'hasta', v || '18:00')}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-texto-terciario italic">No laboral</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </Modal>
  )
}
