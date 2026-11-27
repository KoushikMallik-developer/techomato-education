import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { grade } from '../../runner.js';
import * as proctor from '../../proctor.js';
import { ProctorStart } from '../../ProctorGuard.jsx';
import { useAttempt } from '../../attempt.jsx';
import { LANGS, clock, isWeb, langOfSub, langsOf, timed, typeLabel } from '../../schedule.js';
import { SOLVE_POINTS, dayKey, inCourse, nextStreak, pointsFor } from '../../score.js';
import { CodeBlock, ENV_FILE, Empty, Icon, Loading, Modal, STARTERS, attempt, notify, useLoad, btn, Chip, H3 , LEVEL_TONE } from '../../ui.jsx';
import Editor from '../../Editor.jsx';
import { get, isPublic, mySubs } from './data.js';

const award = (me, points) => runTransaction(db, async tx => {
  const ref = doc(db, 'leaderboard', me.uid);
  const cur = (await tx.get(ref)).data() || { points: 0, streak: 0, lastDay: '' };
  const t = dayKey(new Date()), y = dayKey(new Date(Date.now() - 864e5));
  tx.set(ref, { ...cur, name: me.name, points: (cur.points || 0) + points, streak: nextStreak(cur, t, y), lastDay: t }); // ...cur keeps the record of paid rewards
});

export function Solve() {
  const { courseId, testId, qid } = useParams();
  const me = useMe();
  const nav = useNavigate();
  const subId = `${me.uid}_${courseId}_${testId}_${qid}`; // results are kept per course
  const [d] = useLoad(async () => {
    const [q, sub, prior, test] = await Promise.all([get('questions', qid), getDoc(doc(db, 'submissions', subId)), mySubs(me.uid, [where('questionId', '==', qid)]), testId === 'practice' ? null : get('tests', testId)]);
    // a test with every question submitted is over: it cannot be opened again
    const mine = test ? await mySubs(me.uid, [where('testId', '==', testId)]).then(a => a.filter(s => inCourse(s, courseId))) : [];
    const over = !!test?.questionIds?.length && test.questionIds.every(id => mine.some(s => s.questionId === id));
    return { q, sub: sub.exists() ? sub.data() : null, prior, test, over }; // prior: every attempt at this question, in any test or practice
  }, [testId, qid]);
  const [codes, setCodes] = useState({}); // what the student typed, per language
  const [pickedLang, setPickedLang] = useState(null);
  const [res, setRes] = useState(null); // {r, tests, submitted}
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState('problem');
  const [tc, setTc] = useState(0); // which sample the console shows
  const [preview, setPreview] = useState('');
  const [saved, setSaved] = useState(null);
  const [proctored, setProctored] = useState(() => proctor.active(testId));
  const submitRef = useRef(null); // set below once the question has loaded
  useEffect(() => { proctor.setSubmitter(() => submitRef.current?.()); return () => proctor.setSubmitter(null); }, []);
  useEffect(() => { setCodes({}); setPickedLang(null); setRes(null); setSaved(null); setTab('problem'); setTc(0); setProctored(proctor.active(testId)); }, [testId, qid]);
  // the workspace has no app menu around it, so the messages before it get their own margins
  const pad = el => <div className="max-w-[1180px] mx-auto px-6 py-8 max-phone:px-4">{el}</div>;
  const att = useAttempt(courseId, testId, d?.test, me.uid);
  if (!d || att.loading) return pad(<Loading />);
  if (!d.q) return pad(<Empty title="This question was removed" body="Your trainer deleted it. Go back to the test." />);
  if (d.test?.draft) return pad(<Empty title="This test is not published yet" />);
  if (d.over && !proctor.active(testId)) return pad(<Empty title="You have submitted this test" body="Only one attempt is allowed, so it cannot be opened again." action={<button className={btn('ink')} onClick={() => nav(`/course/${courseId}`)}>Back to course</button>} />);
  if (testId === 'practice' && !isPublic(d.q)) return pad(<Empty title="This question is private" body="It is only used in tests, so it is not available for practice." />);

  if (timed(d.test) && (!att.started || (att.expired && !proctor.active(testId)))) return pad(<Empty title={att.expired ? 'Time is up' : 'Start the test first'} body={att.expired ? 'The timer for this test ran out, so answers are closed.' : 'The timer starts from the test page. Go back and press Start.'} action={<button className={btn('ink')} onClick={() => nav(-1)}>Back</button>} />);
  if (d.test?.proctored && !proctored) return pad(<ProctorStart courseId={courseId} testId={testId} questionIds={d.test.questionIds} onStarted={() => setProctored(true)} onBack={() => nav(-1)} />);

  const { q } = d;
  const sub = saved || d.sub;
  const web = isWeb(q);
  const allowed = d.test ? langsOf(d.test) : Object.keys(LANGS); // practice allows every language
  const savedLang = web ? 'web' : langOfSub(sub, q);
  const lang = web ? 'web' : pickedLang || (allowed.includes(savedLang) ? savedLang : allowed[0]);
  const text = codes[lang] ?? (sub && savedLang === lang ? sub.code : web ? q.starter : STARTERS[lang]);
  const setCode = v => setCodes({ ...codes, [lang]: v });
  const locked = !!sub && (testId !== 'practice' || !me.subscribed); // a test is one attempt for everyone; only practice lets a subscriber resubmit. The same question in another test is a fresh attempt
  const visible = q.tests.filter(t => !t.hidden);
  const hiddenN = q.tests.length - visible.length;

  const run = submit => { const p = attempt(async () => {
    setConfirm(false);
    setBusy(submit ? 'submit' : 'run');
    try {
      const tests = submit ? q.tests : visible;
      if (web) setPreview(text);
      const r = await grade(lang, text, tests);
      setRes({ r, tests, submitted: submit, at: Date.now() }); setTc(Math.max(0, r.filter((_, i) => !tests[i].hidden).findIndex(x => !x.ok))); // open the first failing sample
      if (submit) {
        const rec = { userId: me.uid, courseId, testId, questionId: qid, code: text, ...(web ? {} : { lang }), passed: r.filter(x => x.ok).length, total: r.length };
        if (sub && rec.passed < sub.passed) return notify(`Not saved: your earlier submission passed ${sub.passed}/${sub.total}. Your trainer sees your best result.`);
        await setDoc(doc(db, 'submissions', subId), { ...rec, at: serverTimestamp() });
        const solvedBefore = (sub && sub.passed === sub.total) || d.prior.some(x => x.testId === 'practice' && x.total && x.passed === x.total);
        const pts = pointsFor(testId, rec.passed, rec.total, solvedBefore);
        await award(me, pts);
        setSaved(rec);
        notify(rec.passed === rec.total ? `Accepted! All test cases passed${pts ? `. +${pts} points` : ''}` : `${rec.passed}/${rec.total} test cases passed`);
      }
    } finally { setBusy(null); }
  }); if (submit) proctor.track(p); return p; };
  // if the exam is auto-submitted while this question is open, whatever is in the editor is graded and saved first
  submitRef.current = () => (!sub && !locked ? run(true) : null); // a running 'Run samples' must not cost the student their code
  const shortcut = k => { if (!busy) k === 'run' ? run(false) : !locked && setConfirm(true); };
  const shown = res ? res.r.map((x, i) => ({ x, t: res.tests[i] })).filter(({ t }) => !t.hidden) : [];

  const passedN = res ? res.r.filter(x => x.ok).length : 0;
  const cur = shown[Math.min(tc, shown.length - 1)];
  const verdict = !res ? null : passedN === res.r.length ? [res.submitted ? 'Accepted' : 'Sample tests passed', 'pass'] : res.r.some(x => !x.ok && x.error) && passedN === 0 ? ['Runtime error', 'warn'] : ['Wrong answer', 'warn'];
  const solvedNow = sub && sub.passed === sub.total;
  const spin = <span className="w-4 h-4 rounded-full border-[2.5px] border-r-transparent animate-spin-fast" />;
  const Box = ({ label, children, tone }) => (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <pre className={`m-0 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words rounded-[8px] border px-3 py-2.5 ${tone === 'warn' ? 'border-warn/40 bg-warn-soft' : tone === 'pass' ? 'border-pass/40 bg-pass-soft' : 'border-line bg-paper'}`}>{children === '' || children == null ? <span className="text-muted">(empty)</span> : children}</pre>
    </div>
  );
  const Sec = ({ icon, title, children }) => (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.12em] text-muted"><span className="w-7 h-7 rounded-[8px] bg-accent-soft text-accent-ink grid place-items-center"><Icon name={icon} size={15} /></span>{title}</h3>
      {children}
    </section>
  );
  const PanelHead = ({ children, className = '' }) => <div className={`h-12 shrink-0 flex items-center gap-2 px-4 border-b border-line ${className}`}>{children}</div>;

  return (
    <div className="h-dvh flex flex-col bg-paper max-tablet:h-auto max-tablet:min-h-dvh">
      {/* top bar */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-line bg-surface max-phone:h-auto max-phone:py-2 max-phone:flex-wrap">
        <button className="w-9 h-9 rounded-lg grid place-items-center hover:bg-soft" aria-label="Back" onClick={() => nav(-1)}><Icon name="back" size={18} /></button>
        <span className="w-px h-6 bg-line" aria-hidden="true" />
        <h1 className="m-0 font-display font-bold text-[17px] truncate">{q.title}</h1>
        {solvedNow && <Chip tone="pass"><Icon name="check" size={13} stroke={2.6} />Solved</Chip>}
        <span className="grow" />
        {d.test?.proctored && <Chip tone="proctor"><Icon name="lock" size={13} />Proctored exam</Chip>}
        {att.started && !att.expired && <Chip tone={att.left < 60000 ? 'danger' : 'warn'} className="font-mono text-[13px]" role="timer"><Icon name="clock" size={14} />{clock(att.left)}</Chip>}
      </header>

      {locked && <div className="shrink-0 bg-warn-soft text-warn py-2 px-4 font-semibold text-[13px] flex gap-2 items-center border-b border-line"><Icon name="lock" size={16} />You've used your one submission for this question{testId === 'practice' ? '. Subscribe to submit again.' : ' in this test.'}</div>}

      <div className="grow min-h-0 grid grid-cols-[minmax(340px,5fr)_minmax(0,7fr)] max-tablet:grid-cols-1">
        {/* left: problem */}
        <section className="flex flex-col min-h-0 bg-surface border-r border-line max-tablet:border-r-0 max-tablet:border-b">
          <PanelHead className="gap-0 px-2">
            {[['problem', 'Problem'], ['sub', 'Submission']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-12 px-4 text-[14px] font-semibold border-b-2 -mb-px ${tab === k ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{l}</button>
            ))}
          </PanelHead>
          <div className="grow min-h-0 overflow-auto px-7 py-6 max-phone:px-4 flex flex-col gap-7">
            {tab === 'problem' ? (
              <>
                <section className="flex flex-col gap-3 pb-5 border-b border-line">
                  <h2 className="m-0 font-display font-bold text-[26px] tracking-tight leading-tight">{q.title}</h2>
                  <div className="flex flex-wrap gap-2">
                    {q.diff && <Chip tone={LEVEL_TONE[q.diff]}>{q.diff}</Chip>}
                    {q.topic && <Chip>{q.topic}</Chip>}
                    <Chip>{typeLabel(q)}</Chip>
                    {testId === 'practice' && <Chip tone="accent"><Icon name="star" size={13} stroke={2.4} />{SOLVE_POINTS} points</Chip>}
                  </div>
                </section>

                <Sec icon="doc" title="Problem statement">
                  <p className="m-0 text-[15px] leading-[1.8] text-ink-2 whitespace-pre-wrap">{q.statement}</p>
                </Sec>

                {q.constraints && (
                  <Sec icon="target" title="Constraints">
                    <ul className="m-0 p-0 list-none! rounded-[12px] border border-line bg-paper divide-y divide-line overflow-hidden">
                      {q.constraints.split('\n').filter(l => l.trim()).map((l, i) => (
                        <li key={i} className="px-3.5 py-2.5 font-mono text-[13px] leading-relaxed">{l}</li>
                      ))}
                    </ul>
                  </Sec>
                )}

                {web ? (
                  <Sec icon="check" title="Requirements">
                    <ul className="m-0 p-0 list-none! flex flex-col gap-2">
                      {visible.map((t, i) => <li key={i} className="flex gap-2.5 items-start text-[14px] leading-relaxed rounded-[10px] border border-line bg-paper px-3 py-2.5"><span className="text-pass-strong mt-0.5"><Icon name="check" size={15} stroke={2.6} /></span>{t.desc || t.expr}</li>)}
                    </ul>
                  </Sec>
                ) : visible.length > 0 && (
                  <Sec icon="code" title={visible.length === 1 ? 'Example' : 'Examples'}>
                    <div className="flex flex-col gap-3">
                      {visible.map((t, i) => (
                        <div key={i} className="rounded-[12px] border border-line overflow-hidden">
                          <div className="px-3.5 py-2 bg-soft text-[12px] font-bold uppercase tracking-wider text-muted">Example {i + 1}</div>
                          <div className="grid grid-cols-2 max-phone:grid-cols-1 divide-x divide-line max-phone:divide-x-0 max-phone:divide-y">
                            {[['Input', t.input], ['Output', t.output]].map(([l, v]) => (
                              <div key={l} className="flex flex-col gap-1 p-3.5 min-w-0">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{l}</span>
                                <pre className="m-0 font-mono text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{v === '' || v == null ? <span className="text-muted">(empty)</span> : v}</pre>
                              </div>
                            ))}
                          </div>
                          {t.note && <p className="m-0 px-3.5 py-2.5 border-t border-line text-[13.5px] text-ink-2 leading-relaxed"><b className="text-ink">Explanation:</b> {t.note}</p>}
                        </div>
                      ))}
                    </div>
                  </Sec>
                )}

                {hiddenN > 0 && (
                  <Sec icon="lock" title="Hidden test cases">
                    <div className="rounded-[12px] border border-dashed border-line p-3.5 flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: hiddenN }, (_, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-[8px] bg-soft px-2.5 py-1.5 text-[12px] font-semibold text-muted"><Icon name="lock" size={12} />Hidden {i + 1}</span>)}
                      </div>
                      <p className="m-0 text-[13px] text-muted leading-relaxed">{hiddenN === 1 ? 'This case is not shown. It runs' : `These ${hiddenN} cases are not shown. They run`} only when you press <b className="text-ink">Submit code</b>, so make sure your code handles edge cases too.</p>
                    </div>
                  </Sec>
                )}
              </>
            ) : !sub ? (
              <Empty title="No submission yet" body="Run your code on the samples, then press Submit code." />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="m-0 font-display font-bold text-[22px]" style={{ color: solvedNow ? 'var(--pass)' : 'var(--warn)' }}>{solvedNow ? 'Accepted' : 'Partially correct'}</h2>
                  <Chip tone={solvedNow ? 'pass' : 'warn'} className="font-mono">{sub.passed}/{sub.total} passed</Chip>
                </div>
                <CodeBlock code={sub.code} />
                <button className={btn('ghost', 'sm', 'self-start')} onClick={() => { if (!web) setPickedLang(savedLang); setCodes({ ...codes, [web ? 'web' : savedLang]: sub.code }); setTab('problem'); }}>Load into editor</button>
              </>
            )}
          </div>
        </section>

        {/* right: editor over console, actions at the bottom */}
        <section className="flex flex-col min-h-0 min-w-0">
          <div className="grow min-h-[260px] flex flex-col bg-panel">
            <div className="h-12 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-panel-line">
              {web ? <span className="font-mono text-[13px] text-panel-text px-1">HTML / CSS / JS</span> : allowed.length > 1 ? (
                <select aria-label="Language" className="h-8 rounded-md border border-panel-line bg-transparent text-panel-text text-[13px] font-semibold px-2 [&>option]:text-ink" value={lang} onChange={e => setPickedLang(e.target.value)}>
                  {allowed.map(k => <option key={k} value={k}>{LANGS[k]}</option>)}
                </select>
              ) : <span className="font-mono text-[13px] text-panel-text px-1">{LANGS[allowed[0]]}</span>}
              <span className="flex items-center gap-3 font-mono text-[12px] text-panel-muted">
                <span className="max-laptop:hidden">Ctrl+Enter run · Ctrl+Shift+Enter submit</span>
                <button className="h-8 px-2.5 rounded-md text-panel-text hover:bg-white/10 font-body font-semibold text-[13px]" onClick={() => setCode(web ? q.starter : STARTERS[lang])} title="Replace your code with the starter code">Reset</button>
              </span>
            </div>
            <div className="grow min-h-0 flex flex-col [&>div]:grow [&>div]:min-h-0 [&>div]:rounded-none [&>div>div:first-child]:hidden">
              <Editor file={ENV_FILE[lang]} value={text} onChange={setCode} onShortcut={shortcut} />
            </div>
          </div>

          <div className="h-[38%] min-h-[200px] shrink-0 flex flex-col bg-surface border-t border-line max-tablet:h-auto">
            <PanelHead>
              {busy ? <span className="flex items-center gap-2.5 text-[14px] font-semibold">{spin}{busy === 'run' ? 'Running sample tests…' : 'Judging all test cases…'}</span>
                : verdict ? <span key={res.at} className={`flex items-center gap-2 text-[15px] font-bold ${verdict[1] === 'pass' ? 'animate-stamp' : 'animate-tick'}`} style={{ color: verdict[1] === 'pass' ? 'var(--pass)' : 'var(--warn)' }}><span className="draw [animation-delay:.15s]"><Icon name={verdict[1] === 'pass' ? 'check' : 'x'} size={18} stroke={2.6} /></span>{verdict[0]}</span>
                : <span className="text-[14px] font-semibold">Test results</span>}
              <span className="grow" />
              {res && !busy && <span className="font-mono text-[12px] text-muted">{passedN}/{res.r.length} {res.submitted ? 'test cases' : 'samples'} passed</span>}
            </PanelHead>
            <div className="grow min-h-0 overflow-auto">
              {!busy && !res && <p className="text-[13px] text-muted m-0 p-4">Press <b className="text-ink">Run code</b> to try your code on the samples. The first Python run takes a few seconds to load.</p>}
              {!busy && res && (
                <div className="grid grid-cols-[170px_1fr] max-phone:grid-cols-1 h-full">
                  <div className="flex flex-col gap-0.5 p-2 border-r border-line max-phone:border-r-0 max-phone:border-b overflow-auto" role="tablist" aria-label="Test cases">
                    {shown.map(({ x }, i) => (
                      <button key={`${res.at}-${i}`} role="tab" aria-selected={tc === i} onClick={() => setTc(i)} className={`animate-tick flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold text-left ${tc === i ? 'bg-soft text-ink' : 'text-muted hover:bg-soft'}`} style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
                        <span className="draw" style={{ color: x.ok ? 'var(--pass-strong)' : 'var(--warn)' }}><Icon name={x.ok ? 'check' : 'x'} size={14} stroke={2.6} /></span>Sample {i}
                      </button>
                    ))}
                    {res.submitted && res.r.map((x, i) => res.tests[i].hidden && (
                      <span key={`${res.at}-h${i}`} className="animate-tick flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-muted" style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
                        <span className="draw" style={{ color: x.ok ? 'var(--pass-strong)' : 'var(--warn)' }}><Icon name={x.ok ? 'check' : 'x'} size={14} stroke={2.6} /></span>Hidden {i}<Icon name="lock" size={12} />
                      </span>
                    ))}
                  </div>
                  <div className="p-4 overflow-auto min-w-0">
                    {cur && (web ? (
                      <Box label="Check" tone={cur.x.ok ? 'pass' : 'warn'}>{cur.t.desc || cur.t.expr}{!cur.x.ok && cur.x.error ? `\n${cur.x.error}` : ''}</Box>
                    ) : (
                      <div className="grid grid-cols-3 max-laptop:grid-cols-1 gap-3">
                        <Box label="Input">{cur.t.input}</Box>
                        {cur.x.error && !cur.x.ok ? <Box label="Error" tone="warn">{cur.x.error}</Box> : <Box label="Your output" tone={cur.x.ok ? 'pass' : 'warn'}>{cur.x.got}</Box>}
                        <Box label="Expected output">{cur.t.output}</Box>
                      </div>
                    ))}
                    {web && preview && <iframe className="mt-3 w-full h-48 bg-white border border-line rounded-lg" title="Preview" sandbox="allow-scripts" srcDoc={preview} />}
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="h-14 shrink-0 flex items-center justify-end gap-2 px-4 border-t border-line bg-surface">
            <button className={btn('ghost', 'sm', 'min-h-10 px-4')} onClick={() => run(false)} disabled={!!busy} title="Ctrl + Enter">
              {busy === 'run' ? spin : <Icon name="play" size={13} fill="currentColor" stroke={0} />}Run code
            </button>
            <button className={btn('accent', 'sm', 'min-h-10 px-5')} onClick={() => setConfirm(true)} disabled={!!busy || locked} title="Ctrl + Shift + Enter">
              {busy === 'submit' ? <>{spin}Judging…</> : 'Submit code'}
            </button>
          </footer>
        </section>
      </div>

      {confirm && (
        <Modal onClose={() => setConfirm(false)}>
          <H3 as="h2" className="text-[26px]">Submit your solution?</H3>
          <p className="text-muted m-0">It will be graded against all {q.tests.length} test cases.{(testId !== 'practice' || !me.subscribed) && ' This is your only submission for this question.'}</p>
          <div className="flex items-center gap-3 justify-end">
            <button className={btn('plain')} onClick={() => setConfirm(false)}>Keep editing</button>
            <button className={btn('accent')} onClick={() => run(true)}>Submit</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
