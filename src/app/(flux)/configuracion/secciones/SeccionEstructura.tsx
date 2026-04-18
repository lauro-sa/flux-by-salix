'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import {
  Plus, Trash2, Check, Clock,
  Building, Briefcase, AlertTriangle, RotateCcw,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { MiniSelectorIcono } from '@/componentes/ui/MiniSelectorIcono'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { PALETA_COLORES_SECTOR } from '@/lib/colores_entidad'
import {
  construirArbol,
  obtenerDescendientes,
  contarMiembrosPorSector,
  type Sector,
  type Puesto,
  type MiembroSimple,
  type Horario,
  type AsignacionMiembroSector,
} from './estructura/tipos'
import { NodoSector } from './estructura/NodoSector'
import { TabHorarios } from './estructura/TabHorarios'

/**
 * SeccionEstructura — Gestión de sectores (organigrama jerárquico), puestos y horarios laborales.
 * Sectores: árbol con jerarquía padre-hijo, jefes, miembros asignados.
 * Puestos: catálogo vinculable a sectores específicos o globales.
 * Horarios: por empresa o por sector.
 */

const COLORES_SECTOR = PALETA_COLORES_SECTOR

// Iconos sugeridos cuando se elige un sector (el buscador permite elegir cualquier otro).
const ICONOS_RAPIDOS_SECTOR = [
  'Building', 'Building2', 'Briefcase', 'Users', 'UserPlus', 'Crown',
  'Phone', 'Mail', 'MessageSquare', 'Headphones', 'Shield', 'Target',
  'TrendingUp', 'BarChart3', 'DollarSign', 'CreditCard', 'ShoppingCart', 'Package',
  'Wrench', 'Hammer', 'Settings', 'Cog', 'Truck', 'MapPin',
  'GraduationCap', 'BookOpen', 'Award', 'Star', 'Heart', 'Zap',
  'Globe', 'Wifi', 'Camera', 'FileText', 'ClipboardList', 'Calendar',
]

export function SeccionEstructura({ tabInicial }: { tabInicial?: string } = {}) {
  const { t } = useTraduccion()
  const { empresa } = useEmpresa()
  const supabase = crearClienteNavegador()

  const [sectores, setSectores] = useState<Sector[]>([])
  const [puestos, setPuestos] = useState<Puesto[]>([])
  const [miembros, setMiembros] = useState<MiembroSimple[]>([])
  const [asignaciones, setAsignaciones] = useState<AsignacionMiembroSector[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [cargando, setCargando] = useState(true)
  const tabInicialValido = (tabInicial === 'sectores' || tabInicial === 'puestos' || tabInicial === 'horarios') ? tabInicial : 'sectores'
  const [tab, setTab] = useState<'sectores' | 'puestos' | 'horarios'>(tabInicialValido)

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
      supabase.from('miembros').select('id, usuario_id').eq('empresa_id', empresa.id),
      supabase.from('horarios').select('*').eq('empresa_id', empresa.id).order('dia_semana'),
      fetch('/api/miembros-sectores').then(r => r.ok ? r.json() : []),
    ])

    setSectores(sectoresRes.data || [])
    setPuestos(puestosRes.data || [])
    setHorarios(horariosRes.data || [])
    setAsignaciones(asignacionesRes || [])

    // NOTA: el join miembros→perfiles falla en el cliente Supabase por políticas RLS
    // entre tablas — mientras no se resuelva a nivel FK/RLS, hacemos dos queries.
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

    // Promover hijos al mismo nivel del eliminado
    await supabase.from('sectores')
      .update({ padre_id: modalEliminar.padre_id })
      .eq('padre_id', modalEliminar.id)

    // Desasignar miembros de este sector (vía API con service_role)
    await fetch('/api/miembros-sectores', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sector_id: modalEliminar.id }),
    })

    await supabase.from('sectores').delete().eq('id', modalEliminar.id)

    setGuardando(false)
    setModalEliminar(null)
    cargarDatos()
  }

  // Excluir el sector actual y sus descendientes para evitar ciclos
  const opcionesPadre = useMemo(() => {
    const excluidos = modalEditar ? obtenerDescendientes(sectores, modalEditar.id) : new Set<string>()
    if (modalEditar) excluidos.add(modalEditar.id)

    return [
      { valor: '__ninguno__', etiqueta: '— Sin sector padre (raíz)' },
      ...sectores
        .filter(s => !excluidos.has(s.id))
        .map(s => ({ valor: s.id, etiqueta: s.nombre })),
    ]
  }, [sectores, modalEditar])

  const opcionesJefe = useMemo(() => [
    { valor: '__ninguno__', etiqueta: '— Sin jefe asignado' },
    ...miembros.map(m => ({ valor: m.usuario_id, etiqueta: `${m.nombre} ${m.apellido}` })),
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

  const restablecerPredefinidos = async () => {
    if (!empresa) return
    setGuardando(true)

    await fetch('/api/miembros-sectores', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    await supabase.from('sectores').delete().eq('empresa_id', empresa.id)
    await supabase.from('puestos').delete().eq('empresa_id', empresa.id)

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
      })),
    )

    setGuardando(false)
    setModalReset(false)
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
      <div className="flex gap-1 bg-superficie-hover/50 rounded-card p-1">
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

          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden">
            <div className="px-4 py-3 border-b border-borde-sutil flex items-center justify-between">
              <h3 className="text-sm font-semibold text-texto-primario">Organigrama</h3>
              <Boton variante="fantasma" tamano="sm" icono={<Plus size={14} />} onClick={() => abrirNuevo(null)}>
                Nuevo sector
              </Boton>
            </div>

            {cargando ? (
              <CargadorSeccion />
            ) : arbol.length === 0 ? (
              <EstadoVacio titulo="No hay sectores" descripcion="Creá el primero para armar tu organigrama." />
            ) : (
              <div className="py-2">
                {arbol.map((sector, idx) => (
                  <NodoSector
                    key={sector.id}
                    sector={sector}
                    nivel={0}
                    esUltimo={idx === arbol.length - 1}
                    miembrosPorSector={miembrosPorSector}
                    miembros={miembros}
                    asignaciones={asignaciones}
                    onEditar={abrirEditar}
                    onEliminar={(s) => setModalEliminar(s)}
                    onAgregarHijo={(padreId) => abrirNuevo(padreId)}
                  />
                ))}
              </div>
            )}
          </div>

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
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden">
          <div className="px-4 py-3 border-b border-borde-sutil flex items-center justify-between">
            <h3 className="text-sm font-semibold text-texto-primario">Puestos de trabajo</h3>
            <Boton variante="fantasma" tamano="sm" icono={<Plus size={14} />} onClick={() => setModalNuevoPuesto(true)}>
              Nuevo puesto
            </Boton>
          </div>

          {puestos.length === 0 ? (
            <EstadoVacio titulo="No hay puestos de trabajo" descripcion="Creá el primero para poder asignarlos a tus colaboradores." />
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
      {tab === 'horarios' && empresa && (
        <TabHorarios
          empresaId={empresa.id}
          sectores={sectores}
          horarios={horarios}
          onCambio={cargarDatos}
        />
      )}

      {/* ==================== MODAL SECTOR (crear/editar) ==================== */}
      <Modal
        abierto={!!modalEditar || !!modalNuevo}
        onCerrar={() => { setModalEditar(null); setModalNuevo(null) }}
        titulo={modalEditar ? 'Editar sector' : 'Nuevo sector'}
        tamano="lg"
        acciones={
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => { setModalEditar(null); setModalNuevo(null) }}>{t('comun.cancelar')}</Boton>
            <Boton onClick={guardarSector} cargando={guardando}>
              {modalEditar ? 'Guardar sector' : 'Crear sector'}
            </Boton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <MiniSelectorIcono
              valor={formIcono}
              color={formColor}
              onChange={setFormIcono}
              iconosRapidos={ICONOS_RAPIDOS_SECTOR}
            />
            <div className="flex-1">
              <p className="text-[11px] text-texto-terciario mb-1.5">Nombre del sector</p>
              <Input
                tipo="text"
                placeholder="Ej: Ventas, Soporte, RRHH..."
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                formato="nombre_empresa"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            {COLORES_SECTOR.map(c => (
              <button
                key={c}
                onClick={() => setFormColor(c)}
                className={`relative size-5 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                  formColor === c ? 'ring-2 ring-offset-1 ring-white/80 ring-offset-superficie-tarjeta scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              >
                {formColor === c && <Check size={10} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
              </button>
            ))}
          </div>

          <div className="border-t border-white/[0.07]" />

          <div className="grid grid-cols-2 gap-3">
            <Select
              etiqueta="Sector padre"
              opciones={opcionesPadre}
              valor={formPadreId || '__ninguno__'}
              onChange={(v) => setFormPadreId(v === '__ninguno__' ? null : v)}
            />
            <Select
              etiqueta="Jefe del sector"
              opciones={opcionesJefe}
              valor={formJefeId || '__ninguno__'}
              onChange={(v) => setFormJefeId(v === '__ninguno__' ? null : v)}
            />
          </div>
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
        tamano="md"
        acciones={
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setModalNuevoPuesto(false)}>{t('comun.cancelar')}</Boton>
            <Boton onClick={guardarPuesto} cargando={guardando}>Crear puesto</Boton>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-[11px] text-texto-terciario mb-1.5">Nombre del puesto</p>
            <Input
              tipo="text"
              placeholder="Ej: Director comercial, Vendedor..."
              value={puestoNombre}
              onChange={(e) => setPuestoNombre(e.target.value)}
              formato="nombre_empresa"
            />
          </div>
          <div>
            <p className="text-[11px] text-texto-terciario mb-1.5">Descripción (opcional)</p>
            <Input
              tipo="text"
              placeholder="Breve descripción del puesto..."
              value={puestoDescripcion}
              onChange={(e) => setPuestoDescripcion(e.target.value)}
            />
          </div>
          <div>
            <p className="text-[11px] text-texto-terciario mb-1.5">Color</p>
            <div className="flex flex-wrap gap-1.5 items-center">
              {COLORES_SECTOR.map(c => (
                <button
                  key={c}
                  onClick={() => setPuestoColor(c)}
                  className={`relative size-5 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                    puestoColor === c ? 'ring-2 ring-offset-1 ring-white/80 ring-offset-superficie-tarjeta scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {puestoColor === c && <Check size={10} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                </button>
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
        onConfirmar={restablecerPredefinidos}
        titulo="¿Restablecer estructura?"
        descripcion="Se eliminarán todos los sectores y puestos actuales y se restaurarán los 7 sectores predefinidos. Las asignaciones de personas se perderán. Esta acción no se puede deshacer."
        tipo="advertencia"
        etiquetaConfirmar="Restablecer"
        cargando={guardando}
      />
    </div>
  )
}
