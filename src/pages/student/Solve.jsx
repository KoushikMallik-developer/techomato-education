import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { grade } from '../../runner.js';
import * as proctor from '../../proctor.js';
import { ProctorStart } from '../../ProctorGuard.jsx';
import { TimerBar, useAttempt } from '../../attempt.jsx';
import { LANGS, isWeb, langOfSub, langsOf, timed, typeLabel } from '../../schedule.js';
import { dayKey, inCourse, nextStreak } from '../../score.js';
import { CodeBlock, ENV_FILE, Empty, Icon, Loading, Modal, ProblemView, STARTERS, Tabs, attempt, notify, useLoad, btn, Card, Chip, H3, IconBtn } from '../../ui.jsx';
import Editor from '../../Editor.jsx';
import { get, isPublic, mySubs } from './data.js';

const awardXp = (me, before, now) => runTransaction(db, async tx => {
  const ref = doc(db, 'leaderboard', me.uid);
  const cur = (await tx.get(ref)).data() || { xp: 0, streak: 0, lastDay: '' };
  const t = dayKey(new Date()), y = dayKey(new Date(Date.now() - 864e5));
  tx.set(ref, { name: me.name, xp: cur.xp + Math.max(0, now - before) * 10, streak: nextStreak(cur, t, y), lastDay: t });
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
  const [preview, setPreview] = useState('');
  const [saved, setSaved] = useState(null);
  const [proctored, setProctored] = useState(() => proctor.active(testId));
  const submitRef = useRef(null); // set below once the question has loaded
  useEffect(() => { proctor.setSubmitter(() => submitRef.current?.()); return () => proctor.setSubmitter(null); }, []);
  useEffect(() => { setCodes({}); setPickedLang(null); setRes(null); setSaved(null); setTab('problem'); setProctored(proctor.active(testId)); }, [testId, qid]);
  const att = useAttempt(courseId, testId, d?.test, me.uid);
  if (!d || att.loading) return <Loading />;
  if (!d.q) return <Empty title="This question was removed" body="Your trainer deleted it. Go back to the test." />;
  if (d.test?.draft) return <Empty title="This test is not published yet" />;
  if (d.over && !proctor.active(testId)) return <Empty title="You have submitted this test" body="Only one attempt is allowed, so it cannot be opened again." action={<button className={btn('ink')} onClick={() => nav(`/course/${courseId}`)}>Back to course</button>} />;
  if (testId === 'practice' && !isPublic(d.q)) return <Empty title="This question is private" body="It is only used in tests, so it is not available for practice." />;

  if (timed(d.test) && (!att.started || (att.expired && !proctor.active(testId)))) return <Empty title={att.expired ? 'Time is up' : 'Start the test first'} body={att.expired ? 'The timer for this test ran out, so answers are closed.' : 'The timer starts from the test page. Go back and press Start.'} action={<button className={btn('ink')} onClick={() => nav(-1)}>Back</button>} />;
  if (d.test?.proctored && !proctored) return <ProctorStart courseId={courseId} testId={testId} questionIds={d.test.questionIds} onStarted={() => setProctored(true)} onBack={() => nav(-1)} />;

  const { q } = d;
  const sub = saved || d.sub;
  const web = isWeb(q);
  const allowed = d.test ? langsOf(d.test) : Object.keys(LANGS); // practice allows every language
  const savedLang = web ? 'web' : langOfSub(sub, q);
  const lang = web ? 'web' : pickedLang || (allowed.includes(savedLang) ? savedLang : allowed[0]);
  const text = codes[lang] ?? (sub && savedLang === lang ? sub.code : web ? q.starter : STARTERS[lang]);
  const setCode = v => setCodes({ ...codes, [lang]: v });
  const locked = !!sub && (testId !== 'practice' || !me.subscribed); // a test is one attempt for everyone; only practice lets a subscriber resubmit. The same question in another test is a fresh attempt
  const best = Math.max(sub?.passed || 0, ...d.prior.map(x => x.passed));
  const visible = q.tests.filter(t => !t.hidden);
  const hiddenN = q.tests.length - visible.length;

  const run = submit => { const p = attempt(async () => {
    setConfirm(false);
    setBusy(submit ? 'submit' : 'run');
    try {
      const tests = submit ? q.tests : visible;
      if (web) setPreview(text);
      const r = await grade(lang, text, tests);
      setRes({ r, tests, submitted: submit });
      if (submit) {
        const rec = { userId: me.uid, courseId, testId, questionId: qid, code: text, ...(web ? {} : { lang }), passed: r.filter(x => x.ok).length, total: r.length };
        if (sub && rec.passed < sub.passed) return notify(`Not saved: your earlier submission passed ${sub.passed}/${sub.total}. Your trainer sees your best result.`);
        await setDoc(doc(db, 'submissions', subId), { ...rec, at: serverTimestamp() });
        await awardXp(me, best, rec.passed);
        setSaved(rec);
        notify(rec.passed === rec.total ? 'Accepted! All test cases passed' : `${rec.passed}/${rec.total} test cases passed`);
      }
    } finally { setBusy(null); }
  }); if (submit) proctor.track(p); return p; };
  // if the exam is auto-submitted while this question is open, whatever is in the editor is graded and saved first
  submitRef.current = () => (!sub && !locked ? run(true) : null); // a running 'Run samples' must not cost the student their code
  const shortcut = k => { if (!busy) k === 'run' ? run(false) : !locked && setConfirm(true); };
  const shown = res ? res.r.map((x, i) => ({ x, t: res.tests[i] })).filter(({ t }) => !t.hidden) : [];

  return (
    <div className="flex flex-col gap-3">
      {att.started && !att.expired && <TimerBar left={att.left} />}
      <Card className="flex items-center justify-between gap-3 p-[12px_16px] flex-wrap">
        <div className="flex items-center flex-wrap gap-2">
          <IconBtn aria-label="Back" onClick={() => nav(-1)}><Icon name="back" size={18} /></IconBtn>
          <Chip as="span">{typeLabel(q)}</Chip>
          <Chip tone="accent">{q.tests.length} test cases</Chip>
          {d.test?.proctored && <Chip tone="proctor">Proctored</Chip>}
          {sub && sub.passed === sub.total && <Chip tone="pass"><Icon name="check" size={14} stroke={2.4} />Solved</Chip>}
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <button className={btn('ghost')} onClick={() => run(false)} disabled={!!busy} title="Ctrl + Enter">
            {busy === 'run' ? <span className="w-4 h-4 rounded-full border-[2.5px] border-r-transparent animate-spin-fast" /> : <Icon name="play" size={14} fill="currentColor" stroke={0} />}Run samples
          </button>
          <button className={btn('accent')} onClick={() => setConfirm(true)} disabled={!!busy || locked} title="Ctrl + Shift + Enter">
            {busy === 'submit' ? <><span className="w-4 h-4 rounded-full border-[2.5px] border-r-transparent animate-spin-fast" />Judging…</> : 'Submit'}
          </button>
        </div>
      </Card>

      {locked && <div className="rounded-[14px] bg-warn-soft text-warn py-3 px-4 font-semibold text-[14px] flex gap-2.5 items-center"><Icon name="lock" size={18} />You've used your one submission for this question{testId === 'practice' ? '' : ' in this test'}. Subscribe to submit again.</div>}

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-3 min-h-[calc(100dvh-140px)] max-tablet:grid-cols-1">
        <Card as="section" className="flex flex-col p-0 overflow-hidden">
          {sub && (
            <div className="p-2.5 [border-bottom:1px_solid_var(--line)]">
              <Tabs label="Panels" value={tab} onChange={setTab} tabs={[['problem', 'Problem'], ['sub', 'My submission']]} />
            </div>
          )}
          <div className="flex flex-col p-[22px_24px] gap-4 overflow-auto">
            {tab === 'problem' ? (
              <>
                <H3 as="h2" className="text-[26px]">{q.title}</H3>
                <ProblemView q={q} shown={visible} />
                {hiddenN > 0 && <p className="text-[13px] text-muted m-0">+ {hiddenN} hidden test cases are checked when you submit.</p>}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <H3 as="h2" className="text-[22px]" style={{ color: sub.passed === sub.total ? 'var(--pass)' : 'var(--warn)' }}>{sub.passed === sub.total ? 'Accepted' : 'Partially correct'}</H3>
                  <span className="font-mono text-[13px]">{sub.passed}/{sub.total}</span>
                </div>
                <CodeBlock code={sub.code} />
                <button className={btn('ghost', 'md', 'self-start')} onClick={() => { if (!web) setPickedLang(savedLang); setCodes({ ...codes, [web ? 'web' : savedLang]: sub.code }); setTab('problem'); }}>Load into editor</button>
              </>
            )}
          </div>
        </Card>

        <section className="flex flex-col gap-3 min-w-0">
          {!web && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[13px] text-muted">Language</span>
              {allowed.length > 1 ? (
                <div className="seg flex flex-wrap gap-2 [:where(&)_button]:min-h-11 [:where(&)_button]:px-4 [:where(&)_button]:rounded-xl [:where(&)_button]:border-[1.5px] [:where(&)_button]:border-line [:where(&)_button]:bg-surface [:where(&)_button]:font-medium [:where(&)_button[aria-pressed=true]]:border-ink [:where(&)_button[aria-pressed=true]]:bg-ink [:where(&)_button[aria-pressed=true]]:text-paper [:where(&)_button[aria-pressed=true]]:font-semibold [:where(&)_button:disabled]:opacity-50 [:where(&)_button:disabled]:cursor-not-allowed" role="group" aria-label="Language">{allowed.map(l => <button className="min-h-9.5 pointer-coarse:min-h-11" key={l} aria-pressed={lang === l} onClick={() => setPickedLang(l)}>{LANGS[l]}</button>)}</div>
              ) : <Chip as="span">{LANGS[allowed[0]]}</Chip>}
            </div>
          )}
          <Editor file={ENV_FILE[lang]} right="Ctrl + Enter to run" value={text} onChange={setCode} onShortcut={shortcut} />
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <H3 className="text-[18px]">Test results</H3>
              {res && <span className="font-mono text-[13px] text-muted">{res.r.filter(x => x.ok).length}/{res.r.length} passed</span>}
            </div>
            {busy && <div className="flex items-center gap-3 text-muted text-[13px]"><span className="w-4 h-4 rounded-full border-[2.5px] border-r-transparent animate-spin-fast" />{busy === 'run' ? 'Running samples…' : 'Running all tests…'}</div>}
            {!busy && !res && <p className="text-[13px] text-muted m-0">Run the samples to see your output here. The first Python run takes a few seconds to load.</p>}
            {!busy && res && (
              <>
                <div className="grid grid-cols-3 max-tablet:grid-cols-1 gap-2.5">
                  {shown.map(({ x, t }, i) => (
                    <div key={i} className={'rounded-[14px] p-3.5 flex flex-col gap-1.5 ' + (x.ok ? 'bg-pass-soft! text-pass!' : 'bg-warn-soft! text-warn!')}>
                      <span className="flex items-center gap-1.5 font-bold text-[14px]"><Icon name={x.ok ? 'check' : 'x'} size={16} stroke={2.6} />Sample {i + 1} {x.ok ? 'passed' : 'failed'}</span>
                      <span className="font-mono text-[12px] text-ink-2 whitespace-pre-wrap">
                        {x.ok ? (t.desc || `Output: ${x.got ?? ''}`) : x.error ? x.error : web ? (t.desc || 'Check failed') : `Expected ${x.expected}, got ${x.got}`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[13px] font-semibold">All tests</span>
                  <div className="grid gap-1 grow [:where(&)_span]:h-2.5 [:where(&)_span]:rounded-[3px] [:where(&)_span]:bg-line min-w-40" style={{ gridTemplateColumns: `repeat(${Math.max(res.r.length, 1)},minmax(0,1fr))` }}>
                    {res.r.map((x, i) => <span key={i} style={{ background: res.submitted ? (x.ok ? 'var(--pass-strong)' : 'var(--warn)') : 'var(--line)' }} />)}
                  </div>
                  <span className="font-mono text-[13px] text-muted">{res.submitted ? `${res.r.filter(x => x.ok).length}/${res.r.length}` : 'graded on submit'}</span>
                </div>
              </>
            )}
            {web && preview && <iframe className="w-[100%] h-60 bg-white [border:1px_solid_var(--line)] rounded-[12px]" title="Preview" sandbox="allow-scripts" srcDoc={preview} />}
          </Card>
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
