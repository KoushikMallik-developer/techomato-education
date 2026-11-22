import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const demoFile = f => fileURLToPath(new URL(`./src/demo/${f}.js`, import.meta.url));

// `npm run demo` swaps Firebase for the in-memory stand-in in src/demo, so no Firebase project is needed.
// The same happens when VITE_FIREBASE_API_KEY is missing, so the app still opens instead of crashing.
export default defineConfig(({ mode }) => {
  const noKey = !loadEnv(mode, process.cwd(), 'VITE_').VITE_FIREBASE_API_KEY;
  const demo = mode === 'demo' || noKey;
  if (demo && mode !== 'demo') console.warn('\n[techomato] VITE_FIREBASE_API_KEY is not set: running with the built-in demo data (nothing is saved to Firebase).\n');
  return {
    plugins: [react(), tailwindcss()],
    define: demo ? { 'import.meta.env.MODE': '"demo"' } : {},
    resolve: demo
      ? { alias: { 'firebase/app': demoFile('app'), 'firebase/auth': demoFile('auth'), 'firebase/firestore': demoFile('firestore') } }
      : {},
  };
});
