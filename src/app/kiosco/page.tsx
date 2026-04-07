/**
 * Página principal del kiosco de fichaje.
 * Lee la configuración de localStorage (guardada en /setup)
 * y renderiza el TerminalFichaje.
 */
'use client'

import { useState, useEffect } from 'react'
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

export default function PaginaKiosco() {
  const [configKiosco, setConfigKiosco] = useState<ConfigAlmacenada | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const almacenado = localStorage.getItem('kiosco_config')
    if (almacenado) {
      try {
        setConfigKiosco(JSON.parse(almacenado))
      } catch {
        localStorage.removeItem('kiosco_config')
      }
    }
    setCargando(false)
  }, [])

  if (cargando) {
    return (
      <div
        className="h-dvh flex items-center justify-center"
        style={{ backgroundColor: 'var(--superficie-app)' }}
      >
        <div
          className="w-10 h-10 rounded-full border-4 animate-spin"
          style={{
            borderColor: 'var(--borde-sutil)',
            borderTopColor: 'var(--texto-marca)',
          }}
        />
      </div>
    )
  }

  // Si no hay config → redirigir a setup
  if (!configKiosco) {
    return (
      <div
        className="h-dvh flex flex-col items-center justify-center gap-6 px-8"
        style={{ backgroundColor: 'var(--superficie-app)' }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <h1
            className="text-3xl font-semibold"
            style={{ color: 'var(--texto-primario)' }}
          >
            Kiosco no configurado
          </h1>
          <p
            className="text-lg max-w-md"
            style={{ color: 'var(--texto-secundario)' }}
          >
            Este terminal necesita ser configurado desde Flux.
            Pedile a un administrador que genere un código de activación.
          </p>
        </div>
        <p
          className="text-sm"
          style={{ color: 'var(--texto-terciario)' }}
        >
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
