'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, Clock, User, FileText, Package, Zap, Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Tabs } from '@/componentes/ui/Tabs'
import { Insignia } from '@/componentes/ui/Insignia'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useAuth } from '@/hooks/useAuth'
import { useRol } from '@/hooks/useRol'
import { useTraduccion } from '@/lib/i18n'

/**
 * Página de papelera — /papelera
 * Muestra todos los elementos eliminados (soft delete) de todas las entidades.
 * Admins ven todo, otros ven solo lo que eliminaron ellos.
 * Permite restaurar o eliminar definitivamente.
 */

type TipoEntidad = 'contactos' | 'presupuestos' | 'actividades' | 'productos'

interface ElementoPapelera {
  id: string
  nombre: string
  tipo: TipoEntidad
  eliminado_en: string
  eliminado_por: string | null
  eliminado_por_nombre: string | null
  subtitulo?: string
}

const TABS_ENTIDAD = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'contactos', etiqueta: 'Contactos', icono: <User size={14} /> },
  { id: 'presupuestos', etiqueta: 'Presupuestos', icono: <FileText size={14} /> },
  { id: 'actividades', etiqueta: 'Actividades', icono: <Zap size={14} /> },
  { id: 'productos', etiqueta: 'Productos', icono: <Package size={14} /> },
]

const ICONO_ENTIDAD: Record<TipoEntidad, typeof User> = {
  contactos: User,
  presupuestos: FileText,
  actividades: Zap,
  productos: Package,
}

const ETIQUETA_ENTIDAD: Record<TipoEntidad, string> = {
  contactos: 'Contacto',
  presupuestos: 'Presupuesto',
  actividades: 'Actividad',
  productos: 'Producto',
}

/** Calcula días desde una fecha */
function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24))
}

export default function PaginaPapelera() {
  const { t } = useTraduccion()
  const { usuario } = useAuth()
  const { esPropietario, esAdmin } = useRol()

  const [elementos, setElementos] = useState<ElementoPapelera[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | TipoEntidad>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const [confirmacionEliminar, setConfirmacionEliminar] = useState<ElementoPapelera | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const puedeVerTodos = esPropietario || esAdmin

  const cargarElementos = useCallback(async () => {
    setCargando(true)
    const resultados: ElementoPapelera[] = []

    // Cargar en paralelo todas las entidades con en_papelera=true
    const [contactosRes, presupuestosRes, actividadesRes, productosRes] = await Promise.all([
      fetch('/api/contactos?en_papelera=true').then(r => r.ok ? r.json() : []),
      fetch('/api/presupuestos?en_papelera=true').then(r => r.ok ? r.json() : []),
      fetch('/api/actividades?en_papelera=true').then(r => r.ok ? r.json() : []),
      fetch('/api/productos?en_papelera=true').then(r => r.ok ? r.json() : []),
    ])

    // Mapear contactos
    const contactos = contactosRes?.contactos || []
    for (const c of contactos) {
      resultados.push({
        id: c.id,
        nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre',
        tipo: 'contactos',
        eliminado_en: c.papelera_en || c.actualizado_en,
        eliminado_por: c.editado_por,
        eliminado_por_nombre: null,
        subtitulo: c.correo || c.telefono || c.codigo,
      })
    }

    // Mapear presupuestos
    const presupuestos = presupuestosRes?.presupuestos || []
    for (const p of presupuestos) {
      resultados.push({
        id: p.id,
        nombre: p.titulo || p.codigo || 'Sin título',
        tipo: 'presupuestos',
        eliminado_en: p.papelera_en || p.actualizado_en,
        eliminado_por: p.editado_por,
        eliminado_por_nombre: p.editado_por_nombre,
        subtitulo: p.codigo,
      })
    }

    // Mapear actividades
    const actividades = actividadesRes?.actividades || []
    for (const a of actividades) {
      resultados.push({
        id: a.id,
        nombre: a.titulo || a.asunto || 'Sin título',
        tipo: 'actividades',
        eliminado_en: a.papelera_en || a.actualizado_en,
        eliminado_por: a.editado_por,
        eliminado_por_nombre: a.editado_por_nombre,
        subtitulo: a.tipo,
      })
    }

    // Mapear productos
    const productos = productosRes?.productos || []
    for (const p of productos) {
      resultados.push({
        id: p.id,
        nombre: p.nombre || 'Sin nombre',
        tipo: 'productos',
        eliminado_en: p.papelera_en || p.actualizado_en,
        eliminado_por: p.editado_por,
        eliminado_por_nombre: p.editado_por_nombre,
        subtitulo: p.codigo || p.sku,
      })
    }

    // Ordenar por fecha de eliminación (más reciente primero)
    resultados.sort((a, b) => new Date(b.eliminado_en).getTime() - new Date(a.eliminado_en).getTime())

    setElementos(resultados)
    setCargando(false)
  }, [])

  useEffect(() => { cargarElementos() }, [cargarElementos])

  /** Restaurar un elemento */
  const restaurar = useCallback(async (elem: ElementoPapelera) => {
    setRestaurando(elem.id)
    try {
      const url = `/api/${elem.tipo}/${elem.id}`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_papelera: false }),
      })
      if (res.ok) {
        setElementos(prev => prev.filter(e => e.id !== elem.id))
      }
    } catch { /* silenciar */ }
    setRestaurando(null)
  }, [])

  /** Eliminar definitivamente */
  const eliminarDefinitivo = useCallback(async (elem: ElementoPapelera) => {
    setEliminando(true)
    try {
      // Solo contactos tienen DELETE endpoint, los demás se quedan en papelera
      if (elem.tipo === 'contactos') {
        const res = await fetch(`/api/contactos/${elem.id}`, { method: 'DELETE' })
        if (res.ok) {
          setElementos(prev => prev.filter(e => e.id !== elem.id))
        }
      }
    } catch { /* silenciar */ }
    setEliminando(false)
    setConfirmacionEliminar(null)
  }, [])

  // Filtrar por visibilidad (solo admin/propietario ven todo, otros solo lo que eliminaron ellos)
  const elementosVisibles = puedeVerTodos
    ? elementos
    : elementos.filter(e => e.eliminado_por === usuario?.id)

  // Filtrar por tab y búsqueda
  const elementosFiltrados = elementosVisibles.filter(e => {
    if (filtro !== 'todos' && e.tipo !== filtro) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return e.nombre.toLowerCase().includes(q) || (e.subtitulo?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  // Contadores por tipo (basados en elementos visibles para el usuario)
  const contadores = {
    todos: elementosVisibles.length,
    contactos: elementosVisibles.filter(e => e.tipo === 'contactos').length,
    presupuestos: elementosVisibles.filter(e => e.tipo === 'presupuestos').length,
    actividades: elementosVisibles.filter(e => e.tipo === 'actividades').length,
    productos: elementosVisibles.filter(e => e.tipo === 'productos').length,
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-texto-primario flex items-center gap-2">
          <span className="text-texto-terciario"><Trash2 size={20} /></span>
          Papelera
          {elementosVisibles.length > 0 && (
            <span className="text-sm font-normal text-texto-terciario">
              ({elementosVisibles.length} elemento{elementosVisibles.length !== 1 ? 's' : ''})
            </span>
          )}
        </h1>
      </div>

      {/* Tabs por tipo */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-superficie-tarjeta border border-borde-sutil rounded-lg p-1">
          {TABS_ENTIDAD.map(tab => {
            const count = contadores[tab.id as keyof typeof contadores]
            return (
              <Boton
                key={tab.id}
                variante="fantasma"
                tamano="sm"
                icono={tab.icono}
                onClick={() => setFiltro(tab.id as typeof filtro)}
                className={
                  filtro === tab.id
                    ? '!bg-superficie-elevada !text-texto-primario !shadow-sm'
                    : '!text-texto-terciario'
                }
              >
                {tab.etiqueta}
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-superficie-hover text-texto-terciario">
                    {count}
                  </span>
                )}
              </Boton>
            )
          })}
        </div>

        {/* Buscador */}
        <div className="flex-1 max-w-xs">
          <Input
            tipo="text"
            placeholder="Buscar en papelera..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            icono={<Search size={15} />}
            compacto
          />
        </div>
      </div>

      {/* Lista de elementos */}
      <div className="flex-1 overflow-auto">
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-texto-terciario border-t-texto-marca" />
          </div>
        ) : elementosFiltrados.length === 0 ? (
          <div className="flex items-center justify-center h-full bg-superficie-tarjeta border border-borde-sutil rounded-lg">
            <EstadoVacio
              icono={<Trash2 size={52} strokeWidth={1} />}
              titulo={busqueda ? 'Sin resultados' : 'Limpio como patente nueva'}
              descripcion={busqueda ? 'No se encontraron elementos con esa búsqueda.' : 'Los elementos eliminados aparecen acá. Podés restaurarlos o eliminarlos definitivamente.'}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <AnimatePresence mode="popLayout">
              {elementosFiltrados.map(elem => {
                const Icono = ICONO_ENTIDAD[elem.tipo]
                const dias = diasDesde(elem.eliminado_en)

                return (
                  <motion.div
                    key={elem.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg bg-superficie-tarjeta border border-borde-sutil hover:border-borde-fuerte transition-colors group"
                  >
                    {/* Ícono del tipo */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-superficie-hover shrink-0">
                      <Icono size={16} className="text-texto-terciario" />
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-texto-primario truncate">{elem.nombre}</span>
                        <Insignia color="neutro" tamano="sm">{ETIQUETA_ENTIDAD[elem.tipo]}</Insignia>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-texto-terciario mt-0.5">
                        {elem.subtitulo && <span className="truncate">{elem.subtitulo}</span>}
                        {elem.subtitulo && <span>·</span>}
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock size={11} />
                          {dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : `Hace ${dias} días`}
                        </span>
                        {puedeVerTodos && elem.eliminado_por_nombre && (
                          <>
                            <span>·</span>
                            <span>por {elem.eliminado_por_nombre}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Boton
                        variante="fantasma"
                        tamano="xs"
                        icono={<RotateCcw size={14} />}
                        onClick={() => restaurar(elem)}
                        cargando={restaurando === elem.id}
                      >
                        Restaurar
                      </Boton>
                      {puedeVerTodos && elem.tipo === 'contactos' && (
                        <Boton
                          variante="fantasma"
                          tamano="xs"
                          icono={<X size={14} />}
                          onClick={() => setConfirmacionEliminar(elem)}
                          className="text-insignia-peligro hover:text-insignia-peligro"
                        >
                          Eliminar
                        </Boton>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Modal confirmación eliminar definitivo */}
      <ModalConfirmacion
        abierto={!!confirmacionEliminar}
        onCerrar={() => setConfirmacionEliminar(null)}
        titulo="Eliminar definitivamente"
        descripcion={`¿Estás seguro de eliminar "${confirmacionEliminar?.nombre}" para siempre? Esta acción no se puede deshacer.`}
        tipo="peligro"
        etiquetaConfirmar="Eliminar para siempre"
        onConfirmar={() => { if (confirmacionEliminar) eliminarDefinitivo(confirmacionEliminar) }}
        cargando={eliminando}
      />
    </div>
  )
}
