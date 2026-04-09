'use client'

import { useState } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { TextArea } from '@/componentes/ui/TextArea'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'

/**
 * Convierte formato WhatsApp (*negrita*, _cursiva_, ~tachado~) a HTML para preview.
 * Se usa en EditorWhatsApp, ModalRespuestaRapida y SeccionChatbot.
 */
export function formatoWhatsAppAHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/```([^`]+)```/g, '<code>$1</code>')
    .replace(/\n/g, '<br />')
}

/**
 * Editor de texto WhatsApp con preview — reutilizable en respuestas rápidas, chatbot, etc.
 * Muestra un click-to-edit compacto que abre un modal con textarea + preview lado a lado.
 */
export function EditorWhatsApp({
  valor,
  onChange,
  placeholder,
  alturaMinima = 120,
  titulo,
}: {
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  alturaMinima?: number
  titulo?: string
}) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const [modalAbierto, setModalAbierto] = useState(false)

  return (
    <>
      {/* Vista compacta — click para abrir modal */}
      <div
        className="rounded-lg p-2.5 cursor-pointer transition-colors group"
        style={{ background: 'var(--superficie-app)', border: '1px solid var(--borde-sutil)' }}
        onClick={() => setModalAbierto(true)}
      >
        {valor ? (
          <div
            className="text-sm line-clamp-3"
            style={{ color: 'var(--texto-primario)' }}
            dangerouslySetInnerHTML={{ __html: formatoWhatsAppAHtml(valor) }}
          />
        ) : (
          <p className="text-sm" style={{ color: 'var(--texto-terciario)' }}>
            {placeholder || 'Tocá para editar...'}
          </p>
        )}
        <p className="text-xxs mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--texto-terciario)' }}>
          Tocá para editar con preview
        </p>
      </div>

      {/* Modal con textarea + preview lado a lado */}
      {modalAbierto && (
        <Modal
          abierto={true}
          onCerrar={() => setModalAbierto(false)}
          titulo={titulo || 'Editar mensaje'}
          tamano="3xl"
          acciones={
            <Boton variante="primario" tamano="sm" onClick={() => setModalAbierto(false)}>
              {t('comun.listo')}
            </Boton>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-terciario)' }}>
                Mensaje (formato WhatsApp)
              </label>
              <TextArea
                value={valor}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || 'Escribí tu mensaje...'}
                style={{ minHeight: alturaMinima }}
                autoFocus
                spellCheck={false}
              />
              <div
                className="flex items-center gap-4 mt-2 px-2 py-1.5 rounded text-xxs"
                style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}
              >
                <span><strong>*negrita*</strong></span>
                <span><em>_cursiva_</em></span>
                <span><del>~tachado~</del></span>
              </div>
            </div>
            <div>
              <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-terciario)' }}>
                Así lo ve el cliente
              </label>
              {/* Simulación de chat WhatsApp */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: '#0b141a',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'0.8\' fill=\'%23ffffff08\'/%3E%3C/svg%3E")',
                  minHeight: alturaMinima + 40,
                  border: '1px solid #1f2c34',
                }}
              >
                {/* Header WhatsApp */}
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: '#1f2c34' }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#2a3942' }}>
                    <span className="text-xs" style={{ color: '#8696a0' }}>Tu</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#e9edef' }}>Tu empresa</p>
                    <p className="text-xxs" style={{ color: '#8696a0' }}>en línea</p>
                  </div>
                </div>

                {/* Área de chat */}
                <div className="px-4 py-3 flex justify-end" style={{ minHeight: alturaMinima - 20 }}>
                  {valor ? (
                    <div
                      className="relative max-w-[85%] rounded-lg px-3 py-1.5"
                      style={{
                        background: '#005c4b',
                        borderTopRightRadius: '4px',
                      }}
                    >
                      <div
                        className="text-sm leading-relaxed whitespace-pre-wrap"
                        style={{ color: '#e9edef' }}
                        dangerouslySetInnerHTML={{ __html: formatoWhatsAppAHtml(valor) }}
                      />
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className="text-xxs" style={{ color: '#ffffff99' }}>
                          {new Date().toLocaleTimeString(formato.locale, { hour: '2-digit', minute: '2-digit', hour12: formato.formatoHora === '12h' })}
                        </span>
                        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                          <path d="M11.071 0.929L4.5 7.5L1.429 4.429" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14.071 0.929L7.5 7.5L6.5 6.5" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs self-center" style={{ color: '#8696a0' }}>
                      Escribí un mensaje para ver la preview...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
