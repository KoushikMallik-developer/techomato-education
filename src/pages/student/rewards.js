import { doc, runTransaction } from 'firebase/firestore';
import { db, questions } from '../../firebase.js';
import { rewardsDue } from '../../score.js';
import { notify, plural } from '../../ui.jsx';
import { get, myAttempts, myCourses, mySubs } from './data.js';

// Pays every test and course reward the student has earned but not been paid yet, and says so in a toast.
// Run when it may have changed: after submitting a test, and when the Dashboard or Leaderboard opens.
// shortcut: like the practice points, this is written by the student's own browser, so a determined student could fake points; a server function would fix that.
export async function payRewards(me) {
  if (me.role !== 'student') return;
  const [courses, subs, attempts, qs] = await Promise.all([myCourses(me.uid), mySubs(me.uid), myAttempts(me.uid), questions()]);
  const tests = (await Promise.all([...new Set(courses.flatMap(c => c.testIds || []))].map(t => get('tests', t)))).filter(Boolean);
  const due = rewardsDue({ courses, tests, subs, attempts, cases: Object.fromEntries(qs.map(q => [q.id, q.tests.length])) });
  if (!due.length) return;
  const ref = doc(db, 'leaderboard', me.uid);
  const paid = await runTransaction(db, async tx => {
    const cur = (await tx.get(ref)).data() || {}, had = cur.rewards || {};
    const fresh = due.filter(([k]) => !had[k]);
    if (fresh.length) tx.set(ref, { ...cur, name: me.name, points: (cur.points || 0) + fresh.reduce((n, r) => n + r[1], 0), rewards: { ...had, ...Object.fromEntries(fresh.map(([k, p]) => [k, p])) } }); // the whole entry: streak and day stay as they were
    return fresh;
  });
  if (paid.length) notify(paid.length === 1 ? `+${paid[0][1]} points for ${paid[0][2]}` : `+${paid.reduce((n, r) => n + r[1], 0)} points for ${plural(paid.length, 'reward')}`);
}
