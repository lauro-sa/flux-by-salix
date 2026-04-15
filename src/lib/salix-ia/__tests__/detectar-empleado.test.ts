/**
 * Tests de detección de empleado por teléfono.
 * Verifica: prioridad empresa>personal, formatos argentinos, sufijos sin código país.
 */

import { describe, it, expect, vi } from 'vitest'
import { detectarEmpleado } from '../detectar-empleado'

const miembroBase = {
  id: 'miembro-1',
  usuario_id: 'user-1',
  rol: 'administrador',
  permisos_custom: null,
  salix_ia_habilitado: true,
  puesto_nombre: null,
  sector: null,
}

/**
 * Crea un mock de admin que retorna miembros y perfiles en queries separadas.
 * Primera llamada a .from('miembros') retorna los miembros.
 * Segunda llamada a .from('perfiles') retorna los perfiles.
 */
function crearMockAdmin(miembros: Record<string, unknown>[], perfiles: Record<string, unknown>[]) {
  let llamada = 0
  return {
    from: vi.fn(() => {
      llamada++
      if (llamada === 1) {
        // Query de miembros
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: miembros, error: null }),
            }),
          }),
        }
      } else {
        // Query de perfiles
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: perfiles, error: null }),
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

  it('detecta por teléfono personal cuando NO hay teléfono empresa', async () => {
    const admin = crearMockAdmin(
      [miembroBase],
      [{ id: 'user-1', nombre: 'Sebastian', apellido: 'Lauro', telefono: '+54 11 3235 4334', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '541132354334')
    expect(result.es_empleado).toBe(true)
    expect(result.perfil?.nombre).toBe('Sebastian')
  })

  it('detecta por teléfono empresa cuando SÍ tiene uno', async () => {
    const admin = crearMockAdmin(
      [miembroBase],
      [{ id: 'user-1', nombre: 'Olivia', apellido: 'Dupit', telefono: '+54 9 11 6407 2193', telefono_empresa: '1160990312' }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491160990312')
    expect(result.es_empleado).toBe(true)
    expect(result.perfil?.nombre).toBe('Olivia')
  })

  it('NO detecta por teléfono personal si tiene teléfono empresa', async () => {
    const admin = crearMockAdmin(
      [miembroBase],
      [{ id: 'user-1', nombre: 'Olivia', apellido: 'Dupit', telefono: '+54 9 11 6407 2193', telefono_empresa: '1160990312' }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491164072193')
    expect(result.es_empleado).toBe(false)
  })

  it('matchea teléfono sin código país como sufijo', async () => {
    const admin = crearMockAdmin(
      [miembroBase],
      [{ id: 'user-1', nombre: 'Test', apellido: 'User', telefono: null, telefono_empresa: '1155667788' }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491155667788')
    expect(result.es_empleado).toBe(true)
  })

  it('matchea teléfono exacto', async () => {
    const admin = crearMockAdmin(
      [miembroBase],
      [{ id: 'user-1', nombre: 'José', apellido: 'Romero', telefono: '5491134519816', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491134519816')
    expect(result.es_empleado).toBe(true)
  })

  it('matchea número argentino SIN 9 en BD con 9 de WhatsApp', async () => {
    const admin = crearMockAdmin(
      [miembroBase],
      [{ id: 'user-1', nombre: 'Sebastian', apellido: 'Lauro', telefono: '+54 11 3235 4334', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491132354334')
    expect(result.es_empleado).toBe(true)
    expect(result.perfil?.nombre).toBe('Sebastian')
  })

  it('matchea número argentino CON 9 en BD sin 9 entrante', async () => {
    const admin = crearMockAdmin(
      [miembroBase],
      [{ id: 'user-1', nombre: 'Test', apellido: 'AR', telefono: '+54 9 11 5566 7788', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '541155667788')
    expect(result.es_empleado).toBe(true)
  })

  it('no matchea teléfono de otra persona', async () => {
    const admin = crearMockAdmin(
      [miembroBase],
      [{ id: 'user-1', nombre: 'Carlos', apellido: 'Gómez', telefono: '+5491100112233', telefono_empresa: null }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '5491199999999')
    expect(result.es_empleado).toBe(false)
  })

  it('no matchea sufijo demasiado corto', async () => {
    const admin = crearMockAdmin(
      [miembroBase],
      [{ id: 'user-1', nombre: 'Test', apellido: 'Short', telefono: null, telefono_empresa: '12345' }]
    )
    const result = await detectarEmpleado(admin, 'empresa-1', '549112345')
    expect(result.es_empleado).toBe(false)
  })
})
