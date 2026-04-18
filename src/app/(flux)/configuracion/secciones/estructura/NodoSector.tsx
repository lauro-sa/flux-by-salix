'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Crown } from 'lucide-react'
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

interface PropsNodoSector {
  sector: SectorConHijos
  nivel: number
  esUltimo: boolean
  miembrosPorSector: Map<string, number>
  miembros: MiembroSimple[]
  asignaciones: AsignacionMiembroSector[]
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

  return (
    <div className="relative">
      {/* Línea vertical del padre (si no es raíz) */}
      {nivel > 0 && (
        <div
          className="absolute border-l-2 border-borde-fuerte"
          style={{
            left: (nivel - 1) * 28 + 14,
            top: 0,
            height: esUltimo ? 20 : '100%',
          }}
        />
      )}

      {/* Línea horizontal hacia el nodo (si no es raíz) */}
      {nivel > 0 && (
        <div
          className="absolute border-t-2 border-borde-fuerte"
          style={{
            left: (nivel - 1) * 28 + 14,
            top: 20,
            width: 14,
          }}
        />
      )}

      {/* Nodo */}
      <div
        className="group relative flex items-center gap-2.5 py-1.5 pr-2 rounded-card hover:bg-superficie-hover/50 transition-colors"
        style={{ paddingLeft: nivel * 28 + 4 }}
      >
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          titulo="Expandir"
          onClick={() => tieneHijos ? setExpandido(!expandido) : setMostrarPersonas(!mostrarPersonas)}
          icono={
            (tieneHijos || cantidadMiembros > 0)
              ? (expandido || mostrarPersonas ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
              : <div className="w-1.5 h-1.5 rounded-full bg-borde-fuerte" />
          }
          className="!w-5 !h-5 shrink-0"
        />

        <div
          className="w-8 h-8 rounded-card flex items-center justify-center shrink-0"
          style={{ backgroundColor: sector.color + '20', color: sector.color }}
        >
          {IconoSector && <IconoSector size={16} />}
        </div>

        <Boton
          variante="fantasma"
          onClick={() => setMostrarPersonas(!mostrarPersonas)}
          className="!p-0 min-w-0 !justify-start !text-left"
        >
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-texto-primario truncate hover:text-texto-marca transition-colors">
              {sector.nombre}
            </span>
            <span className="text-xs text-texto-terciario">
              {cantidadMiembros > 0 && `${cantidadMiembros} miembro${cantidadMiembros > 1 ? 's' : ''}`}
              {cantidadMiembros > 0 && tieneHijos && ' · '}
              {tieneHijos && `${sector.hijos.length} sub-sector${sector.hijos.length > 1 ? 'es' : ''}`}
            </span>
          </div>
        </Boton>

        {jefe && (
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: sector.color + '20', color: sector.color }}
          >
            <Crown size={10} />
            <span className="truncate max-w-24">{jefe.nombre} {jefe.apellido}</span>
          </div>
        )}

        <div className="flex-1" />

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Agregar" icono={<Plus size={12} />} onClick={() => onAgregarHijo(sector.id)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo={t('comun.editar')} icono={<Pencil size={12} />} onClick={() => onEditar(sector)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo={t('comun.eliminar')} icono={<Trash2 size={12} />} onClick={() => onEliminar(sector)} />
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
                className="relative flex items-center gap-2 py-1 text-xs text-texto-secundario"
                style={{ paddingLeft: (nivel + 1) * 28 + 4 }}
              >
                <div
                  className="absolute border-l border-dashed border-borde-fuerte/60"
                  style={{
                    left: nivel * 28 + 14,
                    top: 0,
                    height: idx === personasSector.length - 1 ? 14 : '100%',
                  }}
                />
                <div
                  className="absolute border-t border-dashed border-borde-fuerte/60"
                  style={{
                    left: nivel * 28 + 14,
                    top: 14,
                    width: 10,
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
