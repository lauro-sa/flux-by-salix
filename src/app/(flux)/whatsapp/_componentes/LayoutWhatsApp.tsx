'use client'

import React, { useRef } from 'react'
import { ErrorBoundary } from '@/componentes/feedback/ErrorBoundary'
import { ListaConversaciones } from '@/componentes/mensajeria/ListaConversaciones'
import { PanelWhatsApp } from './PanelWhatsApp'
import { PanelInfoContacto } from '@/componentes/mensajeria/PanelInfoContacto'
import VistaPipeline from '@/componentes/mensajeria/VistaPipeline'
import type { ConversacionConDetalles, MensajeConAdjuntos, EstadoConversacion } from '@/tipos/inbox'
import type { DatosMensaje } from '@/componentes/mensajeria/CompositorMensaje'
import type { VistaMovilWA } from '@/tipos/inbox'

/**
 * Layout del tab de WhatsApp — lista de conversaciones + panel de chat + info contacto.
 * Soporta vista pipeline (kanban) y vista conversaciones (3 paneles).
 * Adaptativo: en móvil muestra una pantalla a la vez.
 */

interface PropsLayoutWhatsApp {
  // Vista
  vistaWA: 'conversaciones' | 'pipeline'
  esMovil: boolean
  vistaMovil: VistaMovilWA
  onCambiarVistaMovil: (vista: VistaMovilWA) => void

  // Conversaciones
  conversaciones: ConversacionConDetalles[]
  conversacionSeleccionada: ConversacionConDetalles | null
  setConversacionSeleccionada: React.Dispatch<React.SetStateAction<ConversacionConDetalles | null>>
  setConversaciones: React.Dispatch<React.SetStateAction<ConversacionConDetalles[]>>
  onSeleccionar: (id: string) => void
  busqueda: string
  onBusqueda: (val: string) => void
  filtroEstado: EstadoConversacion | 'todas'
  onFiltroEstado: (val: EstadoConversacion | 'todas') => void
  filtroEtiqueta: string
  onFiltroEtiqueta: (val: string) => void
  cargandoConversaciones: boolean
  totalNoLeidos: number
  soloNoLeidos: boolean
  onToggleNoLeidos: () => void
  onEliminarSeleccion: (ids: string[]) => void
  cargarConversaciones: () => Promise<void>

  // Bot/IA
  botHabilitado: boolean
  iaHabilitada: boolean

  // Nuevo WA
  canalWAId: string
  onNuevoWA: () => void

  // Mensajes
  mensajes: MensajeConAdjuntos[]
  setMensajes: React.Dispatch<React.SetStateAction<MensajeConAdjuntos[]>>
  cargandoMensajes: boolean
  enviando: boolean
  hayMasAnteriores: boolean
  cargandoAnteriores: boolean
  onEnviar: (datos: DatosMensaje) => Promise<void>
  onCargarAnteriores: () => Promise<void>
  onReaccionar: (mensajeId: string, emoji: string) => Promise<void>

  // Visor media
  onAbrirVisor: (url: string) => void

  // Panel info
  panelInfoAbierto: boolean
  onCerrarPanelInfo: () => void

  // Redimensionado
  anchoLista: number
  setAnchoLista: (ancho: number) => void
  redimensionandoRef: React.MutableRefObject<boolean>
}

export function LayoutWhatsApp({
  vistaWA,
  esMovil,
  vistaMovil,
  onCambiarVistaMovil,
  conversaciones,
  conversacionSeleccionada,
  setConversacionSeleccionada,
  setConversaciones,
  onSeleccionar,
  busqueda,
  onBusqueda,
  filtroEstado,
  onFiltroEstado,
  filtroEtiqueta,
  onFiltroEtiqueta,
  cargandoConversaciones,
  totalNoLeidos,
  soloNoLeidos,
  onToggleNoLeidos,
  onEliminarSeleccion,
  cargarConversaciones,
  botHabilitado,
  iaHabilitada,
  canalWAId,
  onNuevoWA,
  mensajes,
  setMensajes,
  cargandoMensajes,
  enviando,
  hayMasAnteriores,
  cargandoAnteriores,
  onEnviar,
  onCargarAnteriores,
  onReaccionar,
  onAbrirVisor,
  panelInfoAbierto,
  onCerrarPanelInfo,
  anchoLista,
  setAnchoLista,
  redimensionandoRef,
}: PropsLayoutWhatsApp) {
  // Ref local para el ancho inicial al empezar a redimensionar
  const anchoInicialRef = useRef(anchoLista)

  // Vista pipeline (solo desktop)
  if (vistaWA === 'pipeline' && !esMovil) {
    return (
      <div className="flex-1 overflow-auto p-4">
        <VistaPipeline tipoCanal="whatsapp" />
      </div>
    )
  }

  return (
    <>
      {/* Lista de conversaciones — oculta en móvil cuando hay chat abierto */}
      {(!esMovil || vistaMovil === 'lista') && (
        <div
          className={esMovil ? 'flex-1' : 'flex-shrink-0 relative'}
          style={esMovil ? undefined : { width: anchoLista, minWidth: 280, maxWidth: 500 }}
        >
          <ListaConversaciones
            conversaciones={conversaciones}
            seleccionada={conversacionSeleccionada?.id || null}
            onSeleccionar={onSeleccionar}
            busqueda={busqueda}
            onBusqueda={onBusqueda}
            filtroEstado={filtroEstado}
            onFiltroEstado={onFiltroEstado}
            filtroEtiqueta={filtroEtiqueta}
            onFiltroEtiqueta={onFiltroEtiqueta}
            tipoCanal="whatsapp"
            cargando={cargandoConversaciones}
            totalNoLeidos={totalNoLeidos}
            botHabilitado={botHabilitado}
            iaHabilitada={iaHabilitada}
            onNuevoMensaje={canalWAId ? onNuevoWA : undefined}
            onEliminarSeleccion={onEliminarSeleccion}
            soloNoLeidos={soloNoLeidos}
            onToggleNoLeidos={onToggleNoLeidos}
            onOperacionMasiva={async (accion, ids) => {
              const patchMultiple = async (cambios: Record<string, unknown>) => {
                await Promise.all(ids.map(id =>
                  fetch(`/api/inbox/conversaciones/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cambios),
                  })
                ))
                cargarConversaciones()
              }
              if (accion === 'marcar_leido') await patchMultiple({ mensajes_sin_leer: 0 })
              if (accion === 'marcar_no_leido') await patchMultiple({ mensajes_sin_leer: 1 })
              if (accion === 'cerrar') await patchMultiple({ estado: 'resuelta' })
            }}
            onAccionMenu={async (accion, convId, datos) => {
              const patchConv = async (cambios: Record<string, unknown>) => {
                await fetch(`/api/inbox/conversaciones/${convId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(cambios),
                })
                setConversaciones(prev => prev.map(c =>
                  c.id === convId ? { ...c, ...cambios } : c
                ))
              }
              switch (accion) {
                case 'marcar_leido':
                  await patchConv({ mensajes_sin_leer: 0 })
                  break
                case 'marcar_no_leido':
                  await patchConv({ mensajes_sin_leer: 1 })
                  break
                case 'marcar_lectura': {
                  const convActual = conversaciones.find(c => c.id === convId)
                  if (convActual && convActual.mensajes_sin_leer !== 0) {
                    await patchConv({ mensajes_sin_leer: 0 })
                  } else {
                    await patchConv({ mensajes_sin_leer: -1 })
                  }
                  break
                }
                case 'fijar':
                case 'fijar_para_mi': {
                  const convActualPin = conversaciones.find(c => c.id === convId)
                  if (convActualPin?._fijada) {
                    await fetch(`/api/inbox/conversaciones/${convId}/pins`, { method: 'DELETE' })
                  } else {
                    await fetch(`/api/inbox/conversaciones/${convId}/pins`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                  }
                  cargarConversaciones()
                  break
                }
                case 'silenciar': {
                  const convActualSil = conversaciones.find(c => c.id === convId)
                  if (convActualSil?._silenciada) {
                    await fetch(`/api/inbox/conversaciones/${convId}/silenciar`, { method: 'DELETE' })
                  } else {
                    await fetch(`/api/inbox/conversaciones/${convId}/silenciar`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                  }
                  cargarConversaciones()
                  break
                }
                case 'pipeline': {
                  const convActualPip = conversaciones.find(c => c.id === convId)
                  await patchConv({ en_pipeline: !convActualPip?.en_pipeline })
                  break
                }
                case 'bloquear':
                  await patchConv({ bloqueada: true })
                  cargarConversaciones()
                  break
                case 'papelera':
                case 'mover_papelera':
                  await patchConv({ en_papelera: true })
                  cargarConversaciones()
                  break
                case 'fijar_para_usuario':
                  if (datos && typeof datos === 'object' && 'usuario_ids' in datos) {
                    const ids = (datos as { usuario_ids: string[] }).usuario_ids
                    await Promise.all(ids.map(uid =>
                      fetch(`/api/inbox/conversaciones/${convId}/pins`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ usuario_id: uid }),
                      })
                    ))
                  }
                  break
              }
            }}
            esAdmin={true}
          />
          {/* Drag handle para redimensionar — hidden en mobile */}
          <div
            className="absolute top-0 -right-px w-[3px] h-full cursor-col-resize z-10 hidden md:block opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
            style={{ backgroundColor: 'var(--texto-marca)' }}
            onMouseDown={(e) => {
              e.preventDefault()
              redimensionandoRef.current = true
              const inicio = e.clientX
              anchoInicialRef.current = anchoLista
              const onMove = (ev: MouseEvent) => {
                if (!redimensionandoRef.current) return
                const nuevoAncho = Math.max(280, Math.min(500, anchoInicialRef.current + (ev.clientX - inicio)))
                setAnchoLista(nuevoAncho)
              }
              const onUp = () => {
                redimensionandoRef.current = false
                localStorage.setItem('flux_inbox_ancho_lista', String(anchoLista))
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
          />
        </div>
      )}

      {/* Chat — en móvil pantalla completa con botón atrás */}
      {(!esMovil || vistaMovil === 'chat') && (
        <ErrorBoundary mensaje="Error en el panel de WhatsApp">
          <PanelWhatsApp
            conversacion={conversacionSeleccionada}
            mensajes={mensajes}
            onEnviar={onEnviar}
            onAbrirVisor={onAbrirVisor}
            iaHabilitada={iaHabilitada}
            botHabilitado={botHabilitado}
            esMovil={esMovil}
            onVolver={() => { onCambiarVistaMovil('lista'); setConversacionSeleccionada(null); setMensajes([]) }}
            onAbrirInfo={() => onCambiarVistaMovil('info')}
            onEtiquetasCambiaron={(etiquetas) => {
              setConversacionSeleccionada(prev => prev ? { ...prev, etiquetas } : null)
              setConversaciones(prev => prev.map(c =>
                c.id === conversacionSeleccionada?.id ? { ...c, etiquetas } : c
              ))
            }}
            onEditarNota={async (id, texto) => {
              setMensajes(prev => prev.map(m =>
                m.id === id ? { ...m, texto, editado_en: new Date().toISOString() } : m
              ))
              try {
                await fetch(`/api/inbox/mensajes/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ texto }),
                })
              } catch { /* revertir */ }
            }}
            onEliminarNota={async (id) => {
              setMensajes(prev => prev.filter(m => m.id !== id))
              try {
                await fetch(`/api/inbox/mensajes/${id}`, { method: 'DELETE' })
              } catch { /* revertir */ }
            }}
            cargando={cargandoMensajes}
            enviando={enviando}
            onCargarAnteriores={onCargarAnteriores}
            hayMasAnteriores={hayMasAnteriores}
            cargandoAnteriores={cargandoAnteriores}
            onReaccionar={onReaccionar}
            onCambioConversacion={(cambios) => {
              setConversacionSeleccionada(prev => prev ? { ...prev, ...cambios } : null)
              setConversaciones(prev => prev.map(c =>
                c.id === conversacionSeleccionada?.id ? { ...c, ...cambios } : c
              ))
            }}
          />
        </ErrorBoundary>
      )}

      {/* Info contacto — en móvil pantalla completa */}
      {esMovil && vistaMovil === 'info' && (
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--superficie-app)' }}>
          <PanelInfoContacto
            conversacion={conversacionSeleccionada}
            mensajes={mensajes}
            abierto={true}
            onCerrar={() => onCambiarVistaMovil('chat')}
            onAbrirVisor={onAbrirVisor}
            esMovil
          />
        </div>
      )}

      {/* Panel derecho desktop: info contacto */}
      {!esMovil && (
        <PanelInfoContacto
          conversacion={conversacionSeleccionada}
          mensajes={mensajes}
          abierto={panelInfoAbierto}
          onCerrar={onCerrarPanelInfo}
          onAbrirVisor={onAbrirVisor}
        />
      )}
    </>
  )
}
