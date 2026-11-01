import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-console': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^(left|right)$/]",
          message:
            'Logical CSS properties only: use ms-/me-/ps-/pe-/start-/end- instead of left/right (UX-006).',
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // Browser-side modules that are not JSX still touch `window`, `document` and `localStorage`.
    files: ['platform/web/**/*.ts', 'apps/hr/web/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['tools/**/*.mjs', '**/*.config.{ts,mjs,js}', '**/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
