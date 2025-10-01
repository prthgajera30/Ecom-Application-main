module.exports = {
  root: true,
  env: { node: true, es2022: true, jest: true, browser: true },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off'
  }
};
