'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Tag, Ruler, Hash, DollarSign,
  Plus, Trash2, GripVertical, RotateCcw, Layers,
} from 'lucide-react'
import { Reorder } from 'framer-motion'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import type { ConfigProductos, CategoriaProducto, CategoriaCosto, PrefijoProducto } from '@/tipos/producto'

/**
 * Página de configuración de Productos.
 * Secciones: Categorías, Unidades de medida, Prefijos de código, Categorías de costo.
 * Autoguardado al modificar.
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

  // ─── Secciones ───
  const secciones: SeccionConfig[] = [
    { id: 'categorias', etiqueta: 'Categorías', icono: <Tag size={16} /> },
    { id: 'unidades', etiqueta: 'Unidades de medida', icono: <Ruler size={16} /> },
    { id: 'prefijos', etiqueta: 'Prefijos de código', icono: <Hash size={16} /> },
    { id: 'costos', etiqueta: 'Categorías de costo', icono: <DollarSign size={16} /> },
  ]

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
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-texto-primario">Categorías de producto</h3>
              <p className="text-xs text-texto-terciario mt-0.5">Organizá tus productos y servicios por categoría.</p>
            </div>
            <div className="flex gap-2">
              <Boton
                variante="fantasma"
                tamano="sm"
                icono={<RotateCcw size={14} />}
                onClick={() => {
                  setCategorias(CATEGORIAS_DEFAULT)
                  guardar({ categorias: CATEGORIAS_DEFAULT } as Partial<ConfigProductos>)
                }}
              >
                Restablecer
              </Boton>
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<Plus size={14} />}
                onClick={() => {
                  const nueva = { id: `cat_${Date.now()}`, label: '' }
                  setCategorias([...categorias, nueva])
                }}
              >
                Agregar
              </Boton>
            </div>
          </div>

          <Reorder.Group
            axis="y"
            values={categorias}
            onReorder={(nuevas) => {
              setCategorias(nuevas)
              guardar({ categorias: nuevas } as Partial<ConfigProductos>)
            }}
            className="space-y-2"
          >
            {categorias.map((cat) => (
              <Reorder.Item key={cat.id} value={cat}>
                <div className="flex items-center gap-2 group">
                  <GripVertical size={16} className="text-texto-terciario opacity-0 group-hover:opacity-100 cursor-grab shrink-0 transition-opacity" />
                  <Input
                    value={cat.label}
                    onChange={(e) => {
                      const nuevas = categorias.map(c => c.id === cat.id ? { ...c, label: e.target.value } : c)
                      setCategorias(nuevas)
                    }}
                    onBlur={() => guardar({ categorias } as Partial<ConfigProductos>)}
                    placeholder="Nombre de la categoría..."
                    formato={null}
                  />
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    soloIcono
                    titulo="Eliminar"
                    icono={<Trash2 size={14} />}
                    onClick={() => {
                      const nuevas = categorias.filter(c => c.id !== cat.id)
                      setCategorias(nuevas)
                      guardar({ categorias: nuevas } as Partial<ConfigProductos>)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  />
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      )}

      {/* ════════════════ UNIDADES DE MEDIDA ════════════════ */}
      {seccionActiva === 'unidades' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-texto-primario">Unidades de medida</h3>
              <p className="text-xs text-texto-terciario mt-0.5">Unidades disponibles para productos y servicios.</p>
            </div>
            <div className="flex gap-2">
              <Boton
                variante="fantasma"
                tamano="sm"
                icono={<RotateCcw size={14} />}
                onClick={() => {
                  setUnidades(UNIDADES_DEFAULT)
                  guardar({ unidades: UNIDADES_DEFAULT } as Partial<ConfigProductos>)
                }}
              >
                Restablecer
              </Boton>
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<Plus size={14} />}
                onClick={() => setUnidades([...unidades, { id: `u_${Date.now()}`, label: '', abreviatura: '' }])}
              >
                Agregar
              </Boton>
            </div>
          </div>

          <div className="rounded-xl border border-borde-sutil overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-superficie-app border-b border-borde-sutil">
                  <th className="px-4 py-3 text-left text-xs font-medium text-texto-terciario w-10" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-texto-terciario">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-texto-terciario w-36">Abreviatura</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => (
                  <tr key={u.id} className="border-b border-borde-sutil last:border-0 group">
                    <td className="px-2 py-2">
                      <GripVertical size={16} className="text-texto-terciario opacity-0 group-hover:opacity-100 cursor-grab mx-auto" />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={u.label}
                        onChange={(e) => setUnidades(unidades.map(un => un.id === u.id ? { ...un, label: e.target.value } : un))}
                        onBlur={() => guardar({ unidades } as Partial<ConfigProductos>)}
                        placeholder="Nombre..."
                        formato={null}
                        compacto
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={u.abreviatura}
                        onChange={(e) => setUnidades(unidades.map(un => un.id === u.id ? { ...un, abreviatura: e.target.value } : un))}
                        onBlur={() => guardar({ unidades } as Partial<ConfigProductos>)}
                        placeholder="Abrev."
                        formato={null}
                        compacto
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Boton
                        variante="fantasma"
                        tamano="xs"
                        soloIcono
                        titulo="Eliminar"
                        icono={<Trash2 size={14} />}
                        onClick={() => {
                          const nuevas = unidades.filter(un => un.id !== u.id)
                          setUnidades(nuevas)
                          guardar({ unidades: nuevas } as Partial<ConfigProductos>)
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════ PREFIJOS DE CÓDIGO ════════════════ */}
      {seccionActiva === 'prefijos' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-texto-primario">Prefijos de código</h3>
            <p className="text-xs text-texto-terciario mt-0.5">Cada tipo tiene su propio prefijo y secuencia numérica independiente.</p>
          </div>

          <div className="rounded-xl border border-borde-sutil overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-superficie-app border-b border-borde-sutil">
                  <th className="px-4 py-3 text-left text-xs font-medium text-texto-terciario">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-texto-terciario w-36">Prefijo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-texto-terciario w-40">Siguiente número</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-texto-terciario w-40">Ejemplo</th>
                </tr>
              </thead>
              <tbody>
                {prefijos.map((p) => (
                  <tr key={p.id} className="border-b border-borde-sutil last:border-0">
                    <td className="px-4 py-3 text-texto-primario font-medium">{p.label}</td>
                    <td className="px-4 py-2">
                      <Input
                        value={p.prefijo}
                        onChange={(e) => setPrefijos(prefijos.map(pr => pr.id === p.id ? { ...pr, prefijo: e.target.value.toUpperCase() } : pr))}
                        onBlur={() => guardar({ prefijos } as Partial<ConfigProductos>)}
                        maxLength={5}
                        formato={null}
                        compacto
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        tipo="number"
                        value={String(p.siguiente)}
                        onChange={(e) => setPrefijos(prefijos.map(pr => pr.id === p.id ? { ...pr, siguiente: parseInt(e.target.value) || 1 } : pr))}
                        onBlur={() => guardar({ prefijos } as Partial<ConfigProductos>)}
                        min="1"
                        formato={null}
                        compacto
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-texto-terciario bg-superficie-app px-2 py-1 rounded-md">
                        {p.prefijo}-{String(p.siguiente).padStart(4, '0')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════ CATEGORÍAS DE COSTO ════════════════ */}
      {seccionActiva === 'costos' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-texto-primario">Categorías de costo</h3>
              <p className="text-xs text-texto-terciario mt-0.5">Para organizar el desglose de costos de cada producto.</p>
            </div>
            <div className="flex gap-2">
              <Boton
                variante="fantasma"
                tamano="sm"
                icono={<RotateCcw size={14} />}
                onClick={() => {
                  setCategoriasCosto(CATEGORIAS_COSTO_DEFAULT)
                  guardar({ categorias_costo: CATEGORIAS_COSTO_DEFAULT } as Partial<ConfigProductos>)
                }}
              >
                Restablecer
              </Boton>
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<Plus size={14} />}
                onClick={() => setCategoriasCosto([...categoriasCosto, { id: `cc_${Date.now()}`, label: '' }])}
              >
                Agregar
              </Boton>
            </div>
          </div>

          <Reorder.Group
            axis="y"
            values={categoriasCosto}
            onReorder={(nuevas) => {
              setCategoriasCosto(nuevas)
              guardar({ categorias_costo: nuevas } as Partial<ConfigProductos>)
            }}
            className="space-y-2"
          >
            {categoriasCosto.map((cat) => (
              <Reorder.Item key={cat.id} value={cat}>
                <div className="flex items-center gap-2 group">
                  <GripVertical size={16} className="text-texto-terciario opacity-0 group-hover:opacity-100 cursor-grab shrink-0 transition-opacity" />
                  <Input
                    value={cat.label}
                    onChange={(e) => setCategoriasCosto(categoriasCosto.map(c => c.id === cat.id ? { ...c, label: e.target.value } : c))}
                    onBlur={() => guardar({ categorias_costo: categoriasCosto } as Partial<ConfigProductos>)}
                    placeholder="Nombre de la categoría de costo..."
                    formato={null}
                  />
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    soloIcono
                    titulo="Eliminar"
                    icono={<Trash2 size={14} />}
                    onClick={() => {
                      const nuevas = categoriasCosto.filter(c => c.id !== cat.id)
                      setCategoriasCosto(nuevas)
                      guardar({ categorias_costo: nuevas } as Partial<ConfigProductos>)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  />
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      )}

      {/* Indicador de guardado */}
      {guardando && (
        <div className="fixed bottom-4 right-4 px-4 py-2 rounded-xl bg-superficie-elevada border border-borde-sutil text-xs text-texto-terciario shadow-lg">
          Guardando...
        </div>
      )}
    </PlantillaConfiguracion>
  )
}
