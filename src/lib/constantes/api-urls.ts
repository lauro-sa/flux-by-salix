/**
 * URLs de APIs externas usadas en la app.
 * Centraliza endpoints para facilitar mantenimiento y configuración.
 */

// Meta / WhatsApp Business API
export const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

// Microsoft Graph
export const MS_GRAPH_API = 'https://graph.microsoft.com/v1.0'
export const MS_AUTH_URL = 'https://login.microsoftonline.com'

// Google
export const GOOGLE_PLACES_API = 'https://places.googleapis.com/v1/places'
export const GOOGLE_PLACES_AUTOCOMPLETE = 'https://places.googleapis.com/v1/places:autocomplete'
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

// OpenAI
export const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'

// Geocoding
export const OPENSTREETMAP_REVERSE = 'https://nominatim.openstreetmap.org/reverse'

// Chromium (para generación de PDF)
export const CHROMIUM_DOWNLOAD_URL = 'https://github.com/nichochar/chromium-min-arm64/releases/download/v143.0.4/chromium-v143.0.4-pack.tar'
