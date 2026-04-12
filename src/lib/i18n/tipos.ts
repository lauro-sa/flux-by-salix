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
    nombre_completo: string
    notas: string
    descripcion: string
    estado: string
    activo: string
    inactivo: string
    copiar: string
    descargar: string
    subir: string
    restablecer: string
    agregar: string
    quitar: string
    ver: string
    enviar: string
    guardar_cambios: string
    sin_datos: string
    opcional: string
    requerido: string
    nombre: string
    aplicar: string
    listo: string
    por_defecto: string
    sin_elementos: string
    color_personalizado: string
    emoji_personalizado: string
    pendiente: string
    nuevo: string
    fecha: string
    tipo: string
    color: string
    icono: string
    proximamente: string
    proximamente_desc: string
    limpiar: string
    codigo: string
    contacto: string
    responsable: string
    referencia: string
    web: string
    cargo: string
    rubro: string
    moneda_label: string
    idioma: string
    zona_horaria: string
    ubicacion: string
    genero: string
    domicilio: string
    documento: string
    creacion: string
    creado_por: string
    mas_recientes: string
    mas_antiguos: string
    nombre_az: string
    nombre_za: string
    sin_correo: string
    en_progreso: string
    identidad: string
    metadata: string
    laboral: string
    trabajo: string
    comercial: string
    fiscal: string
    auditoria_grupo: string
    pago_grupo: string
    origen: string
    fechas: string
    manual: string
    importacion: string
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
    nombre: string
    apellido: string
    placeholder_nombre: string
    placeholder_apellido: string
    placeholder_contrasena_minimo: string
    placeholder_repetir_contrasena: string
    error_contrasena_minimo: string
    error_contrasena_no_coinciden: string
    error_verificacion: string
    crear_cuenta: string
    crear_cuenta_desc: string
    revisa_tu_correo: string
    recuperar_desc: string
    volver_login: string
    enviar_enlace_desc: string
    enviar_enlace: string
    contrasena_actualizada: string
    redirigiendo_login: string
    nueva_contrasena_titulo: string
    nueva_contrasena_desc: string
    actualizar_contrasena: string
    email_reenviado: string
    reenviar_verificacion: string
    esperando_verificacion: string
    esperando_activacion: string
    esperando_activacion_desc: string
    layout_titulo_1: string
    layout_titulo_2: string
    layout_desc: string
    ingresa_tu_correo: string
    ingresa_tu_correo_desc: string
    continuar: string
    bienvenido_de_vuelta: string
    completa_tus_datos: string
    solo_nombre_y_contrasena: string
    usar_otro_correo: string
    no_tenes_cuenta: string
    ya_tenes_cuenta: string
  }

  // Invitación
  invitacion: {
    error_sin_token: string
    error_no_valida: string
    validando: string
    no_valida_titulo: string
    ir_login: string
    te_uniste_a: string
    activacion_pendiente: string
    invitacion_a: string
    te_invitaron_como: string
    unirse_a: string
    login_y_unirse: string
    crear_cuenta_y_unirse: string
    continuar_para_unirse: string
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
    nombre_completo: string
    datos_fiscales: string
    razon_social: string
    condicion_iva: string
    vinculaciones: string
    nueva_vinculacion: string
    tipo_relacion: string
    duplicado_detectado: string
    crear_igual: string
    provisorio: string
    guardando: string
    relaciones: string
    titulo_campo: string
    identificacion: string
    vinculado_a: string
    posicion_fiscal: string
    tipo_iibb: string
    nro_iibb: string
    limite_credito: string
    plazo_cliente: string
    plazo_proveedor: string
    rank_cliente: string
    rank_proveedor: string
    pais_fiscal: string
    puesto_rol: string
    iva_resp_inscripto: string
    iva_monotributista: string
    iva_exento: string
    iva_cons_final: string
    iva_no_responsable: string
    origen_manual: string
    origen_importacion: string
    origen_ia: string
    origen_usuario: string
    descripcion_vacia: string
    /** Acción en lote: provisorios → descartar; confirmados → eliminar (papelera) */
    descartar: string
    enviar_papelera: string
    modal_descartar_titulo_uno: string
    modal_descartar_titulo_varios: string
    modal_descartar_desc: string
    modal_papelera_titulo: string
    modal_papelera_desc_uno: string
    modal_papelera_desc_varios: string
    modal_papelera_mixto_desc: string
    toast_descartar_uno: string
    toast_descartar_varios: string
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
    crear_primera: string
    config_titulo: string
    config_desc: string
    tipos_actividad: string
    tipo_llamada: string
    tipo_reunion: string
    tipo_correo: string
    tipo_tarea: string
    tipo_visita: string
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
      en_camino: string
      en_sitio: string
      en_progreso: string
      completada: string
      cancelada: string
      reprogramada: string
    }
    fecha_programada: string
    motivo: string
    resultado: string
    direccion: string
    duracion: string
    duracion_estimada: string
    duracion_real: string
    notas: string
    fotos: string
    sin_visitas: string
    sin_visitas_desc: string
    vendedor: string
    asignado: string
    prioridad: string
    prioridades: {
      baja: string
      normal: string
      alta: string
      urgente: string
    }
    checklist: string
    registro_ubicacion: string
    estados_visita: {
      en_curso: string
    }
    planificacion: string
    sin_asignar: string
    optimizar_ruta: string
    reasignar: string
    permisos_recorrido: string
    puede_reordenar: string
    puede_cambiar_duracion: string
    puede_agregar_paradas: string
    puede_quitar_paradas: string
    puede_cancelar: string
    aplicar_a_todos: string
    visitas_del_dia: string
    duracion_total: string
    hoy: string
    manana: string
    esta_semana: string
    proxima_semana: string
    ruta_optimizada: string
    visita_reasignada: string
    listado: string
    archivadas: string
    completar: string
    cancelar_visita: string
    en_camino: string
    llegue: string
    reactivar: string
    navegar: string
    ver: string
    sin_direccion: string
    principal: string
    fiscal: string
    entrega: string
    recibe_opcional: string
    recibe_desc: string
    buscar_contacto_recibe: string
    cargar_a_mano: string
    buscar_contacto: string
    nuevo_item: string
    sin_items: string
    sin_asignar_select: string
    seleccionar_motivo: string
    otro_texto_libre: string
    escribir_motivo: string
    cargando: string
    sin_direcciones: string
    sin_visitas_previas: string
    visita: string
    visitas_label: string
    ultima: string
    minutos: string
    eliminar_visitas: string
    eliminar: string
    buscar_visitas: string
    asignadas_a_mi: string
    creadas_por_mi: string
    todas: string
    ver_archivadas: string
    borrador_desc: string
    en_curso_desc: string
    publicado_desc: string
    cerrar: string
    publicar_recorrido: string
    despublicar: string
    notificar_cambios: string
    sin_visitas_programadas: string
    recorrido_en_curso: string
    recorrido_en_curso_desc: string
    si_editar: string
    detalle_visita: string
    completada_por: string
    sin_checklist_ni_archivos: string
    archivos: string
    informacion: string
    vinculados: string
    llegaste: string
    llamar: string
    whatsapp: string
    ver_en_mapa: string
    avisar_que_llegue: string
    sin_telefono: string
    salida_y_regreso: string
    salir_desde_empresa: string
    volver_a_empresa: string
    sin_recorrido_config: string
    invertir: string
    optimizar: string
    revertir: string
    confirmar_ruta: string
    completadas: string
    en_sitio: string
  }

  // Recorrido
  recorrido: {
    titulo: string
    mi_recorrido: string
    recorrido_del_dia: string
    sin_recorrido: string
    sin_recorrido_desc: string
    paradas: string
    parada: string
    agregar_parada: string
    quitar_parada: string
    reordenar: string
    optimizar_ruta: string
    iniciar_recorrido: string
    finalizar_recorrido: string
    siguiente_parada: string
    abrir_mapa: string
    abrir_navegacion: string
    ruta_completa: string
    una_por_una: string
    progreso: string
    completadas: string
    pendientes: string
    distancia_total: string
    tiempo_estimado: string
    llegue: string
    en_camino: string
    registrar_visita: string
    tomar_foto: string
    notas: string
    punto_partida: string
    mi_ubicacion: string
    plantillas: string
    guardar_como_plantilla: string
    cargar_plantilla: string
    estados: {
      pendiente: string
      en_curso: string
      completado: string
    }
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
    condiciones_pago: string
    plazo_validez: string
    agregar_linea: string
    eliminar_linea: string
    vista_previa: string
    imprimir: string
    duplicar: string
    convertir_factura: string
    historial_estados: string
    restablecer_borrador: string
    nuevo_presupuesto: string
    email_cliente: string
    telefono_cliente: string
    cuit_dni: string
    condicion_iva_cliente: string
    direccion_cliente: string
    dirigido_a: string
    emision: string
    plazo_dias: string
    doc_origen: string
    notas_defecto: string
    condiciones_defecto: string
    tipo_condicion: string
    total_mayor: string
    total_menor: string
    cliente_az: string
    cliente_za: string
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
    categorias_prod: {
      insumos: string
      servicios: string
      equipos: string
      repuestos: string
    }
    estados_prod: {
      activo: string
      inactivo: string
      agotado: string
    }
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
    sin_plantillas_aprobadas: string
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
    nota_interna: string
    escribir_nota: string
    etiquetar: string
    exportar_conversacion: string
    copiar_mensaje: string
    reaccionar: string
    mencionar: string
    deshacer_envio: string
    no_es_spam: string
    sin_asunto: string
    seleccionar_correo: string
    fecha_hoy: string
    fecha_ayer: string
    seleccionar_conversacion: string
    sugerencia_ia: string
    borrador_ia: string
    aprobar_enviar: string
    editada: string
    solo_visible_agentes: string
    placeholder_nota_interna: string
    error_acceso_microfono: string
    pausar_grabacion: string
    continuar_grabacion: string
    nombre_canal: string
    nombre_regla: string
    regla_activa: string
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
    maniana: string
    mes: string
    semana: string
    quincenal: string
    dia: string
    anio: string
    agenda: string
    equipo: string
    evento_nuevo: string
    editar_evento: string
    sin_eventos: string
    todo_el_dia: string
    // Vistas
    vistas: {
      dia_corta: string
      semana_corta: string
      quincenal_corta: string
      mes_corta: string
      anio_corta: string
      agenda_corta: string
      equipo_corta: string
    }
    // Filtros
    todos: string
    mios: string
    filtrar: string
    tipo_evento: string
    todos_los_tipos: string
    // Campos del modal
    titulo_campo: string
    descripcion: string
    ubicacion: string
    notas: string
    inicio: string
    fin: string
    recordatorio: string
    sin_recordatorio: string
    minutos_antes: string
    hora_antes: string
    dia_antes: string
    // Visibilidad
    visibilidad: string
    publica: string
    publica_desc: string
    ocupado: string
    ocupado_desc: string
    privada: string
    privada_desc: string
    // Acciones
    completar: string
    posponer: string
    guardar_cambios: string
    crear_evento: string
    // Asignados y vinculos
    asignados: string
    agregar_asignado: string
    agregar_otro: string
    vinculaciones: string
    vincular_contacto: string
    // Drag
    arrastra_grilla: string
    mas_eventos: string
    // Recurrencia
    recurrencia: string
    // Config
    config_titulo: string
    config_desc: string
    sincronizacion: string
    festivos: string
    disponibilidad: string
    // Equipo
    cargando_miembros: string
    // Agenda
    ir_a_hoy: string
    // Mini calendario
    mini_calendario: string
    soltar_aqui: string
    ocultar: string
    // Meses y días (para i18n futuro, por ahora se usan arrays de constantes)
    meses: {
      enero: string; febrero: string; marzo: string; abril: string
      mayo: string; junio: string; julio: string; agosto: string
      septiembre: string; octubre: string; noviembre: string; diciembre: string
    }
    dias: {
      domingo: string; lunes: string; martes: string; miercoles: string
      jueves: string; viernes: string; sabado: string
    }
    // A11y
    a11y: {
      calendario_mensual: string
      calendario_semanal: string
      calendario_diario: string
      calendario_quincenal: string
      calendario_anual: string
      calendario_agenda: string
      calendario_equipo: string
      ir_dia_anterior: string
      ir_dia_siguiente: string
      ir_a_hoy: string
      vista_calendario: string
      eventos_en_dia: string
    }
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
    numero: string
    titulo_campo: string
    cliente: string
    prioridades: {
      baja: string
      media: string
      alta: string
      urgente: string
    }
    estados_orden: {
      abierta: string
      en_progreso: string
      esperando: string
      completada: string
      cancelada: string
    }
    asignado: string
    fecha: string
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
    saludos: {
      buenos_dias: string
      buenas_tardes: string
      buenas_noches: string
    }
    accesos_rapidos: string
    actividad_reciente: string
    recientes: string
    por_estado: string
    borradores: string
    sin_leer: string
    ver_todo: string
    mensajes_30d: string
    recibidos: string
    ir_al_inbox: string
    inbox_ultimos_30d: string
    label_recibidos: string
    label_enviados: string
    label_resueltas: string
    label_tiempo_resp: string
    sla_cumplido: string
    por_agente: string
    sin_datos_inbox: string
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
    estructura: {
      titulo: string
      descripcion: string
      sectores: string
      puestos: string
      agregar_sector: string
      agregar_puesto: string
      nombre_sector: string
      nombre_puesto: string
      sector_padre: string
      jefe_sector: string
      horario_de: string
    }
    regional: {
      titulo: string
      zona_horaria: string
      moneda: string
      formato_fecha: string
      separador_miles: string
      separador_decimal: string
    }
    ia: {
      titulo: string
      proveedor: string
      modelo: string
      api_key: string
      prompt_sistema: string
      guardar_key: string
      guardar_prompt: string
      probar: string
      probando: string
    }
    agente_ia: {
      nombre_agente: string
      apodo: string
      si_preguntan_bot: string
      personalidad: string
      palabras_naturales: string
      modo_activacion: string
      esperar_segundos: string
      zona_cobertura: string
      sitio_web: string
      correo_contacto: string
      horario_atencion: string
      servicios: string
      no_hacen: string
      precios_referencia: string
      instrucciones: string
      situaciones_especiales: string
      agendar_visitas: string
      icono: string
      nombre: string
      identificador: string
      tono: string
      largo_respuestas: string
      firma: string
      max_respuestas: string
      titulo_ejemplo: string
      titulo_campo: string
      categoria: string
    }
    whatsapp: {
      nombre_descriptivo: string
      numero_telefono: string
      phone_id: string
      app_id: string
      waba_id: string
      token_verificacion: string
      token_acceso: string
      clave_secreta: string
      nombre_cuenta: string
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
    marketing: string
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
    auto_ocultar: string
    plan_gratuito: string
  }

  // Usuarios
  usuarios: {
    titulo: string
    nuevo: string
    nombre: string
    apellido: string
    correo: string
    telefono: string
    rol: string
    estado: string
    activo: string
    inactivo: string
    ultimo_acceso: string
    fecha_alta: string
    invitar_usuario: string
    eliminar_usuario: string
    resetear_contrasena: string
    datos_personales: string
    datos_laborales: string
    puesto: string
    departamento: string
    fecha_ingreso: string
    fecha_nacimiento: string
    compensacion: string
    salario: string
    moneda: string
    banco: string
    cbu: string
    alias_bancario: string
    observaciones: string
    permisos: string
    sin_usuarios: string
    sin_usuarios_desc: string
    num_empleado: string
    sector: string
    telefono_personal: string
    telefono_laboral: string
    dias_semana: string
    horario: string
    turno: string
    fichaje: string
    ingreso: string
    cumpleanos: string
    flexible: string
    lv: string
    ls: string
    ld: string
    personalizado: string
    desactivar_seleccionados: string
  }

  // Aplicaciones (módulos instalables)
  aplicaciones: {
    titulo: string
    instaladas: string
    disponibles: string
    instalar: string
    desinstalar: string
    instalando: string
    desinstalando: string
    instalado: string
    no_instalado: string
    requiere_plan: string
    confirmar_desinstalar: string
    confirmar_desinstalar_desc: string
    buscar_placeholder: string
    categorias: {
      todas: string
      base: string
      operacional: string
      documentos: string
      comunicacion: string
      admin: string
      premium: string
      proximamente: string
      ventas: string
      operaciones: string
      finanzas: string
      rrhh: string
      inteligencia: string
    }
  }

  // Portal (presupuestos compartidos con clientes)
  portal: {
    titulo: string
    presupuesto: string
    aceptar: string
    rechazar: string
    firma: string
    firmar: string
    nombre_firmante: string
    firma_placeholder: string
    aceptado: string
    rechazado: string
    cancelado: string
    pendiente: string
    visto: string
    expirado: string
    emitido: string
    vencimiento: string
    subtotal_neto: string
    impuestos: string
    descuento: string
    total: string
    notas: string
    condiciones: string
    compartir: string
    copiar_enlace: string
    enviar_whatsapp: string
    enviar_correo: string
    enlace_copiado: string
    datos_transferencia: string
    pago: string
    para: string
    dirigido_a: string
    detalle: string
    cantidad: string
    precio_unitario: string
    descuento_linea: string
    referencia: string
    vendedor: string
    firma_modo_auto: string
    firma_modo_dibujar: string
    firma_modo_subir: string
    firma_instruccion: string
    firma_escriba_nombre: string
    firma_dibuje_aqui: string
    limpiar: string
    firma_quitar_imagen: string
    firma_seleccione_imagen: string
    firma_formatos: string
    whatsapp_mensaje: string
    ver_detalle: string
    llamar: string
    confirmar_rechazo: string
    generado_con_flux: string
    firmado_por: string
    // Cuotas de pago
    cuotas_pago: string
    adelanto: string
    pago_final: string
    cuota: string
    pago_total: string
    cobrada: string
    seleccione_pago: string
    monto_transferir: string
    // Comprobantes
    comprobante: string
    adjuntar_comprobante: string
    adjuntar_otro: string
    instrucciones_pago: string
    comprobante_enviado: string
    comprobante_pendiente: string
    comprobante_confirmado: string
    comprobante_rechazado: string
    // Acciones
    cancelar_aceptacion: string
    confirmar_cancelar: string
    motivo_rechazo: string
    motivo_placeholder: string
    aceptando: string
    rechazando: string
    enviando: string
    error_accion: string
    // Estados
    estado_pendiente: string
    estado_visto: string
    estado_aceptado: string
    estado_rechazado: string
    // Timeline
    timeline_enviado: string
    timeline_revisado: string
    timeline_aceptar_firmar: string
    timeline_aceptar_instruccion: string
    timeline_aceptado: string
    timeline_firmado_digital: string
    timeline_pago_confirmado: string
    timeline_comprobante_revision: string
    timeline_pendiente_pago: string
    timeline_orden_confirmada: string
    timeline_orden_trabajo: string
    timeline_pagos_completos: string
    timeline_confirma_pagos: string
    // Chat
    chat_titulo: string
    chat_vacio: string
    chat_placeholder: string
    // Expirado
    expirado_descripcion: string
  }

  // Marketing
  marketing: {
    titulo: string
    descripcion: string
  }

  // Página de documentos genérica (notas de crédito, recibos, remitos)
  documentos_page: {
    tipos_doc: {
      nota_credito: string
      recibo: string
      remito: string
    }
    contacto: string
    monto: string
    estados_doc: {
      anulado: string
    }
    fecha: string
    vencimiento: string
  }

  // Página de asistencias (tabla de registros)
  asistencias_page: {
    empleado: string
    horas: string
    estados_asist: {
      presente: string
      tardanza: string
      ausente: string
      justificado: string
    }
    ubicacion: string
  }

  // Editor de texto (toolbar)
  editor: {
    negrita: string
    italica: string
    subrayado: string
    tachado: string
    izquierda: string
    centro: string
    derecha: string
    vinetas: string
    numerada: string
    enlace: string
    quitar_enlace: string
    limpiar_formato: string
    normal: string
  }

  // Paginación y tablas
  paginacion: {
    pagina_anterior: string
    pagina_siguiente: string
    primera_pagina: string
    ultima_pagina: string
    limpiar_todo: string
    limpiar_filtro: string
    limpiar_seleccion: string
  }

  // Estados de carga
  estados_carga: {
    cargando_imagen: string
    cargando_audio: string
    cargando_video: string
    cargando_documento: string
    cargando_datos: string
    sin_datos_contacto: string
    sin_fotos_videos: string
    sin_documentos: string
    sin_reglas: string
  }

  // Acciones comunes de UI
  ui: {
    expandir: string
    contraer: string
    cambiar: string
    rotar_imagen: string
    acercar: string
    alejar: string
    restablecer_zoom: string
    sin_logo: string
    arrastar_zoom: string
    escribir_mensaje: string
    reaccionar: string
    quitar_etiqueta: string
  }
}
