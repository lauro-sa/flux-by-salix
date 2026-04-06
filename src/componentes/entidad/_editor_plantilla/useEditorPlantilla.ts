'use client'

/**
 * useEditorPlantilla — Hook con toda la logica de estado, guardado y preview
 * del editor de plantillas de correo.
 * Se usa en: ModalEditorPlantillaCorreo (componente orquestador).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useToast } from '@/componentes/feedback/Toast'
import { crearNodoVariable } from '@/componentes/ui/ExtensionVariableChip'
import { formatearVariable, revertirVariablesEnPlantilla } from '@/lib/variables/resolver'
import { OPCIONES_DISPONIBLE, DATOS_EJEMPLO } from './constantes'
import { formatoMoneda, formatoFecha, formatearHtml, compactarHtml } from './utilidades'
import type { PlantillaRespuesta } from '@/tipos/inbox'
import type { DocumentoResultado, CuotaPreview } from './tipos'

interface ParametrosHook {
  abierto: boolean
  plantilla?: PlantillaRespuesta | null
  onGuardado: () => void
  onCerrar: () => void
}

export function useEditorPlantilla({ abierto, plantilla, onGuardado, onCerrar }: ParametrosHook) {
  const { mostrar } = useToast()
  const esEdicion = !!plantilla

  // ─── Estado del formulario ───
  const [nombre, setNombre] = useState('')
  const [asunto, setAsunto] = useState('')
  const [contenidoHtml, setContenidoHtml] = useState('')
  const [modulos, setModulos] = useState<string[]>([])
  const disponiblePara = modulos.length === 0 ? 'todos' : modulos[0]
  const [visibilidad, setVisibilidad] = useState('todos')
  const [esPorDefecto, setEsPorDefecto] = useState(false)
  const [usuariosEmpresa, setUsuariosEmpresa] = useState<Array<{ id: string; nombre: string; correo: string }>>([])
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  // ─── Datos de preview ───
  const [contactoPreview, setContactoPreview] = useState<Record<string, unknown> | null>(null)
  const [documentoPreview, setDocumentoPreview] = useState<DocumentoResultado | null>(null)
  const [cuotasPreview, setCuotasPreview] = useState<CuotaPreview[]>([])
  const [cargandoContacto, setCargandoContacto] = useState(false)
  const [datosEmpresaReal, setDatosEmpresaReal] = useState<Record<string, string> | null>(null)

  // ─── Variables y editor ───
  const [variablesAsuntoAbierto, setVariablesAsuntoAbierto] = useState(false)
  const [variablesCuerpoAbierto, setVariablesCuerpoAbierto] = useState(false)
  const asuntoInputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  const [editorListo, setEditorListo] = useState(false)

  // Cursor flotante para el { } en el cuerpo
  const [cursorEditorPos, setCursorEditorPos] = useState<{ top: number; left: number } | null>(null)
  const editorConFoco = useRef(false)

  // Tab activo y HTML crudo
  const [tabActivo, setTabActivo] = useState('editar')
  const [htmlCrudo, setHtmlCrudo] = useState('')
  const [variablesHtmlAbierto, setVariablesHtmlAbierto] = useState(false)
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null)

  // ─── Contexto de variables ───
  const contextoVariables = useMemo<Record<string, Record<string, unknown>>>(() => ({
    contacto: contactoPreview ? (() => {
      const dirs = contactoPreview.direcciones as Array<{ texto?: string; calle?: string; numero?: string; ciudad?: string; provincia?: string; codigo_postal?: string; es_principal?: boolean }> || []
      const dirPrincipal = dirs.find(d => d.es_principal) || dirs[0]
      return {
        nombre: contactoPreview.nombre || '',
        apellido: contactoPreview.apellido || '',
        nombre_completo: `${contactoPreview.nombre || ''} ${contactoPreview.apellido || ''}`.trim(),
        correo: contactoPreview.correo || '',
        telefono: contactoPreview.telefono || '',
        direccion_completa: dirPrincipal?.texto || '',
        calle: [dirPrincipal?.calle, dirPrincipal?.numero].filter(Boolean).join(' ') || '',
        ciudad: dirPrincipal?.ciudad || '',
        provincia: dirPrincipal?.provincia || '',
        codigo_postal: dirPrincipal?.codigo_postal || '',
      }
    })() : DATOS_EJEMPLO.contacto,
    presupuesto: documentoPreview ? (() => {
      const total = Number(documentoPreview.total_final) || 0
      const neto = Number(documentoPreview.subtotal_neto) || 0
      const impuestos = Number(documentoPreview.total_impuestos) || 0
      const m = documentoPreview.moneda
      return {
        numero: documentoPreview.numero,
        estado: documentoPreview.estado,
        total_neto: formatoMoneda(String(neto), m),
        total_impuestos: formatoMoneda(String(impuestos), m),
        total_con_iva: formatoMoneda(String(total), m),
        moneda: m,
        descuento_total: formatoMoneda(documentoPreview.descuento_global_monto, m),
        fecha_emision: formatoFecha(documentoPreview.fecha_emision),
        fecha_vencimiento: formatoFecha(documentoPreview.fecha_vencimiento),
        condicion_pago_label: documentoPreview.condicion_pago_label || '',
        referencia: documentoPreview.referencia || '',
        contacto_nombre: documentoPreview.contacto_nombre || '',
        contacto_correo: '',
        ...(() => {
          const primeraCuota = cuotasPreview[0]
          const cuotasPagadas = cuotasPreview.filter(c => c.estado === 'cobrada')
          const montoPagado = cuotasPagadas.reduce((sum, c) => sum + (Number(c.monto) || 0), 0)
          const montoAdelanto = primeraCuota ? Number(primeraCuota.monto) || 0 : total
          const porcentajeAdelanto = primeraCuota ? Number(primeraCuota.porcentaje) || 0 : 100
          return {
            porcentaje_adelanto: `${porcentajeAdelanto}%`,
            monto_adelanto: formatoMoneda(String(montoAdelanto), m),
            monto_restante: formatoMoneda(String(total - montoAdelanto), m),
            pagado: formatoMoneda(String(montoPagado), m),
            saldo_pendiente: formatoMoneda(String(total - montoPagado), m),
            cantidad_hitos: String(cuotasPreview.length),
          }
        })(),
      }
    })() : DATOS_EJEMPLO.presupuesto,
    empresa: datosEmpresaReal || DATOS_EJEMPLO.empresa,
    dirigido_a: DATOS_EJEMPLO.dirigido_a,
  }), [contactoPreview, documentoPreview, cuotasPreview, datosEmpresaReal])

  // ─── Seleccionar contacto para preview ───
  const seleccionarContactoPreview = useCallback(async (id: string) => {
    setCargandoContacto(true)
    try {
      const res = await fetch(`/api/contactos/${id}`)
      const data = await res.json()
      if (data?.id) {
        setContactoPreview(data)
        setDocumentoPreview(null)
      }
    } catch { /* silenciar */ }
    finally { setCargandoContacto(false) }
  }, [])

  // ─── Seleccionar documento para preview ───
  const seleccionarDocumentoPreview = useCallback(async (doc: DocumentoResultado) => {
    try {
      const res = await fetch(`/api/presupuestos/${doc.id}`)
      const data = await res.json()
      if (data) {
        setDocumentoPreview({
          ...doc,
          total_final: data.total_final || doc.total_final,
          subtotal_neto: data.subtotal_neto || null,
          total_impuestos: data.total_impuestos || null,
          descuento_global_monto: data.descuento_global_monto || null,
          condicion_pago_label: data.condicion_pago_label || null,
          condicion_pago_tipo: data.condicion_pago_tipo || null,
          fecha_vencimiento: data.fecha_vencimiento || null,
          referencia: data.referencia || null,
          porcentaje_adelanto: data.porcentaje_adelanto || 0,
          pagado: data.pagado || '0',
        })
        if (data.cuotas && Array.isArray(data.cuotas)) {
          setCuotasPreview(data.cuotas)
        } else {
          setCuotasPreview([])
        }
        if (data.contacto_id) {
          setCargandoContacto(true)
          const resC = await fetch(`/api/contactos/${data.contacto_id}`)
          const contacto = await resC.json()
          if (contacto?.id) setContactoPreview(contacto)
          setCargandoContacto(false)
        }
      } else {
        setDocumentoPreview(doc)
      }
    } catch {
      setDocumentoPreview(doc)
    }
  }, [])

  const contactoBloqueadoPorDoc = !!documentoPreview

  // ─── Resetear al abrir ───
  useEffect(() => {
    if (!abierto) return
    if (plantilla) {
      setNombre(plantilla.nombre)
      setAsunto(plantilla.asunto || '')
      setContenidoHtml(plantilla.contenido_html || plantilla.contenido || '')
      setModulos(plantilla.modulos || [])
      setVisibilidad(plantilla.disponible_para || 'todos')
      const tieneDefecto = (plantilla.variables || []).some(
        (v: { clave: string }) => v.clave === '_es_por_defecto'
      )
      setEsPorDefecto(tieneDefecto)
    } else {
      setNombre('')
      setAsunto('')
      setContenidoHtml('')
      setModulos([])
      setVisibilidad('todos')
      setEsPorDefecto(false)
    }
    setGuardando(false)
    setTabActivo('editar')
    setHtmlCrudo(formatearHtml(plantilla?.contenido_html || plantilla?.contenido || ''))
    setCursorEditorPos(null)
    editorConFoco.current = false
    setEditorListo(false)
    setVariablesCuerpoAbierto(false)
    setUsuariosSeleccionados(plantilla?.usuarios_permitidos || [])
    // Cargar usuarios y datos reales de la empresa en paralelo
    Promise.all([
      fetch('/api/usuarios').then(r => r.json()).catch(() => ({ usuarios: [] })),
      fetch('/api/empresas/actualizar').then(r => r.json()).catch(() => ({ empresa: null })),
    ]).then(([usersData, empData]) => {
      setUsuariosEmpresa(usersData.usuarios || [])
      if (empData.empresa) {
        setDatosEmpresaReal({
          nombre: empData.empresa.nombre || '',
          correo_contacto: empData.empresa.correo || '',
          telefono: empData.empresa.telefono || '',
        })
      }
    })
  }, [abierto, plantilla])

  // ─── Sincronizar contenido al editor TipTap cuando se abre/cambia plantilla ───
  useEffect(() => {
    if (!editorListo || !abierto) return
    const editor = editorRef.current
    if (!editor) return
    // Solo inyectar si el contenido actual del editor difiere del estado
    const htmlActualEditor = editor.getHTML()
    if (contenidoHtml && htmlActualEditor !== contenidoHtml) {
      editor.commands.setContent(contenidoHtml)
    }
  // Solo al cambiar editorListo (cuando el editor se monta/remonta)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorListo, abierto])

  // ─── Actualizar valores de variables en el editor cuando cambia el contexto ───
  useEffect(() => {
    if (!editorListo || !abierto) return
    const editor = editorRef.current
    if (!editor) return
    const moneda = (contextoVariables?.presupuesto?.moneda || 'ARS') as string

    // Actualizar spans data-variable con valores frescos
    const html = editor.getHTML()
    const actualizado = html.replace(
      /<span[^>]*data-variable="([a-z_]+)\.([a-z_]+)"[^>]*>[^<]*<\/span>/g,
      (_match: string, entidad: string, campo: string) => {
        const valor = contextoVariables[entidad]?.[campo]
        const formateado = (valor !== undefined && valor !== null && valor !== '')
          ? formatearVariable(entidad, campo, valor, moneda)
          : `{{${entidad}.${campo}}}`
        return `<span data-variable="${entidad}.${campo}" class="variable-resaltada" title="{{${entidad}.${campo}}}" contenteditable="false">${formateado}</span>`
      }
    )
    if (actualizado !== html) {
      editor.commands.setContent(actualizado)
      // Sincronizar estado
      setContenidoHtml(actualizado)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextoVariables, editorListo, abierto])

  // ─── Cambiar tab sincronizando HTML ───
  const handleCambiarTab = useCallback((tab: string) => {
    if (tabActivo === 'editar' && tab === 'codigo') {
      setHtmlCrudo(formatearHtml(contenidoHtml))
    } else if (tabActivo === 'codigo' && tab !== 'codigo') {
      setContenidoHtml(compactarHtml(htmlCrudo))
    }
    setTabActivo(tab)
  }, [tabActivo, contenidoHtml, htmlCrudo])

  // ─── Insertar variable en el asunto ───
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

  // ─── Insertar variable en textarea HTML ───
  const insertarVariableHtml = useCallback((variable: string) => {
    const ta = htmlTextareaRef.current
    if (ta) {
      const inicio = ta.selectionStart ?? htmlCrudo.length
      const fin = ta.selectionEnd ?? htmlCrudo.length
      const nuevo = htmlCrudo.slice(0, inicio) + variable + htmlCrudo.slice(fin)
      setHtmlCrudo(nuevo)
      requestAnimationFrame(() => {
        ta.focus()
        const pos = inicio + variable.length
        ta.setSelectionRange(pos, pos)
      })
    } else {
      setHtmlCrudo(prev => prev + variable)
    }
    setVariablesHtmlAbierto(false)
  }, [htmlCrudo])

  // ─── Insertar variable en el cuerpo (editor TipTap como nodo chip) ───
  const insertarVariableCuerpo = useCallback((variable: string) => {
    const editor = editorRef.current
    if (!editor) return
    const match = variable.match(/^\{\{(\w+)\.(\w+)\}\}$/)
    if (match) {
      const [, entidad, campo] = match
      const preview = contextoVariables[entidad]?.[campo]
      const moneda = (contextoVariables?.presupuesto?.moneda || contextoVariables?.empresa?.moneda || 'ARS') as string
      const valorPreview = (preview !== undefined && preview !== null && preview !== '') ? formatearVariable(entidad, campo, preview, moneda) : ''
      editor.chain().focus().insertContent(crearNodoVariable(entidad, campo, valorPreview)).run()
    } else {
      editor.chain().focus().insertContent(variable).run()
    }
    setVariablesCuerpoAbierto(false)
  }, [contextoVariables])

  // ─── Rastrear cursor del editor para el { } flotante ───
  const actualizarCursorEditor = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !editorConFoco.current) { setCursorEditorPos(null); return }
    try {
      const { from, to } = editor.state.selection
      if (from !== to) { setCursorEditorPos(null); return }
      if (editor.isEmpty) { setCursorEditorPos(null); return }
      const coords = editor.view.coordsAtPos(from)
      if (coords.top <= 0 || coords.left <= 0 || coords.top > window.innerHeight) { setCursorEditorPos(null); return }
      setCursorEditorPos({ top: coords.top, left: coords.right })
    } catch { setCursorEditorPos(null) }
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !editorListo) return
    const handler = () => actualizarCursorEditor()
    const onFocus = () => { editorConFoco.current = true; setTimeout(handler, 300) }
    const onBlur = () => {
      setTimeout(() => {
        if (!variablesCuerpoAbierto) { editorConFoco.current = false; setCursorEditorPos(null) }
      }, 200)
    }
    editor.on('transaction', handler)
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)
    return () => { editor.off('transaction', handler); editor.off('focus', onFocus); editor.off('blur', onBlur) }
  }, [editorListo, actualizarCursorEditor, variablesCuerpoAbierto])

  // ─── Guardar plantilla ───
  const handleGuardar = useCallback(async () => {
    if (!nombre.trim()) {
      mostrar('error', 'El nombre es obligatorio')
      return
    }
    setGuardando(true)
    try {
      // Revertir valores de preview a variables {{entidad.campo}} antes de guardar
      const htmlParaGuardar = revertirVariablesEnPlantilla(contenidoHtml, contextoVariables)
      const asuntoParaGuardar = revertirVariablesEnPlantilla(asunto.trim(), contextoVariables)

      const textoPlano = htmlParaGuardar
        .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

      const datos = {
        nombre: nombre.trim(),
        canal: 'correo' as const,
        asunto: asuntoParaGuardar,
        contenido: textoPlano,
        contenido_html: htmlParaGuardar,
        modulos,
        disponible_para: visibilidad === 'solo_yo' ? 'usuarios' : visibilidad,
        usuarios_permitidos: visibilidad === 'usuarios' ? usuariosSeleccionados : [],
        categoria: modulos.length === 1 ? (OPCIONES_DISPONIBLE.find(o => o.valor === modulos[0])?.tipoDocumento || null) : null,
        variables: esPorDefecto ? [{ clave: '_es_por_defecto', etiqueta: 'Por defecto', origen: 'metadata' }] : [],
      }

      if (esEdicion && plantilla) {
        await fetch(`/api/inbox/plantillas/${plantilla.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
        mostrar('exito', 'Plantilla actualizada')
      } else {
        await fetch('/api/inbox/plantillas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
        mostrar('exito', 'Plantilla creada')
      }
      onGuardado()
      onCerrar()
    } catch {
      mostrar('error', 'Error al guardar la plantilla')
    } finally {
      setGuardando(false)
    }
  }, [nombre, asunto, contenidoHtml, modulos, visibilidad, usuariosSeleccionados, esPorDefecto, esEdicion, plantilla, mostrar, onGuardado, onCerrar, contextoVariables])

  // ─── Resolver variables para la vista previa ───
  const resolverPreview = useCallback((texto: string) => {
    return texto.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_, entidad, campo) => {
      const val = contextoVariables[entidad]?.[campo]
      return val !== undefined && val !== null ? String(val) : `{{${entidad}.${campo}}}`
    })
  }, [contextoVariables])

  return {
    // Estado del formulario
    esEdicion,
    nombre, setNombre,
    asunto, setAsunto,
    contenidoHtml, setContenidoHtml,
    modulos, setModulos,
    disponiblePara,
    visibilidad, setVisibilidad,
    esPorDefecto, setEsPorDefecto,
    usuariosEmpresa,
    usuariosSeleccionados, setUsuariosSeleccionados,
    guardando,

    // Preview
    contactoPreview, setContactoPreview,
    documentoPreview, setDocumentoPreview,
    cargandoContacto,
    contactoBloqueadoPorDoc,
    seleccionarContactoPreview,
    seleccionarDocumentoPreview,
    contextoVariables,
    resolverPreview,

    // Variables
    variablesAsuntoAbierto, setVariablesAsuntoAbierto,
    variablesCuerpoAbierto, setVariablesCuerpoAbierto,
    insertarVariableAsunto,
    insertarVariableCuerpo,
    variablesHtmlAbierto, setVariablesHtmlAbierto,
    insertarVariableHtml,

    // Editor
    editorRef,
    editorListo, setEditorListo,
    cursorEditorPos,

    // Tabs
    tabActivo,
    handleCambiarTab,
    htmlCrudo, setHtmlCrudo,

    // Acciones
    handleGuardar,
  }
}
