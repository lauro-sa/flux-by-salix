'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Crown, Clock } from 'lucide-react'
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
  const [expandido, setExpandido] = useState(nivel < 2)
  const [mostrarPersonas, setMostrarPersonas] = useState(false)
  const tieneHijos = sector.hijos.length > 0
  const cantidadMiembros = miembrosPorSector.get(sector.id) || 0
  const jefe = sector.jefe_id ? miembros.find(m => m.usuario_id === sector.jefe_id) : null
  const personasSector = mostrarPersonas ? obtenerMiembrosDeSector(sector.id, asignaciones, miembros) : []
  const IconoSector = obtenerIcono(sector.icono || 'Building')
  // Turno predeterminado del sector. Mostramos nombre + resumen del
  // horario ("Taller · L-V 09:00-18:00") como chip al lado del jefe.
  // Si no hay turno asignado, no aparece chip.
  const turno = sector.turno_id && turnosMap ? turnosMap.get(sector.turno_id) ?? null : null
  const turnoHorario = turno ? resumirDias(turno.dias) : null

  return (
    <div className="relative">
      {/* Línea vertical del padre (si no es raíz) */}
      {nivel > 0 && (
        <div
          className="absolute border-l-2 border-borde-fuerte"
          style={{
            left: (nivel - 1) * 32 + 16,
            top: 0,
            height: esUltimo ? 28 : '100%',
          }}
        />
      )}

      {/* Línea horizontal hacia el nodo (si no es raíz) */}
      {nivel > 0 && (
        <div
          className="absolute border-t-2 border-borde-fuerte"
          style={{
            left: (nivel - 1) * 32 + 16,
            top: 28,
            width: 16,
          }}
        />
      )}

      {/* Nodo */}
      <div
        className="group relative flex items-center gap-3 py-3 pr-3 my-1 mx-1 rounded-lg hover:bg-superficie-hover/60 transition-colors"
        style={{ paddingLeft: nivel * 32 + 10 }}
      >
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          titulo="Expandir"
          onClick={() => tieneHijos ? setExpandido(!expandido) : setMostrarPersonas(!mostrarPersonas)}
          icono={
            (tieneHijos || cantidadMiembros > 0)
              ? (expandido || mostrarPersonas ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
              : <div className="w-1.5 h-1.5 rounded-full bg-borde-fuerte" />
          }
          className="!w-6 !h-6 shrink-0"
        />

        <div
          className="w-9 h-9 rounded-card flex items-center justify-center shrink-0"
          style={{ backgroundColor: sector.color + '20', color: sector.color }}
        >
          {IconoSector && <IconoSector size={18} />}
        </div>

        <Boton
          variante="fantasma"
          onClick={() => setMostrarPersonas(!mostrarPersonas)}
          className="!p-0 min-w-0 !justify-start !text-left"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-semibold text-texto-primario truncate hover:text-texto-marca transition-colors">
              {sector.nombre}
            </span>
            <span className="text-xs text-texto-terciario">
              {cantidadMiembros > 0 && `${cantidadMiembros} miembro${cantidadMiembros > 1 ? 's' : ''}`}
              {cantidadMiembros > 0 && tieneHijos && ' · '}
              {tieneHijos && `${sector.hijos.length} sub-sector${sector.hijos.length > 1 ? 'es' : ''}`}
              {cantidadMiembros === 0 && !tieneHijos && (
                <span className="italic text-texto-terciario/70">Sin miembros</span>
              )}
            </span>
          </div>
        </Boton>

        <div className="flex items-center gap-2 ml-1">
          {turno && (
            <div
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-borde-sutil bg-superficie-tarjeta text-texto-secundario"
              title="Turno predeterminado del sector"
            >
              <Clock size={11} className="text-texto-terciario shrink-0" />
              <span className="truncate max-w-28 text-texto-primario">{turno.nombre}</span>
              {turnoHorario && (
                <>
                  <span className="text-texto-terciario">·</span>
                  <span className="text-texto-terciario truncate">{turnoHorario}</span>
                </>
              )}
            </div>
          )}
          {jefe && (
            <div
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: sector.color + '20', color: sector.color }}
              title="Jefe del sector"
            >
              <Crown size={11} />
              <span className="truncate max-w-24">{jefe.nombre} {jefe.apellido}</span>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Agregar sub-sector" icono={<Plus size={13} />} onClick={() => onAgregarHijo(sector.id)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo={t('comun.editar')} icono={<Pencil size={13} />} onClick={() => onEditar(sector)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo={t('comun.eliminar')} icono={<Trash2 size={13} />} onClick={() => onEliminar(sector)} />
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
                className="relative flex items-center gap-2 py-1.5 text-xs text-texto-secundario"
                style={{ paddingLeft: (nivel + 1) * 32 + 6 }}
              >
                <div
                  className="absolute border-l border-dashed border-borde-fuerte/60"
                  style={{
                    left: nivel * 32 + 16,
                    top: 0,
                    height: idx === personasSector.length - 1 ? 16 : '100%',
                  }}
                />
                <div
                  className="absolute border-t border-dashed border-borde-fuerte/60"
                  style={{
                    left: nivel * 32 + 16,
                    top: 16,
                    width: 12,
                  }}
                />
                <Avatar nombre={`${persona.nombre} ${persona.apellido}`} tamano="xs" />
                <span>{persona.nombre} {persona.apellido}</span>
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
