import { useEffect, useRef, useState } from 'react';
import { faceDetector, inspectFrame } from './proctor.js';
import { judge } from './precheck.js';
import { Icon, btn } from './ui.jsx';

// Live camera preview with a checklist (camera, lighting, face, position, microphone, screen) shown before a proctored exam.
// onReady(true) fires once every line has passed for 2 seconds in a row. stopRef.current() releases the camera.
export default function SetupCheck({ onReady, stopRef }) {
  const [phase, setPhase] = useState('idle'); // idle | loading | live | error
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState('');
  const video = useRef(null);
  useEffect(() => () => stopRef.current?.(), [stopRef]);

  const begin = async () => {
    setPhase('loading'); setErr('');
    let stream, det, id;
    const stop = () => { clearInterval(id); stream?.getTracks().forEach(t => t.stop()); stopRef.current = null; };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: true });
      stopRef.current = stop;
      video.current.srcObject = stream;
      await video.current.play();
      det = await faceDetector();
    } catch (e) {
      stop();
      setErr(e.name === 'NotAllowedError' ? 'Allow camera and microphone access in your browser, then try again.' : e.name === 'NotFoundError' ? 'No camera or microphone found. This test needs both.' : /load|fetch|import/i.test(e.message) ? 'The face check could not load. Check your internet connection and try again.' : 'Your camera or microphone could not be opened. Close other apps using them and try again.');
      setPhase('error');
      return;
    }
    let good = 0;
    id = setInterval(() => {
      const mic = stream.getAudioTracks()[0];
      const list = judge(inspectFrame(det, video.current), { mic: mic?.readyState === 'live' && !mic.muted, oneScreen: !screen.isExtended });
      setLines(list);
      good = list.every(c => c.ok) ? good + 1 : 0;
      onReady(good >= 4);
    }, 500);
    setPhase('live');
  };

  const live = phase === 'live';
  return (
    <div className="flex flex-col gap-3">
      {phase === 'idle' || phase === 'error' ? (
        <div className="flex flex-col gap-2">
          {err && <p className="text-accent-ink text-[13px] font-semibold m-0" role="alert">{err}</p>}
          <div><button className={btn('ink', 'lg')} onClick={begin}>{phase === 'error' ? 'Try again' : 'Check my hardware'}</button></div>
        </div>
      ) : phase === 'loading' ? <span className="text-muted"><span className="w-4 h-4 rounded-full border-[2.5px] border-r-transparent animate-spin-fast" /> Opening camera and loading the face check…</span> : null}
      <div className="grid gap-5 grid-cols-[minmax(0,340px)_1fr] max-tablet:grid-cols-1 items-start" style={{ ...(live ? {} : { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }) }}> {/* kept in the page while loading so the camera has somewhere to play */}
        <video className="w-full aspect-[4/3] rounded-[12px] bg-[#000] object-cover [transform:scaleX(-1)]" ref={video} muted playsInline />
        <ul className="m-0 p-0 list-none! grid gap-3 grid-cols-2 max-phone:grid-cols-1 content-start" aria-live="polite">
          {lines.map(c => (
            <li key={c.key} className="flex gap-2 items-start rounded-xl border border-line bg-surface p-3" style={{ color: c.ok ? 'var(--pass)' : 'var(--warn)' }}>
              <Icon name={c.ok ? 'check' : 'x'} size={18} stroke={2.4} /><span className="text-ink">{c.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
