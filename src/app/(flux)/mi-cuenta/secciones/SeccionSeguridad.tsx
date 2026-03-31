'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, Smartphone, Monitor, Tablet, Globe, Trash2, AlertTriangle } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { crearClienteNavegador } from '@/lib/supabase/cliente'

/**
 * SeccionSeguridad — cambiar contraseña y dispositivos activos.
 * Máximo 4 dispositivos activos simultáneos.
 */

interface Dispositivo {
  id: string
  nombre: string
  tipo: 'desktop' | 'mobile' | 'tablet' | 'desconocido'
  navegador: string
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

export function SeccionSeguridad() {
  const { restablecerContrasena } = useAuth()

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
          const mapeados: Dispositivo[] = (sesiones as Array<{ id: string; user_agent?: string; updated_at?: string; current?: boolean }>).map((s) => {
            const info = parsearUserAgent(s.user_agent || '')
            return {
              id: s.id,
              nombre: info.nombre,
              tipo: info.tipo,
              navegador: info.navegador,
              ultimaActividad: s.updated_at || new Date().toISOString(),
              actual: s.current || false,
            }
          })
          setDispositivos(mapeados)
        } else {
          const info = parsearUserAgent(navigator.userAgent)
          setDispositivos([{
            id: 'actual',
            nombre: info.nombre,
            tipo: info.tipo,
            navegador: info.navegador,
            ultimaActividad: new Date().toISOString(),
            actual: true,
          }])
        }
      } catch {
        const info = parsearUserAgent(navigator.userAgent)
        setDispositivos([{
          id: 'actual',
          nombre: info.nombre,
          tipo: info.tipo,
          navegador: info.navegador,
          ultimaActividad: new Date().toISOString(),
          actual: true,
        }])
      } finally {
        setCargandoDispositivos(false)
      }
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

  /* Cerrar sesión en otro dispositivo */
  const cerrarSesionDispositivo = useCallback(async (dispositivoId: string) => {
    try {
      const res = await fetch('/api/auth/sesiones/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: dispositivoId }),
      })
      if (res.ok) {
        setDispositivos(prev => prev.filter(d => d.id !== dispositivoId))
      }
    } catch { /* silenciar */ }
  }, [])

  const formatearFecha = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('es', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso))
    } catch { return iso }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-texto-primario mb-1">Seguridad</h2>
        <p className="text-sm text-texto-terciario">Gestioná tu contraseña y dispositivos activos.</p>
      </div>

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

          <button
            type="button"
            onClick={manejarCambiarContrasena}
            disabled={guardandoContrasena || !contrasenaNueva || !contrasenaConfirmar}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-texto-marca text-white border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardandoContrasena ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </div>

      {/* Dispositivos activos */}
      <div>
        <h3 className="text-sm font-semibold text-texto-secundario mb-3">Dispositivos activos</h3>
        <p className="text-xs text-texto-terciario mb-3">
          Máximo 4 dispositivos simultáneos. Al iniciar sesión en un 5° dispositivo, se cerrará automáticamente la sesión más antigua.
        </p>
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
                    <div className="text-xs text-texto-terciario mt-0.5">
                      Última actividad: {formatearFecha(d.ultimaActividad)}
                    </div>
                  </div>
                  {!d.actual && (
                    <button
                      type="button"
                      onClick={() => cerrarSesionDispositivo(d.id)}
                      className="shrink-0 p-1.5 rounded-lg text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro-fondo transition-colors bg-transparent border-none cursor-pointer"
                      title="Cerrar sesión en este dispositivo"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
