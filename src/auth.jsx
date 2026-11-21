import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const Ctx = createContext(null);
export const useMe = () => useContext(Ctx);

// me: undefined = loading, null = signed out / no profile, object = {uid, name, role, subscribed}
export function AuthProvider({ children }) {
  const [me, setMe] = useState(undefined);
  useEffect(() => {
    let off = () => {};
    const stop = onAuthStateChanged(auth, u => {
      off();
      if (!u) return setMe(null);
      off = onSnapshot(doc(db, 'users', u.uid), s => setMe(s.exists() ? { uid: u.uid, ...s.data() } : null), () => setMe(null));
    });
    return () => { stop(); off(); };
  }, []);
  return <Ctx.Provider value={me}>{children}</Ctx.Provider>;
}
