/**
 * Tests del helper unificado de datos de contacto efectivos.
 * Cubre: empleado con cuenta Flux respeta canal, empleado sin cuenta usa contacto único,
 * combinaciones cruzadas (perfil con campos vacíos, contacto sin teléfono, etc.).
 */

import { describe, it, expect } from 'vitest'
import { resolverDatosContactoMiembro } from '../datos-contacto'

describe('resolverDatosContactoMiembro — empleado CON cuenta Flux', () => {
  it('canal=empresa: usa correo_empresa y telefono_empresa', () => {
    const res = resolverDatosContactoMiembro({
      miembro: { canal_notif_correo: 'empresa', canal_notif_telefono: 'empresa' },
      perfil: {
        nombre: 'Ana',
        apellido: 'García',
        correo: 'ana@personal.com',
        correo_empresa: 'ana@empresa.com',
        telefono: '+5491111111111',
        telefono_empresa: '+5492222222222',
        documento_tipo: 'DNI',
        documento_numero: '30123456',
      },
      contactoEquipo: null,
    })
    expect(res.correo).toBe('ana@empresa.com')
    expect(res.telefono).toBe('+5492222222222')
    expect(res.fuente).toBe('perfil')
    expect(res.tiene_cuenta_flux).toBe(true)
    expect(res.nombre_completo).toBe('Ana García')
    expect(res.documento_numero).toBe('30123456')
  })

  it('canal=personal: usa correo y telefono personales', () => {
    const res = resolverDatosContactoMiembro({
      miembro: { canal_notif_correo: 'personal', canal_notif_telefono: 'personal' },
      perfil: {
        nombre: 'Bruno',
        apellido: 'López',
        correo: 'bruno@personal.com',
        correo_empresa: 'bruno@empresa.com',
        telefono: '+5491111111111',
        telefono_empresa: '+5492222222222',
      },
      contactoEquipo: null,
    })
    expect(res.correo).toBe('bruno@personal.com')
    expect(res.telefono).toBe('+5491111111111')
  })

  it('canal=empresa pero campo vacío: devuelve null (sin fallback)', () => {
    const res = resolverDatosContactoMiembro({
      miembro: { canal_notif_correo: 'empresa', canal_notif_telefono: 'empresa' },
      perfil: {
        nombre: 'Cora',
        apellido: 'Méndez',
        correo: 'cora@personal.com',
        correo_empresa: null,
        telefono: '+5491111111111',
        telefono_empresa: null,
      },
      contactoEquipo: null,
    })
    expect(res.correo).toBeNull()
    expect(res.telefono).toBeNull()
  })

  it('sin canal definido: default empresa', () => {
    const res = resolverDatosContactoMiembro({
      miembro: { canal_notif_correo: null, canal_notif_telefono: null },
      perfil: {
        nombre: 'Diego',
        apellido: 'Pérez',
        correo: 'diego@p.com',
        correo_empresa: 'diego@e.com',
        telefono: '+541',
        telefono_empresa: '+542',
      },
      contactoEquipo: null,
    })
    expect(res.correo).toBe('diego@e.com')
    expect(res.telefono).toBe('+542')
  })
})

describe('resolverDatosContactoMiembro — empleado SIN cuenta Flux', () => {
  it('usa correo y telefono únicos del contacto, sin importar el canal', () => {
    const res = resolverDatosContactoMiembro({
      miembro: { canal_notif_correo: 'empresa', canal_notif_telefono: 'empresa' },
      perfil: null,
      contactoEquipo: {
        nombre: 'Eva',
        apellido: 'Romero',
        correo: 'eva@cargada.com',
        telefono: '+5493333333333',
      },
    })
    expect(res.correo).toBe('eva@cargada.com')
    expect(res.telefono).toBe('+5493333333333')
    expect(res.fuente).toBe('contacto_equipo')
    expect(res.tiene_cuenta_flux).toBe(false)
    expect(res.nombre_completo).toBe('Eva Romero')
  })

  it('canal=personal también usa el campo único (no hay otro)', () => {
    const res = resolverDatosContactoMiembro({
      miembro: { canal_notif_correo: 'personal', canal_notif_telefono: 'personal' },
      perfil: null,
      contactoEquipo: {
        nombre: 'Fran',
        apellido: null,
        correo: 'fran@x.com',
        telefono: '+549444',
      },
    })
    expect(res.correo).toBe('fran@x.com')
    expect(res.telefono).toBe('+549444')
  })

  it('contacto con teléfono vacío: telefono = null', () => {
    const res = resolverDatosContactoMiembro({
      miembro: { canal_notif_telefono: 'empresa' },
      perfil: null,
      contactoEquipo: {
        nombre: 'Gus',
        apellido: 'Vega',
        correo: 'gus@x.com',
        telefono: null,
      },
    })
    expect(res.telefono).toBeNull()
    expect(res.correo).toBe('gus@x.com')
  })

  it('sin perfil ni contacto: fuente=sin_datos y campos vacíos', () => {
    const res = resolverDatosContactoMiembro({
      miembro: {},
      perfil: null,
      contactoEquipo: null,
    })
    expect(res.fuente).toBe('sin_datos')
    expect(res.correo).toBeNull()
    expect(res.telefono).toBeNull()
    expect(res.nombre_completo).toBe('')
  })

  it('sin perfil, contacto sin documento: queda null', () => {
    const res = resolverDatosContactoMiembro({
      miembro: {},
      perfil: null,
      contactoEquipo: { nombre: 'Hugo', apellido: 'Soto', correo: null, telefono: '+549555' },
    })
    expect(res.documento_tipo).toBeNull()
    expect(res.documento_numero).toBeNull()
  })

  it('sin perfil, contacto CON documento: lo expone (mapea numero_identificacion → documento_numero)', () => {
    const res = resolverDatosContactoMiembro({
      miembro: {},
      perfil: null,
      contactoEquipo: {
        nombre: 'Nicolás',
        apellido: 'Pérez',
        correo: 'n@x.com',
        telefono: '+549100',
        tipo_identificacion: 'DNI',
        numero_identificacion: '32123456',
      },
    })
    expect(res.documento_tipo).toBe('DNI')
    expect(res.documento_numero).toBe('32123456')
  })
})

describe('resolverDatosContactoMiembro — combinaciones de nombre', () => {
  it('perfil sin nombre: usa nombre del contacto como fallback', () => {
    const res = resolverDatosContactoMiembro({
      miembro: { canal_notif_correo: 'empresa' },
      perfil: {
        nombre: null,
        apellido: null,
        correo_empresa: 'x@y.com',
      },
      contactoEquipo: {
        nombre: 'Ivana',
        apellido: 'Torres',
        correo: 'ivana@otro.com',
        telefono: null,
      },
    })
    // Fuente sigue siendo perfil (porque hay perfil cargado), pero nombre cae al contacto.
    expect(res.fuente).toBe('perfil')
    expect(res.correo).toBe('x@y.com')
    expect(res.nombre_completo).toBe('Ivana Torres')
  })

  it('correo del contacto con espacios: se recortan', () => {
    const res = resolverDatosContactoMiembro({
      miembro: {},
      perfil: null,
      contactoEquipo: { nombre: 'Juan', apellido: '', correo: '  juan@x.com  ', telefono: '  +549  ' },
    })
    expect(res.correo).toBe('juan@x.com')
    expect(res.telefono).toBe('+549')
  })
})
