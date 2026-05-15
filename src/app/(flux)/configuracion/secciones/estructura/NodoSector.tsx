'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Crown, Clock, Users } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Avatar } from '@/componentes/ui/Avatar'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { useTraduccion } from '@/lib/i18n'
import {
  obtenerMiembrosDeSector,
  type Sector,
  type SectorConHijos,
  type MiembroSimple,
  type AsignacionMiembroSector,
} from './tipos'
import { resumirDias, type TurnoLaboral } from './TabTurnos'

interface PropsNodoSector {
  sector: SectorConHijos
  nivel: number
  esUltimo: boolean
  miembrosPorSector: Map<string, number>
  miembros: MiembroSimple[]
  asignaciones: AsignacionMiembroSector[]
  /** Map id→turno completo, para mostrar nombre + horario del turno asignado al sector. */
  turnosMap?: Map<string, TurnoLaboral>
  onEditar: (sector: Sector) => void
  onEliminar: (sector: Sector) => void
  onAgregarHijo: (padreId: string) => void
}

/**
 * Nodo recursivo del organigrama de sectores.
 * Dibuja las líneas de conexión L padre→hijo con position:absolute.
 */
export function NodoSector({
  sector,
  nivel,
  esUltimo,
  miembrosPorSector,
  miembros,
  asignaciones,
  turnosMap,
  onEditar,
  onEliminar,
  onAgregarHijo,
}: PropsNodoSector) {
  const { t } = useTraduccion()
  const tieneHijos = sector.hijos.length > 0
  const cantidadMiembros = miembrosPorSector.get(sector.id) || 0
  // Dos toggles independientes para que el operador decida qué ver:
  //   - `expandido`: muestra/oculta los sub-sectores (sólo si tiene hijos).
  //   - `mostrarPersonas`: muestra/oculta los empleados directos del sector
  //     (sólo si tiene miembros propios).
  // Ambos persisten en localStorage por sector — al volver a la página
  // se respeta cómo lo dejó el usuario. Por defecto, el primer nivel
  // arranca expandido (jerarquía visible) y las personas ocultas.
  const claveHijos = `organigrama-${sector.id}-hijos`
  const clavePersonas = `organigrama-${sector.id}-personas`
  const [expandido, setExpandido] = useState(nivel < 2)
  const [mostrarPersonas, setMostrarPersonas] = useState(false)

  // Hidratación desde localStorage en el primer render del cliente.
  // Se hace en useEffect (no en useState init) para evitar mismatch SSR.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedHijos = localStorage.getItem(claveHijos)
    if (savedHijos !== null) setExpandido(savedHijos === 'true')
    const savedPersonas = localStorage.getItem(clavePersonas)
    if (savedPersonas !== null) setMostrarPersonas(savedPersonas === 'true')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(claveHijos, String(expandido))
  }, [expandido, claveHijos])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(clavePersonas, String(mostrarPersonas))
  }, [mostrarPersonas, clavePersonas])

  const jefe = sector.jefe_id ? miembros.find(m => m.usuario_id === sector.jefe_id) : null
  const personasSector = mostrarPersonas && cantidadMiembros > 0
    ? obtenerMiembrosDeSector(sector.id, asignaciones, miembros)
    : []
  const IconoSector = obtenerIcono(sector.icono || 'Building')
  // Turno predeterminado del sector. Mostramos nombre + resumen del
  // horario ("Taller · L-V 09:00-18:00") como chip al lado del jefe.
  // Si no hay turno asignado, no aparece chip.
  const turno = sector.turno_id && turnosMap ? turnosMap.get(sector.turno_id) ?? null : null
  const turnoHorario = turno ? resumirDias(turno.dias) : null

  return (
    <div className="relative">
      {/* Línea vertical del padre (si no es raíz).
          El alto total del nodo es ~68px (py-3.5 del button interno + icono 40px),
          el centro vertical donde la línea L se conecta queda en ~36px. */}
      {nivel > 0 && (
        <div
          className="absolute border-l-2 border-borde-fuerte"
          style={{
            left: (nivel - 1) * 32 + 18,
            top: 0,
            height: esUltimo ? 36 : '100%',
          }}
        />
      )}

      {/* Línea horizontal hacia el nodo (si no es raíz) */}
      {nivel > 0 && (
        <div
          className="absolute border-t-2 border-borde-fuerte"
          style={{
            left: (nivel - 1) * 32 + 18,
            top: 36,
            width: 16,
          }}
        />
      )}

      {/* Nodo */}
      <div
        className="group relative flex items-stretch gap-4 my-2 mx-2 rounded-xl hover:bg-superficie-hover/60 transition-colors flex-wrap md:flex-nowrap"
        style={{ paddingLeft: nivel * 32 + 14, paddingRight: 14 }}
      >
        {/* Chevron principal: expande/contrae sub-sectores. Solo aparece
            si el sector tiene hijos — si no, queda como un punto inerte. */}
        <button
          type="button"
          onClick={() => tieneHijos && setExpandido(!expandido)}
          title={tieneHijos ? (expandido ? 'Contraer sub-sectores' : 'Expandir sub-sectores') : undefined}
          aria-label={tieneHijos ? (expandido ? 'Contraer' : 'Expandir') : 'Sector sin sub-sectores'}
          disabled={!tieneHijos}
          className="self-center w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-texto-terciario hover:text-texto-primario hover:bg-superficie-elevada transition-colors disabled:cursor-default disabled:hover:bg-transparent"
        >
          {tieneHijos
            ? (expandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />)
            : <div className="w-1.5 h-1.5 rounded-full bg-borde-fuerte" />}
        </button>

        {/* Identidad del sector. Clickeable solo si tiene miembros —
            toggle de la lista de empleados directos. */}
        <button
          type="button"
          onClick={() => cantidadMiembros > 0 && setMostrarPersonas(!mostrarPersonas)}
          disabled={cantidadMiembros === 0}
          title={cantidadMiembros > 0
            ? (mostrarPersonas ? 'Ocultar empleados' : 'Mostrar empleados')
            : undefined}
          className="flex items-center gap-3 py-3.5 flex-1 min-w-0 text-left disabled:cursor-default"
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: sector.color + '20', color: sector.color }}
          >
            {IconoSector && <IconoSector size={19} />}
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-texto-primario truncate hover:text-texto-marca transition-colors">
              {sector.nombre}
            </span>
            {/* Meta: envuelve por chunks (cada chunk con whitespace-nowrap)
                para evitar que "1 sub-sector" se rompa por palabras. */}
            <span className="text-xs text-texto-terciario leading-none inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              {cantidadMiembros > 0 && (
                <span className="inline-flex items-center gap-1 hover:text-texto-primario transition-colors whitespace-nowrap">
                  <Users size={11} />
                  {cantidadMiembros} miembro{cantidadMiembros > 1 ? 's' : ''}
                  {mostrarPersonas
                    ? <ChevronDown size={11} />
                    : <ChevronRight size={11} />}
                </span>
              )}
              {tieneHijos && (
                <span className="whitespace-nowrap">
                  {sector.hijos.length} sub-sector{sector.hijos.length > 1 ? 'es' : ''}
                </span>
              )}
              {cantidadMiembros === 0 && !tieneHijos && (
                <span className="italic text-texto-terciario/70">Sin miembros</span>
              )}
            </span>
          </div>
        </button>

        {/* Chips de turno + jefe. En pantallas estrechas se ocultan vía
            hidden md:/sm:inline-flex — no compiten con el nombre.
            shrink-0 evita que el chip se aplaste contra el botón nombre. */}
        <div className="self-center flex items-center gap-2 shrink-0">
          {turno && (
            <div
              className="hidden md:inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-2xl border border-borde-sutil bg-superficie-tarjeta whitespace-nowrap"
              title="Turno predeterminado del sector"
            >
              <Clock size={11} className="text-texto-terciario shrink-0" />
              {/* Nombre arriba, resumen del horario abajo — chip de dos
                  líneas cuando el horario existe. Mantenemos el chip
                  compacto cuando solo hay nombre. */}
              <div className="flex flex-col leading-tight">
                <span className="text-texto-primario">{turno.nombre}</span>
                {turnoHorario && (
                  <span className="text-texto-terciario text-[10px]">{turnoHorario}</span>
                )}
              </div>
            </div>
          )}
          {jefe && (
            <div
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap"
              style={{ backgroundColor: sector.color + '20', color: sector.color }}
              title="Jefe del sector"
            >
              <Crown size={11} />
              <span className="truncate max-w-24">{jefe.nombre} {jefe.apellido}</span>
            </div>
          )}
        </div>

        {/* Acciones (aparecen al hacer hover en el nodo) */}
        <div className="self-center flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Agregar sub-sector" icono={<Plus size={14} />} onClick={() => onAgregarHijo(sector.id)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo={t('comun.editar')} icono={<Pencil size={14} />} onClick={() => onEditar(sector)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo={t('comun.eliminar')} icono={<Trash2 size={14} />} onClick={() => onEliminar(sector)} />
        </div>
      </div>

      <AnimatePresence>
        {mostrarPersonas && cantidadMiembros > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            {personasSector.map((persona, idx) => (
              <div
                key={persona.id}
                className="relative flex items-center gap-2.5 py-2 text-xs text-texto-secundario"
                style={{ paddingLeft: (nivel + 1) * 32 + 14 }}
              >
                <div
                  className="absolute border-l border-dashed border-borde-fuerte/60"
                  style={{
                    left: nivel * 32 + 18,
                    top: 0,
                    height: idx === personasSector.length - 1 ? 20 : '100%',
                  }}
                />
                <div
                  className="absolute border-t border-dashed border-borde-fuerte/60"
                  style={{
                    left: nivel * 32 + 18,
                    top: 20,
                    width: 14,
                  }}
                />
                <Avatar nombre={`${persona.nombre} ${persona.apellido}`} tamano="xs" />
                <span className="text-texto-primario">{persona.nombre} {persona.apellido}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandido && tieneHijos && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {sector.hijos.map((hijo, idx) => (
              <NodoSector
                key={hijo.id}
                sector={hijo}
                nivel={nivel + 1}
                esUltimo={idx === sector.hijos.length - 1}
                miembrosPorSector={miembrosPorSector}
                miembros={miembros}
                asignaciones={asignaciones}
                turnosMap={turnosMap}
                onEditar={onEditar}
                onEliminar={onEliminar}
                onAgregarHijo={onAgregarHijo}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
