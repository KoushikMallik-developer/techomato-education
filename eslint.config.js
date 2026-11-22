import react from 'eslint-plugin-react';
import globals from 'globals';

// Only catches real mistakes: undefined names (a missing import builds fine but crashes the page) and unused imports.
export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.worker, importScripts: 'readonly', loadPyodide: 'readonly' } },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { caughtErrors: 'none' }], 'react/jsx-uses-vars': 'error' },
  },
  { files: ['**/*.test.js'], languageOptions: { globals: globals.node } },
];
