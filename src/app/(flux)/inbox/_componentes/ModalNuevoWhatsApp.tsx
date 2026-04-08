'use client'

import { useState, useEffect, useCallback } from 'react'
import { Send, Loader2, Search, Phone, Check, AlertCircle } from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { PlantillaWhatsApp } from '@/tipos/inbox'

/**
 * ModalNuevoWhatsApp — Modal para iniciar una nueva conversación de WhatsApp.
 * El usuario ingresa un número de teléfono, selecciona una plantilla aprobada,
 * completa las variables si las tiene, y al enviar se crea la conversación + se envía el mensaje.
 * Se usa en: inbox WhatsApp, botón "+" en la barra de búsqueda.
 */

interface PropiedadesModalNuevoWA {
  abierto: boolean
  onCerrar: () => void
  canalId: string
  /** Callback al enviar: recibe teléfono, plantilla y valores de variables */
  onEnviar: (telefono: string, plantilla: PlantillaWhatsApp, valoresVariables: string[]) => Promise<void>
}

/** Parsear formato WhatsApp (*negrita*, _cursiva_, ~tachado~) a HTML */
function formatoWhatsApp(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/```([^`]+)```/g, '<code>$1</code>')
}

/** Reemplaza {{N}} con valores dados o placeholder */
/** Si el campo tiene valor lo muestra, si está vacío muestra placeholder gris, si no hay valores usa ejemplo */
function previewCuerpoConValores(texto: string, valores: string[], ejemplos?: string[]): string {
  return texto.replace(/\{\{(\d+)\}\}/g, (_, num) => {
    const idx = parseInt(num) - 1
    // Si hay valores (plantilla seleccionada), usar lo que escribió el usuario
    if (valores.length > 0) {
      if (valores[idx]?.trim()) return valores[idx]
      return '' // Vacío = se envía sin valor
    }
    // Si no hay valores (plantilla no seleccionada), mostrar ejemplo
    if (ejemplos?.[idx]) return ejemplos[idx]
    return `[variable ${num}]`
  })
}

/** Extraer cantidad de variables {{N}} del texto */
function contarVariables(texto?: string): number {
  if (!texto) return 0
  const matches = texto.match(/\{\{\d+\}\}/g)
  return matches ? matches.length : 0
}

/** Detectar label para la variable según mapeo o ejemplo */
function labelVariable(indice: number, mapeo?: string[], ejemplos?: string[]): string {
  const m = mapeo?.[indice]
  if (m) {
    switch (m) {
      case 'contacto_nombre': return 'Nombre del contacto'
      case 'contacto_telefono': return 'Teléfono'
      case 'contacto_correo': return 'Correo'
      case 'empresa_nombre': return 'Nombre de empresa'
    }
  }
  if (ejemplos?.[indice]) return `Variable ${indice + 1} (ej: ${ejemplos[indice]})`
  return `Variable ${indice + 1}`
}

/** Normalizar número: quitar espacios, guiones, paréntesis, + */
function normalizarTelefono(tel: string): string {
  return tel.replace(/[\s\-()+ ]/g, '')
}

/** Validar formato de teléfono internacional */
function validarTelefono(tel: string): { valido: boolean; mensaje?: string } {
  const limpio = normalizarTelefono(tel)
  if (!limpio) return { valido: false }
  if (!/^\d+$/.test(limpio)) return { valido: false, mensaje: 'Solo números' }
  if (limpio.length < 10) return { valido: false, mensaje: 'Número muy corto' }
  if (limpio.length > 15) return { valido: false, mensaje: 'Número muy largo' }
  return { valido: true }
}

export function ModalNuevoWhatsApp({ abierto, onCerrar, canalId, onEnviar }: PropiedadesModalNuevoWA) {
  const [telefono, setTelefono] = useState('')
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([])
  const [cargando, setCargando] = useState(false)
  const [busquedaPlantilla, setBusquedaPlantilla] = useState('')
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaWhatsApp | null>(null)
  const [valoresVariables, setValoresVariables] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [tocado, setTocado] = useState(false)

  // Cargar plantillas aprobadas al abrir
  useEffect(() => {
    if (!abierto || !canalId) return
    setCargando(true)
    setTelefono('')
    setTocado(false)
    setBusquedaPlantilla('')
    setPlantillaSeleccionada(null)
    setValoresVariables([])
    fetch(`/api/inbox/whatsapp/plantillas?canal_id=${canalId}`)
      .then(res => res.json())
      .then(data => {
        const aprobadas = (data.plantillas || []).filter(
          (p: PlantillaWhatsApp) => {
            if (p.estado_meta !== 'APPROVED' || !p.activo) return false
            if (!p.modulos || p.modulos.length === 0) return true
            return p.modulos.includes('inbox')
          }
        )
        setPlantillas(aprobadas)
      })
      .catch(() => setPlantillas([]))
      .finally(() => setCargando(false))
  }, [abierto, canalId])

  // Cuando se selecciona una plantilla, inicializar los valores de variables vacíos
  const seleccionarPlantilla = useCallback((plantilla: PlantillaWhatsApp | null) => {
    setPlantillaSeleccionada(plantilla)
    if (plantilla) {
      const numVars = contarVariables(plantilla.componentes?.cuerpo?.texto)
      setValoresVariables(new Array(numVars).fill(''))
    } else {
      setValoresVariables([])
    }
  }, [])

  const plantillasFiltradas = busquedaPlantilla.trim()
    ? plantillas.filter(p =>
        p.nombre.toLowerCase().includes(busquedaPlantilla.toLowerCase()) ||
        p.componentes?.cuerpo?.texto?.toLowerCase().includes(busquedaPlantilla.toLowerCase())
      )
    : plantillas

  const numVariables = plantillaSeleccionada
    ? contarVariables(plantillaSeleccionada.componentes?.cuerpo?.texto)
    : 0

  const manejarEnvio = useCallback(async () => {
    const telNorm = normalizarTelefono(telefono)
    if (!telNorm || !plantillaSeleccionada) return
    setEnviando(true)
    try {
      await onEnviar(telNorm, plantillaSeleccionada, valoresVariables)
      onCerrar()
    } catch {
      // El error se maneja en el padre
    } finally {
      setEnviando(false)
    }
  }, [telefono, plantillaSeleccionada, valoresVariables, onEnviar, onCerrar])

  const validacion = validarTelefono(telefono)
  const mostrarEstado = tocado && telefono.length > 0

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Nuevo mensaje WhatsApp" tamano="lg" sinPadding>
      <div className="flex flex-col" style={{ maxHeight: 'min(70vh, 600px)' }}>
        {/* Campo teléfono */}
        <div className="px-5 pt-4 pb-3 space-y-1" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          <label className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
            Número de teléfono
          </label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-terciario)' }} />
            <input
              type="tel"
              value={telefono}
              onChange={(e) => { setTelefono(e.target.value); if (!tocado) setTocado(true) }}
              onBlur={() => setTocado(true)}
              placeholder="Ej: 5491123456789"
              autoFocus
              className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{
                background: 'var(--superficie-tarjeta)',
                border: `1px solid ${mostrarEstado ? (validacion.valido ? 'var(--insignia-exito)' : 'var(--insignia-peligro)') : 'var(--borde-sutil)'}`,
                color: 'var(--texto-primario)',
              }}
            />
            {/* Indicador de estado dentro del input */}
            {mostrarEstado && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validacion.valido ? (
                  <Check size={14} style={{ color: 'var(--insignia-exito)' }} />
                ) : (
                  <AlertCircle size={14} style={{ color: 'var(--insignia-peligro)' }} />
                )}
              </div>
            )}
          </div>
          {mostrarEstado && !validacion.valido && validacion.mensaje ? (
            <p className="text-xs" style={{ color: 'var(--insignia-peligro)' }}>
              {validacion.mensaje}
            </p>
          ) : (
            <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
              Código de país + número, sin espacios ni guiones
            </p>
          )}
        </div>

        {/* Selector de plantilla */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="px-5 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <IconoWhatsApp size={14} />
                <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>
                  Plantillas disponibles
                </span>
                <span className="text-xxs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}>
                  {plantillas.length}
                </span>
              </div>
            </div>
            {plantillas.length > 3 && (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-terciario)' }} />
                <input
                  type="text"
                  value={busquedaPlantilla}
                  onChange={(e) => setBusquedaPlantilla(e.target.value)}
                  placeholder="Buscar plantilla..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs outline-none"
                  style={{
                    background: 'var(--superficie-hover)',
                    color: 'var(--texto-primario)',
                    border: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* Lista de plantillas */}
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
            {cargando ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--texto-terciario)' }} />
              </div>
            ) : plantillasFiltradas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                  {plantillas.length === 0 ? 'No hay plantillas aprobadas' : 'Sin resultados'}
                </p>
              </div>
            ) : (
              plantillasFiltradas.map((plantilla) => {
                const seleccionada = plantillaSeleccionada?.id === plantilla.id
                const cuerpo = plantilla.componentes?.cuerpo
                const encabezado = plantilla.componentes?.encabezado
                const piePagina = plantilla.componentes?.pie_pagina

                return (
                  <button
                    key={plantilla.id}
                    onClick={() => seleccionarPlantilla(seleccionada ? null : plantilla)}
                    className="w-full text-left rounded-xl p-3 transition-all cursor-pointer"
                    style={{
                      background: seleccionada ? 'var(--superficie-seleccionada)' : 'var(--superficie-tarjeta)',
                      border: `2px solid ${seleccionada ? 'var(--canal-whatsapp)' : 'var(--borde-sutil)'}`,
                    }}
                  >
                    {/* Nombre + categoría */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>
                        {plantilla.nombre}
                      </span>
                      <span
                        className="text-xxs px-1.5 py-0.5 rounded-full font-medium uppercase"
                        style={{
                          background: plantilla.categoria === 'MARKETING'
                            ? 'color-mix(in srgb, #8b5cf6 12%, transparent)'
                            : 'color-mix(in srgb, #3b82f6 12%, transparent)',
                          color: plantilla.categoria === 'MARKETING' ? '#8b5cf6' : '#3b82f6',
                        }}
                      >
                        {plantilla.categoria === 'MARKETING' ? 'Marketing' : plantilla.categoria === 'UTILITY' ? 'Utilidad' : plantilla.categoria}
                      </span>
                    </div>

                    {/* Preview burbuja — muestra los valores editados en tiempo real */}
                    <div
                      className="rounded-lg p-2.5 text-xs leading-relaxed"
                      style={{
                        background: 'color-mix(in srgb, var(--canal-whatsapp) 8%, var(--superficie-hover))',
                        color: 'var(--texto-secundario)',
                      }}
                    >
                      {encabezado?.tipo === 'TEXT' && encabezado.texto && (
                        <p className="font-semibold mb-1" style={{ color: 'var(--texto-primario)' }}>
                          {encabezado.texto}
                        </p>
                      )}
                      {cuerpo?.texto && (
                        <p
                          className="whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{
                            __html: formatoWhatsApp(
                              previewCuerpoConValores(
                                cuerpo.texto,
                                seleccionada ? valoresVariables : [],
                                cuerpo.ejemplos,
                              )
                            ),
                          }}
                        />
                      )}
                      {piePagina?.texto && (
                        <p className="mt-1.5 text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                          {piePagina.texto}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Campos de variables — solo si la plantilla seleccionada tiene variables */}
        {plantillaSeleccionada && numVariables > 0 && (
          <div className="px-5 py-3 space-y-2" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
              Completar variables
            </span>
            {valoresVariables.map((valor, i) => (
              <div key={i}>
                <label className="text-xxs mb-0.5 block" style={{ color: 'var(--texto-terciario)' }}>
                  {labelVariable(i, plantillaSeleccionada.componentes?.cuerpo?.mapeo_variables, plantillaSeleccionada.componentes?.cuerpo?.ejemplos)}
                </label>
                <input
                  type="text"
                  value={valor}
                  onChange={(e) => {
                    const nuevos = [...valoresVariables]
                    nuevos[i] = e.target.value
                    setValoresVariables(nuevos)
                  }}
                  placeholder={plantillaSeleccionada.componentes?.cuerpo?.ejemplos?.[i] || `Variable ${i + 1}`}
                  className="w-full px-3 py-1.5 rounded-md text-xs outline-none transition-all"
                  style={{
                    background: 'var(--superficie-tarjeta)',
                    border: '1px solid var(--borde-sutil)',
                    color: 'var(--texto-primario)',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Footer: botón enviar */}
        <div
          className="px-5 py-3 flex items-center justify-end gap-3"
          style={{ borderTop: '1px solid var(--borde-sutil)' }}
        >
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            tamano="sm"
            onClick={manejarEnvio}
            disabled={!validacion.valido || !plantillaSeleccionada || enviando}
            icono={enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            style={{
              background: validacion.valido && plantillaSeleccionada ? 'var(--canal-whatsapp)' : undefined,
              color: validacion.valido && plantillaSeleccionada ? '#fff' : undefined,
            }}
          >
            {enviando ? 'Enviando...' : 'Enviar plantilla'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
