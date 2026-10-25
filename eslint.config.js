const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    ignores: ['app/**/*', 'src/environments/*', 'e2e/playwright.config.ts', 'dist/**/*', 'release/**/*'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: [
          './tsconfig.serve.json',
          './src/tsconfig.app.json',
          './src/tsconfig.spec.json',
          './tsconfig.worker.json',
          './e2e/tsconfig.e2e.json',
        ],
      },
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@angular-eslint/directive-selector': 'off',
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'cranc', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  },
);
