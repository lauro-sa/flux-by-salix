'use client'

/**
 * Tab Resumen — muestra stats rápidos, calendario, compensación, documentos.
 * Primera pestaña visible en el perfil de usuario.
 */

import {
  Check, X, Clock, DollarSign, ChevronRight,
  Calendar, CalendarDays, MapPin, Phone,
  Fingerprint, Heart, Upload,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { PERMISOS_POR_ROL } from '@/hooks/useRol'
import type { Rol, Modulo, Miembro, Perfil } from '@/tipos'
import { ACCIONES_POR_MODULO } from '@/tipos'
import { TarjetaStat, MiniCalendario } from './ComponentesComunes'
import { ResumenMetricasMini } from './ResumenMetricasMini'
import { MODULOS_PREVIEW, ETIQUETA_ROL, type Periodo, type TabPerfil } from './constantes'
import Image from 'next/image'

interface PropsTabResumen {
  perfil: Perfil
  miembro: Miembro
  /* Stats de asistencia del mes */
  statsAsistencia: { presentes: number; ausentes: number; tardanzas: number }
  /* Stats del período activo */
  statsPeriodo: { habiles: number; trabajados: number; ausentes: number; tardanzas: number }
  /* Compensación */
  compensacionTipo: string
  compensacionMonto: number
  compensacionFrecuencia: string
  diasTrabajo: number
  proyeccionMensual: number
  montoPagar: number
  diasTrabajadosQuincena: number
  /* Período */
  periodoActual: Periodo
  /* Calendario */
  asistenciasMes: Record<number, 'presente' | 'ausente' | 'tardanza'>
  diasLaborales: number[]
  /* Contacto emergencia y documentos */
  contactoEmergencia: Record<string, unknown> | null
  documentosUsuario: Record<string, unknown>[]
  archivosDocLocal: Record<string, { nombre: string; url: string | null; subiendo: boolean; error?: boolean }>
  /* Datos derivados */
  rolActual: Rol
  fechaNac: Date | null
  edad: number | null
  /* Formatter */
  fmt: {
    fecha: (v: string | Date, opts?: Record<string, unknown>) => string
    moneda: (v: number) => string
    diasSemanaCortos: string[]
    diaInicioSemana: number
    locale: string
  }
  t: (key: string) => string
  /* Navegación entre tabs */
  setTab: (tab: TabPerfil) => void
  setDocPreview: (v: { titulo: string; url: string } | null) => void
}

export function TabResumen({
  perfil, miembro,
  statsAsistencia, statsPeriodo,
  compensacionTipo, compensacionMonto, compensacionFrecuencia,
  diasTrabajo, proyeccionMensual, montoPagar, diasTrabajadosQuincena,
  periodoActual,
  asistenciasMes, diasLaborales,
  contactoEmergencia, documentosUsuario, archivosDocLocal,
  rolActual, fechaNac, edad,
  fmt, t,
  setTab, setDocPreview,
}: PropsTabResumen) {
  const hoy = new Date()

  return (
    <div className="space-y-5">
      {/* Stats rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TarjetaStat
          etiqueta="Presentes"
          valor={statsAsistencia.presentes}
          subvalor="este mes"
          icono={<Check size={16} />}
          color="exito"
        />
        <TarjetaStat
          etiqueta="Ausencias"
          valor={statsAsistencia.ausentes}
          subvalor="este mes"
          icono={<X size={16} />}
          color="peligro"
        />
        <TarjetaStat
          etiqueta="Tardanzas"
          valor={statsAsistencia.tardanzas}
          subvalor="este mes"
          icono={<Clock size={16} />}
          color="advertencia"
        />
        <TarjetaStat
          etiqueta="A pagar"
          valor={fmt.moneda(montoPagar)}
          subvalor={compensacionTipo === 'por_dia' ? `${fmt.moneda(compensacionMonto)} × ${diasTrabajadosQuincena} días` : compensacionFrecuencia}
          icono={<DollarSign size={16} />}
          color="primario"
        />
      </div>

      {/* Fila: Calendario + Datos rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mini calendario */}
        <Tarjeta titulo="Asistencias del mes" subtitulo={`${statsAsistencia.presentes + statsAsistencia.tardanzas} de ${Object.keys(asistenciasMes).length + (statsAsistencia.ausentes)} días laborales`}>
          <MiniCalendario
            anio={hoy.getFullYear()}
            mes={hoy.getMonth()}
            asistencias={asistenciasMes}
            diasLaborales={diasLaborales}
            diasSemanaCortos={fmt.diasSemanaCortos}
            diaInicioSemana={fmt.diaInicioSemana}
            formatearMes={(d) => fmt.fecha(d, { soloMes: true })}
          />
        </Tarjeta>

        {/* Panel de compensación + datos */}
        <div className="space-y-4">
          {/* Compensación resumen */}
          <Tarjeta titulo={t('usuarios.compensacion')}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Insignia color={compensacionTipo === 'por_dia' ? 'info' : compensacionTipo === 'por_hora' ? 'cyan' : 'primario'}>
                  {compensacionTipo === 'por_dia' ? 'Cobra por día' : compensacionTipo === 'por_hora' ? 'Cobra por hora' : 'Sueldo fijo'}
                </Insignia>
                <Insignia color="neutro">{
                  compensacionFrecuencia === 'semanal' ? 'Semanal' :
                  compensacionFrecuencia === 'quincenal' ? 'Quincenal' :
                  compensacionFrecuencia === 'eventual' ? 'Eventual' : 'Mensual'
                }</Insignia>
                <Insignia color="neutro">
                  {diasTrabajo === 7 ? '7/7' : diasTrabajo === 6 ? 'L-S' : diasTrabajo === 5 ? 'L-V' : `${diasTrabajo} días`}
                </Insignia>
              </div>

              <div>
                <p className="text-xs text-texto-terciario uppercase tracking-wide">
                  {compensacionTipo === 'por_dia' ? 'Tarifa diaria' : compensacionTipo === 'por_hora' ? 'Tarifa por hora' : 'Sueldo'}
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-texto-primario">{fmt.moneda(compensacionMonto)}</span>
                  {compensacionTipo !== 'fijo' && (
                    <span className="text-sm text-texto-terciario">
                      Proyección: <span className="text-insignia-exito font-medium">{fmt.moneda(proyeccionMensual)}</span>/mes
                    </span>
                  )}
                </div>
              </div>

              {/* Período actual */}
              <div className="border-t border-borde-sutil pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-texto-terciario uppercase tracking-wide flex items-center gap-1.5">
                      <CalendarDays size={12} />
                      {periodoActual.etiqueta}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-texto-secundario">
                        <strong className="text-texto-primario">{statsPeriodo.trabajados}</strong> días trabajados
                      </span>
                      <span className="text-sm text-texto-secundario">
                        <strong className="text-texto-primario">{statsPeriodo.ausentes}</strong> ausencias
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-texto-terciario">A pagar</p>
                    <p className="text-xl font-bold text-insignia-exito">{fmt.moneda(montoPagar)}</p>
                    {compensacionTipo === 'por_dia' && (
                      <p className="text-xs text-texto-terciario">{fmt.moneda(compensacionMonto)} × {statsPeriodo.trabajados} días</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Tarjeta>

          {/* Documento */}
          {perfil.documento_numero ? (
            <Tarjeta compacta>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-card bg-insignia-info-fondo flex items-center justify-center">
                  <Fingerprint size={16} className="text-insignia-info-texto" />
                </div>
                <div>
                  <p className="text-xs text-texto-terciario">Documento</p>
                  <p className="text-sm font-medium text-texto-primario">{perfil.documento_numero as string}</p>
                </div>
              </div>
            </Tarjeta>
          ) : null}

          {/* Fecha nacimiento */}
          {fechaNac && (
            <Tarjeta compacta>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-card bg-insignia-rosa-fondo flex items-center justify-center">
                  <Calendar size={16} className="text-insignia-rosa-texto" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-texto-terciario">Nacimiento</p>
                  <p className="text-sm font-medium text-texto-primario">
                    {fmt.fecha(fechaNac)}
                    {edad && <span className="text-texto-terciario font-normal"> · {edad} años</span>}
                  </p>
                </div>
              </div>
            </Tarjeta>
          )}
        </div>
      </div>

      {/* Mini-resumen de actividad operativa con link al tab "Métricas" completo */}
      <ResumenMetricasMini miembroId={miembro.id} setTab={setTab} />

      {/* Resumen de permisos */}
      <Tarjeta titulo={t('usuarios.permisos')} subtitulo={`Rol base: ${ETIQUETA_ROL[rolActual]}`}
        acciones={
          <Boton variante="fantasma" tamano="xs" onClick={() => setTab('permisos')} iconoDerecho={<ChevronRight size={14} />}>
            Ver detalle
          </Boton>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {MODULOS_PREVIEW.map(mod => {
            const permisosRol = PERMISOS_POR_ROL[rolActual]?.[mod.id as Modulo]
            const tieneAcceso = rolActual === 'propietario' || rolActual === 'administrador' || !!permisosRol?.length
            return (
              <Insignia key={mod.id} color={tieneAcceso ? 'exito' : 'neutro'}>
                {mod.nombre}
              </Insignia>
            )
          })}
          <Insignia color="neutro">+{Object.keys(ACCIONES_POR_MODULO).length - MODULOS_PREVIEW.length} más</Insignia>
        </div>
      </Tarjeta>

      {/* Configuración laboral rápida */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tarjeta compacta>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-card bg-insignia-violeta-fondo flex items-center justify-center">
              <Clock size={16} className="text-insignia-violeta-texto" />
            </div>
            <div>
              <p className="text-xs text-texto-terciario">Turno</p>
              <p className="text-sm font-medium text-texto-primario">
                {miembro.horario_tipo === 'lunes_sabado' ? 'L a S' :
                 miembro.horario_tipo === 'todos' ? '7 días' :
                 miembro.horario_tipo === 'custom' ? 'Personalizado' : 'L a V'}
              </p>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta compacta>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-card bg-insignia-cyan-fondo flex items-center justify-center">
              <Fingerprint size={16} className="text-insignia-cyan-texto" />
            </div>
            <div>
              <p className="text-xs text-texto-terciario">Fichaje</p>
              <p className="text-sm font-medium text-texto-primario capitalize">
                {miembro.metodo_fichaje || 'Kiosco'}
              </p>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta compacta>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="size-9 rounded-card bg-insignia-naranja-fondo flex items-center justify-center shrink-0">
              <MapPin size={16} className="text-insignia-naranja-texto" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-texto-terciario">Ubicación</p>
              <p className="text-sm font-medium text-texto-primario truncate" title={perfil.domicilio || undefined}>
                {perfil.domicilio || 'Sin dirección'}
              </p>
            </div>
          </div>
        </Tarjeta>
      </div>

      {/* Contacto de emergencia + Documentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contacto de emergencia */}
        <Tarjeta titulo="Contacto de emergencia" compacta>
          {contactoEmergencia ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-card bg-insignia-peligro-fondo flex items-center justify-center">
                  <Heart size={16} className="text-insignia-peligro-texto" />
                </div>
                <div>
                  <p className="text-sm font-medium text-texto-primario">{contactoEmergencia.nombre as string}</p>
                  <p className="text-xs text-texto-terciario">{contactoEmergencia.relacion as string}</p>
                </div>
              </div>
              {(contactoEmergencia.telefono as string) && (
                <div className="flex items-center gap-2 text-sm text-texto-secundario pl-12">
                  <Phone size={12} className="text-texto-terciario" />
                  {contactoEmergencia.telefono as string}
                </div>
              )}
              {!!contactoEmergencia.direccion && (
                <div className="flex items-center gap-2 text-sm text-texto-secundario pl-12">
                  <MapPin size={12} className="text-texto-terciario" />
                  {typeof contactoEmergencia.direccion === 'string'
                    ? contactoEmergencia.direccion
                    : String((contactoEmergencia.direccion as Record<string, unknown>)?.textoCompleto ?? '')}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-card bg-superficie-hover flex items-center justify-center">
                <Heart size={16} className="text-texto-terciario" />
              </div>
              <p className="text-xs text-texto-terciario">Sin contacto de emergencia cargado</p>
            </div>
          )}
        </Tarjeta>

        {/* Documentos — resumen: solo frentes + botón ver todo */}
        <Tarjeta titulo="Documentos" compacta acciones={
          <Boton
            variante="fantasma"
            tamano="xs"
            iconoDerecho={<ChevronRight size={12} />}
            onClick={() => {
              setTab('informacion')
              setTimeout(() => {
                document.getElementById('seccion-documentos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 400)
            }}
          >
            Ver todo
          </Boton>
        }>
          <div className="grid grid-cols-2 gap-2">
            {[
              { tipo: 'DNI Frente', titulo: 'DNI' },
              { tipo: 'Registro Frente', titulo: 'Registro' },
            ].map(({ tipo, titulo }) => {
              const doc = documentosUsuario.find(d => (d.tipo as string) === tipo)
              const previewLocal = archivosDocLocal[tipo]
              const imgUrl = previewLocal?.url || (doc?.url as string | undefined) || null
              return (
                <div key={tipo}>
                  <p className="text-xxs text-texto-terciario/60 uppercase tracking-wide font-semibold text-center mb-1">{titulo}</p>
                  <div
                    className={`rounded-boton overflow-hidden ${imgUrl ? 'cursor-pointer hover:opacity-80' : 'bg-superficie-hover/30'}`}
                    onClick={() => imgUrl && setDocPreview({ titulo: tipo, url: imgUrl })}
                  >
                    {imgUrl ? (
                      <div className="relative w-full h-20">
                        <Image src={imgUrl} alt={tipo} fill sizes="150px" className="object-contain rounded-boton bg-superficie-hover/20" />
                      </div>
                    ) : (
                      <div className="w-full h-20 flex flex-col items-center justify-center gap-1">
                        <Upload size={14} className="text-texto-terciario/25" />
                        <span className="text-xxs text-texto-terciario/30">Sin cargar</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Tarjeta>
      </div>
    </div>
  )
}
