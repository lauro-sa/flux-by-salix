'use client'

import { Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Rows2, KanbanSquare, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { ErrorBoundary } from '@/componentes/feedback/ErrorBoundary'
import { useEstadoWhatsApp } from './_componentes/useEstadoWhatsApp'
import { ListaConversaciones } from '@/app/(flux)/inbox/_componentes/ListaConversaciones'
import { PanelWhatsApp, VisorMedia } from './_componentes/PanelWhatsApp'
import { PanelInfoContacto } from '@/app/(flux)/inbox/_componentes/PanelInfoContacto'
import VistaPipeline from '@/app/(flux)/inbox/_componentes/VistaPipeline'
import { ModalNuevoWhatsApp } from './_componentes/ModalNuevoWhatsApp'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'

/**
 * Página principal de WhatsApp — sección independiente del sidebar.
 * Layout 3 paneles: lista conversaciones | chat | info contacto.
 * Usa su propio hook de estado (useEstadoWhatsApp) separado del inbox.
 */

export default function PaginaWhatsAppWrapper() {
  return (
    <Suspense fallback={null}>
      <PaginaWhatsApp />
    </Suspense>
  )
}

function PaginaWhatsApp() {
  const estado = useEstadoWhatsApp()
  const router = useRouter()
  const anchoInicialRef = useRef(estado.anchoLista)

  // Si no hay canal WhatsApp configurado y ya cargó
  if (!estado.canalWAId && !estado.cargandoConversaciones) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <IconoWhatsApp size={32} />
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--texto-primario)' }}>
            WhatsApp no configurado
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--texto-secundario)' }}>
            Configurá tu cuenta de WhatsApp Business para empezar a recibir y enviar mensajes.
          </p>
          <Boton
            variante="primario"
            icono={<Settings size={14} />}
            onClick={() => router.push('/whatsapp/configuracion')}
          >
            Configurar WhatsApp
          </Boton>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Vista pipeline (solo desktop) */}
        {estado.vistaWA === 'pipeline' && !estado.esMovil ? (
          <div className="flex-1 overflow-auto p-4">
            <VistaPipeline tipoCanal="whatsapp" />
          </div>
        ) : (
          <>
            {/* Lista de conversaciones */}
            {(!estado.esMovil || estado.vistaMovilWA === 'lista') && (
              <div
                className={estado.esMovil ? 'flex-1' : 'flex-shrink-0 relative'}
                style={estado.esMovil ? undefined : { width: estado.anchoLista, minWidth: 280, maxWidth: 500 }}
              >
                <ListaConversaciones
                  conversaciones={estado.conversaciones}
                  seleccionada={estado.conversacionSeleccionada?.id || null}
                  onSeleccionar={estado.seleccionarConversacion}
                  busqueda={estado.busqueda}
                  onBusqueda={estado.setBusqueda}
                  filtroEstado={estado.filtroEstado}
                  onFiltroEstado={estado.setFiltroEstado}
                  filtroEtiqueta={estado.filtroEtiqueta}
                  onFiltroEtiqueta={estado.setFiltroEtiqueta}
                  tipoCanal="whatsapp"
                  cargando={estado.cargandoConversaciones}
                  totalNoLeidos={estado.totalNoLeidos}
                  accionesHeader={
                    <div className="flex items-center gap-0.5">
                      {!estado.esMovil && (
                        <div className="flex items-center border border-borde-sutil rounded-lg overflow-hidden">
                          <Boton
                            variante={estado.vistaWA === 'conversaciones' ? 'primario' : 'fantasma'}
                            tamano="xs"
                            soloIcono
                            titulo="Vista conversaciones"
                            icono={<Rows2 size={14} />}
                            onClick={() => estado.setVistaWA('conversaciones')}
                            className="!rounded-none !rounded-l-lg"
                          />
                          <Boton
                            variante={estado.vistaWA === 'pipeline' ? 'primario' : 'fantasma'}
                            tamano="xs"
                            soloIcono
                            titulo="Vista pipeline"
                            icono={<KanbanSquare size={14} />}
                            onClick={() => estado.setVistaWA('pipeline')}
                            className="!rounded-none !rounded-r-lg"
                          />
                        </div>
                      )}
                      <Boton
                        variante="fantasma"
                        tamano="xs"
                        soloIcono
                        titulo="Alternar panel de info"
                        icono={estado.panelInfoAbierto ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                        onClick={() => estado.setPanelInfoAbierto(!estado.panelInfoAbierto)}
                      />
                      <Boton
                        variante="fantasma"
                        tamano="xs"
                        soloIcono
                        titulo="Configuración"
                        icono={<Settings size={16} />}
                        onClick={() => router.push('/whatsapp/configuracion')}
                      />
                    </div>
                  }
                  botHabilitado={estado.botHabilitado}
                  iaHabilitada={estado.iaHabilitada}
                  onNuevoMensaje={estado.canalWAId ? () => estado.setModalNuevoWA(true) : undefined}
                  onEliminarSeleccion={estado.eliminarMultiples}
                  soloNoLeidos={estado.soloNoLeidos}
                  onToggleNoLeidos={() => estado.setSoloNoLeidos(prev => !prev)}
                  onOperacionMasiva={async (accion, ids) => {
                    const patchMultiple = async (cambios: Record<string, unknown>) => {
                      await Promise.all(ids.map(id =>
                        fetch(`/api/inbox/conversaciones/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(cambios),
                        })
                      ))
                      estado.cargarConversaciones()
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
                      estado.setConversaciones(prev => prev.map(c =>
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
                        const convActual = estado.conversaciones.find(c => c.id === convId)
                        if (convActual && convActual.mensajes_sin_leer !== 0) {
                          await patchConv({ mensajes_sin_leer: 0 })
                        } else {
                          await patchConv({ mensajes_sin_leer: -1 })
                        }
                        break
                      }
                      case 'fijar':
                      case 'fijar_para_mi': {
                        const convActualPin = estado.conversaciones.find(c => c.id === convId)
                        if (convActualPin?._fijada) {
                          await fetch(`/api/inbox/conversaciones/${convId}/pins`, { method: 'DELETE' })
                        } else {
                          await fetch(`/api/inbox/conversaciones/${convId}/pins`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                        }
                        estado.cargarConversaciones()
                        break
                      }
                      case 'silenciar': {
                        const convActualSil = estado.conversaciones.find(c => c.id === convId)
                        if (convActualSil?._silenciada) {
                          await fetch(`/api/inbox/conversaciones/${convId}/silenciar`, { method: 'DELETE' })
                        } else {
                          await fetch(`/api/inbox/conversaciones/${convId}/silenciar`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                        }
                        estado.cargarConversaciones()
                        break
                      }
                      case 'pipeline': {
                        const convActualPip = estado.conversaciones.find(c => c.id === convId)
                        await patchConv({ en_pipeline: !convActualPip?.en_pipeline })
                        break
                      }
                      case 'bloquear':
                        await patchConv({ bloqueada: true })
                        estado.cargarConversaciones()
                        break
                      case 'papelera':
                      case 'mover_papelera':
                        await patchConv({ en_papelera: true })
                        estado.cargarConversaciones()
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
                {/* Drag handle para redimensionar */}
                <div
                  className="absolute top-0 -right-px w-[3px] h-full cursor-col-resize z-10 hidden md:block opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
                  style={{ backgroundColor: 'var(--texto-marca)' }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    estado.redimensionandoRef.current = true
                    const inicio = e.clientX
                    anchoInicialRef.current = estado.anchoLista
                    const onMove = (ev: MouseEvent) => {
                      if (!estado.redimensionandoRef.current) return
                      const nuevoAncho = Math.max(280, Math.min(500, anchoInicialRef.current + (ev.clientX - inicio)))
                      estado.setAnchoLista(nuevoAncho)
                    }
                    const onUp = () => {
                      estado.redimensionandoRef.current = false
                      localStorage.setItem('flux_wa_ancho_lista', String(estado.anchoLista))
                      document.removeEventListener('mousemove', onMove)
                      document.removeEventListener('mouseup', onUp)
                    }
                    document.addEventListener('mousemove', onMove)
                    document.addEventListener('mouseup', onUp)
                  }}
                />
              </div>
            )}

            {/* Chat */}
            {(!estado.esMovil || estado.vistaMovilWA === 'chat') && (
              <ErrorBoundary mensaje="Error en el panel de WhatsApp">
                <PanelWhatsApp
                  conversacion={estado.conversacionSeleccionada}
                  mensajes={estado.mensajes}
                  onEnviar={estado.enviarMensaje}
                  onAbrirVisor={estado.abrirVisor}
                  iaHabilitada={estado.iaHabilitada}
                  botHabilitado={estado.botHabilitado}
                  esMovil={estado.esMovil}
                  onVolver={() => { estado.setVistaMovilWA('lista'); estado.setConversacionSeleccionada(null); estado.setMensajes([]) }}
                  onAbrirInfo={() => estado.setVistaMovilWA('info')}
                  onEtiquetasCambiaron={(etiquetas) => {
                    estado.setConversacionSeleccionada(prev => prev ? { ...prev, etiquetas } : null)
                    estado.setConversaciones(prev => prev.map(c =>
                      c.id === estado.conversacionSeleccionada?.id ? { ...c, etiquetas } : c
                    ))
                  }}
                  onEditarNota={async (id, texto) => {
                    estado.setMensajes(prev => prev.map(m =>
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
                    estado.setMensajes(prev => prev.filter(m => m.id !== id))
                    try {
                      await fetch(`/api/inbox/mensajes/${id}`, { method: 'DELETE' })
                    } catch { /* revertir */ }
                  }}
                  cargando={estado.cargandoMensajes}
                  enviando={estado.enviando}
                  onCargarAnteriores={estado.cargarMensajesAnteriores}
                  hayMasAnteriores={estado.hayMasAnteriores}
                  cargandoAnteriores={estado.cargandoAnteriores}
                  onReaccionar={estado.reaccionarMensaje}
                  onCambioConversacion={(cambios) => {
                    estado.setConversacionSeleccionada(prev => prev ? { ...prev, ...cambios } : null)
                    estado.setConversaciones(prev => prev.map(c =>
                      c.id === estado.conversacionSeleccionada?.id ? { ...c, ...cambios } : c
                    ))
                  }}
                />
              </ErrorBoundary>
            )}

            {/* Info contacto — móvil pantalla completa */}
            {estado.esMovil && estado.vistaMovilWA === 'info' && (
              <div className="flex-1 overflow-y-auto" style={{ background: 'var(--superficie-app)' }}>
                <PanelInfoContacto
                  conversacion={estado.conversacionSeleccionada}
                  mensajes={estado.mensajes}
                  abierto={true}
                  onCerrar={() => estado.setVistaMovilWA('chat')}
                  onAbrirVisor={estado.abrirVisor}
                  esMovil
                />
              </div>
            )}

            {/* Panel derecho desktop: info contacto */}
            {!estado.esMovil && (
              <PanelInfoContacto
                conversacion={estado.conversacionSeleccionada}
                mensajes={estado.mensajes}
                abierto={estado.panelInfoAbierto}
                onCerrar={() => estado.setPanelInfoAbierto(false)}
                onAbrirVisor={estado.abrirVisor}
              />
            )}
          </>
        )}
    </div>

    {/* Visor de media fullscreen */}
    <VisorMedia
      medias={estado.todosLosMedias}
      indice={estado.visorIndice}
      abierto={estado.visorAbierto}
      onCerrar={() => estado.setVisorAbierto(false)}
      onCambiarIndice={estado.setVisorIndice}
    />

    {/* Modal nuevo WhatsApp */}
    {estado.canalWAId && (
      <ModalNuevoWhatsApp
        abierto={estado.modalNuevoWA}
        onCerrar={() => estado.setModalNuevoWA(false)}
        canalId={estado.canalWAId}
        onEnviar={estado.enviarNuevoWhatsApp}
      />
    )}
    </>
  )
}
