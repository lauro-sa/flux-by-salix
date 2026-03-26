/**
 * Tipos del sistema de contactos de Flux.
 * Se usa en: página de contactos, detalle, modales, vinculaciones, importación.
 */

// ─── Tipo de contacto (configurable por empresa) ───

export interface TipoContacto {
  id: string
  empresa_id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  puede_tener_hijos: boolean
  es_predefinido: boolean
  orden: number
  activo: boolean
}

/** Claves predefinidas que toda empresa tiene al crearse */
export type TipoContactoPredefinido = 'persona' | 'empresa' | 'edificio' | 'proveedor' | 'lead' | 'equipo'

// ─── Tipo de relación (configurable por empresa) ───

export interface TipoRelacion {
  id: string
  empresa_id: string
  clave: string
  etiqueta: string
  etiqueta_inversa: string
  es_predefinido: boolean
  activo: boolean
}

export type TipoRelacionPredefinido = 'empleado_de' | 'administra' | 'provee_a' | 'propietario_de' | 'inquilino_de' | 'socio_de' | 'contacto_de'

// ─── Contacto principal ───

export interface Contacto {
  id: string
  empresa_id: string
  tipo_contacto_id: string
  codigo: string

  // Identidad
  nombre: string
  apellido: string | null
  titulo: string | null

  // Contacto directo
  correo: string | null
  telefono: string | null
  whatsapp: string | null
  web: string | null

  // Laboral
  cargo: string | null
  rubro: string | null

  // Comercial
  moneda: string | null
  idioma: string | null
  zona_horaria: string | null
  limite_credito: number | null
  plazo_pago_cliente: string | null
  plazo_pago_proveedor: string | null
  rank_cliente: number | null
  rank_proveedor: number | null

  // Identificación fiscal
  tipo_identificacion: string | null
  numero_identificacion: string | null
  datos_fiscales: Record<string, unknown>

  // Etiquetas
  etiquetas: string[]

  // Notas
  notas: string | null

  // Estado
  activo: boolean
  en_papelera: boolean
  papelera_en: string | null
  es_provisorio: boolean

  // Origen
  origen: OrigenContacto

  // Vínculo con usuario (tipo equipo)
  miembro_id: string | null

  // Auditoría
  creado_por: string
  editado_por: string | null
  creado_en: string
  actualizado_en: string
}

export type OrigenContacto = 'manual' | 'importacion' | 'whatsapp' | 'api'

/** Contacto con datos relacionados (JOINs) para mostrar en UI */
export interface ContactoConRelaciones extends Contacto {
  tipo_contacto: TipoContacto
  direcciones: DireccionContacto[]
  responsables: ResponsableContacto[]
  vinculaciones: VinculacionContacto[]
  /** Nombre completo calculado */
  nombre_completo: string
}

// ─── Vinculaciones ───

export interface VinculacionContacto {
  id: string
  contacto_id: string
  vinculado_id: string
  tipo_relacion_id: string | null
  puesto: string | null
  recibe_documentos: boolean
  creado_en: string
  /** Datos del contacto vinculado (JOIN) */
  vinculado?: ContactoResumido
  /** Tipo de relación (JOIN) */
  tipo_relacion?: TipoRelacion
}

/** Resumen de contacto para mostrar en tarjetas de vinculación */
export interface ContactoResumido {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  codigo: string
  tipo_contacto: Pick<TipoContacto, 'clave' | 'etiqueta' | 'icono' | 'color'>
}

// ─── Direcciones ───

export interface DireccionContacto {
  id: string
  contacto_id: string
  tipo: TipoDireccion
  calle: string | null
  numero: string | null
  piso: string | null
  departamento: string | null
  barrio: string | null
  ciudad: string | null
  provincia: string | null
  codigo_postal: string | null
  pais: string | null
  timbre: string | null
  lat: number | null
  lng: number | null
  texto: string | null
  es_principal: boolean
}

export type TipoDireccion = 'principal' | 'fiscal' | 'entrega' | 'otra'

// ─── Responsables y seguidores ───

export interface ResponsableContacto {
  contacto_id: string
  usuario_id: string
  asignado_en: string
  /** Datos del usuario (JOIN con perfiles) */
  perfil?: {
    nombre: string
    apellido: string
    avatar_url: string | null
  }
}

export interface SeguidorContacto {
  contacto_id: string
  usuario_id: string
  modo_copia: 'CC' | 'CCO' | null
  agregado_en: string
  perfil?: {
    nombre: string
    apellido: string
    avatar_url: string | null
  }
}

// ─── Campos fiscales por país ───

export interface CampoFiscalPais {
  id: string
  pais: string
  clave: string
  etiqueta: string
  tipo_campo: 'texto' | 'select' | 'numero'
  opciones: OpcionFiscal[] | null
  obligatorio: boolean
  patron_validacion: string | null
  mascara: string | null
  orden: number
  aplica_a: string[]
  es_identificacion: boolean
}

export interface OpcionFiscal {
  valor: string
  etiqueta: string
}

// ─── Formularios ───

/** Datos para crear un contacto nuevo */
export interface CrearContactoPayload {
  tipo_contacto_id: string
  nombre: string
  apellido?: string
  titulo?: string
  correo?: string
  telefono?: string
  whatsapp?: string
  web?: string
  cargo?: string
  rubro?: string
  moneda?: string
  idioma?: string
  tipo_identificacion?: string
  numero_identificacion?: string
  datos_fiscales?: Record<string, unknown>
  etiquetas?: string[]
  notas?: string
  origen?: OrigenContacto
  /** Dirección principal al crear */
  direccion?: Omit<DireccionContacto, 'id' | 'contacto_id' | 'creado_en'>
  /** IDs de contactos a vincular al crear */
  vinculaciones?: {
    vinculado_id: string
    tipo_relacion_id?: string
    puesto?: string
    recibe_documentos?: boolean
  }[]
}

/** Datos para editar un contacto existente (parcial) */
export type EditarContactoPayload = Partial<Omit<CrearContactoPayload, 'tipo_contacto_id' | 'direccion' | 'vinculaciones'>>

// ─── Secuencias ───

export interface Secuencia {
  empresa_id: string
  entidad: string
  prefijo: string
  siguiente: number
  digitos: number
}

// ─── Filtros para la tabla de contactos ───

export interface FiltrosContacto {
  busqueda?: string
  tipo_contacto_id?: string[]
  activo?: boolean
  en_papelera?: boolean
  etiquetas?: string[]
  responsable_id?: string
  origen?: OrigenContacto[]
}
