import { PASSWORD, commit, db0, session, setUid, watch } from './store.js';

export const getAuth = app => ({ tmp: !!app?.tmp });
export const onAuthStateChanged = (_, cb) => {
  let last;
  const fire = () => { if (session.uid !== last) { last = session.uid; cb(session.uid ? { uid: session.uid } : null); } };
  fire();
  return watch(fire);
};
export const signInWithEmailAndPassword = async (_, email, pw) => {
  const id = Object.keys(db0.users).find(k => db0.users[k].email === email);
  if (!id || pw !== (db0.passwords?.[email] || PASSWORD)) throw new Error('Wrong email or password (demo accounts use demo123).');
  setUid(id);
};
export const signOut = async a => { if (!a.tmp) setUid(null); };
export const createUserWithEmailAndPassword = async (_, email, pw) => {
  const uid = Math.random().toString(36).slice(2, 10);
  (db0.passwords ||= {})[email] = pw;
  commit();
  return { user: { uid } };
};
export const updatePassword = async (_, pw) => { const u = db0.users[session.uid]; (db0.passwords ||= {})[u.email] = pw; commit(); };
export const sendPasswordResetEmail = async () => {};
