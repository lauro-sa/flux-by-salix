'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell, Camera, Mic, MapPin, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Volume2, VolumeX, MessagesSquare, Zap, Smartphone,
} from 'lucide-react'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import { sonidos } from '@/hooks/useSonido'
import {
  leerPrefs, guardarPrefs, PREFS_DEFAULT,
  type PrefsNotificacion,
} from '@/hooks/useNotificaciones'
import { usePushNotificaciones } from '@/hooks/usePushNotificaciones'

/**
 * SeccionNotificaciones — permisos PWA + configuración de sonidos por categoría.
 * Permite al usuario:
 *   1. Ver/gestionar permisos del dispositivo (push, cámara, micro, ubicación)
 *   2. Configurar sonidos de notificación por categoría (inbox, actividades, sistema)
 * Se usa en: Mi Cuenta > Notificaciones
 */

type EstadoPermiso = 'granted' | 'denied' | 'prompt' | 'no_soportado'

interface Permiso {
  id: string
  etiqueta: string
  descripcion: string
  icono: React.ReactNode
  estado: EstadoPermiso
}

function obtenerIconoEstado(estado: EstadoPermiso) {
  switch (estado) {
    case 'granted': return <CheckCircle2 size={16} className="text-insignia-exito" />
    case 'denied': return <XCircle size={16} className="text-insignia-peligro" />
    case 'prompt': return <AlertCircle size={16} className="text-insignia-advertencia" />
    default: return <XCircle size={16} className="text-texto-terciario" />
  }
}

function etiquetaEstado(estado: EstadoPermiso): string {
  switch (estado) {
    case 'granted': return 'Permitido'
    case 'denied': return 'Denegado'
    case 'prompt': return 'Sin decidir'
    default: return 'No soportado'
  }
}

export function SeccionNotificaciones() {
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [solicitando, setSolicitando] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<PrefsNotificacion>(PREFS_DEFAULT)
  const push = usePushNotificaciones()

  /* Cargar preferencias */
  useEffect(() => { setPrefs(leerPrefs()) }, [])

  const actualizarPref = (campo: keyof PrefsNotificacion, valor: boolean) => {
    const nuevas = { ...prefs, [campo]: valor }
    setPrefs(nuevas)
    guardarPrefs(nuevas)
  }

  /* Verificar estado de cada permiso */
  const verificarPermisos = useCallback(async () => {
    const lista: Permiso[] = []

    /* Notificaciones push */
    if ('Notification' in window) {
      lista.push({
        id: 'notificaciones',
        etiqueta: 'Notificaciones push',
        descripcion: 'Recibí alertas de mensajes, actividades y recordatorios aunque la app esté en segundo plano.',
        icono: <Bell size={18} />,
        estado: Notification.permission as EstadoPermiso,
      })
    } else {
      lista.push({
        id: 'notificaciones',
        etiqueta: 'Notificaciones push',
        descripcion: 'Tu navegador no soporta notificaciones push.',
        icono: <Bell size={18} />,
        estado: 'no_soportado',
      })
    }

    /* Cámara */
    if (navigator.permissions) {
      try {
        const camara = await navigator.permissions.query({ name: 'camera' as PermissionName })
        lista.push({
          id: 'camara',
          etiqueta: 'Cámara',
          descripcion: 'Necesaria para fotos de perfil, escanear documentos y videollamadas.',
          icono: <Camera size={18} />,
          estado: camara.state as EstadoPermiso,
        })
      } catch {
        lista.push({
          id: 'camara',
          etiqueta: 'Cámara',
          descripcion: 'Necesaria para fotos de perfil, escanear documentos y videollamadas.',
          icono: <Camera size={18} />,
          estado: 'prompt',
        })
      }
    }

    /* Micrófono */
    if (navigator.permissions) {
      try {
        const micro = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        lista.push({
          id: 'microfono',
          etiqueta: 'Micrófono',
          descripcion: 'Para enviar audios por WhatsApp y notas de voz.',
          icono: <Mic size={18} />,
          estado: micro.state as EstadoPermiso,
        })
      } catch {
        lista.push({
          id: 'microfono',
          etiqueta: 'Micrófono',
          descripcion: 'Para enviar audios por WhatsApp y notas de voz.',
          icono: <Mic size={18} />,
          estado: 'prompt',
        })
      }
    }

    /* Ubicación */
    if (navigator.permissions) {
      try {
        const ubicacion = await navigator.permissions.query({ name: 'geolocation' })
        lista.push({
          id: 'ubicacion',
          etiqueta: 'Ubicación',
          descripcion: 'Para registrar visitas, calcular recorridos y geolocalizar asistencias.',
          icono: <MapPin size={18} />,
          estado: ubicacion.state as EstadoPermiso,
        })
      } catch {
        lista.push({
          id: 'ubicacion',
          etiqueta: 'Ubicación',
          descripcion: 'Para registrar visitas, calcular recorridos y geolocalizar asistencias.',
          icono: <MapPin size={18} />,
          estado: 'prompt',
        })
      }
    }

    setPermisos(lista)
  }, [])

  useEffect(() => { verificarPermisos() }, [verificarPermisos])
  useEffect(() => { push.verificar() }, [push.verificar])

  /* Solicitar/re-solicitar un permiso */
  const solicitarPermiso = useCallback(async (permisoId: string) => {
    setSolicitando(permisoId)

    try {
      switch (permisoId) {
        case 'notificaciones':
          await Notification.requestPermission()
          break
        case 'camara':
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true })
            stream.getTracks().forEach(t => t.stop())
          } catch { /* usuario denegó */ }
          break
        case 'microfono':
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach(t => t.stop())
          } catch { /* usuario denegó */ }
          break
        case 'ubicacion':
          try {
            await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
            })
          } catch { /* usuario denegó */ }
          break
      }
    } catch { /* error silenciado */ }

    await verificarPermisos()
    setSolicitando(null)
  }, [verificarPermisos])

  return (
    <div className="space-y-6">
      <EncabezadoSeccion
        titulo="Notificaciones y permisos"
        descripcion="Configurá cómo y cuándo recibís notificaciones, y gestioná los permisos de tu dispositivo."
      />

      {/* ── Sonidos de notificación ── */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-borde-sutil">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 size={18} className="text-texto-terciario" />
            <h3 className="text-sm font-semibold text-texto-primario">Sonidos</h3>
          </div>
          <p className="text-xs text-texto-terciario">Sonido al recibir una notificación nueva. Se silencia automáticamente con el modo concentración.</p>
        </div>
        <div className="divide-y divide-borde-sutil">
          {/* Sonido global */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              {prefs.sonidoGlobal ? <Volume2 size={18} className="text-texto-secundario" /> : <VolumeX size={18} className="text-texto-terciario" />}
              <div>
                <span className="text-sm font-medium text-texto-primario">Sonido global</span>
                <p className="text-xs text-texto-terciario">Activa o desactiva todos los sonidos de notificación</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {prefs.sonidoGlobal && (
                <Boton variante="fantasma" tamano="xs" onClick={() => sonidos.notificacion()}>
                  Probar
                </Boton>
              )}
              <Interruptor activo={prefs.sonidoGlobal} onChange={(v) => actualizarPref('sonidoGlobal', v)} />
            </div>
          </div>

          {/* Por categoría — solo si el global está activo */}
          {prefs.sonidoGlobal && (
            <>
              <div className="flex items-center justify-between px-5 py-3.5 pl-12">
                <div className="flex items-center gap-3">
                  <MessagesSquare size={16} className="text-texto-terciario" />
                  <span className="text-sm text-texto-primario">Inbox</span>
                  <span className="text-xxs text-texto-terciario">(correos, WhatsApp, internos)</span>
                </div>
                <Interruptor activo={prefs.sonidoInbox} onChange={(v) => actualizarPref('sonidoInbox', v)} />
              </div>
              <div className="flex items-center justify-between px-5 py-3.5 pl-12">
                <div className="flex items-center gap-3">
                  <Zap size={16} className="text-texto-terciario" />
                  <span className="text-sm text-texto-primario">Actividades</span>
                  <span className="text-xxs text-texto-terciario">(asignaciones, vencimientos)</span>
                </div>
                <Interruptor activo={prefs.sonidoActividades} onChange={(v) => actualizarPref('sonidoActividades', v)} />
              </div>
              <div className="flex items-center justify-between px-5 py-3.5 pl-12">
                <div className="flex items-center gap-3">
                  <Bell size={16} className="text-texto-terciario" />
                  <span className="text-sm text-texto-primario">Sistema</span>
                  <span className="text-xxs text-texto-terciario">(portal, cumpleaños, anuncios)</span>
                </div>
                <Interruptor activo={prefs.sonidoSistema} onChange={(v) => actualizarPref('sonidoSistema', v)} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Push Notifications ── */}
      {push.soportado && (
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-borde-sutil">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone size={18} className="text-texto-terciario" />
              <h3 className="text-sm font-semibold text-texto-primario">Notificaciones push</h3>
            </div>
            <p className="text-xs text-texto-terciario">Recibí alertas en tu dispositivo aunque la app esté en segundo plano o cerrada.</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-texto-primario">
                {push.suscrito ? 'Push activadas' : 'Push desactivadas'}
              </span>
              <p className="text-xs text-texto-terciario mt-0.5">
                {push.permiso === 'denied'
                  ? 'Permiso denegado. Restablecelo desde los ajustes del navegador.'
                  : push.suscrito
                    ? 'Recibirás notificaciones push en este dispositivo.'
                    : 'Activá para recibir alertas de mensajes, actividades y recordatorios.'}
              </p>
            </div>
            <Interruptor
              activo={push.suscrito}
              deshabilitado={push.cargando || push.permiso === 'denied'}
              onChange={async (v) => {
                if (v) await push.suscribir()
                else await push.desuscribir()
              }}
            />
          </div>
        </div>
      )}

      {/* ── Permisos del dispositivo ── */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-borde-sutil">
          <h3 className="text-sm font-semibold text-texto-primario mb-0.5">Permisos del dispositivo</h3>
          <p className="text-xs text-texto-terciario">Permisos que Flux necesita para funcionar correctamente en este dispositivo.</p>
        </div>
        <div className="divide-y divide-borde-sutil">
          {permisos.map((p) => (
            <div key={p.id} className="flex items-start gap-4 px-5 py-4">
              <span className="shrink-0 mt-0.5 text-texto-terciario">{p.icono}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-texto-primario">{p.etiqueta}</span>
                  {obtenerIconoEstado(p.estado)}
                  <span className={`text-xxs font-medium ${
                    p.estado === 'granted' ? 'text-insignia-exito' :
                    p.estado === 'denied' ? 'text-insignia-peligro' :
                    p.estado === 'prompt' ? 'text-insignia-advertencia' :
                    'text-texto-terciario'
                  }`}>
                    {etiquetaEstado(p.estado)}
                  </span>
                </div>
                <p className="text-xs text-texto-terciario leading-relaxed">{p.descripcion}</p>

                {p.estado === 'denied' && (
                  <div className="mt-2">
                    <p className="text-xs text-insignia-advertencia mb-1.5">
                      Este permiso fue denegado. Para restablecerlo, hacé clic en el candado de la barra de dirección de tu navegador o en los ajustes del sitio.
                    </p>
                    <Boton
                      variante="secundario"
                      tamano="sm"
                      icono={<RefreshCw size={12} className={solicitando === p.id ? 'animate-spin' : ''} />}
                      onClick={() => solicitarPermiso(p.id)}
                      disabled={solicitando === p.id}
                    >
                      Reintentar
                    </Boton>
                  </div>
                )}
                {p.estado === 'prompt' && (
                  <Boton
                    variante="primario"
                    tamano="sm"
                    onClick={() => solicitarPermiso(p.id)}
                    disabled={solicitando === p.id}
                    cargando={solicitando === p.id}
                    className="mt-2"
                  >
                    Activar
                  </Boton>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info sobre PWA */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <h3 className="text-sm font-semibold text-texto-secundario mb-2">¿Tenés problemas con los permisos?</h3>
        <div className="text-xs text-texto-terciario space-y-2 leading-relaxed">
          <p>
            Si denegaste un permiso y el botón de reintentar no funciona, podés restablecerlo manualmente:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Chrome / Edge:</strong> Tocá el ícono del candado en la barra de dirección → Permisos del sitio → Restablecer permisos.</li>
            <li><strong>Safari (iPhone):</strong> Ajustes → Safari → Permisos de sitios web → seleccioná este sitio.</li>
            <li><strong>Firefox:</strong> Tocá el candado → Borrar permisos y cookies.</li>
          </ul>
          <p>
            Para recibir notificaciones en tu celular, asegurate de tener la app instalada como PWA (Agregar a pantalla de inicio).
          </p>
        </div>
      </div>
    </div>
  )
}
