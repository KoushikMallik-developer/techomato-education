import test from 'node:test';
import assert from 'node:assert/strict';
import { buckets, testReward, rewardsDue, series, averageScore, dailyOf, dayIndex, nextStreak, scoreTable, perWeek, joinSeries, histogram, questionStats, perDay, inCourse, activityByDay, dayKey, byRank, pointsFor } from './score.js';

test('sums passed cases; unattempted tests are null; unsubmitted questions still count in total', () => {
  const rows = scoreTable(
    [{ id: 'a' }, { id: 'b' }],
    [{ id: 't1', questionIds: ['q1', 'q2'] }],
    { q1: 3, q2: 2 },
    [{ userId: 'a', testId: 't1', questionId: 'q1', passed: 3 }],
  );
  assert.deepEqual(rows[0].cells[0], { passed: 3, total: 5 });
  assert.equal(rows[1].cells[0], null);
});

test('submissions for deleted questions do not count', () => {
  const rows = scoreTable([{ id: 'a' }], [{ id: 't1', questionIds: ['q1', 'q2'] }], { q1: 3 }, [
    { userId: 'a', testId: 't1', questionId: 'q1', passed: 3 }, { userId: 'a', testId: 't1', questionId: 'q2', passed: 2 }]);
  assert.deepEqual(rows[0].cells[0], { passed: 3, total: 3 });
});

test('streak: same day keeps, next day extends, gap restarts', () => {
  assert.equal(nextStreak({ lastDay: 'd2', streak: 4 }, 'd2', 'd1'), 4);
  assert.equal(nextStreak({ lastDay: 'd1', streak: 4 }, 'd2', 'd1'), 5);
  assert.equal(nextStreak({ lastDay: 'd0', streak: 4 }, 'd2', 'd1'), 1);
  assert.equal(nextStreak({ lastDay: '', streak: 0 }, 'd2', 'd1'), 1);
});

test('day index follows the local date, not UTC', () => {
  const late = new Date(2026, 10, 22, 23, 30), early = new Date(2026, 10, 22, 0, 30), next = new Date(2026, 10, 23, 0, 30);
  assert.equal(dayIndex(late), dayIndex(early));
  assert.equal(dayIndex(next), dayIndex(late) + 1);
});

test('the daily question skips exam questions, wraps around, and is null when nothing is open', () => {
  const qs = ['e', 'a', 'd', 'b', 'c'].map(id => ({ id })); // sorted: a b c d e
  assert.equal(dailyOf(qs, new Set(), 7).id, 'c'); // 7 % 5 = 2
  assert.equal(dailyOf(qs, new Set(['c']), 7).id, 'd');
  assert.equal(dailyOf(qs, new Set(['d', 'e']), 8).id, 'a'); // 8 % 5 = 3 -> d, e hidden -> wraps to a
  assert.equal(dailyOf(qs, new Set(['a', 'b', 'c', 'd', 'e']), 7), null);
  assert.equal(dailyOf([], new Set(), 7), null);
});

test('course analytics: weekly counts, cumulative joins and score bins', () => {
  const now = new Date(2026, 10, 25, 12).getTime(); // Wednesday
  const day = 864e5;
  assert.deepEqual(perWeek([now, now - 8 * day, now - 100 * day, undefined], 3, now), [0, 1, 1]);
  // 2 joins in window + 1 before it + 1 with no date: starts at 2, then 3, then 4... never loses students
  const s = joinSeries([now - 8 * day, now, now - 200 * day, undefined], 5, 3, now);
  assert.deepEqual(s, [3, 4, 5]);
  assert.equal(s[s.length - 1], 5); // always ends at the enrolled total
  assert.deepEqual(histogram([0, 19, 20, 99, 100]), [2, 1, 0, 0, 2]);
});

test('question stats: tests using it, and the average of each student\'s best attempt', () => {
  const qs = [{ id: 'a' }, { id: 'b' }], tests = [{ id: 't1', questionIds: ['a'] }, { id: 't2', questionIds: ['a', 'b'] }];
  const subs = [{ userId: 'u1', questionId: 'a', passed: 1, total: 4 }, { userId: 'u1', questionId: 'a', passed: 4, total: 4 }, { userId: 'u2', questionId: 'a', passed: 2, total: 4 }];
  const st = questionStats(qs, tests, subs);
  assert.equal(st.a.tests.length, 2);
  assert.equal(st.a.students, 2);
  assert.equal(st.a.avg, 75); // u1 best 100, u2 50
  assert.deepEqual([st.b.students, st.b.avg], [0, null]);
});

test('perDay counts submissions per calendar day, oldest first', () => {
  const now = new Date(2026, 10, 25, 12).getTime(), day = 864e5;
  assert.deepEqual(perDay([now, now - 1000, now - day, now - 30 * day, undefined], 3, now), [0, 1, 2]);
});

import { windowOf, statusOf, leftMs, clock, readiness, newCode, testCode, courseCode, langsOf, langOfSub, typeLabel } from './schedule.js';
test('windowOf: soon before publish, closed after end, open between', () => {
  const t = { publishAt: 100, endAt: 200 };
  assert.deepEqual([windowOf(t, 50), windowOf(t, 150), windowOf(t, 201), windowOf({}, 5)], ['soon', 'open', 'closed', 'open']);
});
test('timer: remaining time never goes below zero and formats as a clock', () => {
  assert.equal(leftMs({ deadline: 1000 }, 400), 600);
  assert.equal(leftMs({ deadline: 1000 }, 5000), 0);
  assert.deepEqual([clock(65000), clock(3661000), clock(0)], ['01:05', '1:01:01', '00:00']);
});

test('readiness lists everything missing before a test can be published', () => {
  const ok = { title: 'T', questionIds: ['a'], publishAt: 100, endAt: 200, durationMin: 30 };
  const bank = new Set(['a']);
  assert.deepEqual(readiness(ok, bank, 50), []);
  assert.equal(readiness({ ...ok, title: ' ', questionIds: [] }, bank).length, 2);
  assert.equal(readiness({ ...ok, questionIds: ['gone'] }, bank).length, 1);
  assert.equal(readiness({ ...ok, endAt: 100 }, bank).length, 1);
  assert.equal(readiness({ title: 'T', questionIds: ['a'] }, bank).length, 3);
  assert.equal(readiness(ok, bank, 300).length, 1);
  assert.deepEqual(readiness(ok, bank, 50, 0), ['Assign the test to at least one course']);
});

test('test codes look like T-XXXXXX and old tests fall back to their document id', () => {
  assert.match(newCode(), /^T-[A-Z2-9]{6}$/);
  assert.equal(testCode({ id: 'abc123xyz', code: 'T-KQ7M2X' }), 'T-KQ7M2X');
  assert.equal(testCode({ id: 'abc123xyz' }), 'T-ABC123');
});

test('course codes look like C-XXXXXX', () => {
  assert.match(newCode('C'), /^C-[A-Z2-9]{6}$/);
  assert.equal(courseCode({ id: 'abc123xyz' }), 'C-ABC123');
});

test('languages: a test allows all unless it lists some; old answers keep their old language', () => {
  assert.deepEqual(langsOf({}), ['python', 'js', 'cpp']);
  assert.deepEqual(langsOf({ languages: ['js'] }), ['js']);
  assert.equal(langOfSub({ lang: 'cpp' }, { env: 'code' }), 'cpp');
  assert.equal(langOfSub({}, { env: 'js' }), 'js');
  assert.equal(langOfSub({}, { env: 'code' }), 'python');
  assert.equal(typeLabel({ env: 'web' }), 'HTML / CSS / JS');
});

test('a submission counts in the course it was made in; old ones with no course count in every course', () => {
  assert.equal(inCourse({ courseId: 'c1' }, 'c1'), true);
  assert.equal(inCourse({ courseId: 'c1' }, 'c2'), false);
  assert.equal(inCourse({}, 'c2'), true);
});

test('a test is a draft until it is complete and in a course', () => {
  const t = { title: 'T', questionIds: ['q'], publishAt: 1, endAt: Date.now() + 1e6, durationMin: 30 };
  assert.equal(statusOf(t, new Set(['q']), 0), 'draft');
  assert.equal(statusOf(t, new Set([]), 1), 'draft'); // its question was deleted
  assert.equal(statusOf(t, new Set(['q']), 1), 'open');
  assert.equal(statusOf({ ...t, draft: true }, new Set(['q']), 1), 'draft');
});

test('activityByDay counts answers per local day, for numbers and Timestamps, and skips ones without a time', () => {
  const t = new Date(2026, 10, 22, 15).getTime();
  const m = activityByDay([{ at: t }, { at: { toMillis: () => t + 1000 } }, { at: t - 864e5 }, {}]);
  assert.deepEqual(m, { [dayKey(new Date(t))]: 2, [dayKey(new Date(t - 864e5))]: 1 });
});

test('byRank: higher score first, then fewer flags, then the earlier finish', () => {
  const rows = [{ n: 'late', pct: 90, flags: 0, at: 9 }, { n: 'flagged', pct: 90, flags: 2, at: 1 }, { n: 'top', pct: 100, flags: 5, at: 5 }, { n: 'early', pct: 90, flags: 0, at: 2 }];
  assert.deepEqual(rows.sort(byRank).map(r => r.n), ['top', 'early', 'late', 'flagged']);
});

test('50 points for the first full solve in practice only', () => {
  assert.equal(pointsFor('practice', 3, 3, false), 50);
  assert.equal(pointsFor('practice', 3, 3, true), 0); // solved before
  assert.equal(pointsFor('practice', 2, 3, false), 0); // not every case passed
  assert.equal(pointsFor('t1', 3, 3, false), 0); // a test, not Problems
});

test('averageScore: every student counts once, unanswered questions count as 0', () => {
  const tests = [{ id: 't', questionIds: ['a', 'b'] }], cases = { a: 2, b: 2 };
  // s1 answers both questions (4/4 = 100%), s2 answers one and passes half of it (1/4 = 25%): the class average is 63, not the pooled 5/6
  const subs = [{ userId: 's1', testId: 't', questionId: 'a', passed: 2 }, { userId: 's1', testId: 't', questionId: 'b', passed: 2 }, { userId: 's2', testId: 't', questionId: 'a', passed: 1 }];
  assert.equal(averageScore(subs, tests, cases), 63);
  assert.equal(averageScore([], tests, cases), null);
});

test('series buckets amounts by hour, day and month, and skips undated or out-of-range ones', () => {
  const now = new Date(2026, 10, 25, 15, 30).getTime(), h = 36e5, day = 864e5;
  const items = [[now, 499], [now - h, 1], [now - 3 * day, 200], [now - 40 * day, 7], [now - 800 * day, 9], [undefined, 5]];
  const sum = r => series(items, r, now).reduce((a, p) => a + p.value, 0);
  assert.equal(series(items, 'today', now).length, 16); // midnight to 3 pm
  assert.deepEqual(series(items, 'today', now).slice(-2).map(p => p.value), [1, 499]);
  assert.deepEqual([sum('today'), sum('week'), sum('month'), sum('year'), sum('all')], [500, 700, 700, 707, 716]);
  assert.equal(series(items, 'week', now).length, 7);
  assert.equal(series(items, 'year', now).length, 12);
  assert.equal(series([], 'all', now).length, 1);
});

test('testReward: 60 to under 75 = 25, 75 to under 100 = 100, 100 = 200', () => {
  assert.deepEqual([0, 59.9, 60, 74.9, 75, 99.9, 100].map(testReward), [0, 0, 25, 25, 100, 100, 200]);
});

test('rewardsDue pays only finished tests, counts unanswered questions as 0, and completed courses', () => {
  const now = 1e12, cases = { a: 2, b: 2 };
  const tests = [{ id: 't1', title: 'T1', questionIds: ['a', 'b'] }, { id: 't2', title: 'T2', questionIds: ['a', 'b'] }, { id: 't3', title: 'T3', questionIds: ['a', 'b'] }];
  const courses = [{ id: 'c', title: 'C', testIds: ['t1', 't2', 't3'], completed: true }];
  const subs = [
    { testId: 't1', courseId: 'c', questionId: 'a', passed: 2 }, { testId: 't1', courseId: 'c', questionId: 'b', passed: 2 }, // all submitted, 100%
    { testId: 't2', courseId: 'c', questionId: 'a', passed: 2 }, // one of two answered, timer ran out: 2/4 = 50%, no reward
    { testId: 't3', courseId: 'c', questionId: 'a', passed: 2 }, // one answered, still running: not over yet
  ];
  const attempts = [{ courseId: 'c', testId: 't2', deadline: now - 1 }, { courseId: 'c', testId: 't3', deadline: now + 1 }];
  assert.deepEqual(rewardsDue({ courses, tests, subs, attempts, cases, now }).map(([k, p]) => [k, p]), [['test_c_t1', 200], ['course_c', 500]]);
  subs.push({ testId: 't2', courseId: 'c', questionId: 'b', passed: 1 }); // now 3/4 = 75%
  assert.deepEqual(rewardsDue({ courses, tests, subs, attempts, cases, now }).find(r => r[0] === 'test_c_t2')[1], 100);
});

test('custom ranges: per day up to 62 days, else per month cut to the chosen days', () => {
  const from = new Date(2026, 0, 10, 15).getTime(), to = new Date(2026, 0, 12, 9).getTime();
  const b = buckets('custom', 0, 0, from, to);
  assert.equal(b.unit, 'day');
  assert.deepEqual([b.starts.length, b.starts[0], b.starts[3]], [4, +new Date(2026, 0, 10), +new Date(2026, 0, 13)]);
  const items = [[new Date(2026, 0, 10, 1).getTime(), 5], [new Date(2026, 0, 12, 23).getTime(), 7], [new Date(2026, 0, 13, 0, 1).getTime(), 9]];
  assert.deepEqual(series(items, 'custom', 0, from, to).map(p => p.value), [5, 0, 7]);
  const long = buckets('custom', 0, 0, new Date(2026, 0, 20).getTime(), new Date(2026, 4, 5).getTime());
  assert.equal(long.unit, 'month');
  assert.deepEqual([long.starts.length, long.starts[0], long.starts[1], long.starts[5]], [6, +new Date(2026, 0, 20), +new Date(2026, 1, 1), +new Date(2026, 4, 6)]);
});
