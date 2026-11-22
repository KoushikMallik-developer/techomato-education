import { useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMe } from './auth.jsx';
import { COUNTDOWN_TEXT, PROBLEM_TEXT, WARN_TEXT, backToFullscreen, dismissEnded, snapshot, start, subscribe } from './proctor.js';
import { Icon, useBusy } from './ui.jsx';
import SetupCheck from './SetupCheck.jsx';

export const useProctor = () => useSyncExternalStore(subscribe, snapshot);

const box = { position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--paper)', display: 'grid', placeItems: 'center', padding: 24 };

// Everything the proctor can put on screen: the end-of-exam notice, the auto-submit countdown, a pause, and instant warnings.
export function ProctorOverlay() {
  const { problems, countdown, why, warnings, submitting, ended } = useProctor();
  const nav = useNavigate();
  if (ended) {
    return (
      <div role="alertdialog" aria-modal="true" aria-label="Exam ended" style={box}>
        <div className="card stack" style={{ gap: 14, maxWidth: 520 }}>
          <h2 className="h3" style={{ fontSize: 24 }}><Icon name="lock" size={22} /> Exam ended</h2>
          <p style={{ margin: 0 }}>{ended}</p>
          <button className="btn btn-ink" onClick={() => { dismissEnded(); nav('/'); }}>Back to dashboard</button>
        </div>
      </div>
    );
  }
  if (submitting) return <div role="alertdialog" aria-modal="true" aria-label="Submitting" style={box}><div className="card"><h2 className="h3" style={{ fontSize: 24 }}><span className="spinner" /> Submitting your exam…</h2></div></div>;
  if (countdown !== null) {
    return (
      <div role="alertdialog" aria-modal="true" aria-label="Auto-submit countdown" style={{ ...box, background: 'var(--accent)', color: 'var(--on-accent)' }}>
        <div className="stack" style={{ gap: 12, maxWidth: 560, textAlign: 'center', alignItems: 'center' }}>
          <h2 className="h2" style={{ fontSize: 34 }}>{COUNTDOWN_TEXT[why]}</h2>
          <p style={{ margin: 0, fontSize: 20 }}>Your exam will be auto-submitted in</p>
          <div className="big" style={{ fontSize: 96, lineHeight: 1 }} aria-live="assertive">{countdown}</div>
          <p style={{ margin: 0, fontSize: 18 }}>{why === 'no-face' ? 'Look at the camera so your face is visible to cancel.' : why === 'camera-black' ? 'Uncover the camera and turn on a light to cancel.' : 'Your camera has stopped. This cannot be undone.'}</p>
        </div>
      </div>
    );
  }
  return (
    <>
      {problems.length > 0 && (
        <div role="alertdialog" aria-modal="true" aria-label="Exam paused" style={box}>
          <div className="card stack" style={{ gap: 14, maxWidth: 520 }}>
            <h2 className="h3" style={{ fontSize: 24 }}><Icon name="lock" size={22} /> Exam paused</h2>
            {problems.map(p => <p key={p} style={{ margin: 0 }}>{PROBLEM_TEXT[p]}</p>)}
            {problems.includes('left-fullscreen') && <button className="btn btn-accent" onClick={backToFullscreen}>Return to fullscreen</button>}
            <span className="small muted">This was recorded for your trainer.</span>
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div role="alert" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1001, background: 'var(--accent)', color: 'var(--on-accent)', padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
          {warnings.map(w => WARN_TEXT[w]).join(' ')} This is recorded and your trainer will see it.
        </div>
      )}
    </>
  );
}

// The rules and the Start button for a proctored test. Used on the test page, and on a question opened by direct link.
export function ProctorStart({ testId, questionIds, onStarted, onBack }) {
  const me = useMe();
  const { pathname } = useLocation();
  const [busy, run] = useBusy();
  const [ready, setReady] = useState(false);
  const [round, setRound] = useState(0); // bumping it resets the setup check after a failed start
  const stopRef = useRef(null);
  const go = () => run(async () => {
    stopRef.current?.(); // the exam opens its own camera, so release the preview first
    try { await start(me.uid, testId, pathname, questionIds); onStarted?.(); } catch (e) { setReady(false); setRound(r => r + 1); throw e; }
  });
  return (
    <div className="card stack" style={{ gap: 16, maxWidth: 700 }}>
      <h2 className="h3" style={{ fontSize: 24 }}>This test is proctored</h2>
      <ul className="muted" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
        <li>It runs in fullscreen with no menu. You can leave only after you submit every question.</li>
        <li>Your face must stay in view. If no face is detected, or the camera is covered, a 10 second countdown starts and the exam is auto-submitted when it ends.</li>
        <li>More than one face, or looking away, shows an instant warning.</li>
        <li>Leaving fullscreen, a second screen or a muted microphone pauses the exam.</li>
        <li>Everything is recorded for your trainer, including small camera photos, tab switches, copy, paste and right-click.</li>
      </ul>
      <SetupCheck key={round} onReady={setReady} stopRef={stopRef} />
      <div className="row">
        <button className="btn btn-accent btn-lg" disabled={busy || !ready} onClick={go}>{busy ? 'Starting…' : 'Start exam'}</button>
        {onBack && <button className="btn btn-ghost" onClick={onBack}>Back</button>}
        {!ready && <span className="small muted">Pass every check above to start.</span>}
      </div>
    </div>
  );
}
