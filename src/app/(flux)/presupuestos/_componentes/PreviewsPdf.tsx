'use client'

/**
 * Componentes de vista previa miniatura para configuración de membrete y pie de página.
 * Portado del viejo SalixCRM: misma lógica de EncabezadoMiniatura, CuerpoDocumentoSimulado,
 * PiePaginaMiniatura, PreviewMembrete y PreviewPiePagina.
 * Se usa en: configuración de presupuestos (secciones membrete y pie de página).
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import DOMPurify from 'isomorphic-dompurify'
import type { ConfigMembrete, ConfigPiePagina } from '@/tipos/presupuesto'

// Opciones de sanitización para HTML del membrete/pie de página
const OPCIONES_SANITIZACION = {
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'iframe'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
}

// Ancho real del contenido del PDF (A4 210mm - 15mm*2 márgenes = 180mm ≈ 510px a 72dpi)
const ANCHO_PDF = 510

/**
 * Hook que calcula la escala para que un contenedor de ANCHO_PDF
 * entre proporcionalmente en el espacio disponible.
 */
function useEscalaPdf(ref: React.RefObject<HTMLDivElement | null>) {
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const calcular = () => {
      const disponible = el.clientWidth
      setEscala(Math.min(disponible / ANCHO_PDF, 1))
    }
    calcular()
    const obs = new ResizeObserver(calcular)
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
  return escala
}

// ─── Encabezado miniatura ───

function EncabezadoMiniatura({
  logoUrl,
  membrete,
}: {
  logoUrl: string | null
  membrete: ConfigMembrete
}) {
  const tieneContenido = membrete.contenido_html && membrete.contenido_html.trim()
  const alineacionCSS = membrete.alineacion_texto === 'derecha' ? 'text-right' : membrete.alineacion_texto === 'centro' ? 'text-center' : 'text-left'
  const mostrarImagen = membrete.mostrar_logo && logoUrl
  const esCentro = membrete.posicion_logo === 'centro'

  const alineacionLogo = esCentro ? 'text-center' : membrete.posicion_logo === 'derecha' ? 'text-right' : 'text-left'
  const tieneTextoLogo = membrete.texto_logo && membrete.texto_logo !== '<p></p>'
  const tieneSubtitulo = membrete.subtitulo_logo && membrete.subtitulo_logo !== '<p></p>'
  const tieneLogoOTexto = mostrarImagen || tieneTextoLogo

  // Bloque del logo: imagen O texto+subtítulo (mutuamente excluyentes)
  const bloqueLogo = tieneLogoOTexto ? (
    mostrarImagen ? (
      // Logo imagen — con ancho controlado
      <div className={esCentro ? '' : 'shrink-0'} style={esCentro ? { width: `${membrete.ancho_logo}%`, margin: '0 auto' } : { width: `${membrete.ancho_logo}%` }}>
        <img src={logoUrl} alt="" className="w-full h-auto object-contain" />
      </div>
    ) : (
      // Texto como logo — sin ancho fijo, ocupa lo que necesita
      <div className={`shrink-0 ${alineacionLogo}`}>
        {tieneTextoLogo && (
          <div
            className={`font-bold text-slate-800 leading-none whitespace-nowrap [&_strong]:font-black [&_p]:my-0`}
            style={{ fontSize: `${membrete.tamano_texto_logo || 28}px` }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(membrete.texto_logo, OPCIONES_SANITIZACION) }}
          />
        )}
        {tieneSubtitulo && (
          <div
            className={`text-slate-500 leading-tight [&_p]:my-0`}
            style={{ fontSize: `${membrete.tamano_subtitulo || 10}px`, marginTop: '2px' }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(membrete.subtitulo_logo, OPCIONES_SANITIZACION) }}
          />
        )}
      </div>
    )
  ) : null

  const bloqueTexto = tieneContenido ? (
    <div
      className={`flex-1 min-w-0 text-slate-700 ${alineacionCSS} [&_p]:my-0.5 [&_strong]:font-bold [&_a]:text-blue-600 [&_a]:underline [&_h1]:font-bold [&_h1]:text-lg [&_h2]:font-semibold [&_h2]:text-base [&_h3]:font-medium [&_h3]:text-sm`}
      style={{ lineHeight: 1.3, fontSize: '10px' }}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(membrete.contenido_html, OPCIONES_SANITIZACION) }}
    />
  ) : (
    <div className={`flex-1 min-w-0 ${alineacionCSS}`}>
      <p className="text-slate-400 italic" style={{ fontSize: '7px' }}>El membrete aparecerá aquí...</p>
    </div>
  )

  return (
    <>
      {esCentro ? (
        // Centro: logo arriba, texto abajo, todo centrado
        <div className="text-center">
          {bloqueLogo}
          {tieneContenido && <div style={{ marginTop: '3%' }}>{bloqueTexto}</div>}
        </div>
      ) : (
        // Izquierda/Derecha: logo y texto lado a lado, centrados verticalmente
        <div className={`flex items-center ${membrete.posicion_logo === 'derecha' ? 'flex-row-reverse' : ''}`} style={{ gap: '2.5%' }}>
          {bloqueLogo}
          {bloqueTexto}
        </div>
      )}
      {membrete.linea_separadora && (
        <div style={{
          borderTopWidth: `${membrete.grosor_linea || 1}px`,
          borderTopStyle: 'solid',
          borderTopColor: membrete.color_linea === 'marca' ? 'var(--texto-marca)' : '#d1d5db',
          margin: '3% 0',
        }} />
      )}
    </>
  )
}

// ─── Cuerpo simulado del documento ───

function CuerpoDocumentoSimulado() {
  return (
    <div className="flex-1 flex flex-col" style={{ gap: '2%' }}>
      <div className="flex justify-between items-start">
        <div className="space-y-[3px]">
          <div className="h-[4px] w-16 bg-black/20 dark:bg-white/20 rounded-sm" />
          <div className="h-[3px] w-10 bg-black/10 dark:bg-white/10 rounded-sm" />
        </div>
        <div className="space-y-[3px] text-right">
          <div className="h-[3px] w-12 bg-black/10 dark:bg-white/10 rounded-sm ml-auto" />
          <div className="h-[3px] w-14 bg-black/10 dark:bg-white/10 rounded-sm ml-auto" />
        </div>
      </div>
      <div style={{ marginTop: '3%' }}>
        <div className="flex border-b border-borde-sutil pb-[2px] mb-[3px]" style={{ gap: '3%' }}>
          <div className="h-[3px] w-[8%] bg-black/15 dark:bg-white/15 rounded-sm" />
          <div className="h-[3px] w-[42%] bg-black/15 dark:bg-white/15 rounded-sm" />
          <div className="h-[3px] w-[12%] bg-black/15 dark:bg-white/15 rounded-sm ml-auto" />
          <div className="h-[3px] w-[12%] bg-black/15 dark:bg-white/15 rounded-sm" />
          <div className="h-[3px] w-[14%] bg-black/15 dark:bg-white/15 rounded-sm" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex mb-[3px]" style={{ gap: '3%' }}>
            <div className="h-[2px] w-[8%] bg-black/10 dark:bg-white/10 rounded-sm" />
            <div className="h-[2px] bg-black/10 dark:bg-white/10 rounded-sm" style={{ width: `${30 + i * 5}%` }} />
            <div className="h-[2px] w-[12%] bg-black/10 dark:bg-white/10 rounded-sm ml-auto" />
            <div className="h-[2px] w-[12%] bg-black/10 dark:bg-white/10 rounded-sm" />
            <div className="h-[2px] w-[14%] bg-black/10 dark:bg-white/10 rounded-sm" />
          </div>
        ))}
      </div>
      <div className="flex justify-end" style={{ marginTop: 'auto' }}>
        <div className="w-[35%] space-y-[3px]">
          <div className="flex justify-between">
            <div className="h-[2px] w-[45%] bg-black/10 dark:bg-white/10 rounded-sm" />
            <div className="h-[2px] w-[30%] bg-black/10 dark:bg-white/10 rounded-sm" />
          </div>
          <div className="flex justify-between">
            <div className="h-[2px] w-[45%] bg-black/10 dark:bg-white/10 rounded-sm" />
            <div className="h-[2px] w-[30%] bg-black/10 dark:bg-white/10 rounded-sm" />
          </div>
          <div className="border-t border-borde-sutil pt-[2px] flex justify-between">
            <div className="h-[3px] w-[45%] bg-black/20 dark:bg-white/20 rounded-sm" />
            <div className="h-[3px] w-[30%] bg-black/20 dark:bg-white/20 rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Pie de página miniatura ───

function PiePaginaMiniatura({ piePagina }: { piePagina: ConfigPiePagina | null }) {
  if (!piePagina) return null
  const { linea_superior, columnas } = piePagina
  const todosVacios = columnas.izquierda.tipo === 'vacio' && columnas.centro.tipo === 'vacio' && columnas.derecha.tipo === 'vacio'
  if (todosVacios) return null

  // Sin factor de escala — el contenedor ya es chico, los tamaños se ven proporcionados
  const tamBase = piePagina.tamano_texto ?? 10

  function renderCol(col: typeof columnas.izquierda) {
    const tamCol = col.tamano_texto || tamBase
    if (col.tipo === 'texto') {
      const tieneTexto = col.texto && col.texto !== '<p></p>' && col.texto.replace(/<[^>]*>/g, '').trim()
      return tieneTexto
        ? <span className="[&_p]:my-0 [&_strong]:font-bold [&_*]:!text-inherit" style={{ fontSize: `${tamCol}px` }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(col.texto!, OPCIONES_SANITIZACION) }} />
        : null
    }
    if (col.tipo === 'numeracion') return <span>Página 1 de 2</span>
    if (col.tipo === 'imagen') {
      const tieneUrl = col.imagen_url && col.imagen_url.trim() && !col.imagen_url.includes('undefined')
      const img = tieneUrl
        ? <img src={col.imagen_url} alt="" className="w-4 h-4 object-contain inline-block" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : <div className="w-4 h-4 border border-dashed border-slate-300 rounded-sm inline-flex items-center justify-center"><span className="text-[3px] text-slate-400">IMG</span></div>
      const alinTxt = col.alineacion_texto === 'izquierda' ? 'text-left' : col.alineacion_texto === 'derecha' ? 'text-right' : 'text-center'
      const txt = col.texto_imagen ? <span className={`text-[4px] block ${alinTxt}`}>{col.texto_imagen}</span> : null
      const esArriba = col.posicion_texto === 'arriba'
      return <div className="inline-flex flex-col gap-[1px]">{esArriba && txt}{img}{!esArriba && txt}</div>
    }
    return null
  }

  return (
    <div style={{ marginTop: 'auto' }}>
      {linea_superior && <div style={{ borderTopWidth: `${piePagina.grosor_linea || 1}px`, borderTopStyle: 'solid', borderTopColor: piePagina.color_linea === 'marca' ? 'var(--texto-marca)' : '#d1d5db', margin: '2% 0' }} />}
      <div className="flex items-end justify-between text-slate-500 leading-tight" style={{ fontSize: `${tamBase}px` }}>
        <div className="w-1/3">{renderCol(columnas.izquierda)}</div>
        <div className="w-1/3 text-center">{renderCol(columnas.centro)}</div>
        <div className="w-1/3 text-right">{renderCol(columnas.derecha)}</div>
      </div>
    </div>
  )
}

// ─── Preview membrete (exportado) ───

export function PreviewMembrete({
  logoUrl,
  membrete,
  piePagina,
}: {
  logoUrl: string | null
  membrete: ConfigMembrete
  piePagina: ConfigPiePagina | null
}) {
  const [expandido, setExpandido] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const escala = useEscalaPdf(contenedorRef)

  return (
    <div>
      <p className="text-[10px] font-semibold text-texto-terciario uppercase tracking-wider mb-2">Vista previa</p>
      <div ref={contenedorRef}>
        <div className="flex justify-center" style={{ height: expandido ? `${(ANCHO_PDF * (297 / 210)) * escala}px` : 'auto' }}>
          <motion.div
            className="bg-white rounded-lg shadow-lg border border-borde-sutil overflow-hidden origin-top"
            style={{ width: ANCHO_PDF, transform: `scale(${escala})` }}
            animate={{ height: expandido ? ANCHO_PDF * (297 / 210) : 'auto' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={`flex flex-col ${expandido ? 'h-full' : ''}`} style={{ padding: '24px' }}>
              <EncabezadoMiniatura logoUrl={logoUrl} membrete={membrete} />
              <AnimatePresence>
                {expandido && (
                  <motion.div
                    className="flex-1 flex flex-col"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: 0.15 }}
                  >
                    <CuerpoDocumentoSimulado />
                    <PiePaginaMiniatura piePagina={piePagina} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpandido(e => !e)}
        className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium text-texto-terciario hover:bg-superficie-app transition-colors"
      >
        <ChevronDown size={14} className={`transition-transform duration-300 ${expandido ? 'rotate-180' : ''}`} />
        {expandido ? 'Comprimir' : 'Ver hoja completa'}
      </button>
    </div>
  )
}

// ─── Preview pie de página (exportado) ───

export function PreviewPiePagina({
  piePagina,
  logoUrl,
  membrete,
}: {
  piePagina: ConfigPiePagina
  logoUrl: string | null
  membrete: ConfigMembrete | null
}) {
  const [expandido, setExpandido] = useState(false)
  const { linea_superior, columnas } = piePagina

  const tamBaseGrande = piePagina.tamano_texto ?? 10

  function renderColumna(col: typeof columnas.izquierda, alineacion: 'izquierda' | 'centro' | 'derecha') {
    const clsAlineacion = alineacion === 'derecha' ? 'text-right items-end'
      : alineacion === 'centro' ? 'text-center items-center'
        : 'text-left items-start'
    const tamCol = col.tamano_texto || tamBaseGrande

    if (col.tipo === 'texto') {
      const tieneTexto = col.texto && col.texto !== '<p></p>' && col.texto.replace(/<[^>]*>/g, '').trim()
      return (
        <div className={`flex flex-col ${clsAlineacion} [&_p]:my-0 [&_strong]:font-bold`} style={{ fontSize: `${tamCol}px` }}>
          {tieneTexto
            ? <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(col.texto!, OPCIONES_SANITIZACION) }} />
            : <span className="text-texto-terciario italic">Texto...</span>}
        </div>
      )
    }
    if (col.tipo === 'imagen') {
      const tieneUrl = col.imagen_url && col.imagen_url.trim() && !col.imagen_url.includes('undefined')
      const img = tieneUrl
        ? <img src={col.imagen_url} alt="" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : <div className="w-7 h-7 border border-dashed border-borde-sutil rounded-sm flex items-center justify-center"><span className="text-texto-terciario text-[6px]">IMG</span></div>
      const alinTxt = col.alineacion_texto === 'izquierda' ? 'text-left' : col.alineacion_texto === 'derecha' ? 'text-right' : 'text-center'
      const txt = col.texto_imagen ? <span className={`block ${alinTxt}`} style={{ fontSize: '0.65em' }}>{col.texto_imagen}</span> : null
      const esArriba = col.posicion_texto === 'arriba'
      return <div className="inline-flex flex-col gap-[2px]">{esArriba && txt}{img}{!esArriba && txt}</div>
    }
    if (col.tipo === 'numeracion') {
      return <div className={`flex flex-col ${clsAlineacion}`}><span>Página 1 de 2</span></div>
    }
    return null
  }

  const piePaginaBloque = (
    <div style={{ marginTop: expandido ? 'auto' : undefined }}>
      {linea_superior && <div style={{ borderTopWidth: `${piePagina.grosor_linea || 1}px`, borderTopStyle: 'solid', borderTopColor: piePagina.color_linea === 'marca' ? 'var(--texto-marca)' : '#d1d5db', marginBottom: expandido ? '2%' : 8 }} />}
      <div className="flex items-end justify-between text-slate-600 leading-tight gap-2" style={{ fontSize: `${tamBaseGrande}px` }}>
        <div className="w-1/3">{renderColumna(columnas.izquierda, 'izquierda')}</div>
        <div className="w-1/3 flex flex-col items-center text-center">{renderColumna(columnas.centro, 'centro')}</div>
        <div className="w-1/3 flex flex-col items-end text-right">{renderColumna(columnas.derecha, 'derecha')}</div>
      </div>
    </div>
  )

  const contenedorRef = useRef<HTMLDivElement>(null)
  const escala = useEscalaPdf(contenedorRef)

  return (
    <div>
      <p className="text-[10px] font-semibold text-texto-terciario uppercase tracking-wider mb-2">Vista previa</p>
      <div ref={contenedorRef}>
        <div className="flex justify-center" style={{ height: expandido ? `${(ANCHO_PDF * (297 / 210)) * escala}px` : 'auto' }}>
          <motion.div
            className="bg-white rounded-lg shadow-lg border border-borde-sutil overflow-hidden origin-top"
            style={{ width: ANCHO_PDF, transform: `scale(${escala})` }}
            animate={{ height: expandido ? ANCHO_PDF * (297 / 210) : 'auto' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={`flex flex-col ${expandido ? 'h-full' : ''}`} style={{ padding: '24px' }}>
              <AnimatePresence>
                {expandido && membrete && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <EncabezadoMiniatura logoUrl={logoUrl} membrete={membrete} />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {expandido && (
                  <motion.div className="flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.1 }}>
                    <CuerpoDocumentoSimulado />
                  </motion.div>
                )}
              </AnimatePresence>
              {piePaginaBloque}
            </div>
          </motion.div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpandido(e => !e)}
        className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium text-texto-terciario hover:bg-superficie-app transition-colors"
      >
        <ChevronDown size={14} className={`transition-transform duration-300 ${expandido ? 'rotate-180' : ''}`} />
        {expandido ? 'Comprimir' : 'Ver hoja completa'}
      </button>
    </div>
  )
}
