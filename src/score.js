// Per-student, per-test score for a course: passed cases / total cases, or null if the student never submitted.
export function scoreTable(students, tests, caseCount, subs) {
  const total = t => t.questionIds.reduce((n, q) => n + (caseCount[q] || 0), 0);
  return students.map(student => ({
    student,
    cells: tests.map(t => {
      const mine = subs.filter(x => x.userId === student.id && x.testId === t.id && caseCount[x.questionId]); // skip questions deleted since
      return mine.length ? { passed: mine.reduce((n, x) => n + x.passed, 0), total: total(t) } : null;
    }),
  }));
}

// Streak after a submission today: same day keeps it, the day after extends it, any gap restarts at 1.
export const nextStreak = (cur, today, yesterday) => (cur.lastDay === today ? cur.streak : cur.lastDay === yesterday ? cur.streak + 1 : 1);

export const dayKey = d => d.toLocaleDateString('en-CA'); // local calendar day, e.g. 2026-11-22
export const dayIndex = d => Math.floor(Date.parse(dayKey(d)) / 864e5); // whole days since 1970 for the local date

// The daily-contest question. Picked from the full list so it does not change when exam questions (`hide`) come and go;
// an exam question moves the pick to the next open one. null when nothing is open.
export const dailyOf = (qs, hide = new Set(), day = dayIndex(new Date())) => {
  const s = [...qs].sort((a, b) => a.id.localeCompare(b.id)), i = day % (s.length || 1);
  return s.map((_, k) => s[(i + k) % s.length]).find(q => !hide.has(q.id)) || null;
};

// ---- course analytics (charts on the trainer's course page) ----
const WEEK = 7 * 864e5;
export const weekStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }; // Monday 00:00 local
const weekBack = (t, now) => Math.round((weekStart(now) - weekStart(t)) / WEEK); // 0 = this week; rounding absorbs daylight saving
export const lastWeeks = (n, now = Date.now()) => Array.from({ length: n }, (_, i) => weekStart(now - (n - 1 - i) * WEEK));
// How many of `times` fall in each of the last n weeks, oldest first. Entries without a time are skipped.
export const perWeek = (times, n = 8, now = Date.now()) => {
  const out = Array(n).fill(0);
  times.filter(Boolean).forEach(t => { const k = weekBack(t, now); if (k >= 0 && k < n) out[n - 1 - k]++; });
  return out;
};
// Students enrolled at the end of each of the last n weeks. Students with no recorded join time (enrolled before joins were logged) count from the start.
export const joinSeries = (joinTimes, total, n = 8, now = Date.now()) => {
  const known = joinTimes.filter(Boolean), before = known.filter(t => weekBack(t, now) >= n).length, weekly = perWeek(known, n, now);
  let run = total - known.length + before;
  return weekly.map(c => (run += c));
};
// Counts of percentages per equal bin; 100 lands in the last bin.
export const histogram = (pcts, bins = 5) => { const out = Array(bins).fill(0); pcts.forEach(p => { out[Math.min(bins - 1, Math.floor((p / 100) * bins))]++; }); return out; };

// Per question: the tests that use it, how many students tried it, and their average result (each student counts once, with their best attempt).
export function questionStats(questions, tests, subs) {
  const out = {};
  for (const q of questions) {
    const best = new Map();
    subs.filter(s => s.questionId === q.id && s.total).forEach(s => best.set(s.userId, Math.max(best.get(s.userId) ?? 0, (100 * s.passed) / s.total)));
    const v = [...best.values()];
    out[q.id] = { tests: tests.filter(t => t.questionIds.includes(q.id)), students: v.length, avg: v.length ? Math.round(v.reduce((n, x) => n + x, 0) / v.length) : null };
  }
  return out;
}

// Counts per calendar day for the last n days, oldest first. Entries without a time are skipped.
export const perDay = (times, n = 14, now = Date.now()) => {
  const out = Array(n).fill(0), today = dayIndex(new Date(now));
  times.filter(Boolean).forEach(t => { const k = today - dayIndex(new Date(t)); if (k >= 0 && k < n) out[n - 1 - k]++; });
  return out;
};

// A submission counts in a course when it was made there. Answers saved before courseId existed count in every course that has the test.
export const inCourse = (sub, courseId) => !sub.courseId || sub.courseId === courseId;
