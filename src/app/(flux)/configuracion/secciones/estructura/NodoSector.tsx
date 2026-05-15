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
  // Un solo estado para mostrar/ocultar TODO lo del sector (miembros
  // propios + sub-sectores). Antes había dos toggles independientes
  // (`expandido` para hijos y `mostrarPersonas` para personas) — eso
  // hacía que un sector con miembros propios Y sub-sectores nunca
  // mostrara las personas al usar el chevron principal. Ahora un click
  // abre/cierra el sector entero.
  const [abierto, setAbierto] = useState(nivel < 2)
  const tieneHijos = sector.hijos.length > 0
  const cantidadMiembros = miembrosPorSector.get(sector.id) || 0
  const tieneContenido = tieneHijos || cantidadMiembros > 0
  const jefe = sector.jefe_id ? miembros.find(m => m.usuario_id === sector.jefe_id) : null
  const personasSector = abierto && cantidadMiembros > 0
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
        className="group relative flex items-stretch gap-3 my-1.5 mx-2 rounded-xl hover:bg-superficie-hover/60 transition-colors"
        style={{ paddingLeft: nivel * 32 + 12, paddingRight: 12 }}
      >
        {/* Chevron expandir/contraer (controla miembros propios + sub-sectores) */}
        <button
          type="button"
          onClick={() => tieneContenido && setAbierto(!abierto)}
          title={tieneContenido ? (abierto ? 'Contraer' : 'Expandir') : undefined}
          aria-label={tieneContenido ? (abierto ? 'Contraer' : 'Expandir') : 'Sector vacío'}
          disabled={!tieneContenido}
          className="self-center w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-texto-terciario hover:text-texto-primario hover:bg-superficie-elevada transition-colors disabled:cursor-default disabled:hover:bg-transparent"
        >
          {tieneContenido
            ? (abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />)
            : <div className="w-1.5 h-1.5 rounded-full bg-borde-fuerte" />}
        </button>

        {/* Identidad del sector (icono + nombre + meta) — también toggle del contenido */}
        <button
          type="button"
          onClick={() => tieneContenido && setAbierto(!abierto)}
          className="flex items-center gap-3 py-3.5 min-w-0 text-left"
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: sector.color + '20', color: sector.color }}
          >
            {IconoSector && <IconoSector size={19} />}
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-sm font-semibold text-texto-primario truncate hover:text-texto-marca transition-colors">
              {sector.nombre}
            </span>
            <span className="text-xs text-texto-terciario leading-none">
              {cantidadMiembros > 0 && `${cantidadMiembros} miembro${cantidadMiembros > 1 ? 's' : ''}`}
              {cantidadMiembros > 0 && tieneHijos && ' · '}
              {tieneHijos && `${sector.hijos.length} sub-sector${sector.hijos.length > 1 ? 'es' : ''}`}
              {cantidadMiembros === 0 && !tieneHijos && (
                <span className="italic text-texto-terciario/70">Sin miembros</span>
              )}
            </span>
          </div>
        </button>

        {/* Chips de turno + jefe */}
        <div className="self-center flex items-center gap-2 ml-1">
          {turno && (
            <div
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-borde-sutil bg-superficie-tarjeta text-texto-secundario"
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
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ backgroundColor: sector.color + '20', color: sector.color }}
              title="Jefe del sector"
            >
              <Crown size={11} />
              <span className="truncate max-w-24">{jefe.nombre} {jefe.apellido}</span>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Acciones (aparecen al hacer hover en el nodo) */}
        <div className="self-center flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Agregar sub-sector" icono={<Plus size={14} />} onClick={() => onAgregarHijo(sector.id)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo={t('comun.editar')} icono={<Pencil size={14} />} onClick={() => onEditar(sector)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo={t('comun.eliminar')} icono={<Trash2 size={14} />} onClick={() => onEliminar(sector)} />
        </div>
      </div>

      <AnimatePresence>
        {abierto && cantidadMiembros > 0 && (
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
        {abierto && tieneHijos && (
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
