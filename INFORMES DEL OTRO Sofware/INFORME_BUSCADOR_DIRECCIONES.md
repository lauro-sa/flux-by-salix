# Buscador de Direcciones con Google Places API

## Qué hace

Un input de autocompletado que cuando el usuario escribe una dirección (ej: "Av Corrientes 1234"), consulta la API de Google Places, muestra sugerencias, y al seleccionar una, extrae automáticamente todos los componentes de la dirección: calle, número, barrio, ciudad, provincia, código postal y coordenadas GPS.

---

## Configuración de Google Cloud

### 1. Crear proyecto en Google Cloud Console
- Ir a https://console.cloud.google.com
- Crear proyecto o usar uno existente

### 2. Habilitar APIs necesarias
- **Places API (New)** — autocompletado de direcciones
- **Maps JavaScript API** — carga del script
- **Geocoding API** — (opcional) para convertir texto libre a dirección estructurada

### 3. Crear API Key
- En "Credenciales" → Crear credencial → API Key
- **Restringir la key**:
  - Por tipo: "Sitios web HTTP" → agregar dominios permitidos (ej: `app.midominio.com/*`)
  - Por API: solo las 3 APIs de arriba
- Esto evita uso no autorizado de la key

### 4. Configurar en el proyecto
- La API key va como **variable de entorno**, nunca hardcodeada en el código
- En desarrollo: archivo `.env.local` → `GOOGLE_MAPS_API_KEY=AIza...`
- En producción: variable de entorno del hosting/servidor
- El frontend la lee al cargar el script de Google Maps

---

## Carga del Script de Google Maps

Se carga **una sola vez** (patrón singleton) al iniciar la app:

```
https://maps.googleapis.com/maps/api/js?key=TU_API_KEY&v=weekly&loading=async
```

Parámetros:
- `key`: tu API key
- `v=weekly`: versión actualizada automáticamente
- `loading=async`: no bloquea la carga de la página

Después de cargar el script, se importan las librerías necesarias:
```
google.maps.importLibrary('places')  → autocompletado
google.maps.importLibrary('geocoding') → geocodificación inversa (opcional)
```

**Importante**: cargar el script una vez y reutilizarlo en toda la app. No cargarlo en cada componente.

---

## Flujo del Autocompletado

```
1. Usuario escribe en el input (mínimo 3 caracteres)
      ↓
2. Debounce de 300ms (no consultar cada tecla)
      ↓
3. Llamada a Google Places Autocomplete
   - Input: texto del usuario
   - Restricción de países (opcional): ['AR', 'UY', etc.]
   - Session token (para agrupar llamadas y reducir costos)
      ↓
4. Google devuelve lista de sugerencias (3-5 resultados)
   - Cada una tiene: texto principal + texto secundario + placeId
      ↓
5. Se muestra dropdown con las sugerencias
   - "Av. Corrientes 1234"  ← texto principal
   - "Buenos Aires, Argentina"  ← texto secundario
      ↓
6. Usuario selecciona una sugerencia
      ↓
7. Se pide el detalle completo a Google (fetchFields)
   - Campos: addressComponents, location (coordenadas)
      ↓
8. Se parsean los address_components (ver sección siguiente)
      ↓
9. Se devuelve objeto estructurado al formulario
```

---

## Parseo de address_components

Google devuelve un array de componentes, cada uno con `types[]` que indica qué es. Se extraen así:

| Tipo de Google | Campo nuestro | Ejemplo |
|---------------|---------------|---------|
| `route` | calle | "Av. Corrientes" |
| `street_number` | número | "1234" |
| `sublocality_level_1` | barrio | "San Telmo" |
| `locality` | ciudad | "Buenos Aires" |
| `administrative_area_level_1` | provincia/estado | "Buenos Aires" |
| `postal_code` | código postal | "C1066" |
| `country` | país | "Argentina" |

Las **coordenadas** vienen aparte en `location`:
```
{ lat: -34.6037, lng: -58.3816 }
```

### Casos especiales a manejar:
- **Ciudad de Buenos Aires (CABA)**: Google devuelve `locality: "Comuna 1"` en vez del nombre real. Si `ciudad` empieza con "Comuna", usar `provincia` como ciudad.
- **Lugares sin número**: `street_number` puede no existir, la calle queda solo con el nombre de la ruta.
- **Lugares sin barrio**: `sublocality_level_1` puede no existir en pueblos chicos.
- **Lugares sin código postal**: algunos lugares rurales no tienen CP.

---

## Estructura de dirección resultante

```json
{
  "calle": "Av. Corrientes 1234",
  "barrio": "San Telmo",
  "ciudad": "Buenos Aires",
  "provincia": "Buenos Aires",
  "codigoPostal": "C1066",
  "pais": "Argentina",
  "coordenadas": {
    "lat": -34.6037,
    "lng": -58.3816
  }
}
```

Opcionalmente se puede agregar:
- `tipo`: "principal" | "fiscal" | "sucursal" | "depósito" | etc.
- `piso` / `departamento` / `timbre`: campos manuales extra
- `texto`: concatenación de todo para búsqueda full-text

---

## Session Tokens (importante para costos)

Google cobra por sesión de autocompletado, no por tecla. Para aprovechar esto:

1. Crear un session token cuando el usuario empieza a escribir
2. Reutilizar ese mismo token en todas las llamadas de autocompletado mientras escribe
3. Usar el mismo token al pedir el detalle (fetchFields) cuando selecciona
4. Destruir el token después de la selección
5. Si el usuario vuelve a escribir, crear un nuevo token

**Sin session tokens**: Google cobra cada llamada de autocompletado por separado (mucho más caro).

---

## Restricción por Países

Se puede restringir las búsquedas a países específicos (máximo 5):

```
includedRegionCodes: ['AR', 'UY', 'CL']
```

Esto mejora:
- **Relevancia**: no muestra direcciones de otros países
- **Velocidad**: menos resultados que filtrar
- **UX**: el usuario no tiene que aclarar el país

Los códigos son ISO 3166-1 alpha-2: AR (Argentina), UY (Uruguay), CL (Chile), BR (Brasil), MX (México), ES (España), US (Estados Unidos), etc.

---

## Geolocalización del Usuario (opcional)

Si el usuario permite geolocalización, se puede enviar sus coordenadas a Google para que las sugerencias sean más relevantes (las de cerca primero):

```
locationBias: { lat: -34.60, lng: -58.38, radius: 50000 }
```

- No es obligatorio, mejora la UX si está disponible
- Timeout corto (5-6 segundos) para no bloquear
- Si el usuario rechaza el permiso, funciona igual pero sin bias

---

## Geocodificación Inversa (texto → dirección)

Para convertir texto libre (ej: dirección que viene de un chat o import) a componentes estructurados sin que el usuario use el autocompletado:

```
Input:  "Av. Corrientes 1234, Buenos Aires, Argentina"
Output: { calle, barrio, ciudad, provincia, cp, coordenadas }
```

Usa la API de Geocoding (no Places). Útil para:
- Importar direcciones desde CSV/Excel
- Procesar direcciones que manda un chatbot/IA
- Normalizar direcciones escritas a mano

---

## UX del Dropdown

### Posicionamiento inteligente
- Calcular espacio disponible arriba y abajo del input
- Si hay poco espacio abajo → abrir hacia arriba
- Máximo 360px de altura con scroll interno
- Cerrar al hacer clic fuera

### Contenido de cada sugerencia
```
┌────────────────────────────────────────┐
│ 📍 Av. Corrientes 1234               │  ← texto principal (negrita)
│    Buenos Aires, Argentina            │  ← texto secundario (gris)
├────────────────────────────────────────┤
│ 📍 Av. Corrientes 1500               │
│    Buenos Aires, Argentina            │
└────────────────────────────────────────┘
```

### Estados
- **Escribiendo** (< 3 chars): no mostrar nada
- **Buscando**: mostrar spinner/skeleton
- **Con resultados**: mostrar dropdown con sugerencias
- **Sin resultados**: mostrar mensaje "No se encontraron direcciones"
- **Error de API**: mostrar mensaje de error, permitir escribir manualmente

---

## Costos de la API (referencia)

Google Places API cobra por uso. Precios aproximados (pueden variar):

| Operación | Costo aprox. |
|-----------|-------------|
| Autocomplete por sesión | ~$0.017 USD |
| Place Details (fetchFields) | ~$0.017 USD |
| Geocoding | ~$0.005 USD |

**Tips para reducir costos:**
1. Usar session tokens siempre
2. Mínimo 3 caracteres antes de buscar
3. Debounce de 300ms
4. Cachear resultados si el usuario borra y reescribe lo mismo
5. Pedir solo los campos necesarios en fetchFields (addressComponents + location)
6. Restringir por países reduce resultados inútiles

---

## Checklist de Implementación

### Backend/Config
- [ ] Crear proyecto en Google Cloud Console
- [ ] Habilitar Places API (New) + Maps JavaScript API
- [ ] Crear API Key con restricciones (dominios + APIs)
- [ ] Configurar variable de entorno con la key
- [ ] En producción: configurar la key en el hosting

### Frontend
- [ ] Crear loader singleton del script de Google Maps (cargar 1 vez)
- [ ] Crear componente reutilizable de input con autocompletado
- [ ] Implementar debounce (300ms) al escribir
- [ ] Implementar session tokens para optimizar costos
- [ ] Parsear address_components al seleccionar
- [ ] Manejar casos especiales (sin número, sin barrio, CABA)
- [ ] Dropdown con posicionamiento inteligente
- [ ] Manejar errores de API (timeout, quota, etc.)
- [ ] Permitir entrada manual como fallback

### Base de datos
- [ ] Definir estructura de dirección (calle, barrio, ciudad, provincia, cp, coordenadas)
- [ ] Indexar campo de texto concatenado para búsqueda full-text
- [ ] Soportar múltiples direcciones por entidad (array)
- [ ] Cada dirección con tipo (principal, fiscal, etc.)

### Opcional
- [ ] Geolocalización del usuario para bias de búsqueda
- [ ] Geocodificación inversa para importar direcciones de texto
- [ ] Mapa para visualizar/confirmar la ubicación seleccionada
- [ ] Función para generar URL de Google Maps desde coordenadas
