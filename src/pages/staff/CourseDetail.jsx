import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { db, list, listIn, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { scoreTable } from '../../score.js';
import { KIND_LABEL } from '../../proctor.js';
import { Avatar, Btn, CodeBlock, Empty, Icon, Loading, Modal, attempt, notify, useBusy, useLoad } from '../../ui.jsx';

// Staff view of a course. Admin: enroll students (and record the payment). Trainer: assign tests and read results.
export default function CourseDetail() {
  const { id } = useParams();
  const me = useMe();
  const nav = useNavigate();
  const [pick, setPick] = useState('');
  const [amount, setAmount] = useState('');
  const [view, setView] = useState(null); // {student, test}
  const [busy, run] = useBusy();
  // big lists load once per visit; only the course and its submissions reload after an enroll/assign
  const [lists] = useLoad(async () => {
    const [users, tests, qs] = await Promise.all([list(collection(db, 'users')), list(collection(db, 'tests')), questions()]);
    return { users, tests, qs, caseCount: Object.fromEntries(qs.map(q => [q.id, q.tests.length])) };
  }, [id]);
  const [cur, reload] = useLoad(async () => {
    const snap = await getDoc(doc(db, 'courses', id));
    if (!snap.exists()) return { gone: true };
    const course = { id, ...snap.data() };
    const byTest = col => listIn(course.testIds, ids => query(collection(db, col), where('testId', 'in', ids)));
    return { course, subs: await byTest('submissions'), flags: await byTest('proctor') }; // flags: small proctoring events; the photos load only when a result is opened
  }, [id]);
  const d = lists && cur && { ...lists, ...cur };
  if (!d) return <Loading />;
  if (d.gone) return <Empty title="Course not found" action={<Link to="/" className="btn btn-ink">Back</Link>} />;

  const { course, users, tests, qs, caseCount, subs, flags } = d;
  const flagsOf = (uid, tid) => flags.filter(f => f.userId === uid && f.testId === tid);
  const admin = me.role === 'admin';
  const enrolled = users.filter(u => course.students.includes(u.id));
  const assigned = course.testIds.map(t => tests.find(x => x.id === t)).filter(Boolean);
  const rows = scoreTable(enrolled, assigned, caseCount, subs);
  const options = admin
    ? users.filter(u => u.role === 'student' && !course.students.includes(u.id)).map(u => [u.id, u.name])
    : tests.filter(t => !course.testIds.includes(t.id)).map(t => [t.id, t.title]);
  // one batch = all writes land or none do (no enrolled-but-unpaid students)
  const commit = (msg, build) => run(async () => {
    const b = writeBatch(db);
    b.update(doc(db, 'courses', id), build.data);
    build.extra?.(b);
    await b.commit();
    await build.after?.();
    setPick(''); setAmount(''); notify(msg); reload();
  });
  const ping = (b, ids, text) => ids.forEach(userId => b.set(doc(collection(db, 'notifications')), { userId, text, link: `/course/${id}`, read: false, at: Date.now() }));
  const enroll = () => {
    const student = users.find(u => u.id === pick), paid = Number(amount) || 0;
    commit('Student enrolled', { data: { students: arrayUnion(pick) }, extra: b => {
      if (paid > 0) b.set(doc(collection(db, 'payments')), { userId: pick, userName: student.name, courseId: id, courseTitle: course.title, amount: paid, at: Date.now() });
      ping(b, [pick], `You were enrolled in ${course.title}`);
    } });
  };
  const assign = () => {
    const text = `New test in ${course.title}: ${tests.find(t => t.id === pick)?.title}`, rest = course.students.slice(450);
    // a batch holds 500 writes: course update + 450 notifications here, any more students are notified in follow-up batches
    commit('Test assigned', { data: { testIds: arrayUnion(pick) }, extra: b => ping(b, course.students.slice(0, 450), text), after: async () => {
      for (let i = 0; i < rest.length; i += 450) { const b = writeBatch(db); ping(b, rest.slice(i, i + 450), text); await b.commit(); }
    } });
  };
  const del = () => confirm(`Delete "${course.title}"? Students lose access. Submissions are kept.`) && attempt(async () => { await deleteDoc(doc(db, 'courses', id)); notify('Course deleted'); nav('/' + (admin ? 'courses' : '')); });
  const scored = rows.flatMap(r => r.cells).filter(Boolean);
  const avg = scored.length ? Math.round(scored.reduce((n, c) => n + (c.total ? (100 * c.passed) / c.total : 0), 0) / scored.length) : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between">
        <Link to={admin ? '/courses' : '/'} className="row small" style={{ gap: 4, fontWeight: 600, textDecoration: 'none' }}><Icon name="back" size={16} />All courses</Link>
        {admin && <button className="btn btn-plain btn-sm" onClick={del}><Icon name="trash" size={16} />Delete course</button>}
      </div>
      <div className="card grid split" style={{ gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)', gap: 28, alignItems: 'center' }}>
        <div className="stack" style={{ gap: 12 }}>
          <span className="chip" style={{ alignSelf: 'flex-start' }}>Trainer: {course.trainerName}</span>
          <h2 className="h2" style={{ fontSize: 40 }}>{course.title}</h2>
          <p className="ink2" style={{ margin: 0, fontSize: 17 }}>{course.description}</p>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          {[[enrolled.length, 'Students'], [assigned.length, 'Tests'], [avg === null ? '—' : avg + '%', 'Average score'], [scored.length, 'Test results']].map(([n, l]) => (
            <div key={l} style={{ background: 'var(--paper)', borderRadius: 14, padding: 16 }}>
              <div className="big" style={{ fontSize: 30 }}>{n}</div><div className="small muted">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="card stack" style={{ gap: 12 }}>
        <h3 className="h3" style={{ fontSize: 20 }}>{admin ? 'Enroll a student (after payment)' : 'Assign a test to this course'}</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <select className="input" style={{ maxWidth: 320 }} value={pick} onChange={e => setPick(e.target.value)} aria-label="Choose">
            <option value="">Select…</option>
            {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          {admin && <input className="input" style={{ maxWidth: 180 }} type="number" min="0" placeholder="Amount paid (₹)" aria-label="Amount paid" value={amount} onChange={e => setAmount(e.target.value)} />}
          <Btn v="accent" disabled={!pick || busy} onClick={() => (admin ? enroll() : assign())}>{admin ? 'Enroll' : 'Assign'}</Btn>
        </div>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <h3 className="h3" style={{ fontSize: 20 }}>Results</h3>
        {!enrolled.length ? <Empty title="No students enrolled yet" /> : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr><th>Student</th>{assigned.map(t => <th key={t.id}>{t.title}</th>)}{admin && <th />}</tr>
              </thead>
              <tbody>
                {rows.map(({ student, cells }) => (
                  <tr key={student.id}>
                    <td><span className="row" style={{ gap: 10 }}><Avatar name={student.name} size={32} /><span className="stack"><b>{student.name}</b><span className="tiny muted">{student.email}</span></span></span></td>
                    {cells.map((c, i) => {
                      const pct = c && c.total ? Math.round((100 * c.passed) / c.total) : 0;
                      return (
                        <td key={i}>
                          {c ? <button className={`chip ${pct >= 60 ? 'chip-pass' : 'chip-warn'}`} style={{ border: 0 }} title="View submissions" onClick={() => setView({ student, test: assigned[i] })}>{c.passed}/{c.total} · {pct}%</button> : <span className="small muted">Not attempted</span>}
                          {assigned[i].proctored && (() => { const ev = flagsOf(student.id, assigned[i].id), n = ev.filter(e => e.kind !== 'start').length; return ev.length > 0 && <button className={`chip ${n ? 'chip-warn' : 'chip-pass'}`} style={{ border: 0, marginLeft: 6 }} title="View proctoring evidence" onClick={() => setView({ student, test: assigned[i] })}>{n ? `${n} flags` : 'No flags'}</button>; })()}
                        </td>
                      );
                    })}
                    {admin && <td><button className="btn btn-plain btn-sm" onClick={() => commit('Student removed', { data: { students: arrayRemove(student.id) } })}>Remove</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {enrolled.length > 0 && !assigned.length && <p className="small muted" style={{ margin: 0 }}>No tests assigned yet.</p>}
      </section>

      {view && (
        <Modal onClose={() => setView(null)}>
          <div style={{ maxHeight: '75vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 className="h3" style={{ fontSize: 24 }}>{view.student.name}, {view.test.title}</h2>
            {view.test.proctored && <Proctoring uid={view.student.id} test={view.test} events={flagsOf(view.student.id, view.test.id)} />}
            {view.test.questionIds.map(qid => {
              const q = qs.find(x => x.id === qid);
              const s = subs.find(x => x.userId === view.student.id && x.testId === view.test.id && x.questionId === qid);
              return (
                <div key={qid} className="stack" style={{ gap: 6 }}>
                  <div className="between"><b>{q ? q.title : 'Removed question'}</b>{s ? <span className={`chip ${s.passed === s.total ? 'chip-pass' : 'chip-warn'}`}>{s.passed}/{s.total}</span> : <span className="small muted">Not attempted</span>}</div>
                  {s && <CodeBlock code={s.code} />}
                </div>
              );
            })}
          </div>
          <button className="btn btn-ink" style={{ alignSelf: 'flex-end' }} onClick={() => setView(null)}>Close</button>
        </Modal>
      )}
    </div>
  );
}

// Proctoring evidence for one student on one test: the event log and the webcam photos.
function Proctoring({ uid, test, events }) {
  const [snaps] = useLoad(() => list(query(collection(db, 'snaps'), where('userId', '==', uid), where('testId', '==', test.id))), [uid, test.id]);
  const sorted = [...events].sort((a, b) => a.at - b.at);
  const photos = snaps && [...snaps].sort((a, b) => a.at - b.at);
  return (
    <section className="stack" style={{ gap: 8, background: 'var(--paper)', borderRadius: 14, padding: 14 }}>
      <b>Proctoring</b>
      {sorted.length === 0 ? <span className="small muted">No flags recorded.</span> : (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{sorted.map(e => <li key={e.id}>{new Date(e.at).toLocaleTimeString()}: {KIND_LABEL[e.kind] || e.kind}</li>)}</ul>
      )}
      {!photos ? <span className="small muted">Loading photos…</span> : photos.length === 0 ? <span className="small muted">No camera photos.</span> : (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {photos.map(p => <img key={p.id} src={p.img} width={120} height={90} alt={`Camera photo at ${new Date(p.at).toLocaleTimeString()}`} title={new Date(p.at).toLocaleTimeString()} style={{ borderRadius: 8, objectFit: 'cover' }} />)}
        </div>
      )}
    </section>
  );
}
