/**
 * Página principal del kiosco de fichaje.
 * Prioridad de config: cookie > localStorage.
 * Si no hay ninguna, muestra pantalla de reactivación por PIN.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import TerminalFichaje from '@/componentes/kiosco/TerminalFichaje'

interface ConfigAlmacenada {
  token: string
  terminal: { id: string; nombre: string }
  empresa: { id: string; nombre: string; logoUrl: string | null }
  config: {
    metodoLectura: 'rfid_hid' | 'nfc'
    capturarFoto: boolean
    modoEmpresa: 'logo_y_nombre' | 'solo_logo' | 'solo_nombre'
  }
}

function leerCookieConfig(): Omit<ConfigAlmacenada, 'token'> | null {
  try {
    const cookies = document.cookie.split(';').map(c => c.trim())
    const configCookie = cookies.find(c => c.startsWith('kiosco_config='))
    if (!configCookie) return null
    const valor = decodeURIComponent(configCookie.split('=').slice(1).join('='))
    return JSON.parse(valor)
  } catch {
    return null
  }
}

export default function PaginaKiosco() {
  const [configKiosco, setConfigKiosco] = useState<ConfigAlmacenada | null>(null)
  const [cargando, setCargando] = useState(true)
  const [modoReactivar, setModoReactivar] = useState(false)

  useEffect(() => {
    // 1. Intentar localStorage
    const almacenado = localStorage.getItem('kiosco_config')
    if (almacenado) {
      try {
        setConfigKiosco(JSON.parse(almacenado))
        setCargando(false)
        return
      } catch {
        localStorage.removeItem('kiosco_config')
      }
    }

    // 2. Intentar cookie (más persistente)
    const desdeCookie = leerCookieConfig()
    if (desdeCookie) {
      // El token está en HttpOnly cookie, las APIs lo leen automáticamente
      // Usamos 'cookie' como placeholder — el middleware lo leerá del header
      setConfigKiosco({ ...desdeCookie, token: '__cookie__' })
      // Respaldar en localStorage
      localStorage.setItem('kiosco_config', JSON.stringify({ ...desdeCookie, token: '__cookie__' }))
      setCargando(false)
      return
    }

    setCargando(false)
  }, [])

  // Reactivar por PIN
  const reactivar = useCallback(async (nombre: string, pin: string) => {
    try {
      const res = await fetch('/api/kiosco/reactivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminalNombre: nombre, pinAdmin: pin }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Error' }))
        return error.error || 'Error al reactivar'
      }

      const datos = await res.json()
      const config: ConfigAlmacenada = {
        token: datos.token,
        terminal: datos.terminal,
        empresa: datos.empresa,
        config: datos.config,
      }
      localStorage.setItem('kiosco_config', JSON.stringify(config))
      setConfigKiosco(config)
      setModoReactivar(false)
      return null // sin error
    } catch {
      return 'Error de conexión'
    }
  }, [])

  if (cargando) {
    return (
      <div className="h-dvh flex items-center justify-center bg-black">
        <div
          className="w-10 h-10 rounded-full border-4 animate-spin"
          style={{ borderColor: 'var(--borde-fuerte)', borderTopColor: 'var(--texto-marca)' }}
        />
      </div>
    )
  }

  if (!configKiosco) {
    if (modoReactivar) {
      return <PantallaReactivar onReactivar={reactivar} onCancelar={() => setModoReactivar(false)} />
    }

    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-6 px-8 bg-black">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-semibold text-white">
            Kiosco no configurado
          </h1>
          <p className="text-lg max-w-md text-neutral-400">
            Este terminal necesita ser configurado desde Flux.
            Pedile a un administrador que genere un código de activación.
          </p>
        </div>

        <button
          onClick={() => setModoReactivar(true)}
          className="mt-4 px-6 py-3 rounded-xl text-base font-medium transition-all active:scale-95 bg-neutral-800 text-neutral-300 border border-neutral-700"
        >
          Reactivar con PIN
        </button>

        <p className="text-sm text-neutral-600 absolute bottom-8">
          Flux by Salix — Terminal de fichaje
        </p>
      </div>
    )
  }

  return (
    <TerminalFichaje
      config={{
        terminalId: configKiosco.terminal.id,
        terminalNombre: configKiosco.terminal.nombre,
        empresaId: configKiosco.empresa.id,
        nombreEmpresa: configKiosco.empresa.nombre,
        logoUrl: configKiosco.empresa.logoUrl,
        modoEmpresa: configKiosco.config.modoEmpresa,
        metodoLectura: configKiosco.config.metodoLectura,
        capturarFoto: configKiosco.config.capturarFoto,
        tokenJWT: configKiosco.token,
      }}
    />
  )
}

// Pantalla de reactivación por nombre de terminal + PIN admin
function PantallaReactivar({
  onReactivar,
  onCancelar,
}: {
  onReactivar: (nombre: string, pin: string) => Promise<string | null>
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const manejarEnvio = async () => {
    if (!nombre.trim() || pin.length < 6) return
    setEnviando(true)
    setError('')
    const resultado = await onReactivar(nombre.trim(), pin)
    if (resultado) setError(resultado)
    setEnviando(false)
  }

  return (
    <motion.div
      className="h-dvh flex flex-col items-center justify-center gap-8 px-8 bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-white">Reactivar terminal</h1>
        <p className="text-base text-neutral-400">
          Ingresá el nombre del terminal y el PIN de administrador
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <input
          type="text"
          placeholder="Nombre del terminal (ej: Entrada Principal)"
          aria-label="Nombre del terminal"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full px-4 py-3.5 rounded-xl text-base bg-neutral-900 text-white border border-neutral-700 placeholder-neutral-500 outline-none focus:border-neutral-500"
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="PIN admin (6 dígitos)"
          aria-label="Código PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full px-4 py-3.5 rounded-xl text-base bg-neutral-900 text-white border border-neutral-700 placeholder-neutral-500 outline-none focus:border-neutral-500 tracking-[0.5em] text-center"
        />

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        <div className="flex gap-3 mt-2">
          <button
            onClick={onCancelar}
            className="flex-1 py-3.5 rounded-xl text-base font-medium bg-neutral-800 text-neutral-400 border border-neutral-700 active:scale-[0.98] transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={manejarEnvio}
            disabled={!nombre.trim() || pin.length < 6 || enviando}
            className="flex-1 py-3.5 rounded-xl text-base font-medium text-white active:scale-[0.98] transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--texto-marca)' }}
          >
            {enviando ? 'Activando...' : 'Activar'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
