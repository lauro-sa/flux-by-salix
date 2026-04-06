'use client'

/**
 * ModalEditorPlantillaCorreo — Editor completo de plantillas de correo.
 * Componente orquestador que delega en sub-componentes y hook de logica.
 * Incluye: nombre, asunto con variables, disponible para (modulo), visibilidad,
 * editor rico con variables integradas, vista previa con datos reales.
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
import { Braces, Eye, Save, Code2, PenLine, Maximize2, Minimize2 } from 'lucide-react'
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

  const estado = useEditorPlantilla({ abierto, plantilla, onGuardado, onCerrar })

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

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? `Editar plantilla — ${nombre || plantilla?.nombre || ''}` : 'Nueva plantilla'}
      tamano="4xl"
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
          <Boton variante="primario" tamano="sm" icono={<Save size={14} />} cargando={guardando} onClick={handleGuardar}>
            {esEdicion ? 'Guardar cambios' : 'Crear plantilla'}
          </Boton>
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
        </>
      }
    >
      {/* ── Selector de contacto + documento (siempre visible arriba) ── */}
      <div className="px-6 pt-3 pb-2 flex items-start gap-4" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
        {/* Contacto */}
        <div className="flex-1 min-w-0">
          <label className="text-xxs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--texto-terciario)' }}>Contacto</label>
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
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                    {`${contactoPreview.nombre || ''} ${contactoPreview.apellido || ''}`.trim()}
                  </p>
                  {typeof contactoPreview.correo === 'string' && contactoPreview.correo && (
                    <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>{contactoPreview.correo}</p>
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
                  <span className="text-xxs flex-shrink-0" style={{ color: 'var(--texto-terciario)' }}>vía documento</span>
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
        <div className="flex-1 min-w-0">
          <label className="text-xxs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--texto-terciario)' }}>Documento</label>
          {documentoPreview ? (
            <div className="flex items-center gap-2">
              <PenLine size={14} style={{ color: 'var(--texto-terciario)' }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--texto-primario)' }}>{documentoPreview.numero}</p>
                <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>{documentoPreview.estado} · {documentoPreview.contacto_nombre || ''}</p>
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

      {/* ── Tabs: Editar / Código / Vista previa ── */}
      <div className="px-6 pt-1 pb-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
        <Tabs tabs={TABS_EDITOR} activo={tabActivo} onChange={handleCambiarTab} />
      </div>

      <div className="px-6 py-4 flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* ═══════════ TAB EDITAR (visual) — se oculta con display:none para no desmontar el editor ═══════════ */}
        <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-y-auto" style={{ display: tabActivo === 'editar' ? undefined : 'none' }}>
            {/* Fila 1: Nombre + Quién la puede usar */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                etiqueta="Nombre *"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Envío presupuesto, Seguimiento factura..."
              />
              <Select
                etiqueta="Quién la puede usar"
                opciones={OPCIONES_VISIBILIDAD.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
                valor={visibilidad}
                onChange={setVisibilidad}
              />
            </div>

            {/* Fila 2: Disponible para (chips sin padding izquierdo) */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>Disponible para</label>
              <div className="flex flex-wrap gap-1.5">
                {OPCIONES_DISPONIBLE.filter(o => o.valor !== 'todos').map(o => {
                  const activo = modulos.includes(o.valor)
                  return (
                    <button
                      type="button"
                      key={o.valor}
                      className="text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors select-none"
                      style={{
                        border: `1px solid ${activo ? 'var(--texto-marca)' : 'var(--borde-sutil)'}`,
                        background: activo ? 'var(--insignia-primario-fondo)' : 'transparent',
                        color: activo ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                      }}
                      onClick={() => setModulos(prev => activo ? prev.filter(m => m !== o.valor) : [...prev, o.valor])}
                    >
                      {o.etiqueta}
                    </button>
                  )
                })}
              </div>
              {modulos.length === 0 && (
                <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>Sin selección = disponible en todos los módulos</p>
              )}
            </div>

            {/* Fila 3: Asunto completo */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>Asunto</label>
              <AsuntoConVariables
                valor={asunto}
                onChange={setAsunto}
                placeholder="Ej: Presupuesto {{presupuesto.numero}} — {{contacto.nombre_completo}}"
                contexto={contextoVariables}
                variablesAbierto={variablesAsuntoAbierto}
                onToggleVariables={() => setVariablesAsuntoAbierto(!variablesAsuntoAbierto)}
                onCerrarVariables={() => setVariablesAsuntoAbierto(false)}
                onInsertarVariable={insertarVariableAsunto}
              />
            </div>

            {/* Selector de usuarios (si visibilidad = usuarios) */}
            {visibilidad === 'usuarios' && (
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
                  Usuarios asignados ({usuariosSeleccionados.length})
                </label>
                <div className="max-h-36 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--borde-sutil)' }}>
                  {usuariosEmpresa.length > 0 ? usuariosEmpresa.map(u => {
                    const seleccionado = usuariosSeleccionados.includes(u.id)
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--superficie-hover)]"
                        style={seleccionado ? { background: 'var(--insignia-primario-fondo)' } : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          onChange={() => setUsuariosSeleccionados(prev =>
                            seleccionado ? prev.filter(id => id !== u.id) : [...prev, u.id]
                          )}
                          className="rounded"
                          style={{ accentColor: 'var(--texto-marca)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--texto-primario)' }}>{u.nombre}</p>
                          <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>{u.correo}</p>
                        </div>
                      </label>
                    )
                  }) : (
                    <p className="px-3 py-3 text-xs text-center" style={{ color: 'var(--texto-terciario)' }}>Cargando usuarios...</p>
                  )}
                </div>
              </div>
            )}

            {/* Contenido visual — ocupa todo el espacio restante */}
            <div className="flex-1 min-h-0 flex flex-col">
              <label className="text-xs font-medium mb-1.5 block shrink-0" style={{ color: 'var(--texto-secundario)' }}>Contenido</label>
              <EditorTexto
                contenido={esEdicion ? contenidoHtml : ''}
                onChange={setContenidoHtml}
                placeholder="Hola {{contacto.nombre}}, adjuntamos el presupuesto..."
                alturaMinima={180}
                habilitarVariables
                onEditorListo={(editor) => { editorRef.current = editor; setEditorListo(true) }}
                className="flex-1"
              />
            </div>
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
          <EditorCodigoHtml
            nombre={nombre}
            onNombreChange={setNombre}
            asunto={asunto}
            onAsuntoChange={setAsunto}
            visibilidad={visibilidad}
            onVisibilidadChange={setVisibilidad}
            htmlCrudo={htmlCrudo}
            onHtmlCrudoChange={setHtmlCrudo}
            variablesHtmlAbierto={variablesHtmlAbierto}
            onToggleVariablesHtml={() => setVariablesHtmlAbierto(!variablesHtmlAbierto)}
            onCerrarVariablesHtml={() => setVariablesHtmlAbierto(false)}
            onInsertarVariableHtml={insertarVariableHtml}
            contextoVariables={contextoVariables}
          />
        )}

        {/* ═══════════ TAB VISTA PREVIA ═══════════ */}
        {tabActivo === 'preview' && (
          <PrevisualizacionPlantilla
            asunto={asunto}
            contenidoHtml={contenidoHtml}
            contactoPreview={contactoPreview}
            documentoPreview={documentoPreview}
            resolverPreview={resolverPreview}
          />
        )}

      </div>
    </Modal>
  )
}
