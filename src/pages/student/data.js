import { collection, doc, getDoc, query, where } from 'firebase/firestore';
import { db, list, questions } from '../../firebase.js';

// Small Firestore reads shared by the student pages.
export const get = async (col, id) => { const s = await getDoc(doc(db, col, id)); return s.exists() ? { id, ...s.data() } : null; }; // null = deleted by the trainer
export const mySubs = (uid, extra = []) => list(query(collection(db, 'submissions'), where('userId', '==', uid), ...extra));
export const myCourses = uid => list(query(collection(db, 'courses'), where('students', 'array-contains', uid)));

// Questions used in a proctored test stay out of practice, the daily contest and search, so nobody can solve them before the exam.
// shortcut: cached 5 minutes like the question bank, so a brand-new proctored test hides its questions within 5 minutes. The hidden cases stay readable through the Firestore API (see README).
let exam = { at: 0, p: null };
export const examQuestionIds = () => ((Date.now() - exam.at < 3e5 && exam.p) || (exam = { at: Date.now(), p: list(query(collection(db, 'tests'), where('proctored', '==', true))).then(ts => new Set(ts.flatMap(t => t.questionIds))).catch(e => { exam.at = 0; throw e; }) }).p);
export const isPublic = q => q.public !== false; // questions made before the public/private choice count as public
export const openQuestions = async () => { const [qs, hide] = await Promise.all([questions(), examQuestionIds()]); return qs.filter(q => isPublic(q) && !hide.has(q.id)); };
