/**
 * Página de setup del kiosco.
 * Se accede via QR o URL: /kiosco/setup?token=xxx&empresa=xxx&terminal=xxx
 * Valida el token, registra el terminal, y redirige al kiosco.
 */
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { DELAY_CARGA } from '@/lib/constantes/timeouts'

type EstadoSetup = 'validando' | 'exito' | 'error'

export default function PaginaSetupKiosco() {
  const params = useSearchParams()
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoSetup>('validando')
  const [mensaje, setMensaje] = useState('Activando terminal...')

  useEffect(() => {
    const token = params.get('token')
    const empresaId = params.get('empresa')
    const terminalId = params.get('terminal')

    if (!token || !empresaId || !terminalId) {
      setEstado('error')
      setMensaje('URL de activación inválida. Generá un nuevo código desde Flux.')
      return
    }

    activarTerminal(token, empresaId, terminalId)
  }, [params])

  async function activarTerminal(token: string, empresaId: string, terminalId: string) {
    try {
      const res = await fetch('/api/kiosco/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, empresaId, terminalId }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Error desconocido' }))
        setEstado('error')
        setMensaje(error.error || 'No se pudo activar el terminal')
        return
      }

      const datos = await res.json()

      // Guardar configuración en localStorage
      localStorage.setItem('kiosco_config', JSON.stringify({
        token: datos.token,
        terminal: datos.terminal,
        empresa: datos.empresa,
        config: datos.config,
      }))

      setEstado('exito')
      setMensaje(`Terminal "${datos.terminal.nombre}" activada correctamente`)

      // Redirigir al kiosco en 2 segundos
      setTimeout(() => router.push('/kiosco'), DELAY_CARGA)
    } catch {
      setEstado('error')
      setMensaje('Error de conexión. Verificá la red e intentá de nuevo.')
    }
  }

  return (
    <div
      className="h-dvh flex flex-col items-center justify-center gap-8 px-8"
      style={{ backgroundColor: 'var(--superficie-app)' }}
    >
      <motion.div
        className="flex flex-col items-center gap-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Ícono de estado */}
        {estado === 'validando' && (
          <div
            className="w-16 h-16 rounded-full border-4 animate-spin"
            style={{
              borderColor: 'var(--borde-sutil)',
              borderTopColor: 'var(--texto-marca)',
            }}
          />
        )}

        {estado === 'exito' && (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--insignia-exito)', opacity: 0.9 }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {estado === 'error' && (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--insignia-peligro)', opacity: 0.9 }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        )}

        {/* Mensaje */}
        <h1
          className="text-2xl font-semibold"
          style={{ color: 'var(--texto-primario)' }}
        >
          {estado === 'validando' ? 'Configurando kiosco' : estado === 'exito' ? 'Kiosco activado' : 'Error de activación'}
        </h1>
        <p
          className="text-lg max-w-md"
          style={{ color: 'var(--texto-secundario)' }}
        >
          {mensaje}
        </p>

        {/* Retry en error */}
        {estado === 'error' && (
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-3 rounded-card text-base font-medium transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--texto-marca)',
              color: '#fff',
            }}
          >
            Reintentar
          </button>
        )}
      </motion.div>

      <p
        className="text-sm absolute bottom-8"
        style={{ color: 'var(--texto-terciario)' }}
      >
        Flux by Salix — Setup de terminal
      </p>
    </div>
  )
}
