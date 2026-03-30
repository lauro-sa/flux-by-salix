/**
 * Motor de renderizado HTML para plantillas de presupuestos.
 * Funciones puras sin dependencias de servidor — se usan tanto en
 * el cliente (vista previa en vivo) como en el servidor (generación de PDF).
 * Se usa en: editor de plantilla (client), generar-pdf.ts (server)
 */

import { PLANTILLA_PDF_DEFECTO } from './plantilla-defecto'
import { COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'

// Convierte el valor de notas/condiciones a HTML para el PDF.
// Soporta: JSON array de HTML strings, HTML suelto, y texto plano legacy.
function notasAHtml(valor: string | null): string {
  if (!valor || !valor.trim()) return ''
  try {
    const parsed = JSON.parse(valor)
    if (Array.isArray(parsed)) {
      return parsed.map((h: string) => `<div>${h}</div>`).join('\n')
    }
  } catch { /* no es JSON */ }
  // HTML suelto o texto plano
  if (!valor.includes('<')) {
    return valor.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('\n')
  }
  return valor
}
import type {
  ConfigMembrete,
  ConfigPiePagina,
  ConfigDatosEmpresaPdf,
  LineaPresupuesto,
  CuotaPago,
} from '@/tipos/presupuesto'

// ─── Tipos exportados ───

export interface DatosPresupuestoPdf {
  numero: string
  estado: string
  fecha_emision: string
  fecha_vencimiento: string | null
  moneda: string
  moneda_simbolo: string
  referencia: string | null
  condicion_pago_label: string | null
  nota_plan_pago: string | null
  contacto_nombre: string | null
  contacto_apellido: string | null
  contacto_identificacion: string | null
  contacto_condicion_iva: string | null
  contacto_direccion: string | null
  contacto_correo: string | null
  contacto_telefono: string | null
  atencion_nombre: string | null
  atencion_cargo: string | null
  atencion_correo: string | null
  subtotal_neto: string
  total_impuestos: string
  descuento_global: string
  descuento_global_monto: string
  total_final: string
  notas_html: string | null
  condiciones_html: string | null
  lineas: LineaPresupuesto[]
  cuotas: CuotaPago[]
}

export interface DatosEmpresa {
  nombre: string
  logo_url: string | null
  datos_fiscales: Record<string, string> | null
  pais: string | null
  paises: string[]
  color_marca?: string | null
  direccion?: string
  telefono?: string
  correo?: string
  pagina_web?: string
}

export interface ConfigPdf {
  membrete: ConfigMembrete | null
  pie_pagina: ConfigPiePagina | null
  plantilla_html: string | null
  patron_nombre_pdf: string | null
  datos_empresa_pdf: ConfigDatosEmpresaPdf | null
  monedas: { id: string; simbolo: string }[]
}

// ─── Formateo ───

export function formatearNumero(valor: string | number, decimales = 2): string {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor
  if (isNaN(num)) return '0,00'
  return num.toLocaleString('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

export function formatearFecha(fechaIso: string | null): string {
  if (!fechaIso) return '-'
  const fecha = new Date(fechaIso)
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─── Motor de plantillas ───

function procesarPlantilla(html: string, variables: Record<string, string | boolean>): string {
  let resultado = html
  // Procesar condicionales de adentro hacia afuera:
  // el regex solo machea bloques que NO contienen otro {{#if}} adentro
  let anterior = ''
  while (anterior !== resultado) {
    anterior = resultado
    resultado = resultado.replace(
      /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if\s)[\s\S])*?)\{\{\/if\}\}/g,
      (_match, variable: string, contenido: string) => {
        const valor = variables[variable]
        if (valor && valor !== 'false' && valor !== '0') return contenido
        return ''
      }
    )
  }
  // Reemplazar variables simples {variable}
  resultado = resultado.replace(/\{(\w+)\}/g, (_match, variable: string) => {
    const valor = variables[variable]
    if (valor === undefined || valor === null || valor === false) return ''
    return String(valor)
  })
  return resultado
}

function procesarLoops(
  html: string,
  loops: Record<string, Record<string, string | boolean>[]>
): string {
  let resultado = html
  for (const [nombre, items] of Object.entries(loops)) {
    const regex = new RegExp(`\\{\\{#each\\s+${nombre}\\}\\}([\\s\\S]*?)\\{\\{\\/each\\}\\}`, 'g')
    resultado = resultado.replace(regex, (_match, plantillaItem: string) => {
      return items.map(item => procesarPlantilla(plantillaItem, item)).join('')
    })
  }
  return resultado
}

function obtenerSimboloMoneda(monedaId: string, monedas: { id: string; simbolo: string }[]): string {
  return monedas.find(m => m.id === monedaId)?.simbolo || '$'
}

function calcularDesgloseImpuestos(
  lineas: LineaPresupuesto[]
): { label: string; porcentaje: number; monto: number }[] {
  const mapa: Record<string, { label: string; porcentaje: number; monto: number }> = {}
  for (const linea of lineas) {
    if (linea.tipo_linea !== 'producto') continue
    const pct = parseFloat(linea.impuesto_porcentaje) || 0
    if (pct === 0) continue
    const clave = `${linea.impuesto_label || 'Impuesto'}_${pct}`
    if (!mapa[clave]) {
      mapa[clave] = { label: linea.impuesto_label || `Impuesto ${pct}%`, porcentaje: pct, monto: 0 }
    }
    mapa[clave].monto += parseFloat(linea.impuesto_monto) || 0
  }
  return Object.values(mapa).sort((a, b) => b.porcentaje - a.porcentaje)
}

function renderizarColumnaPie(
  columna?: { tipo?: string; texto?: string; tamano_texto?: number; imagen_url?: string; texto_imagen?: string; posicion_texto?: string; alineacion_texto?: string },
  tamanoBase?: number
): string {
  if (!columna || columna.tipo === 'vacio') return ''
  if (columna.tipo === 'texto') {
    const tam = columna.tamano_texto || tamanoBase || 10
    return columna.texto ? `<span style="font-size:${tam}px;">${columna.texto}</span>` : ''
  }
  if (columna.tipo === 'numeracion') return '<span class="numero-pagina">Página 1 de 1</span>'
  if (columna.tipo === 'imagen') {
    const img = columna.imagen_url ? `<img src="${columna.imagen_url}" alt="" style="max-height:40px;object-fit:contain;">` : ''
    const txt = columna.texto_imagen ? `<span style="font-size:0.85em;">${columna.texto_imagen}</span>` : ''
    if (!txt) return img
    const esArriba = columna.posicion_texto === 'arriba'
    const alin = columna.alineacion_texto === 'derecha' ? 'flex-end' : columna.alineacion_texto === 'centro' ? 'center' : 'flex-start'
    return `<div style="display:inline-flex;flex-direction:column;align-items:${alin};gap:2px;">${esArriba ? txt + img : img + txt}</div>`
  }
  return ''
}

// ─── Colores dinámicos ───

function hexARgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function generarVariablesColor(colorMarca: string | null | undefined): Record<string, string> {
  const color = colorMarca || COLOR_MARCA_DEFECTO
  const rgb = hexARgb(color)
  return {
    color_primario: `rgb(${rgb})`,
    color_primario_60: `rgba(${rgb}, 0.6)`,
    color_primario_25: `rgba(${rgb}, 0.25)`,
    color_primario_20: `rgba(${rgb}, 0.2)`,
    color_primario_15: `rgba(${rgb}, 0.15)`,
    color_primario_08: `rgba(${rgb}, 0.08)`,
    color_primario_05: `rgba(${rgb}, 0.05)`,
  }
}

// ─── Renderizado principal ───

export function renderizarHtml(
  presupuesto: DatosPresupuestoPdf,
  empresa: DatosEmpresa,
  config: ConfigPdf,
): string {
  const plantilla = config.plantilla_html || PLANTILLA_PDF_DEFECTO
  const membrete = config.membrete
  const pie = config.pie_pagina
  const datosEmpPdf = config.datos_empresa_pdf
  const simbolo = obtenerSimboloMoneda(presupuesto.moneda, config.monedas)
  const desgloseImp = calcularDesgloseImpuestos(presupuesto.lineas)
  const colores = generarVariablesColor(empresa.color_marca)

  const nombreContacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido]
    .filter(Boolean)
    .join(' ') || 'Sin contacto'

  let empresaIdentificacion = ''
  let empresaIdentificacionLabel = 'ID'
  let empresaCondicionFiscal = ''
  if (empresa.datos_fiscales) {
    const df = empresa.datos_fiscales
    if (df.cuit) { empresaIdentificacion = df.cuit; empresaIdentificacionLabel = 'CUIT' }
    else if (df.rut) { empresaIdentificacion = df.rut; empresaIdentificacionLabel = 'RUT' }
    else if (df.rfc) { empresaIdentificacion = df.rfc; empresaIdentificacionLabel = 'RFC' }
    else if (df.nit) { empresaIdentificacion = df.nit; empresaIdentificacionLabel = 'NIT' }
    else if (df.nif) { empresaIdentificacion = df.nif; empresaIdentificacionLabel = 'NIF' }
    else if (df.ruc) { empresaIdentificacion = df.ruc; empresaIdentificacionLabel = 'RUC' }
    if (df.condicion_iva) {
      const mapeo: Record<string, string> = {
        'responsable_inscripto': 'Responsable Inscripto',
        'monotributista': 'Monotributista',
        'exento': 'Exento',
        'consumidor_final': 'Consumidor Final',
        'sujeto_no_categorizado': 'Sujeto No Categorizado',
      }
      empresaCondicionFiscal = mapeo[df.condicion_iva] || df.condicion_iva
    }
  }

  const variables: Record<string, string | boolean> = {
    // Colores dinámicos (basados en color de marca de la empresa)
    ...colores,
    mostrar_membrete: !!membrete,
    mostrar_logo: membrete?.mostrar_logo ?? true,
    no_mostrar_logo: membrete?.mostrar_logo === false,
    tipo_logo: membrete?.tipo_logo || 'cuadrado',
    posicion_logo: membrete?.posicion_logo || 'izquierda',
    ancho_logo: String(membrete?.ancho_logo || 30),
    texto_logo: membrete?.texto_logo || '',
    tamano_texto_logo: String(membrete?.tamano_texto_logo || 16),
    subtitulo_logo: membrete?.subtitulo_logo || '',
    tamano_subtitulo: String(membrete?.tamano_subtitulo || 10),
    alineacion_texto: membrete?.alineacion_texto || 'derecha',
    tamano_texto_membrete: String(membrete?.tamano_texto || 11),
    membrete_contenido_html: membrete?.contenido_html || '',
    membrete_linea_separadora: membrete?.linea_separadora ?? true,
    grosor_linea: String(membrete?.grosor_linea || 1),
    color_linea_es_marca: membrete?.color_linea === 'marca',
    empresa_logo_url: empresa.logo_url || '',
    tipo_documento: 'Presupuesto',
    numero: presupuesto.numero,
    estado: presupuesto.estado,
    fecha_emision: formatearFecha(presupuesto.fecha_emision),
    fecha_vencimiento: formatearFecha(presupuesto.fecha_vencimiento),
    moneda_codigo: presupuesto.moneda,
    moneda_simbolo: simbolo,
    referencia: presupuesto.referencia || '',
    condicion_pago: presupuesto.condicion_pago_label || '',
    nota_plan_pago: presupuesto.nota_plan_pago || '',
    empresa_nombre: (datosEmpPdf?.mostrar_razon_social !== false) ? empresa.nombre : '',
    empresa_identificacion: (datosEmpPdf?.mostrar_identificacion !== false) ? empresaIdentificacion : '',
    empresa_identificacion_label: empresaIdentificacionLabel,
    empresa_condicion_fiscal: (datosEmpPdf?.mostrar_condicion_fiscal !== false) ? empresaCondicionFiscal : '',
    empresa_direccion: (datosEmpPdf?.mostrar_direccion !== false) ? (empresa.direccion || '') : '',
    empresa_telefono: (datosEmpPdf?.mostrar_telefono !== false) ? (empresa.telefono || '') : '',
    empresa_correo: (datosEmpPdf?.mostrar_correo !== false) ? (empresa.correo || '') : '',
    empresa_pagina_web: (datosEmpPdf?.mostrar_pagina_web === true) ? (empresa.pagina_web || '') : '',
    contacto_nombre: nombreContacto,
    contacto_identificacion: presupuesto.contacto_identificacion || '',
    contacto_condicion_fiscal: presupuesto.contacto_condicion_iva || '',
    contacto_direccion: presupuesto.contacto_direccion || '',
    contacto_correo: presupuesto.contacto_correo || '',
    contacto_telefono: presupuesto.contacto_telefono || '',
    atencion_nombre: presupuesto.atencion_nombre || '',
    atencion_cargo: presupuesto.atencion_cargo || '',
    atencion_correo: presupuesto.atencion_correo || '',
    subtotal_neto_formateado: formatearNumero(presupuesto.subtotal_neto),
    total_impuestos_formateado: formatearNumero(presupuesto.total_impuestos),
    tiene_descuento_global: parseFloat(presupuesto.descuento_global) > 0,
    descuento_global_porcentaje: presupuesto.descuento_global,
    descuento_global_monto_formateado: formatearNumero(presupuesto.descuento_global_monto),
    total_final_formateado: formatearNumero(presupuesto.total_final),
    notas_html: notasAHtml(presupuesto.notas_html),
    condiciones_html: notasAHtml(presupuesto.condiciones_html),
    tiene_cuotas: presupuesto.cuotas.length > 0,
    mostrar_datos_bancarios: datosEmpPdf?.mostrar_datos_bancarios === true,
    banco: datosEmpPdf?.datos_bancarios?.banco || '',
    banco_titular: datosEmpPdf?.datos_bancarios?.titular || '',
    banco_cbu: datosEmpPdf?.datos_bancarios?.cbu || '',
    banco_alias: datosEmpPdf?.datos_bancarios?.alias || '',
    mostrar_pie: !!pie,
    pie_linea_superior: pie?.linea_superior ?? true,
    pie_grosor_linea: String(pie?.grosor_linea || 1),
    pie_color_linea_es_marca: pie?.color_linea === 'marca',
    pie_color_linea: pie?.color_linea === 'marca' ? colores.color_primario : '#d1d5db',
    pie_tamano_texto: String(pie?.tamano_texto || 10),
    pie_izquierda: renderizarColumnaPie(pie?.columnas?.izquierda, pie?.tamano_texto),
    pie_centro: renderizarColumnaPie(pie?.columnas?.centro, pie?.tamano_texto),
    pie_derecha: renderizarColumnaPie(pie?.columnas?.derecha, pie?.tamano_texto),
  }

  const lineasLoop = presupuesto.lineas
    .sort((a, b) => a.orden - b.orden)
    .map(linea => ({
      es_producto: linea.tipo_linea === 'producto',
      es_seccion: linea.tipo_linea === 'seccion',
      es_nota: linea.tipo_linea === 'nota',
      es_descuento: linea.tipo_linea === 'descuento',
      codigo_producto: linea.codigo_producto || '',
      descripcion: linea.descripcion || '',
      descripcion_detalle: linea.descripcion_detalle || '',
      cantidad: linea.tipo_linea === 'producto' ? formatearNumero(linea.cantidad, 2) : '',
      unidad: linea.unidad || '',
      precio_unitario_formateado: formatearNumero(linea.precio_unitario),
      tiene_descuento: parseFloat(linea.descuento) > 0,
      descuento: linea.descuento,
      impuesto_label: linea.impuesto_label || '',
      subtotal_formateado: formatearNumero(linea.subtotal),
      monto_formateado: formatearNumero(linea.monto || '0'),
      moneda_simbolo: simbolo,
    }))

  const impuestosLoop = desgloseImp.map(imp => ({
    label: imp.label,
    monto_formateado: formatearNumero(imp.monto),
    moneda_simbolo: simbolo,
  }))

  const cuotasLoop = presupuesto.cuotas
    .sort((a, b) => a.numero - b.numero)
    .map(cuota => ({
      numero: String(cuota.numero),
      descripcion: cuota.descripcion || '',
      porcentaje: cuota.porcentaje,
      monto_formateado: formatearNumero(cuota.monto),
      moneda_simbolo: simbolo,
      estado: cuota.estado,
      estado_label: cuota.estado === 'cobrada' ? 'Cobrada' : 'Pendiente',
    }))

  let html = procesarLoops(plantilla, {
    lineas: lineasLoop as unknown as Record<string, string | boolean>[],
    impuestos_desglose: impuestosLoop as unknown as Record<string, string | boolean>[],
    cuotas: cuotasLoop as unknown as Record<string, string | boolean>[],
  })

  html = procesarPlantilla(html, variables)
  return html
}

// ─── Nombre del archivo ───

export function generarNombreArchivo(
  patron: string | null,
  presupuesto: { numero: string; contacto_nombre: string | null; contacto_apellido: string | null; fecha_emision: string; referencia: string | null }
): string {
  const template = patron || '{numero} - {contacto_nombre}'
  const nombreContacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido]
    .filter(Boolean)
    .join(' ') || 'Sin contacto'

  const nombre = template
    .replace('{numero}', presupuesto.numero || '')
    .replace('{contacto_nombre}', nombreContacto)
    .replace('{fecha}', formatearFecha(presupuesto.fecha_emision).replace(/\//g, '-'))
    .replace('{tipo}', 'Presupuesto')
    .replace('{referencia}', presupuesto.referencia || '')
    .trim()

  return nombre.replace(/[<>:"/\\|?*]/g, '_') + '.pdf'
}

// ─── Datos de muestra para la vista previa ───

export const DATOS_MUESTRA: DatosPresupuestoPdf = {
  numero: 'P-0001',
  estado: 'borrador',
  fecha_emision: new Date().toISOString(),
  fecha_vencimiento: new Date(Date.now() + 30 * 86400000).toISOString(),
  moneda: 'ARS',
  moneda_simbolo: '$',
  referencia: 'REF-2026-001',
  condicion_pago_label: '30 días',
  nota_plan_pago: null,
  contacto_nombre: 'Juan',
  contacto_apellido: 'Pérez',
  contacto_identificacion: '20-12345678-9',
  contacto_condicion_iva: 'Responsable Inscripto',
  contacto_direccion: 'Av. Corrientes 1234, CABA',
  contacto_correo: 'juan.perez@email.com',
  contacto_telefono: '+54 11 4567-8900',
  atencion_nombre: 'María López',
  atencion_cargo: 'Gerente de Compras',
  atencion_correo: 'maria@email.com',
  subtotal_neto: '150000',
  total_impuestos: '31500',
  descuento_global: '0',
  descuento_global_monto: '0',
  total_final: '181500',
  notas_html: 'Presupuesto válido por 30 días. Los precios no incluyen instalación.',
  condiciones_html: 'Los plazos de entrega se confirman al aprobar el presupuesto.',
  lineas: [
    {
      id: '1', presupuesto_id: '', tipo_linea: 'seccion', orden: 0,
      codigo_producto: null, descripcion: 'SERVICIOS PROFESIONALES', descripcion_detalle: null,
      cantidad: '0', unidad: null, precio_unitario: '0', descuento: '0',
      impuesto_label: null, impuesto_porcentaje: '0',
      subtotal: '0', impuesto_monto: '0', total: '0', monto: null,
    },
    {
      id: '2', presupuesto_id: '', tipo_linea: 'producto', orden: 1,
      codigo_producto: 'SRV-001', descripcion: 'Consultoría técnica', descripcion_detalle: 'Relevamiento inicial y análisis de requerimientos',
      cantidad: '20', unidad: 'hs', precio_unitario: '5000', descuento: '0',
      impuesto_label: 'IVA 21%', impuesto_porcentaje: '21',
      subtotal: '100000', impuesto_monto: '21000', total: '121000', monto: null,
    },
    {
      id: '3', presupuesto_id: '', tipo_linea: 'producto', orden: 2,
      codigo_producto: 'SRV-002', descripcion: 'Desarrollo e implementación', descripcion_detalle: null,
      cantidad: '1', unidad: 'gl', precio_unitario: '50000', descuento: '10',
      impuesto_label: 'IVA 21%', impuesto_porcentaje: '21',
      subtotal: '45000', impuesto_monto: '9450', total: '54450', monto: null,
    },
    {
      id: '4', presupuesto_id: '', tipo_linea: 'nota', orden: 3,
      codigo_producto: null, descripcion: 'Incluye soporte por 3 meses.', descripcion_detalle: null,
      cantidad: '0', unidad: null, precio_unitario: '0', descuento: '0',
      impuesto_label: null, impuesto_porcentaje: '0',
      subtotal: '0', impuesto_monto: '0', total: '0', monto: null,
    },
    {
      id: '5', presupuesto_id: '', tipo_linea: 'producto', orden: 4,
      codigo_producto: 'LIC-001', descripcion: 'Licencia anual plataforma', descripcion_detalle: null,
      cantidad: '1', unidad: 'un', precio_unitario: '5000', descuento: '0',
      impuesto_label: 'IVA 10.5%', impuesto_porcentaje: '10.5',
      subtotal: '5000', impuesto_monto: '1050', total: '6050', monto: null,
    },
  ],
  cuotas: [],
}

export const EMPRESA_MUESTRA: DatosEmpresa = {
  nombre: 'Mi Empresa SRL',
  logo_url: null,
  datos_fiscales: { cuit: '30-12345678-9', condicion_iva: 'responsable_inscripto' },
  pais: 'AR',
  paises: ['AR'],
  color_marca: '#3b82f6',
  direccion: 'Av. Santa Fe 2500, CABA, Argentina',
  telefono: '+54 11 5555-0000',
  correo: 'info@miempresa.com',
  pagina_web: 'www.miempresa.com',
}
