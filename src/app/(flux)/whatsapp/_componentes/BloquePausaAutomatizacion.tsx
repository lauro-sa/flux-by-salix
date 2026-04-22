'use client'

import { useEffect, useState } from 'react'
import { Select } from '@/componentes/ui/Select'
import { PauseCircle } from 'lucide-react'

/**
 * BloquePausaAutomatizacion — Config de pausa del chatbot o agente IA cuando responde un humano.
 *
 * Se usa al final de las secciones Chatbot y Agente IA en la configuración de WhatsApp.
 * Guarda en config_whatsapp los campos pausa_<tipo>_modo y pausa_<tipo>_minutos.
 *
 * Modos:
 *  - 'siempre_activo' → nunca se pausa, responde incluso después de una respuesta humana
 *  - 'manual'         → se apaga hasta que lo reactives desde la conversación
 *  - 'temporal'       → se apaga por N minutos y después se reactiva solo si llega un entrante
 */

type Tipo = 'chatbot' | 'agente_ia'
type Modo = 'siempre_activo' | 'manual' | 'temporal'

interface Props {
  tipo: Tipo
}

const OPCIONES_MODO: { valor: Modo; etiqueta: string; descripcion: string }[] = [
  {
    valor: 'siempre_activo',
    etiqueta: 'Siempre activo',
    descripcion: 'Responde aunque ya haya intervenido un humano en la conversación.',
  },
  {
    valor: 'manual',
    etiqueta: 'Pausar hasta reactivar manualmente',
    descripcion: 'Se apaga apenas respondés vos y queda apagado hasta que lo reactives o cierres la conversación.',
  },
  {
    valor: 'temporal',
    etiqueta: 'Pausar por un tiempo',
    descripcion: 'Se apaga apenas respondés vos y se vuelve a activar solo cuando venza el tiempo configurado.',
  },
]

const OPCIONES_TIEMPO: { valor: string; etiqueta: string }[] = [
  { valor: '30', etiqueta: '30 minutos' },
  { valor: '60', etiqueta: '1 hora' },
  { valor: '240', etiqueta: '4 horas' },
  { valor: '720', etiqueta: '12 horas (recomendado)' },
  { valor: '1440', etiqueta: '24 horas' },
  { valor: '4320', etiqueta: '3 días' },
  { valor: '10080', etiqueta: '7 días' },
]

export function BloquePausaAutomatizacion({ tipo }: Props) {
  const campoModo = tipo === 'chatbot' ? 'pausa_chatbot_modo' : 'pausa_agente_ia_modo'
  const campoMinutos = tipo === 'chatbot' ? 'pausa_chatbot_minutos' : 'pausa_agente_ia_minutos'
  const nombreEntidad = tipo === 'chatbot' ? 'chatbot' : 'agente IA'

  const [modo, setModo] = useState<Modo>('temporal')
  const [minutos, setMinutos] = useState<number>(720)
  const [cargando, setCargando] = useState(true)

  // Cargar config actual
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch('/api/whatsapp/config')
        const data = await res.json()
        if (cancelado) return
        if (data?.config) {
          setModo((data.config[campoModo] as Modo) || 'temporal')
          setMinutos(data.config[campoMinutos] ?? 720)
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    })()
    return () => { cancelado = true }
  }, [campoModo, campoMinutos])

  const guardar = async (cambios: Record<string, unknown>) => {
    await fetch('/api/whatsapp/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    })
  }

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo)
    guardar({ [campoModo]: nuevo })
  }

  const cambiarMinutos = (nuevo: string) => {
    const n = parseInt(nuevo, 10) || 720
    setMinutos(n)
    guardar({ [campoMinutos]: n })
  }

  if (cargando) return null

  return (
    <div className="space-y-3 pt-5 mt-5 border-t border-white/[0.07]">
      <div className="flex items-start gap-2">
        <PauseCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--texto-terciario)' }} />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Pausar cuando yo respondo
          </h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--texto-terciario)' }}>
            Qué debería hacer el {nombreEntidad} si envías un mensaje manual o una plantilla al cliente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select
          etiqueta="Comportamiento"
          valor={modo}
          opciones={OPCIONES_MODO.map(o => ({ valor: o.valor, etiqueta: o.etiqueta, descripcion: o.descripcion }))}
          onChange={(v) => cambiarModo(v as Modo)}
        />
        {modo === 'temporal' && (
          <Select
            etiqueta="Pausar por"
            valor={String(minutos)}
            opciones={OPCIONES_TIEMPO}
            onChange={cambiarMinutos}
          />
        )}
      </div>
    </div>
  )
}
