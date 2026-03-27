/**
 * Sistema de internacionalización (i18n) de Flux by Salix.
 * Todos los textos visibles al usuario pasan por este sistema.
 * El idioma por defecto es español (es).
 *
 * Uso:
 *   const { t } = useTraduccion()
 *   t('comun.guardar') → "Guardar"
 */

// Idiomas soportados
export type Idioma = 'es' | 'en' | 'pt'

// Estructura de traducciones — cada sección de Flux tiene su grupo
export interface Traducciones {
  // Textos comunes usados en toda la app
  comun: {
    guardar: string
    cancelar: string
    eliminar: string
    editar: string
    crear: string
    buscar: string
    cerrar: string
    confirmar: string
    volver: string
    siguiente: string
    anterior: string
    cargando: string
    si: string
    no: string
    todos: string
    ninguno: string
    seleccionar: string
    exportar: string
    importar: string
    filtrar: string
    ordenar: string
    acciones: string
    opciones: string
    mas: string
    menos: string
    ver_mas: string
    ver_menos: string
    sin_resultados: string
    error_generico: string
    exito_guardado: string
    confirmar_eliminar: string
    confirmar_eliminar_desc: string
  }

  // Autenticación
  auth: {
    iniciar_sesion: string
    registrarse: string
    cerrar_sesion: string
    correo: string
    contrasena: string
    olvidaste_contrasena: string
    recuperar_contrasena: string
    verificar_correo: string
    verificar_correo_desc: string
    contrasena_nueva: string
    contrasena_confirmar: string
    iniciar_con_google: string
    no_tienes_cuenta: string
    ya_tienes_cuenta: string
    bienvenido: string
  }

  // Multi-empresa
  empresa: {
    titulo: string
    cambiar_empresa: string
    crear_empresa: string
    nombre: string
    descripcion: string
    logo: string
    color_marca: string
    pais: string
    slug: string
    correo_contacto: string
    telefono: string
    configuracion: string
    miembros: string
    invitar: string
    roles: {
      propietario: string
      administrador: string
      gestor: string
      vendedor: string
      supervisor: string
      empleado: string
      invitado: string
    }
  }

  // Contactos
  contactos: {
    titulo: string
    nuevo: string
    nombre: string
    apellido: string
    correo: string
    telefono: string
    whatsapp: string
    cuit: string
    dni: string
    tipo: string
    tipos: {
      cliente: string
      proveedor: string
      competidor: string
      equipo: string
      prospecto: string
      otro: string
    }
    etiquetas: string
    etapa: string
    seguidores: string
    direccion: string
    buscar_placeholder: string
    sin_contactos: string
    sin_contactos_desc: string
    importar_excel: string
    acciones_masivas: string
    vistas: {
      tabla: string
      tarjetas: string
      kanban: string
    }
  }

  // Actividades
  actividades: {
    titulo: string
    nueva: string
    titulo_campo: string
    descripcion: string
    tipo: string
    prioridad: string
    prioridades: {
      baja: string
      normal: string
      alta: string
    }
    estado: string
    estados: {
      pendiente: string
      completada: string
      vencida: string
      cancelada: string
    }
    fecha_vencimiento: string
    asignado_a: string
    vinculos: string
    sin_actividades: string
    sin_actividades_desc: string
  }

  // Visitas
  visitas: {
    titulo: string
    nueva: string
    contacto: string
    tecnico: string
    estado: string
    estados: {
      programada: string
      en_progreso: string
      completada: string
      cancelada: string
    }
    fecha_programada: string
    motivo: string
    resultado: string
    direccion: string
    duracion: string
    notas: string
    fotos: string
    sin_visitas: string
    sin_visitas_desc: string
  }

  // Documentos (presupuestos, facturas, informes)
  documentos: {
    titulo: string
    nuevo: string
    tipos: {
      presupuesto: string
      factura: string
      informe: string
      orden_trabajo: string
    }
    numero: string
    estado: string
    estados: {
      borrador: string
      enviado: string
      confirmado: string
      rechazado: string
      pagado: string
      vencido: string
      cancelado: string
    }
    cliente: string
    lineas: string
    producto: string
    cantidad: string
    precio_unitario: string
    descuento: string
    impuesto: string
    subtotal: string
    total: string
    moneda: string
    notas: string
    terminos: string
    fecha_emision: string
    fecha_vencimiento: string
    enviar: string
    descargar_pdf: string
    sin_documentos: string
    sin_documentos_desc: string
  }

  // Productos
  productos: {
    titulo: string
    nuevo: string
    nombre: string
    descripcion: string
    codigo: string
    precio_costo: string
    precio_venta: string
    stock: string
    categoria: string
    unidad_medida: string
    activo: string
    sin_productos: string
    sin_productos_desc: string
  }

  // Inbox (mensajería omnicanal)
  inbox: {
    titulo: string
    canales: { whatsapp: string; correo: string; interno: string }
    conversaciones: string
    sin_conversaciones: string
    sin_conversaciones_desc: string
    todas: string
    abiertas: string
    en_espera: string
    resueltas: string
    spam: string
    sin_asignar: string
    asignado_a: string
    asignar: string
    transferir: string
    estado: { abierta: string; en_espera: string; resuelta: string; spam: string }
    prioridad: { baja: string; normal: string; alta: string; urgente: string }
    escribir_mensaje: string
    enviar: string
    adjuntar: string
    grabar_audio: string
    detener_grabacion: string
    transcribiendo: string
    responder: string
    responder_todos: string
    reenviar: string
    marcar_leido: string
    marcar_no_leido: string
    archivar: string
    eliminar: string
    no_leidos: string
    de: string
    para: string
    cc: string
    cco: string
    asunto: string
    bandeja_compartida: string
    bandeja_personal: string
    redactar: string
    borradores: string
    enviados: string
    canales_titulo: string
    mensajes_directos: string
    crear_canal: string
    nuevo_mensaje: string
    miembros: string
    agregar_miembro: string
    hilo: string
    respuestas_en_hilo: string
    silenciar: string
    info_contacto: string
    historial: string
    archivos_compartidos: string
    sin_contacto: string
    vincular_contacto: string
    tiempo_respuesta: string
    sin_responder: string
    sla_vencido: string
    plantillas: string
    usar_plantilla: string
    sin_plantillas: string
    config: {
      titulo: string
      general: string
      whatsapp: string
      correo: string
      interno: string
      plantillas_whatsapp: string
      plantillas_correo: string
      asignacion: string
      sla: string
      notificaciones: string
      canales_conectados: string
      agregar_canal: string
      conectar: string
      desconectar: string
      probar_conexion: string
      estado_conectado: string
      estado_desconectado: string
      estado_error: string
    }
    notificacion_nuevo: string
    notificacion_asignacion: string
    notificacion_mencion: string
  }

  // Asistencias y fichaje
  asistencias: {
    titulo: string
    fichaje: string
    entrada: string
    salida: string
    almuerzo: string
    particular: string
    estados: {
      activo: string
      almuerzo: string
      particular: string
      cerrado: string
      auto_cerrado: string
    }
    metodos: {
      manual: string
      kiosco: string
      automatico: string
    }
    jornada_actual: string
    tiempo_transcurrido: string
    iniciar_almuerzo: string
    fin_almuerzo: string
    salida_particular: string
    volver: string
    matriz: string
    feriados: string
    sin_registros: string
  }

  // Calendario
  calendario: {
    titulo: string
    hoy: string
    mes: string
    semana: string
    dia: string
    evento_nuevo: string
    sin_eventos: string
  }

  // Órdenes de trabajo
  ordenes: {
    titulo: string
    nueva: string
    etapas: string
    progreso: string
    asignados: string
    sin_ordenes: string
    sin_ordenes_desc: string
  }

  // Auditoría
  auditoria: {
    titulo: string
    accion: string
    acciones: {
      crear: string
      editar: string
      eliminar: string
    }
    recurso: string
    usuario: string
    fecha: string
    cambios: string
    antes: string
    despues: string
  }

  // Dashboard
  dashboard: {
    titulo: string
    bienvenido: string
    widgets: {
      reloj: string
      jornada: string
      actividades_pendientes: string
      agenda_hoy: string
      mensajes_sin_leer: string
    }
    metricas: string
  }

  // Configuración (secciones)
  configuracion: {
    titulo: string
    secciones: {
      general: string
      pipeline: string
      actividades: string
      contactos: string
      documentos: string
      asistencias: string
      whatsapp: string
      correo: string
      agente_ia: string
      asistente_ia: string
      integraciones: string
    }
    pipeline: {
      titulo: string
      descripcion: string
      etapas: string
      agregar_etapa: string
      nombre_etapa: string
      color: string
    }
    numeracion: {
      titulo: string
      descripcion: string
      prefijo: string
      separador: string
      ancho_secuencial: string
      reinicio: string
      opciones_reinicio: {
        nunca: string
        anual: string
        mensual: string
      }
      vista_previa: string
    }
  }

  // Notificaciones
  notificaciones: {
    titulo: string
    sin_notificaciones: string
    marcar_leida: string
    marcar_todas_leidas: string
  }

  // Navegación y layout
  navegacion: {
    inicio: string
    contactos: string
    actividades: string
    visitas: string
    documentos: string
    productos: string
    inbox: string
    asistencias: string
    calendario: string
    ordenes: string
    auditoria: string
    configuracion: string
    vitrina: string
    recorrido: string
    presupuestos: string
    informes: string
    papelera: string
    usuarios: string
    aplicaciones: string
    documentacion: string
  }

  // Toolbar flotante de selección de texto
  toolbar: {
    copiar: string
    mejorar_ia: string
    sugerencias_ia: string
    reformulando: string
    error_mejora: string
    reintentar: string
    tono: string
    tonos: {
      ventas: string
      tecnico: string
      formal: string
      cercano: string
    }
    etiquetas: {
      corregido: string
      formal: string
      tecnico: string
    }
    min_caracteres: string
  }

  // Sidebar — textos propios de la barra lateral
  sidebar: {
    secciones: {
      principal: string
      documentos: string
      admin: string
      otros: string
      empresa: string
    }
    empresas: string
    agregar_empresa: string
    ocultar: string
    deshabilitar: string
    desinstalar: string
    plan_gratuito: string
  }
}
