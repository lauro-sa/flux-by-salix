'use client'

/**
 * ModalEditorPlantillaCorreo — Editor completo de plantillas de correo.
 * Componente orquestador que delega en sub-componentes y hook de logica.
 * Incluye: nombre, asunto con variables, disponible para (modulo), visibilidad,
 * editor rico con variables integradas, vista previa con datos reales.
 * Se usa en: inbox/configuracion (SeccionPlantillas).
 */

import { createPortal } from 'react-dom'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Tabs } from '@/componentes/ui/Tabs'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'
import { Braces, Eye, Save, Code2, PenLine } from 'lucide-react'
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
                  <button
                    onClick={() => setContactoPreview(null)}
                    className="text-xxs px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--superficie-hover)] flex-shrink-0"
                    style={{ color: 'var(--texto-terciario)' }}
                    type="button"
                  >
                    Cambiar
                  </button>
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
              <button
                onClick={() => { setDocumentoPreview(null) }}
                className="text-xxs px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--superficie-hover)] flex-shrink-0"
                style={{ color: 'var(--texto-terciario)' }}
                type="button"
              >
                Cambiar
              </button>
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

      <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: '60vh' }}>

        {/* ═══════════ TAB EDITAR (visual) — se oculta con display:none para no desmontar el editor ═══════════ */}
        <div className="space-y-5" style={{ display: tabActivo === 'editar' ? undefined : 'none' }}>
            {/* Nombre */}
            <Input
              etiqueta="Nombre *"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Envío presupuesto, Seguimiento factura..."
            />

            {/* Asunto con variables resueltas inline */}
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

            {/* Disponible para (checkboxes multiples) + Visibilidad */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>Disponible para</label>
                <div className="flex flex-wrap gap-2">
                  {OPCIONES_DISPONIBLE.filter(o => o.valor !== 'todos').map(o => {
                    const activo = modulos.includes(o.valor)
                    return (
                      <label
                        key={o.valor}
                        className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full cursor-pointer transition-colors select-none"
                        style={{
                          border: `1px solid ${activo ? 'var(--texto-marca)' : 'var(--borde-sutil)'}`,
                          background: activo ? 'var(--insignia-primario-fondo)' : undefined,
                          color: activo ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={() => setModulos(prev => activo ? prev.filter(m => m !== o.valor) : [...prev, o.valor])}
                          className="sr-only"
                        />
                        {o.etiqueta}
                      </label>
                    )
                  })}
                </div>
                {modulos.length === 0 && (
                  <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>Sin selección = disponible en todos los módulos</p>
                )}
              </div>
              <Select
                etiqueta="Quién la puede usar"
                opciones={OPCIONES_VISIBILIDAD.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
                valor={visibilidad}
                onChange={setVisibilidad}
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

            {/* Contenido visual */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>Contenido</label>
              <EditorTexto
                contenido={esEdicion ? contenidoHtml : ''}
                onChange={setContenidoHtml}
                placeholder="Hola {{contacto.nombre}}, adjuntamos el presupuesto..."
                alturaMinima={220}
                habilitarVariables
                onEditorListo={(editor) => { editorRef.current = editor; setEditorListo(true) }}
              />
            </div>
          </div>

        {/* Boton { } flotante que sigue al cursor del editor */}
        {abierto && tabActivo === 'editar' && cursorEditorPos && !variablesCuerpoAbierto && typeof window !== 'undefined' && createPortal(
          <div
            className="fixed pointer-events-auto"
            style={{ top: cursorEditorPos.top - 3, left: cursorEditorPos.left + 24, zIndex: 99999 }}
          >
            <button
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setVariablesCuerpoAbierto(true) }}
              className="flex items-center justify-center size-6 rounded-md transition-all hover:bg-[var(--superficie-hover)] hover:opacity-100"
              style={{ color: 'var(--texto-terciario)', opacity: 0.35 }}
              type="button"
              title="Insertar variable"
            >
              <Braces size={13} />
            </button>
          </div>,
          document.body
        )}

        {/* SelectorVariables del cuerpo (siempre montado para el portal) */}
        <div className="relative">
          <SelectorVariables
            abierto={variablesCuerpoAbierto}
            onCerrar={() => setVariablesCuerpoAbierto(false)}
            onSeleccionar={insertarVariableCuerpo}
            posicion="abajo"
            contexto={contextoVariables}
          />
        </div>

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
