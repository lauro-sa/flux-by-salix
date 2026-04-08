'use client'

/**
 * ModalEnviarReciboNomina — Enviar recibos de nómina por correo.
 *
 * Modo individual (1 empleado): abre ModalEnviarDocumento con datos pre-cargados.
 * Modo lote (varios empleados): preview de plantilla + lista de destinatarios + envío masivo.
 *
 * Se usa en: ModalNomina.tsx
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { ModalEnviarDocumento } from '@/componentes/entidad/ModalEnviarDocumento'
import { resolverVariables } from '@/lib/variables/resolver'
import {
  ASUNTO_RECIBO_NOMINA,
  HTML_RECIBO_NOMINA,
  construirContextoNomina,
  type DatosNominaCorreo,
} from '@/lib/plantilla-correo-nomina'
import { construirHtmlCorreoDocumento } from '@/lib/plantilla-correo-documento'
import type { CanalCorreoEmpresa, PlantillaCorreo } from '@/componentes/entidad/_enviar_documento/tipos'
import '@/lib/variables/entidades'
import {
  Send, Loader2, CheckCircle2, AlertCircle,
  Mail, UserX, Users,
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────

interface ResultadoNominaConCorreo {
  miembro_id: string
  nombre: string
  correo: string
  compensacion_tipo: string
  compensacion_monto: number
  compensacion_frecuencia?: string
  dias_laborales: number
  dias_trabajados: number
  dias_ausentes: number
  dias_tardanza: number
  horas_brutas: number
  horas_netas: number
  horas_almuerzo: number
  horas_particular: number
  horas_totales: number
  promedio_horas_diario: number
  dias_con_almuerzo: number
  dias_con_salida_particular: number
  descuenta_almuerzo: boolean
  duracion_almuerzo_config: number
  dias_feriados: number
  dias_trabajados_feriado: number
  monto_pagar: number
  monto_detalle: string
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  resultados: ResultadoNominaConCorreo[]
  etiquetaPeriodo: string
  nombreEmpresa: string
}

// ─── Helpers ─────────────────────────────────────────────────

const fmtMonto = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtHoras = (h: number) => {
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return min > 0 ? `${hrs}h ${min}min` : `${hrs}h`
}

function construirDatosEmpleado(r: ResultadoNominaConCorreo, etiquetaPeriodo: string): DatosNominaCorreo {
  const diasLab = r.dias_laborales || 1
  return ({
    nombre_empleado: r.nombre,
    correo_empleado: r.correo,
    periodo: etiquetaPeriodo,
    dias_trabajados: r.dias_trabajados,
    dias_laborales: r.dias_laborales,
    dias_ausentes: r.dias_ausentes,
    dias_tardanza: r.dias_tardanza,
    // Horas formateadas
    horas_brutas: fmtHoras(r.horas_brutas),
    horas_netas: fmtHoras(r.horas_netas),
    horas_almuerzo: fmtHoras(r.horas_almuerzo),
    horas_particular: fmtHoras(r.horas_particular),
    promedio_diario: fmtHoras(r.promedio_horas_diario),
    dias_con_almuerzo: r.dias_con_almuerzo,
    dias_con_salida_particular: r.dias_con_salida_particular,
    descuenta_almuerzo: r.descuenta_almuerzo,
    dias_feriados: r.dias_feriados || 0,
    dias_trabajados_feriado: r.dias_trabajados_feriado || 0,
    porcentaje_asistencia: `${Math.round((r.dias_trabajados / diasLab) * 100)}%`,
    compensacion_tipo: r.compensacion_tipo,
    compensacion_detalle: r.monto_detalle,
    monto_bruto: r.monto_pagar,
  }) as DatosNominaCorreo
}

// ─── Estado del envío en lote ────────────────────────────────

type EstadoEnvio = 'idle' | 'enviando' | 'completado'

interface ResultadoEnvioLote {
  enviados: number
  fallidos: number
  total: number
  resultados: { correo: string; ok: boolean; error?: string }[]
}

// ─── Componente ──────────────────────────────────────────────

export function ModalEnviarReciboNomina({
  abierto,
  onCerrar,
  resultados,
  etiquetaPeriodo,
  nombreEmpresa,
}: PropiedadesModal) {
  // Canales y plantillas de correo
  const [canales, setCanales] = useState<CanalCorreoEmpresa[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaCorreo[]>([])
  const [canalSeleccionado, setCanalSeleccionado] = useState('')

  // Estado del envío en lote
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>('idle')
  const [resultadoLote, setResultadoLote] = useState<ResultadoEnvioLote | null>(null)

  // Para modo individual: abrir ModalEnviarDocumento
  const [modalIndividualAbierto, setModalIndividualAbierto] = useState(false)

  const empleadosConCorreo = useMemo(() => resultados.filter(r => r.correo), [resultados])
  const empleadosSinCorreo = useMemo(() => resultados.filter(r => !r.correo), [resultados])
  const esIndividual = resultados.length === 1 && empleadosConCorreo.length === 1

  // Cargar canales y plantillas al abrir
  useEffect(() => {
    if (!abierto) return
    setEstadoEnvio('idle')
    setResultadoLote(null)

    // Cargar canales de correo disponibles para asistencias
    fetch('/api/inbox/canales?tipo=correo&modulo=asistencias')
      .then(r => r.json())
      .then(data => {
        const canalesMapped: CanalCorreoEmpresa[] = ((data.canales || []) as Record<string, unknown>[])
          .filter((c) => c.tipo === 'correo' && c.estado_conexion === 'conectado')
          .map((c) => {
            const config = c.config_conexion as Record<string, string> | null
            return {
              id: c.id as string,
              nombre: c.nombre as string,
              email: config?.email || config?.usuario || '',
              predeterminado: (c.es_principal as boolean) || false,
            }
          })
        setCanales(canalesMapped)
        const predeterminado = canalesMapped.find(c => c.predeterminado)
        setCanalSeleccionado(predeterminado?.id || canalesMapped[0]?.id || '')
      })
      .catch(() => {})

    // Cargar plantillas de correo (canal=correo)
    fetch('/api/inbox/plantillas?canal=correo')
      .then(r => r.json())
      .then(data => setPlantillas(data.plantillas || []))
      .catch(() => {})
  }, [abierto])

  // Modo individual: abrir ModalEnviarDocumento
  useEffect(() => {
    if (abierto && esIndividual) {
      setModalIndividualAbierto(true)
    }
  }, [abierto, esIndividual])

  // Contexto de variables para el primer empleado (preview)
  const contextoPrimerEmpleado = useMemo(() => {
    if (!empleadosConCorreo.length) return {}
    const datos = construirDatosEmpleado(empleadosConCorreo[0], etiquetaPeriodo)
    return construirContextoNomina(datos, nombreEmpresa)
  }, [empleadosConCorreo, etiquetaPeriodo, nombreEmpresa])

  // Preview del HTML resuelto (para mostrar ejemplo)
  const htmlPreview = useMemo(() => {
    return resolverVariables(HTML_RECIBO_NOMINA, contextoPrimerEmpleado)
  }, [contextoPrimerEmpleado])

  const asuntoPreview = useMemo(() => {
    return resolverVariables(ASUNTO_RECIBO_NOMINA, contextoPrimerEmpleado)
  }, [contextoPrimerEmpleado])

  // Enviar en lote
  const enviarEnLote = useCallback(async () => {
    if (!canalSeleccionado || !empleadosConCorreo.length) return
    setEstadoEnvio('enviando')

    const empleadosData = empleadosConCorreo.map(r =>
      construirDatosEmpleado(r, etiquetaPeriodo)
    )

    try {
      const res = await fetch('/api/asistencias/nomina/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal_id: canalSeleccionado,
          asunto_plantilla: ASUNTO_RECIBO_NOMINA,
          html_plantilla: HTML_RECIBO_NOMINA,
          empleados: empleadosData,
          nombre_empresa: nombreEmpresa,
        }),
      })

      const data = await res.json()
      setResultadoLote(data)
      setEstadoEnvio('completado')
    } catch {
      setEstadoEnvio('completado')
      setResultadoLote({
        enviados: 0,
        fallidos: empleadosConCorreo.length,
        total: empleadosConCorreo.length,
        resultados: [],
      })
    }
  }, [canalSeleccionado, empleadosConCorreo, etiquetaPeriodo, nombreEmpresa])

  // Envío individual: callback para ModalEnviarDocumento
  // El HTML y asunto ya vienen resueltos del editor (el usuario pudo editarlos)
  const handleEnviarIndividual = useCallback(async (datos: {
    canal_id: string
    correo_para: string[]
    correo_cc: string[]
    correo_cco: string[]
    asunto: string
    html: string
    texto: string
    adjuntos_ids: string[]
  }) => {
    const htmlFinal = construirHtmlCorreoDocumento({
      htmlCuerpo: datos.html,
      incluirPortal: false,
      empresa: { nombre: nombreEmpresa },
    })

    await fetch('/api/inbox/correo/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canal_id: datos.canal_id,
        correo_para: datos.correo_para,
        correo_cc: datos.correo_cc,
        correo_cco: datos.correo_cco,
        correo_asunto: datos.asunto,
        texto: datos.asunto,
        html: htmlFinal,
        tipo: 'nuevo',
        adjuntos_ids: datos.adjuntos_ids,
      }),
    })

    setModalIndividualAbierto(false)
    onCerrar()
  }, [nombreEmpresa, onCerrar])

  // ─── HTML y asunto resueltos para modo individual ───
  // Se pasan ya resueltos como htmlInicial porque useEnvioDocumento
  // no resuelve variables del htmlInicial (solo las resuelve al aplicar plantilla).
  const htmlResueltoIndividual = useMemo(() => {
    if (!esIndividual || !empleadosConCorreo.length) return ''
    return resolverVariables(HTML_RECIBO_NOMINA, contextoPrimerEmpleado)
  }, [esIndividual, empleadosConCorreo.length, contextoPrimerEmpleado])

  const asuntoResueltoIndividual = useMemo(() => {
    if (!esIndividual || !empleadosConCorreo.length) return ''
    return resolverVariables(ASUNTO_RECIBO_NOMINA, contextoPrimerEmpleado)
  }, [esIndividual, empleadosConCorreo.length, contextoPrimerEmpleado])

  // ─── Modo individual: ModalEnviarDocumento ───

  if (esIndividual) {
    const emp = empleadosConCorreo[0]
    if (!emp) return null

    return (
      <ModalEnviarDocumento
        abierto={modalIndividualAbierto}
        onCerrar={() => {
          setModalIndividualAbierto(false)
          onCerrar()
        }}
        onEnviar={handleEnviarIndividual}
        canales={canales}
        plantillas={plantillas}
        correosDestinatario={[emp.correo]}
        nombreDestinatario={emp.nombre}
        asuntoPredeterminado={asuntoResueltoIndividual}
        htmlInicial={htmlResueltoIndividual}
        tipoDocumento="nomina"
        contextoVariables={contextoPrimerEmpleado}
        pdfDesactivadoInicial
        portalDesactivadoInicial
      />
    )
  }

  // ─── Modo lote ───

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Enviar recibos — ${etiquetaPeriodo}`}
      tamano="lg"
      acciones={
        estadoEnvio === 'completado' ? (
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cerrar</Boton>
        ) : (
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-texto-terciario">
              {empleadosConCorreo.length} destinatario{empleadosConCorreo.length !== 1 ? 's' : ''}
              {empleadosSinCorreo.length > 0 && (
                <span className="text-amber-400 ml-2">
                  · {empleadosSinCorreo.length} sin correo
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
              <Boton
                tamano="sm"
                onClick={enviarEnLote}
                disabled={estadoEnvio === 'enviando' || !canalSeleccionado || !empleadosConCorreo.length}
              >
                {estadoEnvio === 'enviando' ? (
                  <><Loader2 size={13} className="mr-1 animate-spin" /> Enviando...</>
                ) : (
                  <><Send size={13} className="mr-1" /> Enviar todos</>
                )}
              </Boton>
            </div>
          </div>
        )
      }
    >
      {/* Estado completado */}
      {estadoEnvio === 'completado' && resultadoLote && (
        <div className="space-y-4">
          <div className="text-center py-6">
            {resultadoLote.fallidos === 0 ? (
              <>
                <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
                <p className="text-lg font-semibold text-texto-primario">
                  {resultadoLote.enviados} recibo{resultadoLote.enviados !== 1 ? 's' : ''} enviado{resultadoLote.enviados !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-texto-terciario mt-1">
                  Todos los correos fueron enviados correctamente.
                </p>
              </>
            ) : (
              <>
                <AlertCircle size={40} className="mx-auto text-amber-400 mb-3" />
                <p className="text-lg font-semibold text-texto-primario">
                  {resultadoLote.enviados} enviado{resultadoLote.enviados !== 1 ? 's' : ''}, {resultadoLote.fallidos} fallido{resultadoLote.fallidos !== 1 ? 's' : ''}
                </p>
              </>
            )}
          </div>

          {/* Detalle de errores */}
          {resultadoLote.resultados.filter(r => !r.ok).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-texto-terciario mb-2">Errores:</p>
              {resultadoLote.resultados.filter(r => !r.ok).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
                  <AlertCircle size={12} />
                  <span>{r.correo || 'Sin correo'}: {r.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estado normal / enviando */}
      {estadoEnvio !== 'completado' && (
        <div className="space-y-4">
          {/* Selector de canal */}
          {canales.length > 1 && (
            <div>
              <label className="text-xs font-medium text-texto-terciario mb-1 block">Enviar desde</label>
              <select
                value={canalSeleccionado}
                onChange={e => setCanalSeleccionado(e.target.value)}
                className="w-full text-sm bg-superficie-elevada border border-borde-sutil rounded-lg px-3 py-2 text-texto-primario"
              >
                {canales.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>
                ))}
              </select>
            </div>
          )}

          {/* Preview del asunto */}
          <div>
            <label className="text-xs font-medium text-texto-terciario mb-1 block">Asunto (preview)</label>
            <div className="text-sm bg-superficie-elevada/30 border border-borde-sutil rounded-lg px-3 py-2 text-texto-primario">
              {asuntoPreview}
            </div>
          </div>

          {/* Preview del HTML */}
          <div>
            <label className="text-xs font-medium text-texto-terciario mb-1 block">
              Contenido (preview para {empleadosConCorreo[0]?.nombre || 'empleado'})
            </label>
            <div
              className="text-sm bg-superficie-elevada/20 border border-borde-sutil rounded-lg px-4 py-3 max-h-[300px] overflow-y-auto prose prose-sm prose-invert"
              dangerouslySetInnerHTML={{ __html: htmlPreview }}
            />
          </div>

          {/* Lista de destinatarios */}
          <div>
            <label className="text-xs font-medium text-texto-terciario mb-2 flex items-center gap-1.5">
              <Users size={12} />
              Destinatarios ({empleadosConCorreo.length})
            </label>
            <div className="space-y-1 max-h-[180px] overflow-y-auto">
              {empleadosConCorreo.map(r => (
                <div
                  key={r.miembro_id}
                  className="flex items-center justify-between bg-superficie-elevada/20 border border-borde-sutil rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Mail size={12} className="text-texto-terciario shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-texto-primario">{r.nombre}</p>
                      <p className="text-[11px] text-texto-terciario">{r.correo}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400">{fmtMonto(r.monto_pagar)}</span>
                </div>
              ))}

              {/* Empleados sin correo */}
              {empleadosSinCorreo.map(r => (
                <div
                  key={r.miembro_id}
                  className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <UserX size={12} className="text-amber-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-texto-primario">{r.nombre}</p>
                      <p className="text-[11px] text-amber-400">Sin correo configurado</p>
                    </div>
                  </div>
                  <span className="text-sm text-texto-terciario">{fmtMonto(r.monto_pagar)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
