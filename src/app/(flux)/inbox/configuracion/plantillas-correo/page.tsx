'use client'

/**
 * Listado de plantillas de correo — página completa.
 * Usa PlantillaListado + TablaDinamica (mismo patrón que contactos, productos, etc.)
 * Al tocar una plantilla navega a [id], al tocar "Nueva" navega a /nueva.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, FileText, RotateCcw, Mail, Tag, Shield,
  Calendar, Trash2, Type, CheckCircle2, Copy, Download,
  History,
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
import { OPCIONES_DISPONIBLE } from '@/componentes/entidad/_editor_plantilla/constantes'
import type { PlantillaRespuesta } from '@/tipos/inbox'

type FilaPlantilla = PlantillaRespuesta & {
  modificada: boolean
  es_por_defecto: boolean
}

const I = 13

export default function PaginaListadoPlantillasCorreo() {
  const router = useRouter()
  const { mostrar } = useToast()
  const formato = useFormato()
  const { usuario } = useAuth()
  const usuarioId = usuario?.id || ''

  const [plantillas, setPlantillas] = useState<FilaPlantilla[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmarEliminar, setConfirmarEliminar] = useState<PlantillaRespuesta | null>(null)
  const [confirmarRestaurar, setConfirmarRestaurar] = useState<PlantillaRespuesta | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)

  // ─── Filtros client-side ───
  const [filtroTipo, setFiltroTipo] = useState<string>('') // '' | 'sistema' | 'personal'
  const [filtroAutor, setFiltroAutor] = useState<string>('') // '' | 'yo' | 'otros'
  const [filtroModulos, setFiltroModulos] = useState<string[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>('') // '' | 'por_defecto' | 'modificada' | 'original'

  // Búsqueda client-side con debounce
  const { busqueda, setBusqueda, busquedaDebounced } = useBusquedaDebounce('', 1, [filtroTipo, filtroAutor, filtroModulos.join(','), filtroEstado])

  // ─── Helper: plantilla de sistema modificada ───
  const fueModificada = (p: PlantillaRespuesta): boolean => {
    if (!p.es_sistema || !p.contenido_original_html || !p.asunto_original) return false
    return p.contenido_html !== p.contenido_original_html || p.asunto !== p.asunto_original
  }

  // ─── Cargar plantillas ───
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/correo/plantillas')
      const data = await res.json()
      const enriched: FilaPlantilla[] = (data.plantillas || []).map((p: PlantillaRespuesta) => ({
        ...p,
        modificada: fueModificada(p),
        es_por_defecto: (p.variables || []).some((v: { clave: string }) => v.clave === '_es_por_defecto'),
      }))
      setPlantillas(enriched)
    } catch {
      mostrar('error', 'Error al cargar plantillas')
    } finally {
      setCargando(false)
    }
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  // ─── Acciones ───
  const handleEliminar = async (p: PlantillaRespuesta) => {
    setEliminando(true)
    try {
      await fetch(`/api/correo/plantillas/${p.id}`, { method: 'DELETE' })
      mostrar('exito', 'Plantilla eliminada')
      cargar()
    } catch {
      mostrar('error', 'Error al eliminar')
    } finally {
      setEliminando(false)
      setConfirmarEliminar(null)
    }
  }

  const handleRestaurar = async (p: PlantillaRespuesta) => {
    setRestaurando(true)
    try {
      await fetch(`/api/correo/plantillas/${p.id}/restaurar`, { method: 'POST' })
      mostrar('exito', 'Plantilla restaurada')
      cargar()
    } catch {
      mostrar('error', 'Error al restaurar')
    } finally {
      setRestaurando(false)
      setConfirmarRestaurar(null)
    }
  }

  const eliminarLote = async (ids: Set<string>) => {
    const aEliminar = plantillas.filter(p => ids.has(p.id) && !p.es_sistema)
    if (aEliminar.length === 0) {
      mostrar('info', 'Las plantillas de sistema no se pueden eliminar')
      return
    }
    try {
      await Promise.all(aEliminar.map(p => fetch(`/api/correo/plantillas/${p.id}`, { method: 'DELETE' })))
      mostrar('exito', `${aEliminar.length} plantilla(s) eliminada(s)`)
      cargar()
    } catch {
      mostrar('error', 'Error al eliminar en lote')
    }
  }

  // ─── Duplicar plantilla ───
  const handleDuplicar = async (p: PlantillaRespuesta) => {
    try {
      await fetch('/api/correo/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: `${p.nombre} (copia)`,
          asunto: p.asunto,
          contenido: p.contenido,
          contenido_html: p.contenido_html,
          modulos: p.modulos,
          disponible_para: p.disponible_para,
          usuarios_permitidos: p.usuarios_permitidos,
          categoria: p.categoria,
          variables: p.variables,
        }),
      })
      mostrar('exito', 'Plantilla duplicada')
      cargar()
    } catch {
      mostrar('error', 'Error al duplicar')
    }
  }

  // ─── Exportar como JSON ───
  const handleExportar = () => {
    const exportable = plantillas.map(p => ({
      nombre: p.nombre,
      asunto: p.asunto,
      contenido_html: p.contenido_html,
      modulos: p.modulos,
      disponible_para: p.disponible_para,
      variables: p.variables,
    }))
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantillas-correo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    mostrar('exito', `${exportable.length} plantilla(s) exportada(s)`)
  }

  // ─── Restaurar todas las de sistema modificadas ───
  const handleRestaurarTodas = async () => {
    const modificadas = plantillas.filter(p => p.es_sistema && p.modificada)
    if (modificadas.length === 0) {
      mostrar('info', 'No hay plantillas de sistema modificadas')
      return
    }
    try {
      await Promise.all(modificadas.map(p =>
        fetch(`/api/correo/plantillas/${p.id}/restaurar`, { method: 'POST' }),
      ))
      mostrar('exito', `${modificadas.length} plantilla(s) restaurada(s)`)
      cargar()
    } catch {
      mostrar('error', 'Error al restaurar')
    }
  }

  // ─── Filtrado client-side: búsqueda + filtros ───
  // ─── Reordenar (drag-and-drop) ───
  const handleReordenar = async (idsOrdenados: string[]) => {
    // Reordenar optimista en cliente
    const mapa = new Map(plantillas.map(p => [p.id, p]))
    const nuevas = idsOrdenados.map((id, i) => {
      const p = mapa.get(id)
      return p ? { ...p, orden: i } : null
    }).filter((p): p is FilaPlantilla => p !== null)
    setPlantillas(nuevas)
    try {
      await Promise.all(nuevas.map(p =>
        fetch(`/api/correo/plantillas/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden: p.orden }),
        }),
      ))
    } catch {
      mostrar('error', 'Error al reordenar')
      cargar()
    }
  }

  const plantillasFiltradas = plantillas.filter(p => {
    // Búsqueda por nombre o asunto
    if (busquedaDebounced) {
      const q = busquedaDebounced.toLowerCase()
      if (!p.nombre.toLowerCase().includes(q) && !(p.asunto || '').toLowerCase().includes(q)) {
        return false
      }
    }

    // Tipo: sistema | personal
    if (filtroTipo === 'sistema' && !p.es_sistema) return false
    if (filtroTipo === 'personal' && p.es_sistema) return false

    // Autor: yo | otros (solo para personales — las de sistema no aplican a "Autor")
    if (filtroAutor === 'yo' && p.creado_por !== usuarioId) return false
    if (filtroAutor === 'otros' && (p.creado_por === usuarioId || p.es_sistema)) return false

    // Módulos: intersección con los seleccionados
    if (filtroModulos.length > 0) {
      const modulosPlantilla = p.modulos || []
      // Si la plantilla no tiene módulos declarados, aplica a "todos" → mostrar siempre que haya match
      if (modulosPlantilla.length > 0) {
        const hayMatch = filtroModulos.some(m => modulosPlantilla.includes(m))
        if (!hayMatch) return false
      }
    }

    // Estado
    if (filtroEstado === 'por_defecto' && !p.es_por_defecto) return false
    if (filtroEstado === 'modificada' && !p.modificada) return false
    if (filtroEstado === 'original' && p.modificada) return false

    return true
  })

  // ─── Columnas de la tabla ───
  const columnas: ColumnaDinamica<FilaPlantilla>[] = [
    {
      clave: 'nombre', etiqueta: 'Nombre', ancho: 260, ordenable: true, grupo: 'Identidad', icono: <Type size={I} />,
      render: (p) => (
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="size-7 rounded-boton flex items-center justify-center shrink-0"
            style={{
              backgroundColor: p.es_sistema ? 'var(--insignia-info-fondo)' : 'var(--insignia-primario-fondo)',
              color: p.es_sistema ? 'var(--insignia-info-texto)' : 'var(--insignia-primario-texto)',
            }}
          >
            {p.es_sistema ? <Shield size={13} /> : <Mail size={13} />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-texto-primario truncate">{p.nombre}</div>
          </div>
        </div>
      ),
    },
    {
      clave: 'asunto', etiqueta: 'Asunto', ancho: 260, ordenable: true, grupo: 'Identidad', icono: <FileText size={I} />,
      render: (p) => p.asunto
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
            {p.asunto}
          </span>
        )
        : <span className="text-texto-terciario">—</span>,
    },
    {
      clave: 'tipo', etiqueta: 'Tipo', ancho: 110, grupo: 'Clasificación', icono: <Shield size={I} />,
      obtenerValor: (p) => p.es_sistema ? 'sistema' : 'personal',
      render: (p) => (
        <Insignia color={p.es_sistema ? 'neutro' : 'primario'} tamano="sm">
          {p.es_sistema ? 'Sistema' : 'Personal'}
        </Insignia>
      ),
    },
    {
      clave: 'modulos', etiqueta: 'Disponible para', ancho: 220, grupo: 'Clasificación', icono: <Tag size={I} />,
      render: (p) => {
        if (!p.modulos || p.modulos.length === 0) {
          return <span className="text-xs text-texto-terciario">Todos</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {p.modulos.slice(0, 3).map((m) => (
              <span key={m} className="text-[11px] px-1.5 py-0.5 rounded-boton bg-white/[0.04] border border-white/[0.06] text-texto-secundario">
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
      clave: 'estado', etiqueta: 'Estado', ancho: 140, grupo: 'Clasificación', icono: <CheckCircle2 size={I} />,
      render: (p) => (
        <div className="flex items-center gap-1">
          {p.modificada && <Insignia color="advertencia" tamano="sm">Modificada</Insignia>}
          {p.es_por_defecto && <Insignia color="exito" tamano="sm">Por defecto</Insignia>}
          {!p.modificada && !p.es_por_defecto && <span className="text-texto-terciario text-xs">—</span>}
        </div>
      ),
    },
    {
      clave: 'actualizado_en', etiqueta: 'Actualizado', ancho: 130, ordenable: true, tipo: 'fecha', grupo: 'Metadata', icono: <Calendar size={I} />,
      render: (p) => p.actualizado_en
        ? <span className="text-xs text-texto-terciario">{formato.fecha(p.actualizado_en, { corta: true })}</span>
        : <span className="text-texto-terciario">—</span>,
    },
    {
      clave: 'auditoria' as keyof FilaPlantilla, etiqueta: 'Auditoría', ancho: 44, grupo: 'Metadata', icono: <History size={I} />,
      render: (p) => (p.editado_por || p.creado_por) ? (
        <IndicadorEditado
          entidadId={p.id}
          nombreCreador={p.creado_por_nombre || null}
          fechaCreacion={p.creado_en}
          nombreEditor={p.editado_por_nombre || null}
          fechaEdicion={p.actualizado_en}
          tablaAuditoria="auditoria_plantillas_correo"
          campoReferencia="plantilla_id"
          etiquetasCampos={{
            nombre: 'nombre',
            asunto: 'asunto',
            contenido: 'contenido',
            contenido_html: 'contenido HTML',
            modulos: 'módulos disponibles',
            disponible_para: 'visibilidad',
            roles_permitidos: 'roles permitidos',
            usuarios_permitidos: 'usuarios permitidos',
            variables: 'variables',
            activo: 'estado',
            orden: 'orden',
          }}
        />
      ) : null,
    },
    {
      clave: 'acciones', etiqueta: '', ancho: 110, grupo: 'Metadata',
      render: (p) => (
        <div className="flex items-center gap-0.5">
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={<Copy size={13} />}
            titulo="Duplicar"
            onClick={(e) => { e.stopPropagation(); handleDuplicar(p) }}
          />
          {p.es_sistema && p.modificada && (
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              icono={<RotateCcw size={13} />}
              titulo="Restaurar original"
              onClick={(e) => { e.stopPropagation(); setConfirmarRestaurar(p) }}
              className="text-insignia-advertencia"
            />
          )}
          {!p.es_sistema && (
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              icono={<Trash2 size={13} />}
              titulo="Eliminar"
              onClick={(e) => { e.stopPropagation(); setConfirmarEliminar(p) }}
              className="text-insignia-peligro"
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PlantillaListado
        titulo="Plantillas de correo"
        icono={<FileText size={20} />}
        accionPrincipal={{
          etiqueta: 'Nueva plantilla',
          icono: <Plus size={14} />,
          onClick: () => router.push('/inbox/configuracion/plantillas-correo/nueva'),
        }}
        acciones={[
          {
            id: 'exportar',
            etiqueta: 'Exportar JSON',
            icono: <Download size={14} />,
            onClick: handleExportar,
          },
          {
            id: 'restaurar-todas',
            etiqueta: 'Restaurar originales de sistema',
            icono: <RotateCcw size={14} />,
            onClick: handleRestaurarTodas,
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
          seleccionables
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre o asunto..."
          filtros={[
            {
              id: 'tipo', etiqueta: 'Tipo', tipo: 'pills' as const,
              valor: filtroTipo, onChange: (v) => setFiltroTipo(v as string),
              opciones: [
                { valor: 'sistema', etiqueta: 'Sistema' },
                { valor: 'personal', etiqueta: 'Personal' },
              ],
            },
            {
              id: 'autor', etiqueta: 'Autor', tipo: 'pills' as const,
              valor: filtroAutor, onChange: (v) => setFiltroAutor(v as string),
              opciones: [
                { valor: 'yo', etiqueta: 'Creadas por mí' },
                { valor: 'otros', etiqueta: 'Creadas por otros' },
              ],
            },
            {
              id: 'modulos', etiqueta: 'Disponible en', tipo: 'multiple-compacto' as const,
              valor: filtroModulos, onChange: (v) => setFiltroModulos(v as string[]),
              opciones: OPCIONES_DISPONIBLE.filter(o => o.valor !== 'todos').map(o => ({
                valor: o.valor, etiqueta: o.etiqueta,
              })),
            },
            {
              id: 'estado', etiqueta: 'Estado', tipo: 'pills' as const,
              valor: filtroEstado, onChange: (v) => setFiltroEstado(v as string),
              opciones: [
                { valor: 'por_defecto', etiqueta: 'Por defecto' },
                { valor: 'modificada', etiqueta: 'Modificadas' },
                { valor: 'original', etiqueta: 'Originales' },
              ],
            },
          ]}
          onLimpiarFiltros={() => {
            setFiltroTipo('')
            setFiltroAutor('')
            setFiltroModulos([])
            setFiltroEstado('')
          }}
          onClickFila={(p) => router.push(`/inbox/configuracion/plantillas-correo/${p.id}`)}
          accionesLote={[
            {
              id: 'eliminar',
              etiqueta: 'Eliminar',
              icono: <Trash2 size={14} />,
              onClick: eliminarLote,
              peligro: true,
              atajo: 'Supr',
              grupo: 'peligro' as const,
            },
          ]}
          idModulo="plantillas_correo"
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
              descripcion={cargando ? '' : 'Creá tu primera plantilla de correo para agilizar respuestas.'}
              accion={!cargando
                ? (
                  <Boton onClick={() => router.push('/inbox/configuracion/plantillas-correo/nueva')}>
                    <Plus size={14} className="mr-1.5" />
                    Nueva plantilla
                  </Boton>
                )
                : null}
            />
          }
        />
      </PlantillaListado>

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar plantilla"
        descripcion={`¿Estás seguro de eliminar "${confirmarEliminar?.nombre}"?`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        cargando={eliminando}
        onConfirmar={() => { if (confirmarEliminar) handleEliminar(confirmarEliminar) }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      {/* Confirmar restaurar */}
      <ModalConfirmacion
        abierto={!!confirmarRestaurar}
        titulo="Restaurar plantilla"
        descripcion={`¿Restaurar "${confirmarRestaurar?.nombre}" a su contenido original? Se perderán los cambios realizados.`}
        etiquetaConfirmar="Restaurar"
        tipo="info"
        cargando={restaurando}
        onConfirmar={() => { if (confirmarRestaurar) handleRestaurar(confirmarRestaurar) }}
        onCerrar={() => setConfirmarRestaurar(null)}
      />
    </>
  )
}
