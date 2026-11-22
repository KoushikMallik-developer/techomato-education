import { useEffect, useRef, useState } from 'react';
import { faceDetector, inspectFrame } from './proctor.js';
import { judge } from './precheck.js';
import { Icon } from './ui.jsx';

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
    const stop = () => { clearInterval(id); stream?.getTracks().forEach(t => t.stop()); det?.close?.(); stopRef.current = null; };
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
    <div className="stack" style={{ gap: 12 }}>
      <b>Check your setup</b>
      {phase === 'idle' || phase === 'error' ? (
        <div className="stack" style={{ gap: 8 }}>
          {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
          <div><button className="btn btn-ink" onClick={begin}>{phase === 'error' ? 'Try again' : 'Check my camera'}</button></div>
        </div>
      ) : phase === 'loading' ? <span className="muted"><span className="spinner" /> Opening camera and loading the face check…</span> : null}
      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', ...(live ? {} : { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }) }}> {/* kept in the page while loading so the camera has somewhere to play */}
        <video ref={video} muted playsInline style={{ width: 320, height: 240, borderRadius: 12, background: '#000', transform: 'scaleX(-1)' }} />
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8, flex: 1, minWidth: 220 }} aria-live="polite">
          {lines.map(c => (
            <li key={c.key} className="row" style={{ gap: 8, alignItems: 'flex-start', color: c.ok ? 'var(--pass)' : 'var(--warn)' }}>
              <Icon name={c.ok ? 'check' : 'x'} size={18} stroke={2.4} /><span style={{ color: 'var(--ink)' }}>{c.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
