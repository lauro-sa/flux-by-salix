'use client'

/**
 * PaginaEditorPlantilla — Versión pantalla completa del editor de plantillas de correo.
 * Se usa en: /inbox/configuracion/plantillas-correo/[id] y /nueva.
 * A diferencia del modal, aprovecha el ancho completo: panel de config a la izquierda
 * + área principal con tabs (Editar/Código) a la derecha. Vista previa es un modal aparte.
 */

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { PlantillaEditor } from '@/componentes/entidad/PlantillaEditor'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Tabs } from '@/componentes/ui/Tabs'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Braces, Eye, Code2, PenLine, RotateCcw, Save } from 'lucide-react'
import { useToast } from '@/componentes/feedback/Toast'
import { useCambiosSinGuardar } from '@/hooks/useCambiosPendientes'

import { useEditorPlantilla } from './useEditorPlantilla'
import { OPCIONES_DISPONIBLE, OPCIONES_VISIBILIDAD } from './constantes'
import { iniciales, colorAvatar } from './utilidades'
import { BuscadorContactoPreview } from './BuscadorContactoPreview'
import { BuscadorDocumentoPreview } from './BuscadorDocumentoPreview'
import { AsuntoConVariables } from './AsuntoConVariables'
import { PrevisualizacionPlantilla } from './PrevisualizacionPlantilla'
import { EditorCodigoHtml } from './EditorCodigoHtml'
import type { PlantillaRespuesta } from '@/tipos/inbox'

interface Props {
  /** Plantilla a editar (null = crear nueva) */
  plantilla: PlantillaRespuesta | null
  /** Ruta a la que volver (listado) */
  rutaVolver: string
  /** Texto del botón volver */
  textoVolver?: string
}

const TABS_EDITOR = [
  { clave: 'editar', etiqueta: 'Editar', icono: <PenLine size={14} /> },
  { clave: 'codigo', etiqueta: 'Código', icono: <Code2 size={14} /> },
]

export function PaginaEditorPlantilla({ plantilla, rutaVolver, textoVolver = 'Plantillas' }: Props) {
  const router = useRouter()
  const { mostrar } = useToast()
  const [previewAbierto, setPreviewAbierto] = useState(false)
  const [restaurando, setRestaurando] = useState(false)

  // ─── Estado del editor ───
  const estado = useEditorPlantilla({
    abierto: true,
    plantilla,
    onGuardado: () => router.push(rutaVolver),
    onCerrar: () => router.push(rutaVolver),
  })

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

  // ─── Detección de cambios sin guardar ───
  // Compara cada campo del form con la plantilla original (o valor vacío si es "nueva").
  const cambiosPendientes = useMemo(() => {
    const diffs: { campo: string; valor?: string }[] = []
    const origNombre = plantilla?.nombre || ''
    const origAsunto = plantilla?.asunto || ''
    const origContenido = plantilla?.contenido_html || plantilla?.contenido || ''
    const origModulos = JSON.stringify((plantilla?.modulos || []).slice().sort())
    const origVisibilidad = plantilla?.disponible_para || 'todos'
    const origUsuarios = JSON.stringify((plantilla?.usuarios_permitidos || []).slice().sort())
    if (nombre !== origNombre) diffs.push({ campo: 'Nombre', valor: nombre || '(vacío)' })
    if (asunto !== origAsunto) diffs.push({ campo: 'Asunto' })
    if (contenidoHtml !== origContenido) diffs.push({ campo: 'Contenido HTML' })
    if (JSON.stringify(modulos.slice().sort()) !== origModulos) diffs.push({ campo: 'Módulos disponibles' })
    if (visibilidad !== origVisibilidad) diffs.push({ campo: 'Visibilidad', valor: visibilidad })
    if (JSON.stringify(usuariosSeleccionados.slice().sort()) !== origUsuarios) diffs.push({ campo: 'Usuarios asignados' })
    return diffs
  }, [plantilla, nombre, asunto, contenidoHtml, modulos, visibilidad, usuariosSeleccionados])

  useCambiosSinGuardar({
    id: `plantilla-correo-${plantilla?.id || 'nueva'}`,
    dirty: cambiosPendientes.length > 0,
    titulo: esEdicion ? `Plantilla: ${plantilla?.nombre || 'sin nombre'}` : 'Nueva plantilla de correo',
    cambios: cambiosPendientes,
    onGuardar: async () => { await handleGuardar() },
  })

  // ─── Plantilla de sistema: verificar si fue modificada ───
  const esSistema = plantilla?.es_sistema ?? false
  const fueModificada = esSistema && plantilla?.contenido_original_html && plantilla?.asunto_original
    ? (plantilla.contenido_html !== plantilla.contenido_original_html || plantilla.asunto !== plantilla.asunto_original)
    : false

  const handleRestaurar = async () => {
    if (!plantilla?.id) return
    setRestaurando(true)
    try {
      await fetch(`/api/correo/plantillas/${plantilla.id}/restaurar`, { method: 'POST' })
      mostrar('exito', 'Plantilla restaurada al original')
      router.push(rutaVolver)
    } catch {
      mostrar('error', 'Error al restaurar')
    } finally { setRestaurando(false) }
  }

  // ─── Insignias del título ───
  const insignias = (
    <div className="flex items-center gap-1.5">
      {esSistema && (
        <span className="text-xxs px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-texto-terciario">
          Sistema
        </span>
      )}
      {fueModificada && (
        <span className="text-xxs px-2 py-0.5 rounded-full bg-insignia-advertencia/15 border border-insignia-advertencia/30 text-insignia-advertencia">
          Modificada
        </span>
      )}
    </div>
  )

  // ─── Acciones del cabecero ───
  const acciones = [
    ...(esSistema ? [{
      id: 'restaurar',
      etiqueta: 'Restaurar original',
      icono: <RotateCcw size={14} />,
      onClick: handleRestaurar,
      variante: 'secundario' as const,
      cargando: restaurando,
      deshabilitado: !fueModificada,
      alineadoIzquierda: true,
    }] : []),
    {
      id: 'preview',
      etiqueta: 'Vista previa',
      icono: <Eye size={14} />,
      onClick: () => setPreviewAbierto(true),
      variante: 'secundario' as const,
    },
    {
      id: 'guardar',
      etiqueta: esEdicion ? 'Guardar' : 'Crear plantilla',
      icono: <Save size={14} />,
      onClick: handleGuardar,
      variante: 'primario' as const,
      cargando: guardando,
    },
  ]

  // ─── Panel lateral de configuración ───
  const panelConfig = (
    <div className="space-y-5">
      {/* Visibilidad */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Quién la puede usar
        </label>
        <Select
          opciones={OPCIONES_VISIBILIDAD.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
          valor={visibilidad}
          onChange={setVisibilidad}
        />
      </div>

      {/* Selector de usuarios */}
      {visibilidad === 'usuarios' && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
            Usuarios asignados ({usuariosSeleccionados.length})
          </label>
          <div className="max-h-48 overflow-y-auto rounded-card border border-white/[0.06]">
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
              <p className="px-3 py-3 text-xs text-center text-texto-terciario">Cargando...</p>
            )}
          </div>
        </div>
      )}

      {/* Disponible para (módulos) */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Disponible para
        </label>
        <div className="flex flex-wrap gap-1.5">
          {OPCIONES_DISPONIBLE.filter(o => o.valor !== 'todos').map(o => {
            const activo = modulos.includes(o.valor)
            return (
              <button
                type="button"
                key={o.valor}
                className={`text-xs px-2.5 py-1 rounded-boton cursor-pointer transition-all select-none border ${
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
          <p className="text-[11px] text-texto-terciario">Sin selección = disponible en todos los módulos</p>
        )}
      </div>
    </div>
  )

  return (
    <>
      <PlantillaEditor
        titulo={esEdicion ? (nombre || plantilla?.nombre || 'Editar plantilla') : 'Nueva plantilla'}
        subtitulo={esEdicion ? 'Plantilla de correo' : 'Configurá una nueva plantilla de correo'}
        insignias={insignias}
        volverTexto={textoVolver}
        onVolver={() => router.push(rutaVolver)}
        acciones={acciones}
        panelConfig={panelConfig}
      >
        {/* ═══ IDENTIDAD: Nombre + Asunto ═══ */}
        <div className="space-y-3 pb-4 border-b border-borde-sutil">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la plantilla"
            className="!text-base !font-semibold"
          />
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

        {/* ═══ TABS: Editar / Código ═══ */}
        <div className="pt-3">
          <Tabs tabs={TABS_EDITOR} activo={tabActivo} onChange={handleCambiarTab} />
        </div>

        {/* ═══ TAB EDITAR (visual) ═══ */}
        <div
          className="flex flex-col flex-1 min-h-0 mt-4"
          style={{ display: tabActivo === 'editar' ? undefined : 'none' }}
        >
          <EditorTexto
            contenido={esEdicion ? contenidoHtml : ''}
            onChange={setContenidoHtml}
            placeholder="Escribí el contenido del correo... Usá {{ }} para insertar variables."
            alturaMinima={400}
            habilitarVariables
            onEditorListo={(editor) => { editorRef.current = editor; setEditorListo(true) }}
            className="flex-1"
          />
        </div>

        {/* Botón {} flotante siguiendo al cursor del editor */}
        {tabActivo === 'editar' && cursorEditorPos && !variablesCuerpoAbierto && typeof window !== 'undefined' && createPortal(
          <div
            className="fixed pointer-events-auto"
            style={{ top: cursorEditorPos.top - 3, left: cursorEditorPos.left + 24, zIndex: 99999 }}
          >
            <Tooltip contenido="Insertar variable">
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setVariablesCuerpoAbierto(true) }}
                className="flex items-center justify-center size-6 rounded-boton transition-all hover:bg-white/[0.06] hover:opacity-100 text-texto-terciario opacity-35"
                type="button"
              >
                <Braces size={13} />
              </button>
            </Tooltip>
          </div>,
          document.body,
        )}

        {/* Selector de variables del cuerpo */}
        {typeof window !== 'undefined' && createPortal(
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
          document.body,
        )}

        {/* ═══ TAB CÓDIGO ═══ */}
        {tabActivo === 'codigo' && (
          <div className="flex flex-col mt-4">
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
      </PlantillaEditor>

      {/* ═══ MODAL VISTA PREVIA ═══ */}
      <Modal
        abierto={previewAbierto}
        onCerrar={() => setPreviewAbierto(false)}
        titulo="Vista previa"
        tamano="3xl"
        acciones={
          <>
            <Boton variante="fantasma" tamano="sm" onClick={() => setPreviewAbierto(false)}>Cerrar</Boton>
          </>
        }
      >
        <div className="space-y-4">
          {/* Selectores de contexto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-card bg-white/[0.02] border border-white/[0.07]">
            <div className="min-w-0">
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5 block">
                Registro de prueba
              </label>
              {contactoPreview ? (
                <div className="flex items-center gap-2">
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
                    <Boton variante="fantasma" tamano="xs" onClick={() => setContactoPreview(null)} className="flex-shrink-0 text-xxs">
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

            <div className="min-w-0">
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5 block">
                Documento
              </label>
              {documentoPreview ? (
                <div className="flex items-center gap-2">
                  <PenLine size={14} className="text-texto-terciario flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-texto-primario">{documentoPreview.numero}</p>
                    <p className="text-xxs truncate text-texto-terciario">{documentoPreview.estado} · {documentoPreview.contacto_nombre || ''}</p>
                  </div>
                  <Boton variante="fantasma" tamano="xs" onClick={() => setDocumentoPreview(null)} className="flex-shrink-0 text-xxs">
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
      </Modal>
    </>
  )
}
