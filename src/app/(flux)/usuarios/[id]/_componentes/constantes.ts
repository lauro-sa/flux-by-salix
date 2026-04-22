/**
 * Constantes y helpers para la página de detalle de usuario.
 * Extraído de page.tsx para mantener el archivo principal limpio.
 */

import type { Modulo } from '@/tipos'

/* ═══════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════ */

export type TabPerfil = 'resumen' | 'informacion' | 'pagos' | 'correo' | 'permisos'

/** Tipo de período calculado */
export type Periodo = { inicio: Date; fin: Date; etiqueta: string }

/* ═══════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════ */

/** Preview de modulos principales para la tarjeta resumen */
export const MODULOS_PREVIEW = [
  { id: 'contactos', nombre: 'Contactos' },
  { id: 'actividades', nombre: 'Actividades' },
  { id: 'visitas', nombre: 'Visitas' },
  { id: 'presupuestos', nombre: 'Presupuestos' },
  { id: 'facturas', nombre: 'Facturas' },
  { id: 'inbox_whatsapp', nombre: 'WhatsApp' },
  { id: 'asistencias', nombre: 'Asistencias' },
  { id: 'ordenes_trabajo', nombre: 'Ordenes' },
]

export const ROLES_OPCIONES = [
  { valor: 'propietario', etiqueta: 'Propietario', descripcion: 'Acceso total a la empresa, configuración y usuarios' },
  { valor: 'administrador', etiqueta: 'Administrador', descripcion: 'Todo lo operacional + usuarios, sin editar empresa ni configuración' },
  { valor: 'gestor', etiqueta: 'Gestor', descripcion: 'Contactos, presupuestos, actividades, visitas, inbox y productos' },
  { valor: 'vendedor', etiqueta: 'Vendedor', descripcion: 'Solo sus propios contactos, presupuestos, actividades e inbox' },
  { valor: 'supervisor', etiqueta: 'Supervisor', descripcion: 'Ve todo pero no puede eliminar — ideal para coordinadores' },
  { valor: 'colaborador', etiqueta: 'Colaborador', descripcion: 'Ejecuta visitas, órdenes y actividades asignadas. Asistencias, nómina y calendario propios.' },
  { valor: 'invitado', etiqueta: 'Invitado', descripcion: 'Sin permisos por defecto — se asignan manualmente' },
]

export const ETIQUETA_ROL: Record<string, string> = {
  propietario: 'Propietario', administrador: 'Admin', gestor: 'Gestor',
  vendedor: 'Vendedor', supervisor: 'Supervisor', colaborador: 'Colaborador', invitado: 'Invitado',
}

export const COLOR_ROL: Record<string, 'primario' | 'violeta' | 'info' | 'naranja' | 'cyan' | 'neutro' | 'advertencia'> = {
  propietario: 'primario', administrador: 'violeta', gestor: 'info',
  vendedor: 'naranja', supervisor: 'cyan', colaborador: 'neutro', invitado: 'advertencia',
}

export const OPCIONES_COMPENSACION = [
  { valor: 'por_dia', titulo: 'Cobra por día', desc: 'Gana un monto por cada día que trabaja. El total depende de cuántos días asista.', icono: 'calendar-days' as const },
  { valor: 'fijo', titulo: 'Sueldo fijo', desc: 'Cobra un monto fijo por período completo, sin importar los días que asista.', icono: 'landmark' as const },
]

export const FRECUENCIAS_PAGO = [
  { valor: 'semanal', etiqueta: 'Semanal' },
  { valor: 'quincenal', etiqueta: 'Quincenal' },
  { valor: 'mensual', etiqueta: 'Mensual' },
  { valor: 'eventual', etiqueta: 'Eventual' },
]

export const ETIQUETA_FRECUENCIA: Record<string, string> = {
  semanal: 'semanal',
  quincenal: 'quincenal',
  mensual: 'mensual',
  eventual: 'mensual (estimado)',
}

export const DIAS_TRABAJO_OPCIONES = [
  { valor: 1, etiqueta: '1', sub: '1 día' },
  { valor: 2, etiqueta: '2', sub: '2 días' },
  { valor: 3, etiqueta: '3', sub: '3 días' },
  { valor: 4, etiqueta: '4', sub: '4 días' },
  { valor: 5, etiqueta: 'L-V', sub: 'Lunes a Viernes' },
  { valor: 6, etiqueta: 'L-S', sub: 'Lunes a Sábado' },
  { valor: 7, etiqueta: '7/7', sub: 'Todos los días' },
]

export const ESTADOS_ASISTENCIA = [
  { color: 'bg-insignia-exito/20', etiqueta: 'Presente' },
  { color: 'bg-insignia-peligro/20', etiqueta: 'Ausente' },
  { color: 'bg-insignia-advertencia/20', etiqueta: 'Tardanza' },
]

export const TIPOS_DOCUMENTOS = ['DNI Frente', 'DNI Dorso', 'Registro Frente', 'Registro Dorso']

export const OPCIONES_HORARIO = [
  { valor: 'lunes_viernes', etiqueta: 'Lunes a Viernes' },
  { valor: 'lunes_sabado', etiqueta: 'Lunes a Sábado' },
  { valor: 'todos', etiqueta: '7 días' },
  { valor: 'custom', etiqueta: 'Personalizado' },
]

export const OPCIONES_FICHAJE = [
  { valor: 'kiosco', etiqueta: 'Kiosco — ficha con llavero RFID, NFC o PIN en una terminal' },
  { valor: 'automatico', etiqueta: 'Automático — ficha al usar Flux en la PC (requiere habilitarlo en config empresa)' },
  { valor: 'manual', etiqueta: 'Manual — ficha desde la web cuando quiera' },
]

export const OPCIONES_GENERO = [
  { valor: '', etiqueta: 'No especificado' },
  { valor: 'masculino', etiqueta: 'Masculino' },
  { valor: 'femenino', etiqueta: 'Femenino' },
  { valor: 'otro', etiqueta: 'Otro' },
]

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

/** Obtiene los días del mes para el mini-calendario, respetando día de inicio */
export function obtenerDiasMes(anio: number, mes: number, diaInicioSemana: number = 1) {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)
  const diasEnMes = ultimoDia.getDate()
  const diaSemana = primerDia.getDay() // 0=domingo

  // Calcular offset según día de inicio (0=dom, 1=lun)
  const offset = (diaSemana - diaInicioSemana + 7) % 7

  const dias: (number | null)[] = []
  for (let i = 0; i < offset; i++) dias.push(null)
  for (let d = 1; d <= diasEnMes; d++) dias.push(d)

  return dias
}

/** Calcula la quincena para una fecha dada */
export function obtenerQuincena(fecha: Date, locale: string): Periodo {
  const anio = fecha.getFullYear()
  const mes = fecha.getMonth()
  const dia = fecha.getDate()
  const nombreMes = fecha.toLocaleDateString(locale, { month: 'long' })

  if (dia <= 15) {
    return {
      inicio: new Date(anio, mes, 1),
      fin: new Date(anio, mes, 15),
      etiqueta: `1ra Quincena de ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} ${anio}`,
    }
  }

  const ultimoDia = new Date(anio, mes + 1, 0).getDate()
  return {
    inicio: new Date(anio, mes, 16),
    fin: new Date(anio, mes, ultimoDia),
    etiqueta: `2da Quincena de ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} ${anio}`,
  }
}

/** Calcula el período según frecuencia y fecha de referencia */
export function obtenerPeriodo(fecha: Date, frecuencia: string, locale: string): Periodo {
  const anio = fecha.getFullYear()
  const mes = fecha.getMonth()
  const nombreMes = fecha.toLocaleDateString(locale, { month: 'long' })
  const mesCapitalizado = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)

  switch (frecuencia) {
    case 'semanal': {
      const diaSemana = fecha.getDay()
      const lunes = new Date(fecha)
      lunes.setDate(fecha.getDate() - ((diaSemana + 6) % 7))
      const domingo = new Date(lunes)
      domingo.setDate(lunes.getDate() + 6)
      const dd = (d: Date) => d.getDate()
      return {
        inicio: new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate()),
        fin: new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate()),
        etiqueta: `Semana del ${dd(lunes)} al ${dd(domingo)} de ${mesCapitalizado}`,
      }
    }
    case 'quincenal':
      return obtenerQuincena(fecha, locale)
    case 'mensual':
    case 'eventual':
    default: {
      const ultimoDia = new Date(anio, mes + 1, 0).getDate()
      return {
        inicio: new Date(anio, mes, 1),
        fin: new Date(anio, mes, ultimoDia),
        etiqueta: `${mesCapitalizado} ${anio}`,
      }
    }
  }
}

/** Navega al período anterior o siguiente */
export function navegarPeriodo(periodoActual: Periodo, direccion: 'anterior' | 'siguiente', frecuencia: string, locale: string): Periodo {
  const ref = new Date(periodoActual.inicio)

  if (frecuencia === 'semanal') {
    ref.setDate(ref.getDate() + (direccion === 'siguiente' ? 7 : -7))
  } else if (frecuencia === 'quincenal') {
    if (direccion === 'siguiente') {
      if (ref.getDate() === 1) ref.setDate(16)
      else { ref.setMonth(ref.getMonth() + 1); ref.setDate(1) }
    } else {
      if (ref.getDate() === 16) ref.setDate(1)
      else { ref.setMonth(ref.getMonth() - 1); ref.setDate(16) }
    }
  } else {
    // mensual / eventual
    ref.setMonth(ref.getMonth() + (direccion === 'siguiente' ? 1 : -1))
  }

  return obtenerPeriodo(ref, frecuencia, locale)
}

/** Días hasta el próximo cumpleaños (0 = hoy, -1 = no aplica) */
export function diasHastaCumple(fechaNac: string | null): number {
  if (!fechaNac) return -1
  const hoy = new Date()
  const nac = new Date(fechaNac + 'T12:00:00')
  if (isNaN(nac.getTime())) return -1
  const cumple = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())
  let diff = Math.floor((cumple.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)
  if (diff < 0) {
    const prox = new Date(hoy.getFullYear() + 1, nac.getMonth(), nac.getDate())
    diff = Math.floor((prox.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)
  }
  return diff
}

/** Texto descriptivo del cumpleaños */
export function textoCumple(dias: number, fechaNac: string | null, locale: string): string {
  if (dias < 0 || !fechaNac) return ''
  const nac = new Date(fechaNac + 'T12:00:00')
  const hoy = new Date()
  const edadCumple = hoy.getFullYear() - nac.getFullYear() + (dias === 0 ? 0 : (hoy.getMonth() > nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() > nac.getDate()) ? 1 : 0))
  if (dias === 0) return `¡Cumple ${edadCumple} años hoy!`
  if (dias === 1) return `Cumple ${edadCumple} años mañana`
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return `Cumple ${edadCumple} años el ${fecha.toLocaleDateString(locale, { weekday: 'long' })}`
}
