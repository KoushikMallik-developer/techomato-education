import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const demoFile = f => fileURLToPath(new URL(`./src/demo/${f}.js`, import.meta.url));

// `npm run demo` swaps Firebase for the in-memory stand-in in src/demo, so no Firebase project is needed.
// The same happens when VITE_FIREBASE_API_KEY is missing, so the app still opens instead of crashing.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const noKey = !(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);
  const demo = mode === 'demo' || noKey;
  if (noKey && mode !== 'demo') console.warn('\n[techomato] VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID is not set: running with the built-in demo data (nothing is saved to Firebase).\n');
  return {
    plugins: [react(), tailwindcss()],
    // VITE_NO_KEY drives the "demo data" banner, shown only when the fallback was automatic (not for `npm run demo`).
    define: demo ? { 'import.meta.env.MODE': '"demo"', 'import.meta.env.VITE_NO_KEY': JSON.stringify(noKey && mode !== 'demo' ? '1' : '') } : {},
    resolve: demo
      ? { alias: { 'firebase/app': demoFile('app'), 'firebase/auth': demoFile('auth'), 'firebase/firestore': demoFile('firestore') } }
      : {},
  };
});
