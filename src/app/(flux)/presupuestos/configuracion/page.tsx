'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Receipt, DollarSign,
  Ruler, Clock, Hash, FileText, RotateCcw, Package,
  Image, PanelBottom, Code2, FileType, Landmark,
  X,
} from 'lucide-react'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { A4_ANCHO, A4_ALTO } from '@/lib/pdf/constantes'
import { useFormato } from '@/hooks/useFormato'
import EditorNotasPresupuesto from '../_componentes/EditorNotasPresupuesto'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'
import type {
  Impuesto, Moneda, UnidadMedida,
  ConfigMembrete, ConfigPiePagina, ConfigDatosEmpresaPdf,
  TipoColumnaPie,
} from '@/tipos/presupuesto'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'
import { obtenerEntidad } from '@/lib/variables/registro'
import '@/lib/variables/entidades'
import {
  renderizarHtml,
  generarNombreArchivo,
  DATOS_MUESTRA,
  EMPRESA_MUESTRA,
  type DatosEmpresa,
  type ConfigPdf,
} from '@/lib/pdf/renderizar-html'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useTraduccion } from '@/lib/i18n'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { Input } from '@/componentes/ui/Input'
import { Checkbox } from '@/componentes/ui/Checkbox'
import { ListaConfiguracion } from '@/componentes/ui/ListaConfiguracion'
import { ModalItemConfiguracion } from '@/componentes/ui/ModalItemConfiguracion'
import SubirImagenPie from '../_componentes/SubirImagenPie'

/**
 * Página de configuración de presupuestos.
 * Usa PlantillaConfiguracion para layout consistente.
 * Autoguardado al cambiar cualquier campo.
 * Drag & drop en condiciones de pago para reordenar.
 */

// Defaults para restablecer
const IMPUESTOS_DEFAULT: Impuesto[] = [
  { id: 'iva21', label: 'IVA 21%', porcentaje: 21, activo: true },
  { id: 'iva105', label: 'IVA 10.5%', porcentaje: 10.5, activo: true },
  { id: 'exento', label: 'Exento', porcentaje: 0, activo: true },
  { id: 'no_gravado', label: 'No Gravado', porcentaje: 0, activo: true },
]

const MONEDAS_DEFAULT: Moneda[] = [
  { id: 'ARS', label: 'Peso Argentino', simbolo: '$', activo: true },
  { id: 'USD', label: 'Dólar', simbolo: 'US$', activo: true },
  { id: 'EUR', label: 'Euro', simbolo: '€', activo: true },
]

const UNIDADES_DEFAULT: UnidadMedida[] = [
  { id: 'un', label: 'Unidad', abreviatura: 'un' },
  { id: 'hs', label: 'Hora', abreviatura: 'hs' },
  { id: 'kg', label: 'Kilogramo', abreviatura: 'kg' },
  { id: 'm', label: 'Metro', abreviatura: 'm' },
  { id: 'm2', label: 'Metro cuadrado', abreviatura: 'm²' },
  { id: 'lt', label: 'Litro', abreviatura: 'lt' },
  { id: 'gl', label: 'Global', abreviatura: 'gl' },
]

// Defaults para configuración PDF
const MEMBRETE_DEFAULT: ConfigMembrete = {
  mostrar_logo: true,
  tipo_logo: 'cuadrado',
  posicion_logo: 'izquierda',
  ancho_logo: 30,
  texto_logo: '',
  tamano_texto_logo: 16,
  subtitulo_logo: '',
  tamano_subtitulo: 10,
  contenido_html: '',
  alineacion_texto: 'derecha',
  tamano_texto: 11,
  linea_separadora: true,
  grosor_linea: 1,
  color_linea: 'gris',
}

const PIE_PAGINA_DEFAULT: ConfigPiePagina = {
  linea_superior: true,
  grosor_linea: 1,
  color_linea: 'gris',
  tamano_texto: 10,
  columnas: {
    izquierda: { tipo: 'texto', texto: '' },
    centro: { tipo: 'vacio' },
    derecha: { tipo: 'numeracion' },
  },
}

const DATOS_EMPRESA_PDF_DEFAULT: ConfigDatosEmpresaPdf = {
  mostrar_razon_social: true,
  mostrar_identificacion: true,
  mostrar_condicion_fiscal: true,
  mostrar_direccion: true,
  mostrar_telefono: true,
  mostrar_correo: true,
  mostrar_pagina_web: false,
  mostrar_datos_bancarios: false,
  datos_bancarios: { banco: '', titular: '', numero_cuenta: '', cbu: '', alias: '' },
  usar_datos_empresa: true,
}

// ─── Segmentos para el nombre del archivo PDF ───
// Cada segmento es una variable con un separador previo (el primero no tiene separador)
interface SegmentoNombrePdf {
  variable: string  // 'presupuesto.numero', 'contacto.nombre_completo', etc.
  separador: string // ' – ', ', ', ' - ', etc. (vacío para el primero)
}

const SEPARADORES_DISPONIBLES = [' – ', ', ', ' - ', ' _ ', ' · ', ' | ']

// Mapeo de variables legacy {var} → {{entidad.campo}}
const MAPA_LEGACY: Record<string, string> = {
  numero: 'presupuesto.numero',
  contacto_nombre: 'contacto.nombre_completo',
  fecha: 'presupuesto.fecha_emision',
  referencia: 'presupuesto.referencia',
  atencion_nombre: 'dirigido_a.nombre_completo',
  atencion_cargo: 'dirigido_a.cargo',
  tipo: 'presupuesto.estado',
}

// Parsea un patrón string en segmentos visuales
function parsearPatronASegmentos(patron: string): SegmentoNombrePdf[] {
  if (!patron) return [{ variable: 'presupuesto.numero', separador: '' }]

  let plantilla = patron

  // Convertir formato legacy {var} → {{entidad.campo}}
  if (!plantilla.includes('{{') && plantilla.includes('{')) {
    for (const [legacy, nuevo] of Object.entries(MAPA_LEGACY)) {
      plantilla = plantilla.replace(new RegExp(`\\{${legacy}\\}`, 'g'), `{{${nuevo}}}`)
    }
  }

  const segmentos: SegmentoNombrePdf[] = []

  // Extraer primera variable suelta (sin corchetes condicionales)
  const matchPrimera = plantilla.match(/^([^\[]*?)\{\{([a-z_]+\.[a-z_]+)\}\}/)
  if (matchPrimera) {
    segmentos.push({ variable: matchPrimera[2], separador: '' })
    plantilla = plantilla.slice(matchPrimera[0].length)
  }

  // Extraer bloques condicionales [separador{{entidad.campo}}]
  const regexBloque = /\[([^\{]*?)\{\{([a-z_]+\.[a-z_]+)\}\}[^\]]*?\]/g
  let match
  while ((match = regexBloque.exec(plantilla)) !== null) {
    segmentos.push({ variable: match[2], separador: match[1] || ' – ' })
  }

  // Si no se parseó nada, extraer variables sueltas separadas por texto
  if (segmentos.length === 0) {
    const regexSueltas = /\{\{([a-z_]+\.[a-z_]+)\}\}/g
    let idx = 0
    while ((match = regexSueltas.exec(plantilla)) !== null) {
      const sep = idx === 0 ? '' : ' – '
      segmentos.push({ variable: match[1], separador: sep })
      idx++
    }
  }

  return segmentos.length ? segmentos : [{ variable: 'presupuesto.numero', separador: '' }]
}

// Serializa segmentos a patrón string para guardar en BD
function serializarSegmentos(segmentos: SegmentoNombrePdf[]): string {
  return segmentos.map((s, i) => {
    const variable = `{{${s.variable}}}`
    if (i === 0) return variable
    return `[${s.separador}${variable}]`
  }).join('')
}

// Obtiene la etiqueta legible de una variable desde el registro
function obtenerInfoVariable(claveCompleta: string): { entidadEtiqueta: string; campoEtiqueta: string; color?: string } {
  const [entClave, campoClave] = claveCompleta.split('.')
  const entidad = obtenerEntidad(entClave)
  if (!entidad) return { entidadEtiqueta: entClave, campoEtiqueta: campoClave }
  const variable = entidad.variables.find(v => v.clave === campoClave)
  return {
    entidadEtiqueta: entidad.etiqueta,
    campoEtiqueta: variable?.etiqueta || campoClave,
    color: entidad.color,
  }
}

export default function PaginaConfigPresupuestos() {
  const router = useRouter()
  const { t } = useTraduccion()
  const formato = useFormato()
  const [cargando, setCargando] = useState(true)
  const [seccionActiva, setSeccionActiva] = useState('impuestos')
  const autoguardadoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Modal genérico para impuestos/monedas/unidades
  const [modalFinanciero, setModalFinanciero] = useState<{ abierto: boolean; seccion: string; valores?: Record<string, unknown>; editandoId?: string }>({ abierto: false, seccion: '' })

  // Datos
  const [impuestos, setImpuestos] = useState<Impuesto[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [monedaPredeterminada, setMonedaPredeterminada] = useState('ARS')
  const [unidades, setUnidades] = useState<UnidadMedida[]>([])
  const [diasVencimiento, setDiasVencimiento] = useState(30)
  const [validezBloqueada, setValidezBloqueada] = useState(false)
  const [condicionesDefault, setCondicionesDefault] = useState('')
  const [notasDefault, setNotasDefault] = useState('')
  const [prefijo, setPrefijo] = useState('P')
  const [digitos, setDigitos] = useState(4)
  const [siguiente, setSiguiente] = useState(1)
  const [reinicio, setReinicio] = useState<'nunca' | 'anual' | 'mensual'>('nunca')
  const [componentesNum, setComponentesNum] = useState<{ tipo: string; valor?: string; formato?: string }[]>([
    { tipo: 'prefijo' },
    { tipo: 'separador', valor: '-' },
    { tipo: 'secuencial' },
  ])

  // Preview del número según la numeración configurada
  const previewNumero = useMemo(() => {
    const hoy = new Date()
    return componentesNum.map(c => {
      if (c.tipo === 'prefijo') return prefijo || 'P'
      if (c.tipo === 'separador') return c.valor || '-'
      if (c.tipo === 'secuencial') return String(siguiente).padStart(digitos, '0')
      if (c.tipo === 'anio') return c.formato === 'largo' ? String(hoy.getFullYear()) : String(hoy.getFullYear()).slice(-2)
      if (c.tipo === 'mes') return String(hoy.getMonth() + 1).padStart(2, '0')
      if (c.tipo === 'dia') return String(hoy.getDate()).padStart(2, '0')
      return ''
    }).join('')
  }, [componentesNum, prefijo, siguiente, digitos])

  // Configuración PDF
  const [membrete, setMembrete] = useState<ConfigMembrete>(MEMBRETE_DEFAULT)
  const [piePagina, setPiePagina] = useState<ConfigPiePagina>(PIE_PAGINA_DEFAULT)
  const [plantillaHtml, setPlantillaHtml] = useState('')
  const [patronNombrePdf, setPatronNombrePdf] = useState('{numero} - {contacto_nombre}')
  const [segmentosNombre, setSegmentosNombre] = useState<SegmentoNombrePdf[]>([])
  const [datosEmpresaPdf, setDatosEmpresaPdf] = useState<ConfigDatosEmpresaPdf>(DATOS_EMPRESA_PDF_DEFAULT)

  // Selector de presupuesto para preview del nombre
  const [presupuestosNombrePdf, setPresupuestosNombrePdf] = useState<{ id: string; numero: string; contacto_nombre: string | null; contacto_apellido: string | null; atencion_nombre: string | null; atencion_cargo: string | null; fecha_emision: string; referencia: string | null; contacto_direccion: string | null }[]>([])
  const [previewNombrePdfId, setPreviewNombrePdfId] = useState('')

  // Datos de empresa para preview del membrete
  const [empresaPreview, setEmpresaPreview] = useState<DatosEmpresa>(EMPRESA_MUESTRA)
  const [logoUrlPreview, setLogoUrlPreview] = useState<string | null>(null)
  // Datos bancarios de empresa (fuente de verdad para herencia)
  const [datosBancariosEmpresa, setDatosBancariosEmpresa] = useState<{
    banco: string; titular: string; numero_cuenta: string; cbu: string; alias: string
  }>({ banco: '', titular: '', numero_cuenta: '', cbu: '', alias: '' })

  const secciones: SeccionConfig[] = [
    { id: 'impuestos', etiqueta: 'Impuestos', icono: <Receipt size={16} />, grupo: 'Financiero' },
    { id: 'monedas', etiqueta: 'Monedas', icono: <DollarSign size={16} />, grupo: 'Financiero' },
    { id: 'unidades', etiqueta: 'Unidades de medida', icono: <Ruler size={16} />, grupo: 'Financiero' },
    { id: 'condiciones', etiqueta: t('documentos.condiciones_pago'), icono: <Clock size={16} />, grupo: 'Financiero' },
    { id: 'numeracion', etiqueta: 'Numeración', icono: <Hash size={16} />, grupo: 'Documento' },
    { id: 'textos', etiqueta: 'Valores por defecto', icono: <FileText size={16} />, grupo: 'Documento' },
    { id: 'membrete', etiqueta: 'Membrete', icono: <Image size={16} />, grupo: 'PDF' },
    { id: 'pie_pagina', etiqueta: 'Pie de página', icono: <PanelBottom size={16} />, grupo: 'PDF' },
    { id: 'plantilla_pdf', etiqueta: 'Plantilla PDF', icono: <Code2 size={16} />, grupo: 'PDF' },
    { id: 'nombre_pdf', etiqueta: 'Nombre del archivo', icono: <FileType size={16} />, grupo: 'PDF' },
    { id: 'datos_bancarios', etiqueta: 'Datos bancarios', icono: <Landmark size={16} />, grupo: 'Portal' },
    { id: 'modulo', etiqueta: 'Módulo', icono: <Package size={16} />, grupo: 'Sistema' },
  ]

  // Cargar config
  useEffect(() => {
    fetch('/api/presupuestos/config')
      .then(r => r.json())
      .then(data => {
        setImpuestos((data.impuestos as Impuesto[]) || [])
        setMonedas((data.monedas as Moneda[]) || [])
        setMonedaPredeterminada(data.moneda_predeterminada || 'ARS')
        setUnidades((data.unidades as UnidadMedida[]) || [])
        setDiasVencimiento(data.dias_vencimiento_predeterminado || 30)
        setValidezBloqueada(data.validez_bloqueada || false)
        setCondicionesDefault(data.condiciones_predeterminadas || '')
        setNotasDefault(data.notas_predeterminadas || '')
        if (data.secuencia) {
          setPrefijo(data.secuencia.prefijo || 'P')
          setDigitos(data.secuencia.digitos || 4)
          setSiguiente(data.secuencia.siguiente || 1)
          if (data.secuencia.reinicio) setReinicio(data.secuencia.reinicio)
          if (data.secuencia.componentes?.length) {
            setComponentesNum(data.secuencia.componentes)
          }
        }
        // Configuración PDF
        if (data.membrete) setMembrete({ ...MEMBRETE_DEFAULT, ...data.membrete })
        if (data.pie_pagina) setPiePagina({ ...PIE_PAGINA_DEFAULT, ...data.pie_pagina })
        if (data.plantilla_html) setPlantillaHtml(data.plantilla_html)
        if (data.patron_nombre_pdf) {
          setPatronNombrePdf(data.patron_nombre_pdf)
          setSegmentosNombre(parsearPatronASegmentos(data.patron_nombre_pdf))
        } else {
          setSegmentosNombre(parsearPatronASegmentos('{numero} - {contacto_nombre}'))
        }
        if (data.datos_empresa_pdf) setDatosEmpresaPdf({ ...DATOS_EMPRESA_PDF_DEFAULT, ...data.datos_empresa_pdf })
        setCargando(false)

        // Cargar presupuestos recientes para preview del nombre PDF
        fetch('/api/presupuestos?por_pagina=15&orden_dir=desc')
          .then(r => r.ok ? r.json() : null)
          .then(dataPres => {
            if (!dataPres) return
            setPresupuestosNombrePdf((dataPres.presupuestos || []).map((p: Record<string, unknown>) => ({
              id: p.id as string, numero: p.numero as string,
              contacto_nombre: p.contacto_nombre as string | null,
              contacto_apellido: p.contacto_apellido as string | null,
              atencion_nombre: p.atencion_nombre as string | null,
              atencion_cargo: p.atencion_cargo as string | null,
              fecha_emision: p.fecha_emision as string,
              referencia: p.referencia as string | null,
              contacto_direccion: p.contacto_direccion as string | null,
            })))
          })
          .catch(() => { /* Sin presupuestos */ })

        // Cargar empresa + logo para preview
        const cargarEmpresa = async () => {
          try {
            const supabase = crearClienteNavegador()
            const { data: { user } } = await supabase.auth.getUser()
            const eid = user?.app_metadata?.empresa_activa_id
            if (!eid) return

            // Logo
            const tipo = data.membrete?.tipo_logo || 'cuadrado'
            const { data: ld } = supabase.storage.from('logos').getPublicUrl(`${eid}/${tipo}.png`)
            if (ld?.publicUrl) setLogoUrlPreview(ld.publicUrl)

            // Datos de empresa
            const { data: emp } = await supabase.from('empresas').select('*').eq('id', eid).single()
            if (emp) {
              setEmpresaPreview({
                nombre: emp.nombre || '',
                logo_url: ld?.publicUrl || emp.logo_url || null,
                datos_fiscales: emp.datos_fiscales || null,
                pais: emp.pais || 'AR',
                paises: emp.paises || ['AR'],
                color_marca: emp.color_marca || COLOR_MARCA_DEFECTO,
                direccion: emp.ubicacion || '',
                telefono: emp.telefono || '',
                correo: emp.correo || '',
                pagina_web: emp.pagina_web || '',
              })
              // Cargar datos bancarios de empresa para herencia
              const bancEmp = (emp.datos_bancarios || {}) as Record<string, string>
              setDatosBancariosEmpresa({
                banco: bancEmp.banco || '',
                titular: bancEmp.titular || '',
                numero_cuenta: bancEmp.numero_cuenta || '',
                cbu: bancEmp.cbu || '',
                alias: bancEmp.alias || '',
              })
            }
          } catch {}
        }
        cargarEmpresa()
      })
      .catch(() => setCargando(false))
  }, [])

  // Autoguardar (debounce 800ms)
  const autoguardar = useCallback((camposExtra?: Record<string, unknown>) => {
    if (autoguardadoRef.current) clearTimeout(autoguardadoRef.current)
    autoguardadoRef.current = setTimeout(async () => {
      await fetch('/api/presupuestos/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(camposExtra),
      })
    }, 800)
  }, [])

  // Helpers para autoguardar al cambiar cada campo
  const guardarImpuestos = (nuevos: Impuesto[]) => { setImpuestos(nuevos); autoguardar({ impuestos: nuevos }) }
  const guardarMonedas = (nuevas: Moneda[], monDefault?: string) => {
    setMonedas(nuevas)
    const campos: Record<string, unknown> = { monedas: nuevas }
    if (monDefault !== undefined) { setMonedaPredeterminada(monDefault); campos.moneda_predeterminada = monDefault }
    autoguardar(campos)
  }
  const guardarUnidades = (nuevas: UnidadMedida[]) => { setUnidades(nuevas); autoguardar({ unidades: nuevas }) }
  const guardarNumeracion = (campos?: Record<string, unknown>) => {
    autoguardar({ secuencia: { prefijo, digitos, siguiente, reinicio, componentes: componentesNum, ...campos } })
  }
  const guardarTextos = (campo: string, valor: string | number) => {
    if (campo === 'notas') { setNotasDefault(valor as string); autoguardar({ notas_predeterminadas: valor || null }) }
    if (campo === 'condiciones') { setCondicionesDefault(valor as string); autoguardar({ condiciones_predeterminadas: valor || null }) }
    if (campo === 'dias') { setDiasVencimiento(valor as number); autoguardar({ dias_vencimiento_predeterminado: valor }) }
  }

  // Guardado de configuración PDF
  const guardarMembrete = (nuevo: ConfigMembrete) => { setMembrete(nuevo); autoguardar({ membrete: nuevo }) }
  const guardarPiePagina = (nuevo: ConfigPiePagina) => { setPiePagina(nuevo); autoguardar({ pie_pagina: nuevo }) }
  const guardarPlantillaHtml = (html: string) => { setPlantillaHtml(html); autoguardar({ plantilla_html: html || null }) }
  const guardarPatronNombre = (patron: string) => { setPatronNombrePdf(patron); autoguardar({ patron_nombre_pdf: patron }) }
  const actualizarSegmentosNombre = (nuevos: SegmentoNombrePdf[]) => {
    setSegmentosNombre(nuevos)
    const patron = serializarSegmentos(nuevos)
    setPatronNombrePdf(patron)
    guardarPatronNombre(patron)
  }
  const guardarDatosEmpresaPdf = (datos: ConfigDatosEmpresaPdf) => { setDatosEmpresaPdf(datos); autoguardar({ datos_empresa_pdf: datos }) }

  // Preview HTML real de la plantilla para membrete y pie de página
  const previewContRef = useRef<HTMLDivElement>(null)
  const [escalaConfig, setEscalaConfig] = useState(0.5)

  useEffect(() => {
    const el = previewContRef.current
    if (!el) return
    const calc = () => setEscalaConfig(Math.min(1, (el.clientWidth - 32) / A4_ANCHO))
    calc()
    const obs = new ResizeObserver(calc)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const htmlPreviewConfig = useMemo(() => {
    const cfg: ConfigPdf = {
      membrete, pie_pagina: piePagina, plantilla_html: plantillaHtml || null,
      patron_nombre_pdf: patronNombrePdf, datos_empresa_pdf: datosEmpresaPdf,
      monedas: [],
    }
    // Usar logoUrlPreview actualizado (cambia al cambiar cuadrado/apaisado)
    const empresaConLogo = { ...empresaPreview, logo_url: logoUrlPreview || empresaPreview.logo_url }
    try {
      return renderizarHtml(DATOS_MUESTRA, empresaConLogo, cfg)
    } catch { return '' }
  }, [membrete, piePagina, plantillaHtml, patronNombrePdf, datosEmpresaPdf, empresaPreview, logoUrlPreview])

  if (cargando) {
    return <div className="flex items-center justify-center h-64 text-texto-terciario text-sm">Cargando configuración...</div>
  }

  return (
    <PlantillaConfiguracion
      titulo="Configuración de presupuestos"
      descripcion="Impuestos, monedas, condiciones de pago y formato de PDF."
      iconoHeader={<Receipt size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Presupuestos"
      onVolver={() => router.push('/presupuestos')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={(id) => {
        if (id === 'condiciones') {
          router.push('/presupuestos/configuracion/condiciones-pago')
          return
        }
        setSeccionActiva(id)
      }}
    >
      {/* ─── IMPUESTOS ─── */}
      {seccionActiva === 'impuestos' && (
        <ListaConfiguracion
          titulo="Impuestos"
          descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
          items={impuestos.map(imp => ({
            id: imp.id, nombre: imp.label,
            activo: imp.activo, predeterminado: imp.predeterminado,
          }))}
          controles="default-activo-borrar"
          nombreRadio="impuesto_predeterminado"
          ordenable
          acciones={[{
            tipo: 'fantasma', icono: <Plus size={16} />, soloIcono: true, titulo: 'Agregar impuesto',
            onClick: () => setModalFinanciero({ abierto: true, seccion: 'impuestos' }),
          }]}
          onEditar={(item) => {
            const imp = impuestos.find(i => i.id === item.id)
            if (imp) setModalFinanciero({ abierto: true, seccion: 'impuestos', valores: { nombre: imp.label, porcentaje: imp.porcentaje }, editandoId: imp.id })
          }}
          onToggleActivo={(item) => {
            const idx = impuestos.findIndex(i => i.id === item.id)
            if (idx >= 0) { const n = [...impuestos]; n[idx] = { ...n[idx], activo: !n[idx].activo }; guardarImpuestos(n) }
          }}
          onTogglePredeterminado={(item) => {
            guardarImpuestos(impuestos.map(i => ({ ...i, predeterminado: i.id === item.id })))
          }}
          onEliminar={(item) => guardarImpuestos(impuestos.filter(i => i.id !== item.id))}
          onReordenar={(ids) => {
            const mapa = new Map(impuestos.map(i => [i.id, i]))
            guardarImpuestos(ids.map(id => mapa.get(id)!).filter(Boolean))
          }}
          restaurable
          onRestaurar={() => guardarImpuestos(IMPUESTOS_DEFAULT)}
        />
      )}

      {/* ─── MONEDAS ─── */}
      {seccionActiva === 'monedas' && (
        <ListaConfiguracion
          titulo="Monedas"
          descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
          items={monedas.map(m => ({
            id: m.id, nombre: m.label,
            activo: m.activo, predeterminado: monedaPredeterminada === m.id,
          }))}
          controles="default-activo-borrar"
          nombreRadio="moneda_default"
          ordenable
          onEditar={(item) => {
            const mon = monedas.find(m => m.id === item.id)
            if (mon) setModalFinanciero({ abierto: true, seccion: 'monedas', valores: { codigo: mon.id, simbolo: mon.simbolo, nombre: mon.label }, editandoId: mon.id })
          }}
          onToggleActivo={(item) => {
            const idx = monedas.findIndex(m => m.id === item.id)
            if (idx >= 0) { const n = [...monedas]; n[idx] = { ...n[idx], activo: !n[idx].activo }; guardarMonedas(n) }
          }}
          onTogglePredeterminado={(item) => guardarMonedas(monedas, item.id)}
          onEliminar={(item) => guardarMonedas(monedas.filter(m => m.id !== item.id))}
          onReordenar={(ids) => {
            const mapa = new Map(monedas.map(m => [m.id, m]))
            guardarMonedas(ids.map(id => mapa.get(id)!).filter(Boolean))
          }}
          restaurable
          onRestaurar={() => guardarMonedas(MONEDAS_DEFAULT, 'ARS')}
        />
      )}

      {/* ─── UNIDADES ─── */}
      {seccionActiva === 'unidades' && (
        <ListaConfiguracion
          titulo="Unidades de medida"
          descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
          items={unidades.map(u => ({ id: u.id, nombre: u.label }))}
          controles="solo-borrar"
          ordenable
          acciones={[{
            tipo: 'fantasma', icono: <Plus size={16} />, soloIcono: true, titulo: 'Agregar unidad',
            onClick: () => setModalFinanciero({ abierto: true, seccion: 'unidades' }),
          }]}
          onEditar={(item) => {
            const u = unidades.find(un => un.id === item.id)
            if (u) setModalFinanciero({ abierto: true, seccion: 'unidades', valores: { nombre: u.label, abreviatura: u.abreviatura }, editandoId: u.id })
          }}
          onEliminar={(item) => guardarUnidades(unidades.filter(u => u.id !== item.id))}
          onReordenar={(ids) => {
            const mapa = new Map(unidades.map(u => [u.id, u]))
            guardarUnidades(ids.map(id => mapa.get(id)!).filter(Boolean))
          }}
          restaurable
          onRestaurar={() => guardarUnidades(UNIDADES_DEFAULT)}
        />
      )}

      {/* ─── NUMERACIÓN ─── */}
      {seccionActiva === 'numeracion' && (() => {
        const hoy = new Date()
        // Qué componentes de fecha ya están
        const tieneAnio = componentesNum.some(c => c.tipo === 'anio')
        const tieneMes = componentesNum.some(c => c.tipo === 'mes')
        const tieneDia = componentesNum.some(c => c.tipo === 'dia')

        const COLORES_BLOQUE: Record<string, string> = {
          prefijo: 'bg-[var(--texto-marca)]/15 text-texto-marca border-marca-500/30',
          secuencial: 'bg-[var(--texto-marca)]/15 text-texto-marca border-marca-500/30',
          anio: 'bg-insignia-advertencia/15 text-insignia-advertencia border-insignia-advertencia/30',
          mes: 'bg-insignia-exito/15 text-insignia-exito border-insignia-exito/30',
          dia: 'bg-insignia-violeta/15 text-insignia-violeta border-insignia-violeta/30',
          separador: 'bg-superficie-app text-texto-terciario border-borde-sutil',
        }

        const ETIQUETA_BLOQUE: Record<string, string> = {
          prefijo: 'prefijo', secuencial: 'nº', anio: 'año', mes: 'mes', dia: 'día', separador: 'sep',
        }

        const moverComponente = (idx: number, dir: number) => {
          const nuevos = [...componentesNum]
          const dest = idx + dir
          if (dest < 0 || dest >= nuevos.length) return
          ;[nuevos[idx], nuevos[dest]] = [nuevos[dest], nuevos[idx]]
          setComponentesNum(nuevos)
          guardarNumeracion({ componentes: nuevos })
        }

        const quitarComponente = (idx: number) => {
          const nuevos = componentesNum.filter((_, i) => i !== idx)
          setComponentesNum(nuevos)
          guardarNumeracion({ componentes: nuevos })
        }

        const agregarComponente = (tipo: string) => {
          const nuevos = [...componentesNum]
          const idxSec = nuevos.findIndex(c => c.tipo === 'secuencial')
          const pos = idxSec >= 0 ? idxSec : nuevos.length
          // Auto-agregar separador si el anterior no es separador
          if (pos > 0 && nuevos[pos - 1]?.tipo !== 'separador') {
            nuevos.splice(pos, 0, { tipo: 'separador', valor: '-' })
          }
          const nuevoComp = tipo === 'anio' ? { tipo: 'anio', formato: 'corto' } : tipo === 'separador' ? { tipo: 'separador', valor: '-' } : { tipo }
          const insertPos = nuevos.findIndex(c => c.tipo === 'secuencial')
          nuevos.splice(insertPos >= 0 ? insertPos : nuevos.length, 0, nuevoComp)
          setComponentesNum(nuevos)
          guardarNumeracion({ componentes: nuevos })
        }

        return (
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-texto-primario">Numeración</h3>
              <Boton variante="fantasma" tamano="xs" icono={<RotateCcw size={13} />} onClick={() => {
                  setPrefijo('P'); setDigitos(4); setSiguiente(1); setReinicio('nunca')
                  const defComp = [{ tipo: 'prefijo' }, { tipo: 'separador', valor: '-' }, { tipo: 'secuencial' }]
                  setComponentesNum(defComp)
                  guardarNumeracion({ prefijo: 'P', digitos: 4, siguiente: 1, reinicio: 'nunca', componentes: defComp })
                }}>Restablecer</Boton>
            </div>
            <p className="text-base text-texto-terciario mb-6">Configurá el formato del número de presupuesto</p>

            <div className="space-y-6">
              {/* Vista previa */}
              <div>
                <span className="text-xs text-texto-terciario font-medium block mb-1">{t('documentos.vista_previa')}</span>
                <div className="text-2xl font-mono font-semibold text-texto-primario px-5 py-3 rounded-card bg-superficie-app inline-block">
                  {previewNumero}
                </div>
              </div>

              {/* Prefijo */}
              <div>
                <Input
                  etiqueta="Prefijo"
                  value={prefijo}
                  onChange={(e) => setPrefijo(e.target.value)}
                  onBlur={() => guardarNumeracion({ prefijo })}
                  placeholder="Ej: P, PRES..."
                  formato={null}
                  className="w-40 font-mono"
                />
              </div>

              {/* Constructor de bloques */}
              <div className="p-4 rounded-card border border-borde-sutil space-y-3">
                <div>
                  <span className="text-xs text-texto-terciario font-medium block">Estructura del número</span>
                  <p className="text-xs text-texto-terciario mt-0.5">Movés, quitás o agregás bloques. Los separadores son editables.</p>
                </div>

                {/* Bloques */}
                <div className="flex flex-wrap items-center gap-2.5 py-4 px-4 rounded-card bg-superficie-app/50 min-h-[64px]">
                  {componentesNum.map((comp, i) => {
                    const esFijo = comp.tipo === 'prefijo' || comp.tipo === 'secuencial'
                    const color = COLORES_BLOQUE[comp.tipo] || COLORES_BLOQUE.separador
                    const puedeIzq = !esFijo && i > 0
                    const puedeDer = !esFijo && i < componentesNum.length - 1

                    if (comp.tipo === 'separador') {
                      return (
                        <div key={`sep-${i}`} className={`inline-flex items-center gap-1.5 h-10 px-2.5 rounded-card border ${color}`}>
                          {puedeIzq && (
                            <button onClick={() => moverComponente(i, -1)} className="text-texto-terciario/40 hover:text-texto-secundario transition-colors text-sm">‹</button>
                          )}
                          <Input
                            value={comp.valor ?? '-'} maxLength={3}
                            onChange={(e) => {
                              const n = [...componentesNum]; n[i] = { ...comp, valor: e.target.value }; setComponentesNum(n)
                            }}
                            onBlur={() => guardarNumeracion({ componentes: componentesNum })}
                            formato={null}
                            variante="plano"
                            compacto
                            className="w-5 text-center text-base font-mono"
                          />
                          <span className="text-xxs opacity-40 uppercase">sep</span>
                          {puedeDer && (
                            <button onClick={() => moverComponente(i, 1)} className="text-texto-terciario/40 hover:text-texto-secundario transition-colors text-sm">›</button>
                          )}
                          <button onClick={() => quitarComponente(i)} className="text-texto-terciario/30 hover:text-estado-error transition-colors text-sm ml-0.5">×</button>
                        </div>
                      )
                    }

                    let valor = ''
                    if (comp.tipo === 'prefijo') valor = prefijo || 'P'
                    else if (comp.tipo === 'secuencial') valor = String(1).padStart(digitos, '0')
                    else if (comp.tipo === 'anio') valor = comp.formato === 'largo' ? String(hoy.getFullYear()) : String(hoy.getFullYear()).slice(-2)
                    else if (comp.tipo === 'mes') valor = String(hoy.getMonth() + 1).padStart(2, '0')
                    else if (comp.tipo === 'dia') valor = String(hoy.getDate()).padStart(2, '0')

                    return (
                      <div key={`${comp.tipo}-${i}`} className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-card border ${color}`}>
                        {puedeIzq && (
                          <button onClick={() => moverComponente(i, -1)} className="text-current opacity-30 hover:opacity-80 transition-opacity text-sm">‹</button>
                        )}
                        <span className="font-mono font-bold text-base">{valor}</span>
                        <span className="text-xxs opacity-40 uppercase">{ETIQUETA_BLOQUE[comp.tipo]}</span>
                        {comp.tipo === 'anio' && (
                          <Tooltip contenido={comp.formato === 'largo' ? 'Cambiar a 2 dígitos' : 'Cambiar a 4 dígitos'}>
                          <button
                            onClick={() => {
                              const n = [...componentesNum]; n[i] = { ...comp, formato: comp.formato === 'largo' ? 'corto' : 'largo' }; setComponentesNum(n)
                              guardarNumeracion({ componentes: n })
                            }}
                            className="text-current opacity-40 hover:opacity-80 transition-opacity"
                          >⇄</button>
                          </Tooltip>
                        )}
                        {puedeDer && (
                          <button onClick={() => moverComponente(i, 1)} className="text-current opacity-30 hover:opacity-80 transition-opacity text-sm">›</button>
                        )}
                        {!esFijo && (
                          <button onClick={() => quitarComponente(i)} className="text-current opacity-30 hover:opacity-80 hover:text-estado-error transition-all text-sm ml-0.5">×</button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Agregar bloques */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-texto-terciario">Agregar:</span>
                  {[
                    { tipo: 'separador', label: 'Separador', visible: true },
                    { tipo: 'anio', label: 'Año', visible: !tieneAnio },
                    { tipo: 'mes', label: 'Mes', visible: !tieneMes },
                    { tipo: 'dia', label: 'Día', visible: !tieneDia },
                  ].filter(a => a.visible).map(a => (
                    <Boton
                      key={a.tipo}
                      variante="secundario"
                      tamano="xs"
                      icono={<Plus size={12} />}
                      onClick={() => agregarComponente(a.tipo)}
                      className="border-dashed"
                    >
                      {a.label}
                    </Boton>
                  ))}
                </div>
              </div>

              {/* Dígitos */}
              <div>
                <label className="text-xs text-texto-terciario font-medium block mb-1">Dígitos del secuencial</label>
                <p className="text-xs text-texto-terciario mb-2">Cantidad de dígitos con ceros a la izquierda</p>
                <div className="flex gap-1.5">
                  {[3, 4, 5, 6].map(d => (
                    <Boton
                      key={d}
                      variante={digitos === d ? 'secundario' : 'fantasma'}
                      tamano="sm"
                      onClick={() => { setDigitos(d); guardarNumeracion({ digitos: d }) }}
                      className={`flex-1 max-w-[100px] border ${
                        digitos === d
                          ? 'bg-[var(--texto-marca)]/10 text-texto-marca border-marca-500/30'
                          : 'border-borde-sutil'
                      }`}
                    >
                      {d} ({String(1).padStart(d, '0')})
                    </Boton>
                  ))}
                </div>
              </div>

              {/* Reinicio */}
              <div>
                <label className="text-xs text-texto-terciario font-medium block mb-1">Reinicio del secuencial</label>
                <p className="text-xs text-texto-terciario mb-2">Cuándo vuelve a empezar la numeración desde 1</p>
                <div className="flex gap-1.5">
                  {([
                    { value: 'nunca' as const, label: 'Nunca' },
                    { value: 'anual' as const, label: 'Cada año' },
                    { value: 'mensual' as const, label: 'Cada mes' },
                  ]).map(op => (
                    <Boton
                      key={op.value}
                      variante={reinicio === op.value ? 'secundario' : 'fantasma'}
                      tamano="sm"
                      onClick={() => { setReinicio(op.value); guardarNumeracion({ reinicio: op.value }) }}
                      className={`flex-1 max-w-[120px] border ${
                        reinicio === op.value
                          ? 'bg-[var(--texto-marca)]/10 text-texto-marca border-marca-500/30'
                          : 'border-borde-sutil'
                      }`}
                    >
                      {op.label}
                    </Boton>
                  ))}
                </div>
                {reinicio !== 'nunca' && (
                  <p className="text-xs text-texto-terciario flex items-center gap-1.5 mt-2">
                    ℹ {reinicio === 'anual' ? 'El secuencial vuelve a 0001 cada 1 de enero.' : 'El secuencial vuelve a 0001 cada primer día del mes.'}
                  </p>
                )}
              </div>

              {/* Próximo número */}
              <div className="p-4 rounded-card border border-borde-sutil">
                <label className="text-xs text-texto-terciario font-medium block mb-1">Próximo número</label>
                <p className="text-xs text-texto-terciario mb-2">El siguiente número secuencial que se asignará</p>
                <div className="flex items-center gap-3">
                  <Input tipo="number" value={siguiente} min={1}
                    onChange={(e) => setSiguiente(parseInt(e.target.value) || 1)}
                    onBlur={() => guardarNumeracion({ siguiente })}
                    formato={null}
                    className="w-28 font-mono text-right" />
                  <span className="text-xs text-texto-terciario">→ generará <strong className="font-mono text-texto-primario">{previewNumero}</strong></span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── TEXTOS DEFAULT ─── */}
      {seccionActiva === 'textos' && (
        <div>
          <h3 className="text-lg font-semibold text-texto-primario">Valores por defecto</h3>
          <p className="text-base text-texto-terciario mt-1 mb-5">Se cargan automáticamente al crear un presupuesto nuevo.</p>
          <div className="space-y-6">
            {/* Días de validez */}
            <div>
              <label className="text-xs text-texto-terciario font-medium uppercase tracking-wider mb-1.5 block">Días de validez</label>
              <p className="text-xs text-texto-terciario mb-2">Cuántos días desde la emisión es válida la oferta.</p>
              <div className="flex items-center gap-4">
                <Input
                  tipo="number"
                  min={1}
                  value={diasVencimiento}
                  onChange={(e) => setDiasVencimiento(parseInt(e.target.value) || 1)}
                  onBlur={() => guardarTextos('dias', diasVencimiento)}
                  onFocus={(e) => e.target.select()}
                  formato={null}
                  className="w-24 font-mono"
                />
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={validezBloqueada}
                    onClick={() => {
                      const nuevo = !validezBloqueada
                      setValidezBloqueada(nuevo)
                      autoguardar({ validez_bloqueada: nuevo })
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${validezBloqueada ? 'bg-texto-marca' : 'bg-superficie-app border border-borde-sutil'}`}
                  >
                    <span className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${validezBloqueada ? 'translate-x-[17px]' : 'translate-x-0.5'} mt-0.5`} />
                  </button>
                  <span className="text-xs text-texto-secundario">Bloquear</span>
                </label>
              </div>
              {validezBloqueada && (
                <p className="text-xs text-insignia-advertencia mt-2">Los vendedores no podrán cambiar la fecha de vencimiento al crear presupuestos.</p>
              )}
            </div>

            <div className="border-t border-borde-sutil" />

            {/* Notas por defecto */}
            <div>
              <EditorNotasPresupuesto
                valor={notasDefault}
                onChange={(v) => guardarTextos('notas', v)}
                placeholder="Ej: Sujeto a disponibilidad de stock..."
                etiqueta={t('documentos.notas_defecto')}
              />
            </div>

            {/* Condiciones por defecto */}
            <div>
              <EditorNotasPresupuesto
                valor={condicionesDefault}
                onChange={(v) => guardarTextos('condiciones', v)}
                placeholder="Ej: Los precios no incluyen IVA..."
                etiqueta={t('documentos.condiciones_defecto')}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── MEMBRETE (encabezado del PDF) ─── */}
      {seccionActiva === 'membrete' && (
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-texto-primario">Membrete del documento</h3>
            <Boton variante="fantasma" tamano="xs" icono={<RotateCcw size={13} />} onClick={() => guardarMembrete(MEMBRETE_DEFAULT)}>Restablecer</Boton>
          </div>
          <p className="text-base text-texto-terciario mt-1 mb-5">Encabezado con logo y texto para tus PDFs.</p>

          {/* ── VISTA PREVIA DEL MEMBRETE (HTML real de la plantilla) ── */}
          <div className="mb-5">
            <p className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider mb-2">{t('documentos.vista_previa')}</p>
            <div ref={previewContRef} className="bg-superficie-hover rounded-card p-4 flex justify-center">
              <div style={{ width: Math.floor(A4_ANCHO * escalaConfig), height: Math.floor(400 * escalaConfig), position: 'relative', overflow: 'hidden' }}>
                <iframe
                  srcDoc={htmlPreviewConfig}
                  title="Preview membrete"
                  className="border-0 bg-white shadow-lg rounded-sm"
                  style={{ width: A4_ANCHO, height: 400, position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `scale(${escalaConfig})`, pointerEvents: 'none' }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Controles del membrete */}
            <div className="p-4 rounded-card border border-borde-sutil bg-superficie-app/30 space-y-4">
              {/* Toggle logo */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-texto-primario">Mostrar logo en el membrete</span>
                <button
                  onClick={() => guardarMembrete({ ...membrete, mostrar_logo: !membrete.mostrar_logo })}
                  className={`w-10 h-[22px] rounded-full relative transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${membrete.mostrar_logo ? 'bg-[var(--texto-marca)]' : 'bg-white/20 dark:bg-white/15'}`}
                >
                  <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${membrete.mostrar_logo ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                </button>
              </div>

              {/* Formato del logo: solo con imagen */}
              {membrete.mostrar_logo && (
                <div className="pt-2">
                  <label className="text-xs text-texto-terciario font-medium block mb-2">Formato del logo</label>
                  <div className="flex gap-1.5">
                    {([
                      { valor: 'cuadrado' as const, etiqueta: 'Cuadrado' },
                      { valor: 'apaisado' as const, etiqueta: 'Apaisado (rectangular)' },
                    ]).map(opt => (
                      <Boton key={opt.valor}
                        variante={membrete.tipo_logo === opt.valor ? 'secundario' : 'fantasma'}
                        tamano="sm"
                        onClick={() => {
                          guardarMembrete({ ...membrete, tipo_logo: opt.valor })
                          const actualizarLogo = async () => {
                            try {
                              const sb = crearClienteNavegador()
                              const { data: { user } } = await sb.auth.getUser()
                              const eid = user?.app_metadata?.empresa_activa_id
                              if (eid) {
                                const { data: ld } = sb.storage.from('logos').getPublicUrl(`${eid}/${opt.valor}.png`)
                                if (ld?.publicUrl) setLogoUrlPreview(ld.publicUrl)
                              }
                            } catch {}
                          }
                          actualizarLogo()
                        }}
                        className={`flex-1 border ${
                          membrete.tipo_logo === opt.valor
                            ? 'bg-[var(--texto-marca)]/15 text-[var(--texto-marca)] border-[var(--texto-marca)]/30'
                            : 'border-borde-sutil'
                        }`}>
                        {opt.etiqueta}
                      </Boton>
                    ))}
                  </div>
                </div>
              )}

              {/* Posición y ancho: siempre visibles */}
              <div className="flex gap-4 pt-2">
                <div className="flex-1">
                  <label className="text-xxs text-texto-terciario font-medium uppercase tracking-wide block mb-2">Posición</label>
                  <div className="flex gap-1.5">
                    {([
                      { valor: 'izquierda' as const, etiqueta: 'Izq.' },
                      { valor: 'centro' as const, etiqueta: 'Centro' },
                      { valor: 'derecha' as const, etiqueta: 'Der.' },
                    ]).map(opt => (
                      <Boton key={opt.valor}
                        variante={membrete.posicion_logo === opt.valor ? 'secundario' : 'fantasma'}
                        tamano="sm"
                        onClick={() => guardarMembrete({ ...membrete, posicion_logo: opt.valor })}
                        className={`flex-1 border ${
                          membrete.posicion_logo === opt.valor
                            ? 'bg-[var(--texto-marca)]/15 text-[var(--texto-marca)] border-[var(--texto-marca)]/30'
                            : 'border-borde-sutil'
                        }`}>
                        {opt.etiqueta}
                      </Boton>
                    ))}
                  </div>
                </div>

                {(() => {
                  const esCuadrado = membrete.tipo_logo === 'cuadrado'
                  const min = esCuadrado ? 8 : 15
                  const max = esCuadrado ? 35 : 50
                  return (
                    <div className="flex-1">
                      <label className="text-xxs text-texto-terciario font-medium uppercase tracking-wide block mb-2">
                        Ancho: {Math.round(membrete.ancho_logo * 5.95)}px <span className="opacity-50">({membrete.ancho_logo}%)</span>
                      </label>
                      <div className="pt-1">
                        <input type="range" min={min} max={max} step={1} value={Math.min(Math.max(membrete.ancho_logo, min), max)}
                          onChange={(e) => { const v = Number(e.target.value); setMembrete(m => ({ ...m, ancho_logo: v })) }}
                          onMouseUp={() => guardarMembrete(membrete)}
                          onTouchEnd={() => guardarMembrete(membrete)}
                          className="w-full accent-[var(--texto-marca)]" />
                        <div className="flex justify-between text-xxs text-texto-terciario mt-0.5">
                          <span>Chico</span><span>Grande</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Texto y subtítulo: solo cuando NO se muestra el logo imagen */}
              {!membrete.mostrar_logo && (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-texto-terciario">En lugar del logo, mostrá un texto principal y subtítulo.</p>

                  {/* Texto principal */}
                  <div className="space-y-2">
                    <Input
                      etiqueta="Texto principal"
                      value={membrete.texto_logo || ''}
                      onChange={(e) => setMembrete({ ...membrete, texto_logo: e.target.value })}
                      onBlur={() => guardarMembrete(membrete)}
                      placeholder="Razón social o nombre de la empresa"
                      formato={null}
                    />
                    <div>
                      <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">Tamaño</span>
                      <div className="flex gap-1">
                        {[28, 32, 36, 40, 44].map(t => (
                          <Boton key={t}
                            variante={(membrete.tamano_texto_logo || 24) === t ? 'secundario' : 'fantasma'}
                            tamano="xs"
                            onClick={() => guardarMembrete({ ...membrete, tamano_texto_logo: t })}
                            className={`flex-1 border ${
                              (membrete.tamano_texto_logo || 24) === t
                                ? 'bg-[var(--texto-marca)]/15 text-[var(--texto-marca)] border-[var(--texto-marca)]/30'
                                : 'border-borde-sutil'
                            }`}>
                            {t}
                          </Boton>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Subtítulo */}
                  <div className="space-y-2 pt-2 border-t border-borde-sutil">
                    <Input
                      etiqueta="Subtítulo (opcional)"
                      value={membrete.subtitulo_logo || ''}
                      onChange={(e) => setMembrete({ ...membrete, subtitulo_logo: e.target.value })}
                      onBlur={() => guardarMembrete(membrete)}
                      placeholder="Ej: Soluciones eléctricas industriales"
                      formato={null}
                    />
                    {membrete.subtitulo_logo && (
                      <div>
                        <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">Tamaño del subtítulo</span>
                        <div className="flex gap-1">
                          {[8, 9, 10, 11, 12, 14].map(t => (
                            <Boton key={t}
                              variante={(membrete.tamano_subtitulo || 10) === t ? 'secundario' : 'fantasma'}
                              tamano="xs"
                              onClick={() => guardarMembrete({ ...membrete, tamano_subtitulo: t })}
                              className={`flex-1 border ${
                                (membrete.tamano_subtitulo || 10) === t
                                  ? 'bg-[var(--texto-marca)]/15 text-[var(--texto-marca)] border-[var(--texto-marca)]/30'
                                  : 'border-borde-sutil'
                              }`}>
                              {t}
                            </Boton>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Alineación del texto */}
              <div>
                <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">Alineación del texto</span>
                <div className="flex gap-1">
                  {([
                    { valor: 'izquierda' as const, etiqueta: 'Izq.' },
                    { valor: 'centro' as const, etiqueta: 'Centro' },
                    { valor: 'derecha' as const, etiqueta: 'Der.' },
                  ]).map(opt => (
                    <Boton key={opt.valor}
                      variante={membrete.alineacion_texto === opt.valor ? 'secundario' : 'fantasma'}
                      tamano="xs"
                      onClick={() => guardarMembrete({ ...membrete, alineacion_texto: opt.valor })}
                      className={`flex-1 border ${
                        membrete.alineacion_texto === opt.valor
                          ? 'bg-[var(--texto-marca)]/10 text-texto-marca border-marca-500/30'
                          : 'border-borde-sutil'
                      }`}>
                      {opt.etiqueta}
                    </Boton>
                  ))}
                </div>
              </div>
            </div>

            {/* Línea separadora */}
            <div className="space-y-3 px-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-texto-primario">Mostrar línea separadora bajo el membrete</span>
                <button
                  onClick={() => guardarMembrete({ ...membrete, linea_separadora: !membrete.linea_separadora })}
                  className={`w-10 h-[22px] rounded-full relative transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${membrete.linea_separadora ? 'bg-[var(--texto-marca)]' : 'bg-white/20 dark:bg-white/15'}`}
                >
                  <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${membrete.linea_separadora ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                </button>
              </div>
              {membrete.linea_separadora && (
                <div className="space-y-3 pt-1">
                  <div>
                    <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">
                      Grosor: {membrete.grosor_linea || 1}px
                    </span>
                    <div className="flex gap-1">
                      {[0.5, 1, 1.5, 2].map(g => (
                        <Boton key={g}
                          variante={(membrete.grosor_linea || 1) === g ? 'secundario' : 'fantasma'}
                          tamano="xs"
                          onClick={() => guardarMembrete({ ...membrete, grosor_linea: g })}
                          className={`flex-1 border ${
                            (membrete.grosor_linea || 1) === g
                              ? 'bg-[var(--texto-marca)]/10 text-texto-marca border-marca-500/30'
                              : 'border-borde-sutil'
                          }`}>
                          {g}
                        </Boton>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider">Color de marca</span>
                    {/* Toggle switch — usa button nativo por requerir estilos inline con posición absoluta */}
                    <button
                      onClick={() => guardarMembrete({ ...membrete, color_linea: membrete.color_linea === 'marca' ? 'gris' : 'marca' })}
                      className={`w-10 h-[22px] rounded-full relative transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${membrete.color_linea === 'marca' ? 'bg-[var(--texto-marca)]' : 'bg-white/20 dark:bg-white/15'}`}
                    >
                      <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${membrete.color_linea === 'marca' ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Editor de contenido HTML rico */}
            <div className="rounded-card border border-borde-sutil overflow-hidden">
              <EditorTexto
                contenido={membrete.contenido_html || ''}
                onChange={(html) => {
                  setMembrete(m => ({ ...m, contenido_html: html }))
                  if (autoguardadoRef.current) clearTimeout(autoguardadoRef.current)
                  autoguardadoRef.current = setTimeout(() => {
                    guardarMembrete({ ...membrete, contenido_html: html })
                  }, 1200)
                }}
                placeholder="Escribí el texto del membrete... Seleccioná texto para dar formato"
                alturaMinima={100}
              />
            </div>
            <p className="text-xs text-texto-terciario px-1">
              Seleccioná texto para acceder al menú de formato: negrita, color, tamaño, enlaces
            </p>

          </div>
        </div>
      )}

      {/* ─── PIE DE PÁGINA ─── */}
      {seccionActiva === 'pie_pagina' && (
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-texto-primario">Pie de página</h3>
            <Boton variante="fantasma" tamano="xs" icono={<RotateCcw size={13} />} onClick={() => guardarPiePagina(PIE_PAGINA_DEFAULT)}>Restablecer</Boton>
          </div>
          <p className="text-base text-texto-terciario mt-1 mb-5">3 columnas independientes para el pie del PDF.</p>

          {/* ── VISTA PREVIA DEL PIE (HTML real de la plantilla, scroll al fondo) ── */}
          <div className="mb-5">
            <p className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider mb-2">{t('documentos.vista_previa')}</p>
            <div className="bg-superficie-hover rounded-card p-4 flex justify-center">
              <div style={{ width: Math.floor(A4_ANCHO * escalaConfig), height: Math.floor(200 * escalaConfig), position: 'relative', overflow: 'hidden' }}>
                <iframe
                  srcDoc={htmlPreviewConfig}
                  title="Preview pie"
                  className="border-0 bg-white shadow-lg rounded-sm"
                  style={{ width: A4_ANCHO, height: A4_ALTO, position: 'absolute', bottom: 0, left: 0, transformOrigin: 'bottom left', transform: `scale(${escalaConfig})`, pointerEvents: 'none' }}
                  onLoad={(e) => {
                    // Scroll al fondo para mostrar el pie
                    try {
                      const doc = e.currentTarget.contentDocument
                      if (doc?.documentElement) {
                        e.currentTarget.style.height = `${doc.documentElement.scrollHeight}px`
                      }
                    } catch {}
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Opciones generales del pie */}
            <div className="p-4 rounded-card border border-borde-sutil bg-superficie-app/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-texto-primario">Línea separadora encima del pie</span>
                <button
                  onClick={() => guardarPiePagina({ ...piePagina, linea_superior: !piePagina.linea_superior })}
                  className={`w-10 h-[22px] rounded-full relative transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${piePagina.linea_superior ? 'bg-[var(--texto-marca)]' : 'bg-white/20 dark:bg-white/15'}`}
                >
                  <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${piePagina.linea_superior ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                </button>
              </div>

              {piePagina.linea_superior && (
                <div className="space-y-3 pt-1">
                  <div>
                    <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">
                      Grosor: {piePagina.grosor_linea || 1}px
                    </span>
                    <div className="flex gap-1">
                      {[0.5, 1, 1.5, 2].map(g => (
                        <Boton key={g}
                          variante={(piePagina.grosor_linea || 1) === g ? 'secundario' : 'fantasma'}
                          tamano="xs"
                          onClick={() => guardarPiePagina({ ...piePagina, grosor_linea: g })}
                          className={`flex-1 border ${
                            (piePagina.grosor_linea || 1) === g
                              ? 'bg-[var(--texto-marca)]/15 text-[var(--texto-marca)] border-[var(--texto-marca)]/30'
                              : 'border-borde-sutil'
                          }`}>
                          {g}
                        </Boton>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider">Color de marca</span>
                    <button
                      onClick={() => guardarPiePagina({ ...piePagina, color_linea: piePagina.color_linea === 'marca' ? 'gris' : 'marca' })}
                      className={`w-10 h-[22px] rounded-full relative transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${piePagina.color_linea === 'marca' ? 'bg-[var(--texto-marca)]' : 'bg-white/20 dark:bg-white/15'}`}
                    >
                      <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${piePagina.color_linea === 'marca' ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">
                  Tamaño del texto: {piePagina.tamano_texto}px
                </span>
                <div className="flex gap-1">
                  {[8, 9, 10, 11, 12].map(t => (
                    <Boton key={t}
                      variante={piePagina.tamano_texto === t ? 'secundario' : 'fantasma'}
                      tamano="xs"
                      onClick={() => guardarPiePagina({ ...piePagina, tamano_texto: t })}
                      className={`flex-1 border ${
                        piePagina.tamano_texto === t
                          ? 'bg-[var(--texto-marca)]/15 text-[var(--texto-marca)] border-[var(--texto-marca)]/30'
                          : 'border-borde-sutil'
                      }`}>
                      {t}
                    </Boton>
                  ))}
                </div>
              </div>
            </div>

            {/* Columnas del pie */}
            {(['izquierda', 'centro', 'derecha'] as const).map(pos => {
              const columna = piePagina.columnas[pos]
              const actualizarColumna = (cambios: Record<string, unknown>) => {
                const nuevaColumna = { ...columna, ...cambios }
                guardarPiePagina({
                  ...piePagina,
                  columnas: { ...piePagina.columnas, [pos]: nuevaColumna },
                })
              }
              const setColumnaLocal = (cambios: Record<string, unknown>) => {
                setPiePagina(p => ({
                  ...p,
                  columnas: { ...p.columnas, [pos]: { ...p.columnas[pos], ...cambios } },
                }))
              }

              return (
                <div key={pos} className="p-4 rounded-card border border-borde-sutil space-y-3">
                  <span className="text-xs font-semibold text-texto-primario capitalize">
                    Columna {pos}
                  </span>

                  {/* Tipo de contenido */}
                  <div>
                    <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">Tipo</span>
                    <div className="flex gap-1">
                      {([
                        { valor: 'vacio' as TipoColumnaPie, etiqueta: 'Vacío' },
                        { valor: 'texto' as TipoColumnaPie, etiqueta: 'Texto' },
                        { valor: 'numeracion' as TipoColumnaPie, etiqueta: 'Páginas' },
                        { valor: 'imagen' as TipoColumnaPie, etiqueta: 'Imagen' },
                      ]).map(opt => (
                        <Boton key={opt.valor}
                          variante={columna.tipo === opt.valor ? 'secundario' : 'fantasma'}
                          tamano="xs"
                          onClick={() => actualizarColumna({ tipo: opt.valor })}
                          className={`flex-1 border ${
                            columna.tipo === opt.valor
                              ? 'bg-[var(--texto-marca)]/15 text-[var(--texto-marca)] border-[var(--texto-marca)]/30'
                              : 'border-borde-sutil'
                          }`}>
                          {opt.etiqueta}
                        </Boton>
                      ))}
                    </div>
                  </div>

                  {/* Texto rico */}
                  {columna.tipo === 'texto' && (
                    <div>
                      <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-0.5">Texto</span>
                      <p className="text-xxs text-texto-terciario mb-1.5">Seleccioná texto para cambiar tamaño, color, negrita y más</p>
                      <div className="rounded-card border border-borde-sutil overflow-hidden">
                        <EditorTexto
                          contenido={columna.texto || ''}
                          onChange={(html) => {
                            setColumnaLocal({ texto: html })
                            if (autoguardadoRef.current) clearTimeout(autoguardadoRef.current)
                            autoguardadoRef.current = setTimeout(() => {
                              guardarPiePagina({
                                ...piePagina,
                                columnas: { ...piePagina.columnas, [pos]: { ...piePagina.columnas[pos], texto: html } },
                              })
                            }, 1200)
                          }}
                          placeholder="Ej: Gracias por su confianza"
                          alturaMinima={60}
                        />
                      </div>
                    </div>
                  )}

                  {/* Imagen + texto acompañante */}
                  {columna.tipo === 'imagen' && (
                    <div className="space-y-3">
                      <div>
                        <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">Imagen (QR, firma, logo)</span>
                        <SubirImagenPie
                          urlActual={columna.imagen_url || null}
                          onSubir={async (blob) => {
                            const supabase = crearClienteNavegador()
                            const { data: { user } } = await supabase.auth.getUser()
                            const eid = user?.app_metadata?.empresa_activa_id
                            if (!eid) return
                            const ruta = `${eid}/pie-pagina-${pos}.png`
                            await supabase.storage.from('documentos-pdf').upload(ruta, blob, { upsert: true, contentType: 'image/png' })
                            const { data: urlData } = supabase.storage.from('documentos-pdf').getPublicUrl(ruta)
                            const url = `${urlData.publicUrl}?t=${Date.now()}`
                            actualizarColumna({ imagen_url: url })
                          }}
                          onEliminar={async () => {
                            const supabase = crearClienteNavegador()
                            const { data: { user } } = await supabase.auth.getUser()
                            const eid = user?.app_metadata?.empresa_activa_id
                            if (!eid) return
                            await supabase.storage.from('documentos-pdf').remove([`${eid}/pie-pagina-${pos}.png`])
                            actualizarColumna({ imagen_url: '' })
                          }}
                        />
                      </div>
                      <div>
                        <Input
                          etiqueta="Texto acompañante (opcional)"
                          value={columna.texto_imagen || ''}
                          onChange={(e) => setColumnaLocal({ texto_imagen: e.target.value })}
                          onBlur={() => guardarPiePagina(piePagina)}
                          placeholder="Ej: Escaneame, www.miempresa.com"
                          formato={null}
                        />
                      </div>
                      {columna.texto_imagen && (
                        <>
                          <div>
                            <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">Posición del texto</span>
                            <div className="flex gap-1">
                              {([
                                { valor: 'arriba' as const, etiqueta: 'Arriba' },
                                { valor: 'abajo' as const, etiqueta: 'Abajo' },
                              ]).map(opt => (
                                <Boton key={opt.valor}
                                  variante={(columna.posicion_texto || 'abajo') === opt.valor ? 'secundario' : 'fantasma'}
                                  tamano="xs"
                                  onClick={() => actualizarColumna({ posicion_texto: opt.valor })}
                                  className={`flex-1 border ${
                                    (columna.posicion_texto || 'abajo') === opt.valor
                                      ? 'bg-[var(--texto-marca)]/15 text-[var(--texto-marca)] border-[var(--texto-marca)]/30'
                                      : 'border-borde-sutil'
                                  }`}>
                                  {opt.etiqueta}
                                </Boton>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-xxs font-bold text-texto-terciario uppercase tracking-wider block mb-1.5">Alineación del texto</span>
                            <div className="flex gap-1">
                              {([
                                { valor: 'izquierda' as const, etiqueta: 'Izq.' },
                                { valor: 'centro' as const, etiqueta: 'Centro' },
                                { valor: 'derecha' as const, etiqueta: 'Der.' },
                              ]).map(opt => (
                                <Boton key={opt.valor}
                                  variante={(columna.alineacion_texto || 'centro') === opt.valor ? 'secundario' : 'fantasma'}
                                  tamano="xs"
                                  onClick={() => actualizarColumna({ alineacion_texto: opt.valor })}
                                  className={`flex-1 border ${
                                    (columna.alineacion_texto || 'centro') === opt.valor
                                      ? 'bg-[var(--texto-marca)]/15 text-[var(--texto-marca)] border-[var(--texto-marca)]/30'
                                      : 'border-borde-sutil'
                                  }`}>
                                  {opt.etiqueta}
                                </Boton>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Numeración */}
                  {columna.tipo === 'numeracion' && (
                    <p className="text-xs text-texto-terciario">Se mostrará &quot;Página X de Y&quot; automáticamente.</p>
                  )}

                  {/* Vacío */}
                  {columna.tipo === 'vacio' && (
                    <p className="text-xs text-texto-terciario">Esta columna no muestra contenido.</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── PLANTILLA PDF ─── */}
      {seccionActiva === 'plantilla_pdf' && (
        <div>
          <h3 className="text-lg font-semibold text-texto-primario">Plantilla PDF</h3>
          <p className="text-base text-texto-terciario mt-1 mb-5">
            Personalizá el diseño del PDF con el editor visual.
          </p>

          <div className="space-y-5">
            {/* Botón para abrir el editor a pantalla completa */}
            <Boton
              variante="secundario"
              tamano="lg"
              anchoCompleto
              onClick={() => router.push('/presupuestos/configuracion/plantilla')}
              className="p-5 h-auto border-borde-sutil hover:border-[var(--texto-marca)]/40 hover:bg-[var(--texto-marca)]/5 group"
            >
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-card bg-[var(--texto-marca)]/10 flex items-center justify-center group-hover:bg-[var(--texto-marca)]/20 transition-colors">
                    <Code2 size={22} className="text-texto-marca" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-texto-primario">Abrir editor de plantilla</p>
                    <p className="text-xs text-texto-terciario mt-0.5">
                      Editor a pantalla completa con vista previa en vivo y datos reales
                    </p>
                  </div>
                </div>
                <span className="text-xs text-texto-marca font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir →
                </span>
              </div>
            </Boton>

            <p className="text-xs text-texto-terciario">
              {plantillaHtml ? 'Estás usando una plantilla personalizada.' : 'Estás usando la plantilla por defecto del sistema.'}
              {plantillaHtml && (
                <Boton variante="fantasma" tamano="xs" onClick={() => guardarPlantillaHtml('')} className="ml-2">Restaurar por defecto</Boton>
              )}
            </p>

          </div>
        </div>
      )}

      {/* ─── NOMBRE DEL ARCHIVO PDF ─── */}
      {seccionActiva === 'nombre_pdf' && (() => {
        // Variables frecuentes para acceso rápido (un click para agregar)
        // Variables frecuentes para acceso rápido
        // La etiqueta se genera del registro real: "Entidad — Campo"
        const listaFrecuentes = [
          'presupuesto.numero',
          'contacto.nombre_completo',
          'dirigido_a.nombre_completo',
          'contacto.direccion',
          'empresa.nombre',
          'presupuesto.referencia',
          'presupuesto.fecha_emision',
          'presupuesto.estado',
          'dirigido_a.cargo',
          'contacto.ciudad',
          'contacto.provincia',
          'presupuesto.moneda',
        ]
        const variablesFrecuentes = listaFrecuentes.map(variable => {
          const info = obtenerInfoVariable(variable)
          return { variable, etiqueta: `${info.entidadEtiqueta} — ${info.campoEtiqueta}` }
        })
        const variablesUsadas = new Set(segmentosNombre.map(s => s.variable))
        const separadorGlobal = segmentosNombre.length > 1 ? segmentosNombre[1].separador : ' – '

        return (
        <div>
          <h3 className="text-lg font-semibold text-texto-primario">Nombre del archivo PDF</h3>
          <p className="text-base text-texto-terciario mt-1 mb-5">Elegí qué datos incluir en el nombre del archivo. Si un dato está vacío, se omite automáticamente.</p>

          <div className="space-y-5">
            {/* ── Vista previa ── */}
            <div className="p-4 rounded-card border border-borde-sutil bg-superficie-app">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-card bg-white/[0.04]">
                <FileType className="size-4 text-texto-terciario shrink-0" />
                <p className="text-[13px] font-mono text-texto-primario break-all leading-relaxed">
                  {(() => {
                    const pSel = presupuestosNombrePdf.find(p => p.id === previewNombrePdfId)
                    return generarNombreArchivo(patronNombrePdf, {
                      numero: pSel?.numero || previewNumero,
                      contacto_nombre: pSel?.contacto_nombre ?? 'Constructora',
                      contacto_apellido: pSel?.contacto_apellido ?? 'ABC',
                      fecha_emision: pSel?.fecha_emision || new Date().toISOString(),
                      referencia: pSel?.referencia ?? 'REF-001',
                      atencion_nombre: pSel ? pSel.atencion_nombre : 'María García',
                      atencion_cargo: pSel ? pSel.atencion_cargo : 'Gerente de Compras',
                      contacto_direccion: pSel ? pSel.contacto_direccion : 'Av. Corrientes 1234',
                    })
                  })()}
                </p>
              </div>
              <div className="flex items-center justify-end mt-2">
                <Select
                  valor={previewNombrePdfId}
                  onChange={(v) => setPreviewNombrePdfId(v)}
                  placeholder="Datos de muestra"
                  opciones={[
                    { valor: '', etiqueta: 'Datos de muestra' },
                    ...presupuestosNombrePdf.map(p => ({
                      valor: p.id,
                      etiqueta: `${p.numero} — ${[p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ') || 'Sin contacto'}`,
                    })),
                  ]}
                  className="max-w-[220px]"
                />
              </div>
            </div>

            {/* ── Composición del nombre: pills inline ── */}
            <div className="space-y-3">
              {/* Separador global */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-texto-terciario">Separar con:</span>
                <div className="flex items-center gap-1">
                  {SEPARADORES_DISPONIBLES.map(sep => (
                    <button
                      key={sep}
                      onClick={() => {
                        const nuevos = segmentosNombre.map((s, i) =>
                          i === 0 ? s : { ...s, separador: sep }
                        )
                        actualizarSegmentosNombre(nuevos)
                      }}
                      className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                        separadorGlobal === sep
                          ? 'bg-texto-marca/15 text-texto-marca border border-texto-marca/30'
                          : 'bg-white/[0.04] text-texto-terciario border border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      {sep.trim()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pills del nombre — flujo inline horizontal */}
              <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-card border border-white/[0.07] bg-white/[0.02] min-h-[48px]">
                {segmentosNombre.map((seg, idx) => {
                  const infoPill = obtenerInfoVariable(seg.variable)
                  const etiquetaPill = `${infoPill.entidadEtiqueta} — ${infoPill.campoEtiqueta}`
                  return (
                    <div key={`${seg.variable}-${idx}`} className="contents">
                      {/* Separador visual entre pills */}
                      {idx > 0 && (
                        <span className="text-xs font-mono text-texto-terciario/40 select-none px-0.5">{seg.separador.trim()}</span>
                      )}
                      {/* Pill de la variable */}
                      <span className="group inline-flex items-center gap-1 px-2 py-1 rounded-boton bg-texto-marca/10 border border-texto-marca/20 text-xs text-texto-marca transition-colors hover:bg-texto-marca/15">
                        <span className="font-medium">{etiquetaPill}</span>
                        <button
                          onClick={() => {
                            const nuevos = segmentosNombre.filter((_, i) => i !== idx)
                            if (nuevos.length > 0) nuevos[0] = { ...nuevos[0], separador: '' }
                            actualizarSegmentosNombre(nuevos)
                          }}
                          className="ml-0.5 p-0.5 rounded-sm text-texto-marca/40 hover:text-red-400 hover:bg-red-400/15 transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    </div>
                  )
                })}

                {segmentosNombre.length === 0 && (
                  <span className="text-xs text-texto-terciario/40 italic">Hacé click en un campo para agregarlo</span>
                )}
              </div>

              {/* Variables frecuentes — chips clickeables */}
              <div>
                <span className="text-[11px] text-texto-terciario/60 block mb-2">Click para agregar:</span>
                <div className="flex flex-wrap gap-1.5">
                  {variablesFrecuentes.map(vf => {
                    const yaUsada = variablesUsadas.has(vf.variable)
                    return (
                      <button
                        key={vf.variable}
                        disabled={yaUsada}
                        onClick={() => {
                          const nuevos = [...segmentosNombre, {
                            variable: vf.variable,
                            separador: segmentosNombre.length === 0 ? '' : separadorGlobal,
                          }]
                          actualizarSegmentosNombre(nuevos)
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-boton text-xs transition-all ${
                          yaUsada
                            ? 'bg-white/[0.02] text-texto-terciario/25 border border-white/[0.04] cursor-default line-through'
                            : 'bg-white/[0.04] text-texto-secundario border border-white/[0.08] hover:border-texto-marca/30 hover:bg-texto-marca/8 hover:text-texto-marca cursor-pointer'
                        }`}
                      >
                        <Plus className="size-3" />
                        {vf.etiqueta}
                      </button>
                    )
                  })}

                  {/* Botón para abrir el selector completo */}
                  <SelectorVariables
                    onSeleccionar={(variable) => {
                      const match = variable.match(/\{\{([a-z_]+\.[a-z_]+)\}\}/)
                      if (!match) return
                      const nuevos = [...segmentosNombre, {
                        variable: match[1],
                        separador: segmentosNombre.length === 0 ? '' : separadorGlobal,
                      }]
                      actualizarSegmentosNombre(nuevos)
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ── Tip ── */}
            <p className="text-[11px] text-texto-terciario/50 leading-relaxed">
              Si un dato no tiene valor (ej: no hay dirigido a), esa parte y su separador se omiten automáticamente del nombre.
            </p>
          </div>
        </div>
        )
      })()}

      {/* ─── DATOS BANCARIOS (PORTAL) ─── */}
      {seccionActiva === 'datos_bancarios' && (
        <div>
          <h3 className="text-lg font-semibold text-texto-primario">Datos bancarios para presupuestos</h3>
          <p className="text-base text-texto-terciario mt-1 mb-5">
            Estos datos se muestran en el portal cuando el cliente acepta un presupuesto y necesita realizar el pago.
            Por defecto se usan los datos cargados en Configuración &gt; Empresa.
          </p>

          {/* Toggle: usar datos de empresa o personalizar */}
          <div className="p-4 rounded-card border border-borde-sutil mb-5">
            <div className="flex items-start gap-3">
              <Checkbox
                marcado={datosEmpresaPdf.usar_datos_empresa !== false}
                onChange={(v) => {
                  const nuevo = { ...datosEmpresaPdf, usar_datos_empresa: v }
                  if (v) {
                    // Al activar herencia, copiar datos de empresa
                    nuevo.datos_bancarios = { ...datosBancariosEmpresa }
                  }
                  guardarDatosEmpresaPdf(nuevo)
                }}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-texto-primario">Usar datos de la empresa</p>
                <p className="text-xs text-texto-terciario">
                  Heredar automáticamente los datos bancarios de Configuración &gt; Empresa. Desactivá esta opción si querés usar una cuenta distinta para presupuestos.
                </p>
              </div>
            </div>
          </div>

          {/* Preview de datos de empresa (cuando hereda) */}
          {datosEmpresaPdf.usar_datos_empresa !== false && (
            <div className="p-4 rounded-card bg-superficie-app border border-borde-sutil mb-5">
              <p className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-3">
                Datos heredados de la empresa
              </p>
              {datosBancariosEmpresa.banco || datosBancariosEmpresa.cbu ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {datosBancariosEmpresa.banco && (
                    <div><span className="text-texto-terciario">Banco:</span> <span className="text-texto-primario">{datosBancariosEmpresa.banco}</span></div>
                  )}
                  {datosBancariosEmpresa.titular && (
                    <div><span className="text-texto-terciario">Titular:</span> <span className="text-texto-primario">{datosBancariosEmpresa.titular}</span></div>
                  )}
                  {datosBancariosEmpresa.numero_cuenta && (
                    <div><span className="text-texto-terciario">Nº Cuenta:</span> <span className="text-texto-primario font-mono">{datosBancariosEmpresa.numero_cuenta}</span></div>
                  )}
                  {datosBancariosEmpresa.cbu && (
                    <div><span className="text-texto-terciario">CBU:</span> <span className="text-texto-primario font-mono">{datosBancariosEmpresa.cbu}</span></div>
                  )}
                  {datosBancariosEmpresa.alias && (
                    <div><span className="text-texto-terciario">Alias:</span> <span className="text-texto-primario font-mono">{datosBancariosEmpresa.alias}</span></div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-texto-terciario">
                  No hay datos bancarios cargados en la empresa. Podés cargarlos en{' '}
                  <Boton variante="fantasma" tamano="xs" onClick={() => router.push('/configuracion')} className="text-texto-marca inline">
                    Configuración &gt; Empresa
                  </Boton>.
                </p>
              )}
            </div>
          )}

          {/* Formulario de override (cuando no hereda) */}
          {datosEmpresaPdf.usar_datos_empresa === false && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  etiqueta="Banco"
                  value={datosEmpresaPdf.datos_bancarios?.banco || ''}
                  onChange={(e) => guardarDatosEmpresaPdf({
                    ...datosEmpresaPdf,
                    datos_bancarios: { ...datosEmpresaPdf.datos_bancarios, banco: e.target.value },
                  })}
                  placeholder="Ej: Santander, Galicia"
                  formato={null}
                />
                <Input
                  etiqueta="Titular"
                  value={datosEmpresaPdf.datos_bancarios?.titular || ''}
                  onChange={(e) => guardarDatosEmpresaPdf({
                    ...datosEmpresaPdf,
                    datos_bancarios: { ...datosEmpresaPdf.datos_bancarios, titular: e.target.value },
                  })}
                  placeholder="Razón social o nombre"
                  formato={null}
                />
              </div>
              <Input
                etiqueta="Número de cuenta"
                value={datosEmpresaPdf.datos_bancarios?.numero_cuenta || ''}
                onChange={(e) => guardarDatosEmpresaPdf({
                  ...datosEmpresaPdf,
                  datos_bancarios: { ...datosEmpresaPdf.datos_bancarios, numero_cuenta: e.target.value },
                })}
                placeholder="Ej: 500-066601/3"
                formato={null}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  etiqueta="CBU"
                  value={datosEmpresaPdf.datos_bancarios?.cbu || ''}
                  onChange={(e) => guardarDatosEmpresaPdf({
                    ...datosEmpresaPdf,
                    datos_bancarios: { ...datosEmpresaPdf.datos_bancarios, cbu: e.target.value },
                  })}
                  placeholder="22 dígitos"
                  formato={null}
                  className="font-mono"
                />
                <Input
                  etiqueta="Alias"
                  value={datosEmpresaPdf.datos_bancarios?.alias || ''}
                  onChange={(e) => guardarDatosEmpresaPdf({
                    ...datosEmpresaPdf,
                    datos_bancarios: { ...datosEmpresaPdf.datos_bancarios, alias: e.target.value },
                  })}
                  placeholder="Ej: miempresa.pagos"
                  formato={null}
                  className="font-mono"
                />
              </div>
            </div>
          )}

          {/* Toggle mostrar en portal/PDF */}
          <div className="mt-5 p-4 rounded-card border border-borde-sutil">
            <div className="flex items-start gap-3">
              <Checkbox
                marcado={datosEmpresaPdf.mostrar_datos_bancarios}
                onChange={(v) => guardarDatosEmpresaPdf({ ...datosEmpresaPdf, mostrar_datos_bancarios: v })}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-texto-primario">Mostrar datos bancarios en portal y PDF</p>
                <p className="text-xs text-texto-terciario">
                  Si está activado, los datos bancarios aparecen en el portal del cliente y en el pie del PDF del presupuesto.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MÓDULO ─── */}
      {seccionActiva === 'modulo' && (
        <div>
          <h3 className="text-lg font-semibold text-texto-primario">Módulo de Presupuestos</h3>
          <p className="text-base text-texto-terciario mb-6">Gestión del módulo dentro de tu empresa</p>

          <div className="space-y-6">
            {/* Estado del módulo */}
            <div className="p-5 rounded-card border border-borde-sutil">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-card bg-[var(--texto-marca)]/10 flex items-center justify-center">
                    <Package size={20} className="text-texto-marca" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-texto-primario">Presupuestos</p>
                    <p className="text-xs text-texto-terciario">Cotizaciones comerciales con líneas, impuestos y condiciones de pago</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-insignia-exito/10 text-insignia-exito font-medium">
                  Activo
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 rounded-card bg-superficie-app space-y-3">
              <p className="text-xs text-texto-secundario">
                <strong>Categoría:</strong> Finanzas
              </p>
              <p className="text-xs text-texto-secundario">
                <strong>Dependencias:</strong> Contactos
              </p>
              <p className="text-xs text-texto-terciario">
                Al desactivar este módulo se oculta del menú lateral y las rutas dejan de ser accesibles.
                Los datos no se eliminan — al reactivar, todo vuelve a estar disponible.
              </p>
            </div>

            {/* Botón desactivar */}
            <div className="pt-4 border-t border-borde-sutil">
              <Boton
                variante="peligro"
                tamano="sm"
                icono={<Package size={15} />}
                onClick={() => {
                  // Fase futura: desactivación de módulo con purga programada
                }}
              >
                Desactivar módulo
              </Boton>
              <p className="text-xs text-texto-terciario mt-2">
                Esta acción no elimina datos. Podés reactivar el módulo en cualquier momento.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Modal crear/editar impuesto/moneda/unidad */}
      <ModalItemConfiguracion
        abierto={modalFinanciero.abierto}
        onCerrar={() => setModalFinanciero({ abierto: false, seccion: '' })}
        titulo={
          modalFinanciero.editandoId
            ? `Editar ${modalFinanciero.seccion === 'impuestos' ? 'impuesto' : modalFinanciero.seccion === 'monedas' ? 'moneda' : 'unidad'}`
            : `${modalFinanciero.seccion === 'impuestos' ? 'Nuevo impuesto' : modalFinanciero.seccion === 'monedas' ? 'Nueva moneda' : 'Nueva unidad'}`
        }
        campos={
          modalFinanciero.seccion === 'impuestos'
            ? [
                { tipo: 'texto', clave: 'nombre', etiqueta: 'Nombre', placeholder: 'Ej: IVA 21%, Exento...' },
                { tipo: 'numero', clave: 'porcentaje', etiqueta: 'Porcentaje', placeholder: '21', min: 0, max: 100, sufijo: '% del subtotal' },
              ]
            : modalFinanciero.seccion === 'monedas'
            ? [
                { tipo: 'texto', clave: 'codigo', etiqueta: 'Código', placeholder: 'Ej: ARS, USD...', formato: 'mayusculas' as const, maxLength: 5 },
                { tipo: 'texto', clave: 'simbolo', etiqueta: 'Símbolo', placeholder: 'Ej: $, US$, €...', maxLength: 5 },
                { tipo: 'texto', clave: 'nombre', etiqueta: 'Nombre', placeholder: 'Ej: Peso Argentino, Dólar...' },
              ]
            : [
                { tipo: 'texto', clave: 'nombre', etiqueta: 'Nombre', placeholder: 'Ej: Kilogramo, Metro...' },
                { tipo: 'texto', clave: 'abreviatura', etiqueta: 'Abreviatura', placeholder: 'Ej: kg, m, hs...', maxLength: 5 },
              ]
        }
        valores={modalFinanciero.valores}
        onGuardar={(valores) => {
          const nombre = String(valores.nombre || '').trim()

          if (modalFinanciero.seccion === 'impuestos') {
            if (!nombre) return
            const porcentaje = Number(valores.porcentaje) || 0
            if (modalFinanciero.editandoId) {
              guardarImpuestos(impuestos.map(i => i.id === modalFinanciero.editandoId ? { ...i, label: nombre, porcentaje } : i))
            } else {
              guardarImpuestos([...impuestos, { id: `imp-${Date.now()}`, label: nombre, porcentaje, activo: true }])
            }
          } else if (modalFinanciero.seccion === 'monedas') {
            const codigo = String(valores.codigo || '').trim().toUpperCase()
            const simbolo = String(valores.simbolo || '').trim()
            if (!codigo || !nombre) return
            if (modalFinanciero.editandoId) {
              guardarMonedas(monedas.map(m => m.id === modalFinanciero.editandoId ? { ...m, id: codigo, label: nombre, simbolo } : m))
            } else {
              guardarMonedas([...monedas, { id: codigo, label: nombre, simbolo, activo: true }])
            }
          } else if (modalFinanciero.seccion === 'unidades') {
            if (!nombre) return
            const abreviatura = String(valores.abreviatura || '').trim()
            if (modalFinanciero.editandoId) {
              guardarUnidades(unidades.map(u => u.id === modalFinanciero.editandoId ? { ...u, label: nombre, abreviatura } : u))
            } else {
              guardarUnidades([...unidades, { id: `u-${Date.now()}`, label: nombre, abreviatura }])
            }
          }

          setModalFinanciero({ abierto: false, seccion: '' })
        }}
      />
    </PlantillaConfiguracion>
  )
}
