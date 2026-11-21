import { db0, commit, session, watch } from './store.js';

export const getFirestore = () => ({});
export const collection = (_, name) => ({ name });
export const doc = (_, col, id) => ({ col, id });
export const where = (f, op, v) => ({ f, op, v });
export const query = (c, ...w) => ({ ...c, w });
export const serverTimestamp = () => Date.now();
export const arrayUnion = (...v) => ({ __op: 'union', v });
export const arrayRemove = (...v) => ({ __op: 'remove', v });

const match = (d, { f, op, v }) => (op === '==' ? d[f] === v : op === 'array-contains' ? (d[f] || []).includes(v) : op === 'in' ? v.includes(d[f]) : false);
const snap = (col, id) => { const d = db0[col]?.[id]; return { id, exists: () => !!d, data: () => d && structuredClone(d) }; };
const apply = (cur, patch) => {
  const out = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v?.__op === 'union' ? [...new Set([...(cur[k] || []), ...v.v])] : v?.__op === 'remove' ? (cur[k] || []).filter(x => !v.v.includes(x)) : v;
  }
  return out;
};

export const getDoc = async r => snap(r.col, r.id);
export const getDocs = async q => ({
  docs: Object.keys(db0[q.name] || {}).filter(id => (q.w || []).every(w => match(db0[q.name][id], w))).map(id => snap(q.name, id)),
});
export const addDoc = async (c, d) => {
  const id = Math.random().toString(36).slice(2, 10);
  (db0[c.name] ||= {})[id] = apply({}, d);
  commit();
  return { id };
};
export const setDoc = async (r, d) => {
  // mirrors firestore.rules: free students can create a submission once but not overwrite it
  if (r.col === 'submissions' && db0.submissions?.[r.id] && !db0.users[session.uid]?.subscribed) throw new Error('Missing or insufficient permissions.');
  (db0[r.col] ||= {})[r.id] = apply({}, d);
  commit();
};
export const updateDoc = async (r, patch) => { db0[r.col][r.id] = apply(db0[r.col][r.id], patch); commit(); };
export const onSnapshot = (r, cb) => { cb(snap(r.col, r.id)); return watch(() => cb(snap(r.col, r.id))); };
export const deleteDoc = async r => { delete db0[r.col]?.[r.id]; commit(); };
