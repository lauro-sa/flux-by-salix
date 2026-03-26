'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Tag, Briefcase, UserCheck, Plus, Trash2, GripVertical } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { Input } from '@/componentes/ui/Input'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'
import { Interruptor } from '@/componentes/ui/Interruptor'

// Colores disponibles para etiquetas
const COLORES_ETIQUETA: { valor: string; etiqueta: string }[] = [
  { valor: 'neutro', etiqueta: 'Gris' },
  { valor: 'primario', etiqueta: 'Índigo' },
  { valor: 'info', etiqueta: 'Azul' },
  { valor: 'exito', etiqueta: 'Verde' },
  { valor: 'advertencia', etiqueta: 'Ámbar' },
  { valor: 'peligro', etiqueta: 'Rojo' },
  { valor: 'rosa', etiqueta: 'Rosa' },
  { valor: 'cyan', etiqueta: 'Cyan' },
  { valor: 'violeta', etiqueta: 'Violeta' },
  { valor: 'naranja', etiqueta: 'Naranja' },
]

interface ItemConfig {
  id: string
  nombre: string
  color?: string
  activo?: boolean
  orden: number
}

export default function PaginaConfiguracionContactos() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('etiquetas')
  const [etiquetas, setEtiquetas] = useState<ItemConfig[]>([])
  const [rubros, setRubros] = useState<ItemConfig[]>([])
  const [puestos, setPuestos] = useState<ItemConfig[]>([])
  const [cargando, setCargando] = useState(true)

  const secciones: SeccionConfig[] = [
    { id: 'etiquetas', etiqueta: 'Etiquetas', icono: <Tag size={16} /> },
    { id: 'rubros', etiqueta: 'Rubros', icono: <Briefcase size={16} /> },
    { id: 'puestos', etiqueta: 'Puestos', icono: <UserCheck size={16} /> },
  ]

  // Cargar datos
  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/contactos/config')
      const data = await res.json()
      if (data.etiquetas) setEtiquetas(data.etiquetas.map((e: Record<string, unknown>) => ({ id: e.id, nombre: e.nombre, color: e.color || 'neutro', activo: e.activa ?? e.activo ?? true, orden: e.orden || 0 })))
      if (data.rubros) setRubros(data.rubros.map((r: Record<string, unknown>) => ({ id: r.id, nombre: r.nombre, activo: r.activo ?? true, orden: r.orden || 0 })))
      if (data.puestos) setPuestos(data.puestos.map((p: Record<string, unknown>) => ({ id: p.id, nombre: p.nombre, activo: p.activo ?? true, orden: p.orden || 0 })))
    } catch { /* silenciar */ }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Crear item
  const crear = useCallback(async (tipo: string, nombre: string, color?: string) => {
    const res = await fetch('/api/contactos/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, nombre, color }),
    })
    if (res.ok) cargar()
    return res.ok
  }, [cargar])

  // Actualizar item
  const actualizar = useCallback(async (tipo: string, id: string, campos: Record<string, unknown>) => {
    await fetch('/api/contactos/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id, ...campos }),
    })
    cargar()
  }, [cargar])

  // Eliminar item
  const eliminar = useCallback(async (tipo: string, id: string) => {
    await fetch('/api/contactos/config', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id }),
    })
    cargar()
  }, [cargar])

  // Restablecer predefinidos
  const restablecer = useCallback(async (tipo: string) => {
    await fetch('/api/contactos/config/restablecer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    })
    cargar()
  }, [cargar])

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Contactos"
      volverTexto="Contactos"
      onVolver={() => router.push('/contactos')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {cargando ? (
        <div className="text-sm text-texto-terciario py-8 text-center">Cargando...</div>
      ) : (
        <>
          {seccionActiva === 'etiquetas' && (
            <SeccionLista
              titulo="Etiquetas"
              descripcion="Etiquetas para clasificar contactos. Se pueden asignar desde la ficha del contacto."
              items={etiquetas}
              tipo="etiqueta"
              conColor
              onCreate={(nombre, color) => crear('etiqueta', nombre, color)}
              onToggle={(id, activo) => actualizar('etiqueta', id, { activo })}
              onRename={(id, nombre) => actualizar('etiqueta', id, { nombre })}
              onChangeColor={(id, color) => actualizar('etiqueta', id, { color })}
              onDelete={(id) => eliminar('etiqueta', id)}
              onRestablecer={() => restablecer('etiqueta')}
            />
          )}
          {seccionActiva === 'rubros' && (
            <SeccionLista
              titulo="Rubros"
              descripcion="Rubros de industria/actividad para empresas y proveedores."
              items={rubros}
              tipo="rubro"
              onCreate={(nombre) => crear('rubro', nombre)}
              onToggle={(id, activo) => actualizar('rubro', id, { activo })}
              onRename={(id, nombre) => actualizar('rubro', id, { nombre })}
              onDelete={(id) => eliminar('rubro', id)}
              onRestablecer={() => restablecer('rubro')}
            />
          )}
          {seccionActiva === 'puestos' && (
            <SeccionLista
              titulo="Puestos"
              descripcion="Puestos y roles sugeridos para vinculaciones entre contactos."
              items={puestos}
              tipo="puesto"
              onCreate={(nombre) => crear('puesto', nombre)}
              onToggle={(id, activo) => actualizar('puesto', id, { activo })}
              onRename={(id, nombre) => actualizar('puesto', id, { nombre })}
              onDelete={(id) => eliminar('puesto', id)}
              onRestablecer={() => restablecer('puesto')}
            />
          )}
        </>
      )}
    </PlantillaConfiguracion>
  )
}

// ─── Componente de lista configurable ───

function SeccionLista({
  titulo,
  descripcion,
  items,
  tipo,
  conColor = false,
  onCreate,
  onToggle,
  onRename,
  onChangeColor,
  onDelete,
  onRestablecer,
}: {
  titulo: string
  descripcion: string
  items: ItemConfig[]
  tipo: string
  conColor?: boolean
  onCreate: (nombre: string, color?: string) => Promise<boolean>
  onToggle: (id: string, activo: boolean) => void
  onRename: (id: string, nombre: string) => void
  onChangeColor?: (id: string, color: string) => void
  onDelete: (id: string) => void
  onRestablecer?: () => void
}) {
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoColor, setNuevoColor] = useState('neutro')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNombre, setEditandoNombre] = useState('')
  const [creando, setCreando] = useState(false)

  const crearItem = async () => {
    if (!nuevoNombre.trim() || creando) return
    setCreando(true)
    const ok = await onCreate(nuevoNombre.trim(), conColor ? nuevoColor : undefined)
    if (ok) { setNuevoNombre(''); setNuevoColor('neutro') }
    setCreando(false)
  }

  const guardarRename = (id: string) => {
    if (editandoNombre.trim()) onRename(id, editandoNombre.trim())
    setEditandoId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-texto-primario">{titulo}</h3>
          <p className="text-sm text-texto-terciario mt-1">{descripcion}</p>
        </div>
        {onRestablecer && (
          <button type="button" onClick={onRestablecer}
            className="text-xs text-texto-terciario hover:text-texto-marca bg-transparent border border-borde-sutil hover:border-borde-fuerte rounded-md px-2.5 py-1 cursor-pointer transition-colors shrink-0">
            Restablecer predefinidos
          </button>
        )}
      </div>

      {/* Formulario para crear */}
      <div className="flex items-center gap-2 p-3 rounded-lg border border-borde-sutil">
        {conColor && (
          <div className="flex items-center gap-1">
            {COLORES_ETIQUETA.map(c => (
              <button key={c.valor} type="button" onClick={() => setNuevoColor(c.valor)}
                title={c.etiqueta}
                className={`size-5 rounded-full border-2 transition-all cursor-pointer ${nuevoColor === c.valor ? 'border-texto-marca scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: `var(--insignia-${c.valor})` }}
              />
            ))}
          </div>
        )}
        <div className="flex-1">
          <Input
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') crearItem() }}
            placeholder={`Nuevo ${tipo}...`}
            compacto
          />
        </div>
        <Boton onClick={crearItem} disabled={!nuevoNombre.trim() || creando}>
          <Plus size={14} />
        </Boton>
      </div>

      {/* Lista de items */}
      <div className="space-y-0.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-superficie-hover group transition-colors">
            {/* Color (solo etiquetas) */}
            {conColor && onChangeColor && (
              <div className="relative">
                <button type="button"
                  className="size-4 rounded-full border border-borde-sutil cursor-pointer"
                  style={{ backgroundColor: `var(--insignia-${item.color || 'neutro'})` }}
                  onClick={() => {
                    // Ciclar al siguiente color
                    const idx = COLORES_ETIQUETA.findIndex(c => c.valor === item.color)
                    const siguiente = COLORES_ETIQUETA[(idx + 1) % COLORES_ETIQUETA.length]
                    onChangeColor(item.id, siguiente.valor)
                  }}
                  title="Cambiar color"
                />
              </div>
            )}

            {/* Nombre (editable al hacer doble click) */}
            <div className="flex-1 min-w-0">
              {editandoId === item.id ? (
                <input type="text" value={editandoNombre}
                  onChange={e => setEditandoNombre(e.target.value)}
                  onBlur={() => guardarRename(item.id)}
                  onKeyDown={e => { if (e.key === 'Enter') guardarRename(item.id); if (e.key === 'Escape') setEditandoId(null) }}
                  autoFocus
                  className="w-full bg-transparent border-none outline-none text-sm text-texto-primario"
                  style={{ borderBottom: '1px solid var(--borde-foco)' }}
                />
              ) : (
                <span
                  className={`text-sm cursor-pointer ${item.activo !== false ? 'text-texto-primario' : 'text-texto-terciario line-through'}`}
                  onDoubleClick={() => { setEditandoId(item.id); setEditandoNombre(item.nombre) }}
                >
                  {conColor && <Insignia color={(item.color || 'neutro') as ColorInsignia}>{item.nombre}</Insignia>}
                  {!conColor && item.nombre}
                </span>
              )}
            </div>

            {/* Toggle activo */}
            <Interruptor
              activo={item.activo !== false}
              onChange={(v) => onToggle(item.id, v)}
            />

            {/* Eliminar */}
            <button type="button" onClick={() => onDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 text-texto-terciario hover:text-insignia-peligro bg-transparent border-none cursor-pointer transition-all p-1">
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-sm text-texto-terciario text-center py-6">
            No hay {tipo}s configurados. Creá el primero arriba.
          </div>
        )}
      </div>
    </div>
  )
}
