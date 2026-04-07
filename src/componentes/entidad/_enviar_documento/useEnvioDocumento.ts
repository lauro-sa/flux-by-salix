'use client'

/**
 * useEnvioDocumento — Hook que encapsula todo el estado y la lógica del modal de envío.
 * Maneja: formulario (canal, destinatarios, asunto, html), adjuntos, plantillas,
 * variables, borrador, snapshot para deshacer, drag & drop, cursor del editor.
 * Se usa en: ModalEnviarDocumento.tsx
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { crearNodoVariable } from '@/componentes/ui/ExtensionVariableChip'
import { resolverVariables as resolverVariablesLib, formatearVariable, revertirVariablesEnPlantilla } from '@/lib/variables/resolver'
import type {
  CanalCorreoEmpresa,
  PlantillaCorreo,
  AdjuntoDocumento,
  DatosEnvioDocumento,
  DatosBorradorCorreo,
  DatosPlantillaCorreo,
  SnapshotCorreo,
} from './tipos'

interface ParametrosHook {
  abierto: boolean
  canales: CanalCorreoEmpresa[]
  plantillas: PlantillaCorreo[]
  correosDestinatario: string[]
  asuntoPredeterminado: string
  htmlInicial: string
  adjuntoDocumento?: AdjuntoDocumento | null
  urlPortal?: string | null
  enviando: boolean
  contextoVariables?: Record<string, Record<string, unknown>>
  snapshotRestaurar?: SnapshotCorreo | null
  plantillaPredeterminadaId?: string | null
  pdfDesactivadoInicial?: boolean
  portalDesactivadoInicial?: boolean
  onEnviar: (datos: DatosEnvioDocumento) => void | Promise<void>
  onGuardarBorrador?: (datos: DatosBorradorCorreo) => void | Promise<void>
  onGuardarPlantilla?: (datos: DatosPlantillaCorreo) => void | Promise<void>
}

export function useEnvioDocumento({
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
}: ParametrosHook) {
  // ─── Estado del formulario ───
  const canalPredeterminado = canales.find(c => c.predeterminado) || canales[0]
  const [canalId, setCanalId] = useState(canalPredeterminado?.id || '')
  const [para, setPara] = useState<string[]>(correosDestinatario)
  const [cc, setCC] = useState<string[]>([])
  const [cco, setCCO] = useState<string[]>([])
  const [mostrarCC, setMostrarCC] = useState(false)
  const [mostrarCCO, setMostrarCCO] = useState(false)
  const [asunto, setAsunto] = useState(asuntoPredeterminado)
  const [html, setHtml] = useState(htmlInicial)
  const [plantillaId, setPlantillaId] = useState('')

  // Adjuntos
  const [adjuntos, setAdjuntos] = useState<AdjuntoDocumento[]>([])
  const [incluirPdf, setIncluirPdf] = useState(!pdfDesactivadoInicial)
  const [incluirEnlacePortal, setIncluirEnlacePortal] = useState(!portalDesactivadoInicial && !!urlPortal)
  const [subiendoAdjuntos, setSubiendoAdjuntos] = useState(false)
  const inputArchivosRef = useRef<HTMLInputElement>(null)

  // Programar
  const [mostrarProgramar, setMostrarProgramar] = useState(false)

  // Cursor del editor — para el { } flotante
  const [cursorEditorPos, setCursorEditorPos] = useState<{ top: number; left: number } | null>(null)
  const editorConFoco = useRef(false)
  const [editorListo, setEditorListo] = useState(false)

  // Dropdown de canal
  const [mostrarCanales, setMostrarCanales] = useState(false)

  // Variables
  const [variablesAsuntoAbierto, setVariablesAsuntoAbierto] = useState(false)
  const [variablesCuerpoAbierto, setVariablesCuerpoAbierto] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  const asuntoInputRef = useRef<HTMLInputElement>(null)

  // Guardar como plantilla
  const [mostrarGuardarPlantilla, setMostrarGuardarPlantilla] = useState(false)
  const [nombrePlantilla, setNombrePlantilla] = useState('')

  // Drag & drop
  const [arrastrando, setArrastrando] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // ─── Resetear estado al abrir — si hay snapshot (deshacer envío), restaurar todo ───
  useEffect(() => {
    if (abierto) {
      if (snapshotRestaurar) {
        setCanalId(snapshotRestaurar.canal_id)
        setPara(snapshotRestaurar.para)
        setCC(snapshotRestaurar.cc)
        setCCO(snapshotRestaurar.cco)
        setMostrarCC(snapshotRestaurar.mostrarCC)
        setMostrarCCO(snapshotRestaurar.mostrarCCO)
        setAsunto(snapshotRestaurar.asunto)
        setHtml(snapshotRestaurar.html)
        setPlantillaId(snapshotRestaurar.plantilla_id)
        setAdjuntos(snapshotRestaurar.adjuntos)
        setIncluirPdf(snapshotRestaurar.incluir_pdf)
        setIncluirEnlacePortal(snapshotRestaurar.incluir_enlace_portal)
      } else {
        const canalDef = canales.find(c => c.predeterminado) || canales[0]
        setCanalId(canalDef?.id || '')
        setPara(correosDestinatario)
        setCC([])
        setCCO([])
        setMostrarCC(false)
        setMostrarCCO(false)
        setAsunto(asuntoPredeterminado)
        setHtml(htmlInicial)
        setPlantillaId('')
        setAdjuntos([])
        setIncluirPdf(pdfDesactivadoInicial ? false : !!adjuntoDocumento)
        setIncluirEnlacePortal(portalDesactivadoInicial ? false : !!urlPortal)
      }
      setMostrarProgramar(false)
      setMostrarCanales(false)
      setCursorEditorPos(null)
      editorConFoco.current = false
      setEditorListo(false)
    } else {
      setCursorEditorPos(null)
      editorConFoco.current = false
    }
  }, [abierto])

  const canalActivo = canales.find(c => c.id === canalId) || canales[0]

  // ─── Resolver variables {{entidad.campo}} con datos reales del contexto ───
  // Usa el resolver oficial que formatea moneda, fechas, porcentajes, etc.
  // También actualiza spans de variable existentes (<span data-variable="...">valorViejo</span>)
  const resolverVariables = useCallback((texto: string): string => {
    if (!contextoVariables || !texto) return texto
    // 1. Resolver {{entidad.campo}} → valor formateado
    let resultado = resolverVariablesLib(texto, contextoVariables)
    // 2. Actualizar spans de variable con valores frescos del contexto
    const moneda = (contextoVariables.presupuesto?.moneda || contextoVariables.empresa?.moneda || 'ARS') as string
    resultado = resultado.replace(
      /<span[^>]*data-variable="([a-z_]+)\.([a-z_]+)"[^>]*>[^<]*<\/span>/g,
      (_match, entidad: string, campo: string) => {
        const valor = contextoVariables[entidad]?.[campo]
        const formateado = (valor !== undefined && valor !== null && valor !== '')
          ? formatearVariable(entidad, campo, valor, moneda)
          : `{{${entidad}.${campo}}}`
        return `<span data-variable="${entidad}.${campo}" class="variable-resaltada" title="{{${entidad}.${campo}}}" contenteditable="false">${formateado}</span>`
      }
    )
    return resultado
  }, [contextoVariables])

  // ─── Snapshot del contenido resuelto al aplicar plantilla (para detectar cambios) ───
  const [plantillaAsuntoOriginal, setPlantillaAsuntoOriginal] = useState('')
  const [plantillaHtmlOriginal, setPlantillaHtmlOriginal] = useState('')

  // ─── Auto-aplicar plantilla predeterminada al abrir ───
  const predeterminadaAplicadaRef = useRef(false)
  useEffect(() => {
    if (!abierto) { predeterminadaAplicadaRef.current = false; return }
    if (snapshotRestaurar || predeterminadaAplicadaRef.current) return
    if (!editorListo || !plantillaPredeterminadaId) return
    const pl = plantillas.find(p => p.id === plantillaPredeterminadaId)
    if (!pl) return
    predeterminadaAplicadaRef.current = true
    setPlantillaId(pl.id)
    const asuntoResuelto = pl.asunto ? resolverVariables(pl.asunto) : ''
    const htmlResuelto = pl.contenido_html ? resolverVariables(pl.contenido_html) : ''
    setAsunto(asuntoResuelto || asuntoPredeterminado)
    const htmlFinal = htmlResuelto || ''
    setHtml(htmlFinal)
    setPlantillaAsuntoOriginal(asuntoResuelto || asuntoPredeterminado)
    setPlantillaHtmlOriginal(htmlFinal)
    if (pl.canal_id) setCanalId(pl.canal_id)
    // Inyectar al editor — reintentar hasta que TipTap esté completamente funcional
    const inyectar = (intentos = 0) => {
      const editor = editorRef.current
      if (editor && !editor.isDestroyed) {
        editor.commands.setContent(htmlFinal)
      } else if (intentos < 5) {
        setTimeout(() => inyectar(intentos + 1), 100)
      }
    }
    setTimeout(() => inyectar(), 50)
  }, [abierto, editorListo, plantillaPredeterminadaId, plantillas, snapshotRestaurar, resolverVariables, asuntoPredeterminado])

  // ─── Aplicar plantilla ───
  const aplicarPlantilla = useCallback((id: string) => {
    setPlantillaId(id)
    const pl = plantillas.find(p => p.id === id)
    if (pl) {
      const asuntoResuelto = pl.asunto ? resolverVariables(pl.asunto) : ''
      const htmlResuelto = pl.contenido_html ? resolverVariables(pl.contenido_html) : ''
      setAsunto(asuntoResuelto || asuntoPredeterminado)
      const htmlFinal = htmlResuelto || ''
      setHtml(htmlFinal)
      const editor = editorRef.current
      if (editor) editor.commands.setContent(htmlFinal)
      setPlantillaAsuntoOriginal(asuntoResuelto || asuntoPredeterminado)
      setPlantillaHtmlOriginal(htmlFinal)
      if (pl.canal_id) setCanalId(pl.canal_id)
    }
  }, [plantillas, resolverVariables, asuntoPredeterminado])

  // ─── Limpiar plantilla ───
  const limpiarPlantilla = useCallback(() => {
    setPlantillaId('')
    setAsunto(asuntoPredeterminado)
    setHtml(htmlInicial)
    setPlantillaAsuntoOriginal('')
    setPlantillaHtmlOriginal('')
    const editor = editorRef.current
    if (editor) editor.commands.setContent(htmlInicial)
  }, [asuntoPredeterminado, htmlInicial])

  // ─── Insertar variable en asunto ───
  const insertarVariableAsunto = useCallback((variable: string) => {
    const input = asuntoInputRef.current
    if (input) {
      const inicio = input.selectionStart ?? asunto.length
      const fin = input.selectionEnd ?? asunto.length
      const nuevo = asunto.slice(0, inicio) + variable + asunto.slice(fin)
      setAsunto(nuevo)
      requestAnimationFrame(() => {
        input.focus()
        const pos = inicio + variable.length
        input.setSelectionRange(pos, pos)
      })
    } else {
      setAsunto(prev => prev + variable)
    }
    setVariablesAsuntoAbierto(false)
  }, [asunto])

  // ─── Insertar variable en el cuerpo (editor TipTap) ───
  const insertarVariableCuerpo = useCallback((variable: string) => {
    const editor = editorRef.current
    if (!editor) return
    const match = variable.match(/^\{\{(\w+)\.(\w+)\}\}$/)
    if (match) {
      const [, entidad, campo] = match
      const preview = contextoVariables?.[entidad]?.[campo]
      const moneda = (contextoVariables?.presupuesto?.moneda || contextoVariables?.empresa?.moneda || 'ARS') as string
      const valorPreview = (preview !== undefined && preview !== null && preview !== '') ? formatearVariable(entidad, campo, preview, moneda) : ''
      editor.chain().focus().insertContent(crearNodoVariable(entidad, campo, valorPreview)).run()
    } else {
      editor.chain().focus().insertContent(variable).run()
    }
    setVariablesCuerpoAbierto(false)
  }, [contextoVariables])

  // ─── Guardar como borrador ───
  const handleGuardarBorrador = useCallback(() => {
    if (!onGuardarBorrador) return
    onGuardarBorrador({
      canal_id: canalId,
      correo_para: para,
      correo_cc: cc,
      correo_cco: cco,
      asunto,
      html,
      adjuntos_ids: adjuntos.map(a => a.id),
      incluir_enlace_portal: incluirEnlacePortal,
    })
  }, [onGuardarBorrador, canalId, para, cc, cco, asunto, html, adjuntos, incluirEnlacePortal])

  // ─── Revertir valores resueltos a variables {{entidad.campo}} para guardar plantillas ───
  const revertirVariables = useCallback((texto: string): string => {
    return revertirVariablesEnPlantilla(texto, contextoVariables || {})
  }, [contextoVariables])

  // ─── Guardar como plantilla ───
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false)
  const [plantillaGuardadaOk, setPlantillaGuardadaOk] = useState(false)
  const handleGuardarPlantilla = useCallback(async () => {
    if (!onGuardarPlantilla || !nombrePlantilla.trim() || guardandoPlantilla) return
    setGuardandoPlantilla(true)
    try {
      // Revertir valores resueltos a variables antes de guardar
      const asuntoConVariables = revertirVariables(asunto)
      const htmlConVariables = revertirVariables(html)
      await onGuardarPlantilla({
        nombre: nombrePlantilla.trim(),
        asunto: asuntoConVariables,
        contenido_html: htmlConVariables,
        canal_id: canalId,
      })
      setPlantillaGuardadaOk(true)
      setTimeout(() => {
        setMostrarGuardarPlantilla(false)
        setNombrePlantilla('')
        setPlantillaGuardadaOk(false)
      }, 1200)
    } catch {
      /* error se maneja en el padre */
    } finally {
      setGuardandoPlantilla(false)
    }
  }, [onGuardarPlantilla, nombrePlantilla, asunto, html, canalId, guardandoPlantilla])

  // ─── Subir archivos ───
  const subirArchivos = useCallback(async (archivos: File[]) => {
    if (archivos.length === 0) return
    setSubiendoAdjuntos(true)
    try {
      const formData = new FormData()
      for (const archivo of archivos) formData.append('archivos', archivo)
      const res = await fetch('/api/inbox/correo/adjuntos', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        const nuevos: AdjuntoDocumento[] = (data.adjuntos || []).map((a: AdjuntoDocumento) => ({
          ...a, es_documento_principal: false,
        }))
        setAdjuntos(prev => [...prev, ...nuevos])
      }
    } catch (err) {
      console.error('Error subiendo adjuntos:', err)
    } finally {
      setSubiendoAdjuntos(false)
    }
  }, [])

  const handleArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevos = Array.from(e.target.files || [])
    if (nuevos.length > 0) subirArchivos(nuevos)
    e.target.value = ''
  }

  // ─── Drag & drop ───
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setArrastrando(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    const rect = dropRef.current?.getBoundingClientRect()
    if (rect) {
      const { clientX, clientY } = e
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) setArrastrando(false)
    }
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setArrastrando(false)
    const archivos = Array.from(e.dataTransfer.files)
    if (archivos.length > 0) subirArchivos(archivos)
  }, [subirArchivos])

  // ─── Rastrear posición del cursor en el editor TipTap ───
  const actualizarCursorEditor = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !editorConFoco.current) { setCursorEditorPos(null); return }
    try {
      const { from, to } = editor.state.selection
      if (from !== to) { setCursorEditorPos(null); return }
      if (editor.isEmpty) { setCursorEditorPos(null); return }
      const coords = editor.view.coordsAtPos(from)
      if (coords.top <= 0 || coords.left <= 0 || coords.top > window.innerHeight) {
        setCursorEditorPos(null)
        return
      }
      setCursorEditorPos({ top: coords.top, left: coords.right })
    } catch {
      setCursorEditorPos(null)
    }
  }, [])

  // Suscribir a transacciones del editor para actualizar la posición
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !editorListo) return
    const handler = () => actualizarCursorEditor()
    const onFocus = () => { editorConFoco.current = true; handler() }
    const onBlur = () => {
      setTimeout(() => {
        if (!variablesCuerpoAbierto) {
          editorConFoco.current = false
          setCursorEditorPos(null)
        }
      }, 200)
    }
    editor.on('transaction', handler)
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)
    if (editor.isFocused) {
      editorConFoco.current = true
      setTimeout(handler, 300)
    }
    return () => {
      editor.off('transaction', handler)
      editor.off('focus', onFocus)
      editor.off('blur', onBlur)
    }
  }, [editorListo, actualizarCursorEditor, variablesCuerpoAbierto])

  // ─── Construir datos de envío ───
  const construirDatos = useCallback((programadoPara?: string): DatosEnvioDocumento | null => {
    if (para.length === 0 || !canalId) return null
    const textoPlano = html
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

    const todosAdjuntosIds: string[] = []
    if (incluirPdf && adjuntoDocumento) todosAdjuntosIds.push(adjuntoDocumento.id)
    todosAdjuntosIds.push(...adjuntos.map(a => a.id))

    return {
      canal_id: canalId, correo_para: para, correo_cc: cc, correo_cco: cco,
      asunto, html, texto: textoPlano, adjuntos_ids: todosAdjuntosIds,
      incluir_enlace_portal: incluirEnlacePortal, programado_para: programadoPara,
      _snapshot: {
        canal_id: canalId, para, cc, cco,
        mostrarCC, mostrarCCO,
        asunto, html, plantilla_id: plantillaId,
        incluir_pdf: incluirPdf, incluir_enlace_portal: incluirEnlacePortal,
        adjuntos,
      },
    }
  }, [para, cc, cco, asunto, html, canalId, incluirPdf, adjuntoDocumento, adjuntos, incluirEnlacePortal, mostrarCC, mostrarCCO, plantillaId])

  const handleEnviar = useCallback(async () => {
    const datos = construirDatos()
    if (!datos) return

    // Advertencias antes de enviar
    const advertencias: string[] = []
    if (!datos.asunto.trim()) advertencias.push('sin asunto')
    if (!datos.texto.trim()) advertencias.push('sin contenido en el cuerpo')

    if (advertencias.length > 0) {
      const confirmar = window.confirm(
        `Estás por enviar un correo ${advertencias.join(' y ')}.\n¿Querés enviarlo de todas formas?`
      )
      if (!confirmar) return
    }

    await onEnviar(datos)
  }, [construirDatos, onEnviar])

  const handleProgramar = useCallback(async (fecha: string) => {
    const datos = construirDatos(fecha)
    if (!datos) return
    await onEnviar(datos)
    setMostrarProgramar(false)
  }, [construirDatos, onEnviar])

  const puedeEnviar = para.length > 0 && !!canalId && !enviando && !subiendoAdjuntos

  const removerAdjunto = useCallback((id: string) => {
    setAdjuntos(prev => prev.filter(a => a.id !== id))
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorListo = useCallback((editor: any) => {
    editorRef.current = editor
    setEditorListo(true)
  }, [])

  return {
    // Estado del formulario
    canalId, setCanalId,
    para, setPara,
    cc, setCC,
    cco, setCCO,
    mostrarCC, setMostrarCC,
    mostrarCCO, setMostrarCCO,
    asunto, setAsunto,
    html, setHtml,
    plantillaId,
    canalActivo,

    // Adjuntos
    adjuntos, setAdjuntos, removerAdjunto,
    incluirPdf, setIncluirPdf,
    incluirEnlacePortal, setIncluirEnlacePortal,
    subiendoAdjuntos,
    inputArchivosRef,
    handleArchivos,

    // Programar
    mostrarProgramar, setMostrarProgramar,

    // Editor / cursor
    cursorEditorPos,
    editorRef,
    handleEditorListo,

    // Canal dropdown
    mostrarCanales, setMostrarCanales,

    // Variables
    variablesAsuntoAbierto, setVariablesAsuntoAbierto,
    variablesCuerpoAbierto, setVariablesCuerpoAbierto,
    insertarVariableAsunto,
    insertarVariableCuerpo,
    asuntoInputRef,

    // Plantillas
    aplicarPlantilla,
    limpiarPlantilla,
    revertirVariables,
    plantillaAsuntoOriginal,
    plantillaHtmlOriginal,
    marcarPlantillaSincronizada: useCallback(() => {
      setPlantillaAsuntoOriginal(asunto)
      setPlantillaHtmlOriginal(html)
    }, [asunto, html]),

    // Guardar plantilla (popover)
    mostrarGuardarPlantilla, setMostrarGuardarPlantilla,
    nombrePlantilla, setNombrePlantilla,
    handleGuardarPlantilla,
    guardandoPlantilla,
    plantillaGuardadaOk,

    // Borrador
    handleGuardarBorrador,

    // Drag & drop
    arrastrando,
    dropRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,

    // Envío
    handleEnviar,
    handleProgramar,
    puedeEnviar,
  }
}
