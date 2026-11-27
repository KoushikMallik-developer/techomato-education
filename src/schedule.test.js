import test from 'node:test';
import assert from 'node:assert/strict';
import { timeUp } from './schedule.js';

test('timeUp: only timed tests, by the attempt deadline, or by answers when no attempt was saved', () => {
  const t = { durationMin: 60 };
  assert.equal(timeUp({}, null, 2, 100), false); // untimed never runs out
  assert.equal(timeUp(t, { deadline: 200 }, 1, 100), false); // time left
  assert.equal(timeUp(t, { deadline: 200 }, 0, 300), true); // deadline passed, even with no answers
  assert.equal(timeUp(t, null, 0, 300), false); // never started
  assert.equal(timeUp(t, null, 1, 300), true); // answers but no attempt record
});
