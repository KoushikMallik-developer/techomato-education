import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db, listIn } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { CourseGrid, ENV_LABEL, Empty, Icon, Loading, useLoad } from '../../ui.jsx';
import { get, mySubs, myCourses } from './data.js';
import * as proctor from '../../proctor.js';
import { ProctorStart, useProctor } from '../../ProctorGuard.jsx';

const Back = ({ to, children }) => <Link to={to} className="row small" style={{ gap: 4, fontWeight: 600, textDecoration: 'none' }}><Icon name="back" size={16} />{children}</Link>;

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
    if (!course) return { gone: true };
    const tests = (await Promise.all(course.testIds.map(t => get('tests', t)))).filter(Boolean);
    return { course, tests, subs: await listIn(course.testIds, ids => query(collection(db, 'submissions'), where('userId', '==', me.uid), where('testId', 'in', ids))) };
  }, [id]);
  if (!d) return <Loading />;
  if (d.gone) return <Empty title="This course was removed" action={<Link to="/courses" className="btn btn-ink">Back to courses</Link>} />;
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
  const nav = useNavigate();
  const exam = useProctor().testId === testId;
  const [d] = useLoad(async () => {
    const test = await get('tests', testId);
    if (!test) return { gone: true };
    const [qs, subs] = await Promise.all([Promise.all(test.questionIds.map(q => get('questions', q))).then(a => a.filter(Boolean)), mySubs(me.uid, [where('testId', '==', testId)])]);
    return { test, qs, subs };
  }, [testId]);
  if (!d) return <Loading />;
  if (d.gone) return <Empty title="This test was removed" action={<Link to={`/course/${courseId}`} className="btn btn-ink">Back to course</Link>} />;
  const needStart = d.test.proctored && !exam;
  const done = d.qs.filter(q => d.subs.some(s => s.questionId === q.id)).length;
  return (
    <div className="stack" style={{ gap: 20 }}>
      {!exam && <Back to={`/course/${courseId}`}>Course</Back>}
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="h2" style={{ fontSize: 36 }}>{d.test.title}</h2>
        <span className="muted">{done} of {d.qs.length} questions submitted{!me.subscribed && '. Free plan: one submission per question, so check your answer before you submit.'}</span>
      </div>
      {needStart && <ProctorStart testId={testId} questionIds={d.test.questionIds} />}
      <div className="card" style={{ padding: 6, opacity: needStart ? 0.55 : 1 }}>
        {d.qs.map((q, i) => {
          const s = d.subs.find(x => x.questionId === q.id);
          return (
            <Link key={q.id} to={needStart ? '#' : `/solve/${testId}/${q.id}`} onClick={e => needStart && e.preventDefault()} aria-disabled={needStart} className="rowlink">
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
      {exam && (() => {
        const allDone = d.qs.every(q => d.subs.some(s => s.questionId === q.id));
        return (
          <div className="row" style={{ gap: 12 }}>
            <button className="btn btn-accent" disabled={!allDone} onClick={() => { proctor.stop(true); nav(`/course/${courseId}`); }}>Finish exam</button>
            {!allDone && <span className="small muted">Submit every question to finish.</span>}
          </div>
        );
      })()}
    </div>
  );
}
