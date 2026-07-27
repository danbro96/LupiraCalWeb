import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

// Purity by construction: production modules may import nothing but each other — no
// dependencies, no generated DTO types, no platform APIs. Only tests may import vitest.
export default [
  { ignores: ['node_modules/**', '*.config.ts'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'test', pattern: 'src/**/*.test.ts', partialMatch: false },
        { type: 'domain', pattern: 'src/**' },
      ],
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        policies: [
          { from: { element: { type: 'domain' } }, allow: [{ to: { element: { type: 'domain' } } }] },
          { from: { element: { type: 'test' } }, allow: [{ to: { element: { type: 'domain' } } }, { to: { element: { type: 'test' } } }] },
        ],
      }],
      'boundaries/external': ['error', {
        default: 'disallow',
        policies: [
          { from: [{ element: { type: 'test' } }], allow: ['vitest'] },
        ],
      }],
    },
  },
];
