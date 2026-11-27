import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { db, list, listIn, questions } from '../../firebase.js';
import { courseCode, when } from '../../schedule.js';
import { useMe } from '../../auth.jsx';
import { averageScore, histogram, inCourse, joinSeries, lastWeeks, perWeek, scoreTable } from '../../score.js';
import { BarChart, ChartCard, LineChart } from '../../Charts.jsx';
import { Confirm } from './trainerShared.jsx';
import { KIND_LABEL } from '../../proctor.js';
import { Avatar, Btn, CodeBlock, Empty, Icon, Loading, Modal, notify, useBusy, useLoad, btn, Card, Chip, Bar, H2, H3, Input, Back, PageHero } from '../../ui.jsx';

// Staff view of a course: enrolled students and course analytics. Admin also enrolls students (courses are free; payments are only for Pro). Per-student results live on the Results page.
export default function CourseDetail() {
  const { id } = useParams();
  const me = useMe();
  const nav = useNavigate();
  const [pick, setPick] = useState('');
  const [ask, setAsk] = useState(null); // { title, body, label, onYes } for the confirmation dialog
  const [closing, setClosing] = useState(false); // confirmation dialog for marking the course completed or reopening it
  const [busy, run] = useBusy();
  const [cur, reload] = useLoad(async () => {
    const snap = await getDoc(doc(db, 'courses', id));
    if (!snap.exists()) return { gone: true };
    const course = { id, ...snap.data() };
    const get = (col, ids) => Promise.all(ids.map(x => getDoc(doc(db, col, x)))).then(a => a.filter(x => x.exists()).map(x => ({ id: x.id, ...x.data() })));
    // the admin picks students from everyone; a trainer needs only the enrolled ones and this course's tests
    const [users, tests, qs, subs] = await Promise.all([
      me.role === 'admin' ? list(collection(db, 'users')) : get('users', course.students), get('tests', course.testIds), questions(),
      listIn(course.testIds, ids => query(collection(db, 'submissions'), where('testId', 'in', ids))).then(a => a.filter(s => inCourse(s, id))),
    ]);
    return { course, users, tests, caseCount: Object.fromEntries(qs.map(q => [q.id, q.tests.length])), subs };
  }, [id]);
  const d = cur;
  if (!d) return <Loading />;
  if (d.gone) return <Empty title="Course not found" action={<Link to="/courses" className={btn('ink')}>Back</Link>} />;

  const { course, users, tests, caseCount, subs } = d;
  const admin = me.role === 'admin';
  if (!admin && course.trainerId !== me.uid) { // another trainer's course: overview only, no student results or controls
    return (
      <div className="flex flex-col gap-5">
        <Back to="/courses">All courses</Back>
        <Card className="flex flex-col gap-3">
          <Chip as="span" className="self-start">Trainer: {course.trainerName}</Chip>
          <H2 className="text-[40px]">{course.title}</H2>
          <span className="text-[13px] text-muted">Course ID <b className="font-mono">{courseCode(course)}</b></span>
          <p className="text-ink-2 m-0 text-[17px]">{course.description}</p>
          <p className="text-[13px] text-muted m-0">{course.students.length} students, {course.testIds.length} tests. Only the course's own trainer can see results.</p>
        </Card>
      </div>
    );
  }
  const enrolled = users.filter(u => course.students.includes(u.id));
  const joinedAt = uid => (course.joins || []).find(j => j.uid === uid)?.at; // missing for students enrolled before joins were logged
  const assigned = course.testIds.map(t => tests.find(x => x.id === t)).filter(t => t && (admin || t.authorId === me.uid)); // a trainer sees the tests he wrote
  const rows = scoreTable(enrolled, assigned, caseCount, subs);
  const options = users.filter(u => u.role === 'student' && !course.students.includes(u.id)).map(u => [u.id, u.name]);
  const commit = (msg, build) => run(async () => {
    const b = writeBatch(db);
    b.update(doc(db, 'courses', id), build.data);
    build.extra?.(b);
    await b.commit();
    await build.after?.();
    setPick(''); notify(msg); reload();
  });
  const enroll = () => commit('Student enrolled', { data: { students: arrayUnion(pick), joins: arrayUnion({ uid: pick, at: Date.now() }) } });
  const avg = averageScore(subs, assigned, caseCount);
  const del = () => setAsk({ title: `Delete "${course.title}"?`, body: 'Students lose access to it and its tests. Their submissions are kept. This cannot be undone.', label: 'Delete course',
    onYes: async () => { await deleteDoc(doc(db, 'courses', id)); notify('Course deleted'); nav('/courses'); } });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Back to="/courses">All courses</Back>
        {admin && <button className={btn('plain', 'sm')} onClick={del}><Icon name="trash" size={16} />Delete course</button>}
      </div>
      <PageHero compact name={`course-${id}`} pill={`Course · ${courseCode(course)}${course.completed ? ' · Completed' : ''}`} title={course.title} text={course.description}
        stats={[['users', 'Students', enrolled.length, `trainer: ${course.trainerName}`], ['clip', 'Tests', assigned.length, 'assigned'], ['check', 'Results', rows.flatMap(r => r.cells).filter(Boolean).length, 'test results']]}
        ring={{ pct: avg ?? 0, big: avg === null ? '-' : `${avg}%`, small: 'average student score' }} />

      <Analytics course={course} rows={rows} assigned={assigned} subs={subs} />

      {admin && (
        <Card as="section" className="flex flex-col gap-3">
          <H3 className="text-[20px]">Enroll a student</H3>
          <div className="flex items-center gap-3 flex-wrap">
            <Input as="select" className="max-w-[320px]" value={pick} onChange={e => setPick(e.target.value)} aria-label="Choose a student">
              <option value="">Select…</option>
              {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </Input>
            <Btn v="accent" disabled={!pick || busy} onClick={enroll}>Enroll</Btn>
          </div>
        </Card>
      )}

      <Card as="section" className="flex flex-col gap-3">
        <H3 className="text-[20px]">Enrolled students</H3>
        {!enrolled.length ? <Empty title="No students enrolled yet" /> : (
          <div className="overflow-x-auto relative">
            <table className="border-collapse w-full">
              <thead><tr><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Student</th><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Enrolled on</th><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Tests taken</th><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Average score</th><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Last active</th>{admin && <th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line" />}</tr></thead>
              <tbody>
                {[...enrolled].sort((a, b) => (joinedAt(b.id) || 0) - (joinedAt(a.id) || 0)).map(student => {
                  const got = rows.find(r => r.student.id === student.id).cells.filter(Boolean);
                  const mean = got.length ? Math.round(got.reduce((n, c) => n + (c.total ? (100 * c.passed) / c.total : 0), 0) / got.length) : null;
                  const last = Math.max(0, ...subs.filter(x => x.userId === student.id).map(x => ms(x.at) || 0));
                  return (
                  <tr key={student.id}>
                    <td className="p-3 border-b border-line text-[15px]"><span className="flex items-center gap-2.5"><Avatar name={student.name} size={32} /><span className="flex flex-col"><b>{student.name}</b><span className="text-[12px] text-muted">{student.email}</span></span></span></td>
                    <td className="p-3 border-b border-line text-[15px]">{joinedAt(student.id) ? when(joinedAt(student.id)) : <span className="text-[13px] text-muted">Not recorded</span>}</td>
                    <td className="p-3 border-b border-line text-[15px]">{got.length} of {assigned.length}</td>
                    <td className="p-3 border-b border-line text-[15px]">{mean === null ? <span className="text-[13px] text-muted">None yet</span> : <Chip as="span" tone={mean >= 70 ? 'pass' : mean >= 40 ? 'warn' : 'danger'}>{mean}%</Chip>}</td>
                    <td className="p-3 border-b border-line text-[15px]">{last ? when(last) : <span className="text-[13px] text-muted">Never</span>}</td>
                    {admin && <td className="p-3 border-b border-line text-[15px]"><button className={btn('plain', 'sm')} onClick={() => setAsk({ title: `Remove ${student.name}?`, body: `${student.name} loses access to ${course.title} and its tests. Their submissions are kept, and you can enroll them again later.`, label: 'Remove student', onYes: () => commit('Student removed', { data: { students: arrayRemove(student.id) } }) })}>Remove</button></td>}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card as="section" className="flex flex-col gap-2.5" style={{ borderColor: course.completed ? undefined : 'var(--warn)' }}>
        <H3 className="text-[18px]">Course status</H3>
        <p className="text-[13px] text-muted m-0">
          {course.completed ? 'This course is marked completed. Students see it under Completed courses.' : 'Mark the course completed only when it has really finished. Students will see it move from Joined to Completed courses.'}
        </p>
        <div><Btn v="ghost" className="min-h-9! px-3.5! text-[13px]! pointer-coarse:min-h-11!" disabled={busy} onClick={() => setClosing(true)}>{course.completed ? 'Reopen course…' : 'Mark course completed…'}</Btn></div>
      </Card>

      {ask && <Confirm {...ask} onClose={() => setAsk(null)} />}
      {closing && (
        <Modal onClose={() => setClosing(false)}>
          <H3 as="h2" className="text-[24px]">{course.completed ? 'Reopen this course?' : 'Mark this course as completed?'}</H3>
          <p className="text-ink-2 m-0">
            {course.completed
              ? `${course.title} will move back to Joined courses for its ${course.students.length} students.`
              : `${course.title} will move to Completed courses for its ${course.students.length} students. Only do this when the course has finished. You can reopen it later.`}
          </p>
          <div className="flex items-center gap-3 justify-end flex-wrap">
            <Btn v="ghost" onClick={() => setClosing(false)}>Cancel</Btn>
            <Btn v={course.completed ? 'ink' : 'accent'} disabled={busy} onClick={() => commit(course.completed ? 'Course reopened' : 'Course marked completed', { data: { completed: !course.completed }, after: () => setClosing(false) })}>{course.completed ? 'Yes, reopen' : 'Yes, mark completed'}</Btn>
          </div>
        </Modal>
      )}

    </div>
  );
}

// One student's answers (and proctoring evidence) for one test, in a dialog.
export function ResultModal({ courseId, student, test, qs, subs, onClose, others, onMove }) {
  const i = others ? others.findIndex(x => x.id === student.id) : -1; // others: the students to step through
  return (
  <Modal wide onClose={onClose}>
      <div className="max-h-[75vh] overflow-auto flex flex-col gap-3.5">
        <H3 as="h2" className="text-[24px]">{student.name}, {test.title}</H3>
        {test.proctored && <Proctoring uid={student.id} courseId={courseId} test={test} />}
        {test.questionIds.map(qid => {
          const q = qs.find(x => x.id === qid);
          const s = subs.find(x => x.userId === student.id && x.testId === test.id && x.questionId === qid);
          return (
            <div key={qid} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3"><b>{q ? q.title : 'Removed question'}</b>{s ? <span className="flex items-center gap-1.5">{s.auto && <Chip tone="warn">Auto-submitted, not answered</Chip>}<Chip as="span" className={`${s.passed === s.total ? 'bg-pass-soft! text-pass!' : 'bg-warn-soft! text-warn!'}`}>{s.passed}/{s.total}</Chip></span> : <span className="text-[13px] text-muted">Not attempted</span>}</div>
              {s && <CodeBlock code={s.code} />}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {i >= 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Btn v="ghost" size="sm" disabled={i === 0} onClick={() => onMove(others[i - 1])}><Icon name="back" size={15} />Previous</Btn>
            <Btn v="ghost" size="sm" disabled={i === others.length - 1} onClick={() => onMove(others[i + 1])}>Next<Icon name="arrow" size={15} /></Btn>
            <span className="text-[13px] text-muted tabular-nums">Student {i + 1} of {others.length}</span>
          </div>
        ) : <span />}
        <button className={btn('ink')} onClick={() => onClose()}>Close</button>
      </div>
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
    <section className="flex flex-col gap-2 bg-paper rounded-[14px] p-3.5">
      <b>Proctoring</b>
      {!sorted ? <span className="text-[13px] text-muted">Loading log…</span> : sorted.length === 0 ? <span className="text-[13px] text-muted">Nothing recorded.</span> : (
        <ul className="text-[13px] m-0 pl-4.5">{sorted.map(e => <li key={e.id}>{new Date(e.at).toLocaleTimeString()}: {KIND_LABEL[e.kind] || e.kind}{e.detail && ` (${e.detail})`}</li>)}</ul>
      )}
      {!photos ? <span className="text-[13px] text-muted">Loading photos…</span> : photos.length === 0 ? <span className="text-[13px] text-muted">No camera photos.</span> : (
        <div className="flex items-center flex-wrap gap-1.5">
          {photos.map(p => <img className="rounded-[8px] [object-fit:cover]" key={p.id} src={p.img} width={120} height={90} alt={`Camera photo at ${new Date(p.at).toLocaleTimeString()}`} title={`${new Date(p.at).toLocaleTimeString()}${p.reason ? `: ${KIND_LABEL[p.reason] || p.reason}` : ''}`} />)}
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
    <section className="flex flex-col gap-4" aria-label="Course performance">
      <H3 className="text-[22px]">How this course is doing</H3>
      <div className="grid gap-4 grid-cols-2 max-phone:grid-cols-1">
        <ChartCard title="Students joined" hint="Total enrolled at the end of each week. Students with no join date count from the first week.">
          <LineChart data={joins.map((value, i) => ({ label: labels[i], value }))} label="Students enrolled by week" />
        </ChartCard>
        <ChartCard title="Test activity" hint="Submissions per week, all tests.">
          <BarChart data={active.map((value, i) => ({ label: labels[i], value }))} label="Submissions per week" color="var(--accent)" />
        </ChartCard>
        <ChartCard title="Student results" hint={perStudent.length ? `Students by their average score (${perStudent.length} of ${enrolled} have taken a test).` : 'Nobody has taken a test yet.'}>
          <BarChart data={['0-19%', '20-39%', '40-59%', '60-79%', '80-100%'].map((label, i) => ({ label, value: spread[i] }))} label="Students by average score" color="var(--pass-strong)" />
        </ChartCard>
        <ChartCard title="Tests" hint="How many students took each test, and their average score.">
          {tests.length === 0 ? <p className="text-muted m-0">No tests assigned yet.</p> : (
            <div className="flex flex-col gap-3.5">
              {tests.map(t => (
                <div key={t.title} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-[13px]"><b>{t.title}</b><span className="text-muted">{t.tried}/{enrolled} took it · avg {t.avg}%</span></div>
                  <Bar pct={enrolled ? (100 * t.tried) / enrolled : 0} fill="bg-accent" aria-hidden="true" />
                  <Bar pct={t.avg} fill="bg-pass-strong" aria-hidden="true" />
                </div>
              ))}
              <p className="text-[13px] text-muted m-0"><span className="text-accent">■</span> took the test &nbsp; <span className="text-pass-strong">■</span> average score</p>
            </div>
          )}
        </ChartCard>
      </div>
    </section>
  );
}
