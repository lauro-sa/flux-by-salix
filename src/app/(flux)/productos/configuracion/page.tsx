'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Tag, Ruler, Hash, DollarSign, Plus, Layers } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { Input } from '@/componentes/ui/Input'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { ModalItemConfiguracion } from '@/componentes/ui/ModalItemConfiguracion'
import type { ConfigProductos, CategoriaProducto, CategoriaCosto, PrefijoProducto } from '@/tipos/producto'

/**
 * Página de configuración de Productos.
 * Secciones: Categorías, Unidades de medida, Prefijos de código, Categorías de costo.
 * Todas usan ListaConfiguracion unificada.
 */

const CATEGORIAS_DEFAULT: CategoriaProducto[] = [
  { id: 'general', label: 'General' },
  { id: 'tecnologia', label: 'Tecnología' },
  { id: 'limpieza', label: 'Limpieza' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
  { id: 'consultoria', label: 'Consultoría' },
  { id: 'insumos', label: 'Insumos' },
]

const UNIDADES_DEFAULT = [
  { id: 'unidad', label: 'Unidad', abreviatura: 'un' },
  { id: 'hora', label: 'Hora', abreviatura: 'hs' },
  { id: 'servicio', label: 'Servicio', abreviatura: 'srv' },
  { id: 'metro', label: 'Metro', abreviatura: 'm' },
  { id: 'kg', label: 'Kilogramo', abreviatura: 'kg' },
  { id: 'litro', label: 'Litro', abreviatura: 'lt' },
  { id: 'dia', label: 'Día', abreviatura: 'día' },
  { id: 'mes', label: 'Mes', abreviatura: 'mes' },
  { id: 'global', label: 'Global', abreviatura: 'gl' },
  { id: 'm2', label: 'Metro cuadrado', abreviatura: 'm²' },
]

const PREFIJOS_DEFAULT: PrefijoProducto[] = [
  { id: 'producto', prefijo: 'PRD', label: 'Producto', siguiente: 1 },
  { id: 'servicio', prefijo: 'SRV', label: 'Servicio', siguiente: 1 },
]

const CATEGORIAS_COSTO_DEFAULT: CategoriaCosto[] = [
  { id: 'mano_obra', label: 'Mano de obra' },
  { id: 'materiales', label: 'Materiales' },
  { id: 'horas_hombre', label: 'Horas hombre' },
  { id: 'movilidad', label: 'Movilidad' },
  { id: 'flete', label: 'Flete' },
  { id: 'seguros', label: 'Seguros' },
  { id: 'repuestos', label: 'Repuestos' },
  { id: 'traslado', label: 'Traslado' },
]

export default function PaginaConfiguracionProductos() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('categorias')
  const [guardando, setGuardando] = useState(false)

  const [categorias, setCategorias] = useState<CategoriaProducto[]>(CATEGORIAS_DEFAULT)
  const [unidades, setUnidades] = useState(UNIDADES_DEFAULT)
  const [prefijos, setPrefijos] = useState<PrefijoProducto[]>(PREFIJOS_DEFAULT)
  const [categoriasCosto, setCategoriasCosto] = useState<CategoriaCosto[]>(CATEGORIAS_COSTO_DEFAULT)

  const [confirmarEliminar, setConfirmarEliminar] = useState<{ id: string; nombre: string; seccion: string } | null>(null)
  const [confirmarRestaurar, setConfirmarRestaurar] = useState<string | null>(null)
  const [modalProducto, setModalProducto] = useState<{ abierto: boolean; seccion: string; valores?: Record<string, unknown>; editandoId?: string }>({ abierto: false, seccion: '' })

  // ─── Cargar configuración ───
  const cargadoRef = useRef(false)
  useEffect(() => {
    if (cargadoRef.current) return
    cargadoRef.current = true
    fetch('/api/productos/config')
      .then(r => r.json())
      .then(data => {
        if (data.categorias) setCategorias(data.categorias)
        if (data.unidades) setUnidades(data.unidades)
        if (data.prefijos) setPrefijos(data.prefijos)
        if (data.categorias_costo) setCategoriasCosto(data.categorias_costo)
      })
      .catch(() => {})
  }, [])

  // ─── Autoguardado ───
  const guardar = useCallback(async (datos: Partial<ConfigProductos>) => {
    setGuardando(true)
    try {
      await fetch('/api/productos/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
    } catch (err) {
      console.error('Error al guardar config:', err)
    } finally {
      setGuardando(false)
    }
  }, [])

  // ─── Helpers ───
  const eliminarItem = (seccion: string, id: string) => {
    if (seccion === 'categorias') {
      const nuevas = categorias.filter(c => c.id !== id)
      setCategorias(nuevas)
      guardar({ categorias: nuevas } as Partial<ConfigProductos>)
    } else if (seccion === 'unidades') {
      const nuevas = unidades.filter(u => u.id !== id)
      setUnidades(nuevas)
      guardar({ unidades: nuevas } as Partial<ConfigProductos>)
    } else if (seccion === 'costos') {
      const nuevas = categoriasCosto.filter(c => c.id !== id)
      setCategoriasCosto(nuevas)
      guardar({ categorias_costo: nuevas } as Partial<ConfigProductos>)
    }
  }

  // ─── Secciones ───
  const secciones: SeccionConfig[] = [
    { id: 'categorias', etiqueta: 'Categorías', icono: <Tag size={16} /> },
    { id: 'unidades', etiqueta: 'Unidades de medida', icono: <Ruler size={16} /> },
    { id: 'prefijos', etiqueta: 'Prefijos de código', icono: <Hash size={16} /> },
    { id: 'costos', etiqueta: 'Categorías de costo', icono: <DollarSign size={16} /> },
  ]

  // ─── Items para cada sección ───
  const itemsCategorias: ItemLista[] = categorias.map(c => ({ id: c.id, nombre: c.label }))
  const itemsUnidades: ItemLista[] = unidades.map(u => ({ id: u.id, nombre: u.label, datos: { abreviatura: u.abreviatura } }))
  const itemsCostos: ItemLista[] = categoriasCosto.map(c => ({ id: c.id, nombre: c.label }))

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Productos"
      descripcion="Categorías, unidades de medida, prefijos de código y categorías de costo."
      iconoHeader={<Layers size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Productos"
      onVolver={() => router.push('/productos')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {/* ════════════════ CATEGORÍAS ════════════════ */}
      {seccionActiva === 'categorias' && (
        <ListaConfiguracion
          titulo="Categorías de producto"
          descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
          items={itemsCategorias}
          controles="solo-borrar"
          ordenable
          acciones={[{
            tipo: 'fantasma', icono: <Plus size={16} />, soloIcono: true, titulo: 'Agregar categoría',
            onClick: () => setModalProducto({ abierto: true, seccion: 'categorias' }),
          }]}
          onEditar={(item) => setModalProducto({ abierto: true, seccion: 'categorias', valores: { nombre: item.nombre }, editandoId: item.id })}
          onEliminar={(item) => setConfirmarEliminar({ id: item.id, nombre: item.nombre, seccion: 'categorias' })}
          onReordenar={(ids) => {
            const mapa = new Map(categorias.map(c => [c.id, c]))
            const nuevas = ids.map(id => mapa.get(id)!).filter(Boolean)
            setCategorias(nuevas)
            guardar({ categorias: nuevas } as Partial<ConfigProductos>)
          }}
          restaurable
          onRestaurar={() => setConfirmarRestaurar('categorias')}
        />
      )}

      {/* ════════════════ UNIDADES DE MEDIDA ════════════════ */}
      {seccionActiva === 'unidades' && (
        <ListaConfiguracion
          titulo="Unidades de medida"
          descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
          items={itemsUnidades}
          controles="solo-borrar"
          ordenable
          acciones={[{
            tipo: 'fantasma', icono: <Plus size={16} />, soloIcono: true, titulo: 'Agregar unidad',
            onClick: () => setModalProducto({ abierto: true, seccion: 'unidades' }),
          }]}
          onEditar={(item) => {
            const u = unidades.find(un => un.id === item.id)
            if (u) setModalProducto({ abierto: true, seccion: 'unidades', valores: { nombre: u.label, abreviatura: u.abreviatura }, editandoId: u.id })
          }}
          onEliminar={(item) => setConfirmarEliminar({ id: item.id, nombre: item.nombre, seccion: 'unidades' })}
          onReordenar={(ids) => {
            const mapa = new Map(unidades.map(u => [u.id, u]))
            const nuevas = ids.map(id => mapa.get(id)!).filter(Boolean)
            setUnidades(nuevas)
            guardar({ unidades: nuevas } as Partial<ConfigProductos>)
          }}
          restaurable
          onRestaurar={() => setConfirmarRestaurar('unidades')}
        />
      )}

      {/* ════════════════ PREFIJOS DE CÓDIGO ════════════════ */}
      {seccionActiva === 'prefijos' && (
        <ListaConfiguracion
          titulo="Prefijos de código"
          descripcion="Cada tipo tiene su propio prefijo y secuencia numérica. Se asignan automáticamente al crear productos o servicios."
          items={prefijos.map(p => ({ id: p.id, nombre: p.label }))}
          controles="solo-borrar"
          ordenable={false}
          onEliminar={undefined}
          renderContenido={(item) => {
            const p = prefijos.find(pr => pr.id === item.id)
            if (!p) return null
            return (
              <div className="flex items-center gap-3 w-full">
                <span className="text-sm font-medium text-texto-primario shrink-0">{p.label}</span>
                <div className="flex-1" />
                <input
                  type="text"
                  value={p.prefijo}
                  onChange={(e) => setPrefijos(prefijos.map(pr => pr.id === p.id ? { ...pr, prefijo: e.target.value.toUpperCase() } : pr))}
                  onBlur={() => guardar({ prefijos } as Partial<ConfigProductos>)}
                  maxLength={5}
                  className="w-20 bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-texto-primario text-center font-mono outline-none focus:border-texto-marca/50"
                />
                <input
                  type="number"
                  value={p.siguiente}
                  onChange={(e) => setPrefijos(prefijos.map(pr => pr.id === p.id ? { ...pr, siguiente: parseInt(e.target.value) || 1 } : pr))}
                  onBlur={() => guardar({ prefijos } as Partial<ConfigProductos>)}
                  min={1}
                  className="w-24 bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-texto-primario text-center font-mono outline-none focus:border-texto-marca/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-xs text-texto-terciario/30 shrink-0">→</span>
                <span className="font-mono text-xs text-texto-terciario bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-lg shrink-0">
                  {p.prefijo}-{String(p.siguiente).padStart(4, '0')}
                </span>
              </div>
            )
          }}
        />
      )}

      {/* ════════════════ CATEGORÍAS DE COSTO ════════════════ */}
      {seccionActiva === 'costos' && (
        <ListaConfiguracion
          titulo="Categorías de costo"
          descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
          items={itemsCostos}
          controles="solo-borrar"
          ordenable
          acciones={[{
            tipo: 'fantasma', icono: <Plus size={16} />, soloIcono: true, titulo: 'Agregar categoría de costo',
            onClick: () => setModalProducto({ abierto: true, seccion: 'costos' }),
          }]}
          onEditar={(item) => setModalProducto({ abierto: true, seccion: 'costos', valores: { nombre: item.nombre }, editandoId: item.id })}
          onEliminar={(item) => setConfirmarEliminar({ id: item.id, nombre: item.nombre, seccion: 'costos' })}
          onReordenar={(ids) => {
            const mapa = new Map(categoriasCosto.map(c => [c.id, c]))
            const nuevas = ids.map(id => mapa.get(id)!).filter(Boolean)
            setCategoriasCosto(nuevas)
            guardar({ categorias_costo: nuevas } as Partial<ConfigProductos>)
          }}
          restaurable
          onRestaurar={() => setConfirmarRestaurar('costos')}
        />
      )}

      {/* Confirmar restaurar predefinidos */}
      <ModalConfirmacion
        abierto={!!confirmarRestaurar}
        titulo="Restaurar predefinidos"
        descripcion="Se reemplazarán todos los valores personalizados por los predefinidos del sistema. Esta acción no se puede deshacer."
        etiquetaConfirmar="Restaurar"
        tipo="peligro"
        onConfirmar={() => {
          if (confirmarRestaurar === 'categorias') {
            setCategorias(CATEGORIAS_DEFAULT)
            guardar({ categorias: CATEGORIAS_DEFAULT } as Partial<ConfigProductos>)
          } else if (confirmarRestaurar === 'unidades') {
            setUnidades(UNIDADES_DEFAULT)
            guardar({ unidades: UNIDADES_DEFAULT } as Partial<ConfigProductos>)
          } else if (confirmarRestaurar === 'costos') {
            setCategoriasCosto(CATEGORIAS_COSTO_DEFAULT)
            guardar({ categorias_costo: CATEGORIAS_COSTO_DEFAULT } as Partial<ConfigProductos>)
          }
          setConfirmarRestaurar(null)
        }}
        onCerrar={() => setConfirmarRestaurar(null)}
      />

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo={`Eliminar ${confirmarEliminar?.seccion === 'categorias' ? 'categoría' : confirmarEliminar?.seccion === 'unidades' ? 'unidad' : 'categoría de costo'}`}
        descripcion={`Se eliminará "${confirmarEliminar?.nombre || ''}".`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        onConfirmar={() => {
          if (confirmarEliminar) {
            eliminarItem(confirmarEliminar.seccion, confirmarEliminar.id)
            setConfirmarEliminar(null)
          }
        }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      {/* Modal crear/editar item */}
      <ModalItemConfiguracion
        abierto={modalProducto.abierto}
        onCerrar={() => setModalProducto({ abierto: false, seccion: '' })}
        titulo={
          modalProducto.editandoId
            ? `Editar ${modalProducto.seccion === 'categorias' ? 'categoría' : modalProducto.seccion === 'unidades' ? 'unidad' : 'categoría de costo'}`
            : `Nueva ${modalProducto.seccion === 'categorias' ? 'categoría' : modalProducto.seccion === 'unidades' ? 'unidad' : 'categoría de costo'}`
        }
        campos={
          modalProducto.seccion === 'unidades'
            ? [
                { tipo: 'texto', clave: 'nombre', etiqueta: 'Nombre', placeholder: 'Ej: Kilogramo, Metro...' },
                { tipo: 'texto', clave: 'abreviatura', etiqueta: 'Abreviatura', placeholder: 'Ej: kg, m, hs...', maxLength: 5 },
              ]
            : [
                { tipo: 'texto', clave: 'nombre', etiqueta: 'Nombre', placeholder: 'Nombre...' },
              ]
        }
        valores={modalProducto.valores}
        onGuardar={(valores) => {
          const nombre = String(valores.nombre || '').trim()
          if (!nombre) return

          if (modalProducto.seccion === 'categorias') {
            if (modalProducto.editandoId) {
              const nuevas = categorias.map(c => c.id === modalProducto.editandoId ? { ...c, label: nombre } : c)
              setCategorias(nuevas)
              guardar({ categorias: nuevas } as Partial<ConfigProductos>)
            } else {
              const nuevas = [...categorias, { id: `cat_${crypto.randomUUID().slice(0, 8)}`, label: nombre }]
              setCategorias(nuevas)
              guardar({ categorias: nuevas } as Partial<ConfigProductos>)
            }
          } else if (modalProducto.seccion === 'unidades') {
            const abrev = String(valores.abreviatura || '').trim()
            if (modalProducto.editandoId) {
              const nuevas = unidades.map(u => u.id === modalProducto.editandoId ? { ...u, label: nombre, abreviatura: abrev } : u)
              setUnidades(nuevas)
              guardar({ unidades: nuevas } as Partial<ConfigProductos>)
            } else {
              const nuevas = [...unidades, { id: `u_${crypto.randomUUID().slice(0, 8)}`, label: nombre, abreviatura: abrev }]
              setUnidades(nuevas)
              guardar({ unidades: nuevas } as Partial<ConfigProductos>)
            }
          } else if (modalProducto.seccion === 'costos') {
            if (modalProducto.editandoId) {
              const nuevas = categoriasCosto.map(c => c.id === modalProducto.editandoId ? { ...c, label: nombre } : c)
              setCategoriasCosto(nuevas)
              guardar({ categorias_costo: nuevas } as Partial<ConfigProductos>)
            } else {
              const nuevas = [...categoriasCosto, { id: `cc_${crypto.randomUUID().slice(0, 8)}`, label: nombre }]
              setCategoriasCosto(nuevas)
              guardar({ categorias_costo: nuevas } as Partial<ConfigProductos>)
            }
          }

          setModalProducto({ abierto: false, seccion: '' })
        }}
      />

      {/* Indicador de guardado */}
      {guardando && (
        <div className="fixed bottom-4 right-4 px-4 py-2 rounded-xl bg-superficie-elevada border border-borde-sutil text-xs text-texto-terciario shadow-lg">
          Guardando...
        </div>
      )}
    </PlantillaConfiguracion>
  )
}
