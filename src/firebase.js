import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getFirestore, getDocs } from 'firebase/firestore';

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

// Student-facing pages share one read of the question bank per 5 minutes instead of one per page view.
// shortcut: a question a trainer just added can take up to 5 minutes to show for students; add a snapshot listener if that matters.
let qCache;
export const questions = () => (qCache && Date.now() - qCache.at < 3e5 ? qCache.p : (qCache = { at: Date.now(), p: list(collection(db, 'questions')).catch(e => { qCache = null; throw e; }) }).p);

export const forgetQuestions = () => { qCache = null; }; // call after a trainer adds or deletes a question

// Firestore allows 30 values per `in` filter: run one query per group of 30 ids and join the results.
export const listIn = async (ids, make) => (await Promise.all(Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) => list(make(ids.slice(i * 30, i * 30 + 30)))))).flat();

// Creates a login without signing the admin out: uses a throwaway second app instance.
export async function createLogin(email, password) {
  const tmp = initializeApp(cfg, 'tmp' + Date.now());
  try {
    const a = getAuth(tmp);
    // email already taken = an earlier attempt made the login but not the profile: reuse it if the password matches
    const { user } = await createUserWithEmailAndPassword(a, email, password).catch(e => {
      if (e.code !== 'auth/email-already-in-use') throw e;
      return signInWithEmailAndPassword(a, email, password);
    });
    await signOut(a);
    return user.uid;
  } finally { await deleteApp(tmp); }
}
