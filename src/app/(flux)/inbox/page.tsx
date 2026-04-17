'use client'

import { Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessagesSquare, Settings } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useEstadoInbox } from './_componentes/useEstadoInbox'
import { useAtajosInbox } from './_componentes/useAtajosInbox'
import { BarraSuperiorInbox } from './_componentes/BarraSuperiorInbox'
import { LayoutCorreo } from './_componentes/LayoutCorreo'
import { LayoutInterno } from './_componentes/LayoutInterno'
import type { TipoCanal, CanalInterno } from '@/tipos/inbox'

/**
 * Página principal del Inbox — 2 tabs (Correo, Interno).
 * WhatsApp se separó a su propia sección (/whatsapp).
 * Layout adaptado a cada canal.
 */

function hayModulosActivos(modulosActivos: Set<string>) {
  return modulosActivos.has('inbox_correo') ||
    modulosActivos.has('inbox_interno')
}

export default function PaginaInboxWrapper() {
  return (
    <Suspense fallback={null}>
      <PaginaInbox />
    </Suspense>
  )
}

function PaginaInbox() {
  const estado = useEstadoInbox()
  const router = useRouter()

  const limpiarSeleccionCorreo = useCallback(() => {
    estado.setConversacionSeleccionada(null)
    estado.setMensajes([])
  }, [])

  const handleCambiarTab = useCallback((tab: TipoCanal) => {
    estado.tabCambiadoManualRef.current = true
    estado.setTabActivo(tab)
    estado.setConversacionSeleccionada(null)
    estado.setMensajes([])
    estado.setSoloNoLeidos(false)
    estado.paginaMensajesRef.current = 1
  }, [])

  // Atajos de teclado para correo (solo desktop, solo tab correo)
  useAtajosInbox({
    conversaciones: estado.conversaciones,
    conversacionSeleccionadaId: estado.conversacionSeleccionada?.id || null,
    onSeleccionar: estado.seleccionarConversacion,
    onResponder: () => {
      // Dispara click en el botón de responder del PanelCorreo
      // Usamos un evento custom que el PanelCorreo escucha
      window.dispatchEvent(new CustomEvent('flux:inbox-responder'))
    },
    onArchivar: estado.archivarConversacion,
    onEliminar: estado.eliminarConversacion,
    onToggleLeido: estado.toggleLeido,
    onMarcarSpam: estado.marcarSpam,
    onLimpiarSeleccion: limpiarSeleccionCorreo,
    respondiendo: estado.redactandoNuevo,
    mensajesSinLeer: estado.conversacionSeleccionada?.mensajes_sin_leer || 0,
    habilitado: estado.tabActivo === 'correo' && !estado.esMovil,
  })

  if (!hayModulosActivos(estado.modulosActivos)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <MessagesSquare size={32} style={{ color: 'var(--texto-terciario)' }} />
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--texto-primario)' }}>
            Inbox no activado
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--texto-secundario)' }}>
            Activá los módulos de Correo o Mensajería interna desde la configuración de tu empresa.
          </p>
          <Boton
            variante="primario"
            icono={<Settings size={14} />}
            onClick={() => router.push('/configuracion')}
          >
            Ir a configuración
          </Boton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Barra superior: tabs + acciones */}
      <BarraSuperiorInbox
        tabActivo={estado.tabActivo}
        onCambiarTab={handleCambiarTab}
        modulosActivos={estado.modulosActivos}
        t={estado.t}
        sincronizando={estado.sincronizando}
        ultimoSync={estado.ultimoSync}
        onSincronizarCorreos={estado.sincronizarCorreos}
        onIrConfiguracion={() => router.push('/inbox/configuracion')}
        esMovil={estado.esMovil}
      />

      {/* Contenido principal */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Tab Correo */}
        {estado.tabActivo === 'correo' && (
          <LayoutCorreo
            conversaciones={estado.conversaciones}
            conversacionSeleccionada={estado.conversacionSeleccionada}
            onSeleccionar={estado.seleccionarConversacion}
            busqueda={estado.busqueda}
            onBusqueda={estado.setBusqueda}
            filtroEstado={estado.filtroEstado}
            onFiltroEstado={estado.setFiltroEstado}
            cargandoConversaciones={estado.cargandoConversaciones}
            totalNoLeidos={estado.totalNoLeidos}
            soloNoLeidos={estado.soloNoLeidos}
            onToggleNoLeidos={() => estado.setSoloNoLeidos(prev => !prev)}
            onEliminarSeleccion={estado.eliminarMultiples}
            mensajes={estado.mensajes}
            cargandoMensajes={estado.cargandoMensajes}
            enviando={estado.enviando}
            canalesCorreo={estado.canalesCorreo}
            canalCorreoActivo={estado.canalCorreoActivo}
            onCambiarCanal={(id) => { estado.setCanalCorreoActivo(id); estado.setCanalTodas(false) }}
            carpetaCorreo={estado.carpetaCorreo}
            onCambiarCarpeta={estado.setCarpetaCorreo}
            contadoresCorreo={estado.contadoresCorreo}
            canalTodas={estado.canalTodas}
            onSeleccionarTodas={() => { estado.setCanalTodas(true); estado.setCanalCorreoActivo('') }}
            onEnviarCorreo={estado.enviarCorreo}
            onProgramar={estado.programarCorreo}
            onMarcarSpam={estado.marcarSpam}
            onDesmarcarSpam={estado.desmarcarSpam}
            onArchivar={estado.archivarConversacion}
            onEliminar={estado.eliminarConversacion}
            onToggleLeido={estado.toggleLeido}
            emailCanal={estado.emailCanalActivo}
            firmaCorreo={estado.firmaCorreo}
            redactandoNuevo={estado.redactandoNuevo}
            onRedactarNuevo={() => { limpiarSeleccionCorreo(); estado.setRedactandoNuevo(true) }}
            onCancelarRedaccion={() => estado.setRedactandoNuevo(false)}
            modoVista={estado.modoVista}
            onCambiarModoVista={estado.cambiarModoVista}
            sidebarColapsado={estado.sidebarCorreoColapsado}
            onToggleSidebar={estado.toggleSidebarCorreo}
            listaColapsada={estado.listaCorreoColapsada}
            onToggleLista={estado.toggleListaCorreo}
            esMovil={estado.esMovil}
            vistaMovil={estado.vistaMovilCorreo}
            onCambiarVistaMovil={estado.setVistaMovilCorreo}
            onLimpiarSeleccion={limpiarSeleccionCorreo}
            onRefresh={estado.sincronizarCorreos}
            t={estado.t}
          />
        )}

        {/* Tab Interno */}
        {estado.tabActivo === 'interno' && (
          <LayoutInterno
            conversacion={estado.conversacionSeleccionada}
            mensajes={estado.mensajes}
            canalesPublicos={estado.canalesPublicos}
            canalesPrivados={estado.canalesPrivados}
            canalesGrupos={estado.canalesGrupos}
            canalSeleccionado={estado.canalInternoSeleccionado}
            onSeleccionarCanal={(canal) => {
              estado.setCanalInternoSeleccionado(canal)
              if (!canal) {
                estado.setConversacionSeleccionada(null)
                estado.setMensajes([])
              }
              if (estado.esMovil && canal) estado.setVistaMovilInterno('chat')
            }}
            modalCrearAbierto={estado.modalCrearInterno}
            onAbrirModalCrear={() => estado.setModalCrearInterno(true)}
            onCerrarModalCrear={() => estado.setModalCrearInterno(false)}
            onEnviar={estado.enviarMensaje}
            cargando={estado.cargandoMensajes}
            enviando={estado.enviando}
            usuarioId={estado.usuarioId}
            onRecargarCanales={estado.cargarCanalesInternos}
            onReaccionar={estado.reaccionarMensaje}
            esMovil={estado.esMovil}
            vistaMovil={estado.vistaMovilInterno}
            onVolverMovil={() => {
              estado.setVistaMovilInterno('canales')
              estado.setCanalInternoSeleccionado(null)
              estado.setConversacionSeleccionada(null)
              estado.setMensajes([])
            }}
            onCanalCreado={(canalCreado: CanalInterno) => {
              const tipo = canalCreado.tipo
              if (tipo === 'publico') estado.setCanalesPublicos(prev => [canalCreado, ...prev])
              else if (tipo === 'grupo') estado.setCanalesGrupos(prev => [canalCreado, ...prev])
              else estado.setCanalesPrivados(prev => [canalCreado, ...prev])
            }}
            onAutoSeleccionarCanal={(canal: CanalInterno) => estado.setCanalInternoSeleccionado(canal)}
            onLimpiarConversacion={() => {
              estado.setConversacionSeleccionada(null)
              estado.setMensajes([])
            }}
          />
        )}
      </div>
    </div>
  )
}
