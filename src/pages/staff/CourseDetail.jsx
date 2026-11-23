import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { db, list, listIn, questions } from '../../firebase.js';
import { courseCode, when } from '../../schedule.js';
import { useMe } from '../../auth.jsx';
import { histogram, inCourse, joinSeries, lastWeeks, perWeek, scoreTable } from '../../score.js';
import { BarChart, ChartCard, LineChart } from '../../Charts.jsx';
import { KIND_LABEL } from '../../proctor.js';
import { Avatar, Btn, CodeBlock, Empty, Icon, Loading, Modal, attempt, notify, useBusy, useLoad } from '../../ui.jsx';

// Staff view of a course: enrolled students and course analytics. Admin also enrolls students (and records the payment). Per-student results live on the Results page.
export default function CourseDetail() {
  const { id } = useParams();
  const me = useMe();
  const nav = useNavigate();
  const [pick, setPick] = useState('');
  const [closing, setClosing] = useState(false); // confirmation dialog for marking the course completed or reopening it
  const [amount, setAmount] = useState('');
  const [busy, run] = useBusy();
  const [lists] = useLoad(async () => {
    const [users, tests, qs] = await Promise.all([list(collection(db, 'users')), list(collection(db, 'tests')), questions()]);
    return { users, tests, caseCount: Object.fromEntries(qs.map(q => [q.id, q.tests.length])) };
  }, [id]);
  const [cur, reload] = useLoad(async () => {
    const snap = await getDoc(doc(db, 'courses', id));
    if (!snap.exists()) return { gone: true };
    const course = { id, ...snap.data() };
    return { course, subs: await listIn(course.testIds, ids => query(collection(db, 'submissions'), where('testId', 'in', ids))).then(a => a.filter(s => inCourse(s, id))) };
  }, [id]);
  const d = lists && cur && { ...lists, ...cur };
  if (!d) return <Loading />;
  if (d.gone) return <Empty title="Course not found" action={<Link to="/" className="btn btn-ink">Back</Link>} />;

  const { course, users, tests, caseCount, subs } = d;
  const admin = me.role === 'admin';
  if (!admin && course.trainerId !== me.uid) { // another trainer's course: overview only, no student results or controls
    return (
      <div className="stack" style={{ gap: 20 }}>
        <Link to="/" className="row small" style={{ gap: 4, fontWeight: 600, textDecoration: 'none' }}><Icon name="back" size={16} />All courses</Link>
        <div className="card stack" style={{ gap: 12 }}>
          <span className="chip" style={{ alignSelf: 'flex-start' }}>Trainer: {course.trainerName}</span>
          <h2 className="h2" style={{ fontSize: 40 }}>{course.title}</h2>
          <span className="small muted">Course ID <b className="mono">{courseCode(course)}</b></span>
          <p className="ink2" style={{ margin: 0, fontSize: 17 }}>{course.description}</p>
          <p className="small muted" style={{ margin: 0 }}>{course.students.length} students, {course.testIds.length} tests. Only the course's own trainer can see results.</p>
        </div>
      </div>
    );
  }
  const enrolled = users.filter(u => course.students.includes(u.id));
  const joinedAt = uid => (course.joins || []).find(j => j.uid === uid)?.at; // missing for students enrolled before joins were logged
  const assigned = course.testIds.map(t => tests.find(x => x.id === t)).filter(t => t && (admin || t.authorId === me.uid)); // a trainer sees the tests he wrote
  const rows = scoreTable(enrolled, assigned, caseCount, subs);
  const options = users.filter(u => u.role === 'student' && !course.students.includes(u.id)).map(u => [u.id, u.name]);
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
    commit('Student enrolled', { data: { students: arrayUnion(pick), joins: arrayUnion({ uid: pick, at: Date.now() }) }, extra: b => {
      if (paid > 0) b.set(doc(collection(db, 'payments')), { userId: pick, userName: student.name, courseId: id, courseTitle: course.title, amount: paid, at: Date.now() });
      ping(b, [pick], `You were enrolled in ${course.title}`);
    } });
  };
  const scored = rows.flatMap(r => r.cells).filter(Boolean);
  const avg = scored.length ? Math.round(scored.reduce((n, c) => n + (c.total ? (100 * c.passed) / c.total : 0), 0) / scored.length) : null;
  const del = () => confirm(`Delete "${course.title}"? Students lose access. Submissions are kept.`) && attempt(async () => { await deleteDoc(doc(db, 'courses', id)); notify('Course deleted'); nav('/' + (admin ? 'courses' : '')); });
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between">
        <Link to={admin ? '/courses' : '/'} className="row small" style={{ gap: 4, fontWeight: 600, textDecoration: 'none' }}><Icon name="back" size={16} />All courses</Link>
        {admin && <button className="btn btn-plain btn-sm" onClick={del}><Icon name="trash" size={16} />Delete course</button>}
      </div>
      <div className="card grid split" style={{ gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)', gap: 28, alignItems: 'center' }}>
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span className="chip">Trainer: {course.trainerName}</span>
            {course.completed && <span className="chip chip-pass"><Icon name="check" size={14} stroke={2.4} />Completed</span>}
          </div>
          <h2 className="h2" style={{ fontSize: 40 }}>{course.title}</h2>
          <span className="small muted">Course ID <b className="mono">{courseCode(course)}</b></span>
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

      <Analytics course={course} rows={rows} assigned={assigned} subs={subs} />

      {admin && (
        <section className="card stack" style={{ gap: 12 }}>
          <h3 className="h3" style={{ fontSize: 20 }}>Enroll a student (after payment)</h3>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <select className="input" style={{ maxWidth: 320 }} value={pick} onChange={e => setPick(e.target.value)} aria-label="Choose a student">
              <option value="">Select…</option>
              {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <input className="input" style={{ maxWidth: 180 }} type="number" min="0" placeholder="Amount paid (₹)" aria-label="Amount paid" value={amount} onChange={e => setAmount(e.target.value)} />
            <Btn v="accent" disabled={!pick || busy} onClick={enroll}>Enroll</Btn>
          </div>
        </section>
      )}

      <section className="card stack" style={{ gap: 12 }}>
        <h3 className="h3" style={{ fontSize: 20 }}>Enrolled students</h3>
        {!enrolled.length ? <Empty title="No students enrolled yet" /> : (
          <div className="scroll-x">
            <table>
              <thead><tr><th>Student</th><th>Enrolled on</th><th>Tests taken</th><th>Average score</th><th>Last active</th>{admin && <th />}</tr></thead>
              <tbody>
                {[...enrolled].sort((a, b) => (joinedAt(b.id) || 0) - (joinedAt(a.id) || 0)).map(student => {
                  const got = rows.find(r => r.student.id === student.id).cells.filter(Boolean);
                  const mean = got.length ? Math.round(got.reduce((n, c) => n + (c.total ? (100 * c.passed) / c.total : 0), 0) / got.length) : null;
                  const last = Math.max(0, ...subs.filter(x => x.userId === student.id).map(x => ms(x.at) || 0));
                  return (
                  <tr key={student.id}>
                    <td><span className="row" style={{ gap: 10 }}><Avatar name={student.name} size={32} /><span className="stack"><b>{student.name}</b><span className="tiny muted">{student.email}</span></span></span></td>
                    <td>{joinedAt(student.id) ? when(joinedAt(student.id)) : <span className="small muted">Not recorded</span>}</td>
                    <td>{got.length} of {assigned.length}</td>
                    <td>{mean === null ? <span className="small muted">None yet</span> : <span className={`chip ${mean >= 60 ? 'chip-pass' : 'chip-warn'}`}>{mean}%</span>}</td>
                    <td>{last ? when(last) : <span className="small muted">Never</span>}</td>
                    {admin && <td><button className="btn btn-plain btn-sm" onClick={() => commit('Student removed', { data: { students: arrayRemove(student.id) } })}>Remove</button></td>}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack" style={{ gap: 10, borderColor: course.completed ? undefined : 'var(--warn)' }}>
        <h3 className="h3" style={{ fontSize: 18 }}>Course status</h3>
        <p className="small muted" style={{ margin: 0 }}>
          {course.completed ? 'This course is marked completed. Students see it under Completed courses.' : 'Mark the course completed only when it has really finished. Students will move it from Joined to Completed courses and be notified.'}
        </p>
        <div><Btn v="ghost" className="btn-sm" disabled={busy} onClick={() => setClosing(true)}>{course.completed ? 'Reopen course…' : 'Mark course completed…'}</Btn></div>
      </section>

      {closing && (
        <Modal onClose={() => setClosing(false)}>
          <h2 className="h3" style={{ fontSize: 24 }}>{course.completed ? 'Reopen this course?' : 'Mark this course as completed?'}</h2>
          <p className="ink2" style={{ margin: 0 }}>
            {course.completed
              ? `${course.title} will move back to Joined courses for its ${course.students.length} students, and they will be notified.`
              : `${course.title} will move to Completed courses for its ${course.students.length} students, and they will be notified. Only do this when the course has finished. You can reopen it later.`}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Btn v="ghost" onClick={() => setClosing(false)}>Cancel</Btn>
            <Btn v={course.completed ? 'ink' : 'accent'} disabled={busy} onClick={() => commit(course.completed ? 'Course reopened' : 'Course marked completed', { data: { completed: !course.completed }, extra: b => ping(b, course.students.slice(0, 450), course.completed ? `${course.title} was reopened` : `${course.title} was marked completed`), after: () => setClosing(false) })}>{course.completed ? 'Yes, reopen' : 'Yes, mark completed'}</Btn>
          </div>
        </Modal>
      )}

    </div>
  );
}

// One student's answers (and proctoring evidence) for one test, in a dialog.
export function ResultModal({ courseId, student, test, qs, subs, onClose }) {
  return (
  <Modal onClose={onClose}>
      <div style={{ maxHeight: '75vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 className="h3" style={{ fontSize: 24 }}>{student.name}, {test.title}</h2>
        {test.proctored && <Proctoring uid={student.id} courseId={courseId} test={test} />}
        {test.questionIds.map(qid => {
          const q = qs.find(x => x.id === qid);
          const s = subs.find(x => x.userId === student.id && x.testId === test.id && x.questionId === qid);
          return (
            <div key={qid} className="stack" style={{ gap: 6 }}>
              <div className="between"><b>{q ? q.title : 'Removed question'}</b>{s ? <span className="row" style={{ gap: 6 }}>{s.auto && <span className="chip chip-warn">Auto-submitted, not answered</span>}<span className={`chip ${s.passed === s.total ? 'chip-pass' : 'chip-warn'}`}>{s.passed}/{s.total}</span></span> : <span className="small muted">Not attempted</span>}</div>
              {s && <CodeBlock code={s.code} />}
            </div>
          );
        })}
      </div>
      <button className="btn btn-ink" style={{ alignSelf: 'flex-end' }} onClick={() => onClose()}>Close</button>
    </Modal>
  );
}

// Proctoring evidence for one student on one test: the event log and the webcam photos.
function Proctoring({ uid, courseId, test }) {
  const [events] = useLoad(() => list(query(collection(db, 'proctor'), where('userId', '==', uid), where('courseId', '==', courseId), where('testId', '==', test.id))), [uid, courseId, test.id]);
  const [snaps] = useLoad(() => list(query(collection(db, 'snaps'), where('userId', '==', uid), where('courseId', '==', courseId), where('testId', '==', test.id))), [uid, courseId, test.id]);
  const sorted = events && [...events].sort((a, b) => a.at - b.at);
  const photos = snaps && [...snaps].sort((a, b) => a.at - b.at);
  return (
    <section className="stack" style={{ gap: 8, background: 'var(--paper)', borderRadius: 14, padding: 14 }}>
      <b>Proctoring</b>
      {!sorted ? <span className="small muted">Loading log…</span> : sorted.length === 0 ? <span className="small muted">Nothing recorded.</span> : (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{sorted.map(e => <li key={e.id}>{new Date(e.at).toLocaleTimeString()}: {KIND_LABEL[e.kind] || e.kind}{e.detail && ` (${e.detail})`}</li>)}</ul>
      )}
      {!photos ? <span className="small muted">Loading photos…</span> : photos.length === 0 ? <span className="small muted">No camera photos.</span> : (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {photos.map(p => <img key={p.id} src={p.img} width={120} height={90} alt={`Camera photo at ${new Date(p.at).toLocaleTimeString()}`} title={`${new Date(p.at).toLocaleTimeString()}${p.reason ? `: ${KIND_LABEL[p.reason] || p.reason}` : ''}`} style={{ borderRadius: 8, objectFit: 'cover' }} />)}
        </div>
      )}
    </section>
  );
}

const ms = t => t?.toMillis?.() ?? t; // Firestore timestamp or plain number
const dayLabel = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// How the course is doing: enrolment over time, how scores are spread, which tests students take, and weekly activity.
function Analytics({ course, rows, assigned, subs }) {
  const weeks = lastWeeks(8), labels = weeks.map(dayLabel);
  const joins = joinSeries((course.joins || []).map(j => j.at), course.students.length, 8);
  const active = perWeek(subs.map(s => ms(s.at)), 8);
  const pct = c => (c.total ? (100 * c.passed) / c.total : 0);
  const perStudent = rows.map(r => r.cells.filter(Boolean)).filter(c => c.length).map(c => c.reduce((n, x) => n + pct(x), 0) / c.length);
  const spread = histogram(perStudent);
  const tests = assigned.map((t, i) => {
    const got = rows.map(r => r.cells[i]).filter(Boolean);
    return { title: t.title, tried: got.length, avg: got.length ? Math.round(got.reduce((n, x) => n + pct(x), 0) / got.length) : 0 };
  });
  const enrolled = course.students.length;
  return (
    <section className="stack" style={{ gap: 16 }} aria-label="Course performance">
      <h3 className="h3" style={{ fontSize: 22 }}>How this course is doing</h3>
      <div className="grid g2">
        <ChartCard title="Students joined" hint="Total enrolled at the end of each week. Students enrolled before joins were logged count from the start.">
          <LineChart data={joins.map((value, i) => ({ label: labels[i], value }))} label="Students enrolled by week" />
        </ChartCard>
        <ChartCard title="Test activity" hint="Submissions per week, all tests.">
          <BarChart data={active.map((value, i) => ({ label: labels[i], value }))} label="Submissions per week" color="var(--accent)" />
        </ChartCard>
        <ChartCard title="Student results" hint={perStudent.length ? `Students by their average score (${perStudent.length} of ${enrolled} have taken a test).` : 'Nobody has taken a test yet.'}>
          <BarChart data={['0-19%', '20-39%', '40-59%', '60-79%', '80-100%'].map((label, i) => ({ label, value: spread[i] }))} label="Students by average score" color="var(--pass-strong)" />
        </ChartCard>
        <ChartCard title="Tests" hint="How many students took each test, and their average score.">
          {tests.length === 0 ? <p className="muted" style={{ margin: 0 }}>No tests assigned yet.</p> : (
            <div className="stack" style={{ gap: 14 }}>
              {tests.map(t => (
                <div key={t.title} className="stack" style={{ gap: 6 }}>
                  <div className="between small"><b>{t.title}</b><span className="muted">{t.tried}/{enrolled} took it · avg {t.avg}%</span></div>
                  <div className="bar" aria-hidden="true"><span style={{ width: `${enrolled ? (100 * t.tried) / enrolled : 0}%`, background: 'var(--accent)' }} /></div>
                  <div className="bar" aria-hidden="true"><span style={{ width: `${t.avg}%`, background: 'var(--pass-strong)' }} /></div>
                </div>
              ))}
              <p className="small muted" style={{ margin: 0 }}><span style={{ color: 'var(--accent)' }}>■</span> took the test &nbsp; <span style={{ color: 'var(--pass-strong)' }}>■</span> average score</p>
            </div>
          )}
        </ChartCard>
      </div>
    </section>
  );
}
