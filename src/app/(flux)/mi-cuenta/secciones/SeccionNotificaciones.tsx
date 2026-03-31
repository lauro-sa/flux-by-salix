'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Camera, Mic, MapPin, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

/**
 * SeccionNotificaciones — permisos de PWA y notificaciones push.
 * Permite al usuario ver el estado de cada permiso y re-solicitarlos si fueron denegados.
 * Permisos: notificaciones push, cámara, micrófono, ubicación.
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

    /* Re-verificar estado después de solicitar */
    await verificarPermisos()
    setSolicitando(null)
  }, [verificarPermisos])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-texto-primario mb-1">Notificaciones y permisos</h2>
        <p className="text-sm text-texto-terciario">
          Gestioná los permisos que Flux necesita para funcionar correctamente en tu dispositivo.
        </p>
      </div>

      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
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

                {/* Botón para solicitar permiso si está denegado o sin decidir */}
                {p.estado === 'denied' && (
                  <div className="mt-2">
                    <p className="text-xs text-insignia-advertencia mb-1.5">
                      Este permiso fue denegado. Para restablecerlo, hacé clic en el candado de la barra de dirección de tu navegador o en los ajustes del sitio.
                    </p>
                    <button
                      type="button"
                      onClick={() => solicitarPermiso(p.id)}
                      disabled={solicitando === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-superficie-hover text-texto-secundario border border-borde-sutil cursor-pointer hover:bg-superficie-seleccionada transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={solicitando === p.id ? 'animate-spin' : ''} />
                      Reintentar
                    </button>
                  </div>
                )}
                {p.estado === 'prompt' && (
                  <button
                    type="button"
                    onClick={() => solicitarPermiso(p.id)}
                    disabled={solicitando === p.id}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-texto-marca text-white border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {solicitando === p.id ? 'Solicitando...' : 'Activar'}
                  </button>
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
