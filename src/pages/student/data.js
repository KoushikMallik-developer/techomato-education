import { collection, doc, getDoc, query, where } from 'firebase/firestore';
import { db, list } from '../../firebase.js';

// Small Firestore reads shared by the student pages.
export const get = async (col, id) => { const s = await getDoc(doc(db, col, id)); return s.exists() ? { id, ...s.data() } : null; }; // null = deleted by the trainer
export const mySubs = (uid, extra = []) => list(query(collection(db, 'submissions'), where('userId', '==', uid), ...extra));
export const myCourses = uid => list(query(collection(db, 'courses'), where('students', 'array-contains', uid)));
