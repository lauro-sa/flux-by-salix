'use client'

/**
 * ModalEditorPlantillaWA — Editor de plantillas de WhatsApp (Meta Business).
 * Permite crear, editar y previsualizar plantillas con validación en tiempo real.
 * Incluye: encabezado, cuerpo con variables, pie de página, botones, preview estilo teléfono.
 * Se usa en: inbox/configuracion (sección plantillas_wa).
 */

import { useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { Insignia } from '@/componentes/ui/Insignia'
import { useToast } from '@/componentes/feedback/Toast'
import {
  Save, Send, Plus, Trash2, Loader2, AlertTriangle,
  CheckCircle2, Clock, XCircle, Ban, Pause, Eye,
  Bold, Italic, Strikethrough, Code, Variable,
  X, User, FileText as FileTextIcon,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { BuscadorContactoPreview } from '@/componentes/entidad/_editor_plantilla/BuscadorContactoPreview'
import { BuscadorDocumentoPreview } from '@/componentes/entidad/_editor_plantilla/BuscadorDocumentoPreview'
import { DATOS_EJEMPLO } from '@/componentes/entidad/_editor_plantilla/constantes'
import { formatoMoneda, formatoFecha } from '@/componentes/entidad/_editor_plantilla/utilidades'
import { useFormato } from '@/hooks/useFormato'
import type { DocumentoResultado } from '@/componentes/entidad/_editor_plantilla/tipos'
import type {
  PlantillaWhatsApp, ComponentesPlantillaWA, CategoriaPlantillaWA,
  IdiomaPlantillaWA, TipoEncabezadoWA, TipoBotonWA, BotonPlantillaWA,
  EstadoMeta,
} from '@/tipos/inbox'

// ─── Constantes ───

const CATEGORIAS: { valor: CategoriaPlantillaWA; etiqueta: string }[] = [
  { valor: 'MARKETING', etiqueta: 'Marketing' },
  { valor: 'UTILITY', etiqueta: 'Utilidad' },
  { valor: 'AUTHENTICATION', etiqueta: 'Autenticación' },
]

const IDIOMAS: { valor: IdiomaPlantillaWA; etiqueta: string }[] = [
  { valor: 'es', etiqueta: 'Español' },
  { valor: 'es_AR', etiqueta: 'Español (Argentina)' },
  { valor: 'es_MX', etiqueta: 'Español (México)' },
  { valor: 'en', etiqueta: 'Inglés' },
  { valor: 'en_US', etiqueta: 'Inglés (EE.UU.)' },
  { valor: 'pt_BR', etiqueta: 'Portugués (Brasil)' },
  { valor: 'fr', etiqueta: 'Francés' },
  { valor: 'it', etiqueta: 'Italiano' },
  { valor: 'de', etiqueta: 'Alemán' },
]

const TIPOS_ENCABEZADO: { valor: TipoEncabezadoWA; etiqueta: string }[] = [
  { valor: 'NONE', etiqueta: 'Sin encabezado' },
  { valor: 'TEXT', etiqueta: 'Texto' },
  { valor: 'IMAGE', etiqueta: 'Imagen' },
  { valor: 'VIDEO', etiqueta: 'Video' },
  { valor: 'DOCUMENT', etiqueta: 'Documento' },
]

/** Módulos donde puede usarse la plantilla. Si vacío = disponible en todos */
const MODULOS_DISPONIBLES: { valor: string; etiqueta: string }[] = [
  { valor: 'inbox', etiqueta: 'Inbox (chat)' },
  { valor: 'presupuestos', etiqueta: 'Presupuestos' },
  { valor: 'contactos', etiqueta: 'Contactos' },
  { valor: 'ordenes', etiqueta: 'Órdenes' },
  { valor: 'actividades', etiqueta: 'Actividades' },
]

const TIPOS_BOTON: { valor: TipoBotonWA; etiqueta: string }[] = [
  { valor: 'QUICK_REPLY', etiqueta: 'Respuesta rápida' },
  { valor: 'URL', etiqueta: 'Enlace URL' },
  { valor: 'PHONE_NUMBER', etiqueta: 'Número de teléfono' },
]

const ESTADOS_META: Record<EstadoMeta, { color: string; icono: typeof CheckCircle2; etiqueta: string }> = {
  BORRADOR: { color: 'neutro', icono: Save, etiqueta: 'Borrador' },
  PENDING: { color: 'advertencia', icono: Clock, etiqueta: 'En revisión' },
  APPROVED: { color: 'exito', icono: CheckCircle2, etiqueta: 'Aprobada' },
  REJECTED: { color: 'peligro', icono: XCircle, etiqueta: 'Rechazada' },
  DISABLED: { color: 'peligro', icono: Ban, etiqueta: 'Deshabilitada' },
  PAUSED: { color: 'advertencia', icono: Pause, etiqueta: 'Pausada' },
  ERROR: { color: 'peligro', icono: AlertTriangle, etiqueta: 'Error' },
}

// ─── Mapeo de variables Flux ───

const OPCIONES_MAPEO_VARIABLES = [
  { valor: '', etiqueta: 'Sin asignar' },
  { valor: 'contacto_nombre', etiqueta: 'Contacto — Nombre completo' },
  { valor: 'contacto_telefono', etiqueta: 'Contacto — Teléfono' },
  { valor: 'contacto_correo', etiqueta: 'Contacto — Correo' },
  { valor: 'documento_numero', etiqueta: 'Documento — Número' },
  { valor: 'documento_total', etiqueta: 'Documento — Total' },
  { valor: 'documento_fecha', etiqueta: 'Documento — Fecha emisión' },
  { valor: 'empresa_nombre', etiqueta: 'Empresa — Nombre' },
]

const EJEMPLOS_POR_CAMPO: Record<string, string> = {
  contacto_nombre: 'Juan García',
  contacto_telefono: '+54 11 1234-5678',
  contacto_correo: 'juan@ejemplo.com',
  documento_numero: 'PRE-00042',
  documento_total: '$150.000,00',
  documento_fecha: '05/04/2026',
  empresa_nombre: 'Mi Empresa S.A.',
}

// ─── Props ───

interface Props {
  abierto: boolean
  onCerrar: () => void
  plantilla: PlantillaWhatsApp | null
  canalId: string
  onGuardado: () => void
}

// ─── Componente ───

export function ModalEditorPlantillaWA({ abierto, onCerrar, plantilla, canalId, onGuardado }: Props) {
  const { locale, formatoHora: fmtHora } = useFormato()
  const { mostrar } = useToast()
  const [guardando, setGuardando] = useState(false)
  const [enviandoAMeta, setEnviandoAMeta] = useState(false)
  const [pestana, setPestana] = useState<'editar' | 'preview'>('editar')

  // Estado del formulario
  const [nombre, setNombre] = useState('')
  const [nombreApi, setNombreApi] = useState('')
  const [nombreApiManual, setNombreApiManual] = useState(false)
  const [categoria, setCategoria] = useState<CategoriaPlantillaWA>('UTILITY')
  const [idioma, setIdioma] = useState<IdiomaPlantillaWA>('es')
  const [componentes, setComponentes] = useState<ComponentesPlantillaWA>({
    cuerpo: { texto: '' },
  })
  const [modulos, setModulos] = useState<string[]>([])

  // Datos de preview (contacto + documento reales)
  const [contactoPreview, setContactoPreview] = useState<Record<string, unknown> | null>(null)
  const [documentoPreview, setDocumentoPreview] = useState<DocumentoResultado | null>(null)
  const [cargandoContacto, setCargandoContacto] = useState(false)

  const esEditable = !plantilla || ['BORRADOR', 'ERROR'].includes(plantilla.estado_meta)

  useEffect(() => {
    if (plantilla) {
      setNombre(plantilla.nombre)
      setNombreApi(plantilla.nombre_api)
      setNombreApiManual(true)
      setCategoria(plantilla.categoria)
      setIdioma(plantilla.idioma)
      setComponentes(plantilla.componentes || { cuerpo: { texto: '' } })
      setModulos(plantilla.modulos || [])
    } else {
      setNombre('')
      setNombreApi('')
      setNombreApiManual(false)
      setCategoria('UTILITY')
      setIdioma('es')
      setComponentes({ cuerpo: { texto: '' } })
      setModulos([])
    }
    setPestana('editar')
  }, [plantilla, abierto])

  useEffect(() => {
    if (!nombreApiManual && nombre) {
      const generado = nombre
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 512)
      setNombreApi(generado)
    }
  }, [nombre, nombreApiManual])

  // ─── Validaciones ───

  const errores = useMemo(() => {
    const e: Record<string, string> = {}
    if (!nombre.trim()) e.nombre = 'El nombre es requerido'
    if (!nombreApi.trim()) e.nombre_api = 'El identificador API es requerido'
    else if (!/^[a-z0-9_]+$/.test(nombreApi)) e.nombre_api = 'Solo minúsculas, números y guiones bajos'
    else if (nombreApi.length > 512) e.nombre_api = 'Máximo 512 caracteres'

    const cuerpo = componentes.cuerpo?.texto || ''
    if (!cuerpo.trim()) e.cuerpo = 'El cuerpo es requerido'
    else if (cuerpo.length > 1024) e.cuerpo = `${cuerpo.length}/1024 caracteres`

    if (componentes.encabezado?.tipo === 'TEXT') {
      const textoEnc = componentes.encabezado.texto || ''
      if (textoEnc.length > 60) e.encabezado = `${textoEnc.length}/60 caracteres`
    }

    if (componentes.pie_pagina?.texto) {
      const pie = componentes.pie_pagina.texto
      if (pie.length > 60) e.pie_pagina = `${pie.length}/60 caracteres`
    }

    if (componentes.botones) {
      for (let i = 0; i < componentes.botones.length; i++) {
        const b = componentes.botones[i]
        if (b.texto.length > 25) e[`boton_${i}`] = 'Texto máximo 25 caracteres'
        if (b.tipo === 'URL' && b.url && !b.url.startsWith('https://')) e[`boton_url_${i}`] = 'Debe empezar con https://'
        if (b.tipo === 'PHONE_NUMBER' && b.telefono && !b.telefono.startsWith('+')) e[`boton_tel_${i}`] = 'Debe empezar con +'
      }
    }

    return e
  }, [nombre, nombreApi, componentes])

  const tieneErrores = Object.keys(errores).length > 0

  // ─── Variables detectadas ───

  const variablesDetectadas = useMemo(() => {
    const texto = componentes.cuerpo?.texto || ''
    const matches = texto.match(/\{\{\d+\}\}/g)
    if (!matches) return []
    const nums = [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ''))))]
    return nums.sort((a, b) => a - b)
  }, [componentes.cuerpo?.texto])

  // ─── Acciones ───

  const guardar = useCallback(async () => {
    if (tieneErrores) return
    setGuardando(true)
    try {
      const res = await fetch('/api/inbox/whatsapp/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar',
          id: plantilla?.id,
          canal_id: canalId,
          nombre, nombre_api: nombreApi,
          categoria, idioma, componentes, modulos,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      mostrar('exito', plantilla ? 'Plantilla actualizada' : 'Plantilla creada')
      onGuardado()
      onCerrar()
    } catch (err) {
      mostrar('error', (err as Error).message)
    } finally {
      setGuardando(false)
    }
  }, [nombre, nombreApi, categoria, idioma, componentes, modulos, plantilla, canalId, tieneErrores])

  const enviarAMeta = useCallback(async () => {
    if (tieneErrores) return
    setEnviandoAMeta(true)
    try {
      // Guardar primero
      const resGuardar = await fetch('/api/inbox/whatsapp/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar',
          id: plantilla?.id,
          canal_id: canalId,
          nombre, nombre_api: nombreApi,
          categoria, idioma, componentes, modulos,
        }),
      })
      const dataGuardar = await resGuardar.json()
      if (!resGuardar.ok) throw new Error(dataGuardar.error)

      const idPlantilla = plantilla?.id || dataGuardar.plantilla?.id
      if (!idPlantilla) throw new Error('No se pudo obtener ID de la plantilla')

      // Enviar a Meta
      const res = await fetch('/api/inbox/whatsapp/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'enviar_a_meta',
          id: idPlantilla,
          canal_id: canalId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      mostrar('exito', 'Plantilla enviada a Meta para revisión')
      onGuardado()
      onCerrar()
    } catch (err) {
      mostrar('error', `Error al enviar: ${(err as Error).message}`)
    } finally {
      setEnviandoAMeta(false)
    }
  }, [nombre, nombreApi, categoria, idioma, componentes, modulos, plantilla, canalId, tieneErrores])

  // ─── Helpers ───

  const actualizarEncabezado = (cambios: Partial<NonNullable<ComponentesPlantillaWA['encabezado']>>) => {
    setComponentes(prev => ({
      ...prev,
      encabezado: { ...(prev.encabezado || { tipo: 'NONE' as const }), ...cambios },
    }))
  }

  const actualizarCuerpo = (cambios: Partial<ComponentesPlantillaWA['cuerpo']>) => {
    setComponentes(prev => ({
      ...prev,
      cuerpo: { ...prev.cuerpo, ...cambios },
    }))
  }

  const actualizarPie = (texto: string) => {
    setComponentes(prev => ({
      ...prev,
      pie_pagina: texto ? { texto } : undefined,
    }))
  }

  const agregarBoton = () => {
    if ((componentes.botones?.length || 0) >= 3) return
    setComponentes(prev => ({
      ...prev,
      botones: [...(prev.botones || []), { tipo: 'QUICK_REPLY' as const, texto: '' }],
    }))
  }

  const actualizarBoton = (idx: number, cambios: Partial<BotonPlantillaWA>) => {
    setComponentes(prev => ({
      ...prev,
      botones: prev.botones?.map((b, i) => i === idx ? { ...b, ...cambios } : b),
    }))
  }

  const eliminarBoton = (idx: number) => {
    setComponentes(prev => ({
      ...prev,
      botones: prev.botones?.filter((_, i) => i !== idx),
    }))
  }

  const insertarVariable = () => {
    const siguiente = variablesDetectadas.length > 0 ? Math.max(...variablesDetectadas) + 1 : 1
    actualizarCuerpo({ texto: (componentes.cuerpo?.texto || '') + `{{${siguiente}}}` })
  }

  // ─── Preview con datos reales ───

  const seleccionarContactoPreview = useCallback(async (id: string) => {
    setCargandoContacto(true)
    try {
      const res = await fetch(`/api/contactos/${id}`)
      const data = await res.json()
      if (data?.id) { setContactoPreview(data); setDocumentoPreview(null) }
    } catch { /* silenciar */ }
    finally { setCargandoContacto(false) }
  }, [])

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
        })
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
    } catch { setDocumentoPreview(doc) }
  }, [])

  // Contexto de datos reales o de ejemplo para la preview
  const datosPreview = useMemo(() => ({
    contacto_nombre: contactoPreview
      ? `${contactoPreview.nombre || ''} ${contactoPreview.apellido || ''}`.trim()
      : String(DATOS_EJEMPLO.contacto.nombre_completo),
    contacto_telefono: contactoPreview
      ? String(contactoPreview.telefono || '')
      : String(DATOS_EJEMPLO.contacto.telefono),
    contacto_correo: contactoPreview
      ? String(contactoPreview.correo || '')
      : String(DATOS_EJEMPLO.contacto.correo),
    documento_numero: documentoPreview
      ? documentoPreview.numero
      : String(DATOS_EJEMPLO.presupuesto.numero),
    documento_total: documentoPreview
      ? formatoMoneda(documentoPreview.total_final, documentoPreview.moneda, locale)
      : String(DATOS_EJEMPLO.presupuesto.total_con_iva),
    documento_fecha: documentoPreview
      ? formatoFecha(documentoPreview.fecha_emision, locale)
      : String(DATOS_EJEMPLO.presupuesto.fecha_emision),
    empresa_nombre: String(DATOS_EJEMPLO.empresa.nombre),
  }), [contactoPreview, documentoPreview])

  const insertarFormato = (prefijo: string, sufijo: string) => {
    actualizarCuerpo({ texto: (componentes.cuerpo?.texto || '') + `${prefijo}texto${sufijo}` })
  }

  // ─── Estado info ───
  const estadoInfo = plantilla ? ESTADOS_META[plantilla.estado_meta] : null
  const IconoEstado = estadoInfo?.icono

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={plantilla ? 'Editar plantilla WhatsApp' : 'Nueva plantilla WhatsApp'}
      tamano="5xl"
      forzarModal
      sinPadding
    >
      <div className="flex flex-col" style={{ height: 'min(80vh, 720px)' }}>
        {/* Barra de estado */}
        {plantilla && estadoInfo && (
          <div className="flex items-center gap-3 px-6 py-2.5 border-b border-white/[0.07] bg-white/[0.02]">
            {IconoEstado && <IconoEstado size={14} />}
            <Insignia color={estadoInfo.color as 'exito' | 'peligro' | 'advertencia' | 'neutro'} tamano="sm">
              {estadoInfo.etiqueta}
            </Insignia>
            {plantilla.id_template_meta && (
              <span className="text-xxs font-mono text-texto-terciario">
                ID: {plantilla.id_template_meta}
              </span>
            )}
            {plantilla.error_meta && (
              <span className="text-xs text-insignia-peligro">
                {plantilla.error_meta}
              </span>
            )}
          </div>
        )}

        {/* Pestañas */}
        <div className="flex border-b border-white/[0.07] px-6">
          <button
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer bg-transparent ${
              pestana === 'editar' ? 'border-texto-marca text-texto-marca' : 'border-transparent text-texto-terciario'
            }`}
            onClick={() => setPestana('editar')}
          >
            Editar
          </button>
          <button
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer bg-transparent flex items-center gap-1.5 ${
              pestana === 'preview' ? 'border-texto-marca text-texto-marca' : 'border-transparent text-texto-terciario'
            }`}
            onClick={() => setPestana('preview')}
          >
            <Eye size={12} />
            Vista previa
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto">
          {pestana === 'editar' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_300px] h-full">
              {/* Formulario */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Nombre y API name */}
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    etiqueta="Nombre de la plantilla"
                    value={nombre}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNombre(e.target.value)}
                    placeholder="Ej: Confirmación de pedido"
                    error={errores.nombre}
                    disabled={!esEditable}
                  />
                  <Input
                    etiqueta="Identificador API"
                    value={nombreApi}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => { setNombreApi(e.target.value); setNombreApiManual(true) }}
                    placeholder="confirmacion_pedido"
                    ayuda="Solo minúsculas, números y _"
                    error={errores.nombre_api}
                    disabled={!esEditable}
                  />
                </div>

                {/* Categoría e Idioma */}
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    etiqueta="Categoría"
                    valor={categoria}
                    opciones={CATEGORIAS.map(c => ({ valor: c.valor, etiqueta: c.etiqueta }))}
                    onChange={(v) => setCategoria(v as CategoriaPlantillaWA)}
                  />
                  <Select
                    etiqueta="Idioma"
                    valor={idioma}
                    opciones={IDIOMAS.map(i => ({ valor: i.valor, etiqueta: i.etiqueta }))}
                    onChange={(v) => setIdioma(v as IdiomaPlantillaWA)}
                  />
                </div>

                {/* Disponible en módulos */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
                    Disponible en
                  </label>
                  <p className="text-[11px] text-texto-terciario">
                    Sin selección = aparece en todos
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {MODULOS_DISPONIBLES.map(m => {
                      const activo = modulos.includes(m.valor)
                      return (
                        <button
                          key={m.valor}
                          type="button"
                          onClick={() => setModulos(prev => activo ? prev.filter(v => v !== m.valor) : [...prev, m.valor])}
                          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer border ${
                            activo
                              ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                              : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario hover:border-white/[0.12] hover:text-texto-secundario'
                          }`}
                        >
                          {m.etiqueta}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Encabezado */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
                    Encabezado (opcional)
                  </label>
                  <Select
                    valor={componentes.encabezado?.tipo || 'NONE'}
                    opciones={TIPOS_ENCABEZADO.map(t => ({ valor: t.valor, etiqueta: t.etiqueta }))}
                    onChange={(v) => actualizarEncabezado({ tipo: v as TipoEncabezadoWA })}
                  />
                  {componentes.encabezado?.tipo === 'TEXT' && (
                    <div className="space-y-2">
                      <Input
                        value={componentes.encabezado.texto || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarEncabezado({ texto: e.target.value })}
                        placeholder="Texto del encabezado (máx 60 caracteres)"
                        error={errores.encabezado}
                        disabled={!esEditable}
                      />
                      {componentes.encabezado.texto?.includes('{{1}}') && (
                        <Input
                          etiqueta="Ejemplo para {{1}}"
                          value={componentes.encabezado.ejemplo || ''}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarEncabezado({ ejemplo: e.target.value })}
                          placeholder="Ej: Juan García"
                          disabled={!esEditable}
                        />
                      )}
                    </div>
                  )}
                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(componentes.encabezado?.tipo || '') && (
                    <p className="text-[11px] text-texto-terciario">
                      El archivo se adjuntará al momento de enviar, no al crear la plantilla.
                    </p>
                  )}
                </div>

                {/* Cuerpo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                      Cuerpo del mensaje *
                    </label>
                    <span className={`text-[10px] ${(componentes.cuerpo?.texto?.length || 0) > 1024 ? 'text-insignia-peligro' : 'text-texto-terciario'}`}>
                      {componentes.cuerpo?.texto?.length || 0}/1024
                    </span>
                  </div>
                  {esEditable && (
                    <div className="flex items-center gap-1 pb-1">
                      <button className="p-1.5 rounded hover:bg-[var(--superficie-hover)] transition-colors" title="Negrita" onClick={() => insertarFormato('*', '*')}>
                        <Bold size={13} style={{ color: 'var(--texto-terciario)' }} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-[var(--superficie-hover)] transition-colors" title="Cursiva" onClick={() => insertarFormato('_', '_')}>
                        <Italic size={13} style={{ color: 'var(--texto-terciario)' }} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-[var(--superficie-hover)] transition-colors" title="Tachado" onClick={() => insertarFormato('~', '~')}>
                        <Strikethrough size={13} style={{ color: 'var(--texto-terciario)' }} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-[var(--superficie-hover)] transition-colors" title="Monoespaciado" onClick={() => insertarFormato('```', '```')}>
                        <Code size={13} style={{ color: 'var(--texto-terciario)' }} />
                      </button>
                      <div className="w-px h-4 mx-1" style={{ background: 'var(--borde-sutil)' }} />
                      <button
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-[var(--superficie-hover)] transition-colors"
                        style={{ color: 'var(--texto-marca)' }}
                        onClick={insertarVariable}
                      >
                        <Variable size={13} />
                        Variable
                      </button>
                    </div>
                  )}
                  <TextArea
                    value={componentes.cuerpo?.texto || ''}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => actualizarCuerpo({ texto: e.target.value })}
                    placeholder="Hola {{1}}, tu pedido #{{2}} ha sido confirmado."
                    rows={5}
                    error={errores.cuerpo}
                    disabled={!esEditable}
                  />
                </div>

                {/* Variables detectadas — mapeo + ejemplos */}
                {variablesDetectadas.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
                      Variables — Asignar campo de Flux + ejemplo para Meta
                    </label>
                    <div className="space-y-2">
                      {variablesDetectadas.map((num, idx) => (
                        <div key={num} className="p-3 rounded-lg space-y-2" style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}>
                          <div className="flex items-center gap-2">
                            <Insignia color="primario" tamano="sm">{`{{${num}}}`}</Insignia>
                            <Select
                              placeholder="Campo de Flux..."
                              valor={componentes.cuerpo?.mapeo_variables?.[idx] || ''}
                              opciones={OPCIONES_MAPEO_VARIABLES}
                              onChange={(v) => {
                                const mapeo = [...(componentes.cuerpo?.mapeo_variables || [])]
                                mapeo[idx] = v
                                // Auto-llenar ejemplo si está vacío
                                const ejemplos = [...(componentes.cuerpo?.ejemplos || [])]
                                if (!ejemplos[idx]) {
                                  ejemplos[idx] = EJEMPLOS_POR_CAMPO[v] || ''
                                }
                                actualizarCuerpo({ mapeo_variables: mapeo, ejemplos })
                              }}
                            />
                          </div>
                          <Input
                            value={componentes.cuerpo?.ejemplos?.[idx] || ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              const ejemplos = [...(componentes.cuerpo?.ejemplos || [])]
                              ejemplos[idx] = e.target.value
                              actualizarCuerpo({ ejemplos })
                            }}
                            placeholder={`Ejemplo para {{${num}}} (requerido por Meta)`}
                            disabled={!esEditable}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                      El campo de Flux se usará para previsualizar con datos reales y auto-completar al enviar. El ejemplo es requerido por Meta para aprobar la plantilla.
                    </p>
                  </div>
                )}

                {/* Pie de página */}
                <div className="space-y-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
                    Pie de página (opcional)
                  </label>
                  <Input
                    value={componentes.pie_pagina?.texto || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarPie(e.target.value)}
                    placeholder="Máximo 60 caracteres, sin emojis"
                    error={errores.pie_pagina}
                    disabled={!esEditable}
                  />
                </div>

                {/* Botones */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
                      Botones (opcional, máx 3)
                    </label>
                    {esEditable && (componentes.botones?.length || 0) < 3 && (
                      <Boton variante="fantasma" tamano="xs" icono={<Plus size={12} />} onClick={agregarBoton}>
                        Agregar
                      </Boton>
                    )}
                  </div>
                  {componentes.botones?.map((boton, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg space-y-2"
                      style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
                    >
                      <div className="flex items-center gap-2">
                        <Select
                          valor={boton.tipo}
                          opciones={TIPOS_BOTON.map(t => ({ valor: t.valor, etiqueta: t.etiqueta }))}
                          onChange={(v) => actualizarBoton(idx, { tipo: v as TipoBotonWA })}
                        />
                        {esEditable && (
                          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar" icono={<Trash2 size={12} />} onClick={() => eliminarBoton(idx)} />
                        )}
                      </div>
                      <Input
                        value={boton.texto}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarBoton(idx, { texto: e.target.value })}
                        placeholder="Texto del botón (máx 25)"
                        error={errores[`boton_${idx}`]}
                        disabled={!esEditable}
                      />
                      {boton.tipo === 'URL' && (
                        <Input
                          value={boton.url || ''}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarBoton(idx, { url: e.target.value })}
                          placeholder="https://ejemplo.com/pedido/{{1}}"
                          error={errores[`boton_url_${idx}`]}
                          disabled={!esEditable}
                        />
                      )}
                      {boton.tipo === 'PHONE_NUMBER' && (
                        <Input
                          value={boton.telefono || ''}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarBoton(idx, { telefono: e.target.value })}
                          placeholder="+5491155550000"
                          error={errores[`boton_tel_${idx}`]}
                          disabled={!esEditable}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Divisor vertical */}
              <div className="hidden lg:block bg-white/[0.07]" />

              {/* Preview lateral (solo desktop) */}
              <div className="hidden lg:flex flex-col items-start p-5 gap-4 overflow-y-auto">
                <SelectoresPreviewDatos
                  contactoPreview={contactoPreview}
                  documentoPreview={documentoPreview}
                  cargandoContacto={cargandoContacto}
                  onSeleccionarContacto={seleccionarContactoPreview}
                  onSeleccionarDocumento={seleccionarDocumentoPreview}
                  onLimpiarContacto={() => { setContactoPreview(null); setDocumentoPreview(null) }}
                  onLimpiarDocumento={() => setDocumentoPreview(null)}
                  locale={locale}
                />
                <PreviewWhatsApp componentes={componentes} datosPreview={datosPreview} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center p-8 gap-4" style={{ minHeight: 400 }}>
              <div className="w-full max-w-md">
                <SelectoresPreviewDatos
                  contactoPreview={contactoPreview}
                  documentoPreview={documentoPreview}
                  cargandoContacto={cargandoContacto}
                  onSeleccionarContacto={seleccionarContactoPreview}
                  onSeleccionarDocumento={seleccionarDocumentoPreview}
                  onLimpiarContacto={() => { setContactoPreview(null); setDocumentoPreview(null) }}
                  onLimpiarDocumento={() => setDocumentoPreview(null)}
                  horizontal
                  locale={locale}
                />
              </div>
              <PreviewWhatsApp componentes={componentes} datosPreview={datosPreview} />
            </div>
          )}
        </div>

        {/* Acciones */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-3 border-t"
          style={{ borderColor: 'var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
        >
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>
            Cancelar
          </Boton>
          <div className="flex items-center gap-2">
            {esEditable ? (
              <>
                <Boton variante="secundario" tamano="sm" onClick={guardar}
                  cargando={guardando} disabled={tieneErrores || guardando}>
                  Guardar borrador
                </Boton>
                <Boton tamano="sm" icono={<Send size={14} />} onClick={enviarAMeta}
                  cargando={enviandoAMeta} disabled={tieneErrores || enviandoAMeta}>
                  Enviar a Meta
                </Boton>
              </>
            ) : (
              <Boton tamano="sm" onClick={guardar} cargando={guardando} disabled={guardando}>
                Guardar cambios
              </Boton>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Preview estilo WhatsApp ───

/** Convierte formato WhatsApp a HTML: *negrita*, _cursiva_, ~tachado~, ```mono``` */
function formatearTextoWA(texto: string): string {
  // Escapar HTML
  let html = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Monoespaciado (```texto```) — primero para no interferir
  html = html.replace(/```([\s\S]*?)```/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
  // Negrita (*texto*)
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>')
  // Cursiva (_texto_)
  html = html.replace(/_(.*?)_/g, '<em>$1</em>')
  // Tachado (~texto~)
  html = html.replace(/~(.*?)~/g, '<del>$1</del>')

  return html
}

interface DatosPreview {
  [key: string]: string
  contacto_nombre: string
  contacto_telefono: string
  contacto_correo: string
  documento_numero: string
  documento_total: string
  documento_fecha: string
  empresa_nombre: string
}

// ─── Selectores de contacto/documento para preview ───

function SelectoresPreviewDatos({
  contactoPreview,
  documentoPreview,
  cargandoContacto,
  onSeleccionarContacto,
  onSeleccionarDocumento,
  onLimpiarContacto,
  onLimpiarDocumento,
  horizontal,
  locale,
}: {
  contactoPreview: Record<string, unknown> | null
  documentoPreview: DocumentoResultado | null
  cargandoContacto: boolean
  onSeleccionarContacto: (id: string) => void
  onSeleccionarDocumento: (doc: DocumentoResultado) => void
  onLimpiarContacto: () => void
  onLimpiarDocumento: () => void
  horizontal?: boolean
  locale: string
}) {
  const nombreContacto = contactoPreview
    ? `${(contactoPreview.nombre as string) || ''} ${(contactoPreview.apellido as string) || ''}`.trim()
    : null

  return (
    <div className={`w-full space-y-2`}>
      <label className="text-xs font-medium" style={{ color: 'var(--texto-terciario)' }}>
        Previsualizar con datos reales
      </label>
      <div className={horizontal ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
        {/* Contacto */}
        {nombreContacto ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
          >
            <User size={13} style={{ color: 'var(--texto-terciario)' }} />
            <span className="text-sm flex-1 truncate" style={{ color: 'var(--texto-primario)' }}>
              {nombreContacto}
            </span>
            <button
              className="p-0.5 rounded hover:bg-[var(--superficie-hover)] transition-colors"
              onClick={onLimpiarContacto}
            >
              <X size={13} style={{ color: 'var(--texto-terciario)' }} />
            </button>
          </div>
        ) : (
          <BuscadorContactoPreview
            onSeleccionar={onSeleccionarContacto}
            cargando={cargandoContacto}
          />
        )}

        {/* Documento */}
        {documentoPreview ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
          >
            <FileTextIcon size={13} style={{ color: 'var(--texto-terciario)' }} />
            <span className="text-sm flex-1 truncate" style={{ color: 'var(--texto-primario)' }}>
              {documentoPreview.numero}
              {documentoPreview.total_final && (
                <span className="ml-1.5 text-xs" style={{ color: 'var(--texto-terciario)' }}>
                  · {documentoPreview.moneda === 'USD' ? 'US$' : '$'} {Number(documentoPreview.total_final).toLocaleString(locale)}
                </span>
              )}
            </span>
            <button
              className="p-0.5 rounded hover:bg-[var(--superficie-hover)] transition-colors"
              onClick={onLimpiarDocumento}
            >
              <X size={13} style={{ color: 'var(--texto-terciario)' }} />
            </button>
          </div>
        ) : (
          <BuscadorDocumentoPreview
            contactoId={contactoPreview?.id as string | undefined}
            onSeleccionar={onSeleccionarDocumento}
          />
        )}
      </div>
    </div>
  )
}

// ─── Preview estilo WhatsApp ───

function PreviewWhatsApp({ componentes, datosPreview }: { componentes: ComponentesPlantillaWA; datosPreview?: DatosPreview }) {
  const { locale, formatoHora: fmtHora } = useFormato()
  const cuerpoHtml = useMemo(() => {
    let texto = componentes.cuerpo?.texto || ''
    const ejemplos = componentes.cuerpo?.ejemplos || []
    const mapeo = componentes.cuerpo?.mapeo_variables || []

    texto = texto.replace(/\{\{(\d+)\}\}/g, (_, n) => {
      const idx = parseInt(n) - 1

      // 1. Si hay mapeo explícito + datosPreview, usar dato real
      if (datosPreview && mapeo[idx]) {
        const val = (datosPreview as Record<string, string>)[mapeo[idx]]
        if (val) return val
      }

      // 2. Si hay datosPreview sin mapeo, inferir por contenido del texto
      //    (para plantillas importadas de Meta que no tienen mapeo configurado)
      if (datosPreview) {
        const textoLower = texto.toLowerCase()
        // Heurística: si el texto menciona "hola {{1}}" o "estimad" antes de {{N}}, es nombre
        // Si menciona "referencia", "número", "#{{N}}", es documento
        const antesDeVar = texto.substring(0, texto.indexOf(`{{${n}}}`)).toLowerCase()
        if (idx === 0 && (antesDeVar.includes('hola') || antesDeVar.includes('estimad') || antesDeVar.includes('querido'))) {
          return datosPreview.contacto_nombre
        }
        if (antesDeVar.includes('referencia') || antesDeVar.includes('número') || antesDeVar.includes('#') || antesDeVar.includes('pedido')) {
          return datosPreview.documento_numero
        }
        if (textoLower.includes('total') && antesDeVar.includes(`{{${n}}`)) {
          return datosPreview.documento_total
        }
      }

      // 3. Fallback: ejemplo manual
      return ejemplos[idx] || `{{${n}}}`
    })
    return formatearTextoWA(texto)
  }, [componentes.cuerpo, datosPreview])

  const encabezadoHtml = useMemo(() => {
    if (componentes.encabezado?.tipo !== 'TEXT' || !componentes.encabezado.texto) return ''
    let texto = componentes.encabezado.texto
    // Si hay datosPreview, reemplazar {{1}} con nombre del contacto
    if (datosPreview) {
      texto = texto.replace(/\{\{1\}\}/g, datosPreview.contacto_nombre)
    } else {
      texto = texto.replace(/\{\{1\}\}/g, componentes.encabezado.ejemplo || '{{1}}')
    }
    return formatearTextoWA(texto)
  }, [componentes.encabezado, datosPreview])

  return (
    <div className="w-[280px]">
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: 'var(--whatsapp-header)' }}>
        <IconoWhatsApp size={16} style={{ color: '#fff' }} />
        <span className="text-xs font-medium text-white">Vista previa</span>
      </div>
      <div
        className="p-3 min-h-[200px]"
        style={{ background: 'var(--whatsapp-chat-bg)', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M20 0L20 40M0 20L40 20\' stroke=\'%23d5cec5\' stroke-width=\'0.5\'/%3E%3C/svg%3E")' }}
      >
        <div className="rounded-lg p-2.5 max-w-[250px] shadow-sm" style={{ background: 'var(--whatsapp-burbuja)' }}>
          {componentes.encabezado?.tipo === 'TEXT' && componentes.encabezado.texto && (
            <p
              className="text-sm font-semibold mb-1"
              style={{ color: 'var(--whatsapp-texto)' }}
              dangerouslySetInnerHTML={{ __html: encabezadoHtml }}
            />
          )}
          {componentes.encabezado?.tipo && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(componentes.encabezado.tipo) && (
            <div className="rounded mb-2 flex items-center justify-center text-xs" style={{ background: 'var(--whatsapp-pie)', color: 'var(--whatsapp-placeholder)', height: 80 }}>
              {componentes.encabezado.tipo === 'IMAGE' ? '🖼️ Imagen' : componentes.encabezado.tipo === 'VIDEO' ? '🎬 Video' : '📄 Documento'}
            </div>
          )}
          {cuerpoHtml ? (
            <p
              className="text-sm whitespace-pre-wrap leading-snug"
              style={{ color: 'var(--whatsapp-texto)' }}
              dangerouslySetInnerHTML={{ __html: cuerpoHtml }}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-snug" style={{ color: 'var(--whatsapp-placeholder)' }}>
              Cuerpo del mensaje...
            </p>
          )}
          {componentes.pie_pagina?.texto && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--whatsapp-meta)' }}>
              {componentes.pie_pagina.texto}
            </p>
          )}
          <div className="flex justify-end mt-1">
            <span className="text-xxs" style={{ color: 'var(--whatsapp-meta)' }}>
              {new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: fmtHora === '12h' })}
            </span>
          </div>
        </div>
        {componentes.botones && componentes.botones.length > 0 && (
          <div className="mt-1 space-y-1 max-w-[250px]">
            {componentes.botones.map((b, idx) => (
              <div key={idx} className="rounded-lg py-2 text-center text-sm font-medium shadow-sm" style={{ background: 'var(--whatsapp-burbuja)', color: 'var(--whatsapp-enlace)' }}>
                {b.tipo === 'URL' && '🔗 '}
                {b.tipo === 'PHONE_NUMBER' && '📞 '}
                {b.texto || 'Botón'}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-3 rounded-b-xl" style={{ background: 'var(--whatsapp-pie)' }} />
    </div>
  )
}
