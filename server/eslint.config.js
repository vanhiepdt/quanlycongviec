import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { process: 'readonly', console: 'readonly', setTimeout: 'readonly', URL: 'readonly' },
    },
    rules: {
      // Ba lỗi im lặng đã gặp ở bản Apps Script, nay là lỗi cứng:
      eqeqeq: ['error', 'always'], // so sánh lỏng làm '0' == false
      'no-implicit-coercion': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$|^req$|^res$' }],

      'no-console': ['warn', { allow: ['warn', 'error'] }], // log phải qua utils/logger.js
      'no-var': 'error',
      'prefer-const': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
    },
  },
  prettier,
];
