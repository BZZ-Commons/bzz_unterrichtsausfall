import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ['.next/', 'node_modules/', 'coverage/', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  // Last: turn off formatting rules — Prettier owns formatting.
  eslintConfigPrettier,
];

export default config;
