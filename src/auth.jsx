import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const Ctx = createContext(null);
export const useMe = () => useContext(Ctx);

// Anyone who signs up becomes a student. The profile is made only once the email is verified (Google emails already are); firestore.rules checks the same.
export const makeProfile = u => setDoc(doc(db, 'users', u.uid), { name: (u.displayName || u.email.split('@')[0]).trim().slice(0, 80), email: u.email, role: 'student', subscribed: false, createdAt: Date.now() });

// Auth knows when this user last signed in and when the account was made; only the user can read that, so it is copied onto their profile
// (the admin Users page shows it). Writes only when it changed, so the snapshot this triggers does not write again.
const noteSignIn = (u, p) => {
  const last = Date.parse(u.metadata?.lastSignInTime), made = Date.parse(u.metadata?.creationTime);
  if (!last || p.lastSignIn === last) return;
  updateDoc(doc(db, 'users', u.uid), { lastSignIn: last, ...(!p.createdAt && made ? { createdAt: made } : {}) }).catch(() => {}); // rules not deployed yet: the time is simply not shown
};

// me: undefined = loading, null = signed out / no profile, {uid, email, unverified} = signed up but email not verified yet, otherwise {uid, name, role, subscribed}
export function AuthProvider({ children }) {
  const [me, setMe] = useState(undefined);
  useEffect(() => {
    let off = () => {};
    const stop = onAuthStateChanged(auth, u => {
      off();
      if (!u) return setMe(null);
      off = onSnapshot(doc(db, 'users', u.uid), s => {
        if (s.exists()) { noteSignIn(u, s.data()); return setMe({ uid: u.uid, ...s.data() }); }
        if (s.metadata?.fromCache) return; // not known yet: never make a profile over one the server may have
        if (u.emailVerified) return makeProfile(u).catch(() => setMe(null)); // this snapshot fires again with the new profile
        setMe({ uid: u.uid, email: u.email, unverified: true });
      }, () => setMe(null));
    });
    return () => { stop(); off(); };
  }, []);
  return <Ctx.Provider value={me}>{children}</Ctx.Provider>;
}
