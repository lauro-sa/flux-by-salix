'use client'

import React from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { ArrowLeft, PanelLeftOpen, PanelLeftClose, Columns2, Rows2, Pen } from 'lucide-react'
import { ErrorBoundary } from '@/componentes/feedback/ErrorBoundary'
import { ListaConversaciones } from './ListaConversaciones'
import { PanelCorreo } from './PanelCorreo'
import { CompositorCorreo, type DatosCorreo } from './CompositorCorreo'
import { SidebarCorreo, type CarpetaCorreo } from './SidebarCorreo'
import type { ConversacionConDetalles, MensajeConAdjuntos, CanalInbox, EstadoConversacion } from '@/tipos/inbox'
import type { ModoVista, VistaMovilCorreo } from './useEstadoInbox'

/**
 * Layout del tab de Correo — sidebar cuentas/carpetas + lista de conversaciones + panel de correo.
 * Maneja tanto la vista desktop (columnas redimensionables) como la vista móvil (navegación secuencial).
 */

interface PropsLayoutCorreo {
  // Conversaciones
  conversaciones: ConversacionConDetalles[]
  conversacionSeleccionada: ConversacionConDetalles | null
  onSeleccionar: (id: string) => void
  busqueda: string
  onBusqueda: (val: string) => void
  filtroEstado: EstadoConversacion | 'todas'
  onFiltroEstado: (val: EstadoConversacion | 'todas') => void
  cargandoConversaciones: boolean
  totalNoLeidos: number
  soloNoLeidos: boolean
  onToggleNoLeidos: () => void
  onEliminarSeleccion: (ids: string[]) => void

  // Mensajes
  mensajes: MensajeConAdjuntos[]
  cargandoMensajes: boolean
  enviando: boolean

  // Canales de correo
  canalesCorreo: CanalInbox[]
  canalCorreoActivo: string
  onCambiarCanal: (id: string) => void
  carpetaCorreo: CarpetaCorreo
  onCambiarCarpeta: (carpeta: CarpetaCorreo) => void
  contadoresCorreo: Record<string, { entrada: number; spam: number }>
  canalTodas: boolean
  onSeleccionarTodas: () => void

  // Acciones correo
  onEnviarCorreo: (datos: DatosCorreo) => Promise<void>
  onProgramar: (datos: DatosCorreo, enviarEn: string) => Promise<void>
  onMarcarSpam: (id: string) => Promise<void>
  onDesmarcarSpam: (id: string) => Promise<void>
  onArchivar: (id: string) => Promise<void>
  onEliminar: (id: string) => Promise<void>
  onToggleLeido: (id: string, sinLeer: number) => Promise<void>
  emailCanal: string
  firmaCorreo?: string

  // Redacción
  redactandoNuevo: boolean
  onRedactarNuevo: () => void
  onCancelarRedaccion: () => void

  // Layout desktop
  modoVista: ModoVista
  onCambiarModoVista: (modo: ModoVista) => void
  sidebarColapsado: boolean
  onToggleSidebar: () => void
  listaColapsada: boolean
  onToggleLista: () => void

  // Responsive
  esMovil: boolean
  vistaMovil: VistaMovilCorreo
  onCambiarVistaMovil: (vista: VistaMovilCorreo) => void

  // Limpiar estado al volver
  onLimpiarSeleccion: () => void

  // Pull to refresh
  onRefresh?: () => Promise<void>

  // Traducciones
  t: (clave: string) => string
}

export function LayoutCorreo({
  conversaciones,
  conversacionSeleccionada,
  onSeleccionar,
  busqueda,
  onBusqueda,
  filtroEstado,
  onFiltroEstado,
  cargandoConversaciones,
  totalNoLeidos,
  soloNoLeidos,
  onToggleNoLeidos,
  onEliminarSeleccion,
  mensajes,
  cargandoMensajes,
  enviando,
  canalesCorreo,
  canalCorreoActivo,
  onCambiarCanal,
  carpetaCorreo,
  onCambiarCarpeta,
  contadoresCorreo,
  canalTodas,
  onSeleccionarTodas,
  onEnviarCorreo,
  onProgramar,
  onMarcarSpam,
  onDesmarcarSpam,
  onArchivar,
  onEliminar,
  onToggleLeido,
  emailCanal,
  firmaCorreo,
  redactandoNuevo,
  onRedactarNuevo,
  onCancelarRedaccion,
  modoVista,
  onCambiarModoVista,
  sidebarColapsado,
  onToggleSidebar,
  listaColapsada,
  onToggleLista,
  esMovil,
  vistaMovil,
  onCambiarVistaMovil,
  onLimpiarSeleccion,
  onRefresh,
  t,
}: PropsLayoutCorreo) {
  // Props comunes para el compositor de correo nuevo
  const propsCompositor: React.ComponentProps<typeof CompositorCorreo> = {
    tipo: 'nuevo' as const,
    canalesCorreo: canalesCorreo.map(c => ({
      id: c.id,
      nombre: c.nombre,
      email: (c.config_conexion as { email?: string; usuario?: string })?.email
        || (c.config_conexion as { email?: string; usuario?: string })?.usuario
        || c.nombre,
    })),
    canalSeleccionado: canalCorreoActivo,
    onCambiarCanal: onCambiarCanal,
    onEnviar: onEnviarCorreo,
    onProgramar: onProgramar,
    cargando: enviando,
    firma: firmaCorreo,
  }

  // Props comunes para el panel de correo
  const propsPanelCorreo: React.ComponentProps<typeof PanelCorreo> = {
    conversacion: conversacionSeleccionada,
    mensajes,
    onEnviarCorreo,
    onMarcarSpam,
    onDesmarcarSpam,
    onArchivar,
    onEliminar,
    onToggleLeido,
    cargando: cargandoMensajes,
    enviando,
    emailCanal: emailCanal,
    firma: firmaCorreo,
  }

  // ─── MÓVIL: vistas una a la vez ───
  if (esMovil) {
    return (
      <>
        {/* Vista 1: Sidebar de cuentas y carpetas */}
        {vistaMovil === 'sidebar' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto" style={{ background: 'var(--superficie-sidebar, var(--superficie-tarjeta))' }}>
            <SidebarCorreo
              canales={canalesCorreo}
              canalActivo={canalCorreoActivo}
              carpetaActiva={carpetaCorreo}
              colapsado={false}
              esMovil
              onSeleccionarCanal={(id) => {
                onCambiarCanal(id)
                onLimpiarSeleccion()
                onCambiarVistaMovil('lista')
              }}
              onSeleccionarCarpeta={(carpeta) => {
                onCambiarCarpeta(carpeta)
                onLimpiarSeleccion()
                onCambiarVistaMovil('lista')
              }}
              onRedactar={() => {
                onLimpiarSeleccion()
                onRedactarNuevo()
                onCambiarVistaMovil('correo')
              }}
              contadores={contadoresCorreo}
              canalTodas={canalTodas}
              onSeleccionarTodas={() => {
                onSeleccionarTodas()
                onLimpiarSeleccion()
                onCambiarVistaMovil('lista')
              }}
            />
          </div>
        )}

        {/* Vista 2: Lista de correos */}
        {vistaMovil === 'lista' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div className="flex items-center gap-2 px-2 min-h-[44px] flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}>
              <Boton
                variante="fantasma"
                tamano="sm"
                icono={<ArrowLeft size={18} />}
                onClick={() => onCambiarVistaMovil('sidebar')}
              >
                Cuentas
              </Boton>
              <span className="text-sm font-medium truncate flex-1 text-right" style={{ color: 'var(--texto-secundario)' }}>
                {carpetaCorreo === 'entrada' ? 'Entrada' : carpetaCorreo === 'enviados' ? 'Enviados' : carpetaCorreo === 'spam' ? 'Spam' : 'Archivado'}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ListaConversaciones
                conversaciones={conversaciones}
                seleccionada={null}
                onSeleccionar={onSeleccionar}
                busqueda={busqueda}
                onBusqueda={onBusqueda}
                filtroEstado={filtroEstado}
                onFiltroEstado={onFiltroEstado}
                tipoCanal="correo"
                cargando={cargandoConversaciones}
                totalNoLeidos={totalNoLeidos}
                onEliminarSeleccion={onEliminarSeleccion}
                soloNoLeidos={soloNoLeidos}
                onToggleNoLeidos={onToggleNoLeidos}
                onRefresh={onRefresh}
              />
            </div>
            {/* FAB redactar */}
            <button
              onClick={() => {
                onLimpiarSeleccion()
                onRedactarNuevo()
                onCambiarVistaMovil('correo')
              }}
              className="absolute bottom-5 right-5 size-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              style={{ background: 'var(--texto-marca)', color: 'var(--texto-inverso)', border: 'none' }}
              aria-label="Redactar correo"
            >
              <Pen size={22} />
            </button>
          </div>
        )}

        {/* Vista 3: Correo abierto o redactando */}
        {vistaMovil === 'correo' && (
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            <div className="flex items-center gap-2 px-2 min-h-[44px] flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}>
              <Boton
                variante="fantasma"
                tamano="sm"
                icono={<ArrowLeft size={18} />}
                onClick={() => { onCambiarVistaMovil('lista'); onLimpiarSeleccion(); onCancelarRedaccion() }}
              >
                {t('comun.volver')}
              </Boton>
            </div>
            {redactandoNuevo ? (
              <div className="flex-1 flex flex-col p-3" style={{ background: 'var(--superficie-app)' }}>
                <CompositorCorreo
                  {...propsCompositor}
                  onCancelar={() => { onCancelarRedaccion(); onCambiarVistaMovil('lista') }}
                />
              </div>
            ) : (
              <ErrorBoundary mensaje="Error en el panel de correo">
                <PanelCorreo {...propsPanelCorreo} />
              </ErrorBoundary>
            )}
          </div>
        )}
      </>
    )
  }

  // ─── DESKTOP: layout con columnas ───
  return (
    <>
      {/* Columna 1: Sidebar cuentas + carpetas */}
      <div
        className="flex flex-col flex-shrink-0 transition-all duration-200 h-full overflow-hidden"
        style={{
          width: sidebarColapsado ? 48 : 224,
          borderRight: '1px solid var(--borde-sutil)',
          background: 'var(--superficie-sidebar, var(--superficie-tarjeta))',
        }}
      >
        <div className="flex items-center justify-center h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Alternar panel" icono={sidebarColapsado ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />} onClick={onToggleSidebar} />
        </div>
        <div className="flex-1 overflow-hidden">
          <SidebarCorreo
            canales={canalesCorreo}
            canalActivo={canalCorreoActivo}
            carpetaActiva={carpetaCorreo}
            colapsado={sidebarColapsado}
            onSeleccionarCanal={(id) => {
              onCambiarCanal(id)
              onLimpiarSeleccion()
            }}
            onSeleccionarCarpeta={(carpeta) => {
              onCambiarCarpeta(carpeta)
              onLimpiarSeleccion()
            }}
            onRedactar={() => {
              onLimpiarSeleccion()
              onRedactarNuevo()
            }}
            contadores={contadoresCorreo}
            canalTodas={canalTodas}
            onSeleccionarTodas={() => {
              onSeleccionarTodas()
              onLimpiarSeleccion()
            }}
          />
        </div>
      </div>

      {/* Panel principal desktop */}
      {modoVista === 'columna' ? (
        <VistaColumnaCorreo
          conversaciones={conversaciones}
          conversacionSeleccionada={conversacionSeleccionada}
          onSeleccionar={onSeleccionar}
          busqueda={busqueda}
          onBusqueda={onBusqueda}
          filtroEstado={filtroEstado}
          onFiltroEstado={onFiltroEstado}
          cargandoConversaciones={cargandoConversaciones}
          totalNoLeidos={totalNoLeidos}
          soloNoLeidos={soloNoLeidos}
          onToggleNoLeidos={onToggleNoLeidos}
          onEliminarSeleccion={onEliminarSeleccion}
          redactandoNuevo={redactandoNuevo}
          onCancelarRedaccion={onCancelarRedaccion}
          propsCompositor={propsCompositor}
          propsPanelCorreo={propsPanelCorreo}
          listaColapsada={listaColapsada}
          onToggleLista={onToggleLista}
          modoVista={modoVista}
          onCambiarModoVista={onCambiarModoVista}
        />
      ) : (
        <VistaFilaCorreo
          conversaciones={conversaciones}
          conversacionSeleccionada={conversacionSeleccionada}
          onSeleccionar={onSeleccionar}
          busqueda={busqueda}
          onBusqueda={onBusqueda}
          filtroEstado={filtroEstado}
          onFiltroEstado={onFiltroEstado}
          cargandoConversaciones={cargandoConversaciones}
          totalNoLeidos={totalNoLeidos}
          soloNoLeidos={soloNoLeidos}
          onToggleNoLeidos={onToggleNoLeidos}
          onEliminarSeleccion={onEliminarSeleccion}
          redactandoNuevo={redactandoNuevo}
          onCancelarRedaccion={onCancelarRedaccion}
          onLimpiarSeleccion={onLimpiarSeleccion}
          propsCompositor={propsCompositor}
          propsPanelCorreo={propsPanelCorreo}
          modoVista={modoVista}
          onCambiarModoVista={onCambiarModoVista}
          t={t}
        />
      )}
    </>
  )
}

// ─── Sub-componente: vista en columnas (lista + panel lado a lado) ───

interface PropsVistaColumna {
  conversaciones: ConversacionConDetalles[]
  conversacionSeleccionada: ConversacionConDetalles | null
  onSeleccionar: (id: string) => void
  busqueda: string
  onBusqueda: (val: string) => void
  filtroEstado: EstadoConversacion | 'todas'
  onFiltroEstado: (val: EstadoConversacion | 'todas') => void
  cargandoConversaciones: boolean
  totalNoLeidos: number
  soloNoLeidos: boolean
  onToggleNoLeidos: () => void
  onEliminarSeleccion: (ids: string[]) => void
  redactandoNuevo: boolean
  onCancelarRedaccion: () => void
  propsCompositor: React.ComponentProps<typeof CompositorCorreo>
  propsPanelCorreo: React.ComponentProps<typeof PanelCorreo>
  listaColapsada: boolean
  onToggleLista: () => void
  modoVista: ModoVista
  onCambiarModoVista: (modo: ModoVista) => void
}

function VistaColumnaCorreo({
  conversaciones,
  conversacionSeleccionada,
  onSeleccionar,
  busqueda,
  onBusqueda,
  filtroEstado,
  onFiltroEstado,
  cargandoConversaciones,
  totalNoLeidos,
  soloNoLeidos,
  onToggleNoLeidos,
  onEliminarSeleccion,
  redactandoNuevo,
  onCancelarRedaccion,
  propsCompositor,
  propsPanelCorreo,
  listaColapsada,
  onToggleLista,
  modoVista,
  onCambiarModoVista,
}: PropsVistaColumna) {
  return (
    <>
      <div
        className="flex flex-col flex-shrink-0 transition-all duration-200 h-full overflow-hidden"
        style={{ width: listaColapsada ? 40 : 320, borderRight: '1px solid var(--borde-sutil)' }}
      >
        {listaColapsada ? (
          <div className="flex items-center justify-center h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Mostrar lista" icono={<PanelLeftOpen size={14} />} onClick={onToggleLista} />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <ListaConversaciones
              conversaciones={conversaciones}
              seleccionada={conversacionSeleccionada?.id || null}
              onSeleccionar={onSeleccionar}
              busqueda={busqueda}
              onBusqueda={onBusqueda}
              filtroEstado={filtroEstado}
              onFiltroEstado={onFiltroEstado}
              tipoCanal="correo"
              cargando={cargandoConversaciones}
              totalNoLeidos={totalNoLeidos}
              onEliminarSeleccion={onEliminarSeleccion}
              soloNoLeidos={soloNoLeidos}
              onToggleNoLeidos={onToggleNoLeidos}
              accionesHeader={
                <div className="flex items-center gap-0.5">
                  <Boton variante="fantasma" tamano="xs" soloIcono titulo="Ocultar lista" icono={<PanelLeftClose size={14} />} onClick={onToggleLista} />
                  <ToggleModoVista modoVista={modoVista} onCambiar={onCambiarModoVista} />
                </div>
              }
            />
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-x-hidden">
        {redactandoNuevo ? (
          <div className="flex-1 flex flex-col p-4" style={{ background: 'var(--superficie-app)' }}>
            <CompositorCorreo
              {...propsCompositor}
              onCancelar={onCancelarRedaccion}
            />
          </div>
        ) : (
          <ErrorBoundary mensaje="Error en el panel de correo">
            <PanelCorreo {...propsPanelCorreo} />
          </ErrorBoundary>
        )}
      </div>
    </>
  )
}

// ─── Sub-componente: vista en fila (lista o panel, uno a la vez) ───

interface PropsVistaFila {
  conversaciones: ConversacionConDetalles[]
  conversacionSeleccionada: ConversacionConDetalles | null
  onSeleccionar: (id: string) => void
  busqueda: string
  onBusqueda: (val: string) => void
  filtroEstado: EstadoConversacion | 'todas'
  onFiltroEstado: (val: EstadoConversacion | 'todas') => void
  cargandoConversaciones: boolean
  totalNoLeidos: number
  soloNoLeidos: boolean
  onToggleNoLeidos: () => void
  onEliminarSeleccion: (ids: string[]) => void
  redactandoNuevo: boolean
  onCancelarRedaccion: () => void
  onLimpiarSeleccion: () => void
  propsCompositor: React.ComponentProps<typeof CompositorCorreo>
  propsPanelCorreo: React.ComponentProps<typeof PanelCorreo>
  modoVista: ModoVista
  onCambiarModoVista: (modo: ModoVista) => void
  t: (clave: string) => string
}

function VistaFilaCorreo({
  conversaciones,
  conversacionSeleccionada,
  onSeleccionar,
  busqueda,
  onBusqueda,
  filtroEstado,
  onFiltroEstado,
  cargandoConversaciones,
  totalNoLeidos,
  soloNoLeidos,
  onToggleNoLeidos,
  onEliminarSeleccion,
  redactandoNuevo,
  onCancelarRedaccion,
  onLimpiarSeleccion,
  propsCompositor,
  propsPanelCorreo,
  modoVista,
  onCambiarModoVista,
  t,
}: PropsVistaFila) {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      {(conversacionSeleccionada || redactandoNuevo) && (
        <div className="flex items-center justify-between px-2 h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          <Boton variante="fantasma" tamano="xs" icono={<ArrowLeft size={14} />} onClick={() => { onLimpiarSeleccion(); onCancelarRedaccion() }}>
            {t('comun.volver')}
          </Boton>
          <ToggleModoVista modoVista={modoVista} onCambiar={onCambiarModoVista} invertido />
        </div>
      )}
      {redactandoNuevo ? (
        <div className="flex-1 flex flex-col p-4" style={{ background: 'var(--superficie-app)' }}>
          <CompositorCorreo
            {...propsCompositor}
            onCancelar={onCancelarRedaccion}
          />
        </div>
      ) : conversacionSeleccionada ? (
        <ErrorBoundary mensaje="Error en el panel de correo">
          <PanelCorreo {...propsPanelCorreo} />
        </ErrorBoundary>
      ) : (
        <div className="flex-1 overflow-hidden">
          <ListaConversaciones
            conversaciones={conversaciones}
            seleccionada={null}
            onSeleccionar={onSeleccionar}
            busqueda={busqueda}
            onBusqueda={onBusqueda}
            filtroEstado={filtroEstado}
            onFiltroEstado={onFiltroEstado}
            tipoCanal="correo"
            cargando={cargandoConversaciones}
            totalNoLeidos={totalNoLeidos}
            onEliminarSeleccion={onEliminarSeleccion}
            soloNoLeidos={soloNoLeidos}
            onToggleNoLeidos={onToggleNoLeidos}
            accionesHeader={
              <ToggleModoVista modoVista={modoVista} onCambiar={onCambiarModoVista} />
            }
          />
        </div>
      )}
    </div>
  )
}

// ─── Componente auxiliar: toggle columna/fila ───

function ToggleModoVista({ modoVista, onCambiar, invertido }: { modoVista: ModoVista; onCambiar: (modo: ModoVista) => void; invertido?: boolean }) {
  const columnaActiva = modoVista === 'columna'
  return (
    <div className="flex items-center gap-0 rounded-md p-0.5" style={{ background: 'var(--superficie-hover)' }}>
      <Boton
        variante="fantasma"
        tamano="xs"
        soloIcono
        icono={<Columns2 size={12} />}
        onClick={() => onCambiar('columna')}
        titulo="Vista columna"
        style={{
          color: (invertido ? !columnaActiva : columnaActiva) ? 'var(--texto-marca)' : 'var(--texto-terciario)',
          background: (invertido ? !columnaActiva : columnaActiva) ? 'var(--superficie-seleccionada)' : undefined,
        }}
      />
      <Boton
        variante="fantasma"
        tamano="xs"
        soloIcono
        icono={<Rows2 size={12} />}
        onClick={() => onCambiar('fila')}
        titulo="Vista fila"
        style={{
          color: (invertido ? columnaActiva : !columnaActiva) ? 'var(--texto-marca)' : 'var(--texto-terciario)',
          background: (invertido ? columnaActiva : !columnaActiva) ? 'var(--superficie-seleccionada)' : undefined,
        }}
      />
    </div>
  )
}
