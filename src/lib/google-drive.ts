import { google } from 'googleapis'

/**
 * Utilidades de Google Drive para Flux by Salix.
 * Maneja OAuth, creación de carpetas/spreadsheets y escritura de datos.
 * Se usa en: API routes de /api/integraciones/google-drive/
 *
 * Requiere variables de entorno:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL (para el redirect URI)
 */

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',        // Crear/editar archivos en Drive
  'https://www.googleapis.com/auth/spreadsheets',       // Leer/escribir hojas de cálculo
  'https://www.googleapis.com/auth/userinfo.email',     // Ver email de la cuenta
]

/** Crea un cliente OAuth2 de Google */
export function crearClienteOAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integraciones/google-drive/callback`
  )
}

/** Genera la URL de autorización de Google */
export function generarUrlAutorizacion(estado: string): string {
  const oauth2 = crearClienteOAuth()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: estado,
  })
}

/** Intercambia el código de autorización por tokens */
export async function intercambiarCodigo(codigo: string) {
  const oauth2 = crearClienteOAuth()
  const { tokens } = await oauth2.getToken(codigo)
  return tokens
}

/** Obtiene un access token fresco usando el refresh token */
export async function obtenerAccessToken(refreshToken: string): Promise<string> {
  const oauth2 = crearClienteOAuth()
  oauth2.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2.refreshAccessToken()
  return credentials.access_token!
}

/** Obtiene el email de la cuenta Google conectada */
export async function obtenerEmailUsuario(accessToken: string): Promise<string> {
  const oauth2 = crearClienteOAuth()
  oauth2.setCredentials({ access_token: accessToken })
  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
  const { data } = await oauth2Api.userinfo.get()
  return data.email || ''
}

/** Crea una carpeta en Google Drive */
export async function crearCarpeta(accessToken: string, nombreEmpresa: string): Promise<string> {
  const oauth2 = crearClienteOAuth()
  oauth2.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth: oauth2 })

  const { data } = await drive.files.create({
    requestBody: {
      name: `Flux - ${nombreEmpresa}`,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })

  return data.id!
}

/** Crea un spreadsheet dentro de una carpeta de Drive */
export async function crearSpreadsheet(
  accessToken: string,
  folderId: string,
  nombre: string,
): Promise<{ spreadsheetId: string; url: string }> {
  const oauth2 = crearClienteOAuth()
  oauth2.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth: oauth2 })

  const { data } = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    },
    fields: 'id, webViewLink',
  })

  return {
    spreadsheetId: data.id!,
    url: data.webViewLink!,
  }
}

/** Escribe datos en un spreadsheet (reescritura completa) */
export async function escribirSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  nombreHoja: string,
  encabezados: string[],
  filas: (string | number | null)[][],
  colorEmpresa?: string,
): Promise<void> {
  const oauth2 = crearClienteOAuth()
  oauth2.setCredentials({ access_token: accessToken })
  const sheets = google.sheets({ version: 'v4', auth: oauth2 })

  // Obtener nombre real y ID de la primera hoja
  const { data: hojaInfo } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  })
  const sheetId = hojaInfo.sheets?.[0]?.properties?.sheetId || 0
  const nombreReal = hojaInfo.sheets?.[0]?.properties?.title || 'Sheet1'

  // Renombrar la hoja si no coincide con el nombre esperado
  if (nombreReal !== nombreHoja) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: { sheetId, title: nombreHoja },
            fields: 'title',
          },
        }],
      },
    })
  }

  // Limpiar la hoja
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${nombreHoja}!A1:ZZ10000`,
  })

  // Escribir encabezados + datos
  const valores = [encabezados, ...filas]
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${nombreHoja}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: valores },
  })

  // Parsear color de empresa (hex a RGB)
  const hex = colorEmpresa || '2563EB'
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  // Verificar si ya existe banding para no duplicar
  const { data: fullSheet } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.bandedRanges',
  })
  const bandingExistente = fullSheet.sheets?.[0]?.bandedRanges?.[0]

  const requestsEstilos: object[] = [
    // Encabezados: fondo color empresa, texto blanco, negrita
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: encabezados.length },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: r, green: g, blue: b },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
  ]

  // Banding: actualizar si existe, crear si no
  if (bandingExistente) {
    requestsEstilos.push({
      updateBanding: {
        bandedRange: {
          bandedRangeId: bandingExistente.bandedRangeId,
          range: { sheetId, startRowIndex: 1, endRowIndex: filas.length + 1, startColumnIndex: 0, endColumnIndex: encabezados.length },
          rowProperties: {
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: { red: 0.96, green: 0.97, blue: 0.98 },
          },
        },
        fields: 'range,rowProperties',
      },
    })
  } else {
    requestsEstilos.push({
      addBanding: {
        bandedRange: {
          range: { sheetId, startRowIndex: 1, endRowIndex: filas.length + 1, startColumnIndex: 0, endColumnIndex: encabezados.length },
          rowProperties: {
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: { red: 0.96, green: 0.97, blue: 0.98 },
          },
        },
      },
    })
  }

  requestsEstilos.push(
    // Congelar primera fila
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Auto-resize columnas
    {
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: encabezados.length },
      },
    },
  )

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: requestsEstilos },
  })
}

/** Revoca el token de Google */
export async function revocarToken(refreshToken: string): Promise<void> {
  const oauth2 = crearClienteOAuth()
  try {
    await oauth2.revokeToken(refreshToken)
  } catch {
    // Ignorar errores de revocación (token puede ya estar revocado)
  }
}

// ─── Definiciones de módulos sincronizables ───

export interface ModuloSync {
  clave: string
  etiqueta: string
  nombreHoja: string
}

export const MODULOS_SYNC: ModuloSync[] = [
  { clave: 'contactos', etiqueta: 'Contactos', nombreHoja: 'Contactos' },
  // Módulos futuros (se activarán cuando existan en Flux):
  // { clave: 'presupuestos', etiqueta: 'Presupuestos', nombreHoja: 'Presupuestos' },
  // { clave: 'facturas', etiqueta: 'Facturas', nombreHoja: 'Facturas' },
  // { clave: 'actividades', etiqueta: 'Actividades', nombreHoja: 'Actividades' },
  // { clave: 'visitas', etiqueta: 'Visitas', nombreHoja: 'Visitas' },
  // { clave: 'productos', etiqueta: 'Productos', nombreHoja: 'Productos' },
]

/** Configuración guardada en BD */
export interface ConfigGoogleDrive {
  id: string
  empresa_id: string
  conectado: boolean
  email: string | null
  refresh_token: string | null
  access_token: string | null
  token_expira_en: string | null
  frecuencia_horas: number
  modulos_activos: string[]
  folder_id: string | null
  hojas: Record<string, { spreadsheet_id: string; url: string; nombre: string }>
  ultima_sync: string | null
  ultimo_error: string | null
  resumen: Record<string, number>
  conectado_por: string | null
  creado_en: string
  actualizado_en: string
}
