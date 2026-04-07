'use client'

/**
 * ModalWhatsAppChatter — Modal para enviar WhatsApp desde el chatter de un documento.
 * Carga plantillas aprobadas, muestra preview estilo teléfono con variables resueltas
 * usando datos reales del contacto y documento. Envía via API dedicada.
 * Se usa en: PanelChatter (botón WhatsApp de la barra de acciones).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Send, Loader2, AlertCircle, CheckCircle2, ChevronDown,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { PlantillaWhatsApp, ComponentesPlantillaWA } from '@/tipos/inbox'
import type { ContactoChatter, DatosDocumentoChatter } from './tipos'
import { formatearTextoWA } from './constantes'

interface PropsModalWhatsApp {
  abierto: boolean
  onCerrar: () => void
  contacto?: ContactoChatter
  entidadTipo: string
  entidadId: string
  tipoDocumento?: string
  datosDocumento?: DatosDocumentoChatter
  onEnviado: () => void
}

export function ModalWhatsAppChatter({
  abierto,
  onCerrar,
  contacto,
  entidadTipo,
  entidadId,
  tipoDocumento,
  datosDocumento,
  onEnviado,
}: PropsModalWhatsApp) {
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([])
  const [cargandoPlantillas, setCargandoPlantillas] = useState(false)
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaWhatsApp | null>(null)
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const selectorRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [posDropdown, setPosDropdown] = useState({ top: 0, left: 0, width: 0 })

  const numero = contacto?.whatsapp || contacto?.telefono || ''

  // Datos para resolución de variables (mismo formato que el editor de plantillas)
  const datosPreview = useMemo<Record<string, string>>(() => ({
    contacto_nombre: contacto?.nombre || 'Cliente',
    contacto_telefono: contacto?.telefono || contacto?.whatsapp || '',
    contacto_correo: contacto?.correo || '',
    documento_numero: datosDocumento?.numero || '',
    documento_total: datosDocumento?.total || '',
    documento_fecha: datosDocumento?.fecha || '',
    empresa_nombre: datosDocumento?.empresaNombre || '',
  }), [contacto, datosDocumento])

  // Cargar plantillas
  const cargarPlantillas = useCallback(async () => {
    setCargandoPlantillas(true)
    try {
      const res = await fetch('/api/inbox/whatsapp/plantillas')
      if (res.ok) {
        const data = await res.json()
        const aprobadas = (data.plantillas || []).filter(
          (p: PlantillaWhatsApp) => p.estado_meta === 'APPROVED' && p.activo
        )
        setPlantillas(aprobadas)
      }
    } catch { /* silencioso */ }
    setCargandoPlantillas(false)
  }, [])

  useEffect(() => {
    if (abierto) {
      cargarPlantillas()
      setPlantillaSeleccionada(null)
      setSelectorAbierto(false)
      setEnviado(false)
      setError('')
    }
  }, [abierto, cargarPlantillas])

  // Posición del dropdown
  useEffect(() => {
    if (selectorAbierto && selectorRef.current) {
      const rect = selectorRef.current.getBoundingClientRect()
      setPosDropdown({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }, [selectorAbierto])

  // Cerrar dropdown al clic fuera (ignorar clics dentro del dropdown portal)
  useEffect(() => {
    if (!selectorAbierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        selectorRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return
      setSelectorAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selectorAbierto])

  // Resolver texto de la plantilla con datos reales
  const resolverTexto = useCallback((texto: string, componentes?: ComponentesPlantillaWA['cuerpo']): string => {
    const mapeo = componentes?.mapeo_variables || []
    const ejemplos = componentes?.ejemplos || []

    return texto.replace(/\{\{(\d+)\}\}/g, (match, n) => {
      const idx = parseInt(n) - 1

      // 1. Mapeo explícito → dato real
      if (mapeo[idx] && datosPreview[mapeo[idx]]) {
        return datosPreview[mapeo[idx]]
      }

      // 2. Heurística por contexto del texto
      const antes = texto.substring(0, texto.indexOf(`{{${n}}}`)).toLowerCase()
      if (idx === 0 && (antes.includes('hola') || antes.includes('estimad') || antes.includes('querido') || antes.includes('buenos'))) {
        return datosPreview.contacto_nombre
      }
      if (antes.includes('referencia') || antes.includes('número') || antes.includes('#') || antes.includes('pedido') || antes.includes('presupuesto')) {
        return datosPreview.documento_numero || match
      }
      if (antes.includes('total') || antes.includes('monto') || antes.includes('importe')) {
        return datosPreview.documento_total || match
      }

      // 3. Fallback a ejemplo
      return ejemplos[idx] || match
    })
  }, [datosPreview])

  // Preview del cuerpo
  const cuerpoHtml = useMemo(() => {
    if (!plantillaSeleccionada?.componentes?.cuerpo?.texto) return ''
    const resuelto = resolverTexto(
      plantillaSeleccionada.componentes.cuerpo.texto,
      plantillaSeleccionada.componentes.cuerpo,
    )
    return formatearTextoWA(resuelto)
  }, [plantillaSeleccionada, resolverTexto])

  // Preview del encabezado
  const encabezadoHtml = useMemo(() => {
    const enc = plantillaSeleccionada?.componentes?.encabezado
    if (!enc?.texto) return ''
    const resuelto = enc.texto.replace(/\{\{1\}\}/g, datosPreview.contacto_nombre)
    return formatearTextoWA(resuelto)
  }, [plantillaSeleccionada, datosPreview])

  // Texto plano para registrar en chatter
  const textoPlanoPreview = useMemo(() => {
    if (!plantillaSeleccionada?.componentes?.cuerpo?.texto) return ''
    return resolverTexto(
      plantillaSeleccionada.componentes.cuerpo.texto,
      plantillaSeleccionada.componentes.cuerpo,
    )
  }, [plantillaSeleccionada, resolverTexto])

  // Componentes resueltos para Meta API (body + buttons)
  const componentesResueltos = useMemo(() => {
    if (!plantillaSeleccionada?.componentes) return undefined

    const componentes: Record<string, unknown>[] = []

    // Body parameters
    const cuerpo = plantillaSeleccionada.componentes.cuerpo
    if (cuerpo?.texto) {
      const variablesMatch = cuerpo.texto.match(/\{\{\d+\}\}/g)
      if (variablesMatch?.length) {
        const mapeo = cuerpo.mapeo_variables || []
        const ejemplos = cuerpo.ejemplos || []

        const parametros = variablesMatch.map((_, idx) => {
          if (mapeo[idx] && datosPreview[mapeo[idx]]) return { type: 'text', text: datosPreview[mapeo[idx]] }

          const antes = cuerpo.texto.substring(0, cuerpo.texto.indexOf(`{{${idx + 1}}}`)).toLowerCase()
          if (idx === 0 && (antes.includes('hola') || antes.includes('estimad'))) {
            return { type: 'text', text: datosPreview.contacto_nombre }
          }
          if (antes.includes('referencia') || antes.includes('número') || antes.includes('#')) {
            return { type: 'text', text: datosPreview.documento_numero || ejemplos[idx] || '—' }
          }

          return { type: 'text', text: ejemplos[idx] || datosPreview.contacto_nombre || '—' }
        })

        componentes.push({ type: 'body', parameters: parametros })
      }
    }

    // Button parameters (botones URL con {{1}} necesitan su parámetro)
    const botones = plantillaSeleccionada.componentes.botones
    if (botones?.length) {
      botones.forEach((btn, idx) => {
        if (btn.tipo === 'URL' && btn.url?.includes('{{')) {
          // El parámetro del botón URL es la parte dinámica de la URL
          // Típicamente es el token del portal o un ID
          const urlPortal = datosDocumento?.urlPortal || ''
          // Extraer solo la parte dinámica (lo que reemplaza {{1}})
          // Si la URL de la plantilla es "https://ejemplo.com/portal/{{1}}",
          // el parámetro es el valor que reemplaza {{1}}
          let valorParametro = urlPortal
          if (urlPortal && btn.url) {
            // Si tenemos URL completa del portal, extraer el token/path final
            const partesFija = btn.url.split('{{')[0]
            if (urlPortal.startsWith('http')) {
              // Usar la URL completa del portal como parámetro
              // Meta espera solo la parte variable, no la URL completa
              try {
                const urlObj = new URL(urlPortal)
                valorParametro = urlObj.pathname.split('/').pop() || urlPortal
              } catch {
                valorParametro = urlPortal
              }
            }
          }

          componentes.push({
            type: 'button',
            sub_type: 'url',
            index: String(idx),
            parameters: [{ type: 'text', text: valorParametro || 'portal' }],
          })
        }
      })
    }

    return componentes.length > 0 ? componentes : undefined
  }, [plantillaSeleccionada, datosPreview, datosDocumento])

  // Enviar
  const enviar = async () => {
    if (!plantillaSeleccionada || !numero || enviando) return
    setEnviando(true)
    setError('')

    try {
      const res = await fetch('/api/chatter/enviar-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: numero,
          contacto_id: contacto?.id,
          contacto_nombre: contacto?.nombre,
          entidad_tipo: entidadTipo,
          entidad_id: entidadId,
          plantilla_id: plantillaSeleccionada.id,
          plantilla_nombre_api: plantillaSeleccionada.nombre_api,
          plantilla_idioma: plantillaSeleccionada.idioma,
          plantilla_componentes: componentesResueltos,
          plantilla_texto_preview: textoPlanoPreview,
          plantilla_botones: (plantillaSeleccionada.componentes?.botones || []).map(btn => {
            if (btn.tipo === 'URL' && btn.url?.includes('{{')) {
              // Resolver la URL del botón con el token del portal
              const urlPortal = datosDocumento?.urlPortal || ''
              let urlResuelta = btn.url
              if (urlPortal) {
                try {
                  const token = new URL(urlPortal).pathname.split('/').pop() || ''
                  urlResuelta = btn.url.replace(/\{\{1\}\}/, token)
                } catch {
                  urlResuelta = btn.url.replace(/\{\{1\}\}/, urlPortal)
                }
              }
              return { ...btn, url: urlResuelta }
            }
            return btn
          }),
        }),
      })

      if (res.ok) {
        setEnviado(true)
        onEnviado()
        setTimeout(() => onCerrar(), 1500)
      } else {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        console.error('WhatsApp chatter error:', data)
        setError(data.error || `Error ${res.status}`)
      }
    } catch (err) {
      console.error('WhatsApp chatter catch:', err)
      setError('Error de conexión')
    }
    setEnviando(false)
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Enviar WhatsApp"
      tamano="xl"
      acciones={
        numero && plantillas.length > 0 && !enviado ? (
          <>
            <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
            <Boton
              variante="primario"
              tamano="sm"
              icono={<Send size={14} />}
              onClick={enviar}
              disabled={!plantillaSeleccionada || enviando}
              cargando={enviando}
            >
              Enviar WhatsApp
            </Boton>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Info del contacto */}
        <div className="flex items-center gap-3 p-3 bg-canal-whatsapp/5 border border-canal-whatsapp/20 rounded-lg">
          <div className="flex items-center justify-center size-9 rounded-full bg-canal-whatsapp/10 text-canal-whatsapp shrink-0">
            <IconoWhatsApp size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-texto-primario">
              {contacto?.nombre || 'Contacto'}
            </p>
            <p className="text-xs text-texto-terciario">{numero || 'Sin número'}</p>
          </div>
          {tipoDocumento && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-superficie-hover text-texto-terciario shrink-0">
              {tipoDocumento}
            </span>
          )}
        </div>

        {/* Sin número */}
        {!numero && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle size={24} className="text-insignia-advertencia" />
            <p className="text-sm text-texto-secundario">
              Este contacto no tiene número de WhatsApp registrado.
            </p>
          </div>
        )}

        {/* Cargando */}
        {numero && cargandoPlantillas && (
          <div className="flex items-center justify-center gap-2 py-8 text-texto-terciario">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Cargando plantillas...</span>
          </div>
        )}

        {/* Sin plantillas */}
        {numero && !cargandoPlantillas && plantillas.length === 0 && !enviado && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle size={24} className="text-insignia-advertencia" />
            <p className="text-sm text-texto-secundario">No hay plantillas de WhatsApp aprobadas.</p>
            <p className="text-xs text-texto-terciario">Creá plantillas desde Inbox → Configuración.</p>
          </div>
        )}

        {/* Selector + preview */}
        {numero && !cargandoPlantillas && plantillas.length > 0 && !enviado && (
          <>
            {/* Selector con portal */}
            <div>
              <label className="text-xs font-medium text-texto-secundario mb-1.5 block">Plantilla</label>
              <button
                ref={selectorRef}
                onClick={() => setSelectorAbierto(!selectorAbierto)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 border rounded-lg bg-superficie-app text-left transition-colors ${
                  selectorAbierto ? 'border-texto-marca ring-2 ring-texto-marca/20' : 'border-borde-sutil hover:border-texto-marca/40'
                }`}
              >
                <IconoWhatsApp size={14} className="text-canal-whatsapp shrink-0" />
                <span className={`flex-1 text-sm truncate ${plantillaSeleccionada ? 'text-texto-primario' : 'text-texto-terciario'}`}>
                  {plantillaSeleccionada?.nombre || 'Seleccioná una plantilla'}
                </span>
                <ChevronDown size={14} className={`text-texto-terciario transition-transform ${selectorAbierto ? 'rotate-180' : ''}`} />
              </button>

              {typeof window !== 'undefined' && selectorAbierto && createPortal(
                <div
                  ref={dropdownRef}
                  className="fixed z-[9999]"
                  style={{ top: posDropdown.top, left: posDropdown.left, width: posDropdown.width }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="bg-superficie-elevada border border-borde-sutil rounded-lg shadow-xl max-h-[280px] overflow-y-auto"
                  >
                    {plantillas.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setPlantillaSeleccionada(p); setSelectorAbierto(false) }}
                        className={`w-full flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-superficie-hover transition-colors border-b border-borde-sutil last:border-0 ${
                          plantillaSeleccionada?.id === p.id ? 'bg-texto-marca/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconoWhatsApp size={13} className="text-canal-whatsapp shrink-0" />
                          <span className="text-sm font-medium text-texto-primario">{p.nombre}</span>
                        </div>
                        <span className="text-[11px] text-texto-terciario truncate pl-[21px]">
                          {p.componentes?.cuerpo?.texto?.slice(0, 90)}{(p.componentes?.cuerpo?.texto?.length || 0) > 90 ? '...' : ''}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 pl-[21px]">
                          <span className="text-[9px] px-1.5 py-px rounded bg-canal-whatsapp/10 text-canal-whatsapp font-medium uppercase">
                            {p.categoria}
                          </span>
                          <span className="text-[9px] text-texto-terciario">{p.idioma}</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                </div>,
                document.body
              )}
            </div>

            {/* Preview estilo WhatsApp */}
            {plantillaSeleccionada && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-texto-secundario">Vista previa</label>
                <div className="rounded-xl overflow-hidden border border-borde-sutil">
                  {/* Header WA */}
                  <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#075e54' }}>
                    <IconoWhatsApp size={16} style={{ color: '#fff' }} />
                    <span className="text-xs font-medium text-white">WhatsApp</span>
                    <span className="text-[10px] text-white/60 ml-auto">{numero}</span>
                  </div>

                  {/* Fondo WA */}
                  <div
                    className="p-4 min-h-[160px]"
                    style={{ background: '#e5ddd5', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M20 0L20 40M0 20L40 20\' stroke=\'%23d5cec5\' stroke-width=\'0.5\'/%3E%3C/svg%3E")' }}
                  >
                    {/* Burbuja */}
                    <div className="rounded-lg p-3 max-w-full shadow-sm" style={{ background: '#fff' }}>
                      {/* Encabezado */}
                      {plantillaSeleccionada.componentes?.encabezado?.tipo === 'TEXT' && encabezadoHtml && (
                        <p
                          className="text-[13px] font-semibold mb-1"
                          style={{ color: '#111' }}
                          dangerouslySetInnerHTML={{ __html: encabezadoHtml }}
                        />
                      )}
                      {plantillaSeleccionada.componentes?.encabezado?.tipo && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(plantillaSeleccionada.componentes.encabezado.tipo) && (
                        <div className="rounded mb-2 flex items-center justify-center text-[11px]" style={{ background: '#f0f0f0', color: '#999', height: 80 }}>
                          {plantillaSeleccionada.componentes.encabezado.tipo === 'IMAGE' ? 'Imagen' : plantillaSeleccionada.componentes.encabezado.tipo === 'VIDEO' ? 'Video' : 'Documento'}
                        </div>
                      )}

                      {/* Cuerpo */}
                      {cuerpoHtml ? (
                        <p
                          className="text-[13px] whitespace-pre-wrap leading-snug"
                          style={{ color: '#111' }}
                          dangerouslySetInnerHTML={{ __html: cuerpoHtml }}
                        />
                      ) : (
                        <p className="text-[13px]" style={{ color: '#999' }}>Cuerpo del mensaje...</p>
                      )}

                      {/* Pie de página */}
                      {plantillaSeleccionada.componentes?.pie_pagina?.texto && (
                        <p className="text-[11px] mt-1.5" style={{ color: '#8696a0' }}>
                          {plantillaSeleccionada.componentes.pie_pagina.texto}
                        </p>
                      )}

                      {/* Hora */}
                      <div className="flex justify-end mt-1">
                        <span className="text-[10px]" style={{ color: '#8696a0' }}>
                          {new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Botones */}
                    {plantillaSeleccionada.componentes?.botones?.length ? (
                      <div className="mt-1 space-y-1">
                        {plantillaSeleccionada.componentes.botones.map((b, i) => (
                          <div key={i} className="rounded-lg py-2 text-center text-[13px] font-medium shadow-sm" style={{ background: '#fff', color: '#00a5f4' }}>
                            {b.tipo === 'URL' && '🔗 '}
                            {b.tipo === 'PHONE_NUMBER' && '📞 '}
                            {b.texto || 'Botón'}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="h-2" style={{ background: '#f0f2f5' }} />
                </div>

                {textoPlanoPreview.includes('{{') && (
                  <p className="text-[11px] text-insignia-advertencia flex items-center gap-1">
                    <AlertCircle size={12} />
                    Algunas variables no se pudieron resolver
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-2.5 bg-insignia-peligro/10 border border-insignia-peligro/20 rounded-lg">
                <AlertCircle size={14} className="text-insignia-peligro shrink-0" />
                <p className="text-xs text-insignia-peligro">{error}</p>
              </div>
            )}
          </>
        )}

        {/* Enviado */}
        {enviado && (
          <div className="flex items-center justify-center gap-2 py-8 text-insignia-exito">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">WhatsApp enviado</span>
          </div>
        )}
      </div>

    </Modal>
  )
}
