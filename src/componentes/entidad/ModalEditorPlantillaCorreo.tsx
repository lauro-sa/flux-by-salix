'use client'

/**
 * ModalEditorPlantillaCorreo — Editor completo de plantillas de correo.
 * Incluye: nombre, asunto con variables, disponible para (módulo), visibilidad,
 * editor rico con variables integradas, vista previa con datos reales.
 * Se usa en: inbox/configuracion (SeccionPlantillas).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Tabs } from '@/componentes/ui/Tabs'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Braces, Eye, Save, Code2, PenLine, X, ChevronDown } from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'
import { crearNodoVariable } from '@/componentes/ui/ExtensionVariableChip'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import type { PlantillaRespuesta } from '@/tipos/inbox'

// ─── Opciones de "Disponible para" ───

// ─── Helpers de formato ───

function formatoMoneda(valor: string | null | undefined, moneda?: string): string {
  if (!valor) return ''
  const num = Number(valor)
  if (isNaN(num)) return valor
  const simbolo = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$'
  return `${simbolo} ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatoFecha(valor: string | null | undefined): string {
  if (!valor) return ''
  try {
    const d = new Date(valor)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return valor }
}

// ─── Opciones ───

const OPCIONES_DISPONIBLE = [
  { valor: 'todos', etiqueta: 'Todos los módulos', tipoDocumento: null },
  { valor: 'contactos', etiqueta: 'Contactos', tipoDocumento: null },
  { valor: 'presupuestos', etiqueta: 'Presupuestos', tipoDocumento: 'presupuesto' },
  { valor: 'facturas', etiqueta: 'Facturas', tipoDocumento: 'factura' },
  { valor: 'ordenes', etiqueta: 'Órdenes de trabajo', tipoDocumento: 'orden_trabajo' },
  { valor: 'recibos', etiqueta: 'Recibos', tipoDocumento: 'recibo' },
  { valor: 'informes', etiqueta: 'Informes', tipoDocumento: 'informe' },
  { valor: 'notas_credito', etiqueta: 'Notas de crédito', tipoDocumento: 'nota_credito' },
  { valor: 'notas_debito', etiqueta: 'Notas de débito', tipoDocumento: 'nota_debito' },
  { valor: 'remitos', etiqueta: 'Remitos', tipoDocumento: 'remito' },
]

const OPCIONES_VISIBILIDAD = [
  { valor: 'todos', etiqueta: 'Todos los usuarios' },
  { valor: 'solo_yo', etiqueta: 'Solo yo' },
  { valor: 'usuarios', etiqueta: 'Usuarios específicos' },
  { valor: 'roles', etiqueta: 'Solo ciertos roles' },
]

// ─── Datos de ejemplo para la vista previa ───

const DATOS_EJEMPLO: Record<string, Record<string, unknown>> = {
  contacto: {
    nombre: 'Juan', apellido: 'García', nombre_completo: 'Juan García',
    correo: 'juan@ejemplo.com', telefono: '+54 11 1234-5678',
    direccion_completa: 'Av. Corrientes 1234, CABA',
  },
  presupuesto: {
    numero: 'P-0001', estado: 'Confirmado', total_con_iva: '$150.000,00',
    fecha_emision: '07/03/2026', moneda: 'ARS',
  },
  empresa: { nombre: 'Mi Empresa S.A.', correo_contacto: 'info@miempresa.com' },
  dirigido_a: {
    nombre: 'María', apellido: 'López', nombre_completo: 'María López',
    correo: 'maria@ejemplo.com', cargo: 'Gerente Comercial',
  },
}

// ─── Props ───

interface PropiedadesModalEditorPlantilla {
  abierto: boolean
  onCerrar: () => void
  /** Plantilla existente para editar (null = crear nueva) */
  plantilla?: PlantillaRespuesta | null
  /** Callback al guardar exitosamente */
  onGuardado: () => void
}

// ─── Iniciales + color para avatar ───

function iniciales(nombre: string, apellido?: string | null): string {
  const n = (nombre || '').charAt(0).toUpperCase()
  const a = (apellido || '').charAt(0).toUpperCase()
  return `${n}${a}` || '?'
}

const COLORES_AVATAR = [
  'var(--texto-marca)', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

function colorAvatar(nombre: string): string {
  let hash = 0
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
  return COLORES_AVATAR[Math.abs(hash) % COLORES_AVATAR.length]
}

// ─── Buscador de contacto con recientes, avatares, y búsqueda ───

interface ContactoResultado {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  codigo?: string
}

function BuscadorContactoPreview({
  onSeleccionar,
  cargando,
}: {
  onSeleccionar: (id: string) => void
  cargando: boolean
}) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ContactoResultado[]>([])
  const [recientes, setRecientes] = useState<ContactoResultado[]>([])
  const [mostrar, setMostrar] = useState(false)
  const [cargandoRecientes, setCargandoRecientes] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cargar recientes al montar
  useEffect(() => {
    setCargandoRecientes(true)
    fetch('/api/contactos?limite=8&orden=actualizado_en_desc')
      .then(r => r.json())
      .then(data => setRecientes(data.contactos || []))
      .catch(() => {})
      .finally(() => setCargandoRecientes(false))
  }, [])

  // Búsqueda con debounce
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (busqueda.length < 2) { setResultados([]); return }
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contactos/buscar?q=${encodeURIComponent(busqueda)}`)
        const data = await res.json()
        setResultados(data.contactos || [])
      } catch { setResultados([]) }
    }, 250)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [busqueda])

  const lista = busqueda.length >= 2 ? resultados : recientes
  const handleFocus = () => setMostrar(true)
  const handleBlur = () => setTimeout(() => setMostrar(false), 200)

  const renderContacto = (c: ContactoResultado) => {
    const nombre = `${c.nombre} ${c.apellido || ''}`.trim()
    return (
      <button
        key={c.id}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--superficie-hover)]"
        onMouseDown={(e) => { e.preventDefault(); onSeleccionar(c.id); setBusqueda(''); setMostrar(false) }}
      >
        <span
          className="size-7 rounded-full flex items-center justify-center text-xxs font-bold flex-shrink-0"
          style={{ background: colorAvatar(nombre), color: 'white' }}
        >
          {iniciales(c.nombre, c.apellido)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--texto-primario)' }}>{nombre}</p>
          {c.correo && <p className="text-xs truncate" style={{ color: 'var(--texto-terciario)' }}>{c.correo}</p>}
        </div>
      </button>
    )
  }

  return (
    <div className="relative flex-1">
      <div className="flex items-center gap-1.5" style={{ borderBottom: '1.5px solid var(--borde-fuerte)' }}>
        <input
          ref={inputRef}
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Buscar contacto..."
          className="flex-1 text-sm bg-transparent outline-none py-1.5"
          style={{ color: 'var(--texto-primario)' }}
        />
        {busqueda && (
          <button onClick={() => { setBusqueda(''); inputRef.current?.focus() }} type="button" style={{ color: 'var(--texto-terciario)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {mostrar && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-elevada max-h-[280px] overflow-y-auto"
          style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
        >
          {cargandoRecientes && lista.length === 0 ? (
            <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--texto-terciario)' }}>Cargando...</p>
          ) : lista.length > 0 ? (
            <div className="py-1">
              {lista.map(renderContacto)}
            </div>
          ) : busqueda.length >= 2 ? (
            <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--texto-terciario)' }}>Sin resultados</p>
          ) : null}
        </div>
      )}

      {cargando && <span className="absolute right-0 top-1 text-xxs" style={{ color: 'var(--texto-terciario)' }}>Cargando...</span>}
    </div>
  )
}

// ─── Buscador de documento para preview ───

interface DocumentoResultado {
  id: string
  numero: string
  estado: string
  contacto_nombre: string | null
  total_final: string | null
  subtotal_neto: string | null
  total_impuestos: string | null
  descuento_global_monto: string | null
  moneda: string
  fecha_emision: string
  fecha_vencimiento: string | null
  condicion_pago_label: string | null
  condicion_pago_tipo: string | null
  referencia: string | null
  // Campos de pagos
  porcentaje_adelanto?: number
  pagado?: string | null
}

function BuscadorDocumentoPreview({
  contactoId,
  onSeleccionar,
}: {
  contactoId?: string | null
  onSeleccionar: (doc: DocumentoResultado) => void
}) {
  const [docs, setDocs] = useState<DocumentoResultado[]>([])
  const [mostrar, setMostrar] = useState(false)
  const [cargando, setCargando] = useState(false)

  // Cargar documentos recientes (o del contacto si hay)
  useEffect(() => {
    setCargando(true)
    const url = contactoId
      ? `/api/presupuestos?contacto_id=${contactoId}&limite=8`
      : '/api/presupuestos?limite=8'
    fetch(url)
      .then(r => r.json())
      .then(data => setDocs(data.presupuestos || []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [contactoId])

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => setMostrar(!mostrar)}
        onBlur={() => setTimeout(() => setMostrar(false), 200)}
        className="w-full flex items-center gap-1.5 py-1.5 text-left"
        style={{ borderBottom: '1.5px solid var(--borde-fuerte)' }}
      >
        <span className="flex-1 text-sm" style={{ color: 'var(--texto-terciario)' }}>Elegir documento...</span>
        <ChevronDown size={14} style={{ color: 'var(--texto-terciario)' }} />
      </button>

      {mostrar && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-elevada max-h-[280px] overflow-y-auto"
          style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
        >
          {cargando ? (
            <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--texto-terciario)' }}>Cargando...</p>
          ) : docs.length > 0 ? (
            <div className="py-1">
              {docs.map(d => (
                <button
                  key={d.id}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--superficie-hover)]"
                  onMouseDown={(e) => { e.preventDefault(); onSeleccionar(d); setMostrar(false) }}
                >
                  <PenLine size={14} style={{ color: 'var(--texto-terciario)' }} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--texto-primario)' }}>{d.numero}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--texto-terciario)' }}>
                      {d.contacto_nombre || 'Sin contacto'} · {d.estado}
                    </p>
                  </div>
                  {d.total_final && (
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--texto-secundario)' }}>
                      {d.moneda === 'USD' ? 'US$' : '$'} {Number(d.total_final).toLocaleString('es-AR')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--texto-terciario)' }}>Sin documentos</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Asunto con variables resueltas inline (contentEditable) ───

function AsuntoConVariables({
  valor,
  onChange,
  placeholder,
  contexto,
  variablesAbierto,
  onToggleVariables,
  onCerrarVariables,
  onInsertarVariable,
}: {
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  contexto?: Record<string, Record<string, unknown>>
  variablesAbierto: boolean
  onToggleVariables: () => void
  onCerrarVariables: () => void
  onInsertarVariable: (v: string) => void
}) {
  const editableRef = useRef<HTMLDivElement>(null)
  const skipUpdateRef = useRef(false)

  // Parsear texto en segmentos
  const segmentos = useMemo(() => {
    const result: Array<{ tipo: 'texto'; valor: string } | { tipo: 'variable'; entidad: string; campo: string; raw: string }> = []
    const regex = /\{\{(\w+)\.(\w+)\}\}/g
    let ultimo = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(valor)) !== null) {
      if (match.index > ultimo) result.push({ tipo: 'texto', valor: valor.slice(ultimo, match.index) })
      result.push({ tipo: 'variable', entidad: match[1], campo: match[2], raw: match[0] })
      ultimo = regex.lastIndex
    }
    if (ultimo < valor.length) result.push({ tipo: 'texto', valor: valor.slice(ultimo) })
    return result
  }, [valor])

  // Reconstruir valor raw desde el contentEditable
  const handleInput = useCallback(() => {
    if (!editableRef.current || skipUpdateRef.current) return
    let nuevoValor = ''
    editableRef.current.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        nuevoValor += node.textContent || ''
      } else if (node instanceof HTMLElement) {
        const raw = node.getAttribute('data-raw')
        nuevoValor += raw || node.textContent || ''
      }
    })
    onChange(nuevoValor)
  }, [onChange])

  // Renderizar contenido cuando cambia el valor externamente (ej: insertar variable)
  useEffect(() => {
    if (!editableRef.current) return
    // Solo actualizar DOM si el valor cambió externamente (no por input del usuario)
    const domText = Array.from(editableRef.current.childNodes).map(n => {
      if (n.nodeType === Node.TEXT_NODE) return n.textContent || ''
      if (n instanceof HTMLElement) return n.getAttribute('data-raw') || n.textContent || ''
      return ''
    }).join('')
    if (domText === valor) return

    skipUpdateRef.current = true
    editableRef.current.innerHTML = ''
    segmentos.forEach(seg => {
      if (seg.tipo === 'texto') {
        editableRef.current!.appendChild(document.createTextNode(seg.valor))
      } else {
        const preview = contexto?.[seg.entidad]?.[seg.campo]
        const textoVisible = (preview !== undefined && preview !== null && preview !== '') ? String(preview) : seg.raw
        const span = document.createElement('span')
        span.setAttribute('data-raw', seg.raw)
        span.setAttribute('contenteditable', 'false')
        span.setAttribute('title', seg.raw)
        span.style.background = 'var(--insignia-primario-fondo)'
        span.style.borderRadius = '3px'
        span.style.padding = '0 3px'
        span.style.cursor = 'default'
        span.textContent = textoVisible
        editableRef.current!.appendChild(span)
      }
    })
    skipUpdateRef.current = false
  }, [valor, segmentos, contexto])

  const vacio = !valor

  return (
    <div className="relative rounded-lg transition-shadow focus-within:ring-2 focus-within:ring-texto-marca/20" style={{ border: '1px solid var(--borde-fuerte)' }}>
      <div
        ref={editableRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="w-full text-sm outline-none py-2 px-3 pr-9 min-h-[36px] rounded-lg"
        style={{ color: 'var(--texto-primario)' }}
        data-placeholder={placeholder}
      />
      {/* Placeholder manual */}
      {vacio && (
        <div
          className="absolute inset-0 flex items-center px-3 pointer-events-none text-sm"
          style={{ color: 'var(--texto-terciario)' }}
        >
          {placeholder}
        </div>
      )}
      {/* Botón { } */}
      <div className="absolute right-2 inset-y-0 flex items-center">
        <button
          onClick={onToggleVariables}
          onMouseDown={(e) => e.preventDefault()}
          className="flex items-center justify-center size-7 rounded transition-colors hover:bg-[var(--superficie-hover)]"
          style={{ color: 'var(--texto-terciario)' }}
          type="button"
          title="Insertar variable"
        >
          <Braces size={14} />
        </button>
        <SelectorVariables
          abierto={variablesAbierto}
          onCerrar={onCerrarVariables}
          onSeleccionar={onInsertarVariable}
          posicion="abajo"
          contexto={contexto}
        />
      </div>
    </div>
  )
}

// ─── Componente principal ───

export function ModalEditorPlantillaCorreo({
  abierto,
  onCerrar,
  plantilla,
  onGuardado,
}: PropiedadesModalEditorPlantilla) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const esEdicion = !!plantilla

  // ─── Estado del formulario ───
  const [nombre, setNombre] = useState('')
  const [asunto, setAsunto] = useState('')
  const [contenidoHtml, setContenidoHtml] = useState('')
  const [modulos, setModulos] = useState<string[]>([])
  // disponiblePara se deriva de modulos: vacío = todos
  const disponiblePara = modulos.length === 0 ? 'todos' : modulos[0]
  const [visibilidad, setVisibilidad] = useState('todos')
  const [esPorDefecto, setEsPorDefecto] = useState(false)
  const [usuariosEmpresa, setUsuariosEmpresa] = useState<Array<{ id: string; nombre: string; correo: string }>>([])
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  // Datos de preview (contacto y documento seleccionados para resolver variables)
  const [contactoPreview, setContactoPreview] = useState<Record<string, unknown> | null>(null)
  const [documentoPreview, setDocumentoPreview] = useState<DocumentoResultado | null>(null)
  const [cuotasPreview, setCuotasPreview] = useState<Array<{ numero: number; descripcion: string; porcentaje: string; monto: string; estado: string }>>([])
  const [cargandoContacto, setCargandoContacto] = useState(false)

  // Contexto de variables dinámico basado en contacto seleccionado o datos de ejemplo
  const contextoVariables = useMemo<Record<string, Record<string, unknown>>>(() => ({
    contacto: contactoPreview ? {
      nombre: contactoPreview.nombre || '',
      apellido: contactoPreview.apellido || '',
      nombre_completo: `${contactoPreview.nombre || ''} ${contactoPreview.apellido || ''}`.trim(),
      correo: contactoPreview.correo || '',
      telefono: contactoPreview.telefono || '',
      direccion_completa: (contactoPreview.direcciones as Array<{ texto: string }>)?.[0]?.texto || '',
    } : DATOS_EJEMPLO.contacto,
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
        // Variables calculadas de pagos desde cuotas
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
    empresa: DATOS_EJEMPLO.empresa,
    dirigido_a: DATOS_EJEMPLO.dirigido_a,
  }), [contactoPreview, documentoPreview, cuotasPreview])

  // Buscar contacto para preview
  const buscarContactoPreview = useCallback(async (termino: string) => {
    try {
      const res = await fetch(`/api/contactos/buscar?q=${encodeURIComponent(termino)}`)
      const data = await res.json()
      return data.contactos || []
    } catch { return [] }
  }, [])

  const seleccionarContactoPreview = useCallback(async (id: string) => {
    setCargandoContacto(true)
    try {
      const res = await fetch(`/api/contactos/${id}`)
      const data = await res.json()
      if (data?.id) {
        setContactoPreview(data)
        // Si cambió el contacto, limpiar documento (puede no pertenecer a este contacto)
        setDocumentoPreview(null)
      }
    } catch { /* silenciar */ }
    finally { setCargandoContacto(false) }
  }, [])

  // Al seleccionar documento, auto-cargar su contacto
  const seleccionarDocumentoPreview = useCallback(async (doc: DocumentoResultado) => {
    // Cargar datos completos del presupuesto
    try {
      const res = await fetch(`/api/presupuestos/${doc.id}`)
      const data = await res.json()
      if (data) {
        // Enriquecer el documento con todos los campos
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
        // Cargar cuotas del presupuesto
        if (data.cuotas && Array.isArray(data.cuotas)) {
          setCuotasPreview(data.cuotas)
        } else {
          setCuotasPreview([])
        }
        // Cargar contacto automáticamente
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

  // Si hay documento seleccionado, el contacto está bloqueado (viene del documento)
  const contactoBloqueadoPorDoc = !!documentoPreview

  // Variables
  const [variablesAsuntoAbierto, setVariablesAsuntoAbierto] = useState(false)
  const [variablesCuerpoAbierto, setVariablesCuerpoAbierto] = useState(false)
  const asuntoInputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  const [editorListo, setEditorListo] = useState(false)

  // Cursor flotante para el { } en el cuerpo
  const [cursorEditorPos, setCursorEditorPos] = useState<{ top: number; left: number } | null>(null)
  const editorConFoco = useRef(false)

  // Tab activo: editar (visual), codigo (HTML), preview
  const [tabActivo, setTabActivo] = useState('editar')
  // HTML crudo para el tab de código
  const [htmlCrudo, setHtmlCrudo] = useState('')
  const [variablesHtmlAbierto, setVariablesHtmlAbierto] = useState(false)
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null)

  // ─── Resetear al abrir ───
  useEffect(() => {
    if (!abierto) return
    if (plantilla) {
      setNombre(plantilla.nombre)
      setAsunto(plantilla.asunto || '')
      setContenidoHtml(plantilla.contenido_html || plantilla.contenido || '')
      setModulos(plantilla.modulos || [])
      setModulos(plantilla.modulos || [])
      // Mapear disponible_para: si es 'usuarios' y solo tiene 1 usuario (el creador), es "solo yo"
      setVisibilidad(plantilla.disponible_para || 'todos')
      // Detectar esPorDefecto desde variables metadata
      const tieneDefecto = (plantilla.variables || []).some(
        (v: { clave: string }) => v.clave === '_es_por_defecto'
      )
      setEsPorDefecto(tieneDefecto)
    } else {
      setNombre('')
      setAsunto('')
      setContenidoHtml('')
      setModulos([])
      setModulos([])
      setVisibilidad('todos')
      setEsPorDefecto(false)
    }
    setGuardando(false)
    setTabActivo('editar')
    setHtmlCrudo('')
    setCursorEditorPos(null)
    editorConFoco.current = false
    setEditorListo(false)
    setVariablesCuerpoAbierto(false)
    setUsuariosSeleccionados(plantilla?.usuarios_permitidos || [])
    // Cargar usuarios de la empresa
    fetch('/api/usuarios')
      .then(r => r.json())
      .then(data => setUsuariosEmpresa(data.usuarios || []))
      .catch(() => {})
  }, [abierto, plantilla])

  // Formatear HTML para que sea legible en el textarea
  const formatearHtml = (html: string) => {
    return html
      // Salto de línea después de etiquetas de cierre de bloque
      .replace(/<\/(p|div|h[1-6]|ul|ol|li|blockquote|table|tr|thead|tbody)>/gi, '</$1>\n')
      // Salto después de <br/> y <hr/>
      .replace(/<br\s*\/?>/gi, '<br/>\n')
      .replace(/<hr\s*\/?>/gi, '<hr/>\n')
      // Quitar líneas vacías múltiples
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  // Compactar HTML al volver al editor (quitar saltos extra que no son contenido)
  const compactarHtml = (html: string) => {
    return html
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join('')
  }

  // Sincronizar HTML crudo al cambiar de tab
  const handleCambiarTab = (tab: string) => {
    if (tabActivo === 'editar' && tab === 'codigo') {
      // Visual → Código: formatear para legibilidad
      setHtmlCrudo(formatearHtml(contenidoHtml))
    } else if (tabActivo === 'codigo' && tab !== 'codigo') {
      // Código → otro: compactar y pasar al editor
      setContenidoHtml(compactarHtml(htmlCrudo))
    }
    setTabActivo(tab)
  }

  const TABS_EDITOR = [
    { clave: 'editar', etiqueta: 'Editar', icono: <PenLine size={14} /> },
    { clave: 'codigo', etiqueta: 'Código', icono: <Code2 size={14} /> },
    { clave: 'preview', etiqueta: 'Vista previa', icono: <Eye size={14} /> },
  ]

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

  // ─── Insertar variable en el textarea HTML ───
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
      const valorPreview = (preview !== undefined && preview !== null && preview !== '') ? String(preview) : ''
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
  const handleGuardar = async () => {
    if (!nombre.trim()) {
      mostrar('error', 'El nombre es obligatorio')
      return
    }
    setGuardando(true)
    try {
      const modulosArr = modulos
      const textoPlano = contenidoHtml
        .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

      const opcion = OPCIONES_DISPONIBLE.find(o => o.valor === disponiblePara)
      const datos = {
        nombre: nombre.trim(),
        canal: 'correo' as const,
        asunto: asunto.trim(),
        contenido: textoPlano,
        contenido_html: contenidoHtml,
        modulos: modulosArr,
        disponible_para: visibilidad === 'solo_yo' ? 'usuarios' : visibilidad,
        usuarios_permitidos: visibilidad === 'usuarios' ? usuariosSeleccionados : [],
        categoria: modulos.length === 1 ? (OPCIONES_DISPONIBLE.find(o => o.valor === modulos[0])?.tipoDocumento || null) : null,
        // Guardar metadata en variables JSONB: esPorDefecto y tipoDocumento del viejo sistema
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
  }

  // ─── Resolver variables para la vista previa ───
  const resolverPreview = useCallback((texto: string) => {
    return texto.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_, entidad, campo) => {
      const val = contextoVariables[entidad]?.[campo]
      return val !== undefined && val !== null ? String(val) : `{{${entidad}.${campo}}}`
    })
  }, [contextoVariables])

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
                onClick={() => { setDocumentoPreview(null); /* No limpiar contacto, puede querer mantenerlo */ }}
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

            {/* Disponible para (checkboxes múltiples) + Visibilidad */}
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

            {/* Por defecto */}
            {modulos.length > 0 && (
              <Interruptor
                activo={esPorDefecto}
                onChange={setEsPorDefecto}
                etiqueta={`Usar como plantilla por defecto al enviar ${modulos.map(m => OPCIONES_DISPONIBLE.find(o => o.valor === m)?.etiqueta?.toLowerCase() || m).join(', ')}`}
              />
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

        {/* Botón { } flotante que sigue al cursor del editor */}
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
          <div className="space-y-4">
            {/* Nombre + Asunto en fila compacta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                etiqueta="Nombre *"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre de la plantilla"
              />
              <Input
                etiqueta="Asunto"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Asunto del correo"
              />
            </div>

            {/* Visibilidad (módulos se editan en tab Editar) */}
            <Select
              etiqueta="Quién la puede usar"
              opciones={OPCIONES_VISIBILIDAD.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
              valor={visibilidad}
              onChange={setVisibilidad}
            />

            {/* Textarea HTML crudo con botón de variables flotante */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>HTML del correo</label>
              <div className="relative">
                <textarea
                  ref={htmlTextareaRef}
                  value={htmlCrudo}
                  onChange={(e) => setHtmlCrudo(e.target.value)}
                  placeholder="<p>Hola {{contacto.nombre}},</p>&#10;<p>Adjuntamos el {{presupuesto.numero}}.</p>"
                  className="w-full text-xs font-mono bg-transparent outline-none py-3 px-4 pr-10 rounded-lg resize-none"
                  style={{
                    color: 'var(--texto-primario)',
                    border: '1px solid var(--borde-fuerte)',
                    minHeight: 280,
                    background: 'var(--superficie-app)',
                    tabSize: 2,
                  }}
                  spellCheck={false}
                />
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => setVariablesHtmlAbierto(!variablesHtmlAbierto)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex items-center justify-center size-7 rounded-md transition-colors hover:bg-[var(--superficie-hover)]"
                    style={{ color: variablesHtmlAbierto ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}
                    type="button"
                    title="Insertar variable"
                  >
                    <Braces size={14} />
                  </button>
                  <SelectorVariables
                    abierto={variablesHtmlAbierto}
                    onCerrar={() => setVariablesHtmlAbierto(false)}
                    onSeleccionar={insertarVariableHtml}
                    posicion="abajo"
                    contexto={contextoVariables}
                  />
                </div>
              </div>
            </div>

            {/* Referencia rápida HTML — botones con etiqueta visible */}
            <div className="flex flex-wrap items-center gap-1.5 px-1" style={{ color: 'var(--texto-terciario)' }}>
              {[
                { tag: '<p>...</p>', codigo: '<p>', desc: 'Párrafo' },
                { tag: '<br/>', codigo: '<br/>', desc: 'Salto' },
                { tag: '<strong>...</strong>', codigo: '<strong>', desc: 'Negrita' },
                { tag: '<em>...</em>', codigo: '<em>', desc: 'Cursiva' },
                { tag: '<u>...</u>', codigo: '<u>', desc: 'Subrayado' },
                { tag: '<a href="">...</a>', codigo: '<a>', desc: 'Enlace' },
                { tag: '<ul><li>...</li></ul>', codigo: '<ul>', desc: 'Lista' },
                { tag: '<ol><li>...</li></ol>', codigo: '<ol>', desc: 'Lista num.' },
                { tag: '<h1>...</h1>', codigo: '<h1>', desc: 'Título' },
                { tag: '<h2>...</h2>', codigo: '<h2>', desc: 'Subtítulo' },
                { tag: '<h3>...</h3>', codigo: '<h3>', desc: 'Encabezado' },
                { tag: '<hr/>', codigo: '<hr/>', desc: 'Línea' },
              ].map(({ tag, codigo, desc }) => (
                <button
                  key={tag}
                  type="button"
                  title={`${desc} — ${tag}`}
                  onClick={() => {
                    const ta = htmlTextareaRef.current
                    if (!ta) return
                    const inicio = ta.selectionStart ?? htmlCrudo.length
                    const fin = ta.selectionEnd ?? htmlCrudo.length
                    const seleccion = htmlCrudo.slice(inicio, fin)
                    const insertar = seleccion ? tag.replace('...', seleccion) : tag
                    const nuevo = htmlCrudo.slice(0, inicio) + insertar + htmlCrudo.slice(fin)
                    setHtmlCrudo(nuevo)
                    requestAnimationFrame(() => {
                      ta.focus()
                      const pos = inicio + insertar.length
                      ta.setSelectionRange(pos, pos)
                    })
                  }}
                  className="flex items-center gap-1 text-xxs px-1.5 py-1 rounded transition-colors hover:bg-[var(--superficie-hover)] hover:text-[var(--texto-primario)]"
                  style={{ border: '1px solid var(--borde-sutil)' }}
                >
                  <span className="font-mono" style={{ color: 'var(--texto-marca)', opacity: 0.7 }}>{codigo}</span>
                  <span>{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ TAB VISTA PREVIA ═══════════ */}
        {tabActivo === 'preview' && (
          <div className="space-y-4">
            {/* Asunto resuelto */}
            {asunto.trim() && (
              <div className="px-4 py-2.5 rounded-lg" style={{ border: '1px solid var(--borde-sutil)' }}>
                <span className="text-xxs uppercase tracking-wider font-semibold mr-2" style={{ color: 'var(--texto-terciario)' }}>Asunto:</span>
                <span className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>{resolverPreview(asunto)}</span>
              </div>
            )}

            {/* Contenido resuelto */}
            <div className="px-4 py-3 rounded-lg" style={{ border: '1px solid var(--borde-sutil)', minHeight: 220 }}>
              <div
                className="text-sm leading-relaxed [&_p]:my-2 [&_p:empty]:my-2 [&_p:empty]:min-h-[1em] [&_br]:block [&_br]:content-[''] [&_br]:my-1"
                style={{ color: 'var(--texto-primario)' }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(resolverPreview(contenidoHtml) || '<span style="opacity: 0.4">Sin contenido</span>', { FORBID_TAGS: ['script', 'object', 'embed', 'form', 'iframe'], FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'] }),
                }}
              />
            </div>

            {/* Nota */}
            <p className="text-xxs text-center" style={{ color: 'var(--texto-terciario)' }}>
              {contactoPreview && documentoPreview
                ? `Datos reales de "${`${contactoPreview.nombre} ${contactoPreview.apellido || ''}`.trim()}" y documento ${documentoPreview.numero}.`
                : contactoPreview
                  ? `Datos reales de "${`${contactoPreview.nombre} ${contactoPreview.apellido || ''}`.trim()}". Documento de ejemplo.`
                  : documentoPreview
                    ? `Contacto de ejemplo. Documento real ${documentoPreview.numero}.`
                    : 'Datos de ejemplo. Elegí un contacto o documento arriba para ver con datos reales.'
              }
            </p>
          </div>
        )}

      </div>
    </Modal>
  )
}
