'use client'

/**
 * Listado de respuestas rápidas de correo — pantalla completa.
 * Mismo patrón que plantillas de correo: PlantillaListado + TablaDinamica.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Zap, Trash2, Copy, Download, Calendar, History,
  Mail, Tag, Type, Send,
} from 'lucide-react'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Boton } from '@/componentes/ui/Boton'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { useAuth } from '@/hooks/useAuth'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { normalizarBusqueda } from '@/lib/validaciones'
import { OPCIONES_DISPONIBLE } from '@/componentes/entidad/_editor_plantilla/constantes'
import type { PlantillaRespuesta } from '@/tipos/inbox'

const I = 13

export default function PaginaListadoRespuestasCorreo() {
  const router = useRouter()
  const { mostrar } = useToast()
  const formato = useFormato()
  const { usuario } = useAuth()
  const usuarioId = usuario?.id || ''

  const [plantillas, setPlantillas] = useState<PlantillaRespuesta[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmarEliminar, setConfirmarEliminar] = useState<PlantillaRespuesta | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Filtros
  const [filtroAutor, setFiltroAutor] = useState<string>('')
  const [filtroModulos, setFiltroModulos] = useState<string[]>([])

  const { busqueda, setBusqueda, busquedaDebounced } = useBusquedaDebounce('', 1, [filtroAutor, filtroModulos.join(',')])

  // ─── Cargar ───
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/correo/respuestas-rapidas')
      const data = await res.json()
      setPlantillas(data.plantillas || [])
    } catch {
      mostrar('error', 'Error al cargar respuestas')
    } finally {
      setCargando(false)
    }
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  // ─── Acciones ───
  const handleEliminar = async (p: PlantillaRespuesta) => {
    setEliminando(true)
    try {
      await fetch(`/api/correo/respuestas-rapidas/${p.id}`, { method: 'DELETE' })
      mostrar('exito', 'Respuesta eliminada')
      cargar()
    } catch {
      mostrar('error', 'Error al eliminar')
    } finally {
      setEliminando(false)
      setConfirmarEliminar(null)
    }
  }

  const eliminarLote = async (ids: Set<string>) => {
    const aEliminar = plantillas.filter(p => ids.has(p.id))
    try {
      await Promise.all(aEliminar.map(p => fetch(`/api/correo/respuestas-rapidas/${p.id}`, { method: 'DELETE' })))
      mostrar('exito', `${aEliminar.length} respuesta(s) eliminada(s)`)
      cargar()
    } catch {
      mostrar('error', 'Error al eliminar en lote')
    }
  }

  const handleDuplicar = async (p: PlantillaRespuesta) => {
    try {
      await fetch('/api/correo/respuestas-rapidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: `${p.nombre} (copia)`,
          contenido: p.contenido,
          contenido_html: p.contenido_html,
          modulos: p.modulos,
          disponible_para: p.disponible_para,
          usuarios_permitidos: p.usuarios_permitidos,
          categoria: p.categoria,
          variables: p.variables,
        }),
      })
      mostrar('exito', 'Respuesta duplicada')
      cargar()
    } catch {
      mostrar('error', 'Error al duplicar')
    }
  }

  const handleExportar = () => {
    const exportable = plantillas.map(p => ({
      nombre: p.nombre,
      contenido: p.contenido,
      contenido_html: p.contenido_html,
      modulos: p.modulos,
      disponible_para: p.disponible_para,
    }))
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `respuestas-correo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    mostrar('exito', `${exportable.length} respuesta(s) exportada(s)`)
  }

  // ─── Reordenar (drag-and-drop) ───
  const handleReordenar = async (idsOrdenados: string[]) => {
    const mapa = new Map(plantillas.map(p => [p.id, p]))
    const nuevas = idsOrdenados.map((id, i) => {
      const p = mapa.get(id)
      return p ? { ...p, orden: i } : null
    }).filter((p): p is PlantillaRespuesta => p !== null)
    setPlantillas(nuevas)
    try {
      await Promise.all(nuevas.map(p =>
        fetch(`/api/correo/respuestas-rapidas/${p.id}`, {
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

  // ─── Filtrar ───
  const plantillasFiltradas = plantillas.filter(p => {
    if (busquedaDebounced) {
      const q = normalizarBusqueda(busquedaDebounced)
      if (!normalizarBusqueda(p.nombre).includes(q) && !normalizarBusqueda(p.contenido).includes(q)) return false
    }
    if (filtroAutor === 'yo' && p.creado_por !== usuarioId) return false
    if (filtroAutor === 'otros' && p.creado_por === usuarioId) return false
    if (filtroModulos.length > 0) {
      const modulosPlantilla = p.modulos || []
      if (modulosPlantilla.length > 0) {
        if (!filtroModulos.some(m => modulosPlantilla.includes(m))) return false
      }
    }
    return true
  })

  // ─── Columnas ───
  const columnas: ColumnaDinamica<PlantillaRespuesta>[] = [
    {
      clave: 'nombre', etiqueta: 'Nombre', ancho: 240, ordenable: true, grupo: 'Identidad', icono: <Type size={I} />,
      render: (p) => (
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="size-7 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'var(--insignia-info-fondo)',
              color: 'var(--insignia-info-texto)',
            }}
          >
            <Mail size={13} />
          </div>
          <div className="text-sm font-medium text-texto-primario truncate">{p.nombre}</div>
        </div>
      ),
    },
    {
      clave: 'contenido', etiqueta: 'Contenido', ancho: 280, ordenable: true, grupo: 'Identidad', icono: <Send size={I} />,
      render: (p) => (
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
          {p.contenido}
        </span>
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
      clave: 'auditoria' as keyof PlantillaRespuesta, etiqueta: 'Auditoría', ancho: 44, grupo: 'Metadata', icono: <History size={I} />,
      render: (p) => (p.editado_por || p.creado_por) ? (
        <IndicadorEditado
          entidadId={p.id}
          nombreCreador={p.creado_por_nombre || null}
          fechaCreacion={p.creado_en}
          nombreEditor={p.editado_por_nombre || null}
          fechaEdicion={p.actualizado_en}
          tablaAuditoria="auditoria_respuestas_rapidas_correo"
          campoReferencia="plantilla_id"
          etiquetasCampos={{
            nombre: 'nombre',
            contenido: 'contenido',
            contenido_html: 'contenido HTML',
            modulos: 'módulos disponibles',
            disponible_para: 'visibilidad',
            usuarios_permitidos: 'usuarios permitidos',
            variables: 'variables',
            activo: 'estado',
            orden: 'orden',
          }}
        />
      ) : null,
    },
    {
      clave: 'acciones', etiqueta: '', ancho: 80, grupo: 'Metadata',
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
      ),
    },
  ]

  return (
    <>
      <PlantillaListado
        titulo="Respuestas rápidas"
        icono={<Zap size={20} />}
        accionPrincipal={{
          etiqueta: 'Nueva respuesta',
          icono: <Plus size={14} />,
          onClick: () => router.push('/inbox/configuracion/respuestas-rapidas/nueva'),
        }}
        acciones={[
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
          seleccionables
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre o contenido..."
          filtros={[
            {
              id: 'autor', etiqueta: 'Autor', tipo: 'pills' as const,
              valor: filtroAutor, onChange: (v) => setFiltroAutor(v as string),
              opciones: [
                { valor: 'yo', etiqueta: 'Creadas por mí' },
                { valor: 'otros', etiqueta: 'Creadas por otros' },
              ],
              descripcion: 'Quién creó la respuesta rápida.',
            },
            {
              id: 'modulos', etiqueta: 'Disponible en', tipo: 'multiple-compacto' as const,
              valor: filtroModulos, onChange: (v) => setFiltroModulos(v as string[]),
              opciones: OPCIONES_DISPONIBLE.filter(o => o.valor !== 'todos').map(o => ({
                valor: o.valor, etiqueta: o.etiqueta,
              })),
              descripcion: 'Módulos donde la respuesta puede usarse.',
            },
          ]}
          onLimpiarFiltros={() => { setFiltroAutor(''); setFiltroModulos([]) }}
          onClickFila={(p) => router.push(`/inbox/configuracion/respuestas-rapidas/${p.id}`)}
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
          idModulo="respuestas_correo"
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
              icono={<Zap size={52} strokeWidth={1} />}
              titulo={cargando ? 'Cargando...' : 'Sin respuestas rápidas'}
              descripcion={cargando ? '' : 'Creá tu primera respuesta rápida. Los agentes la insertan escribiendo / en el compositor.'}
              accion={!cargando
                ? (
                  <Boton onClick={() => router.push('/inbox/configuracion/respuestas-rapidas/nueva')}>
                    <Plus size={14} className="mr-1.5" />
                    Nueva respuesta
                  </Boton>
                )
                : null}
            />
          }
        />
      </PlantillaListado>

      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar respuesta"
        descripcion={`¿Estás seguro de eliminar "${confirmarEliminar?.nombre}"?`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        cargando={eliminando}
        onConfirmar={() => { if (confirmarEliminar) handleEliminar(confirmarEliminar) }}
        onCerrar={() => setConfirmarEliminar(null)}
      />
    </>
  )
}
