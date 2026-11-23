import test from 'node:test';
import assert from 'node:assert/strict';
import { judge, pickCause } from './precheck.js';

const good = { ready: true, mean: 120, faces: 1, size: 0.3, cx: 0.5, faceLuma: 110, turned: 0.1 };
const env = { mic: true, oneScreen: true };
const failing = (f, e = env) => judge(f, e).filter(c => !c.ok).map(c => c.key);

test('a good frame passes every check', () => assert.deepEqual(failing(good), []));
test('each problem fails only its own check', () => {
  assert.deepEqual(failing({ ...good, mean: 10, faces: 0 }), ['camera', 'lighting', 'face', 'place']);
  assert.deepEqual(failing({ ...good, mean: 30 }), ['lighting']);
  assert.deepEqual(failing({ ...good, mean: 240 }), ['lighting']);
  assert.deepEqual(failing({ ...good, faceLuma: 20 }), ['lighting']); // backlit: fine frame, dark face
  assert.deepEqual(failing({ ...good, faces: 2 }), ['face', 'place']);
  assert.deepEqual(failing({ ...good, size: 0.05 }), ['place']);
  assert.deepEqual(failing({ ...good, cx: 0.9 }), ['place']);
  assert.deepEqual(failing({ ...good, turned: 0.8 }), ['place']);
  assert.deepEqual(failing(good, { mic: false, oneScreen: false }), ['mic', 'screen']);
});

test('the countdown starts only after two bad readings in a row, and a stopped camera wins', () => {
  assert.equal(pickCause({ trackLost: false, covered: 0, none: 1 }), null); // one missed frame
  assert.equal(pickCause({ trackLost: false, covered: 0, none: 2 }), 'no-face');
  assert.equal(pickCause({ trackLost: false, covered: 2, none: 0 }), 'camera-black');
  assert.equal(pickCause({ trackLost: false, covered: 2, none: 5 }), 'camera-black'); // covered explains the missing face
  assert.equal(pickCause({ trackLost: true, covered: 2, none: 5 }), 'camera-lost');
  assert.equal(pickCause({ trackLost: false, covered: 0, none: 0 }), null);
});
