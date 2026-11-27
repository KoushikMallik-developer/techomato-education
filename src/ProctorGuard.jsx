import { useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMe } from './auth.jsx';
import { COUNTDOWN_TEXT, PROBLEM_TEXT, WARN_TEXT, backToFullscreen, dismissEnded, snapshot, start, subscribe } from './proctor.js';
import { Icon, useBusy, Card, btn, H3, H2 } from './ui.jsx';
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
        <Card className="flex flex-col gap-3.5 max-w-[520px]">
          <H3 as="h2" className="text-[24px]"><Icon name="lock" size={22} /> Exam ended</H3>
          <p className="m-0">{ended}</p>
          <button className={btn('ink')} onClick={() => { dismissEnded(); nav('/'); }}>Back to dashboard</button>
        </Card>
      </div>
    );
  }
  if (submitting) return <div role="alertdialog" aria-modal="true" aria-label="Submitting" style={box}><Card><H3 as="h2" className="text-[24px]"><span className="w-4 h-4 rounded-full border-[2.5px] border-r-transparent animate-spin-fast" /> Submitting your exam…</H3></Card></div>;
  if (countdown !== null) {
    return (
      <div className="bg-accent text-on-accent" role="alertdialog" aria-modal="true" aria-label="Auto-submit countdown" style={{ ...box }}>
        <div className="flex flex-col gap-3 max-w-[560px] text-center items-center">
          <H2 className="text-[34px]">{COUNTDOWN_TEXT[why]}</H2>
          <p className="m-0 text-[20px]">Your exam will be auto-submitted in</p>
          <div className="big font-display font-bold tracking-[-.03em] text-[96px] leading-[1]" aria-live="assertive">{countdown}</div>
          <p className="m-0 text-[18px]">{why === 'no-face' ? 'Look at the camera so your face is visible to cancel.' : why === 'camera-black' ? 'Uncover the camera and turn on a light to cancel.' : 'Your camera has stopped. This cannot be undone.'}</p>
        </div>
      </div>
    );
  }
  return (
    <>
      {problems.length > 0 && (
        <div role="alertdialog" aria-modal="true" aria-label="Exam paused" style={box}>
          <Card className="flex flex-col gap-3.5 max-w-[520px]">
            <H3 as="h2" className="text-[24px]"><Icon name="lock" size={22} /> Exam paused</H3>
            {problems.map(p => <p className="m-0" key={p}>{PROBLEM_TEXT[p]}</p>)}
            {problems.includes('left-fullscreen') && <button className={btn('accent')} onClick={backToFullscreen}>Return to fullscreen</button>}
            <span className="text-[13px] text-muted">This was recorded for your trainer.</span>
          </Card>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[1001] bg-accent text-on-accent p-[12px_16px] text-center font-bold" role="alert">
          {warnings.map(w => WARN_TEXT[w]).join(' ')} This is recorded and your trainer will see it.
        </div>
      )}
    </>
  );
}

// The rules, the privacy consent and the Start button for a proctored test. Used on the test page, and on a question opened by direct link.
// shortcut: plain-language terms written for this app, not reviewed by a lawyer. Have the institute check them against its own privacy policy and local law.
const TERMS = [
  ['What is collected', 'During the exam: small photos from your camera (about every 2 minutes and whenever a rule is broken), and a log of events such as leaving fullscreen, switching tabs, copy, paste, right-click, blocked shortcuts, a second screen, and your camera or microphone stopping. Your answers are saved as usual. Sound is not recorded and your screen is not recorded.'],
  ['Who can see it', 'Your trainer for this course and the admins of your institute. You can see your own exam log. It is not shown to other students or made public.'],
  ['Why it is used', 'Only to check that the exam was taken fairly. It is not used for advertising or sold.'],
  ['Where it is kept', 'In the app database, hosted by Google Firebase. It is kept for as long as your institute keeps your results. Ask your trainer or institute how to have it removed.'],
  ['Automatic actions', 'The exam is submitted automatically if your time runs out, or if your face is missing or your camera is covered or stopped for 10 seconds. A warning in the log is a reason for your trainer to look, not proof of cheating: your trainer makes the decision.'],
  ['Rules', 'Take the exam alone, on one screen, in fullscreen. Do not share your screen, use remote-access or recording software, virtual cameras or developer tools, or get help from anyone. Breaking these rules can lead to your result being cancelled.'],
  ['Your choice', 'If you do not agree, do not start the exam, and talk to your trainer about another way to take it. Your agreement is saved with your exam record.'],
];
// The four things to know before starting. [icon, title, text]
const RULES = [
  ['lock', 'Fullscreen', 'The exam stays in fullscreen. Leaving it, or connecting a second screen, pauses the exam.'],
  ['user', 'Face in view', 'Keep your face in view. If it is missing or the camera is covered for 10 seconds, the exam is submitted automatically.'],
  ['mic', 'Microphone on', 'Keep your microphone unmuted. Sound is not recorded.'],
  ['eye', 'Activity logged', 'Tab switches, copy, paste, right-click and small camera photos are saved for your trainer.'],
];
const Head = ({ n, title, hint }) => (
  <div className="flex items-center gap-3">
    <span className="size-7 rounded-full bg-panel text-cream grid place-items-center font-bold text-[14px] shrink-0" aria-hidden="true">{n}</span>
    <div className="flex flex-col"><b className="font-display text-[18px]">{title}</b>{hint && <span className="text-[13px] text-muted">{hint}</span>}</div>
  </div>
);
export function ProctorStart({ courseId, testId, questionIds, onStarted, onBack, before }) { // before: runs first, e.g. starts the test timer
  const me = useMe();
  const { pathname } = useLocation();
  const [busy, run] = useBusy();
  const [ready, setReady] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [round, setRound] = useState(0); // bumping it resets the setup check after a failed start
  const stopRef = useRef(null);
  const all = agreed;
  const go = () => run(async () => {
    stopRef.current?.(); // the exam opens its own camera, so release the preview first
    try { await before?.(); await start(me.uid, courseId, testId, pathname, questionIds, 'Camera, Microphone, Screen monitoring, Terms and privacy, No sharing or help'); onStarted?.(); } catch (e) { setReady(false); setRound(r => r + 1); throw e; }
  });
  return (
    <Card className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-1">
        <H3 as="h2" className="text-[24px]">This test is proctored</H3>
        <span className="text-muted">Read this before you start. Your camera, microphone and screen activity are monitored for your trainer.</span>
      </div>
      <div className="grid gap-4 grid-cols-4 max-laptop:grid-cols-2 max-phone:grid-cols-1">
        {RULES.map(([icon, title, text]) => (
          <div key={title} className="bg-paper rounded-[14px] p-4 flex flex-col gap-2">
            <Icon name={icon} size={20} />
            <b>{title}</b>
            <span className="text-[13px] text-muted leading-normal">{text}</span>
          </div>
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <Head n={1} title="Agree to the terms" />
        <label className="flex items-start gap-3 cursor-pointer leading-normal rounded-[14px] border border-line p-4">
          <input type="checkbox" className="mt-1 size-4.5 shrink-0 pointer-coarse:size-6" checked={agreed} onChange={e => { setAgreed(e.target.checked); setReady(false); }} />
          <span>I have read the terms and privacy notice. I agree to the use of my camera and microphone and to screen monitoring, and I confirm that I will not share my screen or get help from anyone.</span>
        </label>
        <details className="rounded-[14px] bg-paper">
          <summary className="p-4 cursor-pointer font-semibold">Terms and privacy</summary>
          <div tabIndex={0} role="region" aria-label="Terms and privacy" className="px-4 pb-4 max-h-72 overflow-auto flex flex-col gap-3 text-[13px] leading-relaxed text-ink-2">
            {TERMS.map(([h, t]) => <p key={h} className="m-0"><b className="text-ink">{h}.</b> {t}</p>)}
          </div>
        </details>
        <span className="text-[13px] text-muted">A browser cannot see other apps, so it cannot detect screen sharing by itself. Your agreement is saved with your exam, and a second screen is checked automatically.</span>
      </section>
      <section className={`flex flex-col gap-4 rounded-[14px] bg-paper p-5 max-phone:p-4 ${all ? '' : 'opacity-60'}`}>
        <Head n={2} title="Check your hardware and start" hint="We test your camera, lighting, face position, microphone and screen." />
        {all ? <SetupCheck key={round} onReady={setReady} stopRef={stopRef} /> : <div className="rounded-xl border border-dashed border-line p-6 text-muted text-center">Tick the agreement above to turn on the hardware check.</div>}
        <div className="flex items-center gap-3 flex-wrap border-t border-line pt-4">
          <button className={btn('accent', 'lg')} disabled={busy || !ready || !all} onClick={go}>{busy ? 'Starting…' : 'Start exam'}</button>
          {onBack && <button className={btn('ghost')} onClick={onBack}>Back</button>}
          {all && !ready && <span className="text-[13px] text-muted">Pass every check above to start.</span>}
        </div>
      </section>
    </Card>
  );
}
