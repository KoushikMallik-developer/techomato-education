import { useState } from 'react';
import { inCourse } from '../../score.js';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { questionStats } from '../../score.js';
import { LANGS, courseCode, fromInput, langsOf, madeUpTime, readiness, testCode, timed, toInput, typeLabel, when, windowOf } from '../../schedule.js';
import { db, forgetQuestions, freeCode, list, listIn } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { Btn, CodeBlock, CourseGrid, plural, Empty, STARTERS, Field, Icon, Loading, Modal, attempt, notify, useBusy, useLoad } from '../../ui.jsx';

const blank = { input: '', output: '', expr: '', desc: '', hidden: false };

const remove = (col, item, reload) => attempt(async () => { await deleteDoc(doc(db, col, item.id)); if (col === 'questions') forgetQuestions(); notify('Deleted'); reload(); });

// A yes/no dialog for actions that are hard to undo.
const Confirm = ({ title, body, label, v = 'accent', onYes, onClose }) => {
  const [busy, run] = useBusy();
  return (
    <Modal onClose={onClose}>
      <h2 className="h3" style={{ fontSize: 24 }}>{title}</h2>
      <p className="ink2" style={{ margin: 0 }}>{body}</p>
      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Btn v="ghost" onClick={onClose}>Cancel</Btn>
        <Btn v={v} disabled={busy} onClick={() => run(async () => { await onYes(); onClose(); })}>{label}</Btn>
      </div>
    </Modal>
  );
};

export function TrainerCourses() {
  const me = useMe();
  const [q, setQ] = useState('');
  const [all] = useLoad(() => list(collection(db, 'courses')));
  if (!all) return <Loading />;
  const shown = all.filter(c => `${c.title} ${c.description || ''} ${c.trainerName || ''} ${courseCode(c)}`.toLowerCase().includes(q.trim().toLowerCase()));
  const mine = shown.filter(c => c.trainerId === me.uid);
  const extra = c => c.trainerId === me.uid ? <span className="chip chip-accent" style={{ alignSelf: 'flex-start' }}>Yours</span> : null;
  return (
    <div className="stack" style={{ gap: 28 }}>
      <form role="search" className="search" style={{ width: '100%', maxWidth: 480 }} onSubmit={e => e.preventDefault()}>
        <Icon name="search" size={16} />
        <input type="search" aria-label="Search courses" placeholder="Search courses by name, topic or trainer" value={q} onChange={e => setQ(e.target.value)} />
      </form>
      <section className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 10 }}><h2 className="h3" style={{ fontSize: 22 }}>My courses</h2><span className="chip">{mine.length}</span></div>
        <CourseGrid courses={mine} extra={extra} empty={q ? 'None of your courses match' : 'No courses assigned to you yet'} />
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 10 }}><h2 className="h3" style={{ fontSize: 22 }}>All courses</h2><span className="chip">{shown.length}</span></div>
        <CourseGrid courses={shown} extra={extra} empty={q ? 'No courses match your search' : 'No courses yet'} />
      </section>
    </div>
  );
}

// All of this trainer's courses at a glance: who attempted each test and the average. Details are on the course page.
const SearchBox = ({ label, placeholder, value, onChange }) => (
  <form role="search" className="search" style={{ width: '100%', maxWidth: 420 }} onSubmit={e => e.preventDefault()}>
    <Icon name="search" size={16} />
    <input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </form>
);
// A labelled dropdown for the filter and sort bars. options: [[value, label], ...]
const Pick = ({ label, value, onChange, options }) => (
  <label className="field" style={{ minWidth: 130, flex: '1 1 150px', maxWidth: 190 }}><span>{label}</span>
    <select className="input" value={value} onChange={e => onChange(e.target.value)}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
  </label>
);
const Meta = ({ items }) => ( // labelled details in a row, e.g. Created by: You
  <div className="row small" style={{ flexWrap: 'wrap', gap: '4px 22px' }}>
    {items.map(([k, v]) => <span key={k}><span className="muted">{k}: </span><b>{v}</b></span>)}
  </div>
);
const ms = v => v?.toMillis?.() ?? v ?? 0; // a stored time is a number in demo mode and a Timestamp in Firebase
const FilterBar = ({ changed, onReset, children }) => (
  <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
    {children}
    {changed && <button type="button" className="btn btn-plain btn-sm" onClick={onReset}>Reset</button>}
  </div>
);
const matches = (text, q) => text.toLowerCase().includes(q.trim().toLowerCase());
// created and updated times, with the same made-up fallback the cards show
const createdOf = x => ms(x.createdAt) || madeUpTime(x.id);
const updatedOf = x => ms(x.updatedAt) || createdOf(x);

const STATUS_BADGE = { open: ['Open', 'chip-green'], closed: ['Closed', 'chip-slate'] };
const pct = (n, d) => (d ? Math.round((100 * n) / d) : null);
const barColor = v => (v >= 70 ? 'var(--pass-strong)' : v >= 40 ? 'var(--warn)' : 'var(--accent)');

// Results for the tests this trainer wrote: a summary, filters, then one card per test, grouped by course.
export function TrainerResults() {
  const me = useMe();
  const [text, setText] = useState('');
  const none = { proc: 'all', sort: 'name' };
  const [f, setF] = useState(none);
  const [shut, setShut] = useState(() => new Set()); // ids of the collapsed courses
  const [d] = useLoad(async () => {
    const courses = await list(query(collection(db, 'courses'), where('trainerId', '==', me.uid)));
    const tests = (await list(query(collection(db, 'tests'), where('authorId', '==', me.uid)))); // only the tests this trainer wrote
    const mine = new Set(tests.map(t => t.id));
    const ids = [...new Set(courses.flatMap(c => c.testIds))].filter(t => mine.has(t));
    const subs = await listIn(ids, x => query(collection(db, 'submissions'), where('testId', 'in', x)));
    return { courses, tests, subs, bank: new Set((await list(collection(db, 'questions'))).map(q => q.id)) };
  });
  if (!d) return <Loading />;
  if (!d.courses.length) return <Empty title="No courses assigned to you yet" />;

  // one entry per (course, test)
  const entries = d.courses.flatMap(c => c.testIds.map(tid => {
    const t = d.tests.find(x => x.id === tid);
    if (!t) return null;
    const subs = d.subs.filter(s => s.testId === tid && c.students.includes(s.userId) && inCourse(s, c.id));
    const who = new Set(subs.map(s => s.userId));
    const total = subs.reduce((n, s) => n + s.total, 0), passed = subs.reduce((n, s) => n + s.passed, 0);
    const status = t.draft ? 'draft' : timed(t) ? windowOf(t) : 'open'; // tests from before schedules count as open
    return { c, t, who, subs, avg: pct(passed, total), status };
  })).filter(e => e && (e.status === 'open' || e.status === 'closed')); // results exist only once a test has started: drafts and scheduled tests are left out

  const sorts = { name: (a, b) => a.t.title.localeCompare(b.t.title), high: (a, b) => (b.avg ?? -1) - (a.avg ?? -1), low: (a, b) => (a.avg ?? 101) - (b.avg ?? 101),
    attempts: (a, b) => b.who.size - a.who.size, new: (a, b) => createdOf(b.t) - createdOf(a.t) };
  const shown = entries.filter(e => matches(`${e.t.title} ${testCode(e.t)} ${e.c.title} ${courseCode(e.c)}`, text)
    && (f.proc === 'all' || (f.proc === 'yes') === !!e.t.proctored)).sort(sorts[f.sort]);
  const groups = d.courses.map(c => ({ c, rows: shown.filter(e => e.c.id === c.id) })).filter(g => g.rows.length);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <SearchBox label="Search results" placeholder="Search by test, test ID or course" value={text} onChange={setText} />
      <FilterBar changed={JSON.stringify(f) !== JSON.stringify(none)} onReset={() => setF(none)}>
        <Pick label="Proctoring" value={f.proc} onChange={v => setF({ ...f, proc: v })} options={[['all', 'Proctored or not'], ['yes', 'Proctored'], ['no', 'Not proctored']]} />
        <Pick label="Sort by" value={f.sort} onChange={v => setF({ ...f, sort: v })} options={[['name', 'Test name A to Z'], ['high', 'Highest average'], ['low', 'Lowest average'], ['attempts', 'Most students attempted'], ['new', 'Test created, newest']]} />
      </FilterBar>

      {!entries.length ? <Empty title="No results yet" body="Results appear here once a test you assigned to a course is open or closed. Drafts and scheduled tests are not listed." />
        : !groups.length ? <Empty title="No results match" body="Try a different word or reset the filters." />
        : <>
        {groups.map(({ c, rows }) => (
          <details key={c.id} className="cdet" open={!shut.has(c.id)}>
            <summary className="csum" onClick={e => { e.preventDefault(); setShut(x => { const n = new Set(x); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; }); }}>
              <span className="cchev" aria-hidden="true"><Icon name="back" size={18} /></span>
              <h2 className="h3" style={{ fontSize: 22 }}>{c.title}</h2>
              <span className="chip mono">{courseCode(c)}</span>
              <span className="small muted">{plural(c.students.length, 'student')} · {plural(rows.length, 'test')}</span>
            </summary>
            <div className="cbody">
            <div className="facts">{(() => { // a summary of this course's tests that are listed
              const all = rows.flatMap(r => r.subs), taking = new Set(rows.flatMap(r => [...r.who])).size, overall = pct(all.reduce((n, x) => n + x.passed, 0), all.reduce((n, x) => n + x.total, 0));
              return [['Tests', rows.length, 'open or closed'], ['Students', c.students.length, 'in this course'], ['Students taking tests', taking, `of ${c.students.length}`], ['Average result', overall === null ? 'None' : `${overall}%`, 'of all submitted answers']].map(([k, v, hint]) => (
                <div key={k} className="fact"><span className="small muted">{k}</span><b style={{ fontSize: 26, lineHeight: 1.1 }}>{v}</b><span className="small muted">{hint}</span></div>
              ));
            })()}</div>
            {rows.map(({ t, who, avg, status }) => {
              const [label, cls] = STATUS_BADGE[status];
              return (
                <article key={t.id} className="card rres">
                  <div className="stack" style={{ gap: 8, minWidth: 0 }}>
                    <h3 className="h3" style={{ fontSize: 20 }}>{t.title}</h3>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                      <span className={`chip ${cls}`}>{label}</span>
                      {t.proctored && <span className="chip chip-proctor"><Icon name="lock" size={14} />Proctored</span>}
                      <span className="chip mono">{testCode(t)}</span>
                      <span className="chip">{plural(t.questionIds.length, 'question')}</span>
                    </div>
                  </div>
                  <div className="qavg">
                    <span className="small muted">Students attempted</span>
                    <b style={{ fontSize: 22, lineHeight: 1.1 }}>{who.size}<span className="small muted" style={{ fontWeight: 500 }}> of {c.students.length}</span></b>
                    <div className="bar" role="img" aria-label={`${who.size} of ${c.students.length} students attempted`}><span style={{ width: `${pct(who.size, c.students.length) ?? 0}%` }} /></div>
                  </div>
                  <div className="qavg">
                    <span className="small muted">Average result</span>
                    {avg === null ? <b style={{ fontSize: 22, lineHeight: 1.1, color: 'var(--muted)' }}>None yet</b> : (
                      <>
                        <b style={{ fontSize: 22, lineHeight: 1.1 }}>{avg}%</b>
                        <div className="bar" role="img" aria-label={`Average result ${avg}%`}><span style={{ width: `${avg}%`, background: barColor(avg) }} /></div>
                      </>
                    )}
                  </div>
                  <Link to={`/results/${c.id}/${t.id}`} className="btn btn-ink btn-sm">View results</Link>
                </article>
              );
            })}
            </div>
          </details>
        ))}
        </>}
    </div>
  );
}

// A question on its own page: the way a student sees it, then what only trainers see. The author and admins can edit or delete it.
export function QuestionDetail() {
  const { id } = useParams();
  const me = useMe();
  const nav = useNavigate();
  const [q] = useLoad(async () => { const snap = await getDoc(doc(db, 'questions', id)); return snap.exists() ? { id, ...snap.data() } : { gone: true }; }, [id]);
  const [ask, setAsk] = useState(false);
  const back = me.role === 'admin' ? '/' : '/questions';
  if (!q) return <Loading />;
  if (q.gone) return <Empty title="Question not found" body="It may have been deleted." action={<Link to={back} className="btn btn-ink">Back</Link>} />;
  const web = q.env === 'web', shown = q.tests.filter(t => !t.hidden), hidden = q.tests.filter(t => t.hidden);
  const mine = q.authorId === me.uid || me.role === 'admin';
  const box = (l, v) => (
    <div style={{ background: 'var(--paper)', borderRadius: 12, padding: 12, minWidth: 0 }}>
      <div className="tiny muted" style={{ fontWeight: 600, marginBottom: 4 }}>{l}</div>
      <pre className="mono" style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{v}</pre>
    </div>
  );
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <Link to={back} className="row small" style={{ gap: 4, fontWeight: 600, textDecoration: 'none' }}><Icon name="back" size={16} />{me.role === 'admin' ? 'Back' : 'Question bank'}</Link>
      <section className="card stack" style={{ gap: 16 }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          <div className="stack" style={{ gap: 10, minWidth: 0 }}>
            <span className="small muted">This is how a student sees the question.</span>
            <h2 className="h3" style={{ fontSize: 28 }}>{q.title}</h2>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <span className="chip chip-brand">{typeLabel(q)}</span>
              {q.diff && <span className={`chip ${{ Easy: 'chip-pass', Medium: 'chip-amber', Hard: 'chip-ink' }[q.diff] || ''}`}>{q.diff}</span>}
              {q.topic && <span className="chip">{q.topic}</span>}
            </div>
          </div>
          {mine && <Link to={`/questions/${id}/edit`} className="btn btn-ghost btn-sm"><Icon name="edit" size={16} />Edit</Link>}
        </div>
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
            <ul className="ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>{shown.map((t, i) => <li key={i}>{t.desc || t.expr}</li>)}</ul>
          </div>
        ) : shown.map((t, i) => (
          <div key={i} className="stack" style={{ gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Example {i + 1}</h3>
            <div className="grid" style={{ gap: 10, gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>{box('Input', t.input)}{box('Output', t.output)}</div>
            {t.note && <p className="small ink2" style={{ margin: 0 }}><b>Explanation:</b> {t.note}</p>}
          </div>
        ))}
        {hidden.length > 0 && <p className="small muted" style={{ margin: 0 }}>Hidden test cases checked when the student submits: {hidden.length}.</p>}
        {web && q.starter && <div className="stack" style={{ gap: 6 }}><h3 style={{ margin: 0, fontSize: 14 }}>Starter code in the editor</h3><CodeBlock code={q.starter} /></div>}
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <h3 className="h3" style={{ fontSize: 18 }}>Only trainers see this</h3>
        <Meta items={[['Visibility', q.public === false ? 'Private (tests only)' : 'Public (practice and daily contests)'], ['Test cases', q.tests.length], ['Hidden', hidden.length], ['Created by', q.authorName || 'A former trainer'], ['Created', when(ms(q.createdAt) || madeUpTime(q.id))], ['Updated', when(ms(q.updatedAt) || ms(q.createdAt) || madeUpTime(q.id))]]} />
        {hidden.map((t, i) => (
          <div key={i} className="stack" style={{ gap: 6 }}>
            <span className="small muted">Hidden test case {i + 1}</span>
            {web ? <p className="small" style={{ margin: 0 }}>{t.desc || t.expr}{t.desc && t.expr ? <span className="mono muted"> ({t.expr})</span> : null}</p> : <div className="grid" style={{ gap: 10, gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>{box('Input', t.input)}{box('Output', t.output)}</div>}
          </div>
        ))}
      </section>

      {mine && (
        <section className="card stack" style={{ gap: 10, borderColor: 'var(--accent)' }}>
          <h3 className="h3" style={{ fontSize: 18, color: 'var(--accent-ink)' }}>Danger zone</h3>
          <p className="small muted" style={{ margin: 0 }}>Deleting removes the question from the bank for everyone, and tests that use it lose it. Answers students already submitted stay.</p>
          <div><Btn v="accent" onClick={() => setAsk(true)}><Icon name="trash" size={16} />Delete question</Btn></div>
        </section>
      )}
      {ask && <Confirm title={`Delete "${q.title}"?`} body="It is removed from the question bank for everyone, and tests that use it lose it. Submissions already made stay. This cannot be undone." label="Delete question" onYes={async () => { await deleteDoc(doc(db, 'questions', id)); forgetQuestions(); notify('Question deleted'); nav(back); }} onClose={() => setAsk(false)} />}
    </div>
  );
}

// One numbered block of the question form.
const Step = ({ n, title, hint, action, children }) => (
  <section className="card stack" style={{ gap: 14 }}>
    <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start', minWidth: 0, flex: '1 1 280px' }}>
        <span className="avatar" style={{ width: 28, height: 28, fontSize: 13 }} aria-hidden="true">{n}</span>
        <div><h3 className="h3" style={{ fontSize: 18 }}>{title}</h3>{hint && <p className="small muted" style={{ margin: '2px 0 0' }}>{hint}</p>}</div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

// q given = editing that question (its type cannot change: web and programming answers are graded differently)
function QuestionForm({ onSaved, q }) {
  const me = useMe();
  const [env, setEnv] = useState(q ? (q.env === 'web' ? 'web' : 'code') : 'code'); // 'code' = programming (any language), 'web' = an HTML/CSS/JS page
  const [title, setTitle] = useState(q?.title || '');
  const [statement, setStatement] = useState(q?.statement || '');
  const [constraints, setConstraints] = useState(q?.constraints || '');
  const [diff, setDiff] = useState(q?.diff || 'Easy');
  const [topic, setTopic] = useState(q?.topic || '');
  const [starter, setStarter] = useState(q?.env === 'web' ? q.starter : STARTERS.web);
  const [pub, setPub] = useState(q ? q.public !== false : true);
  const [tests, setTests] = useState(q ? q.tests.map(t => ({ ...blank, ...t })) : [{ ...blank }]);
  const web = env === 'web';
  const [busy, run] = useBusy();
  const pickEnv = v => { setEnv(v); setTests([{ ...blank }]); };
  const edit = (i, patch) => setTests(tests.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const pairs = tests.map((t, i) => [t, i]);
  const examples = pairs.filter(([t]) => !t.hidden), hiddenCases = pairs.filter(([t]) => t.hidden);
  const caseCard = (t, i, label, example) => (
    <div key={i} className="stack" style={{ gap: 8, background: 'var(--paper)', borderRadius: 14, padding: 12 }}>
      <div className="between"><b className="small">{label}</b><button type="button" className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`Remove ${label}`} onClick={() => setTests(tests.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button></div>
      <div className="grid g2">
        <Field label="Input"><textarea className="input mono" rows={2} value={t.input} onChange={e => edit(i, { input: e.target.value })} /></Field>
        <Field label="Output"><textarea className="input mono" rows={2} value={t.output} onChange={e => edit(i, { output: e.target.value })} /></Field>
      </div>
      {example && <Field label="Explanation (optional)"><input className="input" placeholder="Why this input gives this output" value={t.note || ''} onChange={e => edit(i, { note: e.target.value })} /></Field>}
    </div>
  );
  const save = e => {
    e.preventDefault();
    run(async () => {
      const ok = tests.filter(t => (web ? t.expr.trim() : t.output.trim())).map(({ note, ...t }) => (note?.trim() ? { ...t, note: note.trim() } : t));
      if (!ok.length) throw new Error('Add at least one complete test case');
      if (!web && !ok.some(t => !t.hidden)) throw new Error('Add at least one example test case (one that students can see)');
      if (q) {
        await updateDoc(doc(db, 'questions', q.id), { title, statement, constraints: constraints.trim(), env, starter: web ? starter : '', diff, topic: topic.trim(), tests: ok, public: pub, updatedAt: serverTimestamp() });
      } else await addDoc(collection(db, 'questions'), { title, statement, ...(constraints.trim() ? { constraints: constraints.trim() } : {}), env, starter: web ? starter : '', diff, topic: topic.trim(), tests: ok, public: pub, authorId: me.uid, authorName: me.name, createdAt: serverTimestamp() });
      forgetQuestions();
      notify(q ? 'Question updated' : 'Saved to the question bank');
      onSaved();
    });
  };
  return (
    <form className="stack" style={{ gap: 16 }} onSubmit={save}>
      <Step n={1} title="Basics" hint="What students see in the question list.">
        <Field label="Title"><input className="input" required placeholder="e.g. Reverse a string" value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <div className="grid g3">
          <Field label="Question type">
            <select className="input" value={env} disabled={!!q} onChange={e => pickEnv(e.target.value)}>
              <option value="code">Programming (students pick the language)</option>
              <option value="web">Web page (HTML / CSS / JS)</option>
            </select>
          </Field>
          <Field label="Difficulty"><select className="input" value={diff} onChange={e => setDiff(e.target.value)}>{['Easy', 'Medium', 'Hard'].map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Topic (optional)"><input className="input" placeholder="e.g. Strings" value={topic} onChange={e => setTopic(e.target.value)} /></Field>
        </div>
      </Step>

      <Step n={2} title="Problem" hint="Explain the task clearly. Say what the input and output look like.">
        <Field label="Problem statement"><textarea className="input" rows={5} required value={statement} onChange={e => setStatement(e.target.value)} /></Field>
        <Field label="Constraints (optional)"><textarea className="input mono" rows={3} placeholder={'One per line, for example:\n1 <= n <= 1000\nTime limit: 1 second'} value={constraints} onChange={e => setConstraints(e.target.value)} /></Field>
      </Step>

      {web ? (
        <Step n={3} title="Requirements" hint="Each requirement is a JavaScript expression run against the student's page. It must be truthy, e.g. document.querySelector('h1').textContent === 'Hello'"
          action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setTests([...tests, { ...blank }])}><Icon name="plus" size={16} />Requirement</button>}>
          {tests.map((t, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input className="input" style={{ flex: '1 1 200px' }} aria-label="Description shown to the student" placeholder="Description shown to the student" value={t.desc} onChange={e => edit(i, { desc: e.target.value })} />
              <input className="input mono" style={{ flex: '2 1 260px' }} aria-label="JS expression" placeholder="JS expression" value={t.expr} onChange={e => edit(i, { expr: e.target.value })} />
              <label className="row small" style={{ gap: 6, minHeight: 44 }}><input type="checkbox" checked={t.hidden} onChange={e => edit(i, { hidden: e.target.checked })} />Hidden</label>
              <button type="button" className="icon-btn" aria-label="Remove requirement" onClick={() => setTests(tests.filter((_, j) => j !== i))}><Icon name="x" size={18} /></button>
            </div>
          ))}
        </Step>
      ) : (
        <>
          <Step n={3} title="Example test cases" hint="Students see these on the question page, and they are checked when the student submits. Add as many as help explain the problem."
            action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setTests([...tests, { ...blank }])}><Icon name="plus" size={16} />Example test case</button>}>
            {examples.map(([t, i], n) => caseCard(t, i, `Example test case ${n + 1}`, true))}
          </Step>
          <Step n={4} title="Hidden test cases" hint="Optional. Also checked on submit, but students never see them. They catch answers that only work for the example ones."
            action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setTests([...tests, { ...blank, hidden: true }])}><Icon name="plus" size={16} />Hidden test case</button>}>
            {hiddenCases.length ? hiddenCases.map(([t, i], n) => caseCard(t, i, `Hidden test case ${n + 1}`, false)) : <p className="small muted" style={{ margin: 0 }}>None yet. Add one or two with different inputs from the example ones.</p>}
          </Step>
        </>
      )}

      {web && (
        <Step n={4} title="Starter code" hint="What students see in the editor when they open the question.">
          <textarea className="input mono" rows={6} aria-label="Starter code" value={starter} onChange={e => setStarter(e.target.value)} />
        </Step>
      )}

      <Step n={web ? 5 : 5} title="Publish to the public?" hint="Public questions appear in student Practice, search and the daily contest. Private ones can only be used in tests.">
        <label className={`opt ${pub ? 'sel' : ''}`}><input type="radio" name="vis" checked={pub} onChange={() => setPub(true)} /><span><b>Public</b> <span className="small muted">Everyone can practise it and it can come up as the daily contest</span></span></label>
        <label className={`opt ${!pub ? 'sel' : ''}`}><input type="radio" name="vis" checked={!pub} onChange={() => setPub(false)} /><span><b>Private</b> <span className="small muted">Only students taking a test that uses it can see it</span></span></label>
      </Step>

      <div className="savebar">
        {!web && <span className="small muted" style={{ marginRight: 'auto' }}>{examples.length} example + {hiddenCases.length} hidden test cases</span>}
        <Link to="/questions" className="btn btn-plain">Cancel</Link>
        <Btn v="accent" disabled={busy}>{q ? 'Save changes' : 'Save to question bank'}</Btn>
      </div>
    </form>
  );
}

// Its own page (/questions/new) so the bank stays a clean list.
export function NewQuestion() {
  const nav = useNavigate();
  const { id } = useParams();
  const me = useMe();
  const [d] = useLoad(async () => (id ? { q: { id, ...(await getDoc(doc(db, 'questions', id))).data() } } : {}), [id]);
  if (!d) return <Loading />;
  const q = d.q;
  if (id && q.authorId !== me.uid && me.role !== 'admin') return <Empty title="Only the trainer who added a question, or an admin, can edit it" action={<Link to="/questions" className="btn btn-ink">Back to the question bank</Link>} />;
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <Link to={id ? `/questions/${id}` : '/questions'} className="row small" style={{ gap: 4, fontWeight: 600, textDecoration: 'none' }}><Icon name="back" size={16} />{id ? 'Back to the question' : 'Question bank'}</Link>
      {id && <p className="small muted" style={{ margin: 0 }}>Changes apply everywhere this question is used, straight away. Answers students already submitted keep their saved score. The question type cannot be changed.</p>}
      <QuestionForm key={id || 'new'} q={q} onSaved={() => nav(id ? `/questions/${id}` : '/questions')} />
    </div>
  );
}

export function Questions() {
  const me = useMe();
  // shortcut: reads every submission on this trainer's own tests to build the averages; fine for a few thousand, move to a counters doc when the class grows
  const [data, reload] = useLoad(async () => { const [qs, tests] = await Promise.all([list(collection(db, 'questions')), list(collection(db, 'tests'))]);
    const subs = await listIn(tests.filter(t => t.authorId === me.uid).map(t => t.id), ids => query(collection(db, 'submissions'), where('testId', 'in', ids))); // questions saved before authorName existed: look the author up once per trainer
    const missing = [...new Set(qs.filter(q => !q.authorName && q.authorId).map(q => q.authorId))];
    const names = Object.fromEntries(await Promise.all(missing.map(async id => [id, (await getDoc(doc(db, 'users', id))).data()?.name])));
    return { qs: qs.map(q => ({ ...q, authorName: q.authorName || names[q.authorId] })), stats: questionStats(qs, tests, subs) }; });
  const [text, setText] = useState('');
  const [del, setDel] = useState(null);
  const none = { env: 'all', diff: 'all', vis: 'all', by: 'all', sort: 'new' };
  const [f, setF] = useState(none);
  if (!data) return <Loading />;
  const { qs, stats } = data;
  const authors = [...new Map(qs.filter(q => q.authorId && q.authorId !== me.uid).map(q => [q.authorId, q.authorName || 'Unknown'])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const sorts = { new: (a, b) => createdOf(b) - createdOf(a), old: (a, b) => createdOf(a) - createdOf(b), upd: (a, b) => updatedOf(b) - updatedOf(a), title: (a, b) => a.title.localeCompare(b.title),
    used: (a, b) => stats[b.id].tests.length - stats[a.id].tests.length, unused: (a, b) => stats[a.id].tests.length - stats[b.id].tests.length, high: (a, b) => (stats[b.id].avg ?? -1) - (stats[a.id].avg ?? -1), low: (a, b) => (stats[a.id].avg ?? 101) - (stats[b.id].avg ?? 101) };
  const shown = qs.filter(q => matches(`${q.title} ${q.topic || ''} ${typeLabel(q)} ${q.diff || ''}`, text)
    && (f.env === 'all' || (f.env === 'web') === (q.env === 'web')) && (f.diff === 'all' || q.diff === f.diff)
    && (f.vis === 'all' || (f.vis === 'private') === (q.public === false)) && (f.by === 'all' || q.authorId === (f.by === 'me' ? me.uid : f.by))).sort(sorts[f.sort]);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between" style={{ flexWrap: 'wrap' }}>
        <form role="search" className="search" style={{ width: '100%', maxWidth: 420 }} onSubmit={e => e.preventDefault()}>
          <Icon name="search" size={16} />
          <input type="search" aria-label="Search questions" placeholder="Search by title, topic, language or level" value={text} onChange={e => setText(e.target.value)} />
        </form>
        <Link to="/questions/new" className="btn btn-ink"><Icon name="plus" size={18} />New question</Link>
      </div>
      {qs.length > 0 && (
        <FilterBar changed={JSON.stringify(f) !== JSON.stringify(none)} onReset={() => setF(none)}>
          <Pick label="Type" value={f.env} onChange={v => setF({ ...f, env: v })} options={[['all', 'All types'], ['code', 'Programming'], ['web', 'Web page']]} />
          <Pick label="Level" value={f.diff} onChange={v => setF({ ...f, diff: v })} options={[['all', 'All levels'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']]} />
          <Pick label="Visibility" value={f.vis} onChange={v => setF({ ...f, vis: v })} options={[['all', 'Public and private'], ['public', 'Public'], ['private', 'Private']]} />
          <Pick label="Created by" value={f.by} onChange={v => setF({ ...f, by: v })} options={[['all', 'Everyone'], ['me', 'Me'], ...authors]} />
          <Pick label="Sort by" value={f.sort} onChange={v => setF({ ...f, sort: v })} options={[['new', 'Newest first'], ['old', 'Oldest first'], ['upd', 'Recently updated'], ['title', 'Title A to Z'], ['used', 'Most used in tests'], ['unused', 'Least used in tests'], ['high', 'Highest average result'], ['low', 'Lowest average result']]} />
        </FilterBar>
      )}
      {qs.length === 0 ? <Empty title="The question bank is empty" body="Add your first question to start building tests." /> : shown.length === 0 ? <Empty title="No questions match" body="Try a different word or reset the filters." /> : (
        <div className="stack" style={{ gap: 12 }}>
          {shown.map(q => {
            const st = stats[q.id], used = st.tests;
            return (
              <article key={q.id} className="card qrow">
                <div className="stack" style={{ gap: 8, minWidth: 0 }}>
                  <h2 className="h3" style={{ fontSize: 20 }}><Link to={`/questions/${q.id}`} className="qlink" title="Open the question">{q.title}</Link></h2>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <span className="chip chip-brand">{typeLabel(q)}</span>
                    {q.diff && <span className={`chip ${{ Easy: 'chip-pass', Medium: 'chip-amber', Hard: 'chip-ink' }[q.diff] || ''}`}>{q.diff}</span>}
                    {q.topic && <span className="chip">{q.topic}</span>}
                    <span className="chip">{plural(q.tests.length, 'test case')}</span>
                    {q.public === false && <span className="chip chip-warn"><Icon name="lock" size={14} />Private</span>}
                  </div>
                  <Meta items={[['Created by', q.authorId === me.uid ? 'You' : q.authorName || 'A former trainer'], ['Created', when(ms(q.createdAt) || madeUpTime(q.id))], ['Updated', when(ms(q.updatedAt) || ms(q.createdAt) || madeUpTime(q.id))]]} />
                </div>
                <div className="qavg" title="How many tests use this question">
                  <span className="small muted">Used in</span>
                  <b style={{ fontSize: 24, lineHeight: 1.1, color: used.length ? 'var(--ink)' : 'var(--muted)' }}>{used.length}<span className="small muted" style={{ fontWeight: 500 }}> {used.length === 1 ? 'test' : 'tests'}</span></b>
                </div>
                <div className="qavg">
                  {st.students ? (
                    <>
                      <span className="small muted">Average result</span>
                      <b style={{ fontSize: 24, lineHeight: 1.1 }}>{st.avg}%</b>
                      <div className="bar" role="img" aria-label={`Average result ${st.avg}%`}><span style={{ width: `${st.avg}%`, background: st.avg >= 70 ? 'var(--pass-strong)' : st.avg >= 40 ? 'var(--warn)' : 'var(--accent)' }} /></div>
                    </>
                  ) : <span className="small muted">No attempts yet</span>}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {q.authorId === me.uid && <Link to={`/questions/${q.id}/edit`} className="icon-btn" aria-label={`Edit ${q.title}`}><Icon name="edit" size={16} /></Link>}
                  {(q.authorId === me.uid || me.role === 'admin') && <button className="icon-btn" aria-label={`Delete ${q.title}`} onClick={() => setDel(q)}><Icon name="trash" size={16} /></button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {del && <Confirm title={`Delete "${del.title}"?`} body="It is removed from the question bank for everyone, and tests that use it lose it. Submissions already made stay. This cannot be undone." label="Delete question" onYes={() => remove('questions', del, reload)} onClose={() => setDel(null)} />}
    </div>
  );
}

// Create a test: basics, when students may join, how long they get, which questions, which courses.
export function NewTest() {
  const me = useMe();
  const { id } = useParams();
  const [data, reload] = useLoad(async () => ({ qs: await list(collection(db, 'questions')), courses: await list(query(collection(db, 'courses'), where('trainerId', '==', me.uid))), test: id ? (await getDoc(doc(db, 'tests', id))).data() : null }), [id]);
  if (!data) return <Loading />;
  if (id && data.test?.authorId !== me.uid) return <Empty title="Only the trainer who created a test can edit it" action={<Link to="/tests" className="btn btn-ink">Back to tests</Link>} />;
  return <TestForm key={`${data.test?.publishAt}-${data.test?.endAt}`} data={data} id={id} reload={reload} />;
}

// One form for a new test and for editing an existing one (id given).
function TestForm({ data, id, reload }) {
  const me = useMe();
  const nav = useNavigate();
  const t = data.test;
  const [title, setTitle] = useState(t?.title || '');
  const [picked, setPicked] = useState(t?.questionIds || []);
  const [proctored, setProctored] = useState(!!t?.proctored);
  const was = id ? data.courses.filter(c => c.testIds?.includes(id)).map(c => c.id) : []; // courses the test is in already
  const [courseIds, setCourseIds] = useState(was);
  const [publishAt, setPublishAt] = useState(() => toInput(t?.publishAt || Date.now()));
  const [endAt, setEndAt] = useState(() => toInput(t?.endAt || Date.now() + 7 * 864e5));
  const [mins, setMins] = useState(t?.durationMin || 60);
  const [langs, setLangs] = useState(langsOf(t));
  const [busy, run] = useBusy();
  const isDraft = !id || !!t.draft; // a published test cannot go back to a draft
  // put the test in the ticked courses and take it out of the unticked ones; students are told about it when the test is published
  const syncCourses = async (testId, from, tellAll) => {
    for (const c of data.courses) {
      const on = courseIds.includes(c.id), had = was.includes(c.id);
      if (on === had && !(on && tellAll)) continue;
      const b = writeBatch(db); // shortcut: notifies the first 450 students (batch limit 500), assign from the course page for larger classes
      if (on !== had) b.update(doc(db, 'courses', c.id), { testIds: on ? arrayUnion(testId) : arrayRemove(testId) });
      if (on && (tellAll || !had)) c.students.slice(0, 450).forEach(userId => b.set(doc(collection(db, 'notifications')), { userId, text: `New test in ${c.title}: ${title}. Opens ${when(from)}.`, link: `/course/${c.id}`, read: false, at: Date.now() }));
      await b.commit();
    }
  };
  const save = asDraft => e => {
    e?.preventDefault();
    run(async () => {
      const [from, to] = [fromInput(publishAt), fromInput(endAt)];
      const fields = { title: title.trim(), questionIds: picked, languages: langs, ...(Number.isFinite(from) && { publishAt: from }), ...(Number.isFinite(to) && { endAt: to }), ...(mins >= 1 && { durationMin: Math.round(mins) }) };
      const owner = async () => ({ code: await freeCode('tests', 'T'), proctored, authorId: me.uid, authorName: me.name, createdAt: serverTimestamp() });
      if (asDraft) { // a draft keeps whatever is filled in, courses included, and is hidden from students until it is published
        if (!fields.title) throw new Error('Add a title to save a draft');
        let testId = id;
        if (id) await updateDoc(doc(db, 'tests', id), { ...fields, draft: true, updatedAt: serverTimestamp() });
        else testId = (await addDoc(collection(db, 'tests'), { ...fields, ...(await owner()), draft: true })).id;
        await syncCourses(testId, from, false);
        notify('Draft saved. Finish it and press Schedule test to publish.');
        return nav('/tests');
      }
      // a test is published only with a title, questions, a publish time, an end time, a time limit and at least one course
      if (!langs.length) throw new Error('Allow at least one language');
      const problems = readiness({ ...fields, durationMin: mins }, new Set(data.qs.map(q => q.id)), isDraft ? Date.now() : 0, courseIds.length);
      if (problems.length) throw new Error(problems[0]);
      let testId = id;
      if (id) await updateDoc(doc(db, 'tests', id), { ...fields, ...(t.draft && { draft: false }), updatedAt: serverTimestamp() }); // proctoring cannot be switched on after creation
      else testId = (await addDoc(collection(db, 'tests'), { ...fields, ...(await owner()) })).id;
      await syncCourses(testId, from, isDraft); // a test that was a draft is new to every course's students
      notify(id && !t.draft ? 'Test updated' : `Test scheduled and assigned to ${plural(courseIds.length, 'course')}`);
      nav('/tests');
    });
  };
  const toggle = (on, set) => (id, yes) => set(yes ? [...on, id] : on.filter(x => x !== id));
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <Link to="/tests" className="row small" style={{ gap: 4, fontWeight: 600, textDecoration: 'none' }}><Icon name="back" size={16} />Tests</Link>
      {id && <p className="small muted" style={{ margin: 0 }}>Changes apply to students straight away. Students who already started keep their own deadline, and answers they submitted stay as they are.</p>}
      <form className="stack" style={{ gap: 16 }} onSubmit={save(false)}>
        <Step n={1} title="Basics" hint="What students see in their test list.">
          <Field label="Title"><input className="input" required placeholder="e.g. Week 3 loops test" value={title} onChange={e => setTitle(e.target.value)} /></Field>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={proctored} disabled={!!id} onChange={e => setProctored(e.target.checked)} /><span><b>Proctored</b> <span className="small muted">(fullscreen, camera checks, activity log; the questions stay hidden from practice)</span></span></label>
        </Step>

        <Step n={2} title="Schedule and time limit" hint="Students can start between the publish time and the end time. After the end time nobody can start, but a student who already started keeps the time they have left.">
          <div className="grid g3">
            <Field label="Publish time (students can join from)"><input className="input" type="datetime-local" required value={publishAt} onChange={e => setPublishAt(e.target.value)} /></Field>
            <Field label="End time (nobody can start after)"><input className="input" type="datetime-local" required value={endAt} onChange={e => setEndAt(e.target.value)} /></Field>
            <Field label="Time limit (minutes)"><input className="input" type="number" min={1} required value={mins} onChange={e => setMins(+e.target.value)} /></Field>
          </div>
          <p className="small muted" style={{ margin: 0 }}>The timer starts when a student presses Start. It keeps running if they close the page, and they can come back and continue with the time that is left.</p>
        </Step>

        <Step n={3} title="Allowed languages" hint="Students solve programming questions in one of these. They pick the language in the editor. Web page questions are not affected.">
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(LANGS).map(([k, l]) => (
              <label key={k} className={`opt ${langs.includes(k) ? 'sel' : ''}`} style={{ flex: '0 1 auto' }}>
                <input type="checkbox" checked={langs.includes(k)} onChange={e => setLangs(e.target.checked ? [...langs, k] : langs.filter(x => x !== k))} />{l}
              </label>
            ))}
          </div>
        </Step>

        <Step n={4} title="Questions" hint="Pick from the question bank.">
          {data.qs.length ? data.qs.map(q => {
            const on = picked.includes(q.id);
            return (
              <label key={q.id} className={`opt ${on ? 'sel' : ''}`}>
                <input type="checkbox" checked={on} onChange={e => toggle(picked, setPicked)(q.id, e.target.checked)} />
                <span style={{ flexGrow: 1 }}>{q.title}</span><span className="chip">{typeLabel(q)}</span>
              </label>
            );
          }) : <span className="muted small">Add questions to the bank first.</span>}
        </Step>

        <Step n={5} title="Courses" hint="Required to publish: a test that is not in any course stays a draft. Students are told when a published test is added to their course.">
          {data.courses.length ? data.courses.map(c => (
            <label key={c.id} className={`opt ${courseIds.includes(c.id) ? 'sel' : ''}`}>
              <input type="checkbox" checked={courseIds.includes(c.id)} onChange={e => toggle(courseIds, setCourseIds)(c.id, e.target.checked)} />
              <span style={{ flexGrow: 1 }}>{c.title}</span><span className="small muted">{c.students.length} students</span>
            </label>
          )) : <span className="muted small">No courses are assigned to you yet, so this test can only be saved as a draft.</span>}
        </Step>

        <div className="savebar">
          <Link to="/tests" className="btn btn-plain">Cancel</Link>
          {isDraft && <Btn v="ghost" type="button" disabled={busy} onClick={save(true)}>Save draft</Btn>}
          <Btn v="accent" disabled={busy}>{id && !t.draft ? 'Save changes' : 'Schedule test'}</Btn>
        </div>
      </form>
      {id && <TestSettings test={{ ...t, id }} bankIds={new Set(data.qs.map(q => q.id))} assigned={was.length} reload={reload} />}
    </div>
  );
}

// Force publish, force close and delete for one test. Shown at the bottom of the edit page.
function TestSettings({ test, bankIds, assigned, reload }) {
  const nav = useNavigate();
  const [ask, setAsk] = useState(null); // 'publish' | 'close' | 'delete'
  const draft = !!test.draft;
  const st = !draft && timed(test) ? windowOf(test) : null;
  const problems = readiness(test, bankIds, Date.now(), assigned);
  const change = (data, msg) => async () => { await updateDoc(doc(db, 'tests', test.id), { ...data, updatedAt: serverTimestamp() }); notify(msg); reload(); };
  return (
    <>
      <section className="card stack" style={{ gap: 14 }}>
        <h3 className="h3" style={{ fontSize: 18 }}>Test settings</h3>
        <span>Status: <b>{draft ? 'Draft' : st ? { soon: 'Scheduled', open: 'Open', closed: 'Closed' }[st] : 'No schedule'}</b></span>
        {!st && <p className="small muted" style={{ margin: 0 }}>{draft ? 'This test is a draft and students cannot see it. Fill in every detail above and press Schedule test to publish it.' : 'This test has no schedule, so it is open all the time. Set a publish time, end time and time limit above to schedule it.'}</p>}
        {st === 'soon' && (problems.length ? (
          <div className="warnbar" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}><b>Not ready to publish</b><ul style={{ margin: 0, paddingLeft: 18 }}>{problems.map(x => <li key={x}>{x}</li>)}</ul></div>
        ) : <span className="small muted">All required details are filled in. This test will open at {when(test.publishAt)}.</span>)}
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <Btn v="ink" disabled={st !== 'soon' || problems.length > 0} onClick={() => setAsk('publish')}>Force publish</Btn>
          <Btn v="ghost" disabled={st !== 'open'} onClick={() => setAsk('close')}>Force close</Btn>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Force publish opens a scheduled test right now. Force close stops anyone from starting it; students already taking it keep their remaining time.{st === 'closed' && ' This test is closed. Change the end time above to open it again.'}</p>
      </section>

      <section className="card stack" style={{ gap: 12, borderColor: 'var(--accent)' }}>
        <h3 className="h3" style={{ fontSize: 18, color: 'var(--accent-ink)' }}>Danger zone</h3>
        <div className="between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="stack" style={{ gap: 2, flex: '1 1 300px' }}>
            <b>Delete this test</b>
            <span className="small muted">{st === 'open' ? 'An open test cannot be deleted. Close it first with Force close, or wait for its end time.' : 'Students lose access to it. Submissions already made stay. This cannot be undone.'}</span>
          </div>
          <Btn v="accent" disabled={st === 'open'} onClick={() => setAsk('delete')}>Delete test</Btn>
        </div>
      </section>

      {ask === 'publish' && <Confirm v="ink" title="Publish this test now?" body={`Students in the courses it is assigned to can start "${test.title}" straight away, instead of at ${when(test.publishAt)}.`} label="Publish now" onYes={change({ publishAt: Date.now() - 6e4 }, 'Test published')} onClose={() => setAsk(null)} />}
      {ask === 'close' && <Confirm title="Close this test now?" body="Nobody will be able to start it any more. Students who already started keep their remaining time." label="Close now" onYes={change({ endAt: Date.now() }, 'Test closed')} onClose={() => setAsk(null)} />}
      {ask === 'delete' && <Confirm title={`Delete "${test.title}"?`} body="Students lose access to this test. Submissions already made stay. This cannot be undone." label="Delete test" onYes={async () => { await deleteDoc(doc(db, 'tests', test.id)); notify('Test deleted'); nav('/tests'); }} onClose={() => setAsk(null)} />}
    </>
  );
}

const state = t => (!timed(t) ? null : ({ soon: ['Scheduled', 'chip-amber'], open: ['Open', 'chip-green'], closed: ['Closed', 'chip-slate'] })[windowOf(t)]);

export function TestsPage() {
  const me = useMe();
  const [text, setText] = useState('');
  const none = { status: 'all', proc: 'all', lang: 'all', course: 'all', sort: 'new' };
  const [f, setF] = useState(none);
  const [data] = useLoad(async () => ({ courses: await list(query(collection(db, 'courses'), where('trainerId', '==', me.uid))), tests: await list(query(collection(db, 'tests'), where('authorId', '==', me.uid))), bank: new Set((await list(collection(db, 'questions'))).map(q => q.id)) }));
  if (!data) return <Loading />;
  const incomplete = t => t.draft || readiness(t, data.bank, 0, data.courses.filter(c => c.testIds?.includes(t.id)).length).length > 0; // missing a detail or not in any course
  const statusOf = t => (incomplete(t) ? 'draft' : windowOf(t));
  const inCourses = t => data.courses.filter(c => c.testIds?.includes(t.id)).length;
  const sorts = { new: (a, b) => createdOf(b) - createdOf(a), old: (a, b) => createdOf(a) - createdOf(b), upd: (a, b) => updatedOf(b) - updatedOf(a), title: (a, b) => a.title.localeCompare(b.title),
    opens: (a, b) => (a.publishAt || Infinity) - (b.publishAt || Infinity), ends: (a, b) => (a.endAt || Infinity) - (b.endAt || Infinity) };
  const shown = data.tests.filter(t => matches(`${t.title} ${testCode(t)} ${t.authorName || ''}`, text)
    && (f.status === 'all' || statusOf(t) === f.status) && (f.proc === 'all' || (f.proc === 'yes') === !!t.proctored) && (f.lang === 'all' || langsOf(t).includes(f.lang))
    && (f.course === 'all' || (f.course === 'none' ? inCourses(t) === 0 : data.courses.find(c => c.id === f.course)?.testIds?.includes(t.id)))).sort(sorts[f.sort]);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between">
        <p className="muted" style={{ margin: 0 }}>A test is a set of questions from the bank with a start time, an end time and a time limit.</p>
        <Link to="/tests/new" className="btn btn-ink"><Icon name="plus" size={18} />New test</Link>
      </div>
      {data.tests.length > 0 && <SearchBox label="Search tests" placeholder="Search by title, test ID or creator" value={text} onChange={setText} />}
      {data.tests.length > 0 && (
        <FilterBar changed={JSON.stringify(f) !== JSON.stringify(none)} onReset={() => setF(none)}>
          <Pick label="Status" value={f.status} onChange={v => setF({ ...f, status: v })} options={[['all', 'All statuses'], ['draft', 'Draft'], ['soon', 'Scheduled'], ['open', 'Open'], ['closed', 'Closed']]} />
          <Pick label="Proctoring" value={f.proc} onChange={v => setF({ ...f, proc: v })} options={[['all', 'Proctored or not'], ['yes', 'Proctored'], ['no', 'Not proctored']]} />
          <Pick label="Language" value={f.lang} onChange={v => setF({ ...f, lang: v })} options={[['all', 'Any language'], ...Object.entries(LANGS)]} />
          <Pick label="Course" value={f.course} onChange={v => setF({ ...f, course: v })} options={[['all', 'All courses'], ['none', 'Not in any course'], ...data.courses.map(c => [c.id, c.title])]} />
          <Pick label="Sort by" value={f.sort} onChange={v => setF({ ...f, sort: v })} options={[['new', 'Newest first'], ['old', 'Oldest first'], ['upd', 'Recently updated'], ['title', 'Title A to Z'], ['opens', 'Opens soonest'], ['ends', 'Last start soonest']]} />
        </FilterBar>
      )}
      {data.tests.length === 0 ? <Empty title="No tests yet" /> : !shown.length ? <Empty title="No tests match" body="Try a different word or reset the filters." /> : shown.map(t => {
        const st = incomplete(t) ? ['Draft', 'chip-gray'] : state(t); // a draft is missing required details
        return (
          <article key={t.id} className="card stack" style={{ gap: 14 }}>
            <div className="between" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 10, minWidth: 0 }}>
                <h2 className="h3" style={{ fontSize: 22 }}>{t.title}</h2>
                {st && <span className={`chip ${st[1]}`}>{st[0]}</span>}
                {t.proctored && <span className="chip chip-proctor"><Icon name="lock" size={14} />Proctored</span>}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className="chip mono" title="Test ID">{testCode(t)}</span>
                {t.authorId === me.uid && <Link to={`/tests/${t.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>}
              </div>
            </div>
            <div className="facts">
              {[['Questions', t.questionIds.length], ['Languages', langsOf(t).map(l => LANGS[l]).join(', ')], ['Time limit', t.durationMin ? `${t.durationMin} min` : null], ['Opens', t.publishAt ? when(t.publishAt) : null], ['Last start', t.endAt ? when(t.endAt) : null]].map(([k, v]) => (
                <div key={k} className="fact"><span className="small muted">{k}</span><b>{v ?? <span className="muted" style={{ fontWeight: 500 }}>Not set</span>}</b></div>
              ))}
            </div>
            <Meta items={[['Created by', t.authorName || me.name], ['Created', when(ms(t.createdAt) || madeUpTime(t.id))], ['Updated', when(ms(t.updatedAt) || ms(t.createdAt) || madeUpTime(t.id))]]} />
            {!timed(t) && !t.draft && <span className="small muted">Edit the test to add a schedule.</span>}
          </article>
        );
      })}
    </div>
  );
}
