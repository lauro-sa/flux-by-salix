'use client'

/**
 * Listado de plantillas de WhatsApp (Meta Business) — pantalla completa.
 * Usa PlantillaListado + TablaDinamica.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import {
  Plus, FileText, Trash2, Download, Calendar, History, RefreshCw,
  Type, Send, Shield, Tag, Languages, Loader2, AlertTriangle,
} from 'lucide-react'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { useAuth } from '@/hooks/useAuth'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { normalizarBusqueda } from '@/lib/validaciones'
import type { CanalMensajeria } from '@/tipos/inbox'
import type { PlantillaWhatsApp, EstadoMeta } from '@/tipos/whatsapp'

const I = 13

const ESTADO_META_COLOR: Record<EstadoMeta, 'exito' | 'peligro' | 'advertencia' | 'neutro'> = {
  BORRADOR: 'neutro',
  PENDING: 'advertencia',
  APPROVED: 'exito',
  REJECTED: 'peligro',
  DISABLED: 'peligro',
  PAUSED: 'advertencia',
  ERROR: 'peligro',
}

const ESTADO_META_ETIQUETA: Record<EstadoMeta, string> = {
  BORRADOR: 'Borrador',
  PENDING: 'En revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  DISABLED: 'Deshabilitada',
  PAUSED: 'Pausada',
  ERROR: 'Error',
}

const MODULOS_DISPONIBLES = [
  { valor: 'inbox', etiqueta: 'Inbox' },
  { valor: 'presupuestos', etiqueta: 'Presupuestos' },
  { valor: 'contactos', etiqueta: 'Contactos' },
  { valor: 'ordenes', etiqueta: 'Órdenes' },
  { valor: 'actividades', etiqueta: 'Actividades' },
]

export default function PaginaListadoPlantillasMeta() {
  const router = useRouter()
  const { mostrar } = useToast()
  const { setMigajaDinamica } = useNavegacion()

  useEffect(() => {
    setMigajaDinamica('/whatsapp/configuracion/plantillas-meta', 'Plantillas Meta')
  }, [setMigajaDinamica])
  const formato = useFormato()
  const { usuario } = useAuth()
  const usuarioId = usuario?.id || ''

  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([])
  const [canales, setCanales] = useState<CanalMensajeria[]>([])
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState<PlantillaWhatsApp | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const [filtroEstado, setFiltroEstado] = useState<string>('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('')
  const [filtroAutor, setFiltroAutor] = useState<string>('')
  const [filtroModulos, setFiltroModulos] = useState<string[]>([])
  const [filtroSync, setFiltroSync] = useState<string>('')
  const [reenviandoId, setReenviandoId] = useState<string | null>(null)

  const { busqueda, setBusqueda, busquedaDebounced } = useBusquedaDebounce('', 1, [
    filtroEstado, filtroCategoria, filtroAutor, filtroModulos.join(','), filtroSync,
  ])

  // ─── Cargar ───
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [resP, resC] = await Promise.all([
        fetch('/api/whatsapp/plantillas'),
        fetch('/api/whatsapp/canales'),
      ])
      const [dataP, dataC] = await Promise.all([resP.json(), resC.json()])
      setPlantillas(dataP.plantillas || [])
      setCanales(dataC.canales || [])
    } catch {
      mostrar('error', 'Error al cargar plantillas')
    } finally {
      setCargando(false)
    }
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  // ─── Sincronizar con Meta ───
  const sincronizar = async () => {
    if (canales.length === 0) {
      mostrar('info', 'Conectá una cuenta de WhatsApp primero')
      return
    }
    // Feedback inmediato: el menú de acciones se cierra al clickear, así que si
    // no mostramos un toast, el usuario no ve nada pasando durante la request.
    setSincronizando(true)
    mostrar('info', 'Sincronizando plantillas con Meta…')
    try {
      const resultados = await Promise.all(
        canales.map(c =>
          fetch('/api/whatsapp/plantillas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accion: 'sincronizar', canal_id: c.id }),
          }).then(r => r.json()),
        ),
      )
      const total = resultados.reduce((s, r) => s + (r.sincronizadas || 0) + (r.creadas || 0), 0)
      const creadas = resultados.reduce((s, r) => s + (r.creadas || 0), 0)
      const msgExtra = creadas > 0 ? ` (${creadas} nueva${creadas !== 1 ? 's' : ''})` : ''
      mostrar('exito', `Sincronización completa: ${total} plantilla${total !== 1 ? 's' : ''}${msgExtra}`)
      cargar()
    } catch {
      mostrar('error', 'Error al sincronizar con Meta')
    } finally {
      setSincronizando(false)
    }
  }

  // ─── Re-enviar plantilla a Meta desde el listado ───
  const handleReenviar = async (p: PlantillaWhatsApp) => {
    if (!p.canal_id) {
      mostrar('error', 'Esta plantilla no tiene canal de WhatsApp asignado')
      return
    }
    setReenviandoId(p.id)
    try {
      const res = await fetch('/api/whatsapp/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'enviar_a_meta', id: p.id, canal_id: p.canal_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')
      mostrar('exito', 'Plantilla enviada a Meta para revisión')
      cargar()
    } catch (err) {
      mostrar('error', `Error: ${(err as Error).message}`)
    } finally {
      setReenviandoId(null)
    }
  }

  // ─── Acciones por fila ───
  const handleEliminar = async (p: PlantillaWhatsApp) => {
    setEliminando(true)
    try {
      const res = await fetch('/api/whatsapp/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'eliminar', id: p.id, canal_id: p.canal_id }),
      })
      if (!res.ok) throw new Error()
      mostrar('exito', 'Plantilla eliminada')
      cargar()
    } catch {
      mostrar('error', 'Error al eliminar')
    } finally {
      setEliminando(false)
      setConfirmarEliminar(null)
    }
  }

  const handleExportar = () => {
    const exportable = plantillas.map(p => ({
      nombre: p.nombre,
      nombre_api: p.nombre_api,
      categoria: p.categoria,
      idioma: p.idioma,
      componentes: p.componentes,
      modulos: p.modulos,
      estado_meta: p.estado_meta,
    }))
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantillas-whatsapp-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    mostrar('exito', `${exportable.length} plantilla(s) exportada(s)`)
  }

  // ─── Reordenar (drag-and-drop) ───
  const handleReordenar = async (idsOrdenados: string[]) => {
    const mapa = new Map(plantillas.map(p => [p.id, p]))
    const nuevas: PlantillaWhatsApp[] = []
    idsOrdenados.forEach((id, i) => {
      const p = mapa.get(id)
      if (p) nuevas.push({ ...p, orden: i })
    })
    setPlantillas(nuevas)
    try {
      await fetch('/api/whatsapp/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'reordenar',
          ordenes: idsOrdenados.map((id, i) => ({ id, orden: i })),
        }),
      })
    } catch {
      mostrar('error', 'Error al reordenar')
      cargar()
    }
  }

  // ─── Filtrado ───
  const plantillasFiltradas = plantillas.filter(p => {
    if (busquedaDebounced) {
      const q = normalizarBusqueda(busquedaDebounced)
      const cuerpo = p.componentes?.cuerpo?.texto || ''
      if (!normalizarBusqueda(p.nombre).includes(q)
        && !normalizarBusqueda(p.nombre_api).includes(q)
        && !normalizarBusqueda(cuerpo).includes(q)) return false
    }
    if (filtroEstado && p.estado_meta !== filtroEstado) return false
    if (filtroCategoria && p.categoria !== filtroCategoria) return false
    if (filtroAutor === 'yo' && p.creado_por !== usuarioId) return false
    if (filtroAutor === 'otros' && p.creado_por === usuarioId) return false
    if (filtroModulos.length > 0) {
      const modulosP = p.modulos || []
      if (modulosP.length > 0 && !filtroModulos.some(m => modulosP.includes(m))) return false
    }
    if (filtroSync === 'desincronizadas' && !(p.desincronizada === true || p.desincronizada === null)) return false
    if (filtroSync === 'sincronizadas' && p.desincronizada !== false) return false
    return true
  })

  // ─── Columnas ───
  const columnas: ColumnaDinamica<PlantillaWhatsApp>[] = [
    {
      clave: 'nombre', etiqueta: 'Nombre', ancho: 240, ordenable: true, grupo: 'Identidad', icono: <Type size={I} />,
      obligatoria: true,
      render: (p) => (
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="size-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--insignia-exito-fondo)', color: 'var(--insignia-exito-texto)' }}
          >
            <FileText size={13} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-texto-primario truncate">{p.nombre}</div>
            <div className="text-[11px] font-mono text-texto-terciario truncate">{p.nombre_api}</div>
          </div>
        </div>
      ),
    },
    {
      clave: 'cuerpo', etiqueta: 'Cuerpo', ancho: 260, grupo: 'Identidad', icono: <Send size={I} />,
      render: (p) => {
        const texto = p.componentes?.cuerpo?.texto || ''
        return texto
          ? (
            <span
              className="text-sm text-texto-secundario block whitespace-normal leading-tight"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {texto}
            </span>
          )
          : <span className="text-texto-terciario">—</span>
      },
    },
    {
      clave: 'estado_meta', etiqueta: 'Estado Meta', ancho: 170, grupo: 'Clasificación', icono: <Shield size={I} />,
      render: (p) => (
        <div className="flex items-center gap-1.5">
          <Insignia color={ESTADO_META_COLOR[p.estado_meta]} tamano="sm">
            {ESTADO_META_ETIQUETA[p.estado_meta]}
          </Insignia>
          {p.desincronizada === true && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border text-insignia-peligro border-insignia-peligro/40 bg-insignia-peligro/10"
              title="La versión local tiene cambios que no fueron enviados a Meta"
            >
              <AlertTriangle size={10} />
              Sin sync
            </span>
          )}
          {p.desincronizada === null && p.estado_meta !== 'BORRADOR' && p.estado_meta !== 'ERROR' && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border text-insignia-advertencia border-insignia-advertencia/40 bg-insignia-advertencia/10"
              title="Plantilla sin referencia de sincronización. Re-enviá para fijarla."
            >
              <AlertTriangle size={10} />
              Sin ref.
            </span>
          )}
        </div>
      ),
    },
    {
      clave: 'categoria', etiqueta: 'Categoría', ancho: 120, grupo: 'Clasificación', icono: <Tag size={I} />,
      render: (p) => (
        <span className="text-xs text-texto-secundario">{p.categoria}</span>
      ),
    },
    {
      clave: 'idioma', etiqueta: 'Idioma', ancho: 90, grupo: 'Clasificación', icono: <Languages size={I} />,
      render: (p) => (
        <span className="text-xs font-mono text-texto-terciario uppercase">{p.idioma}</span>
      ),
    },
    {
      clave: 'modulos', etiqueta: 'Disponible en', ancho: 200, grupo: 'Clasificación', icono: <Tag size={I} />,
      render: (p) => {
        if (!p.modulos || p.modulos.length === 0) {
          return <span className="text-xs text-texto-terciario">Todos</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {p.modulos.slice(0, 3).map(m => (
              <span key={m} className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-texto-secundario">
                {m}
              </span>
            ))}
            {p.modulos.length > 3 && (
              <span className="text-[11px] text-texto-terciario">+{p.modulos.length - 3}</span>
            )}
          </div>
        )
      },
    },
    {
      clave: 'actualizado_en', etiqueta: 'Actualizado', ancho: 130, ordenable: true, tipo: 'fecha', grupo: 'Metadata', icono: <Calendar size={I} />,
      render: (p) => p.actualizado_en
        ? <span className="text-xs text-texto-terciario">{formato.fecha(p.actualizado_en, { corta: true })}</span>
        : <span className="text-texto-terciario">—</span>,
    },
    {
      clave: 'auditoria' as keyof PlantillaWhatsApp, etiqueta: 'Auditoría', ancho: 44, grupo: 'Metadata', icono: <History size={I} />,
      render: (p) => (p.editado_por || p.creado_por) ? (
        <IndicadorEditado
          entidadId={p.id}
          nombreCreador={p.creado_por_nombre || null}
          fechaCreacion={p.creado_en}
          nombreEditor={p.editado_por_nombre || null}
          fechaEdicion={p.actualizado_en}
          tablaAuditoria="auditoria_plantillas_whatsapp"
          campoReferencia="plantilla_id"
          etiquetasCampos={{
            nombre: 'nombre',
            nombre_api: 'nombre API',
            categoria: 'categoría',
            idioma: 'idioma',
            componentes: 'contenido',
            modulos: 'módulos disponibles',
            disponible_para: 'visibilidad',
          }}
        />
      ) : null,
    },
    {
      clave: 'acciones', etiqueta: '', ancho: 96, grupo: 'Metadata',
      render: (p) => {
        const puedeReenviar = !!p.canal_id && (p.desincronizada === true || p.desincronizada === null || p.estado_meta === 'ERROR' || p.estado_meta === 'REJECTED')
        return (
          <div className="flex items-center gap-1">
            {puedeReenviar && (
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                icono={reenviandoId === p.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Send size={13} />}
                titulo="Re-enviar a Meta para revisión"
                onClick={(e) => { e.stopPropagation(); handleReenviar(p) }}
                disabled={reenviandoId === p.id}
              />
            )}
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              icono={<Trash2 size={13} />}
              titulo="Eliminar"
              onClick={(e) => { e.stopPropagation(); setConfirmarEliminar(p) }}
              className="text-insignia-peligro"
            />
          </div>
        )
      },
    },
  ]

  return (
    <>
      <PlantillaListado
        titulo="Plantillas de WhatsApp"
        icono={<FileText size={20} />}
        accionPrincipal={{
          etiqueta: 'Nueva plantilla',
          icono: <Plus size={14} />,
          onClick: () => router.push('/whatsapp/configuracion/plantillas-meta/nueva'),
        }}
        acciones={[
          {
            id: 'sincronizar',
            etiqueta: sincronizando ? 'Sincronizando...' : 'Sincronizar con Meta',
            icono: sincronizando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />,
            onClick: sincronizar,
          },
          {
            id: 'exportar',
            etiqueta: 'Exportar JSON',
            icono: <Download size={14} />,
            onClick: handleExportar,
          },
        ]}
      >
        <TablaDinamica
          columnas={columnas}
          datos={plantillasFiltradas}
          claveFila={(p) => p.id}
          totalRegistros={plantillasFiltradas.length}
          registrosPorPagina={25}
          vistas={['lista']}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre o contenido..."
          filtros={[
            {
              id: 'estado', etiqueta: 'Estado Meta', tipo: 'pills' as const,
              valor: filtroEstado, onChange: (v) => setFiltroEstado(v as string),
              opciones: [
                { valor: 'BORRADOR', etiqueta: 'Borrador' },
                { valor: 'PENDING', etiqueta: 'En revisión' },
                { valor: 'APPROVED', etiqueta: 'Aprobadas' },
                { valor: 'REJECTED', etiqueta: 'Rechazadas' },
                { valor: 'ERROR', etiqueta: 'Error' },
              ],
              descripcion: 'Estado de aprobación de la plantilla en Meta Business.',
            },
            {
              id: 'categoria', etiqueta: 'Categoría', tipo: 'pills' as const,
              valor: filtroCategoria, onChange: (v) => setFiltroCategoria(v as string),
              opciones: [
                { valor: 'MARKETING', etiqueta: 'Marketing' },
                { valor: 'UTILITY', etiqueta: 'Utilidad' },
                { valor: 'AUTHENTICATION', etiqueta: 'Autenticación' },
              ],
              descripcion: 'Clasificación declarada a Meta al crear la plantilla.',
            },
            {
              id: 'autor', etiqueta: 'Autor', tipo: 'pills' as const,
              valor: filtroAutor, onChange: (v) => setFiltroAutor(v as string),
              opciones: [
                { valor: 'yo', etiqueta: 'Creadas por mí' },
                { valor: 'otros', etiqueta: 'Creadas por otros' },
              ],
              descripcion: 'Quién creó la plantilla dentro de la empresa.',
            },
            {
              id: 'modulos', etiqueta: 'Disponible en', tipo: 'multiple-compacto' as const,
              valor: filtroModulos, onChange: (v) => setFiltroModulos(v as string[]),
              opciones: MODULOS_DISPONIBLES,
              descripcion: 'Módulos donde la plantilla puede usarse al enviar mensajes.',
            },
            {
              id: 'sync', etiqueta: 'Sincronización', tipo: 'pills' as const,
              valor: filtroSync, onChange: (v) => setFiltroSync(v as string),
              opciones: [
                { valor: 'desincronizadas', etiqueta: 'Con cambios sin enviar' },
                { valor: 'sincronizadas', etiqueta: 'Sincronizadas con Meta' },
              ],
              descripcion: 'Plantillas cuyo contenido local difiere del último snapshot enviado a Meta.',
            },
          ]}
          gruposFiltros={[
            { id: 'estado_meta', etiqueta: 'Estado Meta', filtros: ['estado', 'sync', 'categoria'] },
            { id: 'uso', etiqueta: 'Uso', filtros: ['autor', 'modulos'] },
          ]}
          onLimpiarFiltros={() => {
            setFiltroEstado(''); setFiltroCategoria(''); setFiltroAutor(''); setFiltroModulos([]); setFiltroSync('')
          }}
          onClickFila={(p) => router.push(`/whatsapp/configuracion/plantillas-meta/${p.id}`)}
          idModulo="plantillas_meta"
          filasReordenables
          onReordenarFilas={handleReordenar}
          opcionesOrden={[
            { etiqueta: 'Más recientes', clave: 'actualizado_en', direccion: 'desc' },
            { etiqueta: 'Más antiguos', clave: 'actualizado_en', direccion: 'asc' },
            { etiqueta: 'Nombre A→Z', clave: 'nombre', direccion: 'asc' },
            { etiqueta: 'Nombre Z→A', clave: 'nombre', direccion: 'desc' },
          ]}
          estadoVacio={
            <EstadoVacio
              icono={<FileText size={52} strokeWidth={1} />}
              titulo={cargando ? 'Cargando...' : 'Sin plantillas'}
              descripcion={cargando ? '' : 'Creá tu primera plantilla de WhatsApp Meta Business.'}
              accion={!cargando
                ? (
                  <Boton onClick={() => router.push('/whatsapp/configuracion/plantillas-meta/nueva')}>
                    <Plus size={14} className="mr-1.5" />
                    Nueva plantilla
                  </Boton>
                )
                : null}
            />
          }
        />
      </PlantillaListado>

      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar plantilla"
        descripcion={`¿Estás seguro de eliminar "${confirmarEliminar?.nombre}"?${
          confirmarEliminar && !['BORRADOR', 'ERROR'].includes(confirmarEliminar.estado_meta)
            ? ' También se eliminará de Meta.'
            : ''
        }`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        cargando={eliminando}
        onConfirmar={() => { if (confirmarEliminar) handleEliminar(confirmarEliminar) }}
        onCerrar={() => setConfirmarEliminar(null)}
      />
    </>
  )
}
