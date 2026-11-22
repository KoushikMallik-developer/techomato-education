import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase.js';

// Free, browser-only proctoring for tests marked "proctored".
// It logs integrity events and saves a small webcam photo every minute, all in Firestore (no paid Storage).
// shortcut: it deters and leaves evidence for the trainer; a second device or a helper off camera is not caught. Server-side grading would be the next step.
export const KIND_LABEL = {
  'left-page': 'Left the test page (tab or window switch)',
  'left-fullscreen': 'Left fullscreen',
  paste: 'Tried to paste',
  copy: 'Tried to copy',
  cut: 'Tried to cut',
  'right-click': 'Right-clicked',
  'camera-lost': 'Camera stopped',
};
const SNAP_EVERY = 60000, MAX_EVENTS = 200; // MAX_EVENTS keeps a noisy student from burning the free Firestore quota

let s = null; // the running session: {uid, testId, stream, video, stop}

export const active = testId => s?.testId === testId;

const write = (col, data) => addDoc(collection(db, col), { ...data, at: Date.now() }).catch(() => {}); // a failed log write must never break the test

// Call from a click: fullscreen and camera both need a user gesture. Throws a readable error if the camera is refused.
export async function start(uid, testId) {
  if (active(testId)) return;
  stop();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } }); } catch { throw new Error('This test needs your camera. Allow camera access and try again.'); }
  await document.documentElement.requestFullscreen?.().catch(() => {});
  const video = Object.assign(document.createElement('video'), { srcObject: stream, muted: true, playsInline: true });
  video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.append(video);
  await video.play().catch(() => {});

  let n = 0, last = 0;
  const log = kind => { if (n < MAX_EVENTS) { n++; write('proctor', { userId: uid, testId, kind }); } };
  const leave = () => { if (Date.now() - last > 1000) { last = Date.now(); log('left-page'); } }; // tab switch fires both blur and visibilitychange
  const snap = () => {
    if (video.readyState < 2) return;
    const c = Object.assign(document.createElement('canvas'), { width: 240, height: 180 });
    c.getContext('2d').drawImage(video, 0, 0, 240, 180);
    write('snaps', { userId: uid, testId, img: c.toDataURL('image/jpeg', 0.5) });
  };
  const block = e => { e.preventDefault(); log(e.type === 'contextmenu' ? 'right-click' : e.type); };
  const fs = () => { if (!document.fullscreenElement) log('left-fullscreen'); };
  const vis = () => { if (document.hidden) leave(); };
  const lost = () => log('camera-lost');

  window.addEventListener('blur', leave);
  document.addEventListener('visibilitychange', vis);
  document.addEventListener('fullscreenchange', fs);
  ['paste', 'copy', 'cut', 'contextmenu'].forEach(t => document.addEventListener(t, block));
  stream.getVideoTracks()[0].addEventListener('ended', lost);
  setTimeout(snap, 1500);
  const timer = setInterval(snap, SNAP_EVERY);

  s = {
    uid, testId, stream, video,
    stop() {
      clearInterval(timer);
      window.removeEventListener('blur', leave);
      document.removeEventListener('visibilitychange', vis);
      document.removeEventListener('fullscreenchange', fs);
      ['paste', 'copy', 'cut', 'contextmenu'].forEach(t => document.removeEventListener(t, block));
      stream.getTracks().forEach(t => t.stop());
      video.remove();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
  };
}

export function stop() { s?.stop(); s = null; }
