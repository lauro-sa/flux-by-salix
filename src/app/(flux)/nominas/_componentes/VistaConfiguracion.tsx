'use client'

/**
 * VistaConfiguracion — Tab "Configuración" del módulo Nóminas.
 *
 * Tiene sub-tabs internas para separar áreas distintas:
 *   - "Conceptos" — catálogo de conceptos de nómina (premios, descuentos).
 *   - "Plantillas de envío" — canal + plantilla default para enviar
 *     recibos por correo y WhatsApp.
 *
 * Cada sub-tab es un componente independiente, así escalamos al sumar
 * más en el futuro (parámetros fiscales, formato del recibo, etc.).
 */

import { useEffect, useState } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { useRol } from '@/hooks/useRol'
import { Plus, Pencil, Trash2, EyeOff, Tag, Loader2, Mail, MessageSquare, Save } from 'lucide-react'
import { Tabs } from '@/componentes/ui/Tabs'
import { Select } from '@/componentes/ui/Select'
import { EditorConcepto } from './EditorConcepto'
import type { ConceptoNomina, TipoConcepto } from '@/tipos/nominas'

const ETIQUETAS_MODO: Record<string, string> = {
  monto_fijo: 'Monto fijo',
  porcentaje_basico: '% del básico',
  por_dia: 'Por día',
  por_evento: 'Por evento',
  manual: 'Manual',
}

const ETIQUETAS_CATEGORIA: Record<string, string> = {
  presentismo: 'Presentismo',
  premio: 'Premio',
  bono: 'Bono',
  antiguedad: 'Antigüedad',
  adicional: 'Adicional',
  descuento_uniforme: 'Desc. uniforme',
  descuento_otro: 'Otro desc.',
  otro: 'Otro',
}

function formatearValor(c: ConceptoNomina): string {
  if (c.valor === null) return 'Manual'
  if (c.modo_calculo === 'porcentaje_basico') return `${c.valor}%`
  return `$ ${Number(c.valor).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

type SubTab = 'conceptos' | 'plantillas'

const SUB_TABS = [
  { clave: 'conceptos', etiqueta: 'Conceptos', icono: <Tag size={14} /> },
  { clave: 'plantillas', etiqueta: 'Plantillas de envío', icono: <Mail size={14} /> },
]

export function VistaConfiguracion() {
  const [subTab, setSubTab] = useState<SubTab>('conceptos')

  return (
    <div className="px-4 md:px-6 py-4 space-y-4">
      {/* Sub-tabs: separan Conceptos de Plantillas de envío. */}
      <Tabs
        tabs={SUB_TABS}
        activo={subTab}
        onChange={(c) => setSubTab(c as SubTab)}
        layoutId="tab-config-nomina"
      />

      {subTab === 'conceptos' && <PanelConceptos />}
      {subTab === 'plantillas' && <PanelPlantillasEnvio />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Panel: Conceptos (catálogo)
// ════════════════════════════════════════════════════════════════

function PanelConceptos() {
  const toast = useToast()
  const { tienePermiso } = useRol()
  const puedeEditar = tienePermiso('nomina', 'editar')

  const [conceptos, setConceptos] = useState<ConceptoNomina[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<'' | TipoConcepto>('')
  const [incluirInactivos, setIncluirInactivos] = useState(false)

  const [editorAbierto, setEditorAbierto] = useState(false)
  const [editando, setEditando] = useState<ConceptoNomina | null>(null)

  const cargar = async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/nominas/conceptos?incluirInactivos=${incluirInactivos}`)
      const data = await res.json()
      setConceptos((data.conceptos ?? []) as ConceptoNomina[])
    } catch (err) {
      console.error('[VistaConfiguracion] error', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [incluirInactivos]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = conceptos.filter(c => !filtroTipo || c.tipo === filtroTipo)

  const eliminar = async (c: ConceptoNomina) => {
    if (!confirm(`¿Desactivar "${c.nombre}"? Va a desaparecer del catálogo pero los contratos que ya lo usan no se rompen.`)) return
    try {
      const res = await fetch(`/api/nominas/conceptos/${c.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        return toast.mostrar('error', data.error || 'No se pudo desactivar')
      }
      toast.mostrar('exito', 'Concepto desactivado')
      cargar()
    } catch {
      toast.mostrar('error', 'Error de red')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header con filtros + CTA */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-base font-semibold text-texto-primario">Conceptos de nómina</h2>
          <p className="text-xs text-texto-terciario mt-1">
            Premios, presentismo, descuentos. Se asignan al contrato del empleado.
          </p>
        </div>
        {puedeEditar && (
          <Boton
            icono={<Plus size={14} />}
            onClick={() => { setEditando(null); setEditorAbierto(true) }}
          >
            Nuevo concepto
          </Boton>
        )}
      </div>

      {/* Filtros pill */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Pill activo={filtroTipo === ''} onClick={() => setFiltroTipo('')}>Todos</Pill>
        <Pill activo={filtroTipo === 'haber'} onClick={() => setFiltroTipo('haber')}>Haberes</Pill>
        <Pill activo={filtroTipo === 'descuento'} onClick={() => setFiltroTipo('descuento')}>Descuentos</Pill>
        <div className="ml-auto">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={incluirInactivos}
              onChange={e => setIncluirInactivos(e.target.checked)}
              className="accent-texto-marca"
            />
            <span className="text-texto-terciario">Mostrar inactivos</span>
          </label>
        </div>
      </div>

      {/* Listado */}
      {cargando ? (
        <div className="flex items-center justify-center py-16 text-texto-terciario">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <EstadoVacio
          icono={<Tag size={48} strokeWidth={1.5} />}
          titulo={conceptos.length === 0 ? 'Sin conceptos cargados' : 'No hay conceptos que coincidan'}
          descripcion={conceptos.length === 0
            ? 'Cuando crees el primer concepto, va a aparecer acá. Empezá por presentismo o premios y después asigna conceptos a los contratos de cada empleado.'
            : 'Cambiá el filtro o creá uno nuevo.'}
          accion={puedeEditar && conceptos.length === 0 ? (
            <Boton icono={<Plus size={14} />} onClick={() => { setEditando(null); setEditorAbierto(true) }}>
              Crear primer concepto
            </Boton>
          ) : undefined}
        />
      ) : (
        <div className="rounded-card border border-borde-sutil overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px_140px_100px] gap-3 px-4 py-2.5 bg-superficie-elevada/50 border-b border-borde-sutil text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
            <div>Concepto</div>
            <div>Tipo</div>
            <div>Modo</div>
            <div>Valor</div>
            <div className="text-right">Acciones</div>
          </div>

          {filtrados.map(c => (
            <div
              key={c.id}
              className={`grid grid-cols-[1fr_120px_120px_140px_100px] gap-3 items-center px-4 py-3 border-b border-borde-sutil last:border-b-0 hover:bg-superficie-elevada/30 transition-colors ${c.activo ? '' : 'opacity-55'}`}
            >
              {/* Nombre + categoría */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-sm text-texto-primario truncate">{c.nombre}</span>
                  {!c.activo && <Insignia color="neutro">Inactivo</Insignia>}
                </div>
                {c.categoria && (
                  <div className="text-xs text-texto-terciario mt-0.5">{ETIQUETAS_CATEGORIA[c.categoria]}</div>
                )}
              </div>

              {/* Tipo */}
              <div>
                <Insignia color={c.tipo === 'haber' ? 'exito' : 'peligro'}>
                  {c.tipo === 'haber' ? 'Haber' : 'Descuento'}
                </Insignia>
              </div>

              {/* Modo */}
              <div className="text-xs text-texto-secundario">{ETIQUETAS_MODO[c.modo_calculo]}</div>

              {/* Valor */}
              <div className="text-sm font-mono text-texto-primario tabular-nums">
                {formatearValor(c)}
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-1">
                {puedeEditar && (
                  <>
                    <button
                      type="button"
                      title="Editar"
                      className="p-1.5 rounded hover:bg-superficie-elevada text-texto-terciario hover:text-texto-primario"
                      onClick={() => { setEditando(c); setEditorAbierto(true) }}
                    >
                      <Pencil size={14} />
                    </button>
                    {c.activo && (
                      <button
                        type="button"
                        title="Desactivar"
                        className="p-1.5 rounded hover:bg-superficie-elevada text-texto-terciario hover:text-insignia-peligro"
                        onClick={() => eliminar(c)}
                      >
                        {c.modo_calculo === 'manual' ? <EyeOff size={14} /> : <Trash2 size={14} />}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <EditorConcepto
        abierto={editorAbierto}
        concepto={editando}
        onCerrar={() => setEditorAbierto(false)}
        onGuardado={cargar}
      />
    </div>
  )
}

function Pill({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full border transition-colors ${
        activo
          ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
          : 'border-borde-sutil text-texto-terciario hover:border-borde-fuerte'
      }`}
    >
      {children}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
// Panel: Plantillas de envío (defaults para correo y WhatsApp)
// ════════════════════════════════════════════════════════════════

interface OpcionRef { id: string; nombre: string }
interface ConfigPlantillas {
  canal_correo_default_id: string | null
  plantilla_correo_default_id: string | null
  canal_whatsapp_default_id: string | null
  plantilla_whatsapp_default_id: string | null
}

function PanelPlantillasEnvio() {
  const toast = useToast()
  const { tienePermiso } = useRol()
  const puedeEditar = tienePermiso('nomina', 'editar')

  const [config, setConfig] = useState<ConfigPlantillas | null>(null)
  const [canalesCorreo, setCanalesCorreo] = useState<OpcionRef[]>([])
  const [canalesWhatsApp, setCanalesWhatsApp] = useState<OpcionRef[]>([])
  const [plantillasCorreo, setPlantillasCorreo] = useState<OpcionRef[]>([])
  const [plantillasWhatsApp, setPlantillasWhatsApp] = useState<OpcionRef[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // ─── Carga inicial ───
  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      try {
        const [confRes, ccRes, cwaRes, pcRes, pwaRes] = await Promise.all([
          fetch('/api/nominas/configuracion').then(r => r.json()),
          fetch('/api/correo/canales').then(r => r.json()).catch(() => ({ canales: [] })),
          fetch('/api/whatsapp/canales').then(r => r.json()).catch(() => ({ canales: [] })),
          fetch('/api/correo/plantillas').then(r => r.json()).catch(() => ({ plantillas: [] })),
          fetch('/api/whatsapp/plantillas').then(r => r.json()).catch(() => ({ plantillas: [] })),
        ])
        if (cancelado) return

        setConfig(confRes.configuracion ?? {
          canal_correo_default_id: null,
          plantilla_correo_default_id: null,
          canal_whatsapp_default_id: null,
          plantilla_whatsapp_default_id: null,
        })

        // Canales: tomamos id y un nombre legible. La estructura puede
        // variar entre endpoints, normalizamos.
        const norm = (lista: Array<Record<string, unknown>>): OpcionRef[] =>
          lista.map(c => ({
            id: c.id as string,
            nombre: (c.nombre as string) || (c.nombre_visible as string) || (c.alias as string) || '—',
          }))
        setCanalesCorreo(norm((ccRes.canales as Array<Record<string, unknown>>) ?? []))
        setCanalesWhatsApp(norm((cwaRes.canales as Array<Record<string, unknown>>) ?? []))

        // Plantillas: filtramos solo las que están marcadas para nóminas
        // (campo `modulos` contiene 'nomina' o 'nominas') o categoría
        // 'nomina'. Si no hay ninguna así, mostramos todas para no
        // bloquear al usuario.
        const filtrar = (lista: Array<Record<string, unknown>>): OpcionRef[] => {
          const todas = lista.map(p => ({
            id: p.id as string,
            nombre: (p.nombre as string) || '—',
            modulos: (p.modulos as string[]) ?? [],
            categoria: (p.categoria as string) ?? null,
          }))
          const especificas = todas.filter(p =>
            p.modulos?.some(m => m === 'nomina' || m === 'nominas') || p.categoria === 'nomina',
          )
          return (especificas.length > 0 ? especificas : todas).map(p => ({ id: p.id, nombre: p.nombre }))
        }
        setPlantillasCorreo(filtrar((pcRes.plantillas as Array<Record<string, unknown>>) ?? []))
        setPlantillasWhatsApp(filtrar((pwaRes.plantillas as Array<Record<string, unknown>>) ?? []))
      } catch (err) {
        console.error('[PanelPlantillasEnvio] error:', err)
        toast.mostrar('error', 'No se pudo cargar la configuración')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [toast])

  const actualizar = (campo: keyof ConfigPlantillas, valor: string | null) => {
    setConfig(prev => prev ? { ...prev, [campo]: valor || null } : prev)
  }

  const guardar = async () => {
    if (!config) return
    setGuardando(true)
    try {
      const res = await fetch('/api/nominas/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const data = await res.json()
        return toast.mostrar('error', data.error || 'No se pudo guardar')
      }
      toast.mostrar('exito', 'Configuración guardada')
    } catch {
      toast.mostrar('error', 'Error de red')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando || !config) {
    return (
      <div className="flex items-center justify-center py-12 text-texto-terciario">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-texto-primario">Plantillas de envío</h2>
        <p className="text-xs text-texto-terciario mt-1">
          Elegí el canal y la plantilla por defecto. Cuando envíes recibos desde la pestaña Liquidaciones, vienen preseleccionados (podés cambiarlos en el momento si querés).
        </p>
      </div>

      {/* Bloque correo */}
      <section className="rounded-card border border-borde-sutil p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-texto-primario">
          <Mail size={14} className="text-texto-terciario" />
          Correo
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            etiqueta="Canal de correo"
            valor={config.canal_correo_default_id ?? ''}
            opciones={[
              { valor: '', etiqueta: 'Sin canal default' },
              ...canalesCorreo.map(c => ({ valor: c.id, etiqueta: c.nombre })),
            ]}
            onChange={v => actualizar('canal_correo_default_id', v || null)}
          />
          <Select
            etiqueta="Plantilla de correo"
            valor={config.plantilla_correo_default_id ?? ''}
            opciones={[
              { valor: '', etiqueta: 'Sin plantilla default' },
              ...plantillasCorreo.map(p => ({ valor: p.id, etiqueta: p.nombre })),
            ]}
            onChange={v => actualizar('plantilla_correo_default_id', v || null)}
          />
        </div>
        {plantillasCorreo.length === 0 && (
          <p className="text-[11px] text-texto-terciario">
            Todavía no hay plantillas de correo. Creá una en{' '}
            <a href="/inbox/configuracion?tab=plantillas" className="text-texto-marca underline-offset-2 hover:underline">
              Inbox → Configuración → Plantillas
            </a>
            {' '}y volvé acá para asignarla.
          </p>
        )}
      </section>

      {/* Bloque WhatsApp */}
      <section className="rounded-card border border-borde-sutil p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-texto-primario">
          <MessageSquare size={14} className="text-texto-terciario" />
          WhatsApp
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            etiqueta="Canal de WhatsApp"
            valor={config.canal_whatsapp_default_id ?? ''}
            opciones={[
              { valor: '', etiqueta: 'Sin canal default' },
              ...canalesWhatsApp.map(c => ({ valor: c.id, etiqueta: c.nombre })),
            ]}
            onChange={v => actualizar('canal_whatsapp_default_id', v || null)}
          />
          <Select
            etiqueta="Plantilla de WhatsApp"
            valor={config.plantilla_whatsapp_default_id ?? ''}
            opciones={[
              { valor: '', etiqueta: 'Sin plantilla default' },
              ...plantillasWhatsApp.map(p => ({ valor: p.id, etiqueta: p.nombre })),
            ]}
            onChange={v => actualizar('plantilla_whatsapp_default_id', v || null)}
          />
        </div>
        {plantillasWhatsApp.length === 0 && (
          <p className="text-[11px] text-texto-terciario">
            Todavía no hay plantillas de WhatsApp aprobadas. Creá y aprobá una en{' '}
            <a href="/inbox/configuracion?tab=plantillas-whatsapp" className="text-texto-marca underline-offset-2 hover:underline">
              Inbox → Configuración → Plantillas
            </a>
            . Si querés incluir el link al PDF del recibo, agregá la variable{' '}
            <code className="px-1 py-0.5 bg-superficie-elevada rounded text-[10px]">{`{{nomina.enlace_recibo}}`}</code>
            {' '}al cuerpo de la plantilla.
          </p>
        )}
      </section>

      {puedeEditar && (
        <div className="flex justify-end">
          <Boton icono={<Save size={14} />} onClick={guardar} cargando={guardando}>
            Guardar configuración
          </Boton>
        </div>
      )}
    </div>
  )
}
