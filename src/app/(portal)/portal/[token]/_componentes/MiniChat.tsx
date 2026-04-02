'use client'

/**
 * MiniChat — Chat bidireccional cliente-vendedor en el portal.
 * Muestra mensajes previos y permite enviar nuevos.
 * Se usa en: VistaPortal (post-aceptación o siempre visible)
 */

import { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle, Loader2 } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'
import { TextArea } from '@/componentes/ui/TextArea'
import type { MensajePortal } from '@/tipos/portal'

interface Props {
  mensajes: MensajePortal[]
  nombreCliente: string
  colorMarca: string
  token: string
  onMensajeEnviado: (mensaje: MensajePortal) => void
}

function fechaCorta(fecha: string): string {
  const d = new Date(fecha)
  const ahora = new Date()
  const hoy = ahora.toDateString() === d.toDateString()
  if (hoy) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function MiniChat({ mensajes, nombreCliente, colorMarca, token, onMensajeEnviado }: Props) {
  const { t } = useTraduccion()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [abierto, setAbierto] = useState(mensajes.length > 0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  const enviar = async () => {
    const contenido = texto.trim()
    if (!contenido || enviando) return

    setEnviando(true)
    try {
      const res = await fetch(`/api/portal/${token}/acciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'mensaje',
          contenido,
          autor_nombre: nombreCliente || 'Cliente',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.mensaje) {
          onMensajeEnviado(data.mensaje)
          setTexto('')
        }
      }
    } catch { /* silencioso */ }
    setEnviando(false)
  }

  return (
    <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">
      {/* Header colapsable */}
      <Boton
        variante="fantasma"
        onClick={() => setAbierto(!abierto)}
        className="w-full px-5 py-3.5 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={16} style={{ color: colorMarca }} />
          <span className="text-sm font-semibold text-texto-primario">
            {t('portal.chat_titulo') || 'Mensajes'}
          </span>
          {mensajes.length > 0 && (
            <span className="text-xxs px-1.5 py-0.5 rounded-full font-medium" style={{
              backgroundColor: `${colorMarca}15`,
              color: colorMarca,
            }}>
              {mensajes.length}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-texto-terciario transition-transform ${abierto ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Boton>

      {abierto && (
        <>
          {/* Mensajes */}
          <div ref={scrollRef} className="max-h-[300px] overflow-y-auto px-4 py-3 space-y-3 border-t border-borde-sutil">
            {mensajes.length === 0 && (
              <p className="text-center text-xs text-texto-terciario py-4">
                {t('portal.chat_vacio') || 'Enviá un mensaje si tenés alguna consulta.'}
              </p>
            )}
            {mensajes.map(msg => {
              const esCliente = msg.autor === 'cliente'
              return (
                <div key={msg.id} className={`flex ${esCliente ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                    esCliente
                      ? 'rounded-br-md text-white'
                      : 'rounded-bl-md bg-superficie-app text-texto-primario'
                  }`}
                    style={esCliente ? { backgroundColor: colorMarca } : undefined}
                  >
                    {!esCliente && (
                      <span className="text-xxs font-semibold text-texto-terciario block mb-0.5">
                        {msg.autor_nombre}
                      </span>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.contenido}</p>
                    <span className={`text-xxs block mt-0.5 ${esCliente ? 'text-white/60' : 'text-texto-terciario'}`}>
                      {fechaCorta(msg.creado_en)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-borde-sutil">
            <div className="flex gap-2 items-end">
              <TextArea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                enviarConEnter
                onEnviar={enviar}
                placeholder={t('portal.chat_placeholder') || 'Escribí tu consulta...'}
                rows={1}
              />
              <Boton
                variante="fantasma"
                tamano="sm"
                soloIcono
                titulo="Enviar"
                redondeado
                icono={enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                onClick={enviar}
                disabled={!texto.trim() || enviando}
                className="shrink-0 text-white"
                style={{ backgroundColor: colorMarca }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
