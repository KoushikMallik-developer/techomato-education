import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const demo = f => fileURLToPath(new URL(`./src/demo/${f}.js`, import.meta.url));

// `npm run demo` swaps Firebase for the in-memory stand-in in src/demo, so no Firebase project is needed.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: mode === 'demo'
    ? { alias: { 'firebase/app': demo('app'), 'firebase/auth': demo('auth'), 'firebase/firestore': demo('firestore') } }
    : {},
}));
