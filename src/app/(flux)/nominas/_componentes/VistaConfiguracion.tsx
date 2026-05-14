'use client'

/**
 * VistaConfiguracion — Tab "Configuración" del módulo Nóminas.
 *
 * Por ahora muestra solo el catálogo de conceptos de nómina. En PRs
 * futuros se pueden sumar otras sub-secciones (parámetros fiscales,
 * formato del recibo, etc.) como tabs internas o sub-rutas.
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 6).
 */

import { useEffect, useState } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { useRol } from '@/hooks/useRol'
import { Plus, Pencil, Trash2, EyeOff, Tag, Loader2 } from 'lucide-react'
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

export function VistaConfiguracion() {
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
    <div className="px-4 md:px-6 py-4 space-y-4">
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
