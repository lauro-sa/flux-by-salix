'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Tag, Briefcase, UserCheck, Link2, Plus, Trash2, GripVertical, DatabaseBackup, Download, Upload, Check, AlertTriangle, CloudCog, ExternalLink, RefreshCw, Unplug } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { ModalRestablecer } from '@/componentes/ui/ModalRestablecer'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Tooltip } from '@/componentes/ui/Tooltip'

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
  const params = useSearchParams()
  const seccionInicial = params.get('gdrive') ? 'google-drive' : 'etiquetas'
  const [seccionActiva, setSeccionActiva] = useState(seccionInicial)
  const [etiquetas, setEtiquetas] = useState<ItemConfig[]>([])
  const [rubros, setRubros] = useState<ItemConfig[]>([])
  const [puestos, setPuestos] = useState<ItemConfig[]>([])
  const [relaciones, setRelaciones] = useState<ItemConfig[]>([])
  const [cargando, setCargando] = useState(true)

  const secciones: SeccionConfig[] = [
    { id: 'etiquetas', etiqueta: 'Etiquetas de contactos', icono: <Tag size={16} />, grupo: 'Clasificación' },
    { id: 'puestos', etiqueta: 'Puestos / Rubros', icono: <Briefcase size={16} />, grupo: 'Clasificación' },
    { id: 'relaciones', etiqueta: 'Relaciones', icono: <Link2 size={16} />, grupo: 'Clasificación' },
    { id: 'copias', etiqueta: 'Copias de seguridad', icono: <DatabaseBackup size={16} />, grupo: 'Datos y respaldo' },
    { id: 'google-drive', etiqueta: 'Google Drive', icono: <CloudCog size={16} />, grupo: 'Datos y respaldo' },
  ]

  // Cargar datos
  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/contactos/config')
      const data = await res.json()
      if (data.etiquetas) setEtiquetas(data.etiquetas.map((e: Record<string, unknown>) => ({ id: e.id, nombre: e.nombre, color: e.color || 'neutro', activo: e.activa ?? e.activo ?? true, orden: e.orden || 0 })))
      if (data.rubros) setRubros(data.rubros.map((r: Record<string, unknown>) => ({ id: r.id, nombre: r.nombre, activo: r.activo ?? true, orden: r.orden || 0 })))
      if (data.puestos) setPuestos(data.puestos.map((p: Record<string, unknown>) => ({ id: p.id, nombre: p.nombre, activo: p.activo ?? true, orden: p.orden || 0 })))
      if (data.relaciones) setRelaciones(data.relaciones.map((r: Record<string, unknown>) => ({ id: r.id as string, nombre: r.nombre as string, activo: (r.activo as boolean) ?? true, orden: (r.orden as number) || 0 })))
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

  // Modal de restablecer inteligente
  const [modalRestablecer, setModalRestablecer] = useState<{ abierto: boolean; tipo: string; etiqueta: string }>({
    abierto: false,
    tipo: '',
    etiqueta: '',
  })

  const abrirRestablecer = useCallback((tipo: string) => {
    const etiquetas: Record<string, string> = {
      etiqueta: 'etiquetas',
      rubro: 'rubros',
      puesto: 'puestos',
      relacion: 'relaciones',
    }
    setModalRestablecer({ abierto: true, tipo, etiqueta: etiquetas[tipo] || tipo })
  }, [])

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Contactos"
      descripcion="Etiquetas, puestos, rubros, relaciones y copias de seguridad de tus contactos."
      iconoHeader={<UserCheck size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Contactos"
      onVolver={() => router.push('/contactos')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {cargando ? (
        <CargadorSeccion />
      ) : (
        <>
          {seccionActiva === 'etiquetas' && (
            <SeccionLista
              titulo="Etiquetas de contactos"
              descripcion="Etiquetas para clasificar contactos. Se pueden asignar desde la ficha del contacto."
              items={etiquetas}
              tipo="etiqueta"
              conColor
              onCreate={(nombre, color) => crear('etiqueta', nombre, color)}
              onToggle={(id, activo) => actualizar('etiqueta', id, { activo })}
              onRename={(id, nombre) => actualizar('etiqueta', id, { nombre })}
              onChangeColor={(id, color) => actualizar('etiqueta', id, { color })}
              onDelete={(id) => eliminar('etiqueta', id)}
              onRestablecer={() => abrirRestablecer('etiqueta')}
            />
          )}
          {seccionActiva === 'puestos' && (
            <div className="space-y-8">
              <SeccionLista
                titulo="Puestos"
                descripcion="Puestos y roles sugeridos para vinculaciones entre contactos."
                items={puestos}
                tipo="puesto"
                onCreate={(nombre) => crear('puesto', nombre)}
                onToggle={(id, activo) => actualizar('puesto', id, { activo })}
                onRename={(id, nombre) => actualizar('puesto', id, { nombre })}
                onDelete={(id) => eliminar('puesto', id)}
                onRestablecer={() => abrirRestablecer('puesto')}
              />
              <div className="border-t border-borde-sutil" />
              <SeccionLista
                titulo="Rubros"
                descripcion="Rubros de industria/actividad para empresas y proveedores."
                items={rubros}
                tipo="rubro"
                onCreate={(nombre) => crear('rubro', nombre)}
                onToggle={(id, activo) => actualizar('rubro', id, { activo })}
                onRename={(id, nombre) => actualizar('rubro', id, { nombre })}
                onDelete={(id) => eliminar('rubro', id)}
                onRestablecer={() => abrirRestablecer('rubro')}
              />
            </div>
          )}
          {seccionActiva === 'relaciones' && (
            <SeccionLista
              titulo="Tipos de relación"
              descripcion="Tipos de relación entre contactos vinculados. Ej: empleado de, administra, provee a."
              items={relaciones}
              tipo="relacion"
              onCreate={(nombre) => crear('relacion', nombre)}
              onToggle={(id, activo) => actualizar('relacion', id, { activo })}
              onRename={(id, nombre) => actualizar('relacion', id, { nombre })}
              onDelete={(id) => eliminar('relacion', id)}
              onRestablecer={() => abrirRestablecer('relacion')}
            />
          )}
          {seccionActiva === 'copias' && (
            <SeccionDatos />
          )}
          {seccionActiva === 'google-drive' && (
            <SeccionGoogleDrive />
          )}
        </>
      )}
      <ModalRestablecer
        abierto={modalRestablecer.abierto}
        onCerrar={() => setModalRestablecer(prev => ({ ...prev, abierto: false }))}
        tipo={modalRestablecer.tipo}
        etiquetaTipo={modalRestablecer.etiqueta}
        onRestablecido={cargar}
      />
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
          <Boton variante="secundario" tamano="xs" onClick={onRestablecer}>Restablecer predefinidos</Boton>
        )}
      </div>

      {/* Formulario para crear */}
      <div className="flex items-center gap-2 p-3 rounded-lg border border-borde-sutil">
        {conColor && (
          <div className="flex items-center gap-1">
            {COLORES_ETIQUETA.map(c => (
              <Tooltip contenido={c.etiqueta}>
              <button key={c.valor} type="button" onClick={() => setNuevoColor(c.valor)}
                className={`size-5 rounded-full border-2 transition-all cursor-pointer ${nuevoColor === c.valor ? 'border-texto-marca scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: `var(--insignia-${c.valor})` }}
              />
              </Tooltip>
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
                <Tooltip contenido="Cambiar color">
                <button type="button"
                  className="size-4 rounded-full border border-borde-sutil cursor-pointer"
                  style={{ backgroundColor: `var(--insignia-${item.color || 'neutro'})` }}
                  onClick={() => {
                    // Ciclar al siguiente color
                    const idx = COLORES_ETIQUETA.findIndex(c => c.valor === item.color)
                    const siguiente = COLORES_ETIQUETA[(idx + 1) % COLORES_ETIQUETA.length]
                    onChangeColor(item.id, siguiente.valor)
                  }}
                />
                </Tooltip>
              </div>
            )}

            {/* Nombre (editable al hacer doble click) */}
            <div className="flex-1 min-w-0">
              {editandoId === item.id ? (
                <Input
                  value={editandoNombre}
                  onChange={e => setEditandoNombre(e.target.value)}
                  onBlur={() => guardarRename(item.id)}
                  onKeyDown={e => { if (e.key === 'Enter') guardarRename(item.id); if (e.key === 'Escape') setEditandoId(null) }}
                  autoFocus
                  variante="plano"
                  compacto
                  formato={null}
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
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar" icono={<Trash2 size={14} />} onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-texto-terciario hover:text-insignia-peligro" />
          </div>
        ))}

        {items.length === 0 && (
          <EstadoVacio titulo={`No hay ${tipo}s configurados`} descripcion="Creá el primero arriba." />
        )}
      </div>
    </div>
  )
}

// ─── Sección de datos: copias de seguridad como en el software anterior ───

function SeccionDatos() {
  const [cargandoExportar, setCargandoExportar] = useState(false)
  const [cargandoExcel, setCargandoExcel] = useState(false)
  const [cargandoRestaurar, setCargandoRestaurar] = useState(false)
  const [resultado, setResultado] = useState<{ creados: number; actualizados: number; errores: number; detalleErrores: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const descargarArchivo = async (url: string, nombreArchivo: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Error al descargar')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nombreArchivo
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportarBackup = async () => {
    setCargandoExportar(true)
    try {
      await descargarArchivo('/api/contactos/backup', `backup_contactos_${new Date().toISOString().slice(0, 10)}.json`)
    } catch { setError('Error al exportar backup') }
    finally { setCargandoExportar(false) }
  }

  const exportarExcel = async () => {
    setCargandoExcel(true)
    try {
      await descargarArchivo('/api/contactos/exportar', `contactos_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch { setError('Error al exportar Excel') }
    finally { setCargandoExcel(false) }
  }

  const restaurarBackup = async (file: File) => {
    setCargandoRestaurar(true)
    setError(null)
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('archivo', file)

      const res = await fetch('/api/contactos/backup', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al restaurar')
        return
      }

      setResultado(data)
    } catch {
      setError('Error al restaurar backup')
    } finally {
      setCargandoRestaurar(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Subtítulo general */}
      <p className="text-sm text-texto-terciario">Exportar e importar contactos del directorio</p>

      {/* ══ Tarjeta 1: Copia de seguridad JSON ══ */}
      <div className="rounded-xl border border-borde-sutil overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center gap-3 p-5 pb-4">
          <div className="size-10 rounded-lg bg-superficie-elevada flex items-center justify-center shrink-0">
            <DatabaseBackup size={20} className="text-texto-secundario" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-texto-primario">Copia de seguridad — Contactos</p>
              <Insignia color="peligro">Sin copia</Insignia>
            </div>
            <p className="text-sm text-texto-terciario mt-0.5">Exportá e importá todos los contactos del directorio con sus notas.</p>
          </div>
        </div>

        {/* Info box */}
        <div className="mx-5 mb-4 p-4 rounded-lg border border-borde-sutil bg-superficie-elevada/50">
          <div className="flex gap-3">
            <div className="size-5 rounded-full bg-insignia-info-fondo flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-insignia-info-texto text-xs font-bold">i</span>
            </div>
            <p className="text-base text-texto-secundario">
              El backup JSON incluye todos los contactos y sus datos relacionados (direcciones, vinculaciones, etiquetas). Al importar se crean contactos nuevos sin afectar los existentes, o se actualizan los que coincidan por código.
            </p>
          </div>
        </div>

        {/* Botones exportar / importar */}
        <div className="flex items-center gap-3 px-5 pb-4">
          <Boton variante="secundario" icono={<Download size={14} />} onClick={exportarBackup} cargando={cargandoExportar}>
            Exportar
          </Boton>
          <div>
            <Boton
              variante="secundario"
              icono={<Upload size={14} />}
              cargando={cargandoRestaurar}
              onClick={() => document.getElementById('input-backup')?.click()}
            >
              Importar
            </Boton>
            <input
              id="input-backup"
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) restaurarBackup(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {/* Resultado de importación */}
        {resultado && (
          <div className="mx-5 mb-4 p-3 rounded-lg bg-superficie-elevada space-y-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-insignia-exito-texto font-medium">
                <Check size={14} className="inline mr-1" />{resultado.creados} creados
              </span>
              <span className="text-insignia-info-texto font-medium">
                {resultado.actualizados} actualizados
              </span>
              {resultado.errores > 0 && (
                <span className="text-insignia-peligro-texto font-medium">
                  {resultado.errores} errores
                </span>
              )}
            </div>
            {resultado.detalleErrores.length > 0 && (
              <div className="space-y-1 max-h-[150px] overflow-auto">
                {resultado.detalleErrores.map((err, i) => (
                  <div key={i} className="text-xs text-insignia-peligro-texto bg-insignia-peligro-fondo/50 p-1.5 rounded">
                    {err}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mx-5 mb-4 p-3 rounded-lg bg-insignia-peligro-fondo text-insignia-peligro-texto text-sm flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Historial placeholder */}
        <div className="px-5 pb-4">
          <p className="text-xs text-texto-terciario italic">Sin copias previas</p>
        </div>
      </div>

      {/* ══ Tarjeta 2: Descargar Excel ══ */}
      <div className="rounded-xl border border-borde-sutil overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center gap-3 p-5 pb-4">
          <div className="size-10 rounded-lg bg-insignia-exito-fondo/50 flex items-center justify-center shrink-0">
            <Download size={20} className="text-insignia-exito-texto" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-texto-primario">Descargar Excel</p>
            <p className="text-sm text-texto-terciario mt-0.5">Descargá una hoja de cálculo formateada con todos los contactos.</p>
          </div>
        </div>

        {/* Info box */}
        <div className="mx-5 mb-4 p-4 rounded-lg border border-borde-sutil bg-superficie-elevada/50">
          <div className="flex gap-3">
            <div className="size-5 rounded-full bg-insignia-info-fondo flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-insignia-info-texto text-xs font-bold">i</span>
            </div>
            <p className="text-base text-texto-secundario">
              Genera un archivo Excel (.xlsx) con encabezados, colores y filtros. Ideal para tener una copia legible de tus datos o compartir con otros sistemas.
            </p>
          </div>
        </div>

        {/* Botón */}
        <div className="px-5 pb-5">
          <Boton variante="secundario" icono={<Download size={14} />} onClick={exportarExcel} cargando={cargandoExcel}>
            Descargar Excel
          </Boton>
        </div>
      </div>
    </div>
  )
}

// ─── Sección de Google Drive ───

interface ConfigGDrive {
  conectado: boolean
  email?: string
  frecuencia_horas?: number
  modulos_activos?: string[]
  hojas?: Record<string, { spreadsheet_id: string; url: string; nombre: string }>
  ultima_sync?: string
  ultimo_error?: string
  resumen?: Record<string, number>
}

interface ModuloDisponible {
  clave: string
  etiqueta: string
  nombreHoja: string
}

function SeccionGoogleDrive() {
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const [config, setConfig] = useState<ConfigGDrive | null>(null)
  const [modulos, setModulos] = useState<ModuloDisponible[]>([])
  const [cargando, setCargando] = useState(true)
  const [conectando, setConectando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  // Detectar resultado de callback OAuth
  useEffect(() => {
    const gdrive = searchParams.get('gdrive')
    if (gdrive === 'conectado') setMensaje('Google Drive conectado correctamente')
    else if (gdrive === 'cancelado') setMensaje('Conexión cancelada')
    else if (gdrive === 'error') setMensaje('Error al conectar con Google Drive')
  }, [searchParams])

  // Cargar configuración
  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/integraciones/google-drive')
      const data = await res.json()
      setConfig(data.config || { conectado: false })
      setModulos(data.modulosDisponibles || [])
    } catch { /* silenciar */ }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Conectar
  const conectar = async () => {
    setConectando(true)
    try {
      const res = await fetch('/api/integraciones/google-drive', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMensaje(data.error || 'Error al conectar')
        setConectando(false)
      }
    } catch {
      setMensaje('Error al conectar')
      setConectando(false)
    }
  }

  // Desconectar
  const desconectar = async () => {
    setDesconectando(true)
    try {
      await fetch('/api/integraciones/google-drive', { method: 'DELETE' })
      setConfig({ conectado: false })
      setMensaje('Google Drive desconectado. Los archivos en Drive no se eliminaron.')
    } catch {
      setMensaje('Error al desconectar')
    } finally {
      setDesconectando(false)
    }
  }

  // Sincronizar ahora
  const sincronizar = async () => {
    setSincronizando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/integraciones/google-drive/sincronizar', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        const modsSinc = data.modulosSincronizados?.join(', ') || ''
        setMensaje(`Sincronización completada: ${modsSinc}`)
        cargar()
      } else {
        setMensaje(data.error || 'Error al sincronizar')
      }
    } catch {
      setMensaje('Error al sincronizar')
    } finally {
      setSincronizando(false)
    }
  }

  // Cambiar frecuencia
  const cambiarFrecuencia = async (horas: string) => {
    await fetch('/api/integraciones/google-drive', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frecuencia_horas: parseInt(horas) }),
    })
    cargar()
  }

  // Toggle módulo
  const toggleModulo = async (clave: string) => {
    if (!config) return
    const activos = config.modulos_activos || []
    const nuevos = activos.includes(clave)
      ? activos.filter(m => m !== clave)
      : [...activos, clave]

    await fetch('/api/integraciones/google-drive', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modulos_activos: nuevos }),
    })
    cargar()
  }

  if (cargando) return <CargadorSeccion />

  return (
    <div className="space-y-6">
      {/* Subtítulo */}
      <p className="text-sm text-texto-terciario">Sincronización automática con Google Sheets</p>

      {/* ══ Tarjeta principal ══ */}
      <div className="rounded-xl border border-borde-sutil overflow-hidden">
        {/* Encabezado con estado */}
        <div className="flex items-center gap-3 p-5 pb-4">
          <div className="size-10 rounded-lg bg-superficie-elevada flex items-center justify-center shrink-0">
            <CloudCog size={20} className="text-texto-secundario" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-texto-primario">Google Drive</p>
              <Insignia color={config?.conectado ? 'exito' : 'neutro'}>
                {config?.conectado ? 'Conectado' : 'Desconectado'}
              </Insignia>
            </div>
            <p className="text-sm text-texto-terciario mt-0.5">
              {config?.conectado
                ? `Sincronizá automáticamente tus contactos con una hoja de Google Sheets`
                : 'Conectá tu cuenta de Google para mantener una copia actualizada en Google Sheets'}
            </p>
          </div>
        </div>

        {!config?.conectado ? (
          <>
            {/* Info box para desconectados */}
            <div className="mx-5 mb-4 p-4 rounded-lg border border-borde-sutil bg-superficie-elevada/50">
              <div className="flex gap-3">
                <div className="size-5 rounded-full bg-insignia-info-fondo flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-insignia-info-texto text-xs font-bold">i</span>
                </div>
                <p className="text-base text-texto-secundario">
                  Conectá tu cuenta de Google para mantener una copia actualizada de tus contactos en Google Sheets. Se crea una hoja de cálculo automáticamente y se actualiza cada pocas horas. Si el sistema tiene problemas, tus datos están seguros en Google Drive.
                </p>
              </div>
            </div>

            {/* Botón conectar con ícono de Google */}
            <div className="mx-5 mb-5">
              <button
                type="button"
                onClick={conectar}
                disabled={conectando}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-borde-sutil hover:border-borde-fuerte bg-superficie-tarjeta hover:bg-superficie-hover transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
              >
                {/* Ícono G de Google */}
                <div className="size-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-borde-sutil shrink-0">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-texto-primario">
                    {conectando ? 'Conectando...' : 'Conectar con Google'}
                  </p>
                  <p className="text-xs text-texto-terciario">Se abrirá una ventana para autorizar el acceso a Google Drive</p>
                </div>
                <span className="text-texto-terciario">→</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Estado conectado */}
            <div className="mx-5 mb-4 space-y-4">
              {/* Email conectado */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-texto-terciario">Conectado como:</span>
                <span className="font-medium text-texto-primario">{config.email}</span>
              </div>

              {/* Última sincronización */}
              {config.ultima_sync && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-texto-terciario">Última sincronización:</span>
                  <span className="text-texto-secundario">
                    {new Date(config.ultima_sync).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              )}

              {/* Error */}
              {config.ultimo_error && (
                <div className="p-3 rounded-lg bg-insignia-peligro-fondo text-insignia-peligro-texto text-sm flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {config.ultimo_error}
                </div>
              )}

              {/* Frecuencia */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-texto-terciario">Sincronizar cada:</span>
                <Select
                  opciones={[
                    { valor: '1', etiqueta: '1 hora' },
                    { valor: '6', etiqueta: '6 horas' },
                    { valor: '12', etiqueta: '12 horas' },
                    { valor: '24', etiqueta: '24 horas' },
                    { valor: '48', etiqueta: '48 horas' },
                    { valor: '72', etiqueta: '72 horas' },
                  ]}
                  valor={String(config.frecuencia_horas || 24)}
                  onChange={cambiarFrecuencia}
                  variante="plano"
                />
              </div>

              {/* Módulos activos */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-texto-secundario">Módulos a sincronizar:</p>
                {modulos.map(modulo => {
                  const activo = (config.modulos_activos || []).includes(modulo.clave)
                  const conteo = config.resumen?.[modulo.clave]
                  const hoja = config.hojas?.[modulo.clave]

                  return (
                    <div key={modulo.clave} className="flex items-center gap-3 py-1.5">
                      <Interruptor activo={activo} onChange={() => toggleModulo(modulo.clave)} />
                      <span className={`text-sm flex-1 ${activo ? 'text-texto-primario' : 'text-texto-terciario'}`}>
                        {modulo.etiqueta}
                        {conteo !== undefined && <span className="text-texto-terciario ml-1">({conteo})</span>}
                      </span>
                      {hoja?.url && (
                        <a href={hoja.url} target="_blank" rel="noopener noreferrer"
                          className="text-texto-terciario hover:text-texto-marca transition-colors">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3 px-5 pb-5">
              <Boton variante="secundario" icono={<RefreshCw size={14} />} onClick={sincronizar} cargando={sincronizando}>
                Sincronizar ahora
              </Boton>
              <Boton variante="peligro" icono={<Unplug size={14} />} onClick={desconectar} cargando={desconectando}>
                Desconectar
              </Boton>
            </div>
          </>
        )}
      </div>

      {/* Mensaje de feedback */}
      {mensaje && (
        <div className="p-3 rounded-lg bg-superficie-elevada text-sm text-texto-secundario flex items-center gap-2">
          <Check size={14} className="text-insignia-exito-texto" />
          {mensaje}
        </div>
      )}
    </div>
  )
}
