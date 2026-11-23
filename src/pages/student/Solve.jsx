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
import { dayKey, nextStreak } from '../../score.js';
import { CodeBlock, ENV_FILE, Empty, Icon, Loading, Modal, STARTERS, Tabs, attempt, notify, useLoad } from '../../ui.jsx';
import Editor from '../../Editor.jsx';
import { examQuestionIds, get, isPublic, mySubs } from './data.js';

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
    const [q, sub, prior, test, hidden] = await Promise.all([get('questions', qid), getDoc(doc(db, 'submissions', subId)), mySubs(me.uid, [where('questionId', '==', qid)]), testId === 'practice' ? null : get('tests', testId), testId === 'practice' ? examQuestionIds().then(s => s.has(qid)) : false]);
    return { q, sub: sub.exists() ? sub.data() : null, prior, test, hidden }; // prior: every attempt at this question, in any test or practice
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
  if (d.hidden || (testId === 'practice' && !isPublic(d.q))) return <Empty title="This question is part of an exam" body="It is not available for practice." />;

  if (timed(d.test) && (!att.started || (att.expired && !proctor.active(testId)))) return <Empty title={att.expired ? 'Time is up' : 'Start the test first'} body={att.expired ? 'The timer for this test ran out, so answers are closed.' : 'The timer starts from the test page. Go back and press Start.'} action={<button className="btn btn-ink" onClick={() => nav(-1)}>Back</button>} />;
  if (d.test?.proctored && !proctored) return <ProctorStart courseId={courseId} testId={testId} questionIds={d.test.questionIds} onStarted={() => setProctored(true)} onBack={() => nav(-1)} />;

  const { q } = d;
  const sub = saved || d.sub;
  const web = isWeb(q);
  const allowed = d.test ? langsOf(d.test) : Object.keys(LANGS); // practice allows every language
  const savedLang = web ? 'web' : langOfSub(sub, q);
  const lang = web ? 'web' : pickedLang || (allowed.includes(savedLang) ? savedLang : allowed[0]);
  const text = codes[lang] ?? (sub && savedLang === lang ? sub.code : web ? q.starter : STARTERS[lang]);
  const setCode = v => setCodes({ ...codes, [lang]: v });
  const locked = !!sub && !me.subscribed; // free plan: one submission per question in each test (or in practice); the same question in another test is a fresh attempt
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
    <div className="stack" style={{ gap: 12 }}>
      {att.started && !att.expired && <TimerBar left={att.left} />}
      <div className="card between" style={{ padding: '12px 16px', flexWrap: 'wrap' }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="icon-btn" aria-label="Back" onClick={() => nav(-1)}><Icon name="back" size={18} /></button>
          <span className="chip chip-brand">{typeLabel(q)}</span>
          <span className="chip chip-accent">{q.tests.length} test cases</span>
          {d.test?.proctored && <span className="chip chip-proctor">Proctored</span>}
          {sub && sub.passed === sub.total && <span className="chip chip-pass"><Icon name="check" size={14} stroke={2.4} />Solved</span>}
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => run(false)} disabled={!!busy} title="Ctrl + Enter">
            {busy === 'run' ? <span className="spinner" /> : <Icon name="play" size={14} fill="currentColor" stroke={0} />}Run samples
          </button>
          <button className="btn btn-accent" onClick={() => setConfirm(true)} disabled={!!busy || locked} title="Ctrl + Shift + Enter">
            {busy === 'submit' ? <><span className="spinner" />Judging…</> : 'Submit'}
          </button>
        </div>
      </div>

      {locked && <div className="warnbar"><Icon name="lock" size={18} />You've used your one submission for this question{testId === 'practice' ? '' : ' in this test'}. Subscribe to submit again.</div>}

      <div className="ws">
        <section className="card stack" style={{ padding: 0, overflow: 'hidden' }}>
          {sub && (
            <div style={{ padding: 10, borderBottom: '1px solid var(--line)' }}>
              <Tabs label="Panels" value={tab} onChange={setTab} tabs={[['problem', 'Problem'], ['sub', 'My submission']]} />
            </div>
          )}
          <div className="stack" style={{ padding: '22px 24px', gap: 16, overflow: 'auto' }}>
            {tab === 'problem' ? (
              <>
                <h2 className="h3" style={{ fontSize: 26 }}>{q.title}</h2>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, whiteSpace: 'pre-wrap', background: 'var(--paper)', borderRadius: 12, padding: '14px 16px' }}>{q.statement}</p>
                {q.constraints && (
                  <div className="stack" style={{ gap: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>Constraints</h3>
                    <p className="mono" style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'var(--paper)', borderRadius: 12, padding: '10px 14px' }}>{q.constraints}</p>
                  </div>
                )}
                {web ? (
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>Requirements</h3>
                    <ul className="ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>{visible.map((t, i) => <li key={i}>{t.desc || t.expr}</li>)}</ul>
                  </div>
                ) : visible.map((t, i) => (
                  <div key={i} className="stack" style={{ gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>Example {i + 1}</h3>
                    <div className="grid" style={{ gap: 10, gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
                      {[['Input', t.input], ['Output', t.output]].map(([l, v]) => (
                        <div key={l} style={{ background: 'var(--paper)', borderRadius: 12, padding: 12 }}>
                          <div className="tiny muted" style={{ fontWeight: 600, marginBottom: 4 }}>{l}</div>
                          <pre className="mono" style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{v}</pre>
                        </div>
                      ))}
                    </div>
                    {t.note && <p className="small ink2" style={{ margin: 0 }}><b>Explanation:</b> {t.note}</p>}
                  </div>
                ))}
                {hiddenN > 0 && <p className="small muted" style={{ margin: 0 }}>+ {hiddenN} hidden test cases are checked when you submit.</p>}
              </>
            ) : (
              <>
                <div className="between">
                  <h2 className="h3" style={{ fontSize: 22, color: sub.passed === sub.total ? 'var(--pass)' : 'var(--warn)' }}>{sub.passed === sub.total ? 'Accepted' : 'Partially correct'}</h2>
                  <span className="mono small">{sub.passed}/{sub.total}</span>
                </div>
                <CodeBlock code={sub.code} />
                <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => { if (!web) setPickedLang(savedLang); setCodes({ ...codes, [web ? 'web' : savedLang]: sub.code }); setTab('problem'); }}>Load into editor</button>
              </>
            )}
          </div>
        </section>

        <section className="stack" style={{ gap: 12, minWidth: 0 }}>
          {!web && (
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <span className="small muted">Language</span>
              {allowed.length > 1 ? (
                <div className="seg" role="group" aria-label="Language">{allowed.map(l => <button key={l} aria-pressed={lang === l} onClick={() => setPickedLang(l)} style={{ minHeight: 38 }}>{LANGS[l]}</button>)}</div>
              ) : <span className="chip">{LANGS[allowed[0]]}</span>}
            </div>
          )}
          <Editor file={ENV_FILE[lang]} right="Ctrl + Enter to run" value={text} onChange={setCode} onShortcut={shortcut} />
          <div className="card stack" style={{ gap: 12 }}>
            <div className="between">
              <h3 className="h3" style={{ fontSize: 18 }}>Test results</h3>
              {res && <span className="mono small muted">{res.r.filter(x => x.ok).length}/{res.r.length} passed</span>}
            </div>
            {busy && <div className="row muted small"><span className="spinner" />{busy === 'run' ? 'Running samples…' : 'Running all tests…'}</div>}
            {!busy && !res && <p className="small muted" style={{ margin: 0 }}>Run the samples to see your output here. The first Python run takes a few seconds to load.</p>}
            {!busy && res && (
              <>
                <div className="grid g3" style={{ gap: 10 }}>
                  {shown.map(({ x, t }, i) => (
                    <div key={i} className={'result ' + (x.ok ? 'chip-pass' : 'chip-warn')}>
                      <span className="row" style={{ gap: 6, fontWeight: 700, fontSize: 14 }}><Icon name={x.ok ? 'check' : 'x'} size={16} stroke={2.6} />Sample {i + 1} {x.ok ? 'passed' : 'failed'}</span>
                      <span className="mono tiny" style={{ color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
                        {x.ok ? (t.desc || `Output: ${x.got ?? ''}`) : x.error ? x.error : web ? (t.desc || 'Check failed') : `Expected ${x.expected}, got ${x.got}`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                  <span className="small" style={{ fontWeight: 600 }}>All tests</span>
                  <div className="pips" style={{ minWidth: 160, gridTemplateColumns: `repeat(${Math.max(res.r.length, 1)},minmax(0,1fr))` }}>
                    {res.r.map((x, i) => <span key={i} style={{ background: res.submitted ? (x.ok ? 'var(--pass-strong)' : 'var(--warn)') : 'var(--line)' }} />)}
                  </div>
                  <span className="mono small muted">{res.submitted ? `${res.r.filter(x => x.ok).length}/${res.r.length}` : 'graded on submit'}</span>
                </div>
              </>
            )}
            {web && preview && <iframe title="Preview" sandbox="allow-scripts" srcDoc={preview} style={{ width: '100%', height: 240, background: '#fff', border: '1px solid var(--line)', borderRadius: 12 }} />}
          </div>
        </section>
      </div>

      {confirm && (
        <Modal onClose={() => setConfirm(false)}>
          <h2 className="h3" style={{ fontSize: 26 }}>Submit your solution?</h2>
          <p className="muted" style={{ margin: 0 }}>It will be graded against all {q.tests.length} test cases.{!me.subscribed && ' You are on the free plan, so this is your only submission for this question.'}</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-plain" onClick={() => setConfirm(false)}>Keep editing</button>
            <button className="btn btn-accent" onClick={() => run(true)}>Submit</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
