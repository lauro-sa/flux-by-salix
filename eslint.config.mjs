import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      // Permitir variables sin usar con prefijo _
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // Permitir any explícito (el proyecto lo usa en algunos hooks)
      '@typescript-eslint/no-explicit-any': 'warn',
      // Preferir const sobre let cuando no se reasigna
      'prefer-const': 'warn',
      // No console.log en producción (warn para desarrollo)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: [
      '.next/',
      'node_modules/',
      'supabase/',
      '*.config.*',
    ],
  },
]

export default config
