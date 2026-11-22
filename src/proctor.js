import { addDoc, collection, doc, getDoc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, list } from './firebase.js';
import { DARK } from './precheck.js';

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
};
export const isFlag = e => !(e.kind === 'start' || e.kind === 'finished' || e.kind.endsWith('-cleared')); // the rest are just the story of the exam
export const PROBLEM_TEXT = {
  'left-fullscreen': 'The exam must stay in fullscreen.',
  'second-screen': 'A second screen is connected. Disconnect it or set it to mirror (duplicate) this screen to continue.',
  'mic-lost': 'Your microphone stopped or is muted. Unmute it to continue.',
};
export const COUNTDOWN_TEXT = { 'no-face': 'No face detected.', 'camera-black': 'Your camera is covered or too dark.', 'camera-lost': 'Your camera stopped.' };
export const WARN_TEXT = { 'multiple-faces': 'More than one face detected.', 'looking-away': 'You are looking away from the screen.' };

const SNAP_EVERY = 60000, MAX_EVENTS = 3000; // the cap is only a safety net for the free Firestore quota; events are one per episode, not per frame
const COUNTDOWN = 10, TICK = 600, WARN_MIN_MS = 3000;

let s = null; // running session internals
let submitCurrent = null; // set by the open question page: grades and saves the code on screen
let state = { testId: null, home: '', problems: [], countdown: null, why: null, warnings: [], submitting: false, ended: null }; // what React reads; replaced, never mutated
const listeners = new Set();
const set = patch => { state = { ...state, ...patch }; listeners.forEach(f => f()); };
export const subscribe = f => (listeners.add(f), () => listeners.delete(f));
export const snapshot = () => state;
export const active = testId => state.testId === testId;
export const setSubmitter = f => { submitCurrent = f; };
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

export async function faceDetector() {
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
export async function start(uid, testId, home, questionIds = []) {
  if (active(testId)) return;
  stop();
  const write = (col, data) => addDoc(collection(db, col), { ...data, at: Date.now() });
  const cleanups = [];
  const cleanup = () => { cleanups.splice(0).reverse().forEach(f => { try { f(); } catch { /* already gone */ } }); };
  const fail = msg => { write('proctor', { userId: uid, testId, kind: 'start-refused', detail: msg }).catch(() => {}); cleanup(); throw new Error(msg); };

  // an exam that was auto-submitted stays ended
  const ended = await list(query(collection(db, 'proctor'), where('userId', '==', uid), where('testId', '==', testId), where('kind', '==', 'auto-submitted'))).catch(() => []);
  if (ended.length) fail('Your exam was ended and submitted automatically. You cannot restart it. Contact your trainer.');

  if (screen.isExtended) fail('A second screen is connected. Disconnect it (or set it to mirror this screen) and try again.');
  await document.documentElement.requestFullscreen?.().catch(() => {}); // first: it must follow the click closely
  cleanups.push(() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });
  if (!document.fullscreenElement) fail('Fullscreen is required for this test. Allow it and try again.');

  const devs = (await navigator.mediaDevices?.enumerateDevices?.().catch(() => [])) || [];
  if (!devs.some(d => d.kind === 'videoinput')) fail('No camera found. This test needs a working camera.');
  if (!devs.some(d => d.kind === 'audioinput')) fail('No microphone found. This test needs a working microphone.');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: true }); } catch (e) {
    fail(e.name === 'NotAllowedError' ? 'Allow camera and microphone access, then try again.' : e.name === 'NotFoundError' ? 'No camera or microphone found. This test needs both.' : 'Your camera or microphone could not be opened. Close other apps using them and try again.');
  }
  cleanups.push(() => stream.getTracks().forEach(t => t.stop()));
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
  cleanups.push(() => det.close?.());
  let seen = 0;
  for (let i = 0; i < 6 && !seen; i++) { await new Promise(r => setTimeout(r, 500)); seen = facesIn(det, video).length; }
  if (seen === 0) fail('We cannot see your face. Sit facing the camera in good light and try again.');
  if (seen > 1) fail('More than one face is visible. Only you may be in view.');

  // the first write proves the rules are deployed; if it fails the trainer would get no evidence, so do not start
  const key = `tk-proctor-${uid}-${testId}`;
  let restarted = false;
  try { restarted = !!sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch { /* private mode */ }
  try { await write('proctor', { userId: uid, testId, kind: restarted ? 'restart' : 'start' }); } catch { fail('Proctoring could not save its records, so the test cannot start. Tell your trainer (Firestore rules may not be deployed).'); }

  let n = 0;
  const log = (kind, detail) => { if (n++ < MAX_EVENTS) write('proctor', { userId: uid, testId, kind, ...(detail ? { detail } : {}) }).catch(() => {}); }; // after start, a failed log must not break the test
  const snap = reason => {
    if (video.readyState < 2) return;
    const c = Object.assign(document.createElement('canvas'), { width: 240, height: 180 });
    c.getContext('2d').drawImage(video, 0, 0, 240, 180);
    write('snaps', { userId: uid, testId, img: c.toDataURL('image/jpeg', 0.5), ...(reason ? { reason } : {}) }).catch(() => {});
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
    const cause = trackLost ? 'camera-lost' : covered >= 2 ? 'camera-black' : none >= 2 ? 'no-face' : null;
    if (cause) startCountdown(cause); else if (ready) cancelCountdown();
    warn('multiple-faces', many >= 2);
    warn('looking-away', away >= 2);
  }, TICK);

  every(() => {
    if (!deadline) return;
    const left = Math.ceil((deadline - Date.now()) / 1000);
    if (left <= 0) autoSubmit(why); else if (left !== state.countdown) set({ countdown: left });
  }, 250);

  s = { cleanup, key, log, uid, testId, questionIds, ending: false };
  set({ testId, home, problems: [], countdown: null, why: null, warnings: [], submitting: false, ended: null });
}

// Ends the exam: saves what is on screen, gives every unanswered question an empty zero-score submission, records it, and leaves.
async function autoSubmit(reason) {
  if (!s || s.ending) return;
  s.ending = true;
  const { uid, testId, questionIds, log } = s;
  set({ countdown: null, submitting: true });
  log('auto-submit-started', reason);
  try { await submitCurrent?.(); } catch { /* the empty-submission step below still runs */ }
  for (const qid of questionIds) {
    try {
      const ref = doc(db, 'submissions', `${uid}_${testId}_${qid}`);
      if ((await getDoc(ref)).exists()) continue;
      const q = await getDoc(doc(db, 'questions', qid));
      if (q.exists()) await setDoc(ref, { userId: uid, testId, questionId: qid, code: '', passed: 0, total: q.data().tests.length, auto: true, at: serverTimestamp() });
    } catch { /* one failed question must not stop the rest */ }
  }
  await addDoc(collection(db, 'proctor'), { userId: uid, testId, kind: 'auto-submitted', detail: reason, at: Date.now() }).catch(() => {}); // awaited: it is what keeps the exam ended
  stop(false);
  set({ ended: `${COUNTDOWN_TEXT[reason] || 'A problem with your camera'} The 10 second countdown ran out, so your exam was submitted automatically. Your trainer can see what happened.` });
  location.hash = '#/';
}

// finished = the student submitted everything and left on purpose; otherwise the next start counts as a restart
export function stop(finished) {
  if (!s) return;
  if (finished) s.log('finished');
  s.cleanup();
  if (finished) { try { sessionStorage.removeItem(s.key); } catch { /* ignore */ } }
  s = null;
  set({ testId: null, home: '', problems: [], countdown: null, why: null, warnings: [], submitting: false });
}
