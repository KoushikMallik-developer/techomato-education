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

// "Average student score", the one average every staff page shows: each student's score on each test they took
// (cases passed / all cases in the test, so unanswered questions count as 0), averaged per student, then over students. Every student counts once.
export function averageScore(subs, tests, caseCount) {
  const students = [...new Set(subs.map(s => s.userId))].map(id => ({ id }));
  const per = scoreTable(students, tests, caseCount, subs).map(r => r.cells.filter(c => c && c.total)).filter(c => c.length)
    .map(c => c.reduce((n, x) => n + x.passed / x.total, 0) / c.length);
  return per.length ? Math.round((100 * per.reduce((a, b) => a + b, 0)) / per.length) : null;
}

// Streak after a submission today: same day keeps it, the day after extends it, any gap restarts at 1.
export const nextStreak = (cur, today, yesterday) => (cur.lastDay === today ? cur.streak : cur.lastDay === yesterday ? cur.streak + 1 : 1);

// Points: fully solving a question in Practice (Problems or the daily contest) earns 50, once per question.
export const SOLVE_POINTS = 50;
// A finished test earns points by its score: 60% to under 75% = 25, 75% to under 100% = 100, 100% = 200. A completed course earns 500. Each once.
export const testReward = pct => (pct >= 100 ? 200 : pct >= 75 ? 100 : pct >= 60 ? 25 : 0);
export const COURSE_POINTS = 500;
// Rewards a student has earned: [[key, points, why]]. The key is stored once paid, so nothing is paid twice.
// A test counts once it is over for the student: every question submitted, or their timer ran out. Its score counts every question
// (unanswered ones as 0): cases passed / all cases of the test's questions. cases: { questionId: number of test cases }.
export function rewardsDue({ courses, tests, subs, attempts, cases, now = Date.now() }) {
  const out = [], byId = Object.fromEntries(tests.map(t => [t.id, t]));
  for (const c of courses) {
    for (const tid of c.testIds || []) {
      const t = byId[tid]; if (!t || t.draft) continue;
      const qids = (t.questionIds || []).filter(q => cases[q]); if (!qids.length) continue;
      const mine = subs.filter(x => x.testId === tid && inCourse(x, c.id) && qids.includes(x.questionId));
      const att = attempts.find(a => a.courseId === c.id && a.testId === tid);
      const over = qids.every(q => mine.some(x => x.questionId === q)) || (!!att && att.deadline <= now);
      if (!over) continue;
      const total = qids.reduce((n, q) => n + cases[q], 0), passed = mine.reduce((n, x) => n + (x.passed || 0), 0);
      const pct = (100 * passed) / total, pts = testReward(pct);
      if (pts) out.push([`test_${c.id}_${tid}`, pts, `${Math.floor(pct)}% in ${t.title}`]);
    }
    if (c.completed) out.push([`course_${c.id}`, COURSE_POINTS, `completing ${c.title}`]);
  }
  return out;
}
export const pointsFor = (testId, passed, total, solvedBefore) => (testId === 'practice' && total > 0 && passed === total && !solvedBefore ? SOLVE_POINTS : 0);

export const dayKey = d => d.toLocaleDateString('en-CA'); // local calendar day, e.g. 2026-11-22
// Class ranking: higher score, then fewer proctoring flags, then who finished first. Use with Array.sort.
export const byRank = (a, b) => b.pct - a.pct || a.flags - b.flags || a.at - b.at;
// How many answers were saved on each day: { '2026-11-22': 3 }. `at` is a number in demo mode and a Timestamp in Firebase.
// shortcut: an answer is one document per question, so a re-submitted answer counts on its last day only.
export const activityByDay = subs => subs.reduce((m, s) => { const t = s.at?.toMillis?.() ?? s.at; if (t) { const k = dayKey(new Date(t)); m[k] = (m[k] || 0) + 1; } return m; }, {});
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
// The time slots of a range, in local time: { starts, unit }. starts has one more entry than there are slots (the last is where the range ends).
// today: per hour up to now · week: last 7 days · month: last 30 days · year: last 12 months · all: per month since `first`
// custom: from one date to another (both days included; from/to are any times on those days), per day up to 62 days, else per month.
export function buckets(range, now = Date.now(), first = now, from = now, to = now) {
  const d = new Date(now), y = d.getFullYear(), m = d.getMonth(), day = d.getDate(), f = new Date(first);
  const make = (n, at) => Array.from({ length: n + 1 }, (_, k) => +at(k));
  if (range === 'custom') {
    const a = new Date(Math.min(from, to)), b = new Date(Math.max(from, to));
    const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()), end = +new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1);
    const days = Math.round((end - start) / 864e5);
    if (days <= 62) return { starts: make(days, k => new Date(a.getFullYear(), a.getMonth(), a.getDate() + k)), unit: 'day' };
    const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
    const starts = make(months, k => new Date(a.getFullYear(), a.getMonth() + k, 1));
    starts[0] = +start; starts[months] = end; // the first and last month are cut to the chosen days
    return { starts, unit: 'month' };
  }
  const at = {
    today: k => new Date(y, m, day, k), week: k => new Date(y, m, day - 6 + k), month: k => new Date(y, m, day - 29 + k),
    year: k => new Date(y, m - 11 + k, 1), all: k => new Date(f.getFullYear(), f.getMonth() + k, 1),
  }[range];
  const n = { today: d.getHours() + 1, week: 7, month: 30, year: 12, all: (y - f.getFullYear()) * 12 + m - f.getMonth() + 1 }[range];
  return { starts: make(n, at), unit: range === 'today' ? 'hour' : range === 'week' || range === 'month' ? 'day' : range === 'year' ? 'month' : 'month-year' };
}
// Points for a graph over a range. items: [[time, amount]] (amount 1 to count things). from/to: only for 'custom'.
export function series(items, range, now = Date.now(), from, to) {
  const first = Math.min(now, ...items.map(([t]) => t).filter(Boolean));
  const { starts, unit } = buckets(range, now, first, from, to), n = starts.length - 1;
  const out = Array(n).fill(0);
  items.forEach(([t, v]) => { if (!t || t < starts[0] || t >= starts[n]) return; let k = 0; while (t >= starts[k + 1]) k++; out[k] += v || 0; });
  const fmt = { hour: { hour: 'numeric' }, day: { day: 'numeric', month: 'short' }, month: { month: 'short' }, 'month-year': { month: 'short', year: '2-digit' } }[unit];
  return out.map((value, k) => ({ label: new Date(starts[k]).toLocaleString('en-IN', fmt), value }));
}
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
