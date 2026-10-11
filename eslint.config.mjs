// @ts-check
import eslintConfigPrettier from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // a fixture account, static files and the training data
    ignores: ['tests/fixtures/**', 'public/**', 'datasrc/**'],
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
