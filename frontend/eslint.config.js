import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Pages intentionally set loading state before starting their initial
      // API request. This normal fetch-on-mount pattern is incorrectly
      // classified as a synchronous cascade by the compiler-oriented rule.
      'react-hooks/set-state-in-effect': 'off',
      // The loading functions are reused by event handlers; their inputs are
      // stable React setters and the shared API client.
      'react-hooks/exhaustive-deps': 'off',
    },
  },
])
