import test from 'node:test';
import assert from 'node:assert/strict';
import { dayIndex, nextStreak, scoreTable } from './score.js';

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
