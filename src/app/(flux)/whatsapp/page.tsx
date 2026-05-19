'use client'

import { Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { ErrorBoundary } from '@/componentes/feedback/ErrorBoundary'
import { useEstadoWhatsApp } from './_componentes/useEstadoWhatsApp'
import { BarraSuperiorWhatsApp } from './_componentes/BarraSuperiorWhatsApp'
import { TabsAudienciaWA } from './_componentes/TabsAudienciaWA'
import { ListaConversaciones } from '@/componentes/mensajeria/ListaConversaciones'
import { PanelWhatsApp, VisorMedia } from './_componentes/PanelWhatsApp'
import { PanelInfoContacto } from '@/componentes/mensajeria/PanelInfoContacto'
import { PanelInfoEmpleado } from '@/componentes/mensajeria/PanelInfoEmpleado'
import VistaPipeline from '@/componentes/mensajeria/VistaPipeline'
import { ModalNuevoWhatsApp } from './_componentes/ModalNuevoWhatsApp'
import { SelectorNuevoChat } from './_componentes/SelectorNuevoChat'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { EstadosConversacion } from '@/tipos/conversacion'

/**
 * Página principal de WhatsApp — sección independiente del sidebar.
 * Layout: barra superior (siempre visible) + contenido (3 paneles o pipeline).
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

  // Mostrar el estado vacío SOLO una vez que terminó el fetch del canal. Sin este
  // flag, durante el primer tick antes de la respuesta de /api/whatsapp/canales se
  // veía un flash de "WhatsApp no configurado" aunque sí estuviera configurado.
  if (estado.canalCargado && !estado.canalWAId) {
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Barra superior — solo desktop. Concentra el switch de audiencia (Clientes/Empleados)
          y los controles de vista/panel/config en un único cabezal full-width. En móvil
          la configuración se hace desde PC y el switch de audiencia se muestra dentro
          de la lista (ver TabsAudienciaWA más abajo). */}
      {!estado.esMovil && (
        <BarraSuperiorWhatsApp
          audiencia={estado.audiencia}
          onCambiarAudiencia={(a) => {
            estado.setAudiencia(a)
            estado.setConversacionSeleccionada(null)
            estado.setMensajes([])
          }}
          vistaWA={estado.vistaWA}
          onCambiarVistaWA={estado.setVistaWA}
          esMovil={estado.esMovil}
          onIrConfiguracion={() => router.push('/whatsapp/configuracion')}
        />
      )}

      {/* Contenido principal */}
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
                className={estado.esMovil ? 'flex-1 min-w-0 overflow-hidden flex flex-col' : 'flex-shrink-0 relative flex flex-col'}
                style={estado.esMovil ? undefined : { width: estado.anchoLista, minWidth: 280, maxWidth: 500 }}
              >
                {/* Tabs Clientes/Empleados — solo móvil. En desktop el switch vive en BarraSuperiorWhatsApp. */}
                {estado.esMovil && (
                  <TabsAudienciaWA
                    audiencia={estado.audiencia}
                    onCambiar={(a) => {
                      estado.setAudiencia(a)
                      estado.setConversacionSeleccionada(null)
                      estado.setMensajes([])
                    }}
                  />
                )}
                <div className="flex-1 min-h-0 overflow-hidden">
                {/* Modo "Nuevo chat": la lista de conversaciones se reemplaza por el selector
                    alfabético de destinatarios (clientes con WA o empleados con tel). Al elegir
                    uno, se cierra el selector y se abre el modal de plantillas precargado. */}
                {estado.modoNuevoChat ? (
                  <SelectorNuevoChat
                    audiencia={estado.audiencia}
                    onCerrar={() => estado.setModoNuevoChat(false)}
                    onSeleccionar={(d) => {
                      estado.setDestinatarioNuevo({ telefono: d.telefono, nombre: d.nombre })
                      estado.setModoNuevoChat(false)
                      estado.setModalNuevoWA(true)
                    }}
                  />
                ) : (<>
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
                  botHabilitado={estado.botHabilitado}
                  iaHabilitada={estado.iaHabilitada}
                  onNuevoMensaje={estado.canalWAId ? () => estado.setModoNuevoChat(true) : undefined}
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
                    if (accion === 'cerrar') await patchMultiple({ estado: EstadosConversacion.RESUELTA })
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
                </>)}
                </div>
                {/* Drag handle para redimensionar */}
                {!estado.esMovil && (
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
                )}
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
                  panelInfoAbierto={estado.panelInfoAbierto}
                  onTogglePanelInfo={() => estado.setPanelInfoAbierto(!estado.panelInfoAbierto)}
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

            {/* Info contacto / empleado — móvil pantalla completa.
                En audiencia=empleados usamos PanelInfoEmpleado (datos del miembro), en
                audiencia=clientes usamos PanelInfoContacto (datos del contacto externo). */}
            {estado.esMovil && estado.vistaMovilWA === 'info' && (
              <div className="flex-1 overflow-y-auto" style={{ background: 'var(--superficie-app)' }}>
                {estado.audiencia === 'empleados' ? (
                  <PanelInfoEmpleado
                    conversacion={estado.conversacionSeleccionada}
                    abierto={true}
                    onCerrar={() => estado.setVistaMovilWA('chat')}
                    esMovil
                  />
                ) : (
                  <PanelInfoContacto
                    conversacion={estado.conversacionSeleccionada}
                    mensajes={estado.mensajes}
                    abierto={true}
                    onCerrar={() => estado.setVistaMovilWA('chat')}
                    onAbrirVisor={estado.abrirVisor}
                    esMovil
                  />
                )}
              </div>
            )}

            {/* Panel derecho desktop: info contacto o empleado según audiencia */}
            {!estado.esMovil && (
              estado.audiencia === 'empleados' ? (
                <PanelInfoEmpleado
                  conversacion={estado.conversacionSeleccionada}
                  abierto={estado.panelInfoAbierto}
                  onCerrar={() => estado.setPanelInfoAbierto(false)}
                />
              ) : (
                <PanelInfoContacto
                  conversacion={estado.conversacionSeleccionada}
                  mensajes={estado.mensajes}
                  abierto={estado.panelInfoAbierto}
                  onCerrar={() => estado.setPanelInfoAbierto(false)}
                  onAbrirVisor={estado.abrirVisor}
                />
              )
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

      {/* Modal nuevo WhatsApp — precargado si vino del selector "Nuevo chat" */}
      {estado.canalWAId && (
        <ModalNuevoWhatsApp
          abierto={estado.modalNuevoWA}
          onCerrar={() => {
            estado.setModalNuevoWA(false)
            estado.setDestinatarioNuevo(null)
          }}
          canalId={estado.canalWAId}
          onEnviar={estado.enviarNuevoWhatsApp}
          telefonoInicial={estado.destinatarioNuevo?.telefono}
          destinatarioNombre={estado.destinatarioNuevo?.nombre}
        />
      )}
    </div>
  )
}
