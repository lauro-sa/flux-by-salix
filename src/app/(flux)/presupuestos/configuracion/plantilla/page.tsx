'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, RotateCcw, Eye, Code, ChevronDown,
  FileText, User, Building2, Hash, Calculator, Braces,
  Minimize2,
} from 'lucide-react'
import {
  renderizarHtml,
  DATOS_MUESTRA,
  EMPRESA_MUESTRA,
  type DatosPresupuestoPdf,
  type DatosEmpresa,
  type ConfigPdf,
} from '@/lib/pdf/renderizar-html'
import { PLANTILLA_PDF_DEFECTO } from '@/lib/pdf/plantilla-defecto'
import { useFormato } from '@/hooks/useFormato'
import { A4_ANCHO, A4_ALTO } from '@/lib/pdf/constantes'
import { COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { TextArea } from '@/componentes/ui/TextArea'
import type {
  ConfigMembrete, ConfigPiePagina, ConfigDatosEmpresaPdf,
  LineaPresupuesto, CuotaPago,
} from '@/tipos/presupuesto'

/**
 * Editor de plantilla PDF a pantalla completa.
 * Izquierda: editor de código HTML con panel de variables.
 * Derecha: vista previa en vivo con proporción A4.
 * Se puede seleccionar un presupuesto real para previsualizar.
 */

// ─── Variables agrupadas para el panel lateral ───

const GRUPOS_VARIABLES = [
  {
    grupo: 'Documento',
    icono: FileText,
    variables: [
      { var: '{numero}', desc: 'Número (P-0001)' },
      { var: '{tipo_documento}', desc: 'Tipo' },
      { var: '{fecha_emision}', desc: 'Fecha emisión' },
      { var: '{fecha_vencimiento}', desc: 'Vencimiento' },
      { var: '{moneda_simbolo}', desc: 'Símbolo ($)' },
      { var: '{moneda_codigo}', desc: 'Código (ARS)' },
      { var: '{referencia}', desc: 'Referencia' },
      { var: '{estado}', desc: 'Estado' },
      { var: '{condicion_pago}', desc: 'Condición de pago' },
      { var: '{nota_plan_pago}', desc: 'Nota plan de pago' },
    ],
  },
  {
    grupo: 'Contacto',
    icono: User,
    variables: [
      { var: '{contacto_nombre}', desc: 'Nombre completo' },
      { var: '{contacto_identificacion}', desc: 'CUIT/RUT/RFC' },
      { var: '{contacto_condicion_fiscal}', desc: 'Condición fiscal' },
      { var: '{contacto_direccion}', desc: 'Dirección' },
      { var: '{contacto_correo}', desc: 'Correo' },
      { var: '{contacto_telefono}', desc: 'Teléfono' },
    ],
  },
  {
    grupo: 'Dirigido a',
    icono: User,
    variables: [
      { var: '{atencion_nombre}', desc: 'Nombre' },
      { var: '{atencion_cargo}', desc: 'Cargo' },
      { var: '{atencion_correo}', desc: 'Correo' },
    ],
  },
  {
    grupo: 'Empresa',
    icono: Building2,
    variables: [
      { var: '{empresa_nombre}', desc: 'Razón social' },
      { var: '{empresa_identificacion}', desc: 'CUIT/RUT/RFC' },
      { var: '{empresa_condicion_fiscal}', desc: 'Condición fiscal' },
      { var: '{empresa_direccion}', desc: 'Dirección' },
      { var: '{empresa_telefono}', desc: 'Teléfono' },
      { var: '{empresa_correo}', desc: 'Correo' },
      { var: '{empresa_logo_url}', desc: 'URL del logo' },
    ],
  },
  {
    grupo: 'Totales',
    icono: Calculator,
    variables: [
      { var: '{subtotal_neto_formateado}', desc: 'Subtotal neto' },
      { var: '{total_impuestos_formateado}', desc: 'Total impuestos' },
      { var: '{descuento_global_porcentaje}', desc: 'Descuento %' },
      { var: '{descuento_global_monto_formateado}', desc: 'Descuento monto' },
      { var: '{total_final_formateado}', desc: 'Total final' },
    ],
  },
  {
    grupo: 'Bloques',
    icono: Braces,
    variables: [
      { var: '{{#if variable}}...{{/if}}', desc: 'Condicional' },
      { var: '{{#each lineas}}...{{/each}}', desc: 'Loop líneas' },
      { var: '{{#each cuotas}}...{{/each}}', desc: 'Loop cuotas' },
      { var: '{{#each impuestos_desglose}}...{{/each}}', desc: 'Loop impuestos' },
    ],
  },
]

// Tipo para presupuesto del selector
interface PresupuestoResumen {
  id: string
  numero: string
  contacto_nombre: string | null
  contacto_apellido: string | null
  estado: string
  total_final: string
  moneda: string
}

export default function EditorPlantillaPdf() {
  const router = useRouter()
  const { locale } = useFormato()
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Estado principal
  const [codigo, setCodigo] = useState('')
  const [codigoOriginal, setCodigoOriginal] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(true)
  const [cargando, setCargando] = useState(true)

  // Configuración de la empresa para la preview
  const [configPdf, setConfigPdf] = useState<ConfigPdf>({
    membrete: null, pie_pagina: null, plantilla_html: null,
    patron_nombre_pdf: null, datos_empresa_pdf: null, monedas: [],
  })
  const [datosEmpresa, setDatosEmpresa] = useState<DatosEmpresa>(EMPRESA_MUESTRA)

  // Selector de presupuesto
  const [presupuestos, setPresupuestos] = useState<PresupuestoResumen[]>([])
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState<string>('')
  const [datosPreview, setDatosPreview] = useState<DatosPresupuestoPdf>(DATOS_MUESTRA)
  const [cargandoPresupuesto, setCargandoPresupuesto] = useState(false)

  // UI
  const [panelVariables, setPanelVariables] = useState(true)
  const [grupoAbierto, setGrupoAbierto] = useState<string>('Documento')
  const [vistaActiva, setVistaActiva] = useState<'editor' | 'preview'>('editor')
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [escalaPreview, setEscalaPreview] = useState(0.5)
  const [alturaIframe, setAlturaIframe] = useState(A4_ALTO) // A4 a 96dpi
  // En mobile se alterna entre editor y preview, en desktop se ven los dos

  // ─── Escalar preview proporcionalmente al contenedor ───

  useEffect(() => {
    const contenedor = previewContainerRef.current
    if (!contenedor) return

    const calcularEscala = () => {
      const anchoDisponible = contenedor.clientWidth - 48
      const altoDisponible = contenedor.clientHeight - 48
      const escalaAncho = anchoDisponible / A4_ANCHO
      const escalaAlto = altoDisponible / A4_ALTO
      setEscalaPreview(Math.min(1, escalaAncho, escalaAlto))
    }

    calcularEscala()
    const observer = new ResizeObserver(calcularEscala)
    observer.observe(contenedor)
    return () => observer.disconnect()
  }, [])

  // ─── Carga inicial ───

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Cargar config de presupuestos
        const resConfig = await fetch('/api/presupuestos/config')
        const config = await resConfig.json()

        const plantillaGuardada = config.plantilla_html || ''
        setCodigo(plantillaGuardada)
        setCodigoOriginal(plantillaGuardada)

        setConfigPdf({
          membrete: config.membrete || null,
          pie_pagina: config.pie_pagina || null,
          plantilla_html: plantillaGuardada || null,
          patron_nombre_pdf: config.patron_nombre_pdf || null,
          datos_empresa_pdf: config.datos_empresa_pdf || null,
          monedas: config.monedas || [],
        })

        // Cargar datos de la empresa actual para la preview (directo de Supabase)
        try {
          const supabase = crearClienteNavegador()
          const { data: { user } } = await supabase.auth.getUser()
          const empresaId = user?.app_metadata?.empresa_activa_id
          if (empresaId) {
            const { data: emp } = await supabase
              .from('empresas')
              .select('*')
              .eq('id', empresaId)
              .single()
            if (emp) {
              // Obtener URL del logo desde Storage
              let logoUrl = emp.logo_url || null
              try {
                const tipoLogo = config.membrete?.tipo_logo || 'cuadrado'
                const { data: logoData } = supabase.storage
                  .from('logos')
                  .getPublicUrl(`${empresaId}/${tipoLogo}.png`)
                if (logoData?.publicUrl) logoUrl = logoData.publicUrl
              } catch { /* usar logo_url original */ }

              setDatosEmpresa({
                nombre: emp.nombre || EMPRESA_MUESTRA.nombre,
                logo_url: logoUrl,
                datos_fiscales: emp.datos_fiscales || null,
                pais: emp.pais || 'AR',
                paises: emp.paises || ['AR'],
                color_marca: emp.color_marca || COLOR_MARCA_DEFECTO,
                direccion: emp.ubicacion || '',
                telefono: emp.telefono || '',
                correo: emp.correo || '',
                pagina_web: emp.pagina_web || '',
              })
            }
          }
        } catch { /* Usar datos de muestra */ }

        // Cargar lista de presupuestos para el selector
        try {
          const resPres = await fetch('/api/presupuestos?por_pagina=20&orden_dir=desc')
          if (resPres.ok) {
            const data = await resPres.json()
            setPresupuestos(data.presupuestos || [])
          }
        } catch { /* Sin presupuestos */ }
      } catch {
        /* Error de carga */
      } finally {
        setCargando(false)
      }
    }
    cargarDatos()
  }, [])

  // ─── Guardar con debounce ───

  const guardarPlantilla = useCallback(async (html: string) => {
    setGuardando(true)
    try {
      await fetch('/api/presupuestos/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantilla_html: html || null }),
      })
      setCodigoOriginal(html)
      setGuardado(true)
    } catch { /* Error al guardar */ }
    setGuardando(false)
  }, [])

  const manejarCambio = useCallback((nuevoHtml: string) => {
    setCodigo(nuevoHtml)
    setGuardado(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => guardarPlantilla(nuevoHtml), 1500)
  }, [guardarPlantilla])

  // ─── Cargar presupuesto seleccionado ───

  const cargarPresupuesto = useCallback(async (id: string) => {
    if (!id) {
      setDatosPreview(DATOS_MUESTRA)
      setPresupuestoSeleccionado('')
      return
    }
    setCargandoPresupuesto(true)
    setPresupuestoSeleccionado(id)
    try {
      const res = await fetch(`/api/presupuestos/${id}`)
      if (res.ok) {
        const p = await res.json()
        setDatosPreview({
          numero: p.numero,
          estado: p.estado,
          fecha_emision: p.fecha_emision,
          fecha_emision_original: p.fecha_emision_original || null,
          fecha_vencimiento: p.fecha_vencimiento,
          moneda: p.moneda,
          moneda_simbolo: '',
          referencia: p.referencia,
          condicion_pago_label: p.condicion_pago_label,
          nota_plan_pago: p.nota_plan_pago,
          contacto_nombre: p.contacto_nombre,
          contacto_apellido: p.contacto_apellido,
          contacto_identificacion: p.contacto_identificacion,
          contacto_condicion_iva: p.contacto_condicion_iva,
          contacto_direccion: p.contacto_direccion,
          contacto_correo: p.contacto_correo,
          contacto_telefono: p.contacto_telefono,
          atencion_nombre: p.atencion_nombre,
          atencion_cargo: p.atencion_cargo,
          atencion_correo: p.atencion_correo,
          subtotal_neto: p.subtotal_neto,
          total_impuestos: p.total_impuestos,
          descuento_global: p.descuento_global,
          descuento_global_monto: p.descuento_global_monto,
          total_final: p.total_final,
          notas_html: p.notas_html,
          condiciones_html: p.condiciones_html,
          lineas: (p.lineas || []) as LineaPresupuesto[],
          cuotas: (p.cuotas || []) as CuotaPago[],
        })
      }
    } catch { /* Error al cargar */ }
    setCargandoPresupuesto(false)
  }, [])

  // Texto efectivo: si el usuario no personalizó, se muestra la plantilla por defecto
  const codigoEfectivo = codigo || PLANTILLA_PDF_DEFECTO

  // ─── Insertar variable en el editor ───

  const insertarVariable = useCallback((variable: string) => {
    const textarea = editorRef.current
    if (!textarea) return
    const inicio = textarea.selectionStart
    const fin = textarea.selectionEnd
    const textoActual = codigoEfectivo
    const nuevo = textoActual.substring(0, inicio) + variable + textoActual.substring(fin)
    manejarCambio(nuevo)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(inicio + variable.length, inicio + variable.length)
    }, 0)
  }, [codigoEfectivo, manejarCambio])

  // ─── Vista previa renderizada ───

  const htmlPreview = useMemo(() => {
    const cfgConPlantilla: ConfigPdf = {
      ...configPdf,
      plantilla_html: codigo || null,
    }
    try {
      return renderizarHtml(datosPreview, datosEmpresa, cfgConPlantilla, locale)
    } catch {
      return '<div style="padding:40px;color:#ef4444;font-family:sans-serif"><h2>Error en la plantilla</h2><p>Revisá el HTML, puede haber un bloque sin cerrar.</p></div>'
    }
  }, [codigo, datosPreview, datosEmpresa, configPdf, locale])

  // ─── HTML con padding embebido para simular márgenes del PDF ───
  const htmlConMargenes = useMemo(() => {
    // Ya tiene padding en el body via CSS de la plantilla
    return htmlPreview
  }, [htmlPreview])

  // ─── Restaurar por defecto ───

  const restaurarDefecto = useCallback(() => {
    setCodigo('')
    setGuardado(false)
    guardarPlantilla('')
  }, [guardarPlantilla])

  // ─── Keyboard shortcuts ───

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (debounceRef.current) clearTimeout(debounceRef.current)
        guardarPlantilla(codigo)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [codigo, guardarPlantilla])

  if (cargando) {
    return (
      <div className="fixed inset-0 z-50 bg-superficie-app flex items-center justify-center">
        <p className="text-sm text-texto-terciario">Cargando editor...</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-superficie-app flex flex-col">

      {/* ═══ BARRA SUPERIOR ═══ */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-borde-sutil bg-superficie-tarjeta shrink-0">
        {/* Izquierda: volver + título */}
        <div className="flex items-center gap-3 min-w-0">
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Volver" icono={<ArrowLeft size={18} />} onClick={() => router.push('/presupuestos/configuracion')} />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-texto-primario truncate">Editor de plantilla PDF</h1>
            <p className="text-xs text-texto-terciario truncate">
              {guardando ? 'Guardando...' : guardado ? 'Guardado' : 'Sin guardar'}
              {codigo === '' && ' · Usando plantilla por defecto'}
            </p>
          </div>
        </div>

        {/* Centro: selector de presupuesto */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-texto-terciario hidden sm:block">Previsualizar con:</span>
          <Select
              valor={presupuestoSeleccionado}
              onChange={(v) => cargarPresupuesto(v)}
              opciones={[
                { valor: '', etiqueta: 'Datos de muestra' },
                ...presupuestos.map(p => ({
                  valor: p.id,
                  etiqueta: `${p.numero} — ${[p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ') || 'Sin contacto'}`,
                })),
              ]}
              className="min-w-[180px]"
            />
          {cargandoPresupuesto && <span className="text-xs text-texto-terciario">Cargando...</span>}
        </div>

        {/* Derecha: acciones */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Toggle mobile: editor / preview */}
          <div className="flex sm:hidden border border-borde-sutil rounded-lg overflow-hidden">
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<Code size={14} />} titulo="Editor" onClick={() => setVistaActiva('editor')}
              className={vistaActiva === 'editor' ? 'bg-marca-500/10 text-texto-marca' : 'text-texto-terciario'} />
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<Eye size={14} />} titulo="Vista previa" onClick={() => setVistaActiva('preview')}
              className={vistaActiva === 'preview' ? 'bg-marca-500/10 text-texto-marca' : 'text-texto-terciario'} />
          </div>

          <Boton variante={panelVariables ? 'secundario' : 'fantasma'} tamano="xs" icono={<Hash size={13} />} onClick={() => setPanelVariables(!panelVariables)} className={`hidden sm:flex ${panelVariables ? 'bg-marca-500/10 text-texto-marca border-marca-500/30' : ''}`}>
            Variables
          </Boton>

          <Boton variante="secundario" tamano="xs" icono={<RotateCcw size={13} />} onClick={restaurarDefecto}>Default</Boton>

          <Boton variante="primario" tamano="xs" icono={<Save size={13} />} onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); guardarPlantilla(codigo) }} disabled={guardando || guardado}>Guardar</Boton>

          <Boton variante="fantasma" tamano="xs" soloIcono icono={<Minimize2 size={15} />} onClick={() => router.push('/presupuestos/configuracion')} titulo="Cerrar editor" className="hidden sm:flex" />
        </div>
      </div>

      {/* ═══ CUERPO: Editor + Preview ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Panel izquierdo: Variables (collapsible) ── */}
        {panelVariables && (
          <div className="hidden sm:flex flex-col w-[220px] border-r border-borde-sutil bg-superficie-tarjeta overflow-y-auto shrink-0">
            <div className="px-3 py-2.5 border-b border-borde-sutil">
              <p className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Variables</p>
              <p className="text-xxs text-texto-terciario mt-0.5">Clic para insertar en el editor</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {GRUPOS_VARIABLES.map(({ grupo, icono: Icono, variables }) => (
                <div key={grupo}>
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    anchoCompleto
                    icono={<Icono size={12} className="text-texto-terciario shrink-0" />}
                    iconoDerecho={<ChevronDown size={11} className={`text-texto-terciario transition-transform ${grupoAbierto === grupo ? 'rotate-180' : ''}`} />}
                    onClick={() => setGrupoAbierto(grupoAbierto === grupo ? '' : grupo)}
                    className="px-3 py-2 text-left text-texto-secundario"
                  >
                    <span className="flex-1 text-left">{grupo}</span>
                  </Boton>
                  {grupoAbierto === grupo && (
                    <div className="pb-1">
                      {variables.map(({ var: v, desc }) => (
                        <Boton
                          key={v}
                          variante="fantasma"
                          tamano="xs"
                          onClick={() => insertarVariable(v)}
                          titulo={`Insertar ${v}`}
                          className="w-full text-left px-3 py-1 h-auto group"
                        >
                          <div className="w-full">
                            <code className="text-xxs font-mono text-texto-marca group-hover:text-marca-600 block truncate">{v}</code>
                            <span className="text-xxs text-texto-terciario block">{desc}</span>
                          </div>
                        </Boton>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Editor de código ── */}
        <div className={`flex-1 flex flex-col min-w-0 ${vistaActiva !== 'editor' ? 'hidden sm:flex' : 'flex'}`}>
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-borde-sutil bg-superficie-app/50 shrink-0">
            <Code size={13} className="text-texto-terciario" />
            <span className="text-xs font-medium text-texto-terciario">HTML</span>
            <span className="text-xxs text-texto-terciario ml-auto">
              {codigoEfectivo.length} caracteres{!codigo && ' · por defecto'}
            </span>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <TextArea
              ref={editorRef}
              value={codigoEfectivo}
              onChange={(e) => manejarCambio(e.target.value)}
              spellCheck={false}
              monoespacio
              variante="transparente"
              className="absolute inset-0 w-full h-full p-4 bg-superficie-codigo text-texto-codigo text-xs leading-[1.7] resize-none selection:bg-marca-500/30 tab-size-2"
              style={{ tabSize: 2 }}
            />
          </div>
        </div>

        {/* ── Separador ── */}
        <div className="hidden sm:block w-px bg-borde-sutil shrink-0" />

        {/* ── Vista previa A4 ── */}
        <div className={`flex-1 flex flex-col min-w-0 bg-[#e5e5e5] dark:bg-[#2a2a2a] ${vistaActiva !== 'preview' ? 'hidden sm:flex' : 'flex'}`}>
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-borde-sutil bg-superficie-app/50 shrink-0">
            <Eye size={13} className="text-texto-terciario" />
            <span className="text-xs font-medium text-texto-terciario">Vista previa</span>
            <span className="text-xxs text-texto-terciario ml-auto">
              {Math.round(escalaPreview * 100)}%
              {presupuestoSeleccionado && ` · ${presupuestos.find(p => p.id === presupuestoSeleccionado)?.numero}`}
            </span>
          </div>
          <div ref={previewContainerRef} className="flex-1 min-h-0 overflow-auto bg-[#3a3a3a] dark:bg-[#1a1a1a]">
            <div className="flex justify-center py-6 px-4">
              <div
                style={{
                  width: Math.floor(A4_ANCHO * escalaPreview),
                  height: Math.floor(alturaIframe * escalaPreview),
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <iframe
                  ref={iframeRef}
                  srcDoc={htmlConMargenes}
                  title="Vista previa PDF"
                  className="border-0 bg-white shadow-elevada rounded-sm"
                  style={{
                    width: A4_ANCHO,
                    height: alturaIframe,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transformOrigin: 'top left',
                    transform: `scale(${escalaPreview})`,
                  }}
                  onLoad={(e) => {
                    try {
                      const doc = e.currentTarget.contentDocument
                      if (doc?.body) {
                        const h = Math.max(A4_ALTO, doc.documentElement.scrollHeight)
                        setAlturaIframe(h)
                      }
                    } catch {}
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
