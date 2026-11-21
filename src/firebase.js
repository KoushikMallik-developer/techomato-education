import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, getDocs } from 'firebase/firestore';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const list = async q => (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));

// Creates a login without signing the admin out: uses a throwaway second app instance.
export async function createLogin(email, password) {
  const tmp = initializeApp(cfg, 'tmp' + Date.now());
  try {
    const a = getAuth(tmp);
    const { user } = await createUserWithEmailAndPassword(a, email, password);
    await signOut(a);
    return user.uid;
  } finally { await deleteApp(tmp); }
}
