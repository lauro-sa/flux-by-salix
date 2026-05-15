'use client'

/**
 * SeccionLicencias — Lista + CRUD de licencias de un contrato.
 *
 * Se usa en la ficha laboral del empleado (tab "Licencias"). Permite:
 *   - Ver el listado (ordenado por fecha_inicio desc).
 *   - Crear una licencia nueva (modal).
 *   - Editar una existente (mismo modal, modo edición).
 *   - Cerrar una licencia abierta (setea fecha_fin = hoy).
 *   - Eliminar una licencia (no afecta pagos pasados; solo afecta cálculos futuros).
 *
 * El motor de cálculo respeta las licencias en el cálculo del recibo
 * (ver src/lib/nominas/motor-calculo.ts). Una licencia con `goce_sueldo=false`
 * descuenta del prorrateo; con `goce_sueldo=true` solo se muestra
 * informativa.
 */

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, CalendarOff, AlertCircle } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Insignia } from '@/componentes/ui/Insignia'
import { useToast } from '@/componentes/feedback/Toast'
import { ModalLicencia } from './ModalLicencia'
import type { LicenciaContrato, TipoLicencia } from '@/tipos/nominas'

interface Props {
  contratoId: string
  puedeEditar: boolean
}

const ETIQUETAS_TIPO: Record<TipoLicencia, string> = {
  medica: 'Licencia médica',
  maternidad: 'Maternidad',
  paternidad: 'Paternidad',
  estudio: 'Estudio',
  examen: 'Examen',
  duelo: 'Duelo',
  matrimonio: 'Matrimonio',
  mudanza: 'Mudanza',
  vacaciones: 'Vacaciones',
  suspension_disciplinaria: 'Suspensión disciplinaria',
  suspension_economica: 'Suspensión económica',
  otro: 'Otro',
}

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function diferenciaDias(inicio: string, fin: string | null): number {
  const finReal = fin ?? new Date().toISOString().slice(0, 10)
  const [yi, mi, di] = inicio.split('-').map(Number)
  const [yf, mf, df] = finReal.split('-').map(Number)
  const t1 = Date.UTC(yi, mi - 1, di)
  const t2 = Date.UTC(yf, mf - 1, df)
  return Math.floor((t2 - t1) / (1000 * 60 * 60 * 24)) + 1
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function SeccionLicencias({ contratoId, puedeEditar }: Props) {
  const toast = useToast()
  const [licencias, setLicencias] = useState<LicenciaContrato[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState<{ abierto: boolean; editando: LicenciaContrato | null }>(
    { abierto: false, editando: null },
  )

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/nominas/contratos/${contratoId}/licencias`)
      const data = await res.json()
      setLicencias((data.licencias ?? []) as LicenciaContrato[])
    } catch (err) {
      console.error('[SeccionLicencias] error:', err)
      toast.mostrar('error', 'No se pudieron cargar las licencias')
    } finally {
      setCargando(false)
    }
  }, [contratoId, toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  const handleCerrar = async (lic: LicenciaContrato) => {
    try {
      const res = await fetch(`/api/nominas/licencias/${lic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_fin: hoyIso() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.mostrar('error', data.error || 'No se pudo cerrar la licencia')
        return
      }
      toast.mostrar('exito', 'Licencia cerrada')
      cargar()
    } catch (err) {
      console.error('[SeccionLicencias] error cerrar:', err)
      toast.mostrar('error', 'Error de red')
    }
  }

  const handleEliminar = async (lic: LicenciaContrato) => {
    if (!confirm(`¿Eliminar la licencia (${ETIQUETAS_TIPO[lic.tipo]})? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/nominas/licencias/${lic.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.mostrar('error', data.error || 'No se pudo eliminar')
        return
      }
      toast.mostrar('exito', 'Licencia eliminada')
      cargar()
    } catch (err) {
      console.error('[SeccionLicencias] error eliminar:', err)
      toast.mostrar('error', 'Error de red')
    }
  }

  if (cargando) {
    return (
      <div className="px-4 md:px-6 py-8 text-sm text-texto-terciario">Cargando licencias…</div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 space-y-4">
      {/* Header con CTA */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-texto-primario">Licencias</h2>
          <p className="text-xs text-texto-terciario mt-1">
            Períodos donde el empleado no trabaja. El motor descuenta automáticamente las que están sin goce de sueldo.
          </p>
        </div>
        {puedeEditar && (
          <Boton
            onClick={() => setModal({ abierto: true, editando: null })}
            variante="secundario"
            tamano="sm"
            icono={<Plus size={14} />}
          >
            Nueva licencia
          </Boton>
        )}
      </div>

      {licencias.length === 0 ? (
        <EstadoVacio
          icono={<CalendarOff size={40} strokeWidth={1.5} />}
          titulo="Sin licencias registradas"
          descripcion="Cuando cargues una licencia (médica, suspensión, vacaciones, etc.) va a aparecer acá. El motor del recibo la respeta automáticamente."
        />
      ) : (
        <div className="space-y-2">
          {licencias.map(lic => {
            const dias = diferenciaDias(lic.fecha_inicio, lic.fecha_fin)
            const abierta = !lic.fecha_fin
            return (
              <div
                key={lic.id}
                className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-4 hover:border-borde-fuerte transition-colors"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-texto-primario">
                        {ETIQUETAS_TIPO[lic.tipo]}
                      </p>
                      {abierta && (
                        <Insignia color="advertencia" tamano="sm">En curso</Insignia>
                      )}
                      <Insignia color={lic.goce_sueldo ? 'info' : 'peligro'} tamano="sm">
                        {lic.goce_sueldo ? 'Con goce' : 'Sin goce'}
                      </Insignia>
                    </div>
                    <p className="text-xs text-texto-terciario mt-1">
                      {formatearFecha(lic.fecha_inicio)}
                      {' → '}
                      {lic.fecha_fin ? formatearFecha(lic.fecha_fin) : 'sin fin'}
                      <span className="ml-2 text-texto-secundario">· {dias} día{dias === 1 ? '' : 's'}</span>
                    </p>
                    {lic.notas && (
                      <p className="text-xs text-texto-secundario mt-2 whitespace-pre-wrap">{lic.notas}</p>
                    )}
                  </div>

                  {puedeEditar && (
                    <div className="flex items-center gap-1 shrink-0">
                      {abierta && (
                        <Boton
                          variante="fantasma"
                          tamano="xs"
                          icono={<Check size={12} />}
                          onClick={() => handleCerrar(lic)}
                          titulo="Cerrar (poner fecha de fin = hoy)"
                        >
                          Cerrar
                        </Boton>
                      )}
                      <Boton
                        variante="fantasma"
                        tamano="xs"
                        soloIcono
                        titulo="Editar"
                        icono={<Pencil size={12} />}
                        onClick={() => setModal({ abierto: true, editando: lic })}
                      />
                      <Boton
                        variante="fantasma"
                        tamano="xs"
                        soloIcono
                        titulo="Eliminar"
                        icono={<Trash2 size={12} />}
                        onClick={() => handleEliminar(lic)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Aviso sutil sobre efecto en cálculo */}
      <div className="rounded-card border border-insignia-info/20 bg-insignia-info/5 p-3 flex items-start gap-2">
        <AlertCircle size={13} className="text-insignia-info shrink-0 mt-0.5" />
        <p className="text-[11px] text-texto-secundario">
          Las licencias <strong>sin goce de sueldo</strong> se descuentan del recibo proporcionalmente a los días del período.
          Las que son <strong>con goce</strong> aparecen en el recibo como información pero no descuentan.
        </p>
      </div>

      {modal.abierto && (
        <ModalLicencia
          contratoId={contratoId}
          editando={modal.editando}
          onCerrar={() => setModal({ abierto: false, editando: null })}
          onGuardado={() => {
            setModal({ abierto: false, editando: null })
            cargar()
          }}
        />
      )}
    </div>
  )
}
