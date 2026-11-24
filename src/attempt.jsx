import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { clock, leftMs, timed, windowOf } from './schedule.js';
import * as proctor from './proctor.js';
import { Icon } from './ui.jsx';

const BEAT = 10000; // how often the remaining time is written to the database

// The student's attempt at a timed test. The deadline is a fixed moment (start + duration), so the timer keeps running while the page
// is closed. Every 10 s the time left is saved; on return the student carries on with whatever is left.
// shortcut: the deadline uses the student's own clock, so a wrong clock shifts it; firestore.rules checks it against server time.
export function useAttempt(courseId, testId, test, uid) { // one timer per student, course and test
  const id = `${uid}_${courseId}_${testId}`, on = timed(test);
  const [got, setGot] = useState({}); // {id, data}: the attempt doc once loaded, data is null when not started
  const ready = !on || got.id === id, a = on && ready ? got.data : null;
  const setA = data => setGot({ id, data });
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => { if (on) getDoc(doc(db, 'attempts', id)).then(s => setGot({ id, data: s.exists() ? s.data() : null })); }, [id, on]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = a ? leftMs(a, now) : null;
  useEffect(() => {
    if (!a || left === 0) return;
    const t = setInterval(() => updateDoc(doc(db, 'attempts', id), { beat: Date.now(), left: Math.round(leftMs(a) / 1000) }).catch(() => {}), BEAT);
    return () => clearInterval(t);
  }, [a, id, left === 0]);
  useEffect(() => { // time ran out while an exam is open: submit it
    if (left === 0 && !fired.current && proctor.active(testId)) { fired.current = true; proctor.timeUp(); }
  }, [left, testId]);
  const start = useCallback(async () => {
    if (a) return; // resuming: the deadline never moves
    if (windowOf(test) !== 'open') throw new Error('This test is not open to start right now.');
    const t = Date.now(), rec = { userId: uid, courseId, testId, startedAt: t, deadline: t + test.durationMin * 6e4, beat: t, left: test.durationMin * 60 };
    await setDoc(doc(db, 'attempts', id), rec);
    setA(rec);
  }, [a, id, test, courseId, testId, uid]);
  return { loading: !ready, started: !!a, left, expired: left === 0, start };
}

export const TimerBar = ({ left }) => (
  <div className={`rounded-[14px] bg-warn-soft text-warn py-3 px-4 font-semibold text-[14px] flex gap-2.5 items-center ${left < 60000 ? 'bg-accent-soft! text-accent-ink!' : ''} justify-between`} role="timer">
    <span className="flex items-center gap-2"><Icon name="clock" size={18} />Time left</span>
    <b className="font-mono text-[20px]">{clock(left)}</b>
  </div>
);
