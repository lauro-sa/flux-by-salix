'use client'

/**
 * PaginaEditorPlantillaMeta — Editor pantalla completa de plantillas de WhatsApp (Meta Business).
 * Reemplaza al modal ModalEditorPlantillaWA manteniendo toda la funcionalidad.
 *
 * Layout:
 * - Panel izq: vista previa estilo WhatsApp + selectores de contacto/documento para preview
 * - Main: formulario completo (identidad, encabezado, cuerpo, variables, pie, botones)
 * - Acciones: Guardar borrador / Enviar a Meta / Restaurar original (si aplica)
 */

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, Send, Plus, Trash2, AlertTriangle, CheckCircle2, Clock, XCircle,
  Ban, Pause, Bold, Italic, Strikethrough, Code, Variable, X, User,
  FileText as FileTextIcon,
} from 'lucide-react'
import { PlantillaEditor } from '@/componentes/entidad/PlantillaEditor'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import HtmlSeguro from '@/componentes/ui/HtmlSeguro'
import { Select } from '@/componentes/ui/Select'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { BuscadorContactoPreview } from '@/componentes/entidad/_editor_plantilla/BuscadorContactoPreview'
import { BuscadorDocumentoPreview } from '@/componentes/entidad/_editor_plantilla/BuscadorDocumentoPreview'
import { DATOS_EJEMPLO } from '@/componentes/entidad/_editor_plantilla/constantes'
import { formatoMoneda, formatoFecha } from '@/componentes/entidad/_editor_plantilla/utilidades'
import type { DocumentoResultado } from '@/componentes/entidad/_editor_plantilla/tipos'
import type { CanalMensajeria } from '@/tipos/inbox'
import type {
  PlantillaWhatsApp, ComponentesPlantillaWA, CategoriaPlantillaWA,
  IdiomaPlantillaWA, TipoEncabezadoWA, TipoBotonWA, BotonPlantillaWA,
  EstadoMeta,
} from '@/tipos/whatsapp'

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

const ESTADOS_META: Record<EstadoMeta, { color: 'exito' | 'peligro' | 'advertencia' | 'neutro'; icono: typeof CheckCircle2; etiqueta: string }> = {
  BORRADOR: { color: 'neutro', icono: Save, etiqueta: 'Borrador' },
  PENDING: { color: 'advertencia', icono: Clock, etiqueta: 'En revisión' },
  APPROVED: { color: 'exito', icono: CheckCircle2, etiqueta: 'Aprobada' },
  REJECTED: { color: 'peligro', icono: XCircle, etiqueta: 'Rechazada' },
  DISABLED: { color: 'peligro', icono: Ban, etiqueta: 'Deshabilitada' },
  PAUSED: { color: 'advertencia', icono: Pause, etiqueta: 'Pausada' },
  ERROR: { color: 'peligro', icono: AlertTriangle, etiqueta: 'Error' },
}

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

interface Props {
  plantilla: PlantillaWhatsApp | null
  canales: CanalMensajeria[]
  canalIdInicial?: string
  rutaVolver: string
  textoVolver?: string
}

export function PaginaEditorPlantillaMeta({
  plantilla,
  canales,
  canalIdInicial,
  rutaVolver,
  textoVolver = 'Plantillas Meta',
}: Props) {
  const router = useRouter()
  const { locale, formatoHora: fmtHora } = useFormato()
  const { mostrar } = useToast()
  const esEdicion = !!plantilla

  const [guardando, setGuardando] = useState(false)
  const [enviandoAMeta, setEnviandoAMeta] = useState(false)

  // ─── Estado del formulario ───
  const [canalId, setCanalId] = useState<string>(plantilla?.canal_id || canalIdInicial || canales[0]?.id || '')
  const [nombre, setNombre] = useState(plantilla?.nombre || '')
  const [nombreApi, setNombreApi] = useState(plantilla?.nombre_api || '')
  const [nombreApiManual, setNombreApiManual] = useState(!!plantilla)
  const [categoria, setCategoria] = useState<CategoriaPlantillaWA>(plantilla?.categoria || 'UTILITY')
  const [idioma, setIdioma] = useState<IdiomaPlantillaWA>(plantilla?.idioma || 'es')
  const [componentes, setComponentes] = useState<ComponentesPlantillaWA>(plantilla?.componentes || { cuerpo: { texto: '' } })
  const [modulos, setModulos] = useState<string[]>(plantilla?.modulos || [])

  const [contactoPreview, setContactoPreview] = useState<Record<string, unknown> | null>(null)
  const [documentoPreview, setDocumentoPreview] = useState<DocumentoResultado | null>(null)
  const [cargandoContacto, setCargandoContacto] = useState(false)

  const esEditable = !plantilla || ['BORRADOR', 'ERROR'].includes(plantilla.estado_meta)

  // Auto-generar nombre_api desde el nombre si el usuario no lo tocó manualmente
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
    if (!canalId) e.canal = 'Elegí una cuenta de WhatsApp'

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
  }, [nombre, nombreApi, canalId, componentes])

  const tieneErrores = Object.keys(errores).length > 0

  // ─── Variables detectadas en el cuerpo ({{1}}, {{2}}, etc.) ───
  const variablesDetectadas = useMemo(() => {
    const texto = componentes.cuerpo?.texto || ''
    const matches = texto.match(/\{\{\d+\}\}/g)
    if (!matches) return []
    const nums = [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ''))))]
    return nums.sort((a, b) => a - b)
  }, [componentes.cuerpo?.texto])

  // ─── Helpers de actualización ───
  const actualizarEncabezado = (cambios: Partial<NonNullable<ComponentesPlantillaWA['encabezado']>>) => {
    setComponentes(prev => ({ ...prev, encabezado: { ...(prev.encabezado || { tipo: 'NONE' as const }), ...cambios } }))
  }
  const actualizarCuerpo = (cambios: Partial<ComponentesPlantillaWA['cuerpo']>) => {
    setComponentes(prev => ({ ...prev, cuerpo: { ...prev.cuerpo, ...cambios } }))
  }
  const actualizarPie = (texto: string) => {
    setComponentes(prev => ({ ...prev, pie_pagina: texto ? { texto } : undefined }))
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
    setComponentes(prev => ({ ...prev, botones: prev.botones?.filter((_, i) => i !== idx) }))
  }
  const insertarVariable = () => {
    const siguiente = variablesDetectadas.length > 0 ? Math.max(...variablesDetectadas) + 1 : 1
    actualizarCuerpo({ texto: (componentes.cuerpo?.texto || '') + `{{${siguiente}}}` })
  }
  const insertarFormato = (prefijo: string, sufijo: string) => {
    actualizarCuerpo({ texto: (componentes.cuerpo?.texto || '') + `${prefijo}texto${sufijo}` })
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
        setDocumentoPreview({ ...doc, ...data })
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

  const datosPreview = useMemo(() => ({
    contacto_nombre: contactoPreview
      ? `${contactoPreview.nombre || ''} ${contactoPreview.apellido || ''}`.trim()
      : String(DATOS_EJEMPLO.contacto.nombre_completo),
    contacto_telefono: contactoPreview ? String(contactoPreview.telefono || '') : String(DATOS_EJEMPLO.contacto.telefono),
    contacto_correo: contactoPreview ? String(contactoPreview.correo || '') : String(DATOS_EJEMPLO.contacto.correo),
    documento_numero: documentoPreview ? documentoPreview.numero : String(DATOS_EJEMPLO.presupuesto.numero),
    documento_total: documentoPreview
      ? formatoMoneda(documentoPreview.total_final, documentoPreview.moneda)
      : String(DATOS_EJEMPLO.presupuesto.total_final),
    documento_fecha: documentoPreview ? formatoFecha(documentoPreview.fecha_emision) : String(DATOS_EJEMPLO.presupuesto.fecha_emision),
    empresa_nombre: String(DATOS_EJEMPLO.empresa.nombre),
  }), [contactoPreview, documentoPreview])

  // ─── Acciones ───
  const guardar = useCallback(async () => {
    if (tieneErrores) return
    setGuardando(true)
    try {
      const res = await fetch('/api/whatsapp/plantillas', {
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
      mostrar('exito', plantilla ? 'Plantilla actualizada' : 'Plantilla guardada como borrador')
      router.push(rutaVolver)
    } catch (err) {
      mostrar('error', (err as Error).message)
    } finally {
      setGuardando(false)
    }
  }, [nombre, nombreApi, categoria, idioma, componentes, modulos, plantilla, canalId, tieneErrores, mostrar, router, rutaVolver])

  const enviarAMeta = useCallback(async () => {
    if (tieneErrores) return
    setEnviandoAMeta(true)
    try {
      const resGuardar = await fetch('/api/whatsapp/plantillas', {
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

      const res = await fetch('/api/whatsapp/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'enviar_a_meta', id: idPlantilla, canal_id: canalId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      mostrar('exito', 'Plantilla enviada a Meta para revisión')
      router.push(rutaVolver)
    } catch (err) {
      mostrar('error', `Error al enviar: ${(err as Error).message}`)
    } finally {
      setEnviandoAMeta(false)
    }
  }, [nombre, nombreApi, categoria, idioma, componentes, modulos, plantilla, canalId, tieneErrores, mostrar, router, rutaVolver])

  // ─── Acciones del cabecero ───
  const estadoInfo = plantilla ? ESTADOS_META[plantilla.estado_meta] : null

  const acciones = [
    ...(esEditable ? [
      {
        id: 'guardar',
        etiqueta: 'Guardar borrador',
        icono: <Save size={14} />,
        onClick: guardar,
        variante: 'secundario' as const,
        cargando: guardando,
        deshabilitado: tieneErrores,
      },
      {
        id: 'enviar',
        etiqueta: 'Enviar a Meta',
        icono: <Send size={14} />,
        onClick: enviarAMeta,
        variante: 'primario' as const,
        cargando: enviandoAMeta,
        deshabilitado: tieneErrores,
      },
    ] : [
      {
        id: 'guardar',
        etiqueta: 'Guardar cambios',
        icono: <Save size={14} />,
        onClick: guardar,
        variante: 'primario' as const,
        cargando: guardando,
      },
    ]),
  ]

  // ─── Insignia de estado Meta ───
  const insignias = plantilla && estadoInfo ? (
    <div className="flex items-center gap-1.5">
      <Insignia color={estadoInfo.color} tamano="sm">
        {estadoInfo.etiqueta}
      </Insignia>
      {plantilla.id_template_meta && (
        <span className="text-xxs font-mono text-texto-terciario">
          {plantilla.id_template_meta}
        </span>
      )}
    </div>
  ) : null

  // ─── Panel izq: selectores preview + preview WhatsApp ───
  const panelConfig = (
    <div className="space-y-4">
      {/* Selector de canal */}
      {canales.length > 1 && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
            Cuenta WhatsApp
          </label>
          <Select
            valor={canalId}
            opciones={canales.map(c => ({ valor: c.id, etiqueta: c.nombre }))}
            onChange={setCanalId}
          />
          {errores.canal && <p className="text-xxs text-insignia-peligro">{errores.canal}</p>}
        </div>
      )}

      {/* Selectores para preview */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Previsualizar con datos reales
        </label>
        {contactoPreview ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-card border border-borde-sutil bg-superficie-tarjeta">
            <User size={13} className="text-texto-terciario" />
            <span className="text-sm flex-1 truncate text-texto-primario">
              {`${(contactoPreview.nombre as string) || ''} ${(contactoPreview.apellido as string) || ''}`.trim()}
            </span>
            <button
              onClick={() => { setContactoPreview(null); setDocumentoPreview(null) }}
              className="p-0.5 rounded hover:bg-superficie-hover transition-colors cursor-pointer"
            >
              <X size={13} className="text-texto-terciario" />
            </button>
          </div>
        ) : (
          <BuscadorContactoPreview onSeleccionar={seleccionarContactoPreview} cargando={cargandoContacto} />
        )}

        {documentoPreview ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-card border border-borde-sutil bg-superficie-tarjeta">
            <FileTextIcon size={13} className="text-texto-terciario" />
            <span className="text-sm flex-1 truncate text-texto-primario">
              {documentoPreview.numero}
            </span>
            <button
              onClick={() => setDocumentoPreview(null)}
              className="p-0.5 rounded hover:bg-superficie-hover transition-colors cursor-pointer"
            >
              <X size={13} className="text-texto-terciario" />
            </button>
          </div>
        ) : (
          <BuscadorDocumentoPreview
            contactoId={contactoPreview ? String(contactoPreview.id || '') : null}
            onSeleccionar={seleccionarDocumentoPreview}
          />
        )}
      </div>

      {/* Preview estilo WhatsApp */}
      <div className="pt-2">
        <PreviewWhatsApp
          componentes={componentes}
          datosPreview={datosPreview}
          locale={locale}
          fmtHora={fmtHora}
        />
      </div>

      {/* Error de Meta si rechazada */}
      {plantilla?.error_meta && (
        <div className="p-2.5 rounded-lg bg-insignia-peligro/10 border border-insignia-peligro/30 text-xxs text-insignia-peligro">
          <strong>Meta:</strong> {plantilla.error_meta}
        </div>
      )}
    </div>
  )

  return (
    <PlantillaEditor
      titulo={esEdicion ? (nombre || plantilla?.nombre || 'Editar plantilla') : 'Nueva plantilla de WhatsApp'}
      subtitulo="Plantilla Meta Business — requiere aprobación antes de usarse"
      insignias={insignias}
      volverTexto={textoVolver}
      onVolver={() => router.push(rutaVolver)}
      acciones={acciones}
      panelConfig={panelConfig}
    >
      {/* ═══ IDENTIDAD ═══ */}
      <div className="space-y-4 pb-4 border-b border-borde-sutil">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            etiqueta="Nombre"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* Módulos */}
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
            Disponible en
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MODULOS_DISPONIBLES.map(m => {
              const activo = modulos.includes(m.valor)
              return (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => setModulos(prev => activo ? prev.filter(v => v !== m.valor) : [...prev, m.valor])}
                  className={`text-xs px-2.5 py-1 rounded-boton font-medium transition-all cursor-pointer border ${
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
          {modulos.length === 0 && (
            <p className="text-[11px] text-texto-terciario">Sin selección = disponible en todos los módulos</p>
          )}
        </div>
      </div>

      {/* ═══ ENCABEZADO ═══ */}
      <div className="pt-4 space-y-2">
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

      {/* ═══ CUERPO ═══ */}
      <div className="pt-4 space-y-2">
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
            <button className="p-1.5 rounded hover:bg-superficie-hover transition-colors cursor-pointer border-none bg-transparent" title="Negrita" onClick={() => insertarFormato('*', '*')}>
              <Bold size={13} className="text-texto-terciario" />
            </button>
            <button className="p-1.5 rounded hover:bg-superficie-hover transition-colors cursor-pointer border-none bg-transparent" title="Cursiva" onClick={() => insertarFormato('_', '_')}>
              <Italic size={13} className="text-texto-terciario" />
            </button>
            <button className="p-1.5 rounded hover:bg-superficie-hover transition-colors cursor-pointer border-none bg-transparent" title="Tachado" onClick={() => insertarFormato('~', '~')}>
              <Strikethrough size={13} className="text-texto-terciario" />
            </button>
            <button className="p-1.5 rounded hover:bg-superficie-hover transition-colors cursor-pointer border-none bg-transparent" title="Monoespaciado" onClick={() => insertarFormato('```', '```')}>
              <Code size={13} className="text-texto-terciario" />
            </button>
            <div className="w-px h-4 mx-1 bg-borde-sutil" />
            <button
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-superficie-hover transition-colors cursor-pointer border-none bg-transparent text-texto-marca"
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

      {/* ═══ VARIABLES DETECTADAS ═══ */}
      {variablesDetectadas.length > 0 && (
        <div className="pt-4 space-y-3">
          <label className="text-xs font-medium text-texto-secundario">
            Variables — Asignar campo de Flux + ejemplo para Meta
          </label>
          <div className="space-y-2">
            {variablesDetectadas.map((num, idx) => (
              <div key={num} className="p-3 rounded-card space-y-2 border border-borde-sutil bg-superficie-tarjeta">
                <div className="flex items-center gap-2">
                  <Insignia color="primario" tamano="sm">{`{{${num}}}`}</Insignia>
                  <Select
                    placeholder="Campo de Flux..."
                    valor={componentes.cuerpo?.mapeo_variables?.[idx] || ''}
                    opciones={OPCIONES_MAPEO_VARIABLES}
                    onChange={(v) => {
                      const mapeo = [...(componentes.cuerpo?.mapeo_variables || [])]
                      mapeo[idx] = v
                      const ejemplos = [...(componentes.cuerpo?.ejemplos || [])]
                      if (!ejemplos[idx]) ejemplos[idx] = EJEMPLOS_POR_CAMPO[v] || ''
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
          <p className="text-xxs text-texto-terciario">
            El campo de Flux se usa para la vista previa con datos reales y auto-completar al enviar. El ejemplo es requerido por Meta para aprobar.
          </p>
        </div>
      )}

      {/* ═══ PIE DE PÁGINA ═══ */}
      <div className="pt-4 space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
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

      {/* ═══ BOTONES ═══ */}
      <div className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
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
            className="p-3 rounded-card space-y-2 border border-borde-sutil bg-superficie-tarjeta"
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
    </PlantillaEditor>
  )
}

/* ═══ Preview estilo WhatsApp ═══ */

function formatearTextoWA(texto: string): string {
  let html = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html.replace(/```([\s\S]*?)```/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>')
  html = html.replace(/_(.*?)_/g, '<em>$1</em>')
  html = html.replace(/~(.*?)~/g, '<del>$1</del>')
  return html
}

interface DatosPreviewTipo {
  [key: string]: string
  contacto_nombre: string
  contacto_telefono: string
  contacto_correo: string
  documento_numero: string
  documento_total: string
  documento_fecha: string
  empresa_nombre: string
}

function PreviewWhatsApp({
  componentes,
  datosPreview,
  locale,
  fmtHora,
}: {
  componentes: ComponentesPlantillaWA
  datosPreview?: DatosPreviewTipo
  locale: string
  fmtHora: string
}) {
  const cuerpoHtml = useMemo(() => {
    let texto = componentes.cuerpo?.texto || ''
    const ejemplos = componentes.cuerpo?.ejemplos || []
    const mapeo = componentes.cuerpo?.mapeo_variables || []

    texto = texto.replace(/\{\{(\d+)\}\}/g, (_, n) => {
      const idx = parseInt(n) - 1
      if (datosPreview && mapeo[idx]) {
        const val = (datosPreview as Record<string, string>)[mapeo[idx]]
        if (val) return val
      }
      return ejemplos[idx] || `{{${n}}}`
    })
    return formatearTextoWA(texto)
  }, [componentes.cuerpo, datosPreview])

  const encabezadoHtml = useMemo(() => {
    if (componentes.encabezado?.tipo !== 'TEXT' || !componentes.encabezado.texto) return ''
    let texto = componentes.encabezado.texto
    if (datosPreview) texto = texto.replace(/\{\{1\}\}/g, datosPreview.contacto_nombre)
    else texto = texto.replace(/\{\{1\}\}/g, componentes.encabezado.ejemplo || '{{1}}')
    return formatearTextoWA(texto)
  }, [componentes.encabezado, datosPreview])

  return (
    <div className="w-full max-w-[280px]">
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: 'var(--whatsapp-header)' }}>
        <IconoWhatsApp size={16} style={{ color: '#fff' }} />
        <span className="text-xs font-medium text-white">Vista previa</span>
      </div>
      <div
        className="p-3 min-h-[200px]"
        style={{ background: 'var(--whatsapp-chat-bg)' }}
      >
        <div className="rounded-card p-2.5 max-w-[250px] shadow-sm" style={{ background: 'var(--whatsapp-burbuja)' }}>
          {componentes.encabezado?.tipo === 'TEXT' && componentes.encabezado.texto && (
            <HtmlSeguro html={encabezadoHtml} como="p" className="text-sm font-semibold mb-1" style={{ color: 'var(--whatsapp-texto)' }} />
          )}
          {componentes.encabezado?.tipo && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(componentes.encabezado.tipo) && (
            <div className="rounded mb-2 flex items-center justify-center text-xs" style={{ background: 'var(--whatsapp-pie)', color: 'var(--whatsapp-placeholder)', height: 80 }}>
              {componentes.encabezado.tipo === 'IMAGE' ? '🖼️ Imagen' : componentes.encabezado.tipo === 'VIDEO' ? '🎬 Video' : '📄 Documento'}
            </div>
          )}
          {cuerpoHtml ? (
            <HtmlSeguro html={cuerpoHtml} como="p" className="text-sm whitespace-pre-wrap leading-snug" style={{ color: 'var(--whatsapp-texto)' }} />
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
              <div key={idx} className="rounded-card py-2 text-center text-sm font-medium shadow-sm" style={{ background: 'var(--whatsapp-burbuja)', color: 'var(--whatsapp-enlace)' }}>
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
