export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      actividades: {
        Row: {
          actualizado_en: string
          asignados: Json
          asignados_ids: string[]
          checklist: Json
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          descripcion: string | null
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          en_papelera: boolean
          estado_clave: string
          estado_id: string
          fecha_completada: string | null
          fecha_vencimiento: string | null
          id: string
          papelera_en: string | null
          prioridad: string
          seguimientos: Json | null
          tipo_clave: string
          tipo_id: string
          titulo: string
          vinculo_ids: string[]
          vinculos: Json
        }
        Insert: {
          actualizado_en?: string
          asignados?: Json
          asignados_ids?: string[]
          checklist?: Json
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          en_papelera?: boolean
          estado_clave?: string
          estado_id: string
          fecha_completada?: string | null
          fecha_vencimiento?: string | null
          id?: string
          papelera_en?: string | null
          prioridad?: string
          seguimientos?: Json | null
          tipo_clave: string
          tipo_id: string
          titulo: string
          vinculo_ids?: string[]
          vinculos?: Json
        }
        Update: {
          actualizado_en?: string
          asignados?: Json
          asignados_ids?: string[]
          checklist?: Json
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          en_papelera?: boolean
          estado_clave?: string
          estado_id?: string
          fecha_completada?: string | null
          fecha_vencimiento?: string | null
          id?: string
          papelera_en?: string | null
          prioridad?: string
          seguimientos?: Json | null
          tipo_clave?: string
          tipo_id?: string
          titulo?: string
          vinculo_ids?: string[]
          vinculos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "actividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_estado_id_fkey"
            columns: ["estado_id"]
            isOneToOne: false
            referencedRelation: "estados_actividad"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_actividad"
            referencedColumns: ["id"]
          },
        ]
      }
      adelantos_cuotas: {
        Row: {
          actualizado_en: string
          adelanto_id: string
          creado_en: string
          empresa_id: string
          estado: string
          fecha_descontada: string | null
          fecha_programada: string
          id: string
          miembro_id: string
          monto_cuota: number
          numero_cuota: number
          pago_nomina_id: string | null
          referencia_contable: string | null
        }
        Insert: {
          actualizado_en?: string
          adelanto_id: string
          creado_en?: string
          empresa_id: string
          estado?: string
          fecha_descontada?: string | null
          fecha_programada: string
          id?: string
          miembro_id: string
          monto_cuota: number
          numero_cuota: number
          pago_nomina_id?: string | null
          referencia_contable?: string | null
        }
        Update: {
          actualizado_en?: string
          adelanto_id?: string
          creado_en?: string
          empresa_id?: string
          estado?: string
          fecha_descontada?: string | null
          fecha_programada?: string
          id?: string
          miembro_id?: string
          monto_cuota?: number
          numero_cuota?: number
          pago_nomina_id?: string | null
          referencia_contable?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adelantos_cuotas_adelanto_id_fkey"
            columns: ["adelanto_id"]
            isOneToOne: false
            referencedRelation: "adelantos_nomina"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adelantos_cuotas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adelantos_cuotas_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adelantos_cuotas_pago_nomina_id_fkey"
            columns: ["pago_nomina_id"]
            isOneToOne: false
            referencedRelation: "pagos_nomina"
            referencedColumns: ["id"]
          },
        ]
      }
      adelantos_nomina: {
        Row: {
          creado_en: string
          creado_por: string
          creado_por_nombre: string
          cuotas_descontadas: number
          cuotas_totales: number
          editado_en: string | null
          editado_por: string | null
          eliminado: boolean
          eliminado_en: string | null
          eliminado_por: string | null
          empresa_id: string
          estado: string
          fecha_inicio_descuento: string
          fecha_solicitud: string
          frecuencia_descuento: string
          id: string
          miembro_id: string
          monto_total: number
          notas: string | null
          referencia_contable: string | null
          saldo_pendiente: number
        }
        Insert: {
          creado_en?: string
          creado_por: string
          creado_por_nombre: string
          cuotas_descontadas?: number
          cuotas_totales?: number
          editado_en?: string | null
          editado_por?: string | null
          eliminado?: boolean
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id: string
          estado?: string
          fecha_inicio_descuento: string
          fecha_solicitud: string
          frecuencia_descuento: string
          id?: string
          miembro_id: string
          monto_total: number
          notas?: string | null
          referencia_contable?: string | null
          saldo_pendiente: number
        }
        Update: {
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string
          cuotas_descontadas?: number
          cuotas_totales?: number
          editado_en?: string | null
          editado_por?: string | null
          eliminado?: boolean
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id?: string
          estado?: string
          fecha_inicio_descuento?: string
          fecha_solicitud?: string
          frecuencia_descuento?: string
          id?: string
          miembro_id?: string
          monto_total?: number
          notas?: string | null
          referencia_contable?: string | null
          saldo_pendiente?: number
        }
        Relationships: [
          {
            foreignKeyName: "adelantos_nomina_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adelantos_nomina_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      asignaciones_inbox: {
        Row: {
          asignado_en: string
          asignado_por: string | null
          asignado_por_nombre: string | null
          conversacion_id: string
          desasignado_en: string | null
          empresa_id: string
          id: string
          notas: string | null
          tipo: string
          usuario_id: string
          usuario_nombre: string | null
        }
        Insert: {
          asignado_en?: string
          asignado_por?: string | null
          asignado_por_nombre?: string | null
          conversacion_id: string
          desasignado_en?: string | null
          empresa_id: string
          id?: string
          notas?: string | null
          tipo?: string
          usuario_id: string
          usuario_nombre?: string | null
        }
        Update: {
          asignado_en?: string
          asignado_por?: string | null
          asignado_por_nombre?: string | null
          conversacion_id?: string
          desasignado_en?: string | null
          empresa_id?: string
          id?: string
          notas?: string | null
          tipo?: string
          usuario_id?: string
          usuario_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_inbox_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_inbox_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      asignados_orden_trabajo: {
        Row: {
          creado_en: string
          empresa_id: string
          es_cabecilla: boolean
          id: string
          orden_trabajo_id: string
          usuario_id: string
          usuario_nombre: string
        }
        Insert: {
          creado_en?: string
          empresa_id: string
          es_cabecilla?: boolean
          id?: string
          orden_trabajo_id: string
          usuario_id: string
          usuario_nombre: string
        }
        Update: {
          creado_en?: string
          empresa_id?: string
          es_cabecilla?: boolean
          id?: string
          orden_trabajo_id?: string
          usuario_id?: string
          usuario_nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignados_orden_trabajo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignados_orden_trabajo_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
        ]
      }
      asistencias: {
        Row: {
          actualizado_en: string
          cierre_automatico: boolean
          creado_en: string
          creado_por: string | null
          editado_por: string | null
          empresa_id: string
          estado: string
          fecha: string
          fin_almuerzo: string | null
          foto_entrada: string | null
          foto_salida: string | null
          hora_entrada: string | null
          hora_salida: string | null
          id: string
          inicio_almuerzo: string | null
          metodo_registro: string
          metodo_salida: string | null
          miembro_id: string
          notas: string | null
          puntualidad_min: number | null
          salida_particular: string | null
          solicitud_id: string | null
          terminal_id: string | null
          terminal_nombre: string | null
          tipo: string
          turno_id: string | null
          ubicacion_entrada: Json | null
          ubicacion_salida: Json | null
          vuelta_particular: string | null
        }
        Insert: {
          actualizado_en?: string
          cierre_automatico?: boolean
          creado_en?: string
          creado_por?: string | null
          editado_por?: string | null
          empresa_id: string
          estado?: string
          fecha: string
          fin_almuerzo?: string | null
          foto_entrada?: string | null
          foto_salida?: string | null
          hora_entrada?: string | null
          hora_salida?: string | null
          id?: string
          inicio_almuerzo?: string | null
          metodo_registro?: string
          metodo_salida?: string | null
          miembro_id: string
          notas?: string | null
          puntualidad_min?: number | null
          salida_particular?: string | null
          solicitud_id?: string | null
          terminal_id?: string | null
          terminal_nombre?: string | null
          tipo?: string
          turno_id?: string | null
          ubicacion_entrada?: Json | null
          ubicacion_salida?: Json | null
          vuelta_particular?: string | null
        }
        Update: {
          actualizado_en?: string
          cierre_automatico?: boolean
          creado_en?: string
          creado_por?: string | null
          editado_por?: string | null
          empresa_id?: string
          estado?: string
          fecha?: string
          fin_almuerzo?: string | null
          foto_entrada?: string | null
          foto_salida?: string | null
          hora_entrada?: string | null
          hora_salida?: string | null
          id?: string
          inicio_almuerzo?: string | null
          metodo_registro?: string
          metodo_salida?: string | null
          miembro_id?: string
          notas?: string | null
          puntualidad_min?: number | null
          salida_particular?: string | null
          solicitud_id?: string | null
          terminal_id?: string | null
          terminal_nombre?: string | null
          tipo?: string
          turno_id?: string | null
          ubicacion_entrada?: Json | null
          ubicacion_salida?: Json | null
          vuelta_particular?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asistencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencias_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_actividades: {
        Row: {
          actividad_id: string
          campo_modificado: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          actividad_id: string
          campo_modificado: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          actividad_id?: string
          campo_modificado?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_actividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_asistencias: {
        Row: {
          asistencia_id: string
          campo_modificado: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          asistencia_id: string
          campo_modificado: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          asistencia_id?: string
          campo_modificado?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_asistencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_contacto_telefonos: {
        Row: {
          campo_modificado: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          telefono_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_modificado: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          telefono_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_modificado?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          telefono_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_contacto_telefonos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_contactos: {
        Row: {
          campo_modificado: string
          contacto_id: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_modificado: string
          contacto_id: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_modificado?: string
          contacto_id?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_contactos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_plantillas_correo: {
        Row: {
          campo_modificado: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          plantilla_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_modificado: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          plantilla_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_modificado?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          plantilla_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_plantillas_correo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_plantillas_whatsapp: {
        Row: {
          campo_modificado: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          plantilla_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_modificado: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          plantilla_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_modificado?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          plantilla_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_plantillas_whatsapp_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_presupuestos: {
        Row: {
          campo_modificado: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          presupuesto_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_modificado: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          presupuesto_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_modificado?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          presupuesto_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_presupuestos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_productos: {
        Row: {
          campo_modificado: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          producto_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_modificado: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          producto_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_modificado?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          producto_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_productos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_respuestas_rapidas_correo: {
        Row: {
          campo_modificado: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          plantilla_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_modificado: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          plantilla_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_modificado?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          plantilla_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_plantillas_respuesta_correo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_respuestas_rapidas_whatsapp: {
        Row: {
          campo_modificado: string
          creado_en: string
          editado_por: string
          empresa_id: string
          id: string
          motivo: string | null
          plantilla_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_modificado: string
          creado_en?: string
          editado_por: string
          empresa_id: string
          id?: string
          motivo?: string | null
          plantilla_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_modificado?: string
          creado_en?: string
          editado_por?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          plantilla_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_plantillas_respuesta_whatsapp_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      bancos: {
        Row: {
          creado_en: string
          empresa_id: string
          id: string
          nombre: string
        }
        Insert: {
          creado_en?: string
          empresa_id: string
          id?: string
          nombre: string
        }
        Update: {
          creado_en?: string
          empresa_id?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "bancos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      base_conocimiento_ia: {
        Row: {
          activo: boolean | null
          actualizado_en: string | null
          categoria: string | null
          contenido: string
          creado_en: string | null
          embedding: string | null
          empresa_id: string
          etiquetas: string[] | null
          id: string
          titulo: string
        }
        Insert: {
          activo?: boolean | null
          actualizado_en?: string | null
          categoria?: string | null
          contenido: string
          creado_en?: string | null
          embedding?: string | null
          empresa_id: string
          etiquetas?: string[] | null
          id?: string
          titulo: string
        }
        Update: {
          activo?: boolean | null
          actualizado_en?: string | null
          categoria?: string | null
          contenido?: string
          creado_en?: string | null
          embedding?: string | null
          empresa_id?: string
          etiquetas?: string[] | null
          id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_conocimiento_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      campos_fiscales_pais: {
        Row: {
          aplica_a: string[]
          clave: string
          es_identificacion: boolean
          etiqueta: string
          id: string
          mascara: string | null
          obligatorio: boolean
          opciones: Json | null
          orden: number
          pais: string
          patron_validacion: string | null
          tipo_campo: string
        }
        Insert: {
          aplica_a?: string[]
          clave: string
          es_identificacion?: boolean
          etiqueta: string
          id?: string
          mascara?: string | null
          obligatorio?: boolean
          opciones?: Json | null
          orden?: number
          pais: string
          patron_validacion?: string | null
          tipo_campo?: string
        }
        Update: {
          aplica_a?: string[]
          clave?: string
          es_identificacion?: boolean
          etiqueta?: string
          id?: string
          mascara?: string | null
          obligatorio?: boolean
          opciones?: Json | null
          orden?: number
          pais?: string
          patron_validacion?: string | null
          tipo_campo?: string
        }
        Relationships: []
      }
      canal_agentes: {
        Row: {
          asignado_en: string
          canal_id: string
          rol_canal: string
          usuario_id: string
        }
        Insert: {
          asignado_en?: string
          canal_id: string
          rol_canal?: string
          usuario_id: string
        }
        Update: {
          asignado_en?: string
          canal_id?: string
          rol_canal?: string
          usuario_id?: string
        }
        Relationships: []
      }
      canal_interno_miembros: {
        Row: {
          canal_id: string
          rol: string
          silenciado: boolean
          ultimo_leido_en: string | null
          unido_en: string
          usuario_id: string
        }
        Insert: {
          canal_id: string
          rol?: string
          silenciado?: boolean
          ultimo_leido_en?: string | null
          unido_en?: string
          usuario_id: string
        }
        Update: {
          canal_id?: string
          rol?: string
          silenciado?: boolean
          ultimo_leido_en?: string | null
          unido_en?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canal_interno_miembros_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      canales_correo: {
        Row: {
          activo: boolean
          actualizado_en: string
          config_conexion: Json
          creado_en: string
          creado_por: string
          empresa_id: string
          es_principal: boolean
          estado_conexion: string
          id: string
          modulos_disponibles: string[]
          nombre: string
          propietario_usuario_id: string | null
          proveedor: string | null
          sync_cursor: Json | null
          ultima_sincronizacion: string | null
          ultimo_error: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          config_conexion?: Json
          creado_en?: string
          creado_por: string
          empresa_id: string
          es_principal?: boolean
          estado_conexion?: string
          id?: string
          modulos_disponibles?: string[]
          nombre: string
          propietario_usuario_id?: string | null
          proveedor?: string | null
          sync_cursor?: Json | null
          ultima_sincronizacion?: string | null
          ultimo_error?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          config_conexion?: Json
          creado_en?: string
          creado_por?: string
          empresa_id?: string
          es_principal?: boolean
          estado_conexion?: string
          id?: string
          modulos_disponibles?: string[]
          nombre?: string
          propietario_usuario_id?: string | null
          proveedor?: string | null
          sync_cursor?: Json | null
          ultima_sincronizacion?: string | null
          ultimo_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canales_correo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      canales_internos: {
        Row: {
          actualizado_en: string
          archivado: boolean
          color: string | null
          creado_en: string
          creado_por: string
          descripcion: string | null
          empresa_id: string
          icono: string | null
          id: string
          nombre: string
          participantes_dm: string[] | null
          tipo: string
          ultimo_mensaje_en: string | null
          ultimo_mensaje_por: string | null
          ultimo_mensaje_texto: string | null
        }
        Insert: {
          actualizado_en?: string
          archivado?: boolean
          color?: string | null
          creado_en?: string
          creado_por: string
          descripcion?: string | null
          empresa_id: string
          icono?: string | null
          id?: string
          nombre: string
          participantes_dm?: string[] | null
          tipo?: string
          ultimo_mensaje_en?: string | null
          ultimo_mensaje_por?: string | null
          ultimo_mensaje_texto?: string | null
        }
        Update: {
          actualizado_en?: string
          archivado?: boolean
          color?: string | null
          creado_en?: string
          creado_por?: string
          descripcion?: string | null
          empresa_id?: string
          icono?: string | null
          id?: string
          nombre?: string
          participantes_dm?: string[] | null
          tipo?: string
          ultimo_mensaje_en?: string | null
          ultimo_mensaje_por?: string | null
          ultimo_mensaje_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canales_internos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      canales_whatsapp: {
        Row: {
          activo: boolean
          actualizado_en: string
          config_conexion: Json
          creado_en: string
          creado_por: string
          empresa_id: string
          es_principal: boolean
          estado_conexion: string
          id: string
          modulos_disponibles: string[]
          nombre: string
          proveedor: string | null
          sync_cursor: Json | null
          ultima_sincronizacion: string | null
          ultimo_error: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          config_conexion?: Json
          creado_en?: string
          creado_por: string
          empresa_id: string
          es_principal?: boolean
          estado_conexion?: string
          id?: string
          modulos_disponibles?: string[]
          nombre: string
          proveedor?: string | null
          sync_cursor?: Json | null
          ultima_sincronizacion?: string | null
          ultimo_error?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          config_conexion?: Json
          creado_en?: string
          creado_por?: string
          empresa_id?: string
          es_principal?: boolean
          estado_conexion?: string
          id?: string
          modulos_disponibles?: string[]
          nombre?: string
          proveedor?: string | null
          sync_cursor?: Json | null
          ultima_sincronizacion?: string | null
          ultimo_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canales_whatsapp_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cargas_credito_ia: {
        Row: {
          creado_en: string
          empresa_id: string
          id: string
          monto: number
          nota: string | null
          proveedor: string
          tipo: string
        }
        Insert: {
          creado_en?: string
          empresa_id: string
          id?: string
          monto?: number
          nota?: string | null
          proveedor?: string
          tipo?: string
        }
        Update: {
          creado_en?: string
          empresa_id?: string
          id?: string
          monto?: number
          nota?: string | null
          proveedor?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargas_credito_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_modulos: {
        Row: {
          categoria: string
          creado_en: string
          descripcion: string
          destacado: boolean
          es_base: boolean
          features: Json
          icono: string
          id: string
          nombre: string
          orden: number
          precio_anual_usd: number | null
          precio_mensual_usd: number | null
          requiere: string[]
          slug: string
          tier: string
          version: string
          visible: boolean
        }
        Insert: {
          categoria?: string
          creado_en?: string
          descripcion?: string
          destacado?: boolean
          es_base?: boolean
          features?: Json
          icono?: string
          id?: string
          nombre: string
          orden?: number
          precio_anual_usd?: number | null
          precio_mensual_usd?: number | null
          requiere?: string[]
          slug: string
          tier?: string
          version?: string
          visible?: boolean
        }
        Update: {
          categoria?: string
          creado_en?: string
          descripcion?: string
          destacado?: boolean
          es_base?: boolean
          features?: Json
          icono?: string
          id?: string
          nombre?: string
          orden?: number
          precio_anual_usd?: number | null
          precio_mensual_usd?: number | null
          requiere?: string[]
          slug?: string
          tier?: string
          version?: string
          visible?: boolean
        }
        Relationships: []
      }
      chatter: {
        Row: {
          adjuntos: Json
          autor_avatar_url: string | null
          autor_id: string | null
          autor_nombre: string
          contenido: string
          creado_en: string
          editado_en: string | null
          empresa_id: string
          entidad_id: string
          entidad_tipo: string
          id: string
          metadata: Json
          tipo: string
        }
        Insert: {
          adjuntos?: Json
          autor_avatar_url?: string | null
          autor_id?: string | null
          autor_nombre: string
          contenido: string
          creado_en?: string
          editado_en?: string | null
          empresa_id: string
          entidad_id: string
          entidad_tipo: string
          id?: string
          metadata?: Json
          tipo?: string
        }
        Update: {
          adjuntos?: Json
          autor_avatar_url?: string | null
          autor_id?: string | null
          autor_nombre?: string
          contenido?: string
          creado_en?: string
          editado_en?: string | null
          empresa_id?: string
          entidad_id?: string
          entidad_tipo?: string
          id?: string
          metadata?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatter_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_actividades: {
        Row: {
          actualizado_en: string
          empresa_id: string
          presets_posposicion: Json
          respetar_dias_laborales: boolean
        }
        Insert: {
          actualizado_en?: string
          empresa_id: string
          presets_posposicion?: Json
          respetar_dias_laborales?: boolean
        }
        Update: {
          actualizado_en?: string
          empresa_id?: string
          presets_posposicion?: Json
          respetar_dias_laborales?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "config_actividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_agente_ia: {
        Row: {
          acciones_habilitadas: Json | null
          activo: boolean | null
          actualizado_en: string | null
          apodo: string | null
          canales_activos: string[] | null
          correo_empresa: string | null
          creado_en: string | null
          delay_segundos: number | null
          ejemplos_conversacion: Json | null
          empresa_id: string
          escalar_palabras: string[] | null
          escalar_si_negativo: boolean | null
          escalar_si_no_sabe: boolean | null
          firmar_como: string | null
          flujo_conversacion: Json | null
          horario_atencion: string | null
          id: string
          idioma: string | null
          info_precios: string | null
          instrucciones: string | null
          largo_respuesta: string | null
          max_mensajes_auto: number | null
          mensaje_escalamiento: string | null
          modo_activacion: string | null
          modo_respuesta: string | null
          nombre: string | null
          personalidad: string | null
          puede_actualizar_contacto: boolean | null
          puede_clasificar: boolean | null
          puede_crear_actividad: boolean | null
          puede_enrutar: boolean | null
          puede_etiquetar: boolean | null
          puede_responder: boolean | null
          puede_resumir: boolean | null
          puede_sentimiento: boolean | null
          reglas_agenda: string | null
          respuesta_si_bot: string | null
          servicios_no: string | null
          servicios_si: string | null
          sitio_web: string | null
          situaciones_especiales: string | null
          tipos_contacto: Json | null
          tono: string | null
          total_conversaciones_analizadas: number | null
          total_escalamientos: number | null
          total_mensajes_enviados: number | null
          ultimo_analisis_conversaciones: string | null
          usar_base_conocimiento: boolean | null
          vocabulario_natural: string | null
          zona_cobertura: string | null
        }
        Insert: {
          acciones_habilitadas?: Json | null
          activo?: boolean | null
          actualizado_en?: string | null
          apodo?: string | null
          canales_activos?: string[] | null
          correo_empresa?: string | null
          creado_en?: string | null
          delay_segundos?: number | null
          ejemplos_conversacion?: Json | null
          empresa_id: string
          escalar_palabras?: string[] | null
          escalar_si_negativo?: boolean | null
          escalar_si_no_sabe?: boolean | null
          firmar_como?: string | null
          flujo_conversacion?: Json | null
          horario_atencion?: string | null
          id?: string
          idioma?: string | null
          info_precios?: string | null
          instrucciones?: string | null
          largo_respuesta?: string | null
          max_mensajes_auto?: number | null
          mensaje_escalamiento?: string | null
          modo_activacion?: string | null
          modo_respuesta?: string | null
          nombre?: string | null
          personalidad?: string | null
          puede_actualizar_contacto?: boolean | null
          puede_clasificar?: boolean | null
          puede_crear_actividad?: boolean | null
          puede_enrutar?: boolean | null
          puede_etiquetar?: boolean | null
          puede_responder?: boolean | null
          puede_resumir?: boolean | null
          puede_sentimiento?: boolean | null
          reglas_agenda?: string | null
          respuesta_si_bot?: string | null
          servicios_no?: string | null
          servicios_si?: string | null
          sitio_web?: string | null
          situaciones_especiales?: string | null
          tipos_contacto?: Json | null
          tono?: string | null
          total_conversaciones_analizadas?: number | null
          total_escalamientos?: number | null
          total_mensajes_enviados?: number | null
          ultimo_analisis_conversaciones?: string | null
          usar_base_conocimiento?: boolean | null
          vocabulario_natural?: string | null
          zona_cobertura?: string | null
        }
        Update: {
          acciones_habilitadas?: Json | null
          activo?: boolean | null
          actualizado_en?: string | null
          apodo?: string | null
          canales_activos?: string[] | null
          correo_empresa?: string | null
          creado_en?: string | null
          delay_segundos?: number | null
          ejemplos_conversacion?: Json | null
          empresa_id?: string
          escalar_palabras?: string[] | null
          escalar_si_negativo?: boolean | null
          escalar_si_no_sabe?: boolean | null
          firmar_como?: string | null
          flujo_conversacion?: Json | null
          horario_atencion?: string | null
          id?: string
          idioma?: string | null
          info_precios?: string | null
          instrucciones?: string | null
          largo_respuesta?: string | null
          max_mensajes_auto?: number | null
          mensaje_escalamiento?: string | null
          modo_activacion?: string | null
          modo_respuesta?: string | null
          nombre?: string | null
          personalidad?: string | null
          puede_actualizar_contacto?: boolean | null
          puede_clasificar?: boolean | null
          puede_crear_actividad?: boolean | null
          puede_enrutar?: boolean | null
          puede_etiquetar?: boolean | null
          puede_responder?: boolean | null
          puede_resumir?: boolean | null
          puede_sentimiento?: boolean | null
          reglas_agenda?: string | null
          respuesta_si_bot?: string | null
          servicios_no?: string | null
          servicios_si?: string | null
          sitio_web?: string | null
          situaciones_especiales?: string | null
          tipos_contacto?: Json | null
          tono?: string | null
          total_conversaciones_analizadas?: number | null
          total_escalamientos?: number | null
          total_mensajes_enviados?: number | null
          ultimo_analisis_conversaciones?: string | null
          usar_base_conocimiento?: boolean | null
          vocabulario_natural?: string | null
          zona_cobertura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_agente_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_asistencias: {
        Row: {
          actualizado_en: string
          auto_checkout_habilitado: boolean
          auto_checkout_max_horas: number
          creado_en: string
          descontar_almuerzo: boolean
          duracion_almuerzo_min: number
          empresa_id: string
          fichaje_auto_habilitado: boolean
          fichaje_auto_notif_min: number
          fichaje_auto_umbral_salida: number
          horas_maximas_diarias: number
          horas_minimas_diarias: number
          id: string
          kiosco_capturar_foto: boolean
          kiosco_habilitado: boolean
          kiosco_metodo_lectura: string
          kiosco_modo_empresa: string
          kiosco_pin_admin: string | null
          modo_pago_parcial: string
          umbral_jornada_completa_pct: number
          umbral_media_jornada_pct: number
        }
        Insert: {
          actualizado_en?: string
          auto_checkout_habilitado?: boolean
          auto_checkout_max_horas?: number
          creado_en?: string
          descontar_almuerzo?: boolean
          duracion_almuerzo_min?: number
          empresa_id: string
          fichaje_auto_habilitado?: boolean
          fichaje_auto_notif_min?: number
          fichaje_auto_umbral_salida?: number
          horas_maximas_diarias?: number
          horas_minimas_diarias?: number
          id?: string
          kiosco_capturar_foto?: boolean
          kiosco_habilitado?: boolean
          kiosco_metodo_lectura?: string
          kiosco_modo_empresa?: string
          kiosco_pin_admin?: string | null
          modo_pago_parcial?: string
          umbral_jornada_completa_pct?: number
          umbral_media_jornada_pct?: number
        }
        Update: {
          actualizado_en?: string
          auto_checkout_habilitado?: boolean
          auto_checkout_max_horas?: number
          creado_en?: string
          descontar_almuerzo?: boolean
          duracion_almuerzo_min?: number
          empresa_id?: string
          fichaje_auto_habilitado?: boolean
          fichaje_auto_notif_min?: number
          fichaje_auto_umbral_salida?: number
          horas_maximas_diarias?: number
          horas_minimas_diarias?: number
          id?: string
          kiosco_capturar_foto?: boolean
          kiosco_habilitado?: boolean
          kiosco_metodo_lectura?: string
          kiosco_modo_empresa?: string
          kiosco_pin_admin?: string | null
          modo_pago_parcial?: string
          umbral_jornada_completa_pct?: number
          umbral_media_jornada_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "config_asistencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_calendario: {
        Row: {
          actualizado_en: string
          dias_laborales: number[]
          empresa_id: string
          hora_fin_laboral: string
          hora_inicio_laboral: string
          intervalo_slot: number
          mostrar_fines_semana: boolean
          vista_default: string
        }
        Insert: {
          actualizado_en?: string
          dias_laborales?: number[]
          empresa_id: string
          hora_fin_laboral?: string
          hora_inicio_laboral?: string
          intervalo_slot?: number
          mostrar_fines_semana?: boolean
          vista_default?: string
        }
        Update: {
          actualizado_en?: string
          dias_laborales?: number[]
          empresa_id?: string
          hora_fin_laboral?: string
          hora_inicio_laboral?: string
          intervalo_slot?: number
          mostrar_fines_semana?: boolean
          vista_default?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_calendario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_chatbot: {
        Row: {
          activo: boolean
          actualizado_en: string
          bienvenida_activa: boolean
          bienvenida_dias_sin_contacto: number
          bienvenida_frecuencia: string
          creado_en: string
          empresa_id: string
          mensaje_bienvenida: string
          mensaje_defecto: string | null
          mensaje_menu: string | null
          mensaje_transferencia: string | null
          menu_activo: boolean
          menu_tipo: string
          menu_titulo_lista: string | null
          modo: string
          opciones_menu: Json
          palabra_transferir: string | null
          palabras_clave: Json
          saltar_chatbot_patrones: string[]
          variables_disponibles: Json
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          bienvenida_activa?: boolean
          bienvenida_dias_sin_contacto?: number
          bienvenida_frecuencia?: string
          creado_en?: string
          empresa_id: string
          mensaje_bienvenida?: string
          mensaje_defecto?: string | null
          mensaje_menu?: string | null
          mensaje_transferencia?: string | null
          menu_activo?: boolean
          menu_tipo?: string
          menu_titulo_lista?: string | null
          modo?: string
          opciones_menu?: Json
          palabra_transferir?: string | null
          palabras_clave?: Json
          saltar_chatbot_patrones?: string[]
          variables_disponibles?: Json
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          bienvenida_activa?: boolean
          bienvenida_dias_sin_contacto?: number
          bienvenida_frecuencia?: string
          creado_en?: string
          empresa_id?: string
          mensaje_bienvenida?: string
          mensaje_defecto?: string | null
          mensaje_menu?: string | null
          mensaje_transferencia?: string | null
          menu_activo?: boolean
          menu_tipo?: string
          menu_titulo_lista?: string | null
          modo?: string
          opciones_menu?: Json
          palabra_transferir?: string | null
          palabras_clave?: Json
          saltar_chatbot_patrones?: string[]
          variables_disponibles?: Json
        }
        Relationships: [
          {
            foreignKeyName: "config_chatbot_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_correo: {
        Row: {
          actualizado_en: string
          algoritmo_asignacion: string
          asignacion_automatica: boolean
          correo_lista_bloqueados: string[] | null
          correo_lista_permitidos: string[] | null
          empresa_id: string
          horario_atencion: Json | null
          mensaje_fuera_horario: string | null
          notificar_asignacion: boolean
          notificar_nuevo_mensaje: boolean
          notificar_sla_vencido: boolean
          respuesta_fuera_horario: boolean
          sla_primera_respuesta_minutos: number | null
          sla_resolucion_horas: number | null
          sonido_notificacion: boolean
          zona_horaria: string | null
        }
        Insert: {
          actualizado_en?: string
          algoritmo_asignacion?: string
          asignacion_automatica?: boolean
          correo_lista_bloqueados?: string[] | null
          correo_lista_permitidos?: string[] | null
          empresa_id: string
          horario_atencion?: Json | null
          mensaje_fuera_horario?: string | null
          notificar_asignacion?: boolean
          notificar_nuevo_mensaje?: boolean
          notificar_sla_vencido?: boolean
          respuesta_fuera_horario?: boolean
          sla_primera_respuesta_minutos?: number | null
          sla_resolucion_horas?: number | null
          sonido_notificacion?: boolean
          zona_horaria?: string | null
        }
        Update: {
          actualizado_en?: string
          algoritmo_asignacion?: string
          asignacion_automatica?: boolean
          correo_lista_bloqueados?: string[] | null
          correo_lista_permitidos?: string[] | null
          empresa_id?: string
          horario_atencion?: Json | null
          mensaje_fuera_horario?: string | null
          notificar_asignacion?: boolean
          notificar_nuevo_mensaje?: boolean
          notificar_sla_vencido?: boolean
          respuesta_fuera_horario?: boolean
          sla_primera_respuesta_minutos?: number | null
          sla_resolucion_horas?: number | null
          sonido_notificacion?: boolean
          zona_horaria?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_correo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_ia: {
        Row: {
          actualizado_en: string
          api_key_anthropic: string | null
          api_key_google: string | null
          api_key_openai: string | null
          api_key_xai: string | null
          creado_en: string
          empresa_id: string
          habilitado: boolean
          id: string
          max_tokens: number
          modelo_anthropic: string
          modelo_google: string
          modelo_openai: string
          modelo_xai: string
          modulos_accesibles: string[]
          prompt_asistente: string | null
          prompt_asistente_presupuestos: string | null
          proveedor_defecto: string
          temperatura: number
        }
        Insert: {
          actualizado_en?: string
          api_key_anthropic?: string | null
          api_key_google?: string | null
          api_key_openai?: string | null
          api_key_xai?: string | null
          creado_en?: string
          empresa_id: string
          habilitado?: boolean
          id?: string
          max_tokens?: number
          modelo_anthropic?: string
          modelo_google?: string
          modelo_openai?: string
          modelo_xai?: string
          modulos_accesibles?: string[]
          prompt_asistente?: string | null
          prompt_asistente_presupuestos?: string | null
          proveedor_defecto?: string
          temperatura?: number
        }
        Update: {
          actualizado_en?: string
          api_key_anthropic?: string | null
          api_key_google?: string | null
          api_key_openai?: string | null
          api_key_xai?: string | null
          creado_en?: string
          empresa_id?: string
          habilitado?: boolean
          id?: string
          max_tokens?: number
          modelo_anthropic?: string
          modelo_google?: string
          modelo_openai?: string
          modelo_xai?: string
          modulos_accesibles?: string[]
          prompt_asistente?: string | null
          prompt_asistente_presupuestos?: string | null
          proveedor_defecto?: string
          temperatura?: number
        }
        Relationships: [
          {
            foreignKeyName: "config_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_ia_empresa: {
        Row: {
          actualizado_en: string
          api_key_cifrada: string | null
          empresa_id: string
          habilitada: boolean
          modelo: string | null
          proveedor: string | null
        }
        Insert: {
          actualizado_en?: string
          api_key_cifrada?: string | null
          empresa_id: string
          habilitada?: boolean
          modelo?: string | null
          proveedor?: string | null
        }
        Update: {
          actualizado_en?: string
          api_key_cifrada?: string | null
          empresa_id?: string
          habilitada?: boolean
          modelo?: string | null
          proveedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_ia_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_presupuestos: {
        Row: {
          actualizado_en: string
          columnas_lineas_default: Json | null
          condiciones_pago: Json
          condiciones_predeterminadas: string | null
          datos_empresa_pdf: Json | null
          dias_vencimiento_predeterminado: number
          empresa_id: string
          impuestos: Json
          membrete: Json | null
          moneda_predeterminada: string
          monedas: Json
          notas_predeterminadas: string | null
          patron_nombre_pdf: string | null
          pie_pagina: Json | null
          plantilla_html: string | null
          plantillas: Json
          plantillas_predeterminadas: Json
          unidades: Json
        }
        Insert: {
          actualizado_en?: string
          columnas_lineas_default?: Json | null
          condiciones_pago?: Json
          condiciones_predeterminadas?: string | null
          datos_empresa_pdf?: Json | null
          dias_vencimiento_predeterminado?: number
          empresa_id: string
          impuestos?: Json
          membrete?: Json | null
          moneda_predeterminada?: string
          monedas?: Json
          notas_predeterminadas?: string | null
          patron_nombre_pdf?: string | null
          pie_pagina?: Json | null
          plantilla_html?: string | null
          plantillas?: Json
          plantillas_predeterminadas?: Json
          unidades?: Json
        }
        Update: {
          actualizado_en?: string
          columnas_lineas_default?: Json | null
          condiciones_pago?: Json
          condiciones_predeterminadas?: string | null
          datos_empresa_pdf?: Json | null
          dias_vencimiento_predeterminado?: number
          empresa_id?: string
          impuestos?: Json
          membrete?: Json | null
          moneda_predeterminada?: string
          monedas?: Json
          notas_predeterminadas?: string | null
          patron_nombre_pdf?: string | null
          pie_pagina?: Json | null
          plantilla_html?: string | null
          plantillas?: Json
          plantillas_predeterminadas?: Json
          unidades?: Json
        }
        Relationships: [
          {
            foreignKeyName: "config_presupuestos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_productos: {
        Row: {
          actualizado_en: string
          categorias: Json
          categorias_costo: Json
          empresa_id: string
          prefijos: Json
          unidades: Json
        }
        Insert: {
          actualizado_en?: string
          categorias?: Json
          categorias_costo?: Json
          empresa_id: string
          prefijos?: Json
          unidades?: Json
        }
        Update: {
          actualizado_en?: string
          categorias?: Json
          categorias_costo?: Json
          empresa_id?: string
          prefijos?: Json
          unidades?: Json
        }
        Relationships: [
          {
            foreignKeyName: "config_productos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_salix_ia: {
        Row: {
          actualizado_en: string
          creado_en: string
          empresa_id: string
          habilitado: boolean
          herramientas_habilitadas: string[]
          max_iteraciones_herramientas: number
          nombre: string
          personalidad: string | null
          whatsapp_copilot_habilitado: boolean
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          empresa_id: string
          habilitado?: boolean
          herramientas_habilitadas?: string[]
          max_iteraciones_herramientas?: number
          nombre?: string
          personalidad?: string | null
          whatsapp_copilot_habilitado?: boolean
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          empresa_id?: string
          habilitado?: boolean
          herramientas_habilitadas?: string[]
          max_iteraciones_herramientas?: number
          nombre?: string
          personalidad?: string | null
          whatsapp_copilot_habilitado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "config_salix_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_visitas: {
        Row: {
          actualizado_en: string
          checklist_predeterminado: Json
          creado_en: string
          distancia_maxima_m: number
          duracion_estimada_default: number
          empresa_id: string
          enviar_avisos_whatsapp: boolean
          id: string
          motivos_predefinidos: Json
          requiere_geolocalizacion: boolean
          resultados_predefinidos: Json
        }
        Insert: {
          actualizado_en?: string
          checklist_predeterminado?: Json
          creado_en?: string
          distancia_maxima_m?: number
          duracion_estimada_default?: number
          empresa_id: string
          enviar_avisos_whatsapp?: boolean
          id?: string
          motivos_predefinidos?: Json
          requiere_geolocalizacion?: boolean
          resultados_predefinidos?: Json
        }
        Update: {
          actualizado_en?: string
          checklist_predeterminado?: Json
          creado_en?: string
          distancia_maxima_m?: number
          duracion_estimada_default?: number
          empresa_id?: string
          enviar_avisos_whatsapp?: boolean
          id?: string
          motivos_predefinidos?: Json
          requiere_geolocalizacion?: boolean
          resultados_predefinidos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "config_visitas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_whatsapp: {
        Row: {
          actualizado_en: string
          algoritmo_asignacion: string
          asignacion_automatica: boolean
          empresa_id: string
          horario_atencion: Json | null
          mensaje_fuera_horario: string | null
          notificar_asignacion: boolean
          notificar_nuevo_mensaje: boolean
          notificar_sla_vencido: boolean
          pausa_agente_ia_minutos: number | null
          pausa_agente_ia_modo: string
          pausa_chatbot_minutos: number | null
          pausa_chatbot_modo: string
          respuesta_fuera_horario: boolean
          sla_primera_respuesta_minutos: number | null
          sla_resolucion_horas: number | null
          sonido_notificacion: boolean
          zona_horaria: string | null
        }
        Insert: {
          actualizado_en?: string
          algoritmo_asignacion?: string
          asignacion_automatica?: boolean
          empresa_id: string
          horario_atencion?: Json | null
          mensaje_fuera_horario?: string | null
          notificar_asignacion?: boolean
          notificar_nuevo_mensaje?: boolean
          notificar_sla_vencido?: boolean
          pausa_agente_ia_minutos?: number | null
          pausa_agente_ia_modo?: string
          pausa_chatbot_minutos?: number | null
          pausa_chatbot_modo?: string
          respuesta_fuera_horario?: boolean
          sla_primera_respuesta_minutos?: number | null
          sla_resolucion_horas?: number | null
          sonido_notificacion?: boolean
          zona_horaria?: string | null
        }
        Update: {
          actualizado_en?: string
          algoritmo_asignacion?: string
          asignacion_automatica?: boolean
          empresa_id?: string
          horario_atencion?: Json | null
          mensaje_fuera_horario?: string | null
          notificar_asignacion?: boolean
          notificar_nuevo_mensaje?: boolean
          notificar_sla_vencido?: boolean
          pausa_agente_ia_minutos?: number | null
          pausa_agente_ia_modo?: string
          pausa_chatbot_minutos?: number | null
          pausa_chatbot_modo?: string
          respuesta_fuera_horario?: boolean
          sla_primera_respuesta_minutos?: number | null
          sla_resolucion_horas?: number | null
          sonido_notificacion?: boolean
          zona_horaria?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_whatsapp_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_google_drive: {
        Row: {
          access_token: string | null
          actualizado_en: string
          conectado: boolean
          conectado_por: string | null
          creado_en: string
          email: string | null
          empresa_id: string
          folder_id: string | null
          frecuencia_horas: number
          hojas: Json
          id: string
          modulos_activos: string[]
          refresh_token: string | null
          resumen: Json
          token_expira_en: string | null
          ultima_sync: string | null
          ultimo_error: string | null
        }
        Insert: {
          access_token?: string | null
          actualizado_en?: string
          conectado?: boolean
          conectado_por?: string | null
          creado_en?: string
          email?: string | null
          empresa_id: string
          folder_id?: string | null
          frecuencia_horas?: number
          hojas?: Json
          id?: string
          modulos_activos?: string[]
          refresh_token?: string | null
          resumen?: Json
          token_expira_en?: string | null
          ultima_sync?: string | null
          ultimo_error?: string | null
        }
        Update: {
          access_token?: string | null
          actualizado_en?: string
          conectado?: boolean
          conectado_por?: string | null
          creado_en?: string
          email?: string | null
          empresa_id?: string
          folder_id?: string | null
          frecuencia_horas?: number
          hojas?: Json
          id?: string
          modulos_activos?: string[]
          refresh_token?: string | null
          resumen?: Json
          token_expira_en?: string | null
          ultima_sync?: string | null
          ultimo_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_google_drive_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contacto_direcciones: {
        Row: {
          barrio: string | null
          calle: string | null
          ciudad: string | null
          codigo_postal: string | null
          contacto_id: string
          creado_en: string
          departamento: string | null
          es_principal: boolean
          id: string
          lat: number | null
          lng: number | null
          numero: string | null
          origen: string
          pais: string | null
          piso: string | null
          provincia: string | null
          texto: string | null
          timbre: string | null
          tipo: string
          total_visitas: number
          ultima_visita: string | null
        }
        Insert: {
          barrio?: string | null
          calle?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          contacto_id: string
          creado_en?: string
          departamento?: string | null
          es_principal?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          numero?: string | null
          origen?: string
          pais?: string | null
          piso?: string | null
          provincia?: string | null
          texto?: string | null
          timbre?: string | null
          tipo?: string
          total_visitas?: number
          ultima_visita?: string | null
        }
        Update: {
          barrio?: string | null
          calle?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          contacto_id?: string
          creado_en?: string
          departamento?: string | null
          es_principal?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          numero?: string | null
          origen?: string
          pais?: string | null
          piso?: string | null
          provincia?: string | null
          texto?: string | null
          timbre?: string | null
          tipo?: string
          total_visitas?: number
          ultima_visita?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacto_direcciones_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      contacto_responsables: {
        Row: {
          asignado_en: string
          contacto_id: string
          usuario_id: string
        }
        Insert: {
          asignado_en?: string
          contacto_id: string
          usuario_id: string
        }
        Update: {
          asignado_en?: string
          contacto_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacto_responsables_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      contacto_seguidores: {
        Row: {
          agregado_en: string
          contacto_id: string
          modo_copia: string | null
          usuario_id: string
        }
        Insert: {
          agregado_en?: string
          contacto_id: string
          modo_copia?: string | null
          usuario_id: string
        }
        Update: {
          agregado_en?: string
          contacto_id?: string
          modo_copia?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacto_seguidores_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      contacto_telefonos: {
        Row: {
          actualizado_en: string
          contacto_id: string
          creado_en: string
          creado_por: string | null
          editado_por: string | null
          empresa_id: string
          es_principal: boolean
          es_whatsapp: boolean
          etiqueta: string | null
          id: string
          orden: number
          origen: string
          tipo: string
          valor: string
        }
        Insert: {
          actualizado_en?: string
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          editado_por?: string | null
          empresa_id: string
          es_principal?: boolean
          es_whatsapp?: boolean
          etiqueta?: string | null
          id?: string
          orden?: number
          origen?: string
          tipo: string
          valor: string
        }
        Update: {
          actualizado_en?: string
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          editado_por?: string | null
          empresa_id?: string
          es_principal?: boolean
          es_whatsapp?: boolean
          etiqueta?: string | null
          id?: string
          orden?: number
          origen?: string
          tipo?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacto_telefonos_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacto_telefonos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contacto_vinculaciones: {
        Row: {
          contacto_id: string
          creado_en: string
          empresa_id: string
          id: string
          puesto: string | null
          recibe_documentos: boolean
          tipo_relacion_id: string | null
          vinculado_id: string
        }
        Insert: {
          contacto_id: string
          creado_en?: string
          empresa_id: string
          id?: string
          puesto?: string | null
          recibe_documentos?: boolean
          tipo_relacion_id?: string | null
          vinculado_id: string
        }
        Update: {
          contacto_id?: string
          creado_en?: string
          empresa_id?: string
          id?: string
          puesto?: string | null
          recibe_documentos?: boolean
          tipo_relacion_id?: string | null
          vinculado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacto_vinculaciones_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacto_vinculaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacto_vinculaciones_tipo_relacion_id_fkey"
            columns: ["tipo_relacion_id"]
            isOneToOne: false
            referencedRelation: "tipos_relacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacto_vinculaciones_vinculado_id_fkey"
            columns: ["vinculado_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos: {
        Row: {
          activo: boolean
          actualizado_en: string
          apellido: string | null
          avatar_url: string | null
          busqueda: unknown
          cargo: string | null
          codigo: string | null
          correo: string | null
          creado_en: string
          creado_por: string
          datos_fiscales: Json | null
          editado_por: string | null
          empresa_id: string
          en_papelera: boolean
          es_provisorio: boolean
          etiquetas: string[] | null
          fecha_nacimiento: string | null
          id: string
          idioma: string | null
          limite_credito: number | null
          miembro_id: string | null
          moneda: string | null
          nombre: string
          notas: string | null
          numero_identificacion: string | null
          origen: string
          pais_fiscal: string | null
          papelera_en: string | null
          plazo_pago_cliente: string | null
          plazo_pago_proveedor: string | null
          rank_cliente: number | null
          rank_proveedor: number | null
          rubro: string | null
          telefono: string | null
          tipo_contacto_id: string
          tipo_identificacion: string | null
          titulo: string | null
          web: string | null
          whatsapp: string | null
          zona_horaria: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          apellido?: string | null
          avatar_url?: string | null
          busqueda?: unknown
          cargo?: string | null
          codigo?: string | null
          correo?: string | null
          creado_en?: string
          creado_por: string
          datos_fiscales?: Json | null
          editado_por?: string | null
          empresa_id: string
          en_papelera?: boolean
          es_provisorio?: boolean
          etiquetas?: string[] | null
          fecha_nacimiento?: string | null
          id?: string
          idioma?: string | null
          limite_credito?: number | null
          miembro_id?: string | null
          moneda?: string | null
          nombre: string
          notas?: string | null
          numero_identificacion?: string | null
          origen?: string
          pais_fiscal?: string | null
          papelera_en?: string | null
          plazo_pago_cliente?: string | null
          plazo_pago_proveedor?: string | null
          rank_cliente?: number | null
          rank_proveedor?: number | null
          rubro?: string | null
          telefono?: string | null
          tipo_contacto_id: string
          tipo_identificacion?: string | null
          titulo?: string | null
          web?: string | null
          whatsapp?: string | null
          zona_horaria?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          apellido?: string | null
          avatar_url?: string | null
          busqueda?: unknown
          cargo?: string | null
          codigo?: string | null
          correo?: string | null
          creado_en?: string
          creado_por?: string
          datos_fiscales?: Json | null
          editado_por?: string | null
          empresa_id?: string
          en_papelera?: boolean
          es_provisorio?: boolean
          etiquetas?: string[] | null
          fecha_nacimiento?: string | null
          id?: string
          idioma?: string | null
          limite_credito?: number | null
          miembro_id?: string | null
          moneda?: string | null
          nombre?: string
          notas?: string | null
          numero_identificacion?: string | null
          origen?: string
          pais_fiscal?: string | null
          papelera_en?: string | null
          plazo_pago_cliente?: string | null
          plazo_pago_proveedor?: string | null
          rank_cliente?: number | null
          rank_proveedor?: number | null
          rubro?: string | null
          telefono?: string | null
          tipo_contacto_id?: string
          tipo_identificacion?: string | null
          titulo?: string | null
          web?: string | null
          whatsapp?: string | null
          zona_horaria?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contactos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_tipo_contacto_id_fkey"
            columns: ["tipo_contacto_id"]
            isOneToOne: false
            referencedRelation: "tipos_contacto"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos_emergencia: {
        Row: {
          direccion: Json | null
          id: string
          miembro_id: string
          nombre: string
          relacion: string | null
          telefono: string | null
        }
        Insert: {
          direccion?: Json | null
          id?: string
          miembro_id: string
          nombre: string
          relacion?: string | null
          telefono?: string | null
        }
        Update: {
          direccion?: Json | null
          id?: string
          miembro_id?: string
          nombre?: string
          relacion?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contactos_emergencia_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: true
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      conversacion_etiquetas: {
        Row: {
          asignado_en: string
          asignado_por: string | null
          conversacion_id: string
          etiqueta_id: string
        }
        Insert: {
          asignado_en?: string
          asignado_por?: string | null
          conversacion_id: string
          etiqueta_id: string
        }
        Update: {
          asignado_en?: string
          asignado_por?: string | null
          conversacion_id?: string
          etiqueta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversacion_etiquetas_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversacion_etiquetas_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "etiquetas_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      conversacion_pins: {
        Row: {
          conversacion_id: string
          fijada_en: string
          usuario_id: string
        }
        Insert: {
          conversacion_id: string
          fijada_en?: string
          usuario_id: string
        }
        Update: {
          conversacion_id?: string
          fijada_en?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversacion_pins_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      conversacion_seguidores: {
        Row: {
          agregado_en: string
          conversacion_id: string
          usuario_id: string
        }
        Insert: {
          agregado_en?: string
          conversacion_id: string
          usuario_id: string
        }
        Update: {
          agregado_en?: string
          conversacion_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversacion_seguidores_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      conversacion_silencios: {
        Row: {
          conversacion_id: string
          silenciado_en: string
          usuario_id: string
        }
        Insert: {
          conversacion_id: string
          silenciado_en?: string
          usuario_id: string
        }
        Update: {
          conversacion_id?: string
          silenciado_en?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversacion_silencios_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          actualizado_en: string
          agente_ia_activo: boolean | null
          asignado_a: string | null
          asignado_a_nombre: string | null
          asunto: string | null
          bloqueada: boolean
          canal_id: string | null
          canal_interno_id: string | null
          cerrado_en: string | null
          cerrado_por: string | null
          chatbot_activo: boolean
          chatbot_pausado_hasta: string | null
          clasificacion_ia: Json | null
          contacto_id: string | null
          contacto_nombre: string | null
          creado_en: string
          empresa_id: string
          en_papelera: boolean
          en_pipeline: boolean
          estado: string
          etapa_id: string | null
          etiquetas: string[] | null
          hilo_externo_id: string | null
          ia_pausado_hasta: string | null
          id: string
          identificador_externo: string | null
          idioma_detectado: string | null
          mensajes_sin_leer: number
          metadata: Json | null
          papelera_en: string | null
          primera_respuesta_en: string | null
          prioridad: string
          resumen_ia: string | null
          sector_color: string | null
          sector_id: string | null
          sector_nombre: string | null
          sentimiento: string | null
          sla_primera_respuesta_cumplido: boolean | null
          sla_primera_respuesta_en: string | null
          sla_primera_respuesta_vence_en: string | null
          snooze_hasta: string | null
          snooze_nota: string | null
          snooze_por: string | null
          tiempo_sin_respuesta_desde: string | null
          tiene_mensaje_entrante: boolean
          tipo_canal: string
          ultimo_mensaje_en: string | null
          ultimo_mensaje_es_entrante: boolean | null
          ultimo_mensaje_texto: string | null
        }
        Insert: {
          actualizado_en?: string
          agente_ia_activo?: boolean | null
          asignado_a?: string | null
          asignado_a_nombre?: string | null
          asunto?: string | null
          bloqueada?: boolean
          canal_id?: string | null
          canal_interno_id?: string | null
          cerrado_en?: string | null
          cerrado_por?: string | null
          chatbot_activo?: boolean
          chatbot_pausado_hasta?: string | null
          clasificacion_ia?: Json | null
          contacto_id?: string | null
          contacto_nombre?: string | null
          creado_en?: string
          empresa_id: string
          en_papelera?: boolean
          en_pipeline?: boolean
          estado?: string
          etapa_id?: string | null
          etiquetas?: string[] | null
          hilo_externo_id?: string | null
          ia_pausado_hasta?: string | null
          id?: string
          identificador_externo?: string | null
          idioma_detectado?: string | null
          mensajes_sin_leer?: number
          metadata?: Json | null
          papelera_en?: string | null
          primera_respuesta_en?: string | null
          prioridad?: string
          resumen_ia?: string | null
          sector_color?: string | null
          sector_id?: string | null
          sector_nombre?: string | null
          sentimiento?: string | null
          sla_primera_respuesta_cumplido?: boolean | null
          sla_primera_respuesta_en?: string | null
          sla_primera_respuesta_vence_en?: string | null
          snooze_hasta?: string | null
          snooze_nota?: string | null
          snooze_por?: string | null
          tiempo_sin_respuesta_desde?: string | null
          tiene_mensaje_entrante?: boolean
          tipo_canal: string
          ultimo_mensaje_en?: string | null
          ultimo_mensaje_es_entrante?: boolean | null
          ultimo_mensaje_texto?: string | null
        }
        Update: {
          actualizado_en?: string
          agente_ia_activo?: boolean | null
          asignado_a?: string | null
          asignado_a_nombre?: string | null
          asunto?: string | null
          bloqueada?: boolean
          canal_id?: string | null
          canal_interno_id?: string | null
          cerrado_en?: string | null
          cerrado_por?: string | null
          chatbot_activo?: boolean
          chatbot_pausado_hasta?: string | null
          clasificacion_ia?: Json | null
          contacto_id?: string | null
          contacto_nombre?: string | null
          creado_en?: string
          empresa_id?: string
          en_papelera?: boolean
          en_pipeline?: boolean
          estado?: string
          etapa_id?: string | null
          etiquetas?: string[] | null
          hilo_externo_id?: string | null
          ia_pausado_hasta?: string | null
          id?: string
          identificador_externo?: string | null
          idioma_detectado?: string | null
          mensajes_sin_leer?: number
          metadata?: Json | null
          papelera_en?: string | null
          primera_respuesta_en?: string | null
          prioridad?: string
          resumen_ia?: string | null
          sector_color?: string | null
          sector_id?: string | null
          sector_nombre?: string | null
          sentimiento?: string | null
          sla_primera_respuesta_cumplido?: boolean | null
          sla_primera_respuesta_en?: string | null
          sla_primera_respuesta_vence_en?: string | null
          snooze_hasta?: string | null
          snooze_nota?: string | null
          snooze_por?: string | null
          tiempo_sin_respuesta_desde?: string | null
          tiene_mensaje_entrante?: boolean
          tipo_canal?: string
          ultimo_mensaje_en?: string | null
          ultimo_mensaje_es_entrante?: boolean | null
          ultimo_mensaje_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas_conversacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversaciones_canal_interno"
            columns: ["canal_interno_id"]
            isOneToOne: false
            referencedRelation: "canales_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones_salix_ia: {
        Row: {
          actualizado_en: string
          canal: string
          creado_en: string
          empresa_id: string
          id: string
          mensajes: Json
          resumen: string | null
          titulo: string | null
          usuario_id: string
        }
        Insert: {
          actualizado_en?: string
          canal?: string
          creado_en?: string
          empresa_id: string
          id?: string
          mensajes?: Json
          resumen?: string | null
          titulo?: string | null
          usuario_id: string
        }
        Update: {
          actualizado_en?: string
          canal?: string
          creado_en?: string
          empresa_id?: string
          id?: string
          mensajes?: Json
          resumen?: string | null
          titulo?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_salix_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      correo_por_tipo_contacto: {
        Row: {
          canal_id: string
          creado_en: string
          empresa_id: string
          id: string
          tipo_contacto_id: string
        }
        Insert: {
          canal_id: string
          creado_en?: string
          empresa_id: string
          id?: string
          tipo_contacto_id: string
        }
        Update: {
          canal_id?: string
          creado_en?: string
          empresa_id?: string
          id?: string
          tipo_contacto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correo_por_tipo_contacto_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales_correo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correo_por_tipo_contacto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correo_por_tipo_contacto_tipo_contacto_id_fkey"
            columns: ["tipo_contacto_id"]
            isOneToOne: false
            referencedRelation: "tipos_contacto"
            referencedColumns: ["id"]
          },
        ]
      }
      correos_programados: {
        Row: {
          adjuntos_ids: string[] | null
          canal_id: string
          conversacion_id: string | null
          correo_asunto: string
          correo_cc: string[] | null
          correo_cco: string[] | null
          correo_in_reply_to: string | null
          correo_para: string[]
          correo_references: string[] | null
          creado_en: string
          creado_por: string
          empresa_id: string
          entidad_id: string | null
          entidad_tipo: string | null
          enviado_en: string | null
          enviar_en: string
          error: string | null
          estado: string
          html: string | null
          id: string
          incluir_enlace_portal: boolean
          pdf_congelado_url: string | null
          pdf_nombre: string | null
          pdf_url: string | null
          texto: string | null
          tipo: string
        }
        Insert: {
          adjuntos_ids?: string[] | null
          canal_id: string
          conversacion_id?: string | null
          correo_asunto: string
          correo_cc?: string[] | null
          correo_cco?: string[] | null
          correo_in_reply_to?: string | null
          correo_para: string[]
          correo_references?: string[] | null
          creado_en?: string
          creado_por: string
          empresa_id: string
          entidad_id?: string | null
          entidad_tipo?: string | null
          enviado_en?: string | null
          enviar_en: string
          error?: string | null
          estado?: string
          html?: string | null
          id?: string
          incluir_enlace_portal?: boolean
          pdf_congelado_url?: string | null
          pdf_nombre?: string | null
          pdf_url?: string | null
          texto?: string | null
          tipo?: string
        }
        Update: {
          adjuntos_ids?: string[] | null
          canal_id?: string
          conversacion_id?: string | null
          correo_asunto?: string
          correo_cc?: string[] | null
          correo_cco?: string[] | null
          correo_in_reply_to?: string | null
          correo_para?: string[]
          correo_references?: string[] | null
          creado_en?: string
          creado_por?: string
          empresa_id?: string
          entidad_id?: string | null
          entidad_tipo?: string | null
          enviado_en?: string | null
          enviar_en?: string
          error?: string | null
          estado?: string
          html?: string | null
          id?: string
          incluir_enlace_portal?: boolean
          pdf_congelado_url?: string | null
          pdf_nombre?: string | null
          pdf_url?: string | null
          texto?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "correos_programados_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales_correo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correos_programados_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correos_programados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_usuario: {
        Row: {
          creado_en: string
          id: string
          miembro_id: string
          nombre_archivo: string
          tipo: string
          url: string
        }
        Insert: {
          creado_en?: string
          id?: string
          miembro_id: string
          nombre_archivo?: string
          tipo: string
          url: string
        }
        Update: {
          creado_en?: string
          id?: string
          miembro_id?: string
          nombre_archivo?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_usuario_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      educacion_usuario: {
        Row: {
          creado_en: string
          desde: string | null
          en_curso: boolean
          hasta: string | null
          id: string
          institucion: string
          miembro_id: string
          tipo: string
          titulo: string | null
        }
        Insert: {
          creado_en?: string
          desde?: string | null
          en_curso?: boolean
          hasta?: string | null
          id?: string
          institucion: string
          miembro_id: string
          tipo: string
          titulo?: string | null
        }
        Update: {
          creado_en?: string
          desde?: string | null
          en_curso?: boolean
          hasta?: string | null
          id?: string
          institucion?: string
          miembro_id?: string
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "educacion_usuario_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          actualizado_en: string
          color_marca: string | null
          color_secundario: string | null
          color_terciario: string | null
          correo: string | null
          creado_en: string
          cuota_storage_bytes: number
          datos_bancarios: Json
          datos_fiscales: Json
          descripcion: string | null
          dia_inicio_semana: string
          direccion: Json | null
          formato_fecha: string
          formato_hora: string
          id: string
          logo_url: string | null
          moneda: string
          nombre: string
          pagina_web: string | null
          pais: string | null
          paises: string[]
          slug: string
          telefono: string | null
          ubicacion: string | null
          zona_horaria: string
        }
        Insert: {
          actualizado_en?: string
          color_marca?: string | null
          color_secundario?: string | null
          color_terciario?: string | null
          correo?: string | null
          creado_en?: string
          cuota_storage_bytes?: number
          datos_bancarios?: Json
          datos_fiscales?: Json
          descripcion?: string | null
          dia_inicio_semana?: string
          direccion?: Json | null
          formato_fecha?: string
          formato_hora?: string
          id?: string
          logo_url?: string | null
          moneda?: string
          nombre: string
          pagina_web?: string | null
          pais?: string | null
          paises?: string[]
          slug: string
          telefono?: string | null
          ubicacion?: string | null
          zona_horaria?: string
        }
        Update: {
          actualizado_en?: string
          color_marca?: string | null
          color_secundario?: string | null
          color_terciario?: string | null
          correo?: string | null
          creado_en?: string
          cuota_storage_bytes?: number
          datos_bancarios?: Json
          datos_fiscales?: Json
          descripcion?: string | null
          dia_inicio_semana?: string
          direccion?: Json | null
          formato_fecha?: string
          formato_hora?: string
          id?: string
          logo_url?: string | null
          moneda?: string
          nombre?: string
          pagina_web?: string | null
          pais?: string | null
          paises?: string[]
          slug?: string
          telefono?: string | null
          ubicacion?: string | null
          zona_horaria?: string
        }
        Relationships: []
      }
      estados_actividad: {
        Row: {
          activo: boolean
          clave: string
          color: string
          creado_en: string
          empresa_id: string
          es_predefinido: boolean
          etiqueta: string
          grupo: string
          icono: string
          id: string
          orden: number
        }
        Insert: {
          activo?: boolean
          clave: string
          color?: string
          creado_en?: string
          empresa_id: string
          es_predefinido?: boolean
          etiqueta: string
          grupo?: string
          icono?: string
          id?: string
          orden?: number
        }
        Update: {
          activo?: boolean
          clave?: string
          color?: string
          creado_en?: string
          empresa_id?: string
          es_predefinido?: boolean
          etiqueta?: string
          grupo?: string
          icono?: string
          id?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "estados_actividad_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas_conversacion: {
        Row: {
          acciones_auto: Json
          activa: boolean
          clave: string
          color: string
          creado_en: string
          empresa_id: string
          es_predefinida: boolean
          etiqueta: string
          icono: string | null
          id: string
          orden: number
          requisitos: Json
          sectores_permitidos: string[]
          tipo_canal: string
        }
        Insert: {
          acciones_auto?: Json
          activa?: boolean
          clave: string
          color?: string
          creado_en?: string
          empresa_id: string
          es_predefinida?: boolean
          etiqueta: string
          icono?: string | null
          id?: string
          orden?: number
          requisitos?: Json
          sectores_permitidos?: string[]
          tipo_canal: string
        }
        Update: {
          acciones_auto?: Json
          activa?: boolean
          clave?: string
          color?: string
          creado_en?: string
          empresa_id?: string
          es_predefinida?: boolean
          etiqueta?: string
          icono?: string | null
          id?: string
          orden?: number
          requisitos?: Json
          sectores_permitidos?: string[]
          tipo_canal?: string
        }
        Relationships: [
          {
            foreignKeyName: "etapas_conversacion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquetas_contacto: {
        Row: {
          activa: boolean
          color: string
          creado_en: string
          empresa_id: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activa?: boolean
          color?: string
          creado_en?: string
          empresa_id: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activa?: boolean
          color?: string
          creado_en?: string
          empresa_id?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "etiquetas_contacto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquetas_inbox: {
        Row: {
          clave_default: string | null
          color: string
          creado_en: string
          empresa_id: string
          es_default: boolean
          icono: string | null
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          clave_default?: string | null
          color?: string
          creado_en?: string
          empresa_id: string
          es_default?: boolean
          icono?: string | null
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          clave_default?: string | null
          color?: string
          creado_en?: string
          empresa_id?: string
          es_default?: boolean
          icono?: string | null
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "etiquetas_correo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_calendario: {
        Row: {
          actividad_id: string | null
          actualizado_en: string
          asignado_ids: string[]
          asignados: Json
          color: string | null
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          descripcion: string | null
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          en_papelera: boolean
          es_excepcion: boolean
          estado: string
          evento_padre_id: string | null
          fecha_excepcion: string | null
          fecha_fin: string
          fecha_inicio: string
          id: string
          notas: string | null
          papelera_en: string | null
          recordatorio_minutos: number | null
          recurrencia: Json | null
          tipo_clave: string | null
          tipo_id: string | null
          titulo: string
          todo_el_dia: boolean
          ubicacion: string | null
          vinculo_ids: string[]
          vinculos: Json
          visibilidad: string
          visita_id: string | null
        }
        Insert: {
          actividad_id?: string | null
          actualizado_en?: string
          asignado_ids?: string[]
          asignados?: Json
          color?: string | null
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          en_papelera?: boolean
          es_excepcion?: boolean
          estado?: string
          evento_padre_id?: string | null
          fecha_excepcion?: string | null
          fecha_fin: string
          fecha_inicio: string
          id?: string
          notas?: string | null
          papelera_en?: string | null
          recordatorio_minutos?: number | null
          recurrencia?: Json | null
          tipo_clave?: string | null
          tipo_id?: string | null
          titulo: string
          todo_el_dia?: boolean
          ubicacion?: string | null
          vinculo_ids?: string[]
          vinculos?: Json
          visibilidad?: string
          visita_id?: string | null
        }
        Update: {
          actividad_id?: string | null
          actualizado_en?: string
          asignado_ids?: string[]
          asignados?: Json
          color?: string | null
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          en_papelera?: boolean
          es_excepcion?: boolean
          estado?: string
          evento_padre_id?: string | null
          fecha_excepcion?: string | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          notas?: string | null
          papelera_en?: string | null
          recordatorio_minutos?: number | null
          recurrencia?: Json | null
          tipo_clave?: string | null
          tipo_id?: string | null
          titulo?: string
          todo_el_dia?: boolean
          ubicacion?: string | null
          vinculo_ids?: string[]
          vinculos?: Json
          visibilidad?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_calendario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_calendario_evento_padre_id_fkey"
            columns: ["evento_padre_id"]
            isOneToOne: false
            referencedRelation: "eventos_calendario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_calendario_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_evento_calendario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_calendario_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          activo: boolean
          creado_en: string
          creado_por: string | null
          dia_mes: number | null
          empresa_id: string
          fecha: string
          id: string
          mes: number | null
          nombre: string
          origen: string
          pais_codigo: string | null
          recurrente: boolean
          tipo: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          creado_por?: string | null
          dia_mes?: number | null
          empresa_id: string
          fecha: string
          id?: string
          mes?: number | null
          nombre: string
          origen?: string
          pais_codigo?: string | null
          recurrente?: boolean
          tipo?: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          creado_por?: string | null
          dia_mes?: number | null
          empresa_id?: string
          fecha?: string
          id?: string
          mes?: number | null
          nombre?: string
          origen?: string
          pais_codigo?: string | null
          recurrente?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "feriados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fichajes_actividad: {
        Row: {
          empresa_id: string
          fecha: string
          id: string
          metadata: Json | null
          miembro_id: string
          timestamp: string
          tipo: string
        }
        Insert: {
          empresa_id: string
          fecha: string
          id?: string
          metadata?: Json | null
          miembro_id: string
          timestamp: string
          tipo: string
        }
        Update: {
          empresa_id?: string
          fecha?: string
          id?: string
          metadata?: Json | null
          miembro_id?: string
          timestamp?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fichajes_actividad_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichajes_actividad_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_compensacion: {
        Row: {
          campo: string
          creado_en: string
          creado_por: string
          creado_por_nombre: string
          empresa_id: string
          id: string
          miembro_id: string
          motivo: string | null
          porcentaje_cambio: number | null
          valor_anterior: string | null
          valor_nuevo: string
        }
        Insert: {
          campo: string
          creado_en?: string
          creado_por: string
          creado_por_nombre: string
          empresa_id: string
          id?: string
          miembro_id: string
          motivo?: string | null
          porcentaje_cambio?: number | null
          valor_anterior?: string | null
          valor_nuevo: string
        }
        Update: {
          campo?: string
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string
          empresa_id?: string
          id?: string
          miembro_id?: string
          motivo?: string | null
          porcentaje_cambio?: number | null
          valor_anterior?: string | null
          valor_nuevo?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_compensacion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_compensacion_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_plantillas_whatsapp: {
        Row: {
          creado_en: string
          detalle: string | null
          empresa_id: string
          estado_nuevo: string | null
          estado_previo: string | null
          evento: string
          id: string
          metadata: Json | null
          plantilla_id: string
          usuario_id: string | null
          usuario_nombre: string | null
        }
        Insert: {
          creado_en?: string
          detalle?: string | null
          empresa_id: string
          estado_nuevo?: string | null
          estado_previo?: string | null
          evento: string
          id?: string
          metadata?: Json | null
          plantilla_id: string
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Update: {
          creado_en?: string
          detalle?: string | null
          empresa_id?: string
          estado_nuevo?: string | null
          estado_previo?: string | null
          evento?: string
          id?: string
          metadata?: Json | null
          plantilla_id?: string
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_plantillas_whatsapp_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas_whatsapp"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_recientes: {
        Row: {
          accedido_en: string
          accion: string
          empresa_id: string
          entidad_id: string
          icono: string | null
          id: string
          subtitulo: string | null
          tipo_entidad: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          accedido_en?: string
          accion?: string
          empresa_id: string
          entidad_id: string
          icono?: string | null
          id?: string
          subtitulo?: string | null
          tipo_entidad: string
          titulo: string
          usuario_id: string
        }
        Update: {
          accedido_en?: string
          accion?: string
          empresa_id?: string
          entidad_id?: string
          icono?: string | null
          id?: string
          subtitulo?: string | null
          tipo_entidad?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_recientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios: {
        Row: {
          activo: boolean
          creado_en: string
          dia_semana: number
          empresa_id: string
          hora_fin: string
          hora_inicio: string
          id: string
          sector_id: string | null
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          dia_semana: number
          empresa_id: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          sector_id?: string | null
        }
        Update: {
          activo?: boolean
          creado_en?: string
          dia_semana?: number
          empresa_id?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          sector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
        ]
      }
      info_bancaria: {
        Row: {
          alias: string | null
          banco: string | null
          id: string
          miembro_id: string
          numero_cuenta: string | null
          tipo_cuenta: string | null
        }
        Insert: {
          alias?: string | null
          banco?: string | null
          id?: string
          miembro_id: string
          numero_cuenta?: string | null
          tipo_cuenta?: string | null
        }
        Update: {
          alias?: string | null
          banco?: string | null
          id?: string
          miembro_id?: string
          numero_cuenta?: string | null
          tipo_cuenta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "info_bancaria_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: true
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          correo: string
          creado_en: string
          creado_por: string
          empresa_id: string
          expira_en: string
          id: string
          rol: string
          token: string
          usado: boolean
        }
        Insert: {
          correo: string
          creado_en?: string
          creado_por: string
          empresa_id: string
          expira_en: string
          id?: string
          rol?: string
          token: string
          usado?: boolean
        }
        Update: {
          correo?: string
          creado_en?: string
          creado_por?: string
          empresa_id?: string
          expira_en?: string
          id?: string
          rol?: string
          token?: string
          usado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      lineas_orden_trabajo: {
        Row: {
          cantidad: number | null
          codigo_producto: string | null
          creado_en: string
          descripcion: string | null
          descripcion_detalle: string | null
          empresa_id: string
          id: string
          orden: number
          orden_trabajo_id: string
          tipo_linea: string
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          codigo_producto?: string | null
          creado_en?: string
          descripcion?: string | null
          descripcion_detalle?: string | null
          empresa_id: string
          id?: string
          orden?: number
          orden_trabajo_id: string
          tipo_linea?: string
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          codigo_producto?: string | null
          creado_en?: string
          descripcion?: string | null
          descripcion_detalle?: string | null
          empresa_id?: string
          id?: string
          orden?: number
          orden_trabajo_id?: string
          tipo_linea?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lineas_orden_trabajo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_orden_trabajo_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
        ]
      }
      lineas_presupuesto: {
        Row: {
          cantidad: number | null
          codigo_producto: string | null
          creado_en: string
          descripcion: string | null
          descripcion_detalle: string | null
          descuento: number | null
          empresa_id: string
          id: string
          impuesto_label: string | null
          impuesto_monto: number | null
          impuesto_porcentaje: number | null
          monto: number | null
          orden: number
          precio_unitario: number | null
          presupuesto_id: string
          subtotal: number | null
          tipo_linea: string
          total: number | null
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          codigo_producto?: string | null
          creado_en?: string
          descripcion?: string | null
          descripcion_detalle?: string | null
          descuento?: number | null
          empresa_id: string
          id?: string
          impuesto_label?: string | null
          impuesto_monto?: number | null
          impuesto_porcentaje?: number | null
          monto?: number | null
          orden?: number
          precio_unitario?: number | null
          presupuesto_id: string
          subtotal?: number | null
          tipo_linea?: string
          total?: number | null
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          codigo_producto?: string | null
          creado_en?: string
          descripcion?: string | null
          descripcion_detalle?: string | null
          descuento?: number | null
          empresa_id?: string
          id?: string
          impuesto_label?: string | null
          impuesto_monto?: number | null
          impuesto_porcentaje?: number | null
          monto?: number | null
          orden?: number
          precio_unitario?: number | null
          presupuesto_id?: string
          subtotal?: number | null
          tipo_linea?: string
          total?: number | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lineas_presupuesto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_presupuesto_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      log_agente_ia: {
        Row: {
          accion: string
          conversacion_id: string
          creado_en: string | null
          empresa_id: string
          entrada: Json | null
          error: string | null
          exito: boolean | null
          id: string
          latencia_ms: number | null
          mensaje_id: string | null
          modelo: string | null
          proveedor: string | null
          salida: Json | null
          tokens_entrada: number | null
          tokens_salida: number | null
        }
        Insert: {
          accion: string
          conversacion_id: string
          creado_en?: string | null
          empresa_id: string
          entrada?: Json | null
          error?: string | null
          exito?: boolean | null
          id?: string
          latencia_ms?: number | null
          mensaje_id?: string | null
          modelo?: string | null
          proveedor?: string | null
          salida?: Json | null
          tokens_entrada?: number | null
          tokens_salida?: number | null
        }
        Update: {
          accion?: string
          conversacion_id?: string
          creado_en?: string | null
          empresa_id?: string
          entrada?: Json | null
          error?: string | null
          exito?: boolean | null
          id?: string
          latencia_ms?: number | null
          mensaje_id?: string | null
          modelo?: string | null
          proveedor?: string | null
          salida?: Json | null
          tokens_entrada?: number | null
          tokens_salida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "log_agente_ia_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_agente_ia_mensaje_id_fkey"
            columns: ["mensaje_id"]
            isOneToOne: false
            referencedRelation: "mensajes"
            referencedColumns: ["id"]
          },
        ]
      }
      log_salix_ia: {
        Row: {
          canal: string
          conversacion_id: string | null
          creado_en: string
          empresa_id: string
          error: string | null
          exito: boolean
          herramientas_usadas: string[] | null
          id: string
          latencia_ms: number | null
          mensaje_usuario: string | null
          modelo: string | null
          proveedor: string | null
          respuesta: string | null
          tokens_entrada: number | null
          tokens_salida: number | null
          usuario_id: string
        }
        Insert: {
          canal?: string
          conversacion_id?: string | null
          creado_en?: string
          empresa_id: string
          error?: string | null
          exito?: boolean
          herramientas_usadas?: string[] | null
          id?: string
          latencia_ms?: number | null
          mensaje_usuario?: string | null
          modelo?: string | null
          proveedor?: string | null
          respuesta?: string | null
          tokens_entrada?: number | null
          tokens_salida?: number | null
          usuario_id: string
        }
        Update: {
          canal?: string
          conversacion_id?: string | null
          creado_en?: string
          empresa_id?: string
          error?: string | null
          exito?: boolean
          herramientas_usadas?: string[] | null
          id?: string
          latencia_ms?: number | null
          mensaje_usuario?: string | null
          modelo?: string | null
          proveedor?: string | null
          respuesta?: string | null
          tokens_entrada?: number | null
          tokens_salida?: number | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_salix_ia_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones_salix_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_salix_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensaje_adjuntos: {
        Row: {
          creado_en: string
          duracion_segundos: number | null
          empresa_id: string
          es_animado: boolean | null
          es_sticker: boolean | null
          id: string
          mensaje_id: string | null
          miniatura_url: string | null
          nombre_archivo: string
          storage_path: string
          tamano_bytes: number | null
          tipo_mime: string
          url: string
        }
        Insert: {
          creado_en?: string
          duracion_segundos?: number | null
          empresa_id: string
          es_animado?: boolean | null
          es_sticker?: boolean | null
          id?: string
          mensaje_id?: string | null
          miniatura_url?: string | null
          nombre_archivo: string
          storage_path: string
          tamano_bytes?: number | null
          tipo_mime: string
          url: string
        }
        Update: {
          creado_en?: string
          duracion_segundos?: number | null
          empresa_id?: string
          es_animado?: boolean | null
          es_sticker?: boolean | null
          id?: string
          mensaje_id?: string | null
          miniatura_url?: string | null
          nombre_archivo?: string
          storage_path?: string
          tamano_bytes?: number | null
          tipo_mime?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensaje_adjuntos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensaje_adjuntos_mensaje_id_fkey"
            columns: ["mensaje_id"]
            isOneToOne: false
            referencedRelation: "mensajes"
            referencedColumns: ["id"]
          },
        ]
      }
      mensaje_lecturas: {
        Row: {
          leido_en: string
          mensaje_id: string
          usuario_id: string
        }
        Insert: {
          leido_en?: string
          mensaje_id: string
          usuario_id: string
        }
        Update: {
          leido_en?: string
          mensaje_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensaje_lecturas_mensaje_id_fkey"
            columns: ["mensaje_id"]
            isOneToOne: false
            referencedRelation: "mensajes"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes: {
        Row: {
          cantidad_respuestas: number
          conversacion_id: string
          correo_asunto: string | null
          correo_cc: string[] | null
          correo_cco: string[] | null
          correo_de: string | null
          correo_in_reply_to: string | null
          correo_message_id: string | null
          correo_para: string[] | null
          correo_references: string[] | null
          creado_en: string
          editado_en: string | null
          eliminado_en: string | null
          empresa_id: string
          error_envio: string | null
          es_entrante: boolean
          es_nota_interna: boolean
          estado: string
          hilo_raiz_id: string | null
          html: string | null
          id: string
          metadata: Json | null
          plantilla_id: string | null
          reacciones: Json | null
          remitente_id: string | null
          remitente_nombre: string | null
          remitente_tipo: string
          respuesta_a_id: string | null
          texto: string | null
          tipo_contenido: string
          wa_message_id: string | null
          wa_status: string | null
          wa_tipo_mensaje: string | null
        }
        Insert: {
          cantidad_respuestas?: number
          conversacion_id: string
          correo_asunto?: string | null
          correo_cc?: string[] | null
          correo_cco?: string[] | null
          correo_de?: string | null
          correo_in_reply_to?: string | null
          correo_message_id?: string | null
          correo_para?: string[] | null
          correo_references?: string[] | null
          creado_en?: string
          editado_en?: string | null
          eliminado_en?: string | null
          empresa_id: string
          error_envio?: string | null
          es_entrante?: boolean
          es_nota_interna?: boolean
          estado?: string
          hilo_raiz_id?: string | null
          html?: string | null
          id?: string
          metadata?: Json | null
          plantilla_id?: string | null
          reacciones?: Json | null
          remitente_id?: string | null
          remitente_nombre?: string | null
          remitente_tipo?: string
          respuesta_a_id?: string | null
          texto?: string | null
          tipo_contenido?: string
          wa_message_id?: string | null
          wa_status?: string | null
          wa_tipo_mensaje?: string | null
        }
        Update: {
          cantidad_respuestas?: number
          conversacion_id?: string
          correo_asunto?: string | null
          correo_cc?: string[] | null
          correo_cco?: string[] | null
          correo_de?: string | null
          correo_in_reply_to?: string | null
          correo_message_id?: string | null
          correo_para?: string[] | null
          correo_references?: string[] | null
          creado_en?: string
          editado_en?: string | null
          eliminado_en?: string | null
          empresa_id?: string
          error_envio?: string | null
          es_entrante?: boolean
          es_nota_interna?: boolean
          estado?: string
          hilo_raiz_id?: string | null
          html?: string | null
          id?: string
          metadata?: Json | null
          plantilla_id?: string | null
          reacciones?: Json | null
          remitente_id?: string | null
          remitente_nombre?: string | null
          remitente_tipo?: string
          respuesta_a_id?: string | null
          texto?: string | null
          tipo_contenido?: string
          wa_message_id?: string | null
          wa_status?: string | null
          wa_tipo_mensaje?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_hilo_raiz_fk"
            columns: ["hilo_raiz_id"]
            isOneToOne: false
            referencedRelation: "mensajes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_respuesta_a_fk"
            columns: ["respuesta_a_id"]
            isOneToOne: false
            referencedRelation: "mensajes"
            referencedColumns: ["id"]
          },
        ]
      }
      metricas_correo: {
        Row: {
          canal_id: string | null
          conversaciones_nuevas: number | null
          conversaciones_resueltas: number | null
          correos_enviados: number | null
          correos_recibidos: number | null
          correos_spam: number | null
          empresa_id: string
          fecha: string
          id: string
          tiempo_primera_respuesta_promedio: number | null
          tiempo_resolucion_promedio: number | null
        }
        Insert: {
          canal_id?: string | null
          conversaciones_nuevas?: number | null
          conversaciones_resueltas?: number | null
          correos_enviados?: number | null
          correos_recibidos?: number | null
          correos_spam?: number | null
          empresa_id: string
          fecha: string
          id?: string
          tiempo_primera_respuesta_promedio?: number | null
          tiempo_resolucion_promedio?: number | null
        }
        Update: {
          canal_id?: string | null
          conversaciones_nuevas?: number | null
          conversaciones_resueltas?: number | null
          correos_enviados?: number | null
          correos_recibidos?: number | null
          correos_spam?: number | null
          empresa_id?: string
          fecha?: string
          id?: string
          tiempo_primera_respuesta_promedio?: number | null
          tiempo_resolucion_promedio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metricas_correo_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales_correo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metricas_correo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros: {
        Row: {
          activo: boolean
          canal_login: string
          canal_notif_correo: string
          canal_notif_telefono: string
          compensacion_frecuencia: string | null
          compensacion_monto: number | null
          compensacion_tipo: string | null
          dias_trabajo: number | null
          empresa_id: string
          fecha_nacimiento: string | null
          fichaje_auto_movil: boolean
          foto_kiosco_url: string | null
          horario_flexible: boolean
          horario_tipo: string | null
          id: string
          kiosco_pin: string | null
          kiosco_rfid: string | null
          metodo_fichaje: string | null
          numero_empleado: number
          permisos_custom: Json | null
          permisos_recorrido_default: Json | null
          puesto_id: string | null
          rol: string
          salix_ia_habilitado: boolean | null
          salix_ia_web: boolean
          salix_ia_whatsapp: boolean
          turno: string | null
          turno_id: string | null
          unido_en: string
          usuario_id: string | null
          usuario_id_anterior: string | null
        }
        Insert: {
          activo?: boolean
          canal_login?: string
          canal_notif_correo?: string
          canal_notif_telefono?: string
          compensacion_frecuencia?: string | null
          compensacion_monto?: number | null
          compensacion_tipo?: string | null
          dias_trabajo?: number | null
          empresa_id: string
          fecha_nacimiento?: string | null
          fichaje_auto_movil?: boolean
          foto_kiosco_url?: string | null
          horario_flexible?: boolean
          horario_tipo?: string | null
          id?: string
          kiosco_pin?: string | null
          kiosco_rfid?: string | null
          metodo_fichaje?: string | null
          numero_empleado?: number
          permisos_custom?: Json | null
          permisos_recorrido_default?: Json | null
          puesto_id?: string | null
          rol?: string
          salix_ia_habilitado?: boolean | null
          salix_ia_web?: boolean
          salix_ia_whatsapp?: boolean
          turno?: string | null
          turno_id?: string | null
          unido_en?: string
          usuario_id?: string | null
          usuario_id_anterior?: string | null
        }
        Update: {
          activo?: boolean
          canal_login?: string
          canal_notif_correo?: string
          canal_notif_telefono?: string
          compensacion_frecuencia?: string | null
          compensacion_monto?: number | null
          compensacion_tipo?: string | null
          dias_trabajo?: number | null
          empresa_id?: string
          fecha_nacimiento?: string | null
          fichaje_auto_movil?: boolean
          foto_kiosco_url?: string | null
          horario_flexible?: boolean
          horario_tipo?: string | null
          id?: string
          kiosco_pin?: string | null
          kiosco_rfid?: string | null
          metodo_fichaje?: string | null
          numero_empleado?: number
          permisos_custom?: Json | null
          permisos_recorrido_default?: Json | null
          puesto_id?: string | null
          rol?: string
          salix_ia_habilitado?: boolean | null
          salix_ia_web?: boolean
          salix_ia_whatsapp?: boolean
          turno?: string | null
          turno_id?: string | null
          unido_en?: string
          usuario_id?: string | null
          usuario_id_anterior?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "miembros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miembros_puesto_id_fkey"
            columns: ["puesto_id"]
            isOneToOne: false
            referencedRelation: "puestos"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros_sectores: {
        Row: {
          es_primario: boolean
          id: string
          miembro_id: string
          sector_id: string
        }
        Insert: {
          es_primario?: boolean
          id?: string
          miembro_id: string
          sector_id: string
        }
        Update: {
          es_primario?: boolean
          id?: string
          miembro_id?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_sectores_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miembros_sectores_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos_empresa: {
        Row: {
          activado_en: string | null
          activo: boolean
          catalogo_modulo_id: string | null
          config: Json
          desactivado_en: string | null
          empresa_id: string
          id: string
          instalado_por: string | null
          modulo: string
          notificacion_purga_enviada: boolean
          purga_programada_en: string | null
          purgado: boolean
          version: string | null
        }
        Insert: {
          activado_en?: string | null
          activo?: boolean
          catalogo_modulo_id?: string | null
          config?: Json
          desactivado_en?: string | null
          empresa_id: string
          id?: string
          instalado_por?: string | null
          modulo: string
          notificacion_purga_enviada?: boolean
          purga_programada_en?: string | null
          purgado?: boolean
          version?: string | null
        }
        Update: {
          activado_en?: string | null
          activo?: boolean
          catalogo_modulo_id?: string | null
          config?: Json
          desactivado_en?: string | null
          empresa_id?: string
          id?: string
          instalado_por?: string | null
          modulo?: string
          notificacion_purga_enviada?: boolean
          purga_programada_en?: string | null
          purgado?: boolean
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modulos_empresa_catalogo_modulo_id_fkey"
            columns: ["catalogo_modulo_id"]
            isOneToOne: false
            referencedRelation: "catalogo_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modulos_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_rapidas: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          archivada: boolean
          color: string
          contenido: string
          creado_en: string
          creador_id: string
          empresa_id: string
          en_papelera: boolean
          fijada: boolean
          id: string
          papelera_en: string | null
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          archivada?: boolean
          color?: string
          contenido?: string
          creado_en?: string
          creador_id: string
          empresa_id: string
          en_papelera?: boolean
          fijada?: boolean
          id?: string
          papelera_en?: string | null
          titulo?: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          archivada?: boolean
          color?: string
          contenido?: string
          creado_en?: string
          creador_id?: string
          empresa_id?: string
          en_papelera?: boolean
          fijada?: boolean
          id?: string
          papelera_en?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_rapidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_rapidas_compartidas: {
        Row: {
          creado_en: string
          id: string
          leido_en: string | null
          nota_id: string
          puede_editar: boolean
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          id?: string
          leido_en?: string | null
          nota_id: string
          puede_editar?: boolean
          usuario_id: string
        }
        Update: {
          creado_en?: string
          id?: string
          leido_en?: string | null
          nota_id?: string
          puede_editar?: boolean
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_rapidas_compartidas_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_rapidas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          color: string | null
          creada_en: string
          cuerpo: string | null
          empresa_id: string
          icono: string | null
          id: string
          leida: boolean
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          titulo: string
          url: string | null
          usuario_id: string
        }
        Insert: {
          color?: string | null
          creada_en?: string
          cuerpo?: string | null
          empresa_id: string
          icono?: string | null
          id?: string
          leida?: boolean
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo: string
          titulo: string
          url?: string | null
          usuario_id: string
        }
        Update: {
          color?: string | null
          creada_en?: string
          cuerpo?: string | null
          empresa_id?: string
          icono?: string | null
          id?: string
          leida?: boolean
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo?: string
          url?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_trabajo_historial: {
        Row: {
          empresa_id: string
          estado: string
          fecha: string
          id: string
          notas: string | null
          orden_trabajo_id: string
          usuario_id: string
          usuario_nombre: string | null
        }
        Insert: {
          empresa_id: string
          estado: string
          fecha?: string
          id?: string
          notas?: string | null
          orden_trabajo_id: string
          usuario_id: string
          usuario_nombre?: string | null
        }
        Update: {
          empresa_id?: string
          estado?: string
          fecha?: string
          id?: string
          notas?: string | null
          orden_trabajo_id?: string
          usuario_id?: string
          usuario_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orden_trabajo_historial_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_trabajo_historial_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_trabajo: {
        Row: {
          actualizado_en: string
          atencion_contacto_id: string | null
          atencion_correo: string | null
          atencion_nombre: string | null
          atencion_telefono: string | null
          contacto_correo: string | null
          contacto_direccion: string | null
          contacto_id: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          contacto_whatsapp: string | null
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          descripcion: string | null
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          en_papelera: boolean
          estado: string
          fecha_fin_estimada: string | null
          fecha_fin_real: string | null
          fecha_inicio: string | null
          id: string
          notas: string | null
          numero: string
          papelera_en: string | null
          presupuesto_id: string | null
          presupuesto_numero: string | null
          prioridad: string
          publicada: boolean
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          atencion_contacto_id?: string | null
          atencion_correo?: string | null
          atencion_nombre?: string | null
          atencion_telefono?: string | null
          contacto_correo?: string | null
          contacto_direccion?: string | null
          contacto_id?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          contacto_whatsapp?: string | null
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          en_papelera?: boolean
          estado?: string
          fecha_fin_estimada?: string | null
          fecha_fin_real?: string | null
          fecha_inicio?: string | null
          id?: string
          notas?: string | null
          numero: string
          papelera_en?: string | null
          presupuesto_id?: string | null
          presupuesto_numero?: string | null
          prioridad?: string
          publicada?: boolean
          titulo: string
        }
        Update: {
          actualizado_en?: string
          atencion_contacto_id?: string | null
          atencion_correo?: string | null
          atencion_nombre?: string | null
          atencion_telefono?: string | null
          contacto_correo?: string | null
          contacto_direccion?: string | null
          contacto_id?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          contacto_whatsapp?: string | null
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          en_papelera?: boolean
          estado?: string
          fecha_fin_estimada?: string | null
          fecha_fin_real?: string | null
          fecha_inicio?: string | null
          id?: string
          notas?: string | null
          numero?: string
          papelera_en?: string | null
          presupuesto_id?: string | null
          presupuesto_numero?: string | null
          prioridad?: string
          publicada?: boolean
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_trabajo_atencion_contacto_id_fkey"
            columns: ["atencion_contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_trabajo_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_trabajo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_trabajo_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_nomina: {
        Row: {
          comprobante_url: string | null
          concepto: string
          creado_en: string
          creado_por: string
          creado_por_nombre: string
          dias_ausentes: number | null
          dias_habiles: number | null
          dias_trabajados: number | null
          editado_en: string | null
          editado_por: string | null
          editado_por_nombre: string | null
          eliminado: boolean
          eliminado_en: string | null
          eliminado_por: string | null
          eliminado_por_nombre: string | null
          empresa_id: string
          fecha_fin_periodo: string
          fecha_inicio_periodo: string
          id: string
          miembro_id: string
          monto_abonado: number
          monto_sugerido: number | null
          notas: string | null
          tardanzas: number | null
        }
        Insert: {
          comprobante_url?: string | null
          concepto: string
          creado_en?: string
          creado_por: string
          creado_por_nombre: string
          dias_ausentes?: number | null
          dias_habiles?: number | null
          dias_trabajados?: number | null
          editado_en?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          eliminado?: boolean
          eliminado_en?: string | null
          eliminado_por?: string | null
          eliminado_por_nombre?: string | null
          empresa_id: string
          fecha_fin_periodo: string
          fecha_inicio_periodo: string
          id?: string
          miembro_id: string
          monto_abonado: number
          monto_sugerido?: number | null
          notas?: string | null
          tardanzas?: number | null
        }
        Update: {
          comprobante_url?: string | null
          concepto?: string
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string
          dias_ausentes?: number | null
          dias_habiles?: number | null
          dias_trabajados?: number | null
          editado_en?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          eliminado?: boolean
          eliminado_en?: string | null
          eliminado_por?: string | null
          eliminado_por_nombre?: string | null
          empresa_id?: string
          fecha_fin_periodo?: string
          fecha_inicio_periodo?: string
          id?: string
          miembro_id?: string
          monto_abonado?: number
          monto_sugerido?: number | null
          notas?: string | null
          tardanzas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_nomina_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_nomina_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          actualizado_en: string
          apellido: string
          avatar_url: string | null
          contacto_emergencia: Json | null
          correo: string | null
          correo_empresa: string | null
          creado_en: string
          direccion: Json | null
          documento_numero: string | null
          documento_tipo: string | null
          domicilio: string | null
          fecha_nacimiento: string | null
          firma_correo: string | null
          formato_nombre_remitente: string | null
          genero: string | null
          id: string
          nombre: string
          telefono: string | null
          telefono_empresa: string | null
        }
        Insert: {
          actualizado_en?: string
          apellido: string
          avatar_url?: string | null
          contacto_emergencia?: Json | null
          correo?: string | null
          correo_empresa?: string | null
          creado_en?: string
          direccion?: Json | null
          documento_numero?: string | null
          documento_tipo?: string | null
          domicilio?: string | null
          fecha_nacimiento?: string | null
          firma_correo?: string | null
          formato_nombre_remitente?: string | null
          genero?: string | null
          id: string
          nombre: string
          telefono?: string | null
          telefono_empresa?: string | null
        }
        Update: {
          actualizado_en?: string
          apellido?: string
          avatar_url?: string | null
          contacto_emergencia?: Json | null
          correo?: string | null
          correo_empresa?: string | null
          creado_en?: string
          direccion?: Json | null
          documento_numero?: string | null
          documento_tipo?: string | null
          domicilio?: string | null
          fecha_nacimiento?: string | null
          firma_correo?: string | null
          formato_nombre_remitente?: string | null
          genero?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          telefono_empresa?: string | null
        }
        Relationships: []
      }
      plantillas_correo: {
        Row: {
          activo: boolean
          actualizado_en: string
          asunto: string
          asunto_original: string | null
          categoria: string | null
          clave_sistema: string | null
          contenido: string
          contenido_html: string
          contenido_original_html: string | null
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          disponible_para: string
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          es_sistema: boolean
          id: string
          modulos: string[] | null
          nombre: string
          orden: number
          roles_permitidos: string[] | null
          usuarios_permitidos: string[] | null
          variables: Json | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          asunto?: string
          asunto_original?: string | null
          categoria?: string | null
          clave_sistema?: string | null
          contenido?: string
          contenido_html?: string
          contenido_original_html?: string | null
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          disponible_para?: string
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          es_sistema?: boolean
          id?: string
          modulos?: string[] | null
          nombre: string
          orden?: number
          roles_permitidos?: string[] | null
          usuarios_permitidos?: string[] | null
          variables?: Json | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          asunto?: string
          asunto_original?: string | null
          categoria?: string | null
          clave_sistema?: string | null
          contenido?: string
          contenido_html?: string
          contenido_original_html?: string | null
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          disponible_para?: string
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          es_sistema?: boolean
          id?: string
          modulos?: string[] | null
          nombre?: string
          orden?: number
          roles_permitidos?: string[] | null
          usuarios_permitidos?: string[] | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_correo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_recorrido: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string
          descripcion: string | null
          empresa_id: string
          id: string
          nombre: string
          paradas: Json
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por: string
          descripcion?: string | null
          empresa_id: string
          id?: string
          nombre: string
          paradas?: Json
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string
          descripcion?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          paradas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_recorrido_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_whatsapp: {
        Row: {
          activo: boolean
          actualizado_en: string
          canal_id: string | null
          categoria: string
          componentes: Json
          creado_en: string
          creado_por: string | null
          creado_por_nombre: string | null
          disponible_para: string | null
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          error_meta: string | null
          es_por_defecto: boolean | null
          estado_meta: string
          hash_componentes_meta: string | null
          id: string
          id_template_meta: string | null
          idioma: string
          modulos: string[] | null
          nombre: string
          nombre_api: string
          orden: number
          roles_permitidos: string[] | null
          ultima_sincronizacion: string | null
          usuarios_permitidos: string[] | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          canal_id?: string | null
          categoria?: string
          componentes?: Json
          creado_en?: string
          creado_por?: string | null
          creado_por_nombre?: string | null
          disponible_para?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          error_meta?: string | null
          es_por_defecto?: boolean | null
          estado_meta?: string
          hash_componentes_meta?: string | null
          id?: string
          id_template_meta?: string | null
          idioma?: string
          modulos?: string[] | null
          nombre: string
          nombre_api: string
          orden?: number
          roles_permitidos?: string[] | null
          ultima_sincronizacion?: string | null
          usuarios_permitidos?: string[] | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          canal_id?: string | null
          categoria?: string
          componentes?: Json
          creado_en?: string
          creado_por?: string | null
          creado_por_nombre?: string | null
          disponible_para?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          error_meta?: string | null
          es_por_defecto?: boolean | null
          estado_meta?: string
          hash_componentes_meta?: string | null
          id?: string
          id_template_meta?: string | null
          idioma?: string
          modulos?: string[] | null
          nombre?: string
          nombre_api?: string
          orden?: number
          roles_permitidos?: string[] | null
          ultima_sincronizacion?: string | null
          usuarios_permitidos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_whatsapp_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales_whatsapp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantillas_whatsapp_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_tokens: {
        Row: {
          aceptado_en: string | null
          activo: boolean
          comprobantes: Json
          creado_en: string
          creado_por: string
          empresa_id: string
          estado_cliente: string
          expira_en: string
          firma_metadata: Json | null
          firma_modo: string | null
          firma_nombre: string | null
          firma_url: string | null
          id: string
          mensajes: Json
          motivo_rechazo: string | null
          pdf_firmado_storage_path: string | null
          pdf_firmado_url: string | null
          presupuesto_id: string
          rechazado_en: string | null
          token: string
          veces_visto: number
          visto_en: string | null
        }
        Insert: {
          aceptado_en?: string | null
          activo?: boolean
          comprobantes?: Json
          creado_en?: string
          creado_por: string
          empresa_id: string
          estado_cliente?: string
          expira_en: string
          firma_metadata?: Json | null
          firma_modo?: string | null
          firma_nombre?: string | null
          firma_url?: string | null
          id?: string
          mensajes?: Json
          motivo_rechazo?: string | null
          pdf_firmado_storage_path?: string | null
          pdf_firmado_url?: string | null
          presupuesto_id: string
          rechazado_en?: string | null
          token: string
          veces_visto?: number
          visto_en?: string | null
        }
        Update: {
          aceptado_en?: string | null
          activo?: boolean
          comprobantes?: Json
          creado_en?: string
          creado_por?: string
          empresa_id?: string
          estado_cliente?: string
          expira_en?: string
          firma_metadata?: Json | null
          firma_modo?: string | null
          firma_nombre?: string | null
          firma_url?: string | null
          id?: string
          mensajes?: Json
          motivo_rechazo?: string | null
          pdf_firmado_storage_path?: string | null
          pdf_firmado_url?: string | null
          presupuesto_id?: string
          rechazado_en?: string | null
          token?: string
          veces_visto?: number
          visto_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_tokens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_tokens_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      preferencias_usuario: {
        Row: {
          actualizado_en: string
          chatter_sin_lateral: Json | null
          config_tablas: Json | null
          dispositivo_id: string
          efecto: string
          escala: string
          fondo_cristal: string
          id: string
          recibir_todas_notificaciones: boolean
          sidebar_auto_colapsar_config: boolean
          sidebar_auto_ocultar: boolean
          sidebar_colapsado: boolean
          sidebar_deshabilitados: Json | null
          sidebar_ocultos: Json | null
          sidebar_orden: Json | null
          sidebar_secciones: Json | null
          tema: string
          usuario_id: string
        }
        Insert: {
          actualizado_en?: string
          chatter_sin_lateral?: Json | null
          config_tablas?: Json | null
          dispositivo_id: string
          efecto?: string
          escala?: string
          fondo_cristal?: string
          id?: string
          recibir_todas_notificaciones?: boolean
          sidebar_auto_colapsar_config?: boolean
          sidebar_auto_ocultar?: boolean
          sidebar_colapsado?: boolean
          sidebar_deshabilitados?: Json | null
          sidebar_ocultos?: Json | null
          sidebar_orden?: Json | null
          sidebar_secciones?: Json | null
          tema?: string
          usuario_id: string
        }
        Update: {
          actualizado_en?: string
          chatter_sin_lateral?: Json | null
          config_tablas?: Json | null
          dispositivo_id?: string
          efecto?: string
          escala?: string
          fondo_cristal?: string
          id?: string
          recibir_todas_notificaciones?: boolean
          sidebar_auto_colapsar_config?: boolean
          sidebar_auto_ocultar?: boolean
          sidebar_colapsado?: boolean
          sidebar_deshabilitados?: Json | null
          sidebar_ocultos?: Json | null
          sidebar_orden?: Json | null
          sidebar_secciones?: Json | null
          tema?: string
          usuario_id?: string
        }
        Relationships: []
      }
      presets_actividades: {
        Row: {
          actualizado_en: string
          aplicar_al_abrir: boolean
          creado_en: string
          empresa_id: string
          id: string
          nombre: string
          orden: number
          tipo_id: string
          usuario_id: string
          valores: Json
        }
        Insert: {
          actualizado_en?: string
          aplicar_al_abrir?: boolean
          creado_en?: string
          empresa_id: string
          id?: string
          nombre: string
          orden?: number
          tipo_id: string
          usuario_id: string
          valores?: Json
        }
        Update: {
          actualizado_en?: string
          aplicar_al_abrir?: boolean
          creado_en?: string
          empresa_id?: string
          id?: string
          nombre?: string
          orden?: number
          tipo_id?: string
          usuario_id?: string
          valores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "presets_actividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presets_actividades_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_actividad"
            referencedColumns: ["id"]
          },
        ]
      }
      presets_visitas: {
        Row: {
          actualizado_en: string
          aplicar_al_abrir: boolean
          creado_en: string
          empresa_id: string
          id: string
          nombre: string
          orden: number
          usuario_id: string
          valores: Json
        }
        Insert: {
          actualizado_en?: string
          aplicar_al_abrir?: boolean
          creado_en?: string
          empresa_id: string
          id?: string
          nombre: string
          orden?: number
          usuario_id: string
          valores?: Json
        }
        Update: {
          actualizado_en?: string
          aplicar_al_abrir?: boolean
          creado_en?: string
          empresa_id?: string
          id?: string
          nombre?: string
          orden?: number
          usuario_id?: string
          valores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "presets_visitas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuesto_cuotas: {
        Row: {
          cobrado_por_nombre: string | null
          descripcion: string | null
          dias_desde_emision: number | null
          empresa_id: string
          estado: string
          fecha_cobro: string | null
          id: string
          monto: number
          numero: number
          porcentaje: number
          presupuesto_id: string
        }
        Insert: {
          cobrado_por_nombre?: string | null
          descripcion?: string | null
          dias_desde_emision?: number | null
          empresa_id: string
          estado?: string
          fecha_cobro?: string | null
          id?: string
          monto?: number
          numero: number
          porcentaje: number
          presupuesto_id: string
        }
        Update: {
          cobrado_por_nombre?: string | null
          descripcion?: string | null
          dias_desde_emision?: number | null
          empresa_id?: string
          estado?: string
          fecha_cobro?: string | null
          id?: string
          monto?: number
          numero?: number
          porcentaje?: number
          presupuesto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_cuotas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_cuotas_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuesto_historial: {
        Row: {
          empresa_id: string
          estado: string
          fecha: string
          id: string
          notas: string | null
          presupuesto_id: string
          usuario_id: string
          usuario_nombre: string | null
        }
        Insert: {
          empresa_id: string
          estado: string
          fecha?: string
          id?: string
          notas?: string | null
          presupuesto_id: string
          usuario_id: string
          usuario_nombre?: string | null
        }
        Update: {
          empresa_id?: string
          estado?: string
          fecha?: string
          id?: string
          notas?: string | null
          presupuesto_id?: string
          usuario_id?: string
          usuario_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_historial_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_historial_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuesto_pago_auditoria: {
        Row: {
          accion: string
          creado_en: string
          empresa_id: string
          id: string
          pago_anterior: Json | null
          pago_id: string
          pago_nuevo: Json | null
          presupuesto_id: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          creado_en?: string
          empresa_id: string
          id?: string
          pago_anterior?: Json | null
          pago_id: string
          pago_nuevo?: Json | null
          presupuesto_id: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          creado_en?: string
          empresa_id?: string
          id?: string
          pago_anterior?: Json | null
          pago_id?: string
          pago_nuevo?: Json | null
          presupuesto_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_pago_auditoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuesto_pago_comprobantes: {
        Row: {
          creado_en: string
          empresa_id: string
          id: string
          mime_tipo: string | null
          nombre: string
          pago_id: string
          storage_path: string
          tamano_bytes: number | null
          tipo: string
          url: string
        }
        Insert: {
          creado_en?: string
          empresa_id: string
          id?: string
          mime_tipo?: string | null
          nombre: string
          pago_id: string
          storage_path: string
          tamano_bytes?: number | null
          tipo?: string
          url: string
        }
        Update: {
          creado_en?: string
          empresa_id?: string
          id?: string
          mime_tipo?: string | null
          nombre?: string
          pago_id?: string
          storage_path?: string
          tamano_bytes?: number | null
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_pago_comprobantes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_pago_comprobantes_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "movimientos_financieros_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_pago_comprobantes_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "presupuesto_pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuesto_pagos: {
        Row: {
          actualizado_en: string
          categoria_contable_id: string | null
          centro_costo_id: string | null
          chatter_origen_id: string | null
          concepto_adicional: string | null
          cotizacion_cambio: number
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          cuota_id: string | null
          descripcion: string | null
          editado_por: string | null
          editado_por_nombre: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          eliminado_por_nombre: string | null
          empresa_id: string
          es_adicional: boolean
          estado_conciliacion: string
          fecha_imputacion: string | null
          fecha_pago: string
          id: string
          mensaje_origen_id: string | null
          metodo: string
          moneda: string
          monto: number
          monto_en_moneda_presupuesto: number
          monto_percepciones: number
          notas_contables: string | null
          orden_trabajo_id: string | null
          presupuesto_id: string
          referencia: string | null
        }
        Insert: {
          actualizado_en?: string
          categoria_contable_id?: string | null
          centro_costo_id?: string | null
          chatter_origen_id?: string | null
          concepto_adicional?: string | null
          cotizacion_cambio?: number
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          cuota_id?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          eliminado_por_nombre?: string | null
          empresa_id: string
          es_adicional?: boolean
          estado_conciliacion?: string
          fecha_imputacion?: string | null
          fecha_pago?: string
          id?: string
          mensaje_origen_id?: string | null
          metodo?: string
          moneda?: string
          monto: number
          monto_en_moneda_presupuesto: number
          monto_percepciones?: number
          notas_contables?: string | null
          orden_trabajo_id?: string | null
          presupuesto_id: string
          referencia?: string | null
        }
        Update: {
          actualizado_en?: string
          categoria_contable_id?: string | null
          centro_costo_id?: string | null
          chatter_origen_id?: string | null
          concepto_adicional?: string | null
          cotizacion_cambio?: number
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          cuota_id?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          eliminado_por_nombre?: string | null
          empresa_id?: string
          es_adicional?: boolean
          estado_conciliacion?: string
          fecha_imputacion?: string | null
          fecha_pago?: string
          id?: string
          mensaje_origen_id?: string | null
          metodo?: string
          moneda?: string
          monto?: number
          monto_en_moneda_presupuesto?: number
          monto_percepciones?: number
          notas_contables?: string | null
          orden_trabajo_id?: string | null
          presupuesto_id?: string
          referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_pagos_chatter_origen_id_fkey"
            columns: ["chatter_origen_id"]
            isOneToOne: false
            referencedRelation: "chatter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_pagos_cuota_id_fkey"
            columns: ["cuota_id"]
            isOneToOne: false
            referencedRelation: "presupuesto_cuotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_pagos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_pagos_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_pagos_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos: {
        Row: {
          actividad_origen_id: string | null
          activo: boolean
          actualizado_en: string
          atencion_cargo: string | null
          atencion_contacto_id: string | null
          atencion_correo: string | null
          atencion_nombre: string | null
          busqueda: unknown
          columnas_lineas: Json | null
          condicion_pago_id: string | null
          condicion_pago_label: string | null
          condicion_pago_tipo: string | null
          condiciones_html: string | null
          contacto_apellido: string | null
          contacto_condicion_iva: string | null
          contacto_correo: string | null
          contacto_direccion: string | null
          contacto_id: string | null
          contacto_identificacion: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          contacto_tipo: string | null
          cotizacion_cambio: number | null
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          descuento_global: number
          descuento_global_monto: number
          dias_vencimiento: number
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          en_papelera: boolean
          estado: string
          estado_cambiado_en: string
          fecha_aceptacion: string | null
          fecha_emision: string
          fecha_emision_original: string | null
          fecha_vencimiento: string | null
          id: string
          moneda: string
          nota_plan_pago: string | null
          notas_html: string | null
          numero: string
          origen_documento_id: string | null
          origen_documento_numero: string | null
          papelera_en: string | null
          pdf_firmado_storage_path: string | null
          pdf_firmado_url: string | null
          pdf_generado_en: string | null
          pdf_miniatura_url: string | null
          pdf_nombre_archivo: string | null
          pdf_storage_path: string | null
          pdf_url: string | null
          referencia: string | null
          subtotal_neto: number
          total_final: number
          total_impuestos: number
        }
        Insert: {
          actividad_origen_id?: string | null
          activo?: boolean
          actualizado_en?: string
          atencion_cargo?: string | null
          atencion_contacto_id?: string | null
          atencion_correo?: string | null
          atencion_nombre?: string | null
          busqueda?: unknown
          columnas_lineas?: Json | null
          condicion_pago_id?: string | null
          condicion_pago_label?: string | null
          condicion_pago_tipo?: string | null
          condiciones_html?: string | null
          contacto_apellido?: string | null
          contacto_condicion_iva?: string | null
          contacto_correo?: string | null
          contacto_direccion?: string | null
          contacto_id?: string | null
          contacto_identificacion?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          contacto_tipo?: string | null
          cotizacion_cambio?: number | null
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          descuento_global?: number
          descuento_global_monto?: number
          dias_vencimiento?: number
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          en_papelera?: boolean
          estado?: string
          estado_cambiado_en?: string
          fecha_aceptacion?: string | null
          fecha_emision?: string
          fecha_emision_original?: string | null
          fecha_vencimiento?: string | null
          id?: string
          moneda?: string
          nota_plan_pago?: string | null
          notas_html?: string | null
          numero: string
          origen_documento_id?: string | null
          origen_documento_numero?: string | null
          papelera_en?: string | null
          pdf_firmado_storage_path?: string | null
          pdf_firmado_url?: string | null
          pdf_generado_en?: string | null
          pdf_miniatura_url?: string | null
          pdf_nombre_archivo?: string | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          referencia?: string | null
          subtotal_neto?: number
          total_final?: number
          total_impuestos?: number
        }
        Update: {
          actividad_origen_id?: string | null
          activo?: boolean
          actualizado_en?: string
          atencion_cargo?: string | null
          atencion_contacto_id?: string | null
          atencion_correo?: string | null
          atencion_nombre?: string | null
          busqueda?: unknown
          columnas_lineas?: Json | null
          condicion_pago_id?: string | null
          condicion_pago_label?: string | null
          condicion_pago_tipo?: string | null
          condiciones_html?: string | null
          contacto_apellido?: string | null
          contacto_condicion_iva?: string | null
          contacto_correo?: string | null
          contacto_direccion?: string | null
          contacto_id?: string | null
          contacto_identificacion?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          contacto_tipo?: string | null
          cotizacion_cambio?: number | null
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          descuento_global?: number
          descuento_global_monto?: number
          dias_vencimiento?: number
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          en_papelera?: boolean
          estado?: string
          estado_cambiado_en?: string
          fecha_aceptacion?: string | null
          fecha_emision?: string
          fecha_emision_original?: string | null
          fecha_vencimiento?: string | null
          id?: string
          moneda?: string
          nota_plan_pago?: string | null
          notas_html?: string | null
          numero?: string
          origen_documento_id?: string | null
          origen_documento_numero?: string | null
          papelera_en?: string | null
          pdf_firmado_storage_path?: string | null
          pdf_firmado_url?: string | null
          pdf_generado_en?: string | null
          pdf_miniatura_url?: string | null
          pdf_nombre_archivo?: string | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          referencia?: string | null
          subtotal_neto?: number
          total_final?: number
          total_impuestos?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_actividad_origen_id_fkey"
            columns: ["actividad_origen_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_atencion_contacto_id_fkey"
            columns: ["atencion_contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          actualizado_en: string
          alerta_stock_bajo: boolean
          busqueda: unknown
          categoria: string | null
          codigo: string
          codigo_barras: string | null
          costo: number | null
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          descripcion: string | null
          descripcion_venta: string | null
          desglose_costos: Json
          dimensiones: string | null
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          en_papelera: boolean
          es_provisorio: boolean
          favorito: boolean
          id: string
          imagen_url: string | null
          impuesto_compra_id: string | null
          impuesto_id: string | null
          moneda: string | null
          nombre: string
          notas_internas: string | null
          origen: string
          papelera_en: string | null
          peso: number | null
          precio_unitario: number | null
          presupuestado_anual: Json
          proveedor_principal: string | null
          puede_comprarse: boolean
          puede_venderse: boolean
          punto_reorden: number | null
          referencia_interna: string | null
          stock_actual: number | null
          stock_maximo: number | null
          stock_minimo: number | null
          tipo: string
          ubicacion_deposito: string | null
          unidad: string
          veces_presupuestado: number
          veces_vendido: number
          vendido_anual: Json
          volumen: number | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          alerta_stock_bajo?: boolean
          busqueda?: unknown
          categoria?: string | null
          codigo: string
          codigo_barras?: string | null
          costo?: number | null
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          descripcion_venta?: string | null
          desglose_costos?: Json
          dimensiones?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          en_papelera?: boolean
          es_provisorio?: boolean
          favorito?: boolean
          id?: string
          imagen_url?: string | null
          impuesto_compra_id?: string | null
          impuesto_id?: string | null
          moneda?: string | null
          nombre: string
          notas_internas?: string | null
          origen?: string
          papelera_en?: string | null
          peso?: number | null
          precio_unitario?: number | null
          presupuestado_anual?: Json
          proveedor_principal?: string | null
          puede_comprarse?: boolean
          puede_venderse?: boolean
          punto_reorden?: number | null
          referencia_interna?: string | null
          stock_actual?: number | null
          stock_maximo?: number | null
          stock_minimo?: number | null
          tipo?: string
          ubicacion_deposito?: string | null
          unidad?: string
          veces_presupuestado?: number
          veces_vendido?: number
          vendido_anual?: Json
          volumen?: number | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          alerta_stock_bajo?: boolean
          busqueda?: unknown
          categoria?: string | null
          codigo?: string
          codigo_barras?: string | null
          costo?: number | null
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          descripcion_venta?: string | null
          desglose_costos?: Json
          dimensiones?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          en_papelera?: boolean
          es_provisorio?: boolean
          favorito?: boolean
          id?: string
          imagen_url?: string | null
          impuesto_compra_id?: string | null
          impuesto_id?: string | null
          moneda?: string | null
          nombre?: string
          notas_internas?: string | null
          origen?: string
          papelera_en?: string | null
          peso?: number | null
          precio_unitario?: number | null
          presupuestado_anual?: Json
          proveedor_principal?: string | null
          puede_comprarse?: boolean
          puede_venderse?: boolean
          punto_reorden?: number | null
          referencia_interna?: string | null
          stock_actual?: number | null
          stock_maximo?: number | null
          stock_minimo?: number | null
          tipo?: string
          ubicacion_deposito?: string | null
          unidad?: string
          veces_presupuestado?: number
          veces_vendido?: number
          vendido_anual?: Json
          volumen?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      puestos: {
        Row: {
          activo: boolean
          color: string
          creado_en: string
          descripcion: string | null
          empresa_id: string
          icono: string
          id: string
          nombre: string
          orden: number
          sector_ids: string[] | null
        }
        Insert: {
          activo?: boolean
          color?: string
          creado_en?: string
          descripcion?: string | null
          empresa_id: string
          icono?: string
          id?: string
          nombre: string
          orden?: number
          sector_ids?: string[] | null
        }
        Update: {
          activo?: boolean
          color?: string
          creado_en?: string
          descripcion?: string | null
          empresa_id?: string
          icono?: string
          id?: string
          nombre?: string
          orden?: number
          sector_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "puestos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      puestos_contacto: {
        Row: {
          activo: boolean
          creado_en: string
          empresa_id: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          empresa_id: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          creado_en?: string
          empresa_id?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "puestos_contacto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      recordatorios: {
        Row: {
          alerta_modal: boolean
          asignado_a: string
          completado: boolean
          completado_en: string | null
          creado_en: string
          creado_por: string
          descripcion: string | null
          empresa_id: string
          fecha: string
          hora: string | null
          id: string
          mensaje_whatsapp: string | null
          notificar_whatsapp: boolean | null
          recurrencia: Json | null
          repetir: string
          titulo: string
        }
        Insert: {
          alerta_modal?: boolean
          asignado_a: string
          completado?: boolean
          completado_en?: string | null
          creado_en?: string
          creado_por: string
          descripcion?: string | null
          empresa_id: string
          fecha: string
          hora?: string | null
          id?: string
          mensaje_whatsapp?: string | null
          notificar_whatsapp?: boolean | null
          recurrencia?: Json | null
          repetir?: string
          titulo: string
        }
        Update: {
          alerta_modal?: boolean
          asignado_a?: string
          completado?: boolean
          completado_en?: string | null
          creado_en?: string
          creado_por?: string
          descripcion?: string | null
          empresa_id?: string
          fecha?: string
          hora?: string | null
          id?: string
          mensaje_whatsapp?: string | null
          notificar_whatsapp?: boolean | null
          recurrencia?: Json | null
          repetir?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordatorios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      recordatorios_calendario: {
        Row: {
          creado_en: string
          empresa_id: string
          enviado: boolean
          enviado_en: string | null
          evento_id: string
          id: string
          programado_para: string
          usuario_id: string
          usuario_nombre: string | null
        }
        Insert: {
          creado_en?: string
          empresa_id: string
          enviado?: boolean
          enviado_en?: string | null
          evento_id: string
          id?: string
          programado_para: string
          usuario_id: string
          usuario_nombre?: string | null
        }
        Update: {
          creado_en?: string
          empresa_id?: string
          enviado?: boolean
          enviado_en?: string | null
          evento_id?: string
          id?: string
          programado_para?: string
          usuario_id?: string
          usuario_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recordatorios_calendario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordatorios_calendario_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_calendario"
            referencedColumns: ["id"]
          },
        ]
      }
      recorrido_paradas: {
        Row: {
          contacto_id: string | null
          contacto_nombre: string | null
          creado_en: string
          creado_por: string | null
          direccion_id: string | null
          direccion_lat: number | null
          direccion_lng: number | null
          direccion_texto: string | null
          distancia_km: number | null
          duracion_viaje_min: number | null
          estado: string
          fecha_completada: string | null
          fecha_inicio: string | null
          fecha_llegada: string | null
          hora_estimada_llegada: string | null
          id: string
          motivo: string | null
          notas: string | null
          orden: number
          recorrido_id: string
          tipo: string
          titulo: string | null
          visita_id: string | null
        }
        Insert: {
          contacto_id?: string | null
          contacto_nombre?: string | null
          creado_en?: string
          creado_por?: string | null
          direccion_id?: string | null
          direccion_lat?: number | null
          direccion_lng?: number | null
          direccion_texto?: string | null
          distancia_km?: number | null
          duracion_viaje_min?: number | null
          estado?: string
          fecha_completada?: string | null
          fecha_inicio?: string | null
          fecha_llegada?: string | null
          hora_estimada_llegada?: string | null
          id?: string
          motivo?: string | null
          notas?: string | null
          orden?: number
          recorrido_id: string
          tipo?: string
          titulo?: string | null
          visita_id?: string | null
        }
        Update: {
          contacto_id?: string | null
          contacto_nombre?: string | null
          creado_en?: string
          creado_por?: string | null
          direccion_id?: string | null
          direccion_lat?: number | null
          direccion_lng?: number | null
          direccion_texto?: string | null
          distancia_km?: number | null
          duracion_viaje_min?: number | null
          estado?: string
          fecha_completada?: string | null
          fecha_inicio?: string | null
          fecha_llegada?: string | null
          hora_estimada_llegada?: string | null
          id?: string
          motivo?: string | null
          notas?: string | null
          orden?: number
          recorrido_id?: string
          tipo?: string
          titulo?: string | null
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recorrido_paradas_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorrido_paradas_direccion_id_fkey"
            columns: ["direccion_id"]
            isOneToOne: false
            referencedRelation: "contacto_direcciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorrido_paradas_recorrido_id_fkey"
            columns: ["recorrido_id"]
            isOneToOne: false
            referencedRelation: "recorridos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorrido_paradas_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      recorridos: {
        Row: {
          actualizado_en: string
          asignado_a: string
          asignado_nombre: string
          config: Json
          creado_en: string
          creado_por: string
          distancia_total_km: number | null
          duracion_total_min: number | null
          empresa_id: string
          en_papelera: boolean
          estado: string
          fecha: string
          hora_salida_planificada: string | null
          id: string
          notas: string | null
          origen_lat: number | null
          origen_lng: number | null
          origen_texto: string | null
          papelera_en: string | null
          paradas_completadas: number
          total_paradas: number
          total_visitas: number
          visitas_completadas: number
        }
        Insert: {
          actualizado_en?: string
          asignado_a: string
          asignado_nombre: string
          config?: Json
          creado_en?: string
          creado_por: string
          distancia_total_km?: number | null
          duracion_total_min?: number | null
          empresa_id: string
          en_papelera?: boolean
          estado?: string
          fecha: string
          hora_salida_planificada?: string | null
          id?: string
          notas?: string | null
          origen_lat?: number | null
          origen_lng?: number | null
          origen_texto?: string | null
          papelera_en?: string | null
          paradas_completadas?: number
          total_paradas?: number
          total_visitas?: number
          visitas_completadas?: number
        }
        Update: {
          actualizado_en?: string
          asignado_a?: string
          asignado_nombre?: string
          config?: Json
          creado_en?: string
          creado_por?: string
          distancia_total_km?: number | null
          duracion_total_min?: number | null
          empresa_id?: string
          en_papelera?: boolean
          estado?: string
          fecha?: string
          hora_salida_planificada?: string | null
          id?: string
          notas?: string | null
          origen_lat?: number | null
          origen_lng?: number | null
          origen_texto?: string | null
          papelera_en?: string | null
          paradas_completadas?: number
          total_paradas?: number
          total_visitas?: number
          visitas_completadas?: number
        }
        Relationships: [
          {
            foreignKeyName: "recorridos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      reglas_correo: {
        Row: {
          acciones: Json
          activa: boolean | null
          actualizado_en: string
          condiciones: Json
          creado_en: string
          creado_por: string | null
          empresa_id: string
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          acciones?: Json
          activa?: boolean | null
          actualizado_en?: string
          condiciones?: Json
          creado_en?: string
          creado_por?: string | null
          empresa_id: string
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          acciones?: Json
          activa?: boolean | null
          actualizado_en?: string
          condiciones?: Json
          creado_en?: string
          creado_por?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reglas_correo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      respuestas_rapidas_correo: {
        Row: {
          activo: boolean
          actualizado_en: string
          asunto: string | null
          categoria: string | null
          contenido: string
          contenido_html: string | null
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          disponible_para: string
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          id: string
          modulos: string[] | null
          nombre: string
          orden: number
          roles_permitidos: string[] | null
          usuarios_permitidos: string[] | null
          variables: Json | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          asunto?: string | null
          categoria?: string | null
          contenido: string
          contenido_html?: string | null
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          disponible_para?: string
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          id?: string
          modulos?: string[] | null
          nombre: string
          orden?: number
          roles_permitidos?: string[] | null
          usuarios_permitidos?: string[] | null
          variables?: Json | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          asunto?: string | null
          categoria?: string | null
          contenido?: string
          contenido_html?: string | null
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          disponible_para?: string
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          id?: string
          modulos?: string[] | null
          nombre?: string
          orden?: number
          roles_permitidos?: string[] | null
          usuarios_permitidos?: string[] | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_respuesta_correo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      respuestas_rapidas_whatsapp: {
        Row: {
          activo: boolean
          actualizado_en: string
          asunto: string | null
          categoria: string | null
          contenido: string
          contenido_html: string | null
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          disponible_para: string
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          id: string
          modulos: string[] | null
          nombre: string
          orden: number
          roles_permitidos: string[] | null
          usuarios_permitidos: string[] | null
          variables: Json | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          asunto?: string | null
          categoria?: string | null
          contenido: string
          contenido_html?: string | null
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          disponible_para?: string
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          id?: string
          modulos?: string[] | null
          nombre: string
          orden?: number
          roles_permitidos?: string[] | null
          usuarios_permitidos?: string[] | null
          variables?: Json | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          asunto?: string | null
          categoria?: string | null
          contenido?: string
          contenido_html?: string | null
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          disponible_para?: string
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          id?: string
          modulos?: string[] | null
          nombre?: string
          orden?: number
          roles_permitidos?: string[] | null
          usuarios_permitidos?: string[] | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_respuesta_whatsapp_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      rubros_contacto: {
        Row: {
          activo: boolean
          creado_en: string
          empresa_id: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          empresa_id: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          creado_en?: string
          empresa_id?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubros_contacto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sectores: {
        Row: {
          activo: boolean
          color: string
          creado_en: string
          empresa_id: string
          es_predefinido: boolean
          icono: string
          id: string
          jefe_id: string | null
          nombre: string
          orden: number
          padre_id: string | null
          turno_id: string | null
        }
        Insert: {
          activo?: boolean
          color?: string
          creado_en?: string
          empresa_id: string
          es_predefinido?: boolean
          icono?: string
          id?: string
          jefe_id?: string | null
          nombre: string
          orden?: number
          padre_id?: string | null
          turno_id?: string | null
        }
        Update: {
          activo?: boolean
          color?: string
          creado_en?: string
          empresa_id?: string
          es_predefinido?: boolean
          icono?: string
          id?: string
          jefe_id?: string | null
          nombre?: string
          orden?: number
          padre_id?: string | null
          turno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sectores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectores_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
        ]
      }
      secuencias: {
        Row: {
          componentes: Json | null
          digitos: number
          empresa_id: string
          entidad: string
          prefijo: string
          reinicio: string | null
          siguiente: number
          ultimo_reinicio: string | null
        }
        Insert: {
          componentes?: Json | null
          digitos?: number
          empresa_id: string
          entidad: string
          prefijo?: string
          reinicio?: string | null
          siguiente?: number
          ultimo_reinicio?: string | null
        }
        Update: {
          componentes?: Json | null
          digitos?: number
          empresa_id?: string
          entidad?: string
          prefijo?: string
          reinicio?: string | null
          siguiente?: number
          ultimo_reinicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secuencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_fichaje: {
        Row: {
          creado_en: string
          empresa_id: string
          es_apelacion: boolean
          estado: string
          fecha: string
          hora_entrada: string | null
          hora_salida: string | null
          id: string
          motivo: string
          motivo_apelacion: string | null
          notas_resolucion: string | null
          resuelto_en: string | null
          resuelto_por: string | null
          solicitante_id: string
          solicitud_original_id: string | null
          terminal_nombre: string | null
        }
        Insert: {
          creado_en?: string
          empresa_id: string
          es_apelacion?: boolean
          estado?: string
          fecha: string
          hora_entrada?: string | null
          hora_salida?: string | null
          id?: string
          motivo: string
          motivo_apelacion?: string | null
          notas_resolucion?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          solicitante_id: string
          solicitud_original_id?: string | null
          terminal_nombre?: string | null
        }
        Update: {
          creado_en?: string
          empresa_id?: string
          es_apelacion?: boolean
          estado?: string
          fecha?: string
          hora_entrada?: string | null
          hora_salida?: string | null
          id?: string
          motivo?: string
          motivo_apelacion?: string | null
          notas_resolucion?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          solicitante_id?: string
          solicitud_original_id?: string | null
          terminal_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_fichaje_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_fichaje_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "miembros"
            referencedColumns: ["id"]
          },
        ]
      }
      suscripciones: {
        Row: {
          actualizado_en: string
          cancelado_en: string | null
          creado_en: string
          empresa_id: string
          estado: string
          id: string
          inicio_en: string
          limite_contactos: number | null
          limite_storage_mb: number | null
          limite_usuarios: number | null
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_hasta: string | null
          vence_en: string | null
        }
        Insert: {
          actualizado_en?: string
          cancelado_en?: string | null
          creado_en?: string
          empresa_id: string
          estado?: string
          id?: string
          inicio_en?: string
          limite_contactos?: number | null
          limite_storage_mb?: number | null
          limite_usuarios?: number | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_hasta?: string | null
          vence_en?: string | null
        }
        Update: {
          actualizado_en?: string
          cancelado_en?: string | null
          creado_en?: string
          empresa_id?: string
          estado?: string
          id?: string
          inicio_en?: string
          limite_contactos?: number | null
          limite_storage_mb?: number | null
          limite_usuarios?: number | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_hasta?: string | null
          vence_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suscripciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      suscripciones_push: {
        Row: {
          activa: boolean
          auth: string
          creada_en: string
          empresa_id: string
          endpoint: string
          id: string
          p256dh: string
          ultima_notificacion_en: string | null
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          activa?: boolean
          auth: string
          creada_en?: string
          empresa_id: string
          endpoint: string
          id?: string
          p256dh: string
          ultima_notificacion_en?: string | null
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          activa?: boolean
          auth?: string
          creada_en?: string
          empresa_id?: string
          endpoint?: string
          id?: string
          p256dh?: string
          ultima_notificacion_en?: string | null
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suscripciones_push_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas_orden: {
        Row: {
          actualizado_en: string
          asignados: Json
          asignados_ids: string[]
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          descripcion: string | null
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          estado: string
          fecha_completada: string | null
          fecha_vencimiento: string | null
          id: string
          notas_cancelacion: string | null
          orden: number
          orden_trabajo_id: string
          prioridad: string
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          asignados?: Json
          asignados_ids?: string[]
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          estado?: string
          fecha_completada?: string | null
          fecha_vencimiento?: string | null
          id?: string
          notas_cancelacion?: string | null
          orden?: number
          orden_trabajo_id: string
          prioridad?: string
          titulo: string
        }
        Update: {
          actualizado_en?: string
          asignados?: Json
          asignados_ids?: string[]
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          descripcion?: string | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          estado?: string
          fecha_completada?: string | null
          fecha_vencimiento?: string | null
          id?: string
          notas_cancelacion?: string | null
          orden?: number
          orden_trabajo_id?: string
          prioridad?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_orden_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_orden_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
        ]
      }
      terminales_kiosco: {
        Row: {
          activo: boolean
          creado_en: string
          creado_por: string | null
          empresa_id: string
          id: string
          nombre: string
          revocado_en: string | null
          revocado_por: string | null
          token_hash: string | null
          ultimo_ping: string | null
          zona_horaria: string | null
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          creado_por?: string | null
          empresa_id: string
          id?: string
          nombre: string
          revocado_en?: string | null
          revocado_por?: string | null
          token_hash?: string | null
          ultimo_ping?: string | null
          zona_horaria?: string | null
        }
        Update: {
          activo?: boolean
          creado_en?: string
          creado_por?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          revocado_en?: string | null
          revocado_por?: string | null
          token_hash?: string | null
          ultimo_ping?: string | null
          zona_horaria?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terminales_kiosco_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_actividad: {
        Row: {
          abreviacion: string | null
          accion_destino: string | null
          activo: boolean
          campo_calendario: boolean
          campo_checklist: boolean
          campo_descripcion: boolean
          campo_fecha: boolean
          campo_prioridad: boolean
          campo_responsable: boolean
          clave: string
          color: string
          creado_en: string
          dias_vencimiento: number
          empresa_id: string
          es_predefinido: boolean
          es_sistema: boolean
          etiqueta: string
          evento_auto_completar: string | null
          icono: string
          id: string
          modulos_disponibles: string[]
          nota_predeterminada: string | null
          orden: number
          resumen_predeterminado: string | null
          siguiente_tipo_id: string | null
          tipo_encadenamiento: string | null
          usuario_predeterminado: string | null
        }
        Insert: {
          abreviacion?: string | null
          accion_destino?: string | null
          activo?: boolean
          campo_calendario?: boolean
          campo_checklist?: boolean
          campo_descripcion?: boolean
          campo_fecha?: boolean
          campo_prioridad?: boolean
          campo_responsable?: boolean
          clave: string
          color?: string
          creado_en?: string
          dias_vencimiento?: number
          empresa_id: string
          es_predefinido?: boolean
          es_sistema?: boolean
          etiqueta: string
          evento_auto_completar?: string | null
          icono?: string
          id?: string
          modulos_disponibles?: string[]
          nota_predeterminada?: string | null
          orden?: number
          resumen_predeterminado?: string | null
          siguiente_tipo_id?: string | null
          tipo_encadenamiento?: string | null
          usuario_predeterminado?: string | null
        }
        Update: {
          abreviacion?: string | null
          accion_destino?: string | null
          activo?: boolean
          campo_calendario?: boolean
          campo_checklist?: boolean
          campo_descripcion?: boolean
          campo_fecha?: boolean
          campo_prioridad?: boolean
          campo_responsable?: boolean
          clave?: string
          color?: string
          creado_en?: string
          dias_vencimiento?: number
          empresa_id?: string
          es_predefinido?: boolean
          es_sistema?: boolean
          etiqueta?: string
          evento_auto_completar?: string | null
          icono?: string
          id?: string
          modulos_disponibles?: string[]
          nota_predeterminada?: string | null
          orden?: number
          resumen_predeterminado?: string | null
          siguiente_tipo_id?: string | null
          tipo_encadenamiento?: string | null
          usuario_predeterminado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tipos_actividad_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tipos_actividad_siguiente_tipo_id_fkey"
            columns: ["siguiente_tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_actividad"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_contacto: {
        Row: {
          activo: boolean
          clave: string
          color: string
          creado_en: string
          empresa_id: string
          es_predefinido: boolean
          etiqueta: string
          icono: string
          id: string
          orden: number
          puede_tener_hijos: boolean
        }
        Insert: {
          activo?: boolean
          clave: string
          color?: string
          creado_en?: string
          empresa_id: string
          es_predefinido?: boolean
          etiqueta: string
          icono?: string
          id?: string
          orden?: number
          puede_tener_hijos?: boolean
        }
        Update: {
          activo?: boolean
          clave?: string
          color?: string
          creado_en?: string
          empresa_id?: string
          es_predefinido?: boolean
          etiqueta?: string
          icono?: string
          id?: string
          orden?: number
          puede_tener_hijos?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tipos_contacto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_evento_calendario: {
        Row: {
          activo: boolean
          clave: string
          color: string
          creado_en: string
          duracion_default: number
          empresa_id: string
          es_predefinido: boolean
          etiqueta: string
          icono: string
          id: string
          orden: number
          todo_el_dia_default: boolean
        }
        Insert: {
          activo?: boolean
          clave: string
          color?: string
          creado_en?: string
          duracion_default?: number
          empresa_id: string
          es_predefinido?: boolean
          etiqueta: string
          icono?: string
          id?: string
          orden?: number
          todo_el_dia_default?: boolean
        }
        Update: {
          activo?: boolean
          clave?: string
          color?: string
          creado_en?: string
          duracion_default?: number
          empresa_id?: string
          es_predefinido?: boolean
          etiqueta?: string
          icono?: string
          id?: string
          orden?: number
          todo_el_dia_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tipos_evento_calendario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_relacion: {
        Row: {
          activo: boolean
          clave: string
          creado_en: string
          empresa_id: string
          es_predefinido: boolean
          etiqueta: string
          etiqueta_inversa: string
          id: string
        }
        Insert: {
          activo?: boolean
          clave: string
          creado_en?: string
          empresa_id: string
          es_predefinido?: boolean
          etiqueta: string
          etiqueta_inversa: string
          id?: string
        }
        Update: {
          activo?: boolean
          clave?: string
          creado_en?: string
          empresa_id?: string
          es_predefinido?: boolean
          etiqueta?: string
          etiqueta_inversa?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_relacion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos_laborales: {
        Row: {
          actualizado_en: string
          creado_en: string
          dias: Json
          empresa_id: string
          es_default: boolean
          flexible: boolean
          id: string
          nombre: string
          orden: number
          tolerancia_min: number
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          dias?: Json
          empresa_id: string
          es_default?: boolean
          flexible?: boolean
          id?: string
          nombre: string
          orden?: number
          tolerancia_min?: number
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          dias?: Json
          empresa_id?: string
          es_default?: boolean
          flexible?: boolean
          id?: string
          nombre?: string
          orden?: number
          tolerancia_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "turnos_laborales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      uso_storage: {
        Row: {
          actualizado_en: string
          bucket: string
          bytes_usados: number
          cantidad_archivos: number
          empresa_id: string
          id: string
        }
        Insert: {
          actualizado_en?: string
          bucket: string
          bytes_usados?: number
          cantidad_archivos?: number
          empresa_id: string
          id?: string
        }
        Update: {
          actualizado_en?: string
          bucket?: string
          bytes_usados?: number
          cantidad_archivos?: number
          empresa_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uso_storage_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          actividad_id: string | null
          actividad_origen_id: string | null
          actualizado_en: string
          asignado_a: string | null
          asignado_nombre: string | null
          aviso_en_camino_enviado_at: string | null
          aviso_en_camino_eta_min: number | null
          aviso_llegada_enviado_at: string | null
          checklist: Json
          contacto_id: string
          contacto_nombre: string
          creado_en: string
          creado_por: string
          creado_por_nombre: string | null
          direccion_id: string | null
          direccion_lat: number | null
          direccion_lng: number | null
          direccion_texto: string | null
          duracion_estimada_min: number | null
          duracion_real_min: number | null
          editado_por: string | null
          editado_por_nombre: string | null
          empresa_id: string
          en_papelera: boolean
          estado: string
          fecha_completada: string | null
          fecha_inicio: string | null
          fecha_llegada: string | null
          fecha_programada: string
          id: string
          motivo: string | null
          notas: string | null
          notas_registro: string | null
          papelera_en: string | null
          prioridad: string
          recibe_contacto_id: string | null
          recibe_nombre: string | null
          recibe_telefono: string | null
          registro_lat: number | null
          registro_lng: number | null
          registro_precision_m: number | null
          resultado: string | null
          temperatura: string | null
          tiene_hora_especifica: boolean
          vinculos: Json
        }
        Insert: {
          actividad_id?: string | null
          actividad_origen_id?: string | null
          actualizado_en?: string
          asignado_a?: string | null
          asignado_nombre?: string | null
          aviso_en_camino_enviado_at?: string | null
          aviso_en_camino_eta_min?: number | null
          aviso_llegada_enviado_at?: string | null
          checklist?: Json
          contacto_id: string
          contacto_nombre: string
          creado_en?: string
          creado_por: string
          creado_por_nombre?: string | null
          direccion_id?: string | null
          direccion_lat?: number | null
          direccion_lng?: number | null
          direccion_texto?: string | null
          duracion_estimada_min?: number | null
          duracion_real_min?: number | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id: string
          en_papelera?: boolean
          estado?: string
          fecha_completada?: string | null
          fecha_inicio?: string | null
          fecha_llegada?: string | null
          fecha_programada: string
          id?: string
          motivo?: string | null
          notas?: string | null
          notas_registro?: string | null
          papelera_en?: string | null
          prioridad?: string
          recibe_contacto_id?: string | null
          recibe_nombre?: string | null
          recibe_telefono?: string | null
          registro_lat?: number | null
          registro_lng?: number | null
          registro_precision_m?: number | null
          resultado?: string | null
          temperatura?: string | null
          tiene_hora_especifica?: boolean
          vinculos?: Json
        }
        Update: {
          actividad_id?: string | null
          actividad_origen_id?: string | null
          actualizado_en?: string
          asignado_a?: string | null
          asignado_nombre?: string | null
          aviso_en_camino_enviado_at?: string | null
          aviso_en_camino_eta_min?: number | null
          aviso_llegada_enviado_at?: string | null
          checklist?: Json
          contacto_id?: string
          contacto_nombre?: string
          creado_en?: string
          creado_por?: string
          creado_por_nombre?: string | null
          direccion_id?: string | null
          direccion_lat?: number | null
          direccion_lng?: number | null
          direccion_texto?: string | null
          duracion_estimada_min?: number | null
          duracion_real_min?: number | null
          editado_por?: string | null
          editado_por_nombre?: string | null
          empresa_id?: string
          en_papelera?: boolean
          estado?: string
          fecha_completada?: string | null
          fecha_inicio?: string | null
          fecha_llegada?: string | null
          fecha_programada?: string
          id?: string
          motivo?: string | null
          notas?: string | null
          notas_registro?: string | null
          papelera_en?: string | null
          prioridad?: string
          recibe_contacto_id?: string | null
          recibe_nombre?: string | null
          recibe_telefono?: string | null
          registro_lat?: number | null
          registro_lng?: number | null
          registro_precision_m?: number | null
          resultado?: string | null
          temperatura?: string | null
          tiene_hora_especifica?: boolean
          vinculos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "visitas_actividad_origen_id_fkey"
            columns: ["actividad_origen_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_direccion_id_fkey"
            columns: ["direccion_id"]
            isOneToOne: false
            referencedRelation: "contacto_direcciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_recibe_contacto_id_fkey"
            columns: ["recibe_contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      vistas_guardadas: {
        Row: {
          actualizado_en: string
          creado_en: string
          empresa_id: string
          es_sistema: boolean
          estado: Json
          icono: string | null
          id: string
          modulo: string
          nombre: string
          orden: number
          predefinida: boolean
          usuario_id: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          empresa_id: string
          es_sistema?: boolean
          estado?: Json
          icono?: string | null
          id?: string
          modulo: string
          nombre: string
          orden?: number
          predefinida?: boolean
          usuario_id: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          empresa_id?: string
          es_sistema?: boolean
          estado?: Json
          icono?: string | null
          id?: string
          modulo?: string
          nombre?: string
          orden?: number
          predefinida?: boolean
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistas_guardadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_programados: {
        Row: {
          canal_id: string
          conversacion_id: string | null
          creado_en: string
          creado_por: string
          destinatario: string
          empresa_id: string
          enviado_en: string | null
          enviar_en: string
          error: string | null
          estado: string
          id: string
          media_nombre: string | null
          media_url: string | null
          plantilla_componentes: Json | null
          plantilla_idioma: string | null
          plantilla_nombre: string | null
          texto: string | null
          tipo_contenido: string
          wa_message_id: string | null
        }
        Insert: {
          canal_id: string
          conversacion_id?: string | null
          creado_en?: string
          creado_por: string
          destinatario: string
          empresa_id: string
          enviado_en?: string | null
          enviar_en: string
          error?: string | null
          estado?: string
          id?: string
          media_nombre?: string | null
          media_url?: string | null
          plantilla_componentes?: Json | null
          plantilla_idioma?: string | null
          plantilla_nombre?: string | null
          texto?: string | null
          tipo_contenido?: string
          wa_message_id?: string | null
        }
        Update: {
          canal_id?: string
          conversacion_id?: string | null
          creado_en?: string
          creado_por?: string
          destinatario?: string
          empresa_id?: string
          enviado_en?: string | null
          enviar_en?: string
          error?: string | null
          estado?: string
          id?: string
          media_nombre?: string | null
          media_url?: string | null
          plantilla_componentes?: Json | null
          plantilla_idioma?: string | null
          plantilla_nombre?: string | null
          texto?: string | null
          tipo_contenido?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_programados_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales_whatsapp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_programados_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_programados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      canales_unificados: {
        Row: {
          activo: boolean | null
          actualizado_en: string | null
          config_conexion: Json | null
          creado_en: string | null
          creado_por: string | null
          empresa_id: string | null
          es_principal: boolean | null
          estado_conexion: string | null
          id: string | null
          modulos_disponibles: string[] | null
          nombre: string | null
          proveedor: string | null
          sync_cursor: Json | null
          tipo: string | null
          ultima_sincronizacion: string | null
          ultimo_error: string | null
        }
        Relationships: []
      }
      movimientos_financieros_v: {
        Row: {
          actualizado_en: string | null
          categoria_contable_id: string | null
          centro_costo_id: string | null
          concepto_adicional: string | null
          cotizacion_cambio: number | null
          creado_en: string | null
          cuota_id: string | null
          descripcion: string | null
          empresa_id: string | null
          entidad_referencia_id: string | null
          entidad_referencia_tipo: string | null
          estado_conciliacion: string | null
          fecha_contable: string | null
          fecha_pago: string | null
          id: string | null
          metodo: string | null
          moneda_origen: string | null
          monto_neto_empresa: number | null
          monto_origen: number | null
          monto_percepciones_origen: number | null
          monto_percepciones_total: number | null
          monto_total: number | null
          notas_contables: string | null
          orden_trabajo_id: string | null
          referencia: string | null
          registrado_por: string | null
          registrado_por_nombre: string | null
          tipo: string | null
        }
        Insert: {
          actualizado_en?: string | null
          categoria_contable_id?: string | null
          centro_costo_id?: string | null
          concepto_adicional?: string | null
          cotizacion_cambio?: number | null
          creado_en?: string | null
          cuota_id?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          entidad_referencia_id?: string | null
          entidad_referencia_tipo?: never
          estado_conciliacion?: string | null
          fecha_contable?: never
          fecha_pago?: string | null
          id?: string | null
          metodo?: string | null
          moneda_origen?: string | null
          monto_neto_empresa?: never
          monto_origen?: number | null
          monto_percepciones_origen?: number | null
          monto_percepciones_total?: never
          monto_total?: number | null
          notas_contables?: string | null
          orden_trabajo_id?: string | null
          referencia?: string | null
          registrado_por?: string | null
          registrado_por_nombre?: string | null
          tipo?: never
        }
        Update: {
          actualizado_en?: string | null
          categoria_contable_id?: string | null
          centro_costo_id?: string | null
          concepto_adicional?: string | null
          cotizacion_cambio?: number | null
          creado_en?: string | null
          cuota_id?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          entidad_referencia_id?: string | null
          entidad_referencia_tipo?: never
          estado_conciliacion?: string | null
          fecha_contable?: never
          fecha_pago?: string | null
          id?: string | null
          metodo?: string | null
          moneda_origen?: string | null
          monto_neto_empresa?: never
          monto_origen?: number | null
          monto_percepciones_origen?: number | null
          monto_percepciones_total?: never
          monto_total?: number | null
          notas_contables?: string | null
          orden_trabajo_id?: string | null
          referencia?: string | null
          registrado_por?: string | null
          registrado_por_nombre?: string | null
          tipo?: never
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_pagos_cuota_id_fkey"
            columns: ["cuota_id"]
            isOneToOne: false
            referencedRelation: "presupuesto_cuotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_pagos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_pagos_orden_trabajo_id_fkey"
            columns: ["orden_trabajo_id"]
            isOneToOne: false
            referencedRelation: "ordenes_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_pagos_presupuesto_id_fkey"
            columns: ["entidad_referencia_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      buscar_conocimiento_similar: {
        Args: {
          p_embedding: string
          p_empresa_id: string
          p_limite?: number
          p_umbral?: number
        }
        Returns: {
          categoria: string
          contenido: string
          id: string
          similitud: number
          titulo: string
        }[]
      }
      cerrar_sesion_usuario: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      cerrar_todas_sesiones_usuario: {
        Args: { p_excepto_session_id?: string; p_user_id: string }
        Returns: number
      }
      contar_correos_inbox: {
        Args: { p_empresa_id: string }
        Returns: {
          canal_id: string
          estado: string
          sin_leer: number
          tiene_mensaje_entrante: boolean
          total: number
          ultimo_mensaje_es_entrante: boolean
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      empresa_actual: { Args: never; Returns: string }
      immutable_array_to_string: {
        Args: { arr: string[]; sep: string }
        Returns: string
      }
      limpiar_historial_recientes: { Args: never; Returns: undefined }
      normalizar_telefono_ar: { Args: { input: string }; Returns: string }
      obtener_sesiones_usuario: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          id: string
          ip: unknown
          updated_at: string
          user_agent: string
        }[]
      }
      recalcular_estado_cuota: {
        Args: { p_cuota_id: string }
        Returns: undefined
      }
      recalcular_totales_presupuesto: {
        Args: { p_presupuesto_id: string; p_usuario_id?: string }
        Returns: undefined
      }
      rol_actual: { Args: never; Returns: string }
      seed_config_presupuestos: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      seed_tipos_contacto: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      seed_tipos_evento_calendario: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      siguiente_codigo: {
        Args: { p_empresa_id: string; p_entidad: string }
        Returns: string
      }
      sync_direccion_perfil_a_contacto: {
        Args: {
          p_contacto_id: string
          p_direccion_jsonb: Json
          p_domicilio_text: string
        }
        Returns: undefined
      }
      sync_telefono_perfil_a_contacto: {
        Args: {
          p_contacto_id: string
          p_empresa_id: string
          p_origen: string
          p_tipo: string
          p_valor_perfil: string
        }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
