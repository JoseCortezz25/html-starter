import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/**', 'node_modules/**', 'coverage/**']),
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-unused-vars': 'off',
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      camelcase: ['error', { properties: 'never' }]
    }
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-exports': [
        'error',
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true
          }
        }
      ]
    }
  },
  {
    files: [
      '*.config.{ts,mjs,js}',
      '.claude/hooks/**/*.mjs',
      '.opencode/plugins/**/*.js'
    ],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  prettierConfig
]);
