import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        console: true, // Optionally define console as a global
      },
      env: {
        browser: true, // or node: true if this is a Node.js project
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      'no-unused-vars': 'error',
      'no-unused-expressions': 'error',
      'prefer-const': 'error',
      'no-console': 'off', // allow console
      'no-undef': 'error',
    },
  },
  {
    rules: {
      // Prettier rules handled by Prettier plugin
    },
    ignores: ['dist', 'node_modules'],
  },
];
