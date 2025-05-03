module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    jest: true,
  },
  rules: {
    // Custom rules
    'no-console': 'off', // Allow console.log for plugin development
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'quotes': ['error', 'single', { 'avoidEscape': true }],
    'semi': ['error', 'always'],
  },
};
