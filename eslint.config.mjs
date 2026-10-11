// @ts-check
import eslintConfigPrettier from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // the previous app (reference only until the port is finished), generated fixtures and static files
    ignores: ['legacy/**', 'tests/fixtures/**', 'public/**', 'datasrc/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // the command-line tools talk to the person running them through the console
    files: ['tools/**'],
    rules: { 'no-console': 'off' },
  },
  eslintConfigPrettier,
)
