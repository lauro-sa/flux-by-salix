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
  Ban, Pause, Bold, Italic, Strikethrough, Code, Variable,
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
import { useEmpresa } from '@/hooks/useEmpresa'
import { useCambiosSinGuardar } from '@/hooks/useCambiosPendientes'
import {
  BuscadorEntidadPreview,
  type EntidadSeleccionada,
} from './BuscadorEntidadPreview'
import { TimelinePlantilla } from './TimelinePlantilla'
import {
  construirDatosPlantilla,
  resolverTextoPlantilla,
  opcionesMapeoVariables,
  EJEMPLOS_POR_CAMPO,
  type EntidadPlantillaWA,
} from '@/lib/whatsapp/variables'
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

const MODULOS_DISPONIBLES: { valor: string; etiqueta: string; entidad?: EntidadPlantillaWA }[] = [
  { valor: 'inbox', etiqueta: 'Inbox (chat)' },
  { valor: 'presupuestos', etiqueta: 'Presupuestos', entidad: 'presupuesto' },
  { valor: 'contactos', etiqueta: 'Contactos', entidad: 'contacto' },
  { valor: 'ordenes', etiqueta: 'Órdenes', entidad: 'orden' },
  { valor: 'actividades', etiqueta: 'Actividades', entidad: 'actividad' },
  { valor: 'visitas', etiqueta: 'Visitas', entidad: 'visita' },
  { valor: 'recorrido', etiqueta: 'Recorrido', entidad: 'visita' },
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

interface Props {
  plantilla: PlantillaWhatsApp | null
  canales: CanalMensajeria[]
  canalIdInicial?: string
  rutaVolver: string
  textoVolver?: string
  /** Callback opcional que re-fetchea la plantilla desde el server (el padre
   *  actualiza su state). Se llama después de enviar a Meta exitosamente para
   *  que el estado, timeline y banner de desincronización se actualicen sin
   *  perder la página. */
  onRecargar?: () => Promise<void> | void
}

export function PaginaEditorPlantillaMeta({
  plantilla,
  canales,
  canalIdInicial,
  rutaVolver,
  textoVolver = 'Plantillas Meta',
  onRecargar,
}: Props) {
  const router = useRouter()
  const { locale, formatoHora: fmtHora } = useFormato()
  const { mostrar } = useToast()
  const { empresa } = useEmpresa()
  const esEdicion = !!plantilla

  const [guardando, setGuardando] = useState(false)
  const [enviandoAMeta, setEnviandoAMeta] = useState(false)
  // Trigger para forzar el refetch del timeline después de un envío/re-envío.
  const [refrescoTimeline, setRefrescoTimeline] = useState(0)

  // ─── Estado del formulario ───
  const [canalId, setCanalId] = useState<string>(plantilla?.canal_id || canalIdInicial || canales[0]?.id || '')
  const [nombre, setNombre] = useState(plantilla?.nombre || '')
  const [nombreApi, setNombreApi] = useState(plantilla?.nombre_api || '')
  const [nombreApiManual, setNombreApiManual] = useState(!!plantilla)
  const [categoria, setCategoria] = useState<CategoriaPlantillaWA>(plantilla?.categoria || 'UTILITY')
  const [idioma, setIdioma] = useState<IdiomaPlantillaWA>(plantilla?.idioma || 'es')
  const [componentes, setComponentes] = useState<ComponentesPlantillaWA>(plantilla?.componentes || { cuerpo: { texto: '' } })
  const [modulos, setModulos] = useState<string[]>(plantilla?.modulos || [])

  // Previsualización con datos reales: cada entidad se carga una sola vez y se
  // mantiene en memoria para alimentar `construirDatosPlantilla`.
  const [entidadSeleccionada, setEntidadSeleccionada] = useState<EntidadSeleccionada | null>(null)
  const [contactoPreview, setContactoPreview] = useState<Record<string, unknown> | null>(null)
  const [visitaPreview, setVisitaPreview] = useState<Record<string, unknown> | null>(null)
  const [presupuestoPreview, setPresupuestoPreview] = useState<Record<string, unknown> | null>(null)
  const [ordenPreview, setOrdenPreview] = useState<Record<string, unknown> | null>(null)
  const [actividadPreview, setActividadPreview] = useState<Record<string, unknown> | null>(null)

  // Siempre editable: incluso si la plantilla ya está aprobada en Meta,
  // el usuario puede hacer cambios locales. Los cambios quedan "desincronizados"
  // hasta que pulse "Enviar a Meta" para solicitar una nueva aprobación.
  const esEditable = true
  // Flag que indica que la plantilla ya vive en Meta (aprobada/en revisión/etc.)
  // — se usa para decidir textos y mostrar el aviso de re-aprobación.
  const existeEnMeta = !!plantilla && !['BORRADOR', 'ERROR'].includes(plantilla.estado_meta)
  // La plantilla está desincronizada: cambios locales que NO fueron enviados a Meta.
  const estaDesincronizada = plantilla?.desincronizada === true
  // Estado desconocido: plantilla pre-hash, no podemos afirmar que esté sincronizada.
  const sincronizacionDesconocida = plantilla?.desincronizada === null

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

    // Validar que cada {{N}} del cuerpo esté mapeado a una variable del catálogo.
    // Sin mapeo, al enviar la plantilla se sustituye con el "ejemplo para Meta"
    // (texto literal) y el cliente recibe datos falsos — origen del bug que
    // mandaba "Juan García" y "PRE-00042" literales.
    const cuerpoTexto = componentes.cuerpo?.texto || ''
    const matchesCuerpo = cuerpoTexto.match(/\{\{(\d+)\}\}/g) || []
    const numsCuerpo = [...new Set(matchesCuerpo.map(m => parseInt(m.replace(/[{}]/g, ''))))]
    const mapeoCuerpo = componentes.cuerpo?.mapeo_variables || []
    for (const n of numsCuerpo) {
      const idx = n - 1
      if (!mapeoCuerpo[idx] || !mapeoCuerpo[idx].trim()) {
        e[`mapeo_${n}`] = `Asigná una variable para {{${n}}}`
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
  // Al seleccionar una entidad (contacto/visita/presupuesto/orden/actividad),
  // carga su detalle y también las FKs relacionadas (ej: contacto asociado a
  // una visita) para que todas las variables del catálogo puedan resolverse.
  const limpiarEntidades = useCallback(() => {
    setEntidadSeleccionada(null)
    setContactoPreview(null)
    setVisitaPreview(null)
    setPresupuestoPreview(null)
    setOrdenPreview(null)
    setActividadPreview(null)
  }, [])

  const cargarContactoRelacionado = useCallback(async (contactoId: string | null | undefined) => {
    if (!contactoId) return
    try {
      const res = await fetch(`/api/contactos/${contactoId}`)
      const data = await res.json()
      if (data?.id) setContactoPreview(data)
    } catch { /* silenciar */ }
  }, [])

  const seleccionarEntidadPreview = useCallback(async (sel: EntidadSeleccionada) => {
    setEntidadSeleccionada(sel)
    // Reset de las demás entidades para no mezclar datos entre selecciones
    setContactoPreview(null)
    setVisitaPreview(null)
    setPresupuestoPreview(null)
    setOrdenPreview(null)
    setActividadPreview(null)

    try {
      const endpoint = {
        contacto: `/api/contactos/${sel.id}`,
        visita: `/api/visitas/${sel.id}`,
        presupuesto: `/api/presupuestos/${sel.id}`,
        orden: `/api/ordenes/${sel.id}`,
        actividad: `/api/actividades/${sel.id}`,
      }[sel.tipo]
      const res = await fetch(endpoint)
      const data = await res.json()
      if (!data || data.error) return

      switch (sel.tipo) {
        case 'contacto':
          setContactoPreview(data)
          break
        case 'visita':
          setVisitaPreview(data)
          await cargarContactoRelacionado(data.contacto_id)
          break
        case 'presupuesto':
          setPresupuestoPreview(data)
          await cargarContactoRelacionado(data.contacto_id)
          break
        case 'orden':
          setOrdenPreview(data)
          await cargarContactoRelacionado(data.contacto_id)
          break
        case 'actividad':
          setActividadPreview(data)
          // Las actividades vinculan contactos a través de `vinculos[]`; si
          // encontramos uno de tipo contacto lo usamos como contacto principal.
          {
            const vinculos = (data.vinculos || []) as Array<{ tipo: string; id: string }>
            const vincContacto = vinculos.find(v => v.tipo === 'contacto')
            if (vincContacto) await cargarContactoRelacionado(vincContacto.id)
          }
          break
      }
    } catch { /* silenciar */ }
  }, [cargarContactoRelacionado])

  // Tipos de entidad para el buscador de preview y para filtrar opciones de
  // mapeo. Si la plantilla no declara módulos, se habilitan todos.
  const tiposEntidadesPermitidas = useMemo<EntidadPlantillaWA[] | undefined>(() => {
    if (modulos.length === 0) return undefined
    const mapa = new Map(MODULOS_DISPONIBLES.filter(m => m.entidad).map(m => [m.valor, m.entidad!]))
    const tipos = modulos.map(m => mapa.get(m)).filter(Boolean) as EntidadPlantillaWA[]
    // Contacto siempre útil como base
    if (!tipos.includes('contacto')) tipos.push('contacto')
    return Array.from(new Set(tipos))
  }, [modulos])

  const opcionesMapeo = useMemo(() => opcionesMapeoVariables(modulos), [modulos])

  const datosPreview = useMemo(() => {
    const datos = construirDatosPlantilla({
      contacto: contactoPreview,
      visita: visitaPreview,
      presupuesto: presupuestoPreview,
      orden: ordenPreview,
      actividad: actividadPreview,
      empresa: { nombre: empresa?.nombre || null },
    }, locale)
    // Fallback: para cualquier variable del catálogo sin dato real cargado,
    // usar el ejemplo genérico — así la vista previa nunca queda con `{{N}}`.
    return { ...EJEMPLOS_POR_CAMPO, ...datos }
  }, [contactoPreview, visitaPreview, presupuestoPreview, ordenPreview, actividadPreview, empresa, locale])

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

  // Detectar cambios sin guardar (form vs valores iniciales de la plantilla).
  const cambiosPendientes = useMemo(() => {
    const diffs: { campo: string; valor?: string }[] = []
    if (nombre !== (plantilla?.nombre || '')) diffs.push({ campo: 'Nombre', valor: nombre || '(vacío)' })
    if (nombreApi !== (plantilla?.nombre_api || '')) diffs.push({ campo: 'Identificador API', valor: nombreApi || '(vacío)' })
    if (categoria !== (plantilla?.categoria || 'UTILITY')) diffs.push({ campo: 'Categoría', valor: categoria })
    if (idioma !== (plantilla?.idioma || 'es')) diffs.push({ campo: 'Idioma', valor: idioma })
    if (JSON.stringify(componentes) !== JSON.stringify(plantilla?.componentes || { cuerpo: { texto: '' } })) {
      diffs.push({ campo: 'Contenido de la plantilla' })
    }
    if (JSON.stringify(modulos.slice().sort()) !== JSON.stringify((plantilla?.modulos || []).slice().sort())) {
      diffs.push({ campo: 'Módulos disponibles' })
    }
    if (canalId !== (plantilla?.canal_id || canalIdInicial || canales[0]?.id || '')) {
      diffs.push({ campo: 'Cuenta de WhatsApp' })
    }
    return diffs
  }, [plantilla, nombre, nombreApi, categoria, idioma, componentes, modulos, canalId, canalIdInicial, canales])

  useCambiosSinGuardar({
    id: `plantilla-meta-${plantilla?.id || 'nueva'}`,
    dirty: cambiosPendientes.length > 0 && esEditable,
    titulo: esEdicion ? `Plantilla WhatsApp: ${plantilla?.nombre || ''}` : 'Nueva plantilla de WhatsApp',
    cambios: cambiosPendientes,
    onGuardar: async () => { await guardar() },
  })

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
      // Si es edición, refrescamos la vista actual para que el timeline, el
      // estado y el aviso de desincronización se actualicen sin perder la página.
      // Si es creación, volvemos al listado (no hay página estable a la que refrescar).
      if (plantilla?.id) {
        setRefrescoTimeline(v => v + 1)
        if (onRecargar) await onRecargar()
        else router.refresh()
      } else {
        router.push(rutaVolver)
      }
    } catch (err) {
      mostrar('error', `Error al enviar: ${(err as Error).message}`)
    } finally {
      setEnviandoAMeta(false)
    }
  }, [nombre, nombreApi, categoria, idioma, componentes, modulos, plantilla, canalId, tieneErrores, mostrar, router, rutaVolver, onRecargar])

  // ─── Acciones del cabecero ───
  const estadoInfo = plantilla ? ESTADOS_META[plantilla.estado_meta] : null

  // Etiqueta del botón de envío según el contexto. Cuando la plantilla ya vive
  // en Meta y hay cambios locales sin sincronizar, el botón destaca como
  // "Re-enviar a Meta" para que el admin sepa que la acción es necesaria.
  const etiquetaEnviar = existeEnMeta ? 'Re-enviar a Meta' : 'Enviar a Meta'

  // Hay algo que sincronizar con Meta cuando:
  //   - la plantilla todavía no existe en Meta (primer envío), o
  //   - el form tiene cambios sin guardar (`cambiosPendientes`), o
  //   - la plantilla ya guardada tiene cambios locales vs snapshot sincronizado
  //     (`estaDesincronizada`), o
  //   - el hash de sincronización no es conocido (`sincronizacionDesconocida`).
  // Si nada de eso aplica, no vale la pena tocar Meta — deshabilitamos el botón.
  const hayAlgoParaSincronizar = !existeEnMeta
    || cambiosPendientes.length > 0
    || estaDesincronizada
    || sincronizacionDesconocida

  const acciones = [
    {
      id: 'guardar',
      etiqueta: existeEnMeta ? 'Guardar cambios' : 'Guardar borrador',
      icono: <Save size={14} />,
      onClick: guardar,
      variante: 'secundario' as const,
      cargando: guardando,
      deshabilitado: tieneErrores || cambiosPendientes.length === 0,
    },
    {
      id: 'enviar',
      etiqueta: etiquetaEnviar,
      icono: <Send size={14} />,
      onClick: enviarAMeta,
      variante: 'primario' as const,
      cargando: enviandoAMeta,
      // Deshabilitado cuando no hay nada para sincronizar: evita gastar un
      // envío a Meta (y una re-aprobación) cuando el contenido local ya
      // coincide con el snapshot aprobado.
      deshabilitado: tieneErrores || !hayAlgoParaSincronizar,
    },
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

      {/* Selector universal para preview */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Previsualizar con datos reales
        </label>
        <BuscadorEntidadPreview
          tiposPermitidos={tiposEntidadesPermitidas}
          seleccionado={entidadSeleccionada}
          onSeleccionar={seleccionarEntidadPreview}
          onLimpiar={limpiarEntidades}
        />
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
      {/* ═══ AVISO DE DESINCRONIZACIÓN CON META ═══ */}
      {plantilla && existeEnMeta && (estaDesincronizada || sincronizacionDesconocida) && (
        <div
          className={`rounded-card border px-4 py-3 flex items-start gap-3 ${
            estaDesincronizada
              ? 'bg-insignia-peligro/10 border-insignia-peligro/30'
              : 'bg-insignia-advertencia/10 border-insignia-advertencia/30'
          }`}
        >
          <AlertTriangle
            size={16}
            className={estaDesincronizada ? 'text-insignia-peligro shrink-0 mt-0.5' : 'text-insignia-advertencia shrink-0 mt-0.5'}
          />
          <div className="flex-1 text-xs">
            <p className={`font-medium ${estaDesincronizada ? 'text-insignia-peligro' : 'text-insignia-advertencia'}`}>
              {estaDesincronizada
                ? 'Esta plantilla tiene cambios locales no enviados a Meta'
                : 'Estado de sincronización desconocido'}
            </p>
            <p className="text-texto-secundario mt-1">
              {estaDesincronizada
                ? 'Lo que el cliente recibe por WhatsApp sigue siendo la versión aprobada por Meta, no los cambios que ves acá. Tenés que pulsar "Re-enviar a Meta" y esperar su aprobación para que impacte.'
                : 'Esta plantilla fue creada antes de que existiera el control de sincronización. Si hiciste cambios después de la aprobación en Meta, re-enviala para regularizar. Si no, pulsá "Re-enviar a Meta" una vez para fijar la referencia.'}
            </p>
          </div>
        </div>
      )}

      {/* ═══ LÍNEA DE TIEMPO ═══ */}
      {plantilla && <TimelinePlantilla plantillaId={plantilla.id} locale={locale} refrescoKey={refrescoTimeline} />}

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
            ayuda={existeEnMeta
              ? 'No editable: es el identificador único registrado en Meta'
              : 'Solo minúsculas, números y _'}
            error={errores.nombre_api}
            disabled={!esEditable || existeEnMeta}
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
            onChange={(v) => existeEnMeta ? undefined : setIdioma(v as IdiomaPlantillaWA)}
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
            {variablesDetectadas.map((num, idx) => {
              const errorMapeo = errores[`mapeo_${num}`]
              return (
                <div
                  key={num}
                  className={`p-3 rounded-card space-y-2 border bg-superficie-tarjeta ${
                    errorMapeo ? 'border-estado-error' : 'border-borde-sutil'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Insignia color="primario" tamano="sm">{`{{${num}}}`}</Insignia>
                    <Select
                      placeholder="Campo de Flux..."
                      valor={componentes.cuerpo?.mapeo_variables?.[idx] || ''}
                      opciones={opcionesMapeo}
                      onChange={(v) => {
                        const mapeo = [...(componentes.cuerpo?.mapeo_variables || [])]
                        mapeo[idx] = v
                        const ejemplos = [...(componentes.cuerpo?.ejemplos || [])]
                        if (!ejemplos[idx]) ejemplos[idx] = EJEMPLOS_POR_CAMPO[v] || ''
                        actualizarCuerpo({ mapeo_variables: mapeo, ejemplos })
                      }}
                    />
                  </div>
                  {errorMapeo && (
                    <p className="text-xxs text-estado-error">{errorMapeo}</p>
                  )}
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
              )
            })}
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
              <>
                <Input
                  value={boton.url || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarBoton(idx, { url: e.target.value })}
                  placeholder="https://ejemplo.com/pedido/{{1}}"
                  error={errores[`boton_url_${idx}`]}
                  disabled={!esEditable}
                />
                {boton.url?.includes('{{') && (
                  <Input
                    value={boton.ejemplo || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarBoton(idx, { ejemplo: e.target.value })}
                    placeholder="Ej: https://ejemplo.com/pedido/abc123token"
                    ayuda="URL de ejemplo resuelta (requerido por Meta para aprobar botones con variables)"
                    disabled={!esEditable}
                  />
                )}
              </>
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

function PreviewWhatsApp({
  componentes,
  datosPreview,
  locale,
  fmtHora,
}: {
  componentes: ComponentesPlantillaWA
  datosPreview: Record<string, string>
  locale: string
  fmtHora: string
}) {
  const cuerpoHtml = useMemo(() => {
    const texto = componentes.cuerpo?.texto || ''
    return formatearTextoWA(resolverTextoPlantilla(texto, componentes.cuerpo, datosPreview))
  }, [componentes.cuerpo, datosPreview])

  const encabezadoHtml = useMemo(() => {
    if (componentes.encabezado?.tipo !== 'TEXT' || !componentes.encabezado.texto) return ''
    const texto = componentes.encabezado.texto
    // El encabezado sólo admite {{1}}; usamos el ejemplo del usuario si lo hay,
    // si no, caemos al nombre de contacto cuando hay datos reales.
    const reemplazo = componentes.encabezado.ejemplo || datosPreview.contacto_nombre || '{{1}}'
    return formatearTextoWA(texto.replace(/\{\{1\}\}/g, reemplazo))
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
