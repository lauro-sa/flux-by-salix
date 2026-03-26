# Sistema de Permisos y Roles — SalixCRM

## Arquitectura General

- **Multi-tenant**: cada empresa tiene sus usuarios aislados en `/empresas/{empresaId}/usuarios/{uid}`
- **Permisos granulares por módulo + acción**, con defaults por rol
- **Custom Claims en Firebase Auth** para validación rápida en Security Rules sin leer Firestore
- **Propietario absoluto**: nunca restringible, único que puede editar permisos de otros

---

## Roles Base (4 niveles)

| Rol | Descripción |
|-----|-------------|
| `propietario` | Acceso total, nunca restringible. Único que puede editar permisos de otros |
| `administrador` | Similar a propietario pero sin eliminar usuarios ni editar config de empresa |
| `colaborador` | Acceso limitado (solo lo propio en la mayoría de módulos) |
| `empleado` | Alias legacy de colaborador |

---

## Permisos Granulares (Módulo + Acción)

Cada módulo tiene un array de acciones posibles. Si el usuario tiene la acción en su array, tiene el permiso.

### Módulos operacionales
```
contactos:       [ver_propio, ver_todos, crear, editar, eliminar]
visitas:         [ver_propio, ver_todos, crear, editar, eliminar, completar]
actividades:     [ver_propio, ver_todos, crear, editar, eliminar]
calendario:      [ver, crear, editar, eliminar]
recorrido:       [ver_recorrido, autoasignar, coordinar]
asistencias:     [ver_propio, marcar, ver_todos, editar, eliminar]
productos:       [ver, crear, editar, eliminar]
```

### Documentos
```
presupuestos:    [ver_propio, ver_todos, crear, editar, eliminar, enviar]
facturas:        [ver_propio, ver_todos, crear, editar, eliminar, enviar]
informes:        [ver_propio, ver_todos, crear, editar, eliminar, enviar]
ordenes_trabajo: [ver_propio, ver_todos, crear, editar, eliminar, completar_etapa]
```

### Comunicación (granular por canal)
```
inbox_whatsapp:  [ver_propio, ver_todos, enviar]
inbox_correo:    [ver_propio, ver_todos, enviar]
inbox_interno:   [ver_propio, ver_todos, enviar]
```

### Administración
```
usuarios:        [ver, invitar, aprobar, editar, eliminar]
empresa:         [ver, editar]
configuracion:   [ver, editar]
auditoria:       [ver]
```

### Configuración por módulo
```
config_empresa:         [ver, editar]
config_contactos:       [ver, editar]
config_visitas:         [ver, editar]
config_actividades:     [ver, editar]
config_calendario:      [ver, editar]
config_presupuestos:    [ver, editar]
config_facturas:        [ver, editar]
config_informes:        [ver, editar]
config_ordenes_trabajo: [ver, editar]
config_usuarios:        [ver, editar]
config_asistencias:     [ver, editar]
config_productos:       [ver, editar]
config_inbox:           [ver, editar]
```

---

## Lógica de Resolución de Permisos

```
1. Si el usuario es propietario → acceso total siempre (hardcodeado)
2. Si tiene campo `permisos` personalizado en Firestore → usa esos
3. Si no tiene campo `permisos` → usa los defaults del rol
```

### Permisos por defecto por rol

**Propietario**: Acceso total a todos los módulos y todas las acciones.

**Administrador**: Similar a propietario PERO:
- `usuarios`: solo [ver, aprobar, editar] (sin invitar ni eliminar)
- `empresa`: solo [ver] (sin editar)
- `configuracion`: solo [ver] (sin editar)

**Colaborador / Empleado**: Acceso limitado:
- `contactos`: [ver_propio]
- `visitas`: [ver_propio, completar]
- `actividades`: [ver_propio, crear]
- `calendario`: [ver, crear, editar, eliminar]
- `asistencias`: [ver_propio, marcar]
- `inbox_interno`: [ver_propio, enviar]
- `usuarios`, `empresa`, `configuracion`, `auditoria`: sin acceso

---

## Documento de Usuario en Firestore

Colección: `/empresas/{empresaId}/usuarios/{uid}`

```json
{
  "nombre": "Juan Pérez",
  "correo": "juan@empresa.com",
  "rol": "colaborador",
  "estado": "activo",

  "permisos": {
    "contactos": ["ver_propio", "ver_todos", "crear"],
    "visitas": ["ver_propio", "completar"],
    "actividades": ["ver_propio", "crear", "editar"],
    "usuarios": [],
    "empresa": []
  },

  "permisosAuditoria": {
    "contactos": {
      "editadoPor": "uid_del_propietario",
      "editadoPorNombre": "Admin Pérez",
      "editadoEn": "2025-12-01T14:30:00Z"
    },
    "_revocacionTotal": {
      "ejecutadoPor": "uid",
      "ejecutadoPorNombre": "Admin Pérez",
      "ejecutadoEn": "2025-12-01T...",
      "motivo": "Salida de empresa"
    }
  }
}
```

**Nota**: Si `permisos` es `null` o no existe, se usan los defaults del rol. Si existe, es un override completo.

---

## Custom Claims en Firebase Auth

```json
{
  "empresaId": "emp123",
  "rol": "colaborador"
}
```

Se sincronizan automáticamente con Cloud Functions cuando:
- Se crea un usuario en una empresa (trigger `onDocumentCreated`)
- Cambia el rol (trigger `onDocumentUpdated`)
- El usuario cambia de empresa activa (callable `cambiarEmpresaActiva`)

---

## Security Rules (Firestore)

Las Security Rules validan **pertenencia a empresa** usando custom claims (sin lecturas extra a Firestore):

```
function esDeEmpresa(empresaId) {
  return request.auth.token.empresaId == empresaId
}

function esAdmin(empresaId) {
  return request.auth.token.rol in ['propietario', 'administrador']
}
```

**Los permisos granulares NO se validan en Security Rules** — se validan en la UI con `tienePermiso()`. Las rules solo aseguran que el usuario pertenece a la empresa.

Excepción: el campo `permisos` de un usuario solo puede ser editado por un propietario (validado en rules).

---

## Hook de Verificación: useRol()

```javascript
const { tienePermiso, tienePermisoConfig, esPropietario, esAdmin } = useRol()

// Verificar acceso a un módulo + acción
tienePermiso('contactos', 'editar')      // → boolean
tienePermisoConfig('contactos', 'ver')   // → boolean

// Booleans rápidos de rol
esPropietario  // true si rol === 'propietario'
esAdmin        // true si propietario o administrador
esColaborador  // true si colaborador o empleado
```

---

## Multi-empresa

Un usuario puede pertenecer a varias empresas con roles distintos en cada una:

```
/miembros/{uid}: {
  idEmpresa: "emp1",        // empresa activa actual
  empresas: [
    { id: "emp1", unidoEn: "2024-01-15" },
    { id: "emp2", unidoEn: "2024-03-20" }
  ]
}
```

Al cambiar empresa activa:
1. Se llama `cambiarEmpresaActiva({ idEmpresa })`
2. Cloud Function actualiza claims (empresaId + rol en nueva empresa)
3. Security Rules usan el nuevo claim
4. UI recalcula permisos con `useRol()`

---

## UI de Gestión de Permisos

Componente: `SeccionPermisos.jsx` — se muestra en el perfil de cada usuario (solo visible para propietarios).

### Zona 1 — Encabezado
- Título "Permisos" con badge: "Personalizado" o "Usando permisos del rol"
- Botones: **Restablecer** (vuelve a defaults del rol), **Revocar todo** (kill switch), **Guardar**

### Zona 2 — Resumen + Presets globales
- Anillo circular SVG con % de permisos activos (verde >80%, ámbar >40%, rojo <40%)
- Chips: "X completos", "X sin acceso", "X parciales"
- Muestra rol base del usuario
- **Acciones rápidas globales**: "Acceso total", "Solo lectura", "Sin acceso"

### Zona 3 — Categorías y Módulos (acordeón)
- Módulos agrupados en categorías colapsables (CRM, Documentos, Comunicación, Admin, Config)
- Cada categoría muestra badge `activos/total` y tiene presets propios (Todo, Lectura, Nada)
- Cada módulo tiene:
  - **Borde de color**: verde = completo, ámbar = parcial, gris = sin acceso
  - **Toggle maestro**: activa/desactiva todas las acciones del módulo
  - **Acciones individuales** (expandibles): icono + etiqueta + descripción + toggle on/off
  - **Auditoría inline**: quién editó ese módulo y cuándo

### Modal de Revocación de Emergencia
- Confirma con modal tipo "peligro"
- Requiere motivo obligatorio (mínimo 5 caracteres)
- Queda registrado en auditoría del sistema

---

## Flujo de Guardado de Permisos

1. Propietario modifica toggles en la UI
2. Al guardar, se detectan qué módulos cambiaron respecto al estado anterior
3. Se genera auditoría por módulo (quién, cuándo)
4. Se guarda en Firestore: `permisos` + `permisosAuditoria`
5. Se registra en auditoría global del sistema (acción `editar_permisos`)

---

## Flujo Completo de Autenticación y Permisos

1. Usuario inicia sesión → Firebase Auth
2. `ContextoAutenticacion` escucha cambios → refresca claims con `getIdToken(true)`
3. Obtiene empresa activa → desde localStorage, subdominio, o `/miembros`
4. Carga usuario de Firestore → obtiene rol, permisos personalizados, estado
5. Si claims desactualizados → llama `cambiarEmpresaActiva()` para sincronizar
6. `useRol()` calcula permisos efectivos → personalizados o defaults del rol
7. Componentes usan `tienePermiso()` → renderizan/deshabilitan según permisos
8. Al guardar cambios → incluye `editadoPor`, `editadoEn` para trazabilidad

---

## Archivos Clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/contextos/ContextoAutenticacion.jsx` | Carga usuario, rol, empresa activa, sincroniza claims |
| `src/hooks/useRol.js` | `tienePermiso()`, `tienePermisoConfig()`, permisos efectivos |
| `src/paginas/usuarios/PerfilUsuario.jsx` | Edición de perfil y permisos (propietario) |
| `src/paginas/usuarios/SeccionPermisos.jsx` | UI interactiva de permisos granulares |
| `src/servicios/usuarios.js` | CRUD usuarios |
| `functions/src/sincronizarClaimEmpresa.js` | Cloud Functions para sincronizar claims |
| `firestore.rules` | Security Rules (pertenencia a empresa) |
