import { collection, doc, getCountFromServer, getDoc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, list } from './firebase.js';
import { DARK, pickCause } from './precheck.js';

// Free, browser-only proctoring for tests marked "proctored" (Firestore only, no paid Storage).
//  - Countdown (10 s, then the exam is auto-submitted): no face, covered camera, camera stopped. It cancels if the problem clears.
//  - Pause behind an overlay until fixed: left fullscreen, a second screen, a muted microphone.
//  - Instant warning banner: more than one face, looking away.
// Everything above, plus tab switches, paste/copy/cut, right-click, refused starts and the end of the exam, is written to the `proctor` collection.
// shortcut: a browser cannot lock the computer. A second device, a helper off camera, a virtual camera or devtools are not caught. Safe Exam Browser or server-side grading is the next step.
export const KIND_LABEL = {
  start: 'Exam started',
  restart: 'Exam restarted (the page was closed or reloaded mid-exam)',
  'start-refused': 'Start refused',
  finished: 'Exam finished by the student',
  'auto-submit-started': 'Auto-submit started',
  'auto-submitted': 'Exam auto-submitted',
  'left-page': 'Left the test page (tab or window switch)',
  'left-fullscreen': 'Left fullscreen',
  'left-fullscreen-cleared': 'Returned to fullscreen',
  'second-screen': 'A second screen was connected',
  'second-screen-cleared': 'Second screen removed',
  'mic-lost': 'Microphone stopped or was muted',
  'mic-lost-cleared': 'Microphone back',
  'no-face': 'No face detected (10 s countdown started)',
  'no-face-cleared': 'Face back, countdown cancelled',
  'camera-black': 'Camera covered or too dark (10 s countdown started)',
  'camera-black-cleared': 'Camera uncovered, countdown cancelled',
  'camera-lost': 'Camera stopped or blocked (10 s countdown started)',
  'camera-lost-cleared': 'Camera back, countdown cancelled',
  'multiple-faces': 'More than one face detected',
  'multiple-faces-cleared': 'Only one face again',
  'looking-away': 'Looking away from the screen',
  'looking-away-cleared': 'Looking at the screen again',
  paste: 'Tried to paste',
  copy: 'Tried to copy',
  cut: 'Tried to cut',
  'right-click': 'Right-clicked',
  'blocked-key': 'Pressed a blocked shortcut (developer tools, view source, save or print)',
  'screenshot-key': 'Pressed the Print Screen key',
  devtools: 'Developer tools seem to be open',
};
const quiet = k => k === 'start' || k === 'finished' || k.endsWith('-cleared'); // these are just the story of the exam, not flags
const FLAG_KINDS = Object.keys(KIND_LABEL).filter(k => !quiet(k));
// Flag counts for every (student, test) pair in one course as {uid_testId: n}: one cheap count query per pair, never the events themselves.
// shortcut: one count query per pair, fine to about 200 students; beyond that keep a summary document per student.
export const flagMap = async (courseId, uids, testIds) => Object.fromEntries(await Promise.all(uids.flatMap(u => testIds.map(async t => [`${u}_${t}`, await flagCount(u, courseId, t)]))));
// How many flags a student has on a test. A count query costs one read, so tables can show it without reading every event.
export const flagCount = (uid, courseId, testId) => getCountFromServer(query(collection(db, 'proctor'), where('userId', '==', uid), where('courseId', '==', courseId), where('testId', '==', testId), where('kind', 'in', FLAG_KINDS))).then(r => r.data().count);
export const PROBLEM_TEXT = {
  'left-fullscreen': 'The exam must stay in fullscreen.',
  'second-screen': 'A second screen is connected. Disconnect it or set it to mirror (duplicate) this screen to continue.',
  'mic-lost': 'Your microphone stopped or is muted. Unmute it to continue.',
};
export const COUNTDOWN_TEXT = { 'no-face': 'No face detected.', 'camera-black': 'Your camera is covered or too dark.', 'camera-lost': 'Your camera stopped.' };
export const WARN_TEXT = { 'multiple-faces': 'More than one face detected.', 'looking-away': 'You are looking away from the screen.', devtools: 'Developer tools seem to be open. Close them.' };
// Camera names of software that feeds a pre-recorded or edited picture instead of the real camera.
const VIRTUAL_CAM = /obs|virtual|manycam|snap camera|xsplit|droidcam|iriun|epoccam|camo|nvidia broadcast|splitcam|vcam|webcamoid/i;
// Shortcuts that open developer tools, view the page source, save or print it.
const BLOCKED_KEY = e => e.key === 'F12' || ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'u' || e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'p' || (e.shiftKey && 'ijc'.includes(e.key.toLowerCase()))));

const SNAP_EVERY = 120000; // a photo every 2 minutes keeps a class inside the free Firestore write quota
const LIMIT = { proctor: 3000, snaps: 200 }; // per student per test; firestore.rules enforces the same numbers. Events are one per episode, not per frame.
const COUNTDOWN = 10, TICK = 600, WARN_MIN_MS = 3000;

let s = null; // running session internals
let submitCurrent = null; // set by the open question page: grades and saves the code on screen
let state = { testId: null, courseId: null, home: '', problems: [], countdown: null, why: null, warnings: [], submitting: false, ended: null }; // what React reads; replaced, never mutated
const listeners = new Set();
const set = patch => { state = { ...state, ...patch }; listeners.forEach(f => f()); };
export const subscribe = f => (listeners.add(f), () => listeners.delete(f));
export const snapshot = () => state;
export const active = testId => state.testId === testId;
export const setSubmitter = f => { submitCurrent = f; };
let inflight = null; // a student's own submit that is still grading; auto-submit waits for it wherever the student is now
export const track = p => { inflight = p; p.finally(() => { if (inflight === p) inflight = null; }); };
export const timeUp = () => autoSubmit('time-up'); // the trainer's time limit ran out
export const dismissEnded = () => set({ ended: null });
export const backToFullscreen = () => document.documentElement.requestFullscreen?.().catch(() => {});

const brightness = video => {
  const c = Object.assign(document.createElement('canvas'), { width: 32, height: 24 });
  const g = c.getContext('2d');
  g.drawImage(video, 0, 0, 32, 24);
  const d = g.getImageData(0, 0, 32, 24).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return sum / (d.length / 4);
};

let detector;
export const faceDetector = () => (detector ||= loadFaceDetector().catch(e => { detector = null; throw e; })); // loaded once: the setup check and the exam share it
async function loadFaceDetector() {
  const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const { FaceDetector, FilesetResolver } = await import(/* @vite-ignore */ `${base}/vision_bundle.mjs`);
  return FaceDetector.createFromOptions(await FilesetResolver.forVisionTasks(`${base}/wasm`), {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
    runningMode: 'VIDEO',
  });
}

export const facesIn = (det, video) => det.detectForVideo(video, performance.now()).detections;
// How far the head is turned: nose offset from the eye midpoint, in eye-distances (about 0 facing the screen, 0.5+ clearly turned).
const yaw = d => { const [r, l, nose] = d.keypoints || []; return r && l && nose ? Math.abs((nose.x - (r.x + l.x) / 2) / (Math.abs(l.x - r.x) || 1)) : 0; };

// One look at the camera for the setup check: brightness, how many faces, and where the one face is and how bright it is.
export function inspectFrame(det, video) {
  const w = video.videoWidth || 320, h = video.videoHeight || 240;
  const mean = brightness(video);
  const faces = mean < DARK ? [] : facesIn(det, video);
  const f = { ready: video.readyState >= 2, mean, faces: faces.length, size: 0, cx: 0.5, faceLuma: null, turned: 0 };
  if (faces.length === 1) {
    const b = faces[0].boundingBox, x = Math.max(0, b.originX), y = Math.max(0, b.originY);
    const c = Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
    const g = c.getContext('2d');
    g.drawImage(video, x, y, Math.min(b.width, w - x), Math.min(b.height, h - y), 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    Object.assign(f, { size: b.width / w, cx: (b.originX + b.width / 2) / w, faceLuma: sum / 256, turned: yaw(faces[0]) });
  }
  return f;
}

// Call from a click (fullscreen needs a user gesture). Throws a readable error, and leaves nothing running, if any check fails.
export async function start(uid, courseId, testId, home, questionIds = [], consent = '') { // the same test in another course is a separate exam
  if (active(testId)) return;
  stop();
  const cleanups = [];
  const cleanup = () => { cleanups.splice(0).reverse().forEach(f => { try { f(); } catch { /* already gone */ } }); };

  await document.documentElement.requestFullscreen?.().catch(() => {}); // first: it must follow the click closely
  cleanups.push(() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });

  // Event and photo numbers continue where earlier sessions stopped, so ids never collide. The ids are what let firestore.rules cap them.
  const idx = { proctor: 0, snaps: 0 };
  const count = col => getCountFromServer(query(collection(db, col), where('userId', '==', uid), where('courseId', '==', courseId), where('testId', '==', testId))).then(r => r.data().count);
  try { [idx.proctor, idx.snaps] = await Promise.all([count('proctor'), count('snaps')]); } catch { cleanup(); throw new Error('Could not reach the proctoring records. Check your connection and try again.'); }
  // critical records (start, auto-submitted) may use the last 10 numbers; everything else stops 10 short
  const put = (col, data, critical) => { const i = idx[col]++; return i < LIMIT[col] - (critical ? 0 : 10) ? setDoc(doc(db, col, `${uid}_${courseId}_${testId}_${i}`), { ...data, userId: uid, courseId, testId, at: Date.now() }) : Promise.resolve(); };
  const fail = msg => { put('proctor', { kind: 'start-refused', detail: msg }).catch(() => {}); cleanup(); throw new Error(msg); };

  if (!document.fullscreenElement) fail('Fullscreen is required for this test. Allow it and try again.');
  // an exam that was auto-submitted stays ended; if this cannot be checked, do not start
  let ended;
  try { ended = await list(query(collection(db, 'proctor'), where('userId', '==', uid), where('courseId', '==', courseId), where('testId', '==', testId), where('kind', '==', 'auto-submitted'))); } catch { fail('Could not check your exam status. Check your connection and try again.'); }
  if (ended.length) fail('Your exam was ended and submitted automatically. You cannot restart it. Contact your trainer.');
  if (screen.isExtended) fail('A second screen is connected. Disconnect it (or set it to mirror this screen) and try again.');

  const devs = (await navigator.mediaDevices?.enumerateDevices?.().catch(() => [])) || [];
  if (!devs.some(d => d.kind === 'videoinput')) fail('No camera found. This test needs a working camera.');
  if (!devs.some(d => d.kind === 'audioinput')) fail('No microphone found. This test needs a working microphone.');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: true }); } catch (e) {
    fail(e.name === 'NotAllowedError' ? 'Allow camera and microphone access, then try again.' : e.name === 'NotFoundError' ? 'No camera or microphone found. This test needs both.' : 'Your camera or microphone could not be opened. Close other apps using them and try again.');
  }
  cleanups.push(() => stream.getTracks().forEach(t => t.stop()));
  const camName = stream.getVideoTracks()[0]?.label || '';
  if (VIRTUAL_CAM.test(camName)) fail(`The camera "${camName}" looks like virtual camera software. Close it and use your real camera.`);
  const video = Object.assign(document.createElement('video'), { srcObject: stream, muted: true, playsInline: true });
  video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.append(video);
  cleanups.push(() => video.remove());
  await video.play().catch(() => {});

  // a covered or dead camera still "works", so look at the picture itself for ~2 seconds
  let best = 0;
  for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 400)); if (video.readyState >= 2) best = Math.max(best, brightness(video)); }
  if (best < DARK) fail('Your camera image is black or too dark. Uncover the camera, turn on a light and try again.');
  if (stream.getAudioTracks()[0]?.muted) fail('Your microphone is muted. Unmute it and try again.');

  // exactly one face must be in view to begin; if the face model cannot load the exam cannot be proctored, so it does not start
  let det;
  try { det = await faceDetector(); } catch { fail('The face check could not load. Check your internet connection and try again.'); }
  let seen = 0;
  for (let i = 0; i < 6 && !seen; i++) { await new Promise(r => setTimeout(r, 500)); seen = facesIn(det, video).length; }
  if (seen === 0) fail('We cannot see your face. Sit facing the camera in good light and try again.');
  if (seen > 1) fail('More than one face is visible. Only you may be in view.');

  // the first write proves the rules are deployed; if it fails the trainer would get no evidence, so do not start
  const key = `tk-proctor-${uid}-${courseId}-${testId}`;
  let restarted = false;
  try { restarted = !!sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch { /* private mode */ }
  try { await put('proctor', { kind: restarted ? 'restart' : 'start', ...(consent ? { detail: `Agreed to: ${consent}` } : {}) }, true); } catch { fail('Proctoring could not save its records, so the test cannot start. Tell your trainer (Firestore rules may not be deployed).'); }

  const log = (kind, detail) => put('proctor', { kind, ...(detail ? { detail } : {}) }).catch(() => {}); // after start, a failed log must not break the test
  const snap = reason => {
    if (video.readyState < 2) return;
    const c = Object.assign(document.createElement('canvas'), { width: 240, height: 180 });
    c.getContext('2d').drawImage(video, 0, 0, 240, 180);
    put('snaps', { img: c.toDataURL('image/jpeg', 0.5), ...(reason ? { reason } : {}) }).catch(() => {});
  };
  const on = (t, ev, f) => { t.addEventListener(ev, f); cleanups.push(() => t.removeEventListener(ev, f)); };
  const every = (f, ms) => { const id = setInterval(f, ms); cleanups.push(() => clearInterval(id)); };

  // pauses: shown as an overlay until fixed
  const problems = new Set();
  const flag = (kind, isOn) => {
    if (isOn === problems.has(kind)) return;
    isOn ? problems.add(kind) : problems.delete(kind);
    log(isOn ? kind : `${kind}-cleared`);
    if (isOn && kind === 'second-screen') snap(kind);
    set({ problems: [...problems] });
  };
  // warnings: a banner that shows at once, stays for at least 3 s, and clears when the cause is gone
  const warns = new Map(); // kind -> earliest time it may clear
  const warn = (kind, isOn) => {
    if (isOn && !warns.has(kind)) { warns.set(kind, Date.now() + WARN_MIN_MS); log(kind); snap(kind); set({ warnings: [...warns.keys()] }); }
    else if (!isOn && warns.has(kind) && Date.now() >= warns.get(kind)) { warns.delete(kind); log(`${kind}-cleared`); set({ warnings: [...warns.keys()] }); }
  };

  // countdown: starts at the first bad reading, cancels when the picture is good again, ends in an auto-submit
  let deadline = 0, why = null;
  const startCountdown = w => { if (deadline) return; why = w; deadline = Date.now() + COUNTDOWN * 1000; log(w); snap(w); set({ countdown: COUNTDOWN, why: w }); };
  const cancelCountdown = () => { if (!deadline) return; log(`${why}-cleared`, `after ${Math.round(COUNTDOWN - (deadline - Date.now()) / 1000)} s`); deadline = 0; set({ countdown: null, why: null }); };
  let trackLost = false;

  let last = 0;
  const leave = () => { if (Date.now() - last > 1000) { last = Date.now(); log('left-page'); } }; // a tab switch fires both blur and visibilitychange
  on(window, 'blur', leave);
  on(document, 'visibilitychange', () => document.hidden && leave());
  on(document, 'fullscreenchange', () => flag('left-fullscreen', !document.fullscreenElement));
  // keyboard lock (Chrome, in fullscreen): Esc, Tab, F5 and the window shortcuts go to the exam, so Esc needs a long press to leave
  navigator.keyboard?.lock?.(['Escape', 'Tab', 'F5', 'F11', 'KeyW', 'KeyT', 'KeyN', 'KeyL', 'MetaLeft', 'MetaRight']).catch(() => {});
  cleanups.push(() => navigator.keyboard?.unlock?.());
  on(document, 'keydown', e => { if (BLOCKED_KEY(e)) { e.preventDefault(); log('blocked-key', e.key); } });
  on(document, 'keyup', e => { if (e.key === 'PrintScreen') { navigator.clipboard?.writeText('').catch(() => {}); log('screenshot-key'); } });
  // shortcut: open developer tools docked to the window shrink it, which this notices; undocked ones are not caught
  every(() => warn('devtools', Math.max(outerWidth - innerWidth, outerHeight - innerHeight) > 200), 1500);
  ['paste', 'copy', 'cut', 'contextmenu'].forEach(t => on(document, t, e => { e.preventDefault(); log(t === 'contextmenu' ? 'right-click' : t); }));
  stream.getVideoTracks().forEach(t => { on(t, 'ended', () => { trackLost = true; }); on(t, 'mute', () => { trackLost = true; }); on(t, 'unmute', () => { trackLost = false; }); });
  stream.getAudioTracks().forEach(t => { on(t, 'ended', () => flag('mic-lost', true)); on(t, 'mute', () => flag('mic-lost', true)); on(t, 'unmute', () => flag('mic-lost', false)); });

  every(() => flag('second-screen', !!screen.isExtended), 2000);
  every(() => snap(), SNAP_EVERY);
  setTimeout(() => snap(), 800);

  // the watch loop: camera and face, every 0.6 s. Two readings in a row (about 1.2 s) so a single dropped frame never alarms.
  let none = 0, many = 0, away = 0, covered = 0;
  every(() => {
    const ready = video.readyState >= 2;
    if (ready) {
      covered = brightness(video) < DARK ? covered + 1 : 0;
      const faces = covered ? [] : facesIn(det, video);
      none = !covered && faces.length === 0 ? none + 1 : 0;
      many = faces.length > 1 ? many + 1 : 0;
      away = faces.length === 1 && yaw(faces[0]) > 0.6 ? away + 1 : 0;
    }
    const cause = pickCause({ trackLost, covered, none });
    if (cause) startCountdown(cause); else if (ready) cancelCountdown();
    warn('multiple-faces', many >= 2);
    warn('looking-away', away >= 2);
  }, TICK);

  every(() => {
    if (!deadline) return;
    const left = Math.ceil((deadline - Date.now()) / 1000);
    if (left <= 0) autoSubmit(why); else if (left !== state.countdown) set({ countdown: left });
  }, 250);

  s = { cleanup, key, log, put, uid, courseId, testId, questionIds, ending: false };
  set({ testId, courseId, home, problems: [], countdown: null, why: null, warnings: [], submitting: false, ended: null });
}

// The moment a student ended the test, with their flag count, so classmates can be ranked by score, flags and time without reading anyone's proctor log.
// The first write wins (rules refuse an update). shortcut: the flag count is written by the student's browser, so it can be faked; the trainer's own proctor log is the real record.
export const recordFinish = async (uid, courseId, testId, proctored) => {
  const flags = proctored ? await flagCount(uid, courseId, testId).catch(() => 0) : 0;
  await setDoc(doc(db, 'finishes', `${uid}_${courseId}_${testId}`), { userId: uid, courseId, testId, flags, at: Date.now() }).catch(() => {});
};

// Gives every unanswered question an empty zero-score submission. Once every question has a submission the test is over and cannot be opened again.
export async function fillUnanswered(uid, courseId, testId, questionIds) {
  for (const qid of questionIds) {
    try {
      const ref = doc(db, 'submissions', `${uid}_${courseId}_${testId}_${qid}`);
      if ((await getDoc(ref)).exists()) continue;
      const q = await getDoc(doc(db, 'questions', qid));
      if (q.exists()) await setDoc(ref, { userId: uid, courseId, testId, questionId: qid, code: '', passed: 0, total: q.data().tests.length, auto: true, at: serverTimestamp() });
    } catch { /* one failed question must not stop the rest */ }
  }
}

// Ends the exam: saves what is on screen, gives every unanswered question an empty zero-score submission, records it, and leaves.
async function autoSubmit(reason) {
  if (!s || s.ending) return;
  s.ending = true;
  const { uid, courseId, testId, questionIds, log, put } = s;
  set({ countdown: null, submitting: true });
  log('auto-submit-started', reason);
  try { await (inflight || submitCurrent?.()); } catch { /* the empty-submission step below still runs */ }
  await fillUnanswered(uid, courseId, testId, questionIds);
  await put('proctor', { kind: 'auto-submitted', detail: reason }, true).catch(() => {}); // awaited: it is what keeps the exam ended
  await recordFinish(uid, courseId, testId, true);
  stop(false);
  set({ ended: reason === 'time-up' ? 'Your time is up, so your exam was submitted automatically.' : `${COUNTDOWN_TEXT[reason] || 'A problem with your camera'} The 10 second countdown ran out, so your exam was submitted automatically. Your trainer can see what happened.` });
  location.hash = '#/';
}

// finished = the student submitted everything and left on purpose; otherwise the next start counts as a restart
export function stop(finished) {
  if (!s) return;
  if (finished) s.log('finished');
  s.cleanup();
  if (finished) { try { sessionStorage.removeItem(s.key); } catch { /* ignore */ } }
  s = null;
  set({ testId: null, courseId: null, home: '', problems: [], countdown: null, why: null, warnings: [], submitting: false });
}
