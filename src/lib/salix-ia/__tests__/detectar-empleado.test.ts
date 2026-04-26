/**
 * Tests de detección de empleado por teléfono.
 * Verifica: respeto del canal_notif_telefono, formatos argentinos, sufijos sin código país.
 */

import { describe, it, expect, vi } from 'vitest'
import { detectarEmpleado } from '../detectar-empleado'

/** Base compartida — cada test elige su canal_notif_telefono. */
function miembro(canal: 'empresa' | 'personal') {
  return {
    id: 'miembro-1',
    usuario_id: 'user-1',
    rol: 'administrador',
    permisos_custom: null,
    salix_ia_habilitado: true,
    salix_ia_web: true,
    salix_ia_whatsapp: true,
    canal_notif_telefono: canal,
    puesto: null,
    sector: null,
  }
}

/**
 * Crea un mock de admin. Secuencia de llamadas:
 *  1. .from('miembros')  → miembros activos
 *  2. .from('perfiles')  → perfiles
 *  3. .from('contactos') → contactos de equipo (fallback para miembros sin cuenta)
 */
function crearMockAdmin(miembros: Record<string, unknown>[], perfiles: Record<string, unknown>[]) {
  let llamada = 0
  return {
    from: vi.fn(() => {
      llamada++
      if (llamada === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: miembros, error: null }),
            }),
          }),
        }
      } else if (llamada === 2) {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: perfiles, error: null }),
          }),
        }
      } else {
        // contactos (equipo) — vacío en estos tests
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
    }),
  }
}

describe('detectarEmpleado', () => {
  it('retorna false si no hay miembros', async () => {
    const admin = crearMockAdmin([], [])
    const result = await detectarEmpleado(admin, 'empresa-1', '5491155667788')
    expect(result.es_empleado).toBe(false)
  })

  it('retorna false para teléfono vacío', async () => {
    const admin = crearMockAdmin([], [])
    const result = await detectarEmpleado(admin, 'empresa-1', '')
    expect(result.es_empleado).toBe(false)
  })

  it('canal=personal: matchea con teléfono personal', async () => {
    const admin = crearMockAdmin(
      [miembro('personal')],
      [{ id: 'user-1', nombre: 'Sebastian', apellido: 'Lauro', telefono: '+54 11 3235 4334', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '541132354334')
    expect(result.es_empleado).toBe(true)
    expect(result.perfil?.nombre).toBe('Sebastian')
  })

  it('canal=empresa: matchea con teléfono empresa', async () => {
    const admin = crearMockAdmin(
      [miembro('empresa')],
      [{ id: 'user-1', nombre: 'Olivia', apellido: 'Dupit', telefono: '+54 9 11 6407 2193', telefono_empresa: '1160990312' }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491160990312')
    expect(result.es_empleado).toBe(true)
    expect(result.perfil?.nombre).toBe('Olivia')
  })

  it('canal=empresa: NO matchea con teléfono personal aunque coincida', async () => {
    const admin = crearMockAdmin(
      [miembro('empresa')],
      [{ id: 'user-1', nombre: 'Olivia', apellido: 'Dupit', telefono: '+54 9 11 6407 2193', telefono_empresa: '1160990312' }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491164072193')
    expect(result.es_empleado).toBe(false)
  })

  it('canal=empresa: NO matchea si empresa está vacía (no cae al personal)', async () => {
    const admin = crearMockAdmin(
      [miembro('empresa')],
      [{ id: 'user-1', nombre: 'Sebastian', apellido: 'Lauro', telefono: '+54 11 3235 4334', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '541132354334')
    expect(result.es_empleado).toBe(false)
  })

  it('matchea teléfono sin código país como sufijo', async () => {
    const admin = crearMockAdmin(
      [miembro('empresa')],
      [{ id: 'user-1', nombre: 'Test', apellido: 'User', telefono: null, telefono_empresa: '1155667788' }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491155667788')
    expect(result.es_empleado).toBe(true)
  })

  it('matchea teléfono exacto (canal=personal)', async () => {
    const admin = crearMockAdmin(
      [miembro('personal')],
      [{ id: 'user-1', nombre: 'José', apellido: 'Romero', telefono: '5491134519816', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491134519816')
    expect(result.es_empleado).toBe(true)
  })

  it('matchea número argentino SIN 9 en BD con 9 de WhatsApp', async () => {
    const admin = crearMockAdmin(
      [miembro('personal')],
      [{ id: 'user-1', nombre: 'Sebastian', apellido: 'Lauro', telefono: '+54 11 3235 4334', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491132354334')
    expect(result.es_empleado).toBe(true)
    expect(result.perfil?.nombre).toBe('Sebastian')
  })

  it('matchea número argentino CON 9 en BD sin 9 entrante', async () => {
    const admin = crearMockAdmin(
      [miembro('personal')],
      [{ id: 'user-1', nombre: 'Test', apellido: 'AR', telefono: '+54 9 11 5566 7788', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '541155667788')
    expect(result.es_empleado).toBe(true)
  })

  it('no matchea teléfono de otra persona', async () => {
    const admin = crearMockAdmin(
      [miembro('personal')],
      [{ id: 'user-1', nombre: 'Carlos', apellido: 'Gómez', telefono: '+5491100112233', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491199999999')
    expect(result.es_empleado).toBe(false)
  })

  it('no matchea sufijo demasiado corto', async () => {
    const admin = crearMockAdmin(
      [miembro('empresa')],
      [{ id: 'user-1', nombre: 'Test', apellido: 'Short', telefono: null, telefono_empresa: '12345' }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '549112345')
    expect(result.es_empleado).toBe(false)
  })
})
