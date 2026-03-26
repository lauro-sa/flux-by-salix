/**
 * Tipo Perfil — datos del usuario independientes de la empresa.
 * El id es FK a auth.users.id de Supabase.
 * Se usa en: header, avatar, configuración de cuenta, miembros.
 */
export interface Perfil {
  id: string
  nombre: string
  apellido: string
  avatar_url: string | null
  telefono: string | null
  creado_en: string
  actualizado_en: string

  // Contacto empresa
  correo: string | null
  correo_empresa: string | null
  telefono_empresa: string | null

  // Personal
  fecha_nacimiento: string | null
  genero: 'masculino' | 'femenino' | 'otro' | null
  documento_numero: string | null

  // Dirección
  domicilio: string | null
  direccion: Record<string, unknown> | null
}
