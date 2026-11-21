import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreTable } from './score.js';

test('sums passed cases; unattempted tests are null; unsubmitted questions still count in total', () => {
  const rows = scoreTable(
    [{ id: 'a' }, { id: 'b' }],
    [{ id: 't1', questionIds: ['q1', 'q2'] }],
    { q1: 3, q2: 2 },
    [{ userId: 'a', testId: 't1', passed: 3 }],
  );
  assert.deepEqual(rows[0].cells[0], { passed: 3, total: 5 });
  assert.equal(rows[1].cells[0], null);
});
