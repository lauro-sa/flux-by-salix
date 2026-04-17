'use client'

/**
 * ModalEditorPlantillaCorreo — Editor completo de plantillas de correo.
 * Diseño limpio inspirado en Odoo: foco en el contenido, config secundaria colapsada.
 * Se usa en: inbox/configuracion (SeccionPlantillas).
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Tabs } from '@/componentes/ui/Tabs'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'
import { Braces, Eye, Code2, PenLine, Maximize2, Minimize2, RotateCcw, ChevronRight, Settings2 } from 'lucide-react'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { useTraduccion } from '@/lib/i18n'

import { useEditorPlantilla } from './useEditorPlantilla'
import { OPCIONES_DISPONIBLE, OPCIONES_VISIBILIDAD } from './constantes'
import { iniciales, colorAvatar } from './utilidades'
import { BuscadorContactoPreview } from './BuscadorContactoPreview'
import { BuscadorDocumentoPreview } from './BuscadorDocumentoPreview'
import { AsuntoConVariables } from './AsuntoConVariables'
import { PrevisualizacionPlantilla } from './PrevisualizacionPlantilla'
import { EditorCodigoHtml } from './EditorCodigoHtml'
import type { PropiedadesModalEditorPlantilla } from './tipos'

// ─── Tabs del editor ───

const TABS_EDITOR = [
  { clave: 'editar', etiqueta: 'Editar', icono: <PenLine size={14} /> },
  { clave: 'codigo', etiqueta: 'Código', icono: <Code2 size={14} /> },
  { clave: 'preview', etiqueta: 'Vista previa', icono: <Eye size={14} /> },
]

// ─── Componente principal ───

export function ModalEditorPlantillaCorreo({
  abierto,
  onCerrar,
  plantilla,
  onGuardado,
}: PropiedadesModalEditorPlantilla) {
  const { t } = useTraduccion()
  const [expandido, setExpandido] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [configAbierta, setConfigAbierta] = useState(false)

  const estado = useEditorPlantilla({ abierto, plantilla, onGuardado, onCerrar })

  // Plantilla de sistema: verificar si fue modificada
  const esSistema = plantilla?.es_sistema ?? false
  const fueModificada = esSistema && plantilla?.contenido_original_html && plantilla?.asunto_original
    ? (plantilla.contenido_html !== plantilla.contenido_original_html || plantilla.asunto !== plantilla.asunto_original)
    : false

  const handleRestaurar = async () => {
    if (!plantilla?.id) return
    setRestaurando(true)
    try {
      await fetch(`/api/correo/plantillas/${plantilla.id}/restaurar`, { method: 'POST' })
      onGuardado()
      onCerrar()
    } catch { /* silenciar */ }
    finally { setRestaurando(false) }
  }

  const {
    esEdicion,
    nombre, setNombre,
    asunto, setAsunto,
    contenidoHtml, setContenidoHtml,
    modulos, setModulos,
    visibilidad, setVisibilidad,
    usuariosEmpresa,
    usuariosSeleccionados, setUsuariosSeleccionados,
    guardando,
    contactoPreview, setContactoPreview,
    documentoPreview, setDocumentoPreview,
    cargandoContacto,
    contactoBloqueadoPorDoc,
    seleccionarContactoPreview,
    seleccionarDocumentoPreview,
    contextoVariables,
    resolverPreview,
    variablesAsuntoAbierto, setVariablesAsuntoAbierto,
    variablesCuerpoAbierto, setVariablesCuerpoAbierto,
    insertarVariableAsunto,
    insertarVariableCuerpo,
    variablesHtmlAbierto, setVariablesHtmlAbierto,
    insertarVariableHtml,
    editorRef,
    setEditorListo,
    cursorEditorPos,
    tabActivo,
    handleCambiarTab,
    htmlCrudo, setHtmlCrudo,
    handleGuardar,
  } = estado

  // Resumen de config avanzada para mostrar inline
  const resumenConfig = [
    modulos.length > 0 ? `${modulos.length} módulo${modulos.length > 1 ? 's' : ''}` : null,
    visibilidad !== 'todos' ? OPCIONES_VISIBILIDAD.find(o => o.valor === visibilidad)?.etiqueta : null,
  ].filter(Boolean).join(' · ')

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? `Editar plantilla — ${nombre || plantilla?.nombre || ''}${esSistema ? ' (Sistema)' : ''}` : 'Nueva plantilla'}
      tamano="5xl"
      sinPadding
      expandido={expandido}
      accionesEncabezado={
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          titulo={expandido ? 'Minimizar' : 'Pantalla completa'}
          icono={expandido ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          onClick={() => setExpandido(!expandido)}
        />
      }
      acciones={
        <>
          {esSistema && (
            <Boton
              variante="secundario"
              tamano="sm"
              icono={<RotateCcw size={14} />}
              cargando={restaurando}
              onClick={handleRestaurar}
              disabled={!fueModificada}
              className="mr-auto"
            >
              Restaurar original
            </Boton>
          )}
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>{t('comun.cancelar')}</Boton>
          <Boton tamano="sm" cargando={guardando} onClick={handleGuardar}>
            {esEdicion ? 'Guardar cambios' : 'Crear plantilla'}
          </Boton>
        </>
      }
    >
      {/* ── Nombre + Asunto: siempre visibles arriba ── */}
      <div className="px-6 pt-4 pb-3 space-y-3 border-b border-white/[0.07] shrink-0">
        {/* Nombre */}
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la plantilla"
          className="!text-base !font-semibold"
        />
        {/* Asunto con variables */}
        <AsuntoConVariables
          valor={asunto}
          onChange={setAsunto}
          placeholder="Asunto del correo — usa {{ }} para variables"
          contexto={contextoVariables}
          variablesAbierto={variablesAsuntoAbierto}
          onToggleVariables={() => setVariablesAsuntoAbierto(!variablesAsuntoAbierto)}
          onCerrarVariables={() => setVariablesAsuntoAbierto(false)}
          onInsertarVariable={insertarVariableAsunto}
          etiqueta="Asunto"
        />
      </div>

      {/* ── Tabs: Editar / Código / Vista previa ── */}
      <div className="px-6 pt-1 pb-0 border-b border-white/[0.07] shrink-0">
        <Tabs tabs={TABS_EDITOR} activo={tabActivo} onChange={handleCambiarTab} />
      </div>

      {/* Contenedor del tab — altura limitada. Sin context bar = más espacio.
           Resta: header(57) + nombre+asunto(~110) + tabs(~41) + footer(~65) + paddings(~24) ≈ 297px */}
      <div className="px-6 py-4 flex flex-col" style={{ maxHeight: expandido ? 'calc(100dvh - 297px)' : 'calc(90dvh - 297px)', overflowY: 'auto' }}>

        {/* ═══════════ TAB EDITAR (visual) — se oculta con display:none para no desmontar el editor ═══════════ */}
        <div className="flex flex-col flex-1 min-h-0" style={{ display: tabActivo === 'editar' ? undefined : 'none' }}>
            {/* Editor de contenido — ocupa todo el espacio */}
            <EditorTexto
              contenido={esEdicion ? contenidoHtml : ''}
              onChange={setContenidoHtml}
              placeholder="Escribí el contenido del correo... Usá {{ }} para insertar variables."
              alturaMinima={250}
              habilitarVariables
              onEditorListo={(editor) => { editorRef.current = editor; setEditorListo(true) }}
              className="flex-1"
            />
          </div>

        {/* Boton { } flotante que sigue al cursor del editor */}
        {abierto && tabActivo === 'editar' && cursorEditorPos && !variablesCuerpoAbierto && typeof window !== 'undefined' && createPortal(
          <div
            className="fixed pointer-events-auto"
            style={{ top: cursorEditorPos.top - 3, left: cursorEditorPos.left + 24, zIndex: 99999 }}
          >
            <Tooltip contenido="Insertar variable">
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setVariablesCuerpoAbierto(true) }}
                className="flex items-center justify-center size-6 rounded-md transition-all hover:bg-white/[0.06] hover:opacity-100 text-texto-terciario opacity-35"
                type="button"
              >
                <Braces size={13} />
              </button>
            </Tooltip>
          </div>,
          document.body
        )}

        {/* SelectorVariables del cuerpo — posicionado cerca del botón flotante {} */}
        {abierto && typeof window !== 'undefined' && createPortal(
          <div
            className="fixed"
            style={{
              top: cursorEditorPos ? cursorEditorPos.top - 3 : 0,
              left: cursorEditorPos ? cursorEditorPos.left + 24 : 0,
              zIndex: 99999,
              pointerEvents: variablesCuerpoAbierto ? 'auto' : 'none',
            }}
          >
            <SelectorVariables
              abierto={variablesCuerpoAbierto}
              onCerrar={() => setVariablesCuerpoAbierto(false)}
              onSeleccionar={insertarVariableCuerpo}
              posicion="abajo"
              contexto={contextoVariables}
            />
          </div>,
          document.body
        )}

        {/* ═══════════ TAB CÓDIGO (HTML) ═══════════ */}
        {tabActivo === 'codigo' && (
          <div className="flex flex-col">
            <EditorCodigoHtml
              htmlCrudo={htmlCrudo}
              onHtmlCrudoChange={setHtmlCrudo}
              variablesHtmlAbierto={variablesHtmlAbierto}
              onToggleVariablesHtml={() => setVariablesHtmlAbierto(!variablesHtmlAbierto)}
              onCerrarVariablesHtml={() => setVariablesHtmlAbierto(false)}
              onInsertarVariableHtml={insertarVariableHtml}
              contextoVariables={contextoVariables}
            />
          </div>
        )}

        {/* ═══════════ TAB VISTA PREVIA ═══════════ */}
        {tabActivo === 'preview' && (
          <div className="space-y-4">
            {/* Selectores de contexto para preview — antes estaban arriba del modal */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.07]">
              {/* Contacto */}
              <div className="min-w-0">
                <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5 block">Registro de prueba</label>
                <div className="flex items-center gap-2">
                  {contactoPreview ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className="size-7 rounded-full flex items-center justify-center text-xxs font-bold flex-shrink-0"
                        style={{ background: colorAvatar(`${contactoPreview.nombre || ''}`), color: 'white' }}
                      >
                        {iniciales(String(contactoPreview.nombre || ''), contactoPreview.apellido as string)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-texto-primario">
                          {`${contactoPreview.nombre || ''} ${contactoPreview.apellido || ''}`.trim()}
                        </p>
                        {typeof contactoPreview.correo === 'string' && contactoPreview.correo && (
                          <p className="text-xxs truncate text-texto-terciario">{contactoPreview.correo}</p>
                        )}
                      </div>
                      {!contactoBloqueadoPorDoc && (
                        <Boton
                          variante="fantasma"
                          tamano="xs"
                          onClick={() => setContactoPreview(null)}
                          className="flex-shrink-0 text-xxs"
                        >
                          Cambiar
                        </Boton>
                      )}
                      {contactoBloqueadoPorDoc && (
                        <span className="text-xxs flex-shrink-0 text-texto-terciario">vía documento</span>
                      )}
                    </div>
                  ) : (
                    <BuscadorContactoPreview
                      onSeleccionar={seleccionarContactoPreview}
                      cargando={cargandoContacto}
                    />
                  )}
                </div>
              </div>

              {/* Documento */}
              <div className="min-w-0">
                <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5 block">Documento</label>
                {documentoPreview ? (
                  <div className="flex items-center gap-2">
                    <PenLine size={14} className="text-texto-terciario flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-texto-primario">{documentoPreview.numero}</p>
                      <p className="text-xxs truncate text-texto-terciario">{documentoPreview.estado} · {documentoPreview.contacto_nombre || ''}</p>
                    </div>
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      onClick={() => { setDocumentoPreview(null) }}
                      className="flex-shrink-0 text-xxs"
                    >
                      Cambiar
                    </Boton>
                  </div>
                ) : (
                  <BuscadorDocumentoPreview
                    contactoId={contactoPreview ? String(contactoPreview.id || '') : null}
                    onSeleccionar={seleccionarDocumentoPreview}
                  />
                )}
              </div>
            </div>

            {/* Vista previa renderizada */}
            <PrevisualizacionPlantilla
              asunto={asunto}
              contenidoHtml={contenidoHtml}
              contactoPreview={contactoPreview}
              documentoPreview={documentoPreview}
              resolverPreview={resolverPreview}
            />
          </div>
        )}

        {/* ═══════════ CONFIG AVANZADA (colapsable) — debajo del contenido ═══════════ */}
        {tabActivo !== 'preview' && (
          <div className="mt-3 border-t border-white/[0.07] pt-3 shrink-0">
            <button
              type="button"
              onClick={() => setConfigAbierta(!configAbierta)}
              className="flex items-center gap-2 w-full text-left group cursor-pointer"
            >
              <ChevronRight
                size={14}
                className={`text-texto-terciario transition-transform ${configAbierta ? 'rotate-90' : ''}`}
              />
              <Settings2 size={14} className="text-texto-terciario" />
              <span className="text-xs font-medium text-texto-secundario">Configuración avanzada</span>
              {resumenConfig && !configAbierta && (
                <span className="text-xxs text-texto-terciario ml-1">— {resumenConfig}</span>
              )}
            </button>

            {configAbierta && (
              <div className="mt-3 space-y-3 pl-7">
                {/* Visibilidad */}
                <Select
                  etiqueta="Quién la puede usar"
                  opciones={OPCIONES_VISIBILIDAD.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
                  valor={visibilidad}
                  onChange={setVisibilidad}
                />

                {/* Selector de usuarios (si visibilidad = usuarios) */}
                {visibilidad === 'usuarios' && (
                  <div>
                    <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5 block">
                      Usuarios asignados ({usuariosSeleccionados.length})
                    </label>
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-white/[0.06]">
                      {usuariosEmpresa.length > 0 ? usuariosEmpresa.map(u => {
                        const seleccionado = usuariosSeleccionados.includes(u.id)
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.04] ${seleccionado ? 'bg-texto-marca/8' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionado}
                              onChange={() => setUsuariosSeleccionados(prev =>
                                seleccionado ? prev.filter(id => id !== u.id) : [...prev, u.id]
                              )}
                              className="rounded accent-texto-marca"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-texto-primario">{u.nombre}</p>
                              <p className="text-xxs truncate text-texto-terciario">{u.correo}</p>
                            </div>
                          </label>
                        )
                      }) : (
                        <p className="px-3 py-3 text-xs text-center text-texto-terciario">Cargando usuarios...</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Disponible para (módulos) */}
                <div>
                  <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5 block">Disponible para</label>
                  <div className="flex flex-wrap gap-1.5">
                    {OPCIONES_DISPONIBLE.filter(o => o.valor !== 'todos').map(o => {
                      const activo = modulos.includes(o.valor)
                      return (
                        <button
                          type="button"
                          key={o.valor}
                          className={`text-xs px-2.5 py-1 rounded-md cursor-pointer transition-all select-none border ${
                            activo
                              ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                              : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario hover:border-white/[0.12] hover:text-texto-secundario'
                          }`}
                          onClick={() => setModulos(prev => activo ? prev.filter(m => m !== o.valor) : [...prev, o.valor])}
                        >
                          {o.etiqueta}
                        </button>
                      )
                    })}
                  </div>
                  {modulos.length === 0 && (
                    <p className="text-[11px] text-texto-terciario mt-1">Sin selección = disponible en todos los módulos</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Modal>
  )
}
