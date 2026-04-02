'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import {
  Plus, Pencil, Trash2, X, Check, ChevronRight, ChevronDown, Clock,
  Building, Briefcase, Users, UserPlus, Crown, AlertTriangle, RotateCcw,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { Avatar } from '@/componentes/ui/Avatar'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { SelectorIcono, obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { PALETA_COLORES_SECTOR } from '@/lib/colores_entidad'

/**
 * SeccionEstructura — Gestión de sectores (organigrama jerárquico) y puestos de trabajo.
 * Sectores: árbol con jerarquía padre-hijo, jefes, miembros asignados.
 * Puestos: catálogo vinculable a sectores específicos o globales.
 */

// ==================== TIPOS ====================

interface Sector {
  id: string
  nombre: string
  color: string
  icono: string
  activo: boolean
  orden: number
  padre_id: string | null
  jefe_id: string | null
  es_predefinido: boolean
}

interface Horario {
  id: string
  sector_id: string | null
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
}

interface Puesto {
  id: string
  nombre: string
  descripcion: string | null
  color: string
  activo: boolean
  orden: number
  sector_ids: string[]
}

interface MiembroSimple {
  id: string
  usuario_id: string
  nombre: string
  apellido: string
}

// Colores para sectores (centralizados en colores_entidad.ts)
const COLORES_SECTOR = PALETA_COLORES_SECTOR

// ==================== UTILIDADES DE ÁRBOL ====================

/** Construye el árbol jerárquico a partir de la lista plana */
function construirArbol(sectores: Sector[], padreId: string | null = null): (Sector & { hijos: Sector[] })[] {
  return sectores
    .filter(s => s.padre_id === padreId)
    .sort((a, b) => a.orden - b.orden)
    .map(s => ({
      ...s,
      hijos: construirArbol(sectores, s.id) as unknown as Sector[],
    }))
}

/** Obtiene todos los IDs descendientes de un sector (para prevenir referencias circulares) */
function obtenerDescendientes(sectores: Sector[], sectorId: string): Set<string> {
  const descendientes = new Set<string>()
  const buscar = (id: string) => {
    sectores.filter(s => s.padre_id === id).forEach(s => {
      descendientes.add(s.id)
      buscar(s.id)
    })
  }
  buscar(sectorId)
  return descendientes
}

/** Cuenta miembros por sector */
function contarMiembrosPorSector(asignaciones: { sector_id: string }[]): Map<string, number> {
  const conteo = new Map<string, number>()
  asignaciones.forEach(a => {
    conteo.set(a.sector_id, (conteo.get(a.sector_id) || 0) + 1)
  })
  return conteo
}

/** Obtiene miembros asignados a un sector */
function obtenerMiembrosDeSector(
  sectorId: string,
  asignaciones: { sector_id: string; miembro_id: string }[],
  miembros: MiembroSimple[]
): MiembroSimple[] {
  const miembroIds = asignaciones.filter(a => a.sector_id === sectorId).map(a => a.miembro_id)
  return miembros.filter(m => miembroIds.includes(m.id))
}

// ==================== COMPONENTE NODO DEL ÁRBOL ====================

interface PropsNodoSector {
  sector: Sector & { hijos: Sector[] }
  nivel: number
  esUltimo: boolean
  miembrosPorSector: Map<string, number>
  miembros: MiembroSimple[]
  asignaciones: { sector_id: string; miembro_id: string }[]
  sectores: Sector[]
  onEditar: (sector: Sector) => void
  onEliminar: (sector: Sector) => void
  onAgregarHijo: (padreId: string) => void
}

function NodoSector({ sector, nivel, esUltimo, miembrosPorSector, miembros, asignaciones, sectores, onEditar, onEliminar, onAgregarHijo }: PropsNodoSector) {
  const [expandido, setExpandido] = useState(nivel < 2)
  const [mostrarPersonas, setMostrarPersonas] = useState(false)
  const hijos = sector.hijos as unknown as (Sector & { hijos: Sector[] })[]
  const tieneHijos = hijos.length > 0
  const cantidadMiembros = miembrosPorSector.get(sector.id) || 0
  const jefe = sector.jefe_id ? miembros.find(m => m.usuario_id === sector.jefe_id) : null
  const personasSector = mostrarPersonas ? obtenerMiembrosDeSector(sector.id, asignaciones, miembros) : []

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
        className="group relative flex items-center gap-2.5 py-1.5 pr-2 rounded-lg hover:bg-superficie-hover/50 transition-colors"
        style={{ paddingLeft: nivel * 28 + 4 }}
      >
        {/* Botón expandir */}
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

        {/* Ícono del sector */}
        {(() => {
          const IconoSector = obtenerIcono(sector.icono || 'Building')
          return (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: sector.color + '20', color: sector.color }}>
              {IconoSector && <IconoSector size={16} />}
            </div>
          )
        })()}

        {/* Nombre + info */}
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
              {tieneHijos && `${(sector.hijos as unknown as Sector[]).length} sub-sector${(sector.hijos as unknown as Sector[]).length > 1 ? 'es' : ''}`}
            </span>
          </div>
        </Boton>

        {/* Jefe badge */}
        {jefe && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: sector.color + '20', color: sector.color }}>
            <Crown size={10} />
            <span className="truncate max-w-24">{jefe.nombre} {jefe.apellido}</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Acciones (hover) */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Agregar" icono={<Plus size={12} />} onClick={() => onAgregarHijo(sector.id)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Editar" icono={<Pencil size={12} />} onClick={() => onEditar(sector)} />
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar" icono={<Trash2 size={12} />} onClick={() => onEliminar(sector)} />
        </div>
      </div>

      {/* Personas del sector (expandible) */}
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
                {/* Línea vertical */}
                <div
                  className="absolute border-l border-dashed border-borde-fuerte/60"
                  style={{
                    left: nivel * 28 + 14,
                    top: 0,
                    height: idx === personasSector.length - 1 ? 14 : '100%',
                  }}
                />
                {/* Línea horizontal */}
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

      {/* Hijos */}
      <AnimatePresence>
        {expandido && tieneHijos && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {hijos.map((hijo, idx) => (
              <NodoSector
                key={hijo.id}
                sector={hijo}
                nivel={nivel + 1}
                esUltimo={idx === hijos.length - 1}
                miembrosPorSector={miembrosPorSector}
                miembros={miembros}
                asignaciones={asignaciones}
                sectores={sectores}
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

// ==================== COMPONENTE PRINCIPAL ====================

export function SeccionEstructura() {
  const { t } = useTraduccion()
  const { empresa } = useEmpresa()
  const supabase = crearClienteNavegador()

  const [sectores, setSectores] = useState<Sector[]>([])
  const [puestos, setPuestos] = useState<Puesto[]>([])
  const [miembros, setMiembros] = useState<MiembroSimple[]>([])
  const [asignaciones, setAsignaciones] = useState<{ sector_id: string; miembro_id: string }[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [horarioSectorId, setHorarioSectorId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState<'sectores' | 'puestos' | 'horarios'>('sectores')

  // Modales
  const [modalEditar, setModalEditar] = useState<Sector | null>(null)
  const [modalEliminar, setModalEliminar] = useState<Sector | null>(null)
  const [modalNuevo, setModalNuevo] = useState<{ padreId: string | null } | null>(null)
  const [modalNuevoPuesto, setModalNuevoPuesto] = useState(false)
  const [modalEliminarPuesto, setModalEliminarPuesto] = useState<Puesto | null>(null)
  const [modalReset, setModalReset] = useState(false)

  // Formulario sector
  const [formNombre, setFormNombre] = useState('')
  const [formColor, setFormColor] = useState('#6366f1')
  const [formIcono, setFormIcono] = useState('Building')
  const [formPadreId, setFormPadreId] = useState<string | null>(null)
  const [formJefeId, setFormJefeId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Formulario puesto
  const [puestoNombre, setPuestoNombre] = useState('')
  const [puestoDescripcion, setPuestoDescripcion] = useState('')
  const [puestoColor, setPuestoColor] = useState('#6366f1')

  // ==================== CARGA DE DATOS ====================

  const cargarDatos = useCallback(async () => {
    if (!empresa) return
    setCargando(true)

    const [sectoresRes, puestosRes, miembrosRes, horariosRes, asignacionesRes] = await Promise.all([
      supabase.from('sectores').select('*').eq('empresa_id', empresa.id).order('orden'),
      supabase.from('puestos').select('*').eq('empresa_id', empresa.id).order('orden'),
      supabase.from('miembros').select('id, usuario_id, perfiles(nombre, apellido)').eq('empresa_id', empresa.id),
      supabase.from('horarios').select('*').eq('empresa_id', empresa.id).order('dia_semana'),
      fetch('/api/miembros-sectores').then(r => r.ok ? r.json() : []),
    ])

    setSectores(sectoresRes.data || [])
    setPuestos(puestosRes.data || [])
    setHorarios(horariosRes.data || [])
    setAsignaciones(asignacionesRes || [])

    // Mapear miembros con perfiles (query separada porque el join falla)
    if (miembrosRes.data) {
      const ids = miembrosRes.data.map(m => m.usuario_id)
      const { data: perfilesData } = await supabase.from('perfiles').select('id, nombre, apellido').in('id', ids)
      const perfilesMap = new Map((perfilesData || []).map(p => [p.id, p]))

      setMiembros(miembrosRes.data.map(m => {
        const perfil = perfilesMap.get(m.usuario_id)
        return {
          id: m.id,
          usuario_id: m.usuario_id,
          nombre: perfil?.nombre || 'Usuario',
          apellido: perfil?.apellido || '',
        }
      }))
    }

    setCargando(false)
  }, [empresa, supabase])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ==================== ÁRBOL ====================

  const arbol = useMemo(() => construirArbol(sectores), [sectores])
  const miembrosPorSector = useMemo(() => contarMiembrosPorSector(asignaciones), [asignaciones])

  const totalAsignados = new Set(asignaciones.map(a => a.miembro_id)).size
  const sinAsignar = miembros.length - totalAsignados

  // ==================== ACCIONES SECTORES ====================

  const abrirNuevo = (padreId: string | null) => {
    setFormNombre('')
    setFormColor(COLORES_SECTOR[Math.floor(Math.random() * COLORES_SECTOR.length)])
    setFormIcono('Building')
    setFormPadreId(padreId)
    setFormJefeId(null)
    setModalNuevo({ padreId })
  }

  const abrirEditar = (sector: Sector) => {
    setFormNombre(sector.nombre)
    setFormColor(sector.color)
    setFormIcono(sector.icono || 'Building')
    setFormPadreId(sector.padre_id)
    setFormJefeId(sector.jefe_id)
    setModalEditar(sector)
  }

  const guardarSector = async () => {
    if (!formNombre.trim() || !empresa) return
    setGuardando(true)

    if (modalEditar) {
      await supabase.from('sectores').update({
        nombre: formNombre.trim(),
        color: formColor,
        icono: formIcono,
        padre_id: formPadreId,
        jefe_id: formJefeId,
      }).eq('id', modalEditar.id)
      setModalEditar(null)
    } else if (modalNuevo) {
      await supabase.from('sectores').insert({
        empresa_id: empresa.id,
        nombre: formNombre.trim(),
        color: formColor,
        icono: formIcono,
        padre_id: modalNuevo.padreId,
        jefe_id: formJefeId,
        orden: sectores.length,
      })
      setModalNuevo(null)
    }

    setGuardando(false)
    cargarDatos()
  }

  const eliminarSector = async () => {
    if (!modalEliminar) return
    setGuardando(true)

    // Promover hijos a nivel raíz
    await supabase.from('sectores')
      .update({ padre_id: modalEliminar.padre_id })
      .eq('padre_id', modalEliminar.id)

    // Desasignar miembros de este sector (vía API)
    await fetch('/api/miembros-sectores', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sector_id: modalEliminar.id }),
    })

    // Eliminar sector
    await supabase.from('sectores').delete().eq('id', modalEliminar.id)

    setGuardando(false)
    setModalEliminar(null)
    cargarDatos()
  }

  // Opciones de padre (excluir el sector actual y sus descendientes)
  const opcionesPadre = useMemo(() => {
    const excluidos = modalEditar ? obtenerDescendientes(sectores, modalEditar.id) : new Set<string>()
    if (modalEditar) excluidos.add(modalEditar.id)

    return [
      { valor: '__ninguno__', etiqueta: '— Sin sector padre (raíz)' },
      ...sectores
        .filter(s => !excluidos.has(s.id))
        .map(s => ({ valor: s.id, etiqueta: s.nombre }))
    ]
  }, [sectores, modalEditar])

  const opcionesJefe = useMemo(() => [
    { valor: '__ninguno__', etiqueta: '— Sin jefe asignado' },
    ...miembros.map(m => ({ valor: m.usuario_id, etiqueta: `${m.nombre} ${m.apellido}` }))
  ], [miembros])

  // ==================== ACCIONES PUESTOS ====================

  const guardarPuesto = async () => {
    if (!puestoNombre.trim() || !empresa) return
    setGuardando(true)

    await supabase.from('puestos').insert({
      empresa_id: empresa.id,
      nombre: puestoNombre.trim(),
      descripcion: puestoDescripcion.trim() || null,
      color: puestoColor,
      orden: puestos.length,
    })

    setPuestoNombre('')
    setPuestoDescripcion('')
    setGuardando(false)
    setModalNuevoPuesto(false)
    cargarDatos()
  }

  const eliminarPuesto = async () => {
    if (!modalEliminarPuesto) return
    setGuardando(true)
    await supabase.from('puestos').delete().eq('id', modalEliminarPuesto.id)
    setGuardando(false)
    setModalEliminarPuesto(null)
    cargarDatos()
  }

  // ==================== HORARIOS ====================

  const DIAS_SEMANA = [
    { valor: 0, etiqueta: 'Lunes' },
    { valor: 1, etiqueta: 'Martes' },
    { valor: 2, etiqueta: 'Miércoles' },
    { valor: 3, etiqueta: 'Jueves' },
    { valor: 4, etiqueta: 'Viernes' },
    { valor: 5, etiqueta: 'Sábado' },
    { valor: 6, etiqueta: 'Domingo' },
  ]

  const horariosDelSector = useMemo(() => {
    return horarios.filter(h =>
      horarioSectorId ? h.sector_id === horarioSectorId : h.sector_id === null
    )
  }, [horarios, horarioSectorId])

  const calcularHoras = (inicio: string, fin: string): string => {
    const [hi, mi] = inicio.split(':').map(Number)
    const [hf, mf] = fin.split(':').map(Number)
    const minutos = (hf * 60 + mf) - (hi * 60 + mi)
    return minutos > 0 ? (minutos / 60).toFixed(1) : '0'
  }

  const guardarHorario = async (diaSemana: number, datos: { activo: boolean; hora_inicio: string; hora_fin: string }) => {
    if (!empresa) return

    const existente = horariosDelSector.find(h => h.dia_semana === diaSemana)

    if (existente) {
      await supabase.from('horarios').update({
        activo: datos.activo,
        hora_inicio: datos.hora_inicio,
        hora_fin: datos.hora_fin,
      }).eq('id', existente.id)
    } else {
      await supabase.from('horarios').insert({
        empresa_id: empresa.id,
        sector_id: horarioSectorId,
        dia_semana: diaSemana,
        activo: datos.activo,
        hora_inicio: datos.hora_inicio,
        hora_fin: datos.hora_fin,
      })
    }

    cargarDatos()
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      <EncabezadoSeccion
        titulo="Estructura organizacional"
        descripcion="Organizá tu empresa en sectores (departamentos) y puestos de trabajo. Los sectores pueden tener jerarquía de árbol."
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-superficie-hover/50 rounded-lg p-1">
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<Building size={15} />}
          onClick={() => setTab('sectores')}
          className={tab === 'sectores' ? '!bg-superficie-tarjeta !text-texto-primario !shadow-sm' : '!text-texto-terciario'}
        >
          Sectores
          <span className="text-xs bg-superficie-hover px-1.5 py-0.5 rounded-full">{sectores.length}</span>
        </Boton>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<Briefcase size={15} />}
          onClick={() => setTab('puestos')}
          className={tab === 'puestos' ? '!bg-superficie-tarjeta !text-texto-primario !shadow-sm' : '!text-texto-terciario'}
        >
          Puestos
          <span className="text-xs bg-superficie-hover px-1.5 py-0.5 rounded-full">{puestos.length}</span>
        </Boton>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<Clock size={15} />}
          onClick={() => setTab('horarios')}
          className={tab === 'horarios' ? '!bg-superficie-tarjeta !text-texto-primario !shadow-sm' : '!text-texto-terciario'}
        >
          Horarios
        </Boton>
      </div>

      {/* ==================== TAB SECTORES ==================== */}
      {tab === 'sectores' && (
        <>
          {/* Estadísticas */}
          <div className="flex gap-4 text-xs text-texto-terciario">
            <span>{sectores.filter(s => s.activo).length} sectores activos</span>
            <span>·</span>
            <span>{totalAsignados} asignados</span>
            {sinAsignar > 0 && (
              <>
                <span>·</span>
                <span className="text-insignia-advertencia flex items-center gap-1">
                  <AlertTriangle size={11} />
                  {sinAsignar} sin sector
                </span>
              </>
            )}
          </div>

          {/* Árbol */}
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-borde-sutil flex items-center justify-between">
              <h3 className="text-sm font-semibold text-texto-primario">Organigrama</h3>
              <Boton variante="fantasma" tamano="sm" icono={<Plus size={14} />} onClick={() => abrirNuevo(null)}>
                Nuevo sector
              </Boton>
            </div>

            {cargando ? (
              <CargadorSeccion />
            ) : arbol.length === 0 ? (
              <div className="p-8 text-center text-sm text-texto-terciario">
                No hay sectores. Creá el primero para armar tu organigrama.
              </div>
            ) : (
              <div className="py-2">
                {arbol.map((sector, idx) => (
                  <NodoSector
                    key={sector.id}
                    sector={sector as Sector & { hijos: Sector[] }}
                    nivel={0}
                    esUltimo={idx === arbol.length - 1}
                    miembrosPorSector={miembrosPorSector}
                    miembros={miembros}
                    asignaciones={asignaciones}
                    sectores={sectores}
                    onEditar={abrirEditar}
                    onEliminar={(s) => setModalEliminar(s)}
                    onAgregarHijo={(padreId) => abrirNuevo(padreId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Botón reset */}
          <div className="flex justify-end mt-3">
            <Boton
              variante="fantasma"
              tamano="sm"
              icono={<RotateCcw size={13} />}
              onClick={() => setModalReset(true)}
            >
              Restablecer predefinidos
            </Boton>
          </div>
        </>
      )}

      {/* ==================== TAB PUESTOS ==================== */}
      {tab === 'puestos' && (
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-borde-sutil flex items-center justify-between">
            <h3 className="text-sm font-semibold text-texto-primario">Puestos de trabajo</h3>
            <Boton variante="fantasma" tamano="sm" icono={<Plus size={14} />} onClick={() => setModalNuevoPuesto(true)}>
              Nuevo puesto
            </Boton>
          </div>

          {puestos.length === 0 ? (
            <div className="p-8 text-center text-sm text-texto-terciario">
              No hay puestos de trabajo. Creá el primero para poder asignarlos a tus colaboradores.
            </div>
          ) : (
            <div className="divide-y divide-borde-sutil">
              {puestos.map(puesto => (
                <div key={puesto.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-superficie-hover/50 transition-colors">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: puesto.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-texto-primario">{puesto.nombre}</span>
                    {puesto.descripcion && (
                      <p className="text-xs text-texto-terciario truncate">{puesto.descripcion}</p>
                    )}
                  </div>
                  {puesto.sector_ids && puesto.sector_ids.length > 0 && (
                    <span className="text-xs text-texto-terciario">
                      {puesto.sector_ids.length} sector{puesto.sector_ids.length > 1 ? 'es' : ''}
                    </span>
                  )}
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar puesto" icono={<Trash2 size={12} />} onClick={() => setModalEliminarPuesto(puesto)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB HORARIOS ==================== */}
      {tab === 'horarios' && (
        <div className="space-y-4">
          {/* Selector de sector */}
          <div className="flex items-center gap-3">
            <Select
              etiqueta={t('configuracion.estructura.horario_de')}
              opciones={[
                { valor: '__general__', etiqueta: 'General (toda la empresa)' },
                ...sectores.map(s => ({ valor: s.id, etiqueta: s.nombre })),
              ]}
              valor={horarioSectorId || '__general__'}
              onChange={(v) => setHorarioSectorId(v === '__general__' ? null : v)}
            />
          </div>

          <p className="text-xs text-texto-terciario">
            {horarioSectorId
              ? 'Este horario aplica solo a este sector. Si no se define, hereda el horario general.'
              : 'Este es el horario por defecto para toda la empresa. Cada sector puede tener uno propio.'}
          </p>

          {/* Grilla de horarios */}
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-borde-sutil">
              <h3 className="text-sm font-semibold text-texto-primario">
                {horarioSectorId ? `Horario — ${sectores.find(s => s.id === horarioSectorId)?.nombre}` : 'Horario general'}
              </h3>
            </div>

            <div className="divide-y divide-borde-sutil">
              {DIAS_SEMANA.map(dia => {
                const horario = horariosDelSector.find(h => h.dia_semana === dia.valor)
                const activo = horario?.activo ?? (dia.valor <= 4) // L-V activos por defecto
                const inicio = horario?.hora_inicio || '09:00'
                const fin = horario?.hora_fin || '18:00'

                return (
                  <div key={dia.valor} className={`flex items-center gap-4 px-4 py-3 ${!activo ? 'opacity-40' : ''}`}>
                    {/* Toggle día */}
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      soloIcono
                      titulo={activo ? 'Desactivar día' : 'Activar día'}
                      onClick={() => guardarHorario(dia.valor, { activo: !activo, hora_inicio: inicio, hora_fin: fin })}
                      icono={activo ? <Check size={12} className="text-white" /> : undefined}
                      className={`!w-5 !h-5 !rounded !border-2 ${
                        activo ? '!bg-texto-marca !border-texto-marca' : '!bg-transparent !border-borde-fuerte'
                      }`}
                    />

                    {/* Nombre del día */}
                    <span className="text-sm font-medium text-texto-primario w-24">{dia.etiqueta}</span>

                    {/* Horas */}
                    {activo ? (
                      <div className="flex items-center gap-2 flex-1">
                        <SelectorHora
                          valor={inicio}
                          onChange={(v) => guardarHorario(dia.valor, { activo, hora_inicio: v || '09:00', hora_fin: fin })}
                        />
                        <span className="text-xs text-texto-terciario">a</span>
                        <SelectorHora
                          valor={fin}
                          onChange={(v) => guardarHorario(dia.valor, { activo, hora_inicio: inicio, hora_fin: v || '18:00' })}
                        />
                        <span className="text-xs text-texto-terciario ml-2">
                          {calcularHoras(inicio, fin)}h
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-texto-terciario italic">No laboral</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Info de horario flexible */}
            <div className="px-4 py-3 bg-superficie-hover/30 border-t border-borde-sutil">
              <p className="text-xs text-texto-terciario">
                Los colaboradores con <strong>horario flexible</strong> habilitado en su perfil no están sujetos a estos horarios para el fichaje, pero siguen contando como horas trabajadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL SECTOR (crear/editar) ==================== */}
      <Modal
        abierto={!!modalEditar || !!modalNuevo}
        onCerrar={() => { setModalEditar(null); setModalNuevo(null) }}
        titulo={modalEditar ? 'Editar sector' : 'Nuevo sector'}
        tamano="sm"
        acciones={
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => { setModalEditar(null); setModalNuevo(null) }}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarSector} cargando={guardando}>{modalEditar ? 'Guardar' : 'Crear'}</Boton>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            tipo="text"
            etiqueta={t('configuracion.estructura.nombre_sector')}
            placeholder="Ej: Ventas, Soporte, RRHH..."
            value={formNombre}
            onChange={(e) => setFormNombre(e.target.value)}
            formato="nombre_empresa"
            icono={<Building size={16} />}
          />

          {/* Ícono */}
          <SelectorIcono
            etiqueta={t('comun.icono')}
            valor={formIcono}
            onChange={setFormIcono}
          />

          {/* Selector de color */}
          <div>
            <label className="text-sm font-medium text-texto-secundario block mb-2">Color</label>
            <div className="flex flex-wrap items-center gap-2">
              {COLORES_SECTOR.map(c => (
                <Boton
                  key={c}
                  variante="fantasma"
                  soloIcono
                  redondeado
                  icono={formColor === c ? <Check size={14} className="text-white" /> : undefined}
                  onClick={() => setFormColor(c)}
                  className="w-7 h-7"
                  style={{
                    backgroundColor: c,
                    borderColor: formColor === c ? 'white' : 'transparent',
                    boxShadow: formColor === c ? `0 0 0 2px ${c}` : 'none',
                  }}
                />
              ))}
              {/* Cuentagotas / color custom */}
              <div className="relative">
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer border-2 border-dashed border-borde-fuerte appearance-none bg-transparent p-0"
                  style={{ WebkitAppearance: 'none' }}
                  title="Color personalizado"
                />
              </div>
            </div>
          </div>

          <Select
            etiqueta={t('configuracion.estructura.sector_padre')}
            opciones={opcionesPadre}
            valor={formPadreId || '__ninguno__'}
            onChange={(v) => setFormPadreId(v === '__ninguno__' ? null : v)}
          />

          <Select
            etiqueta={t('configuracion.estructura.jefe_sector')}
            opciones={opcionesJefe}
            valor={formJefeId || '__ninguno__'}
            onChange={(v) => setFormJefeId(v === '__ninguno__' ? null : v)}
          />
        </div>
      </Modal>

      {/* ==================== MODAL ELIMINAR SECTOR ==================== */}
      {modalEliminar && (() => {
        const cantMiembros = miembrosPorSector.get(modalEliminar.id) || 0
        const cantHijos = sectores.filter(s => s.padre_id === modalEliminar.id).length

        return (
          <ModalConfirmacion
            abierto={true}
            onCerrar={() => setModalEliminar(null)}
            onConfirmar={eliminarSector}
            titulo={`¿Eliminar "${modalEliminar.nombre}"?`}
            descripcion={
              cantMiembros > 0 || cantHijos > 0
                ? `Este sector tiene ${cantMiembros} persona${cantMiembros !== 1 ? 's' : ''} asignada${cantMiembros !== 1 ? 's' : ''}${cantHijos > 0 ? ` y ${cantHijos} sub-sector${cantHijos !== 1 ? 'es' : ''}` : ''}. Las personas serán desasignadas y los sub-sectores pasarán al nivel superior.`
                : 'Se eliminará el sector permanentemente.'
            }
            tipo="peligro"
            etiquetaConfirmar="Eliminar sector"
            cargando={guardando}
          />
        )
      })()}

      {/* ==================== MODAL NUEVO PUESTO ==================== */}
      <Modal
        abierto={modalNuevoPuesto}
        onCerrar={() => setModalNuevoPuesto(false)}
        titulo="Nuevo puesto de trabajo"
        tamano="sm"
        acciones={
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setModalNuevoPuesto(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarPuesto} cargando={guardando}>Crear</Boton>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            tipo="text"
            etiqueta={t('configuracion.estructura.nombre_puesto')}
            placeholder="Ej: Director comercial, Vendedor, Soporte técnico..."
            value={puestoNombre}
            onChange={(e) => setPuestoNombre(e.target.value)}
            formato="nombre_empresa"
            icono={<Briefcase size={16} />}
          />
          <Input
            tipo="text"
            etiqueta={`${t('comun.descripcion')} (${t('comun.opcional')})`}
            placeholder="Breve descripción del puesto..."
            value={puestoDescripcion}
            onChange={(e) => setPuestoDescripcion(e.target.value)}
          />
          <div>
            <label className="text-sm font-medium text-texto-secundario block mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORES_SECTOR.map(c => (
                <Boton
                  key={c}
                  variante="fantasma"
                  soloIcono
                  redondeado
                  icono={puestoColor === c ? <Check size={14} className="text-white" /> : undefined}
                  onClick={() => setPuestoColor(c)}
                  className="w-7 h-7"
                  style={{
                    backgroundColor: c,
                    borderColor: puestoColor === c ? 'white' : 'transparent',
                    boxShadow: puestoColor === c ? `0 0 0 2px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ==================== MODAL ELIMINAR PUESTO ==================== */}
      {modalEliminarPuesto && (
        <ModalConfirmacion
          abierto={true}
          onCerrar={() => setModalEliminarPuesto(null)}
          onConfirmar={eliminarPuesto}
          titulo={`¿Eliminar "${modalEliminarPuesto.nombre}"?`}
          descripcion="Se eliminará el puesto permanentemente. Los colaboradores que lo tengan asignado quedarán sin puesto."
          tipo="peligro"
          etiquetaConfirmar="Eliminar puesto"
          cargando={guardando}
        />
      )}

      {/* ==================== MODAL RESET ==================== */}
      <ModalConfirmacion
        abierto={modalReset}
        onCerrar={() => setModalReset(false)}
        onConfirmar={async () => {
          if (!empresa) return
          setGuardando(true)

          // Eliminar todos los sectores actuales
          await fetch('/api/miembros-sectores', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ all: true }),
          })
          await supabase.from('sectores').delete().eq('empresa_id', empresa.id)
          await supabase.from('puestos').delete().eq('empresa_id', empresa.id)

          // Recrear predefinidos
          const predefinidos = [
            { nombre: 'General', color: '#737373', icono: 'Building', orden: 0 },
            { nombre: 'Comercio', color: '#f59e0b', icono: 'ShoppingCart', orden: 1 },
            { nombre: 'Industria', color: '#3b82f6', icono: 'Factory', orden: 2 },
            { nombre: 'Servicios', color: '#8b5cf6', icono: 'Wrench', orden: 3 },
            { nombre: 'Tecnología', color: '#06b6d4', icono: 'Code', orden: 4 },
            { nombre: 'Salud', color: '#10b981', icono: 'Heart', orden: 5 },
            { nombre: 'Educación', color: '#6366f1', icono: 'GraduationCap', orden: 6 },
          ]

          await supabase.from('sectores').insert(
            predefinidos.map(s => ({
              empresa_id: empresa.id,
              ...s,
              es_predefinido: true,
            }))
          )

          setGuardando(false)
          setModalReset(false)
          cargarDatos()
        }}
        titulo="¿Restablecer estructura?"
        descripcion="Se eliminarán todos los sectores y puestos actuales y se restaurarán los 7 sectores predefinidos. Las asignaciones de personas se perderán. Esta acción no se puede deshacer."
        tipo="advertencia"
        etiquetaConfirmar="Restablecer"
        cargando={guardando}
      />
    </div>
  )
}
