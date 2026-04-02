'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, Smartphone, Monitor, Tablet, Globe, Trash2, AlertTriangle, LogOut } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import { useAuth } from '@/hooks/useAuth'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useRouter } from 'next/navigation'

/**
 * SeccionSeguridad — cambiar contraseña y dispositivos activos.
 * Máximo 4 dispositivos activos simultáneos.
 */

interface Dispositivo {
  id: string
  nombre: string
  tipo: 'desktop' | 'mobile' | 'tablet' | 'desconocido'
  navegador: string
  creadoEn: string
  ultimaActividad: string
  actual: boolean
}

function obtenerIconoDispositivo(tipo: Dispositivo['tipo']) {
  switch (tipo) {
    case 'desktop': return <Monitor size={18} />
    case 'mobile': return <Smartphone size={18} />
    case 'tablet': return <Tablet size={18} />
    default: return <Globe size={18} />
  }
}

function parsearUserAgent(ua: string): { tipo: Dispositivo['tipo']; nombre: string; navegador: string } {
  const esMobile = /mobile|android|iphone/i.test(ua)
  const esTablet = /tablet|ipad/i.test(ua)
  const tipo: Dispositivo['tipo'] = esTablet ? 'tablet' : esMobile ? 'mobile' : 'desktop'

  let navegador = 'Navegador desconocido'
  if (/chrome/i.test(ua) && !/edge/i.test(ua)) navegador = 'Chrome'
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) navegador = 'Safari'
  else if (/firefox/i.test(ua)) navegador = 'Firefox'
  else if (/edge/i.test(ua)) navegador = 'Edge'

  let so = 'Dispositivo'
  if (/windows/i.test(ua)) so = 'Windows'
  else if (/macintosh|mac os/i.test(ua)) so = 'macOS'
  else if (/linux/i.test(ua) && !esMobile) so = 'Linux'
  else if (/iphone/i.test(ua)) so = 'iPhone'
  else if (/ipad/i.test(ua)) so = 'iPad'
  else if (/android/i.test(ua)) so = 'Android'

  return { tipo, nombre: `${so} — ${navegador}`, navegador }
}

type ModalCerrar = null | 'individual' | 'todas' | 'todas_menos_actual'

export function SeccionSeguridad() {
  const { restablecerContrasena } = useAuth()
  const router = useRouter()

  /* Estado de cambio de contraseña */
  const [contrasenaActual, setContrasenaActual] = useState('')
  const [contrasenaNueva, setContrasenaNueva] = useState('')
  const [contrasenaConfirmar, setContrasenaConfirmar] = useState('')
  const [errorContrasena, setErrorContrasena] = useState('')
  const [exitoContrasena, setExitoContrasena] = useState(false)
  const [guardandoContrasena, setGuardandoContrasena] = useState(false)

  /* Dispositivos */
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [cargandoDispositivos, setCargandoDispositivos] = useState(true)

  /* Modal de confirmación para cerrar sesiones */
  const [modalCerrar, setModalCerrar] = useState<ModalCerrar>(null)
  const [dispositivoSeleccionado, setDispositivoSeleccionado] = useState<string | null>(null)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)

  /* ID de la sesión actual (extraído del JWT) */
  const [idSesionActual, setIdSesionActual] = useState<string | null>(null)

  /* Cargar dispositivos activos */
  useEffect(() => {
    const cargar = async () => {
      try {
        const supabase = crearClienteNavegador()
        const { data } = await supabase.auth.getSession()
        if (!data.session) return

        const res = await fetch('/api/auth/sesiones')
        if (res.ok) {
          const sesiones = await res.json()
          const mapeados: Dispositivo[] = (sesiones as Array<{
            id: string
            user_agent?: string
            updated_at?: string
            created_at?: string
            current?: boolean
          }>).map((s) => {
            const info = parsearUserAgent(s.user_agent || '')
            return {
              id: s.id,
              nombre: info.nombre,
              tipo: info.tipo,
              navegador: info.navegador,
              creadoEn: s.created_at || new Date().toISOString(),
              ultimaActividad: s.updated_at || new Date().toISOString(),
              actual: s.current || false,
            }
          })

          /* Sesión actual siempre arriba */
          mapeados.sort((a, b) => {
            if (a.actual) return -1
            if (b.actual) return 1
            return new Date(b.ultimaActividad).getTime() - new Date(a.ultimaActividad).getTime()
          })

          setDispositivos(mapeados)

          const sesionActual = mapeados.find(d => d.actual)
          if (sesionActual) setIdSesionActual(sesionActual.id)
        } else {
          crearFallbackActual()
        }
      } catch {
        crearFallbackActual()
      } finally {
        setCargandoDispositivos(false)
      }
    }

    const crearFallbackActual = () => {
      const info = parsearUserAgent(navigator.userAgent)
      setDispositivos([{
        id: 'actual',
        nombre: info.nombre,
        tipo: info.tipo,
        navegador: info.navegador,
        creadoEn: new Date().toISOString(),
        ultimaActividad: new Date().toISOString(),
        actual: true,
      }])
    }

    cargar()
  }, [])

  /* Cambiar contraseña */
  const manejarCambiarContrasena = useCallback(async () => {
    setErrorContrasena('')
    setExitoContrasena(false)

    if (!contrasenaNueva || !contrasenaConfirmar) {
      setErrorContrasena('Completá ambos campos de contraseña.')
      return
    }
    if (contrasenaNueva.length < 8) {
      setErrorContrasena('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (contrasenaNueva !== contrasenaConfirmar) {
      setErrorContrasena('Las contraseñas no coinciden.')
      return
    }

    setGuardandoContrasena(true)
    const resultado = await restablecerContrasena(contrasenaNueva)
    setGuardandoContrasena(false)

    if (resultado.error) {
      setErrorContrasena(resultado.error)
    } else {
      setExitoContrasena(true)
      setContrasenaActual('')
      setContrasenaNueva('')
      setContrasenaConfirmar('')
      setTimeout(() => setExitoContrasena(false), 3000)
    }
  }, [contrasenaNueva, contrasenaConfirmar, restablecerContrasena])

  /* Abrir modal para cerrar sesión individual */
  const abrirModalIndividual = (dispositivoId: string) => {
    setDispositivoSeleccionado(dispositivoId)
    const dispositivo = dispositivos.find(d => d.id === dispositivoId)
    setModalCerrar(dispositivo?.actual ? 'individual' : 'individual')
    setModalCerrar('individual')
  }

  /* Confirmar cierre de sesión */
  const confirmarCerrarSesion = useCallback(async () => {
    setCerrandoSesion(true)
    try {
      if (modalCerrar === 'individual' && dispositivoSeleccionado) {
        const esActual = dispositivos.find(d => d.id === dispositivoSeleccionado)?.actual

        const res = await fetch('/api/auth/sesiones/cerrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: dispositivoSeleccionado }),
        })

        if (res.ok) {
          if (esActual) {
            router.push('/login')
            return
          }
          setDispositivos(prev => prev.filter(d => d.id !== dispositivoSeleccionado))
        }
      } else if (modalCerrar === 'todas') {
        const res = await fetch('/api/auth/sesiones/cerrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ todas: true }),
        })

        if (res.ok) {
          router.push('/login')
          return
        }
      } else if (modalCerrar === 'todas_menos_actual') {
        const res = await fetch('/api/auth/sesiones/cerrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            todas: true,
            excepto_actual: true,
            session_id_actual: idSesionActual,
          }),
        })

        if (res.ok) {
          setDispositivos(prev => prev.filter(d => d.actual))
        }
      }
    } catch { /* silenciar */ } finally {
      setCerrandoSesion(false)
      setModalCerrar(null)
      setDispositivoSeleccionado(null)
    }
  }, [modalCerrar, dispositivoSeleccionado, dispositivos, idSesionActual, router])

  const formatearFechaRelativa = (iso: string) => {
    try {
      const fecha = new Date(iso)
      const ahora = new Date()
      const diffMs = ahora.getTime() - fecha.getTime()
      const diffMin = Math.floor(diffMs / 60000)
      const diffHoras = Math.floor(diffMs / 3600000)
      const diffDias = Math.floor(diffMs / 86400000)

      if (diffMin < 1) return 'Ahora'
      if (diffMin < 60) return `Hace ${diffMin} min`
      if (diffHoras < 24) return `Hace ${diffHoras}h`

      const esHoy = fecha.toDateString() === ahora.toDateString()
      if (esHoy) return `Hoy, ${fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`

      const ayer = new Date(ahora)
      ayer.setDate(ayer.getDate() - 1)
      if (fecha.toDateString() === ayer.toDateString()) {
        return `Ayer, ${fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
      }

      if (diffDias < 7) return `Hace ${diffDias} días`

      return new Intl.DateTimeFormat('es', {
        day: 'numeric', month: 'short', year: fecha.getFullYear() !== ahora.getFullYear() ? 'numeric' : undefined,
      }).format(fecha)
    } catch { return iso }
  }

  const formatearFechaCorta = (iso: string) => {
    try {
      const fecha = new Date(iso)
      const ahora = new Date()
      return new Intl.DateTimeFormat('es', {
        day: 'numeric', month: 'short', year: fecha.getFullYear() !== ahora.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit', minute: '2-digit',
      }).format(fecha)
    } catch { return iso }
  }

  /* Textos del modal según el tipo de cierre */
  const obtenerTextoModal = () => {
    if (modalCerrar === 'individual') {
      const dispositivo = dispositivos.find(d => d.id === dispositivoSeleccionado)
      if (dispositivo?.actual) {
        return {
          titulo: 'Cerrar tu sesión actual',
          descripcion: 'Se cerrará la sesión en este navegador y vas a tener que volver a iniciar sesión.',
          etiqueta: 'Cerrar sesión',
        }
      }
      return {
        titulo: 'Cerrar sesión en dispositivo',
        descripcion: `Se cerrará la sesión en "${dispositivo?.nombre}". Ese dispositivo deberá volver a iniciar sesión.`,
        etiqueta: 'Cerrar sesión',
      }
    }
    if (modalCerrar === 'todas') {
      return {
        titulo: 'Cerrar todas las sesiones',
        descripcion: 'Se cerrarán todas las sesiones, incluyendo la de este navegador. Vas a tener que volver a iniciar sesión.',
        etiqueta: 'Cerrar todas',
      }
    }
    return {
      titulo: 'Cerrar otras sesiones',
      descripcion: 'Se cerrarán todas las sesiones excepto la de este navegador.',
      etiqueta: 'Cerrar otras',
    }
  }

  const textoModal = obtenerTextoModal()
  const sesionesOtras = dispositivos.filter(d => !d.actual).length

  return (
    <div className="space-y-6">
      <EncabezadoSeccion
        titulo="Seguridad"
        descripcion="Gestioná tu contraseña y dispositivos activos."
      />

      {/* Cambiar contraseña */}
      <div>
        <h3 className="text-sm font-semibold text-texto-secundario mb-3">Cambiar contraseña</h3>
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5 space-y-4">
          <Input
            tipo="password"
            etiqueta="Contraseña actual"
            value={contrasenaActual}
            onChange={(e) => setContrasenaActual(e.target.value)}
            icono={<Lock size={16} />}
            placeholder="••••••••"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              tipo="password"
              etiqueta="Nueva contraseña"
              value={contrasenaNueva}
              onChange={(e) => setContrasenaNueva(e.target.value)}
              icono={<Lock size={16} />}
              placeholder="Mínimo 8 caracteres"
            />
            <Input
              tipo="password"
              etiqueta="Confirmar contraseña"
              value={contrasenaConfirmar}
              onChange={(e) => setContrasenaConfirmar(e.target.value)}
              icono={<Lock size={16} />}
              placeholder="Repetir nueva contraseña"
            />
          </div>

          {errorContrasena && (
            <p className="text-sm text-insignia-peligro flex items-center gap-1.5">
              <AlertTriangle size={14} /> {errorContrasena}
            </p>
          )}
          {exitoContrasena && (
            <p className="text-sm text-insignia-exito">Contraseña actualizada correctamente.</p>
          )}

          <Boton
            variante="primario"
            onClick={manejarCambiarContrasena}
            disabled={guardandoContrasena || !contrasenaNueva || !contrasenaConfirmar}
            cargando={guardandoContrasena}
          >
            Actualizar contraseña
          </Boton>
        </div>
      </div>

      {/* Dispositivos activos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-texto-secundario">Dispositivos activos</h3>
            <p className="text-xs text-texto-terciario mt-0.5">
              Máximo 4 dispositivos simultáneos. Al iniciar sesión en un 5°, se cerrará la sesión más antigua.
            </p>
          </div>
        </div>

        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
          {cargandoDispositivos ? (
            <div className="p-5 text-sm text-texto-terciario">Cargando dispositivos...</div>
          ) : dispositivos.length === 0 ? (
            <div className="p-5 text-sm text-texto-terciario">No se encontraron sesiones activas.</div>
          ) : (
            <div className="divide-y divide-borde-sutil">
              {dispositivos.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={`shrink-0 ${d.actual ? 'text-insignia-exito' : 'text-texto-terciario'}`}>
                    {obtenerIconoDispositivo(d.tipo)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-texto-primario flex items-center gap-2">
                      <span className="truncate">{d.nombre}</span>
                      {d.actual && (
                        <span className="text-xxs px-1.5 py-0.5 rounded-full bg-insignia-exito-fondo text-insignia-exito-texto font-medium shrink-0">
                          Este dispositivo
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      <div className="text-xs text-texto-secundario">Última vez: {formatearFechaCorta(d.ultimaActividad)}</div>
                      <div className="text-[11px] text-texto-terciario/70">Primera vez: {formatearFechaCorta(d.creadoEn)}</div>
                    </div>
                  </div>
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    soloIcono
                    icono={<LogOut size={14} />}
                    onClick={() => abrirModalIndividual(d.id)}
                    titulo={d.actual ? 'Cerrar esta sesión' : 'Cerrar sesión en este dispositivo'}
                    className="shrink-0 text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro/10"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botones de cierre masivo */}
        {!cargandoDispositivos && dispositivos.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {sesionesOtras > 0 && (
              <Boton variante="secundario" tamano="sm" onClick={() => setModalCerrar('todas_menos_actual')}>
                Cerrar todas menos esta
              </Boton>
            )}
            <Boton variante="peligro" tamano="sm" onClick={() => setModalCerrar('todas')}>
              Cerrar todas las sesiones
            </Boton>
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      <ModalConfirmacion
        abierto={modalCerrar !== null}
        onCerrar={() => {
          setModalCerrar(null)
          setDispositivoSeleccionado(null)
        }}
        onConfirmar={confirmarCerrarSesion}
        titulo={textoModal.titulo}
        descripcion={textoModal.descripcion}
        tipo={modalCerrar === 'todas_menos_actual' ? 'advertencia' : 'peligro'}
        etiquetaConfirmar={textoModal.etiqueta}
        cargando={cerrandoSesion}
        icono={<LogOut size={24} />}
      />
    </div>
  )
}
