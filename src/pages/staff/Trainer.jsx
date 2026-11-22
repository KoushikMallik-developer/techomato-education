import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, query, serverTimestamp, where } from 'firebase/firestore';
import { db, forgetQuestions, list } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { Btn, CourseGrid, ENV_LABEL, Empty, STARTERS, Field, Icon, Loading, attempt, notify, useBusy, useLoad } from '../../ui.jsx';

const blank = { input: '', output: '', expr: '', desc: '', hidden: false };

const remove = (col, item, reload) => confirm(`Delete "${item.title}"? Tests that use it will lose it.`) && attempt(async () => { await deleteDoc(doc(db, col, item.id)); if (col === 'questions') forgetQuestions(); notify('Deleted'); reload(); });

export function TrainerCourses() {
  const me = useMe();
  const [courses] = useLoad(() => list(query(collection(db, 'courses'), where('trainerId', '==', me.uid))));
  if (!courses) return <Loading />;
  return <CourseGrid courses={courses} empty="No courses assigned to you yet" />;
}

function QuestionForm({ onSaved }) {
  const me = useMe();
  const [env, setEnv] = useState('python');
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [diff, setDiff] = useState('Easy');
  const [topic, setTopic] = useState('');
  const [starter, setStarter] = useState(STARTERS.python);
  const [tests, setTests] = useState([{ ...blank }]);
  const web = env === 'web';
  const [busy, run] = useBusy();
  const pickEnv = v => { setEnv(v); setStarter(STARTERS[v]); setTests([{ ...blank }]); };
  const edit = (i, patch) => setTests(tests.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const save = e => {
    e.preventDefault();
    run(async () => {
      const ok = tests.filter(t => (web ? t.expr.trim() : t.output.trim()));
      if (!ok.length) throw new Error('Add at least one complete test case');
      await addDoc(collection(db, 'questions'), { title, statement, env, starter, diff, topic: topic.trim(), tests: ok, authorId: me.uid, createdAt: serverTimestamp() });
      forgetQuestions();
      notify('Saved to the question bank');
      onSaved();
    });
  };
  return (
    <form className="card stack" style={{ gap: 16 }} onSubmit={save}>
      <div className="stack" style={{ gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Environment</span>
        <div className="seg">
          {Object.entries(ENV_LABEL).map(([k, l]) => <button type="button" key={k} aria-pressed={env === k} onClick={() => pickEnv(k)}>{l}</button>)}
          <button type="button" disabled title="Needs a server runner">Java (soon)</button>
        </div>
      </div>
      <Field label="Title"><input className="input" required value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <div className="grid g2">
        <Field label="Difficulty"><select className="input" value={diff} onChange={e => setDiff(e.target.value)}>{['Easy', 'Medium', 'Hard'].map(x => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Topic (optional)"><input className="input" placeholder="e.g. Strings" value={topic} onChange={e => setTopic(e.target.value)} /></Field>
      </div>
      <Field label="Problem statement"><textarea className="input" rows={4} required value={statement} onChange={e => setStatement(e.target.value)} /></Field>
      <Field label="Starter code"><textarea className="input mono" rows={5} value={starter} onChange={e => setStarter(e.target.value)} /></Field>
      <div className="stack" style={{ gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Test cases</span>
        {web && <span className="small muted">Each test is a JavaScript expression run against the student's page. It must be truthy, e.g. <span className="mono">document.querySelector('h1').textContent === 'Hello'</span></span>}
        {tests.map((t, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {web ? (
              <>
                <input className="input" style={{ flex: '1 1 200px' }} placeholder="Description shown to the student" value={t.desc} onChange={e => edit(i, { desc: e.target.value })} />
                <input className="input mono" style={{ flex: '2 1 260px' }} placeholder="JS expression" value={t.expr} onChange={e => edit(i, { expr: e.target.value })} />
              </>
            ) : (
              <>
                <textarea className="input mono" style={{ flex: '1 1 200px' }} rows={2} placeholder="Input (stdin)" value={t.input} onChange={e => edit(i, { input: e.target.value })} />
                <textarea className="input mono" style={{ flex: '1 1 200px' }} rows={2} placeholder="Expected output" value={t.output} onChange={e => edit(i, { output: e.target.value })} />
              </>
            )}
            <label className="row small" style={{ gap: 6, minHeight: 44 }}><input type="checkbox" checked={t.hidden} onChange={e => edit(i, { hidden: e.target.checked })} />Hidden</label>
            <button type="button" className="icon-btn" aria-label="Remove test case" onClick={() => setTests(tests.filter((_, j) => j !== i))}><Icon name="x" size={18} /></button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setTests([...tests, { ...blank }])}><Icon name="plus" size={16} />Test case</button>
      </div>
      <div><Btn v="accent" disabled={busy}>Save to question bank</Btn></div>
    </form>
  );
}

export function Questions() {
  const me = useMe();
  const [qs, reload] = useLoad(() => list(collection(db, 'questions')));
  const [open, setOpen] = useState(false);
  if (!qs) return <Loading />;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between">
        <p className="muted" style={{ margin: 0 }}>Questions you write here can be added to any test.</p>
        <button className="btn btn-ink" onClick={() => setOpen(!open)}><Icon name="plus" size={18} />{open ? 'Close' : 'New question'}</button>
      </div>
      {open && <QuestionForm onSaved={() => { setOpen(false); reload(); }} />}
      {qs.length === 0 ? <Empty title="The question bank is empty" body="Add your first question to start building tests." /> : (
        <div className="card" style={{ padding: 6 }}>
          {qs.map(q => (
            <div key={q.id} className="between" style={{ padding: 12 }}>
              <b>{q.title}</b>
              <span className="row small"><span className="chip">{ENV_LABEL[q.env]}</span><span className="muted">{q.tests.length} test cases</span>
                {(q.authorId === me.uid || me.role === 'admin') && <button className="icon-btn" aria-label={`Delete ${q.title}`} onClick={() => remove('questions', q, reload)}><Icon name="trash" size={16} /></button>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TestsPage() {
  const me = useMe();
  const [data, reload] = useLoad(async () => ({ qs: await list(collection(db, 'questions')), tests: await list(collection(db, 'tests')) }));
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState([]);
  const [proctored, setProctored] = useState(false);
  const [busy, run] = useBusy();
  if (!data) return <Loading />;
  const save = e => {
    e.preventDefault();
    run(async () => {
      if (!picked.length) throw new Error('Choose at least one question');
      await addDoc(collection(db, 'tests'), { title, questionIds: picked, proctored, authorId: me.uid, createdAt: serverTimestamp() });
      setTitle(''); setPicked([]); setProctored(false); setOpen(false);
      notify('Test created. Assign it from a course page.');
      reload();
    });
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between">
        <p className="muted" style={{ margin: 0 }}>A test is a set of questions from the bank. Assign it to a course from the course page.</p>
        <button className="btn btn-ink" onClick={() => setOpen(!open)}><Icon name="plus" size={18} />{open ? 'Close' : 'New test'}</button>
      </div>
      {open && (
        <form className="card stack" style={{ gap: 16 }} onSubmit={save}>
          <Field label="Title"><input className="input" required value={title} onChange={e => setTitle(e.target.value)} /></Field>
          <div className="stack" style={{ gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Pick questions from the bank</span>
            {data.qs.length ? data.qs.map(q => {
              const on = picked.includes(q.id);
              return (
                <label key={q.id} className={`opt ${on ? 'sel' : ''}`}>
                  <input type="checkbox" checked={on} onChange={e => setPicked(e.target.checked ? [...picked, q.id] : picked.filter(x => x !== q.id))} />
                  <span style={{ flexGrow: 1 }}>{q.title}</span><span className="chip">{ENV_LABEL[q.env]}</span>
                </label>
              );
            }) : <span className="muted small">Add questions to the bank first.</span>}
          </div>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={proctored} onChange={e => setProctored(e.target.checked)} /><span><b>Proctored</b> <span className="small muted">(fullscreen, camera photos each minute, tab switches and paste attempts are recorded)</span></span></label>
          <div><Btn v="accent" disabled={busy}>Create test</Btn></div>
        </form>
      )}
      {data.tests.length === 0 ? <Empty title="No tests yet" /> : data.tests.map(t => (
        <article key={t.id} className="card between">
          <h2 className="h3" style={{ fontSize: 22 }}>{t.title}{t.proctored && <span className="chip chip-warn" style={{ marginLeft: 10 }}>Proctored</span>}</h2>
          <span className="row"><span className="small muted">{t.questionIds.length} questions</span>
            {(t.authorId === me.uid || me.role === 'admin') && <button className="icon-btn" aria-label={`Delete ${t.title}`} onClick={() => remove('tests', t, reload)}><Icon name="trash" size={16} /></button>}</span>
        </article>
      ))}
    </div>
  );
}
