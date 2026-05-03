/**
 * Tests del modelo de 3 niveles de acceso a Salix IA.
 * Garantizan que:
 *  - 'ninguno'  → 0 tools, sin importar permisos de rol
 *  - 'personal' → solo las 5 tools personales, sin chequeo de rol
 *  - 'completo' → tools personales + las de gestión filtradas por permiso
 */

import { describe, it, expect, vi } from 'vitest'
import { filtrarHerramientasPermitidas } from '../permisos'
import { HERRAMIENTAS_SALIX_IA } from '../herramientas/definiciones'
import type { ConfigSalixIA, MiembroSalixIA, NombreHerramienta } from '@/tipos/salix-ia'

// Mock que devuelve true para todo (simulamos un rol con permisos máximos):
// así verificamos que el filtrado adicional por nivel no dependa de permisos.
vi.mock('@/lib/permisos-servidor', () => ({
  verificarPermiso: () => true,
}))

const TOOLS_PERSONALES: NombreHerramienta[] = [
  'mi_recibo_periodo',
  'mi_proximo_pago',
  'mi_periodo_actual',
  'mis_tardanzas_e_inasistencias',
  'mi_historial_pagos',
]

const configTodasHabilitadas: ConfigSalixIA = {
  empresa_id: 'emp-1',
  habilitado: true,
  nombre: 'Salix IA',
  personalidad: '',
  herramientas_habilitadas: HERRAMIENTAS_SALIX_IA.map(h => h.nombre),
  whatsapp_copilot_habilitado: false,
  max_iteraciones_herramientas: 5,
  creado_en: '',
  actualizado_en: '',
}

const crearMiembro = (nivel: 'completo' | 'personal' | 'ninguno'): MiembroSalixIA => ({
  id: 'm-1',
  usuario_id: 'u-1',
  rol: 'administrador', // rol con permisos máximos para aislar el efecto del nivel
  permisos_custom: null,
  nivel_salix: nivel,
  salix_ia_web: true,
  salix_ia_whatsapp: true,
  puesto: null,
  sector: null,
})

describe('filtrarHerramientasPermitidas — nivel_salix', () => {
  it("nivel 'ninguno' → 0 herramientas", () => {
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('ninguno'),
      configTodasHabilitadas,
    )
    expect(resultado).toHaveLength(0)
  })

  it("nivel 'personal' → solo las 5 tools personales", () => {
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('personal'),
      configTodasHabilitadas,
    )
    const nombres = resultado.map(h => h.nombre).sort()
    expect(nombres).toEqual([...TOOLS_PERSONALES].sort())
    // Verificamos explícitamente que NO incluye tools de gestión.
    expect(nombres).not.toContain('buscar_contactos')
    expect(nombres).not.toContain('crear_actividad')
    expect(nombres).not.toContain('consultar_equipo')
    expect(nombres).not.toContain('modificar_presupuesto')
  })

  it("nivel 'completo' (admin) → todas las tools incluyendo las personales", () => {
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('completo'),
      configTodasHabilitadas,
    )
    expect(resultado).toHaveLength(HERRAMIENTAS_SALIX_IA.length)
    const nombres = resultado.map(h => h.nombre)
    for (const personal of TOOLS_PERSONALES) {
      expect(nombres).toContain(personal)
    }
    expect(nombres).toContain('buscar_contactos')
    expect(nombres).toContain('consultar_equipo')
  })

  it("nivel 'personal' ignora si la tool de gestión está habilitada en config", () => {
    // Aunque las gestionables estén en herramientas_habilitadas, el nivel 'personal'
    // las descarta sin importar config.
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('personal'),
      configTodasHabilitadas,
    )
    expect(resultado.every(h => h.categoria === 'personal')).toBe(true)
  })

  it("nivel 'personal' respeta config: si una tool personal NO está habilitada, no aparece", () => {
    const configSinUnaPersonal: ConfigSalixIA = {
      ...configTodasHabilitadas,
      herramientas_habilitadas: configTodasHabilitadas.herramientas_habilitadas.filter(
        n => n !== 'mi_proximo_pago',
      ),
    }
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('personal'),
      configSinUnaPersonal,
    )
    const nombres = resultado.map(h => h.nombre)
    expect(nombres).not.toContain('mi_proximo_pago')
    // Las otras 4 personales siguen disponibles
    expect(nombres).toHaveLength(4)
  })
})
