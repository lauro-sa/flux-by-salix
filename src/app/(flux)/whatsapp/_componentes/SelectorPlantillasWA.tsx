'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Send, Loader2, Inbox } from 'lucide-react'
import HtmlSeguro from '@/componentes/ui/HtmlSeguro'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { PlantillaWhatsApp, CuerpoPlantillaWA } from '@/tipos/whatsapp'
import { useTraduccion } from '@/lib/i18n'
import { construirDatosPlantilla, resolverTextoPlantilla, type EntidadesPlantilla } from '@/lib/whatsapp/variables'

/**
 * SelectorPlantillasWA — Panel para seleccionar y enviar plantillas de WhatsApp aprobadas.
 * Estilo burbuja WhatsApp: muestra preview del mensaje tal como lo vería el contacto.
 */

/** Datos del contacto actual para reemplazar variables en el preview */
interface DatosContactoPreview {
  nombre?: string | null
  apellido?: string | null
  telefono?: string | null
  correo?: string | null
}

interface PropiedadesSelectorPlantillas {
  canalId: string
  abierto: boolean
  onCerrar: () => void
  onEnviarPlantilla: (plantilla: PlantillaWhatsApp) => void
  enviando?: boolean
  /** Módulo desde donde se abre (inbox, presupuestos, contactos, etc.).
   *  Filtra plantillas que tengan este módulo en su lista, o que no tengan módulos asignados (= todas). */
  contexto?: string
  /** Datos del contacto para preview real de variables */
  contacto?: DatosContactoPreview | null
  /** Nombre de la empresa para preview de {{empresa_nombre}} */
  empresaNombre?: string | null
  /** Entidades adicionales (visita, presupuesto, orden, actividad) para resolver variables.
   *  Si no se pasan, sólo contacto + empresa están disponibles. */
  entidades?: EntidadesPlantilla
}

function previewCuerpo(cuerpo: CuerpoPlantillaWA, datos: Record<string, string>): string {
  return resolverTextoPlantilla(cuerpo.texto, cuerpo, datos)
    // Reemplazar variables sin resolver por un placeholder legible
    .replace(/\{\{(\d+)\}\}/g, (_, n) => `[variable ${n}]`)
}

/** Parsear formato WhatsApp (*negrita*, _cursiva_, ~tachado~, ```código```) a HTML */
function formatoWhatsApp(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/```([^`]+)```/g, '<code>$1</code>')
}

/** Color de la píldora según categoría */
function colorCategoria(categoria: string): { bg: string; fg: string } {
  switch (categoria) {
    case 'MARKETING':
      return { bg: 'var(--insignia-violeta-fondo)', fg: 'var(--insignia-violeta)' }
    case 'AUTHENTICATION':
      return { bg: 'var(--insignia-advertencia-fondo)', fg: 'var(--insignia-advertencia)' }
    case 'UTILITY':
    default:
      return { bg: 'var(--insignia-info-fondo)', fg: 'var(--insignia-info)' }
  }
}

/** Etiqueta legible de categoría */
function etiquetaCategoria(categoria: string): string {
  switch (categoria) {
    case 'MARKETING': return 'Marketing'
    case 'UTILITY': return 'Utilidad'
    case 'AUTHENTICATION': return 'Autenticación'
    default: return categoria
  }
}

export function SelectorPlantillasWA({
  canalId,
  abierto,
  onCerrar,
  onEnviarPlantilla,
  enviando,
  contexto,
  contacto,
  empresaNombre,
  entidades,
}: PropiedadesSelectorPlantillas) {
  const { t } = useTraduccion()
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Datos para resolver variables: se construyen desde el catálogo único.
  // `entidades` gana sobre contacto/empresa por si el caller pasa ambos.
  const datosPlantilla = construirDatosPlantilla({
    contacto: (contacto as Record<string, unknown> | undefined) || undefined,
    empresa: empresaNombre ? { nombre: empresaNombre } : null,
    ...(entidades || {}),
  })

  // Cargar plantillas aprobadas al abrir
  useEffect(() => {
    if (!abierto || !canalId) return
    setCargando(true)
    setBusqueda('')
    fetch(`/api/whatsapp/plantillas?canal_id=${canalId}`)
      .then(res => res.json())
      .then(data => {
        const aprobadas = (data.plantillas || []).filter(
          (p: PlantillaWhatsApp) => {
            if (p.estado_meta !== 'APPROVED' || !p.activo) return false
            // Si la plantilla no tiene módulos asignados → disponible en todos
            if (!p.modulos || p.modulos.length === 0) return true
            // Si hay contexto, filtrar por módulo
            if (contexto) return p.modulos.includes(contexto)
            return true
          }
        )
        setPlantillas(aprobadas)
      })
      .catch(() => setPlantillas([]))
      .finally(() => setCargando(false))
  }, [abierto, canalId])

  const plantillasFiltradas = busqueda.trim()
    ? plantillas.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.componentes?.cuerpo?.texto?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : plantillas

  if (!abierto) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-full left-0 right-0 z-30 flex flex-col"
        style={{
          background: 'var(--superficie-tarjeta)',
          borderTop: '1px solid var(--borde-sutil)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          maxHeight: '420px',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--borde-sutil)' }}
        >
          <div className="flex items-center gap-2">
            <IconoWhatsApp size={16} />
            <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Plantillas
            </span>
            {!cargando && (
              <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                {plantillas.length} disponible{plantillas.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={16} />} onClick={onCerrar} titulo="Cerrar" />
        </div>

        {/* Buscador (solo si hay más de 3 plantillas) */}
        {plantillas.length > 3 && (
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
            <Input
              compacto
              placeholder="Buscar por nombre o contenido..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              icono={<Search size={14} />}
            />
          </div>
        )}

        {/* Lista */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {cargando ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--texto-terciario)' }} />
              <span className="ml-2 text-sm" style={{ color: 'var(--texto-terciario)' }}>
                Cargando plantillas...
              </span>
            </div>
          ) : plantillasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Inbox size={28} style={{ color: 'var(--texto-terciario)', opacity: 0.5 }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
                  {plantillas.length === 0 ? t('inbox.sin_plantillas_aprobadas') : t('comun.sin_resultados')}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
                  {plantillas.length === 0
                    ? 'Creá plantillas desde Configuración → Inbox → Plantillas WhatsApp'
                    : 'Probá con otros términos de búsqueda'}
                </p>
              </div>
            </div>
          ) : (
            plantillasFiltradas.map(plantilla => {
              const cat = colorCategoria(plantilla.categoria)
              const cuerpoPreview = plantilla.componentes?.cuerpo
                ? previewCuerpo(plantilla.componentes.cuerpo, datosPlantilla)
                : ''
              const piePagina = plantilla.componentes?.pie_pagina?.texto
              const botones = plantilla.componentes?.botones
              const encabezado = plantilla.componentes?.encabezado

              return (
                <div
                  key={plantilla.id}
                  className="rounded-card overflow-hidden transition-all"
                  style={{
                    background: 'var(--superficie-app)',
                    border: '1px solid var(--borde-sutil)',
                  }}
                >
                  {/* Encabezado: nombre + categoría + idioma */}
                  <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ borderBottom: '1px solid var(--borde-sutil)' }}
                  >
                    <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--texto-primario)' }}>
                      {plantilla.nombre}
                    </span>
                    <span
                      className="text-xxs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: cat.bg, color: cat.fg }}
                    >
                      {etiquetaCategoria(plantilla.categoria)}
                    </span>
                    <span
                      className="text-xxs font-mono px-1.5 py-0.5 rounded"
                      style={{
                        background: 'color-mix(in srgb, var(--texto-terciario) 8%, transparent)',
                        color: 'var(--texto-terciario)',
                      }}
                    >
                      {plantilla.idioma.toUpperCase()}
                    </span>
                  </div>

                  {/* Preview tipo burbuja WhatsApp */}
                  <div className="px-3 py-2.5">
                    <div
                      className="rounded-card px-3 py-2 text-sm"
                      style={{
                        background: 'color-mix(in srgb, var(--canal-whatsapp) 8%, var(--superficie-tarjeta))',
                        border: '1px solid color-mix(in srgb, var(--canal-whatsapp) 15%, transparent)',
                      }}
                    >
                      {/* Encabezado de plantilla */}
                      {encabezado?.texto && (
                        <HtmlSeguro
                          html={formatoWhatsApp(encabezado.texto)}
                          como="p"
                          className="font-semibold text-sm mb-1"
                        />
                      )}

                      {/* Cuerpo */}
                      <HtmlSeguro
                        html={formatoWhatsApp(cuerpoPreview)}
                        como="p"
                        className="text-sm whitespace-pre-wrap leading-relaxed"
                      />

                      {/* Pie de página */}
                      {piePagina && (
                        <HtmlSeguro
                          html={formatoWhatsApp(piePagina)}
                          como="p"
                          className="text-xs mt-1.5 text-texto-terciario"
                        />
                      )}

                      {/* Botones de plantilla */}
                      {botones && botones.length > 0 && (
                        <div
                          className="flex flex-col gap-1 mt-2 pt-2"
                          style={{ borderTop: '1px solid color-mix(in srgb, var(--canal-whatsapp) 15%, transparent)' }}
                        >
                          {botones.map((btn, i) => (
                            <div
                              key={i}
                              className="text-center text-xs py-1 rounded font-medium"
                              style={{
                                color: 'var(--canal-whatsapp)',
                                background: 'color-mix(in srgb, var(--canal-whatsapp) 5%, transparent)',
                              }}
                            >
                              {btn.texto || btn.url ? `🔗 ${btn.texto}` : btn.texto}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acción enviar */}
                  <div className="px-3 pb-2.5">
                    <button
                      onClick={() => onEnviarPlantilla(plantilla)}
                      disabled={enviando}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-card text-sm font-medium transition-opacity disabled:opacity-50"
                      style={{
                        background: 'var(--canal-whatsapp)',
                        color: '#fff',
                      }}
                    >
                      {enviando ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      Enviar plantilla
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
