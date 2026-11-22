import { useSyncExternalStore } from 'react';
import { PROBLEM_TEXT, backToFullscreen, snapshot, subscribe } from './proctor.js';
import { Icon } from './ui.jsx';

export const useProctor = () => useSyncExternalStore(subscribe, snapshot);

// Covers the exam while a hard rule is broken (left fullscreen, second screen, covered camera, mic off).
export function ProctorOverlay() {
  const { problems } = useProctor();
  if (!problems.length) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-label="Exam paused" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--paper)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card stack" style={{ gap: 14, maxWidth: 520 }}>
        <h2 className="h3" style={{ fontSize: 24 }}><Icon name="lock" size={22} /> Exam paused</h2>
        {problems.map(p => <p key={p} style={{ margin: 0 }}>{PROBLEM_TEXT[p]}</p>)}
        {problems.includes('left-fullscreen') && <button className="btn btn-accent" onClick={backToFullscreen}>Return to fullscreen</button>}
        <span className="small muted">This was recorded for your trainer.</span>
      </div>
    </div>
  );
}
