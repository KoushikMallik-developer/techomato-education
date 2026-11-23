import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyOf, dayIndex, nextStreak, scoreTable, perWeek, joinSeries, histogram, questionStats, perDay } from './score.js';

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

import { windowOf, leftMs, clock, readiness, newCode, testCode, courseCode, langsOf, langOfSub, typeLabel } from './schedule.js';
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
