import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase.js';

// Free, browser-only proctoring for tests marked "proctored" (Firestore only, no paid Storage).
// Hard rules pause the exam behind an overlay until fixed: fullscreen, camera, microphone, a single screen.
// Softer signals (tab switch, paste, no face, two faces) are logged for the trainer to judge.
// shortcut: a browser cannot lock the computer. A second device, a helper off camera or devtools are not caught. Safe Exam Browser or server-side grading is the next step.
export const KIND_LABEL = {
  start: 'Exam started',
  restart: 'Exam restarted (the page was closed or reloaded mid-exam)',
  'left-page': 'Left the test page (tab or window switch)',
  'left-fullscreen': 'Left fullscreen',
  'second-screen': 'A second screen was connected',
  'camera-black': 'Camera image was black or covered',
  'camera-lost': 'Camera stopped or was blocked',
  'mic-lost': 'Microphone stopped or was muted',
  'no-face': 'No face visible for several seconds',
  'multiple-faces': 'More than one face visible',
  'face-check-unavailable': 'Face check could not load (offline?)',
  paste: 'Tried to paste',
  copy: 'Tried to copy',
  cut: 'Tried to cut',
  'right-click': 'Right-clicked',
};
export const PROBLEM_TEXT = {
  'left-fullscreen': 'The exam must stay in fullscreen.',
  'second-screen': 'A second screen is connected. Disconnect it or set it to mirror (duplicate) this screen to continue.',
  'camera-black': 'Your camera image is black or too dark. Uncover the camera and turn on a light to continue.',
  'camera-lost': 'Your camera stopped. Reload the page and restart the exam (the restart is recorded).',
  'mic-lost': 'Your microphone stopped or is muted. Unmute it to continue, or reload and restart the exam.',
};
const SNAP_EVERY = 60000, MAX_EVENTS = 200; // MAX_EVENTS keeps a noisy student from burning the free Firestore quota
const DARK = 25; // mean brightness (0-255) below this is treated as a covered camera

let s = null; // running session internals
let state = { testId: null, home: '', problems: [] }; // what React reads; replaced (never mutated) on change
const listeners = new Set();
const set = patch => { state = { ...state, ...patch }; listeners.forEach(f => f()); };
export const subscribe = f => (listeners.add(f), () => listeners.delete(f));
export const snapshot = () => state;
export const active = testId => state.testId === testId;
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

async function faceDetector() {
  const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const { FaceDetector, FilesetResolver } = await import(/* @vite-ignore */ `${base}/vision_bundle.mjs`);
  return FaceDetector.createFromOptions(await FilesetResolver.forVisionTasks(`${base}/wasm`), {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
    runningMode: 'VIDEO',
  });
}

// Call from a click (fullscreen needs a user gesture). Throws a readable error, and leaves nothing running, if any check fails.
export async function start(uid, testId, home) {
  if (active(testId)) return;
  stop();
  const fail = msg => { cleanup(); throw new Error(msg); };
  const cleanups = [];
  const cleanup = () => { cleanups.splice(0).reverse().forEach(f => { try { f(); } catch { /* already gone */ } }); };

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

  // the first write proves the rules are deployed; if it fails the trainer would get no evidence, so do not start
  const key = `tk-proctor-${uid}-${testId}`;
  let n = 0;
  const write = (col, data) => addDoc(collection(db, col), { ...data, at: Date.now() });
  let restarted = false;
  try { restarted = !!sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch { /* private mode */ }
  try { await write('proctor', { userId: uid, testId, kind: restarted ? 'restart' : 'start' }); } catch { fail('Proctoring could not save its records, so the test cannot start. Tell your trainer (Firestore rules may not be deployed).'); }

  const log = kind => { if (n++ < MAX_EVENTS) write('proctor', { userId: uid, testId, kind }).catch(() => {}); }; // after start, a failed log must not break the test
  const problems = new Set();
  const flag = (kind, on) => {
    if (on === problems.has(kind)) return;
    on ? problems.add(kind) : problems.delete(kind);
    if (on) log(kind);
    set({ problems: [...problems] });
  };
  const on = (t, ev, f) => { t.addEventListener(ev, f); cleanups.push(() => t.removeEventListener(ev, f)); };
  const every = (f, ms) => { const id = setInterval(f, ms); cleanups.push(() => clearInterval(id)); };

  let last = 0;
  const leave = () => { if (Date.now() - last > 1000) { last = Date.now(); log('left-page'); } }; // a tab switch fires both blur and visibilitychange
  on(window, 'blur', leave);
  on(document, 'visibilitychange', () => document.hidden && leave());
  on(document, 'fullscreenchange', () => flag('left-fullscreen', !document.fullscreenElement));
  ['paste', 'copy', 'cut', 'contextmenu'].forEach(t => on(document, t, e => { e.preventDefault(); log(t === 'contextmenu' ? 'right-click' : t); }));
  stream.getVideoTracks().forEach(t => { on(t, 'ended', () => flag('camera-lost', true)); on(t, 'mute', () => flag('camera-lost', true)); on(t, 'unmute', () => flag('camera-lost', false)); });
  stream.getAudioTracks().forEach(t => { on(t, 'ended', () => flag('mic-lost', true)); on(t, 'mute', () => flag('mic-lost', true)); on(t, 'unmute', () => flag('mic-lost', false)); });

  let dark = 0;
  every(() => { // second screen, covered camera
    flag('second-screen', !!screen.isExtended);
    if (video.readyState >= 2) { dark = brightness(video) < DARK ? dark + 1 : 0; flag('camera-black', dark >= 2); }
  }, 2500);
  const snap = () => {
    if (video.readyState < 2 || problems.has('camera-black')) return;
    const c = Object.assign(document.createElement('canvas'), { width: 240, height: 180 });
    c.getContext('2d').drawImage(video, 0, 0, 240, 180);
    write('snaps', { userId: uid, testId, img: c.toDataURL('image/jpeg', 0.5) }).catch(() => {});
  };
  every(snap, SNAP_EVERY);
  setTimeout(snap, 800);

  // face check runs in the background; if it cannot load, the trainer is told rather than the student blocked
  let alive = true;
  cleanups.push(() => { alive = false; });
  faceDetector().then(det => {
    if (!alive) return;
    let none = 0, many = 0;
    every(() => {
      if (video.readyState < 2 || problems.has('camera-black')) return;
      const faces = det.detectForVideo(video, performance.now()).detections.length;
      none = faces === 0 ? none + 1 : 0; many = faces > 1 ? many + 1 : 0;
      if (none === 3) log('no-face'); // once per stretch of ~9 seconds without a face
      if (many === 2) log('multiple-faces');
    }, 3000);
  }).catch(() => log('face-check-unavailable'));

  s = { cleanup, key };
  set({ testId, home, problems: [] });
}

// finished = the student submitted everything and left on purpose; otherwise the next start counts as a restart
export function stop(finished) {
  if (!s) return;
  s.cleanup();
  if (finished) { try { sessionStorage.removeItem(s.key); } catch { /* ignore */ } }
  s = null;
  set({ testId: null, home: '', problems: [] });
}
