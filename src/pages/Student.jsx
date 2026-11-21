import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, list } from '../firebase.js';
import { useMe } from '../auth.jsx';
import { grade } from '../runner.js';
import { dailyOf } from './Practice.jsx';
import { Bar, CodeBlock, StreakDots, CourseGrid, ENV_FILE, ENV_LABEL, Empty, Icon, Loading, Modal, Tabs, attempt, notify, useLoad } from '../ui.jsx';

const get = async (col, id) => { const s = await getDoc(doc(db, col, id)); return s.exists() ? { id, ...s.data() } : null; }; // null = deleted by the trainer
const mySubs = (uid, extra = []) => list(query(collection(db, 'submissions'), where('userId', '==', uid), ...extra));
const myCourses = uid => list(query(collection(db, 'courses'), where('students', 'array-contains', uid)));
export const dayKey = d => d.toISOString().slice(0, 10);
async function awardXp(me, before, now) {
  const ref = doc(db, 'leaderboard', me.uid);
  const cur = (await getDoc(ref)).data() || { xp: 0, streak: 0, lastDay: '' };
  const t = dayKey(new Date()), y = dayKey(new Date(Date.now() - 864e5));
  const streak = cur.lastDay === t ? cur.streak : cur.lastDay === y ? cur.streak + 1 : 1;
  await setDoc(ref, { name: me.name, xp: cur.xp + Math.max(0, now - before) * 10, streak, lastDay: t });
}
const Back = ({ to, children }) => <Link to={to} className="row small" style={{ gap: 4, fontWeight: 600, textDecoration: 'none' }}><Icon name="back" size={16} />{children}</Link>;

/* ---------- dashboard ---------- */
export function Dashboard() {
  const me = useMe();
  const [d] = useLoad(async () => {
    const courses = await myCourses(me.uid);
    const tests = (await Promise.all([...new Set(courses.flatMap(c => c.testIds))].map(t => get('tests', t)))).filter(Boolean);
    return { courses, tests, subs: await mySubs(me.uid), board: await list(collection(db, 'leaderboard')), daily: dailyOf(await list(collection(db, 'questions'))) };
  });
  if (!d) return <Loading />;
  const passed = d.subs.reduce((n, s) => n + s.passed, 0);
  const total = d.subs.reduce((n, s) => n + s.total, 0);
  const pct = total ? Math.round((100 * passed) / total) : 0;
  const today = dayKey(new Date());
  const ranked = [...d.board.filter(x => x.id !== me.uid), { id: me.uid, ...(d.board.find(x => x.id === me.uid) || { xp: 0, streak: 0, lastDay: '' }) }].sort((a, b) => b.xp - a.xp);
  const mine = ranked.find(x => x.id === me.uid);
  const rank = ranked.indexOf(mine) + 1;
  const cards = d.courses.flatMap(c => c.testIds.map(t => ({ c, t: d.tests.find(x => x.id === t) }))).filter(x => x.t);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <p className="muted" style={{ margin: '-14px 0 0' }}>Hi {me.name.split(' ')[0]}. {cards.length ? 'Pick up where you left off.' : "Your trainer hasn't assigned a test yet."}</p>
      <div className="grid g4">
        <div className="card-dark stack stat" style={{ gap: 12 }}>
          <div className="between small" style={{ color: '#C9CBD2' }}>
            <span className="row" style={{ gap: 6 }}><Icon name="flame" size={16} color="#F2B8A8" />Streak</span>
            <span style={{ color: '#F2B8A8' }}>{mine.lastDay === today ? 'Done today' : 'Due today'}</span>
          </div>
          <div className="big">{mine.streak} {mine.streak === 1 ? 'day' : 'days'}</div>
          <StreakDots n={mine.streak} dark />
        </div>
        <div className="card stack stat" style={{ gap: 12 }}>
          <div className="small muted">Questions attempted</div>
          <div className="big">{d.subs.length}</div>
          <div className="small ink2">across {new Set(d.subs.map(s => s.testId)).size} tests</div>
        </div>
        <div className="card stack stat" style={{ gap: 12 }}>
          <div className="small muted">Test cases passed</div>
          <div className="big">{passed}/{total}</div>
          <Bar pct={pct} color="var(--pass-strong)" />
        </div>
        <Link to="/leaderboard" className="card stack stat" style={{ gap: 12, textDecoration: 'none' }}>
          <div className="small muted">Leaderboard</div>
          <div className="big">#{rank}</div>
          <div className="small ink2">of {ranked.length}, {mine.xp} XP</div>
        </Link>
      </div>
      {d.daily && (
        <Link to="/contest" className="card between" style={{ background: 'var(--accent)', color: 'var(--on-accent)', border: 0, textDecoration: 'none', flexWrap: 'wrap', gap: 12 }}>
          <span className="stack" style={{ gap: 2 }}><span className="small">Daily contest</span><b style={{ fontSize: 20 }}>{d.daily.title}</b></span>
          <span className="btn btn-white">Solve today's question</span>
        </Link>
      )}
      <h2 className="h3" style={{ fontSize: 22 }}>Your tests</h2>
      {cards.length === 0 ? <Empty title="No tests yet" body="Tests your trainer assigns to your courses show up here." /> : (
        <div className="grid g3">
          {cards.map(({ c, t }) => {
            const done = d.subs.filter(s => s.testId === t.id).length;
            return (
              <article key={c.id + t.id} className="card stack" style={{ gap: 12 }}>
                <div className="between"><span className="small muted">{c.title}</span><span className={`chip ${done === t.questionIds.length ? 'chip-pass' : 'chip-accent'}`}>{done === t.questionIds.length ? 'Attempted' : 'Open'}</span></div>
                <h2 className="h3" style={{ fontSize: 23 }}>{t.title}</h2>
                <div className="small muted">{done}/{t.questionIds.length} questions attempted</div>
                <Bar pct={t.questionIds.length ? (100 * done) / t.questionIds.length : 0} />
                <Link to={`/test/${c.id}/${t.id}`} className="btn btn-ink" style={{ alignSelf: 'flex-start', marginTop: 4 }}>{done ? 'Continue' : 'Start test'}</Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- courses ---------- */
export function Courses() {
  const me = useMe();
  const [courses] = useLoad(() => myCourses(me.uid));
  if (!courses) return <Loading />;
  return <CourseGrid courses={courses} empty="You're not enrolled in any course yet. Ask your admin once you've paid." />;
}

export function CourseView() {
  const { id } = useParams();
  const me = useMe();
  const [d] = useLoad(async () => {
    const course = await get('courses', id);
    const tests = (await Promise.all(course.testIds.map(t => get('tests', t)))).filter(Boolean);
    return { course, tests, subs: course.testIds.length ? await mySubs(me.uid, [where('testId', 'in', course.testIds)]) : [] };
  }, [id]);
  if (!d) return <Loading />;
  const { course, tests, subs } = d;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <Back to="/courses">All courses</Back>
      <div className="card stack" style={{ gap: 8 }}>
        <span className="chip" style={{ alignSelf: 'flex-start' }}>Trainer: {course.trainerName}</span>
        <h2 className="h2" style={{ fontSize: 40 }}>{course.title}</h2>
        <p className="ink2" style={{ margin: 0, fontSize: 17 }}>{course.description}</p>
      </div>
      {tests.length === 0 ? <Empty title="No tests assigned yet" /> : tests.map(t => {
        const done = subs.filter(s => s.testId === t.id).length;
        return (
          <article key={t.id} className="card between" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div className="stack" style={{ gap: 4 }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
                <h2 className="h3" style={{ fontSize: 22 }}>{t.title}</h2>
                <span className={`chip ${done ? 'chip-pass' : 'chip-accent'}`}>{done}/{t.questionIds.length} attempted</span>
              </div>
              <span className="small muted">{t.questionIds.length} questions</span>
            </div>
            <Link to={`/test/${id}/${t.id}`} className={`btn ${done ? 'btn-ghost' : 'btn-ink'}`}>{done ? 'Continue' : 'Start test'}</Link>
          </article>
        );
      })}
    </div>
  );
}

/* ---------- test: list of questions ---------- */
export function TestView() {
  const { courseId, testId } = useParams();
  const me = useMe();
  const [d] = useLoad(async () => {
    const test = await get('tests', testId);
    const [qs, subs] = await Promise.all([Promise.all(test.questionIds.map(q => get('questions', q))).then(a => a.filter(Boolean)), mySubs(me.uid, [where('testId', '==', testId)])]);
    return { test, qs, subs };
  }, [testId]);
  if (!d) return <Loading />;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <Back to={`/course/${courseId}`}>Course</Back>
      <h2 className="h2" style={{ fontSize: 36 }}>{d.test.title}</h2>
      <div className="card" style={{ padding: 6 }}>
        {d.qs.map((q, i) => {
          const s = d.subs.find(x => x.questionId === q.id);
          return (
            <Link key={q.id} to={`/solve/${testId}/${q.id}`} className="rowlink">
              <span className="row">
                {s && s.passed === s.total ? <Icon name="check" size={18} stroke={2.4} color="var(--pass-strong)" /> : <span style={{ width: 18 }} />}
                <span style={{ fontWeight: 600 }}>{i + 1}. {q.title}</span>
              </span>
              <span className="row small">
                <span className="chip">{ENV_LABEL[q.env]}</span>
                {s ? <span className="mono" style={{ fontWeight: 700, color: s.passed === s.total ? 'var(--pass)' : 'var(--warn)' }}>{s.passed}/{s.total}</span> : <span className="muted">Not attempted</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- workspace (ported from the artifact) ---------- */
export function Editor({ value, onChange, file, right, onShortcut }) {
  const lines = Math.max(18, value.split('\n').length);
  const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
  const onKey = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onShortcut(e.shiftKey ? 'submit' : 'run'); return; }
    const t = e.target, st = t.selectionStart, en = t.selectionEnd;
    const put = (text, caret) => { onChange(value.slice(0, st) + text + value.slice(en)); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = st + caret; }); };
    if (e.key === 'Tab') { e.preventDefault(); put('    ', 4); return; }
    if (Object.values(pairs).includes(e.key) && value[st] === e.key && st === en) { e.preventDefault(); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = st + 1; }); return; }
    if (pairs[e.key] && st === en && !((e.key === '"' || e.key === "'") && /\w/.test(value[st - 1] || ''))) { e.preventDefault(); put(e.key + pairs[e.key], 1); return; }
    if (e.key === 'Enter' && st === en) {
      const lineStart = value.lastIndexOf('\n', st - 1) + 1;
      const indent = (value.slice(lineStart, st).match(/^\s*/) || [''])[0];
      const extra = /[:{(\[]\s*$/.test(value.slice(lineStart, st)) ? '    ' : '';
      e.preventDefault();
      put('\n' + indent + extra, 1 + indent.length + extra.length);
    }
  };
  return (
    <div className="editor">
      <div className="win-bar"><span style={{ color: 'var(--panel-text)' }}>{file}</span><span>{right}</span></div>
      <div className="editor-body">
        <div className="gutter" aria-hidden="true">{Array.from({ length: lines }, (_, i) => i + 1).join('\n')}</div>
        <label className="sr" htmlFor="ed">Code editor</label>
        <textarea id="ed" spellCheck="false" autoCapitalize="off" autoCorrect="off" rows={lines} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKey} />
      </div>
    </div>
  );
}

export function Solve() {
  const { testId, qid } = useParams();
  const me = useMe();
  const nav = useNavigate();
  const subId = `${me.uid}_${testId}_${qid}`;
  const [d] = useLoad(async () => {
    const [q, sub] = await Promise.all([get('questions', qid), getDoc(doc(db, 'submissions', subId))]);
    return { q, sub: sub.exists() ? sub.data() : null };
  }, [qid]);
  const [code, setCode] = useState(null);
  const [res, setRes] = useState(null); // {r, tests, submitted}
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState('problem');
  const [preview, setPreview] = useState('');
  const [saved, setSaved] = useState(null);
  useEffect(() => { setCode(null); setRes(null); setSaved(null); setTab('problem'); }, [qid]);
  if (!d) return <Loading />;
  if (!d.q) return <Empty title="This question was removed" body="Your trainer deleted it. Go back to the test." />;

  const { q } = d;
  const sub = saved || d.sub;
  const text = code ?? sub?.code ?? q.starter;
  const locked = !!sub && !me.subscribed;
  const visible = q.tests.filter(t => !t.hidden);
  const hiddenN = q.tests.length - visible.length;

  const run = submit => attempt(async () => {
    setConfirm(false);
    setBusy(submit ? 'submit' : 'run');
    try {
      const tests = submit ? q.tests : visible;
      if (q.env === 'web') setPreview(text);
      const r = await grade(q.env, text, tests);
      setRes({ r, tests, submitted: submit });
      if (submit) {
        const rec = { userId: me.uid, testId, questionId: qid, code: text, passed: r.filter(x => x.ok).length, total: r.length };
        await setDoc(doc(db, 'submissions', subId), { ...rec, at: serverTimestamp() });
        await awardXp(me, sub?.passed || 0, rec.passed);
        setSaved(rec);
        notify(rec.passed === rec.total ? 'Accepted! All test cases passed' : `${rec.passed}/${rec.total} test cases passed`);
      }
    } finally { setBusy(null); }
  });
  const shortcut = k => { if (!busy) k === 'run' ? run(false) : !locked && setConfirm(true); };
  const shown = res ? res.r.map((x, i) => ({ x, t: res.tests[i] })).filter(({ t }) => !t.hidden) : [];

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card between" style={{ padding: '12px 16px', flexWrap: 'wrap' }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="icon-btn" aria-label="Back" onClick={() => nav(-1)}><Icon name="back" size={18} /></button>
          <span className="chip">{ENV_LABEL[q.env]}</span>
          <span className="chip chip-accent">{q.tests.length} test cases</span>
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

      {locked && <div className="warnbar"><Icon name="lock" size={18} />You've used your one attempt on this question. Subscribe to submit again.</div>}

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
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{q.statement}</p>
                {q.env === 'web' ? (
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>Requirements</h3>
                    <ul className="ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>{visible.map((t, i) => <li key={i}>{t.desc || t.expr}</li>)}</ul>
                  </div>
                ) : visible.map((t, i) => (
                  <div key={i} className="grid" style={{ gap: 10, gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
                    {[['Sample input', t.input], ['Sample output', t.output]].map(([l, v]) => (
                      <div key={l} style={{ background: 'var(--paper)', borderRadius: 12, padding: 12 }}>
                        <div className="tiny muted" style={{ fontWeight: 600, marginBottom: 4 }}>{l} {i + 1}</div>
                        <pre className="mono" style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{v}</pre>
                      </div>
                    ))}
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
                <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => { setCode(sub.code); setTab('problem'); }}>Load into editor</button>
              </>
            )}
          </div>
        </section>

        <section className="stack" style={{ gap: 12, minWidth: 0 }}>
          <Editor file={ENV_FILE[q.env]} right="Ctrl + Enter to run" value={text} onChange={setCode} onShortcut={shortcut} />
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
                        {x.ok ? (t.desc || `Output: ${x.got ?? ''}`) : x.error ? x.error : q.env === 'web' ? (t.desc || 'Check failed') : `Expected ${x.expected}, got ${x.got}`}
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
            {q.env === 'web' && preview && <iframe title="Preview" sandbox="allow-scripts" srcDoc={preview} style={{ width: '100%', height: 240, background: '#fff', border: '1px solid var(--line)', borderRadius: 12 }} />}
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
