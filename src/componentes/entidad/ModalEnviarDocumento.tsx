'use client'

/**
 * ModalEnviarDocumento — Modal completo para enviar documentos (presupuestos, facturas, etc.) por correo.
 * Cabezal fijo (De, Para, CC/CCO, Asunto, Plantilla), cuerpo con scroll (editor rico),
 * pie fijo (adjuntos en chips compactos + botones de acción con popover de programación).
 * Se usa en: EditorPresupuesto.tsx, y potencialmente en cualquier módulo de documentos.
 *
 * Este archivo es el orquestador: delega estado al hook useEnvioDocumento
 * y renderiza sub-componentes extraídos en _enviar_documento/.
 */

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Checkbox } from '@/componentes/ui/Checkbox'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import {
  Send, X, Paperclip, FileText, Loader2, Clock,
  ChevronDown, Link2, Upload, Maximize2, Minimize2,
  SendHorizonal, Braces, Save, Check, BookmarkPlus,
} from 'lucide-react'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { SelectorPlantillaCorreo, type PlantillaCorreoCompleta } from '@/componentes/entidad/SelectorPlantillaCorreo'

import {
  InputEmailChips,
  InputAsuntoVariables,
  PopoverProgramar,
  useEnvioDocumento,
  iconoArchivo,
} from './_enviar_documento'

import type { PropiedadesModalEnviarDocumento } from './_enviar_documento/tipos'

// ─── Re-exportar tipos para mantener la API pública ───
export type {
  CanalCorreoEmpresa,
  PlantillaCorreo,
  AdjuntoDocumento,
  DatosEnvioDocumento,
  DatosBorradorCorreo,
  DatosPlantillaCorreo,
  SnapshotCorreo,
} from './_enviar_documento/tipos'

// ─── Componente principal ───

export function ModalEnviarDocumento({
  abierto,
  onCerrar,
  onEnviar,
  canales,
  plantillas = [],
  correosDestinatario = [],
  nombreDestinatario,
  asuntoPredeterminado = '',
  htmlInicial = '',
  adjuntoDocumento,
  urlPortal,
  enviando = false,
  tipoDocumento = 'Documento',
  onGuardarBorrador,
  onGuardarPlantilla,
  contextoVariables,
  snapshotRestaurar,
  plantillaPredeterminadaId,
  onCambiarPredeterminada,
  usuarioId,
  esAdmin = false,
  onGuardarCambiosPlantilla,
  onCrearPlantilla,
  onEliminarPlantilla,
  pdfDesactivadoInicial,
  portalDesactivadoInicial,
}: PropiedadesModalEnviarDocumento) {
  const [expandido, setExpandido] = useState(false)
  const refBotonCanal = useRef<HTMLButtonElement>(null)
  const refDropdownCanal = useRef<HTMLDivElement>(null)
  const [posCanalDropdown, setPosCanalDropdown] = useState({ top: 0, left: 0, width: 0 })

  const estado = useEnvioDocumento({
    abierto,
    canales,
    plantillas,
    correosDestinatario,
    asuntoPredeterminado,
    htmlInicial,
    adjuntoDocumento,
    urlPortal,
    enviando,
    contextoVariables,
    snapshotRestaurar,
    plantillaPredeterminadaId,
    pdfDesactivadoInicial,
    portalDesactivadoInicial,
    onEnviar,
    onGuardarBorrador,
    onGuardarPlantilla,
  })

  // Posición del dropdown de canales
  useLayoutEffect(() => {
    if (!estado.mostrarCanales || !refBotonCanal.current) return
    const rect = refBotonCanal.current.getBoundingClientRect()
    setPosCanalDropdown({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) })
  }, [estado.mostrarCanales])

  useEffect(() => {
    if (!estado.mostrarCanales) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (refBotonCanal.current?.contains(target)) return
      if (refDropdownCanal.current?.contains(target)) return
      estado.setMostrarCanales(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [estado.mostrarCanales, estado])

  useEffect(() => {
    if (!estado.mostrarCanales) return
    const handler = () => {
      if (refBotonCanal.current) {
        const rect = refBotonCanal.current.getBoundingClientRect()
        setPosCanalDropdown({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) })
      }
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [estado.mostrarCanales])

  // Detectar si hay cambios respecto a la plantilla cargada
  const tieneModificaciones = !!(estado.plantillaId && (
    estado.asunto !== estado.plantillaAsuntoOriginal ||
    estado.html !== estado.plantillaHtmlOriginal
  ))

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tamano="3xl" sinPadding expandido={expandido}>
      <div
        ref={estado.dropRef}
        className="flex flex-col flex-1 min-h-0 relative"
        onDragOver={estado.handleDragOver}
        onDragLeave={estado.handleDragLeave}
        onDrop={estado.handleDrop}
      >
        {/* Overlay drag & drop */}
        <AnimatePresence>
          {estado.arrastrando && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center rounded-lg"
              style={{ background: 'rgba(var(--texto-marca-rgb, 37, 99, 235), 0.08)', border: '2px dashed var(--texto-marca)' }}
            >
              <div className="flex flex-col items-center gap-2">
                <Upload size={24} style={{ color: 'var(--texto-marca)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--texto-marca)' }}>Soltar archivos aquí</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════ CABEZAL FIJO ══════════ */}
        <div className="shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          {/* Título + cerrar */}
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Enviar documento
            </h2>
            <div className="flex items-center gap-1">
              <Boton
                variante="fantasma"
                tamano="sm"
                soloIcono
                titulo={expandido ? 'Minimizar' : 'Pantalla completa'}
                icono={expandido ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                onClick={() => setExpandido(!expandido)}
              />
              <Boton variante="fantasma" tamano="sm" soloIcono titulo="Cerrar" icono={<X size={18} />} onClick={onCerrar} />
            </div>
          </div>

          {/* Campos del correo */}
          <div className="px-6 pb-3 space-y-0.5">
            {/* De: con dropdown */}
            {canales.length > 0 && (
              <div className="flex items-center gap-2 min-h-[36px] relative">
                <span className="text-sm w-14 flex-shrink-0 text-right font-medium" style={{ color: 'var(--texto-terciario)' }}>De:</span>
                <div className="flex-1">
                  {canales.length === 1 ? (
                    <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
                      {estado.canalActivo?.nombre} &lt;{estado.canalActivo?.email}&gt;
                    </span>
                  ) : (
                    <div>
                      <button
                        ref={refBotonCanal}
                        className="flex items-center gap-1.5 text-sm py-1 transition-colors hover:opacity-80 rounded focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                        style={{ color: 'var(--texto-primario)' }}
                        onClick={() => estado.setMostrarCanales(!estado.mostrarCanales)}
                        type="button"
                      >
                        {estado.canalActivo?.nombre} &lt;{estado.canalActivo?.email}&gt;
                        <ChevronDown size={14} style={{ color: 'var(--texto-terciario)' }} />
                      </button>
                      {typeof window !== 'undefined' && createPortal(
                      <AnimatePresence>
                        {estado.mostrarCanales && (
                          <motion.div
                            ref={refDropdownCanal}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="fixed py-1 rounded-lg shadow-lg"
                            style={{
                              top: posCanalDropdown.top,
                              left: posCanalDropdown.left,
                              width: posCanalDropdown.width,
                              zIndex: 'var(--z-popover)' as unknown as number,
                              background: 'var(--superficie-elevada)',
                              border: '1px solid var(--borde-sutil)',
                            }}
                          >
                            {canales.map(c => (
                              <button
                                key={c.id}
                                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--superficie-hover)] focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                                style={{ color: c.id === estado.canalId ? 'var(--texto-marca)' : 'var(--texto-primario)' }}
                                onClick={() => { estado.setCanalId(c.id); estado.setMostrarCanales(false) }}
                              >
                                {c.nombre} &lt;{c.email}&gt;
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>,
                      document.body
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Para + botones CC/CCO */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <InputEmailChips etiqueta="Para:" emails={estado.para} onChange={estado.setPara} placeholder={nombreDestinatario || 'destinatario@correo.com'} />
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0 pt-2">
                {!estado.mostrarCC && (
                  <button
                    onClick={() => estado.setMostrarCC(true)}
                    className="text-xs px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--superficie-hover)] focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                    style={{ color: 'var(--texto-terciario)' }}
                    type="button"
                  >
                    +CC
                  </button>
                )}
                {!estado.mostrarCCO && (
                  <>
                    {!estado.mostrarCC && <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>/</span>}
                    <button
                      onClick={() => estado.setMostrarCCO(true)}
                      className="text-xs px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--superficie-hover)] focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                      style={{ color: 'var(--texto-terciario)' }}
                      type="button"
                    >
                      CCO
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* CC */}
            <AnimatePresence>
              {estado.mostrarCC && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="flex items-start gap-0">
                    <div className="flex-1">
                      <InputEmailChips etiqueta="CC:" emails={estado.cc} onChange={estado.setCC} />
                    </div>
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      soloIcono
                      icono={<X size={13} />}
                      titulo="Quitar CC"
                      onClick={() => { estado.setMostrarCC(false); estado.setCC([]) }}
                      className="flex-shrink-0 mt-1.5"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CCO */}
            <AnimatePresence>
              {estado.mostrarCCO && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="flex items-start gap-0">
                    <div className="flex-1">
                      <InputEmailChips etiqueta="CCO:" emails={estado.cco} onChange={estado.setCCO} />
                    </div>
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      soloIcono
                      icono={<X size={13} />}
                      titulo="Quitar CCO"
                      onClick={() => { estado.setMostrarCCO(false); estado.setCCO([]) }}
                      className="flex-shrink-0 mt-1.5"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Asunto + botón de variables */}
            <div className="flex items-center gap-2 min-h-[36px]">
              <span className="text-sm w-14 flex-shrink-0 text-right font-medium" style={{ color: 'var(--texto-terciario)' }}>Asunto:</span>
              <InputAsuntoVariables
                valor={estado.asunto}
                onChange={estado.setAsunto}
                placeholder="Asunto del correo"
                contexto={contextoVariables}
                onAbrirVariables={() => estado.setVariablesAsuntoAbierto(true)}
              />
              <div className="relative flex-shrink-0">
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<Braces size={14} />} onClick={() => estado.setVariablesAsuntoAbierto(!estado.variablesAsuntoAbierto)} titulo="Insertar variable" />
                <SelectorVariables
                  abierto={estado.variablesAsuntoAbierto}
                  onCerrar={() => estado.setVariablesAsuntoAbierto(false)}
                  onSeleccionar={estado.insertarVariableAsunto}
                  posicion="abajo"
                  contexto={contextoVariables}
                />
              </div>
            </div>
          </div>

          {/* Fila de plantilla + indicador de canal — fondo ligeramente diferente */}
          <div
            className="flex items-center justify-between gap-3 px-6 py-2.5"
            style={{ borderTop: '1px solid var(--borde-sutil)', background: 'var(--superficie-hover)' }}
          >
            <SelectorPlantillaCorreo
              plantillas={(plantillas as PlantillaCorreoCompleta[]).map(p => ({
                ...p,
                creado_por: p.creado_por || '',
              }))}
              plantillaActualId={estado.plantillaId}
              predeterminadaId={plantillaPredeterminadaId || null}
              usuarioId={usuarioId || ''}
              esAdmin={esAdmin}
              onSeleccionar={estado.aplicarPlantilla}
              onLimpiar={estado.limpiarPlantilla}
              onGuardarCambios={onGuardarCambiosPlantilla ? async (id) => {
                await onGuardarCambiosPlantilla(id, { asunto: estado.revertirVariables(estado.asunto), contenido_html: estado.revertirVariables(estado.html) })
                estado.marcarPlantillaSincronizada()
              } : undefined}
              onGuardarComo={onCrearPlantilla ? async (nombre, paraTodos) => {
                await onCrearPlantilla(nombre, { asunto: estado.revertirVariables(estado.asunto), contenido_html: estado.revertirVariables(estado.html), paraTodos })
              } : undefined}
              onEliminar={onEliminarPlantilla}
              onTogglePredeterminada={onCambiarPredeterminada}
              tieneModificaciones={tieneModificaciones}
            />
            {estado.canalActivo && (
              <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                vía {estado.canalActivo.email}
              </span>
            )}
          </div>
        </div>

        {/* ══════════ CUERPO CON SCROLL ══════════ */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <EditorTexto
            contenido={snapshotRestaurar ? snapshotRestaurar.html : htmlInicial}
            onChange={estado.setHtml}
            placeholder="Escribí tu mensaje..."
            alturaMinima={200}
            autoEnfocar
            habilitarVariables
            onEditorListo={estado.handleEditorListo}
          />
        </div>

        {/* Botón { } flotante que sigue al cursor del editor */}
        {abierto && estado.cursorEditorPos && !estado.variablesCuerpoAbierto && typeof window !== 'undefined' && createPortal(
          <div
            className="fixed pointer-events-auto"
            style={{
              top: estado.cursorEditorPos.top - 3,
              left: estado.cursorEditorPos.left + 24,
              zIndex: 99999,
            }}
          >
            <Tooltip contenido="Insertar variable">
              <button
                onMouseDown={(e) => {
                  e.preventDefault() // No quitar foco del editor
                  e.stopPropagation()
                  estado.setVariablesCuerpoAbierto(true)
                }}
                className="flex items-center justify-center size-6 rounded-md transition-all hover:bg-[var(--superficie-hover)] hover:opacity-100"
                style={{ color: 'var(--texto-terciario)', opacity: 0.35 }}
                type="button"
              >
                <Braces size={13} />
              </button>
            </Tooltip>
          </div>,
          document.body
        )}

        {/* Selector de variables del cuerpo (siempre montado para el portal) */}
        <div className="relative">
          <SelectorVariables
            abierto={estado.variablesCuerpoAbierto}
            onCerrar={() => estado.setVariablesCuerpoAbierto(false)}
            onSeleccionar={estado.insertarVariableCuerpo}
            posicion="abajo"
            contexto={contextoVariables}
          />
        </div>


        {/* ══════════ PIE FIJO ══════════ */}
        <div className="shrink-0" style={{ borderTop: '1px solid var(--borde-sutil)' }}>

          {/* Fila de adjuntos — chips compactos en línea */}
          <div className="flex items-center gap-2 px-6 py-2.5 flex-wrap">
            {/* PDF chip — toggle incluir/quitar */}
            {adjuntoDocumento && (
              estado.incluirPdf ? (
                <span
                  className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-xs"
                  style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                >
                  <FileText size={13} style={{ color: 'var(--insignia-peligro)' }} />
                  <span className="max-w-[160px] truncate">{adjuntoDocumento.nombre_archivo}</span>
                  <button
                    onClick={() => estado.setIncluirPdf(false)}
                    className="p-0.5 rounded hover:bg-[var(--superficie-activa)] transition-colors"
                    type="button"
                  >
                    <X size={11} style={{ color: 'var(--texto-terciario)' }} />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => estado.setIncluirPdf(true)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors hover:bg-[var(--superficie-hover)]"
                  style={{ color: 'var(--texto-terciario)', border: '1px dashed var(--borde-sutil)' }}
                  type="button"
                >
                  <FileText size={13} />
                  <span>Incluir PDF</span>
                </button>
              )
            )}

            {/* Adjuntos extra como chips */}
            {estado.adjuntos.map((adj) => (
              <span
                key={adj.id}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-xs"
                style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
              >
                {iconoArchivo(adj.tipo_mime)}
                <span className="max-w-[120px] truncate">{adj.nombre_archivo}</span>
                <button
                  onClick={() => estado.removerAdjunto(adj.id)}
                  className="p-0.5 rounded hover:bg-[var(--superficie-activa)] transition-colors"
                  type="button"
                >
                  <X size={11} style={{ color: 'var(--texto-terciario)' }} />
                </button>
              </span>
            ))}

            {estado.subiendoAdjuntos && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs" style={{ color: 'var(--texto-terciario)' }}>
                <Loader2 size={12} className="animate-spin" /> Subiendo...
              </span>
            )}

            {/* Checkbox portal */}
            {urlPortal && (
              <span className="inline-flex items-center gap-1.5 text-xs select-none ml-1" style={{ color: 'var(--texto-secundario)' }}>
                <Checkbox
                  marcado={estado.incluirEnlacePortal}
                  onChange={estado.setIncluirEnlacePortal}
                />
                <Link2 size={13} />
                Portal
              </span>
            )}

            {/* Adjuntar archivo */}
            <Boton variante="fantasma" tamano="xs" icono={<Paperclip size={13} />} onClick={() => estado.inputArchivosRef.current?.click()}>
              Adjuntar archivo
            </Boton>
            <input
              ref={estado.inputArchivosRef}
              type="file"
              multiple
              onChange={estado.handleArchivos}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
            />
          </div>

          {/* Botones de acción */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderTop: '1px solid var(--borde-sutil)' }}
          >
            {/* Izquierda: Enviar + Descartar */}
            <div className="flex items-center gap-2">
              <Boton
                variante="primario"
                tamano="sm"
                icono={<Send size={14} />}
                onClick={estado.handleEnviar}
                cargando={enviando}
                disabled={!estado.puedeEnviar}
              >
                Enviar
              </Boton>
              <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>
                Descartar
              </Boton>
            </div>

            {/* Derecha: programar + guardar plantilla */}
            <div className="flex items-center gap-1 relative">
              {/* Popover de programación */}
              <PopoverProgramar
                abierto={estado.mostrarProgramar}
                onCerrar={() => estado.setMostrarProgramar(false)}
                onProgramar={estado.handleProgramar}
                disabled={!estado.puedeEnviar}
              />
              <Boton variante="fantasma" tamano="sm" soloIcono icono={<Clock size={18} />} onClick={() => estado.setMostrarProgramar(!estado.mostrarProgramar)} titulo="Programar envío" />

              {/* Guardar plantilla — amarillo cuando hay cambios, normal si no */}
              {onGuardarCambiosPlantilla && (
                <Tooltip contenido={
                  tieneModificaciones ? 'Guardar cambios en la plantilla'
                    : estado.plantillaId ? 'Plantilla sin cambios'
                    : 'Seleccioná una plantilla primero'
                }>
                  <button
                    onClick={async () => {
                      if (!tieneModificaciones || !estado.plantillaId) return
                      await onGuardarCambiosPlantilla(estado.plantillaId, { asunto: estado.revertirVariables(estado.asunto), contenido_html: estado.revertirVariables(estado.html) })
                      estado.marcarPlantillaSincronizada()
                    }}
                    disabled={!tieneModificaciones}
                    className="size-8 flex items-center justify-center rounded-lg transition-all"
                    style={{
                      color: tieneModificaciones ? 'var(--insignia-advertencia)' : 'var(--texto-terciario)',
                      opacity: tieneModificaciones ? 1 : 0.35,
                    }}
                  >
                    <BookmarkPlus size={18} />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
