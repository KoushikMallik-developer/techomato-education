import { useState } from 'react';
import { inCourse } from '../../score.js';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db, list, listIn, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { Bar, CourseGrid, Empty, Icon, Loading, useBusy, useLoad } from '../../ui.jsx';
import { get, mySubs } from './data.js';
import * as proctor from '../../proctor.js';
import { ProctorStart, useProctor } from '../../ProctorGuard.jsx';
import { TimerBar, useAttempt } from '../../attempt.jsx';
import { LANGS, courseCode, langsOf, testCode, timed, typeLabel, when, windowOf } from '../../schedule.js';

const Back = ({ to, children }) => <Link to={to} className="row small" style={{ gap: 4, fontWeight: 600, textDecoration: 'none' }}><Icon name="back" size={16} />{children}</Link>;

/* ---------- courses ---------- */
// Progress of one course for one student: questions attempted out of all questions in its tests, plus test cases passed. A course is completed only when its trainer marks it so.
const progress = (c, tests, subs) => {
  const own = tests.filter(t => c.testIds?.includes(t.id));
  const total = own.reduce((n, t) => n + t.questionIds.length, 0);
  const mine = subs.filter(s => c.testIds?.includes(s.testId) && inCourse(s, c.id));
  const tried = new Set(mine.map(s => `${s.testId}/${s.questionId}`)).size;
  return { total, tried, pct: total ? Math.round((tried / total) * 100) : 0, done: !!c.completed, passed: mine.reduce((n, s) => n + s.passed, 0), cases: mine.reduce((n, s) => n + s.total, 0) };
};

function Section({ title, hint, count, children }) {
  return (
    <section className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}><h2 className="h3" style={{ fontSize: 22 }}>{title}</h2><span className="chip">{count}</span>{hint && <span className="small muted">{hint}</span>}</div>
      {children}
    </section>
  );
}

export function Courses() {
  const me = useMe();
  const [q, setQ] = useState('');
  const [d] = useLoad(async () => {
    const [all, subs] = await Promise.all([list(collection(db, 'courses')), mySubs(me.uid)]);
    const joined = all.filter(c => c.students?.includes(me.uid));
    const tests = (await Promise.all([...new Set(joined.flatMap(c => c.testIds || []))].map(t => get('tests', t)))).filter(t => t && !t.draft);
    return { all, subs, tests };
  });
  if (!d) return <Loading />;
  const hit = c => `${c.title} ${c.description || ''} ${c.trainerName || ''} ${courseCode(c)}`.toLowerCase().includes(q.trim().toLowerCase());
  const mine = c => c.students?.includes(me.uid);
  const prog = Object.fromEntries(d.all.filter(mine).map(c => [c.id, progress(c, d.tests, d.subs)]));
  const shown = d.all.filter(hit);
  const learning = shown.filter(c => mine(c) && !prog[c.id].done), finished = shown.filter(c => mine(c) && prog[c.id].done);
  const extra = c => {
    const p = prog[c.id];
    if (!p) return <span className="chip" style={{ alignSelf: 'flex-start' }}>Not enrolled</span>;
    return (
      <div className="stack" style={{ gap: 6 }}>
        <Bar pct={p.pct} />
        <div className="between small"><span className="muted">{p.tried}/{p.total} questions</span>{p.done ? <span className="chip chip-pass"><Icon name="check" size={14} stroke={2.4} />Completed</span> : <b>{p.pct}%</b>}</div>
      </div>
    );
  };
  return (
    <div className="stack" style={{ gap: 28 }}>
      <form role="search" className="search" style={{ width: '100%', maxWidth: 480 }} onSubmit={e => e.preventDefault()}>
        <Icon name="search" size={16} />
        <input type="search" aria-label="Search courses" placeholder="Search courses by name, topic or trainer" value={q} onChange={e => setQ(e.target.value)} />
      </form>
      {shown.length === 0 ? <Empty title={q ? 'No courses match your search' : 'No courses yet'} body={q ? 'Try a different word.' : 'Courses your admin creates will show up here.'} /> : (
        <>
          <Section title="Joined courses" count={learning.length} hint="in progress">
            <CourseGrid courses={learning} extra={extra} empty={q ? 'None of your joined courses match' : "You haven't joined a course yet. Ask your admin once you've paid."} />
          </Section>
          <Section title="Completed courses" count={finished.length} hint="marked completed by the trainer">
            <CourseGrid courses={finished} extra={extra} empty={q ? 'None of your completed courses match' : 'Courses your trainer marks as completed move here.'} />
          </Section>
          <Section title="All courses" count={shown.length}>
            <CourseGrid courses={shown} extra={extra} empty="No courses" />
          </Section>
        </>
      )}
    </div>
  );
}

const Tile = ({ n, label }) => <div style={{ background: 'var(--paper)', borderRadius: 14, padding: '12px 16px' }}><div className="big" style={{ fontSize: 26 }}>{n}</div><div className="small muted">{label}</div></div>;

export function CourseView() {
  const { id } = useParams();
  const me = useMe();
  const [d] = useLoad(async () => {
    const course = await get('courses', id);
    if (!course) return { gone: true };
    const [tests, bank] = await Promise.all([Promise.all((course.testIds || []).map(t => get('tests', t))).then(a => a.filter(t => t && !t.draft)), questions()]);
    const ids = new Set(tests.flatMap(t => t.questionIds));
    const joined = !!course.students?.includes(me.uid);
    const subs = joined && course.testIds?.length ? await listIn(course.testIds, ids => query(collection(db, 'submissions'), where('userId', '==', me.uid), where('testId', 'in', ids))).then(a => a.filter(s => inCourse(s, id))) : [];
    return { course, tests, subs, joined, qs: bank.filter(q => ids.has(q.id)) };
  }, [id]);
  if (!d) return <Loading />;
  if (d.gone) return <Empty title="This course was removed" action={<Link to="/courses" className="btn btn-ink">Back to courses</Link>} />;
  const { course, tests, subs, joined, qs } = d;
  const p = progress(course, tests, subs);
  // the languages students can use across this course's tests, plus web pages if any question is one
  const envs = [...new Set(tests.flatMap(t => { const mine = qs.filter(q => t.questionIds.includes(q.id)); return [...(mine.some(q => q.env !== 'web') ? langsOf(t).map(l => LANGS[l]) : []), ...(mine.some(q => q.env === 'web') ? ['HTML / CSS / JS'] : [])]; }))], topics = [...new Set(qs.map(q => q.topic).filter(Boolean))];
  const mix = ['Easy', 'Medium', 'Hard'].map(l => [l, qs.filter(q => q.diff === l).length]).filter(x => x[1]);
  const next = tests.find(t => t.questionIds.some(qid => !subs.some(s => s.testId === t.id && s.questionId === qid)));
  return (
    <div className="stack" style={{ gap: 20 }}>
      <Back to="/courses">All courses</Back>
      <div className="card stack" style={{ gap: 16 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="chip">Trainer: {course.trainerName}</span>
          <span className="chip mono">Course ID {courseCode(course)}</span>
          {joined ? (p.done ? <span className="chip chip-pass"><Icon name="check" size={14} stroke={2.4} />Completed</span> : <span className="chip chip-accent">Joined</span>) : <span className="chip chip-warn">Not enrolled</span>}
        </div>
        <h2 className="h2" style={{ fontSize: 40 }}>{course.title}</h2>
        <p className="ink2" style={{ margin: 0, fontSize: 17, maxWidth: '70ch' }}>{course.description}</p>
        <div className="grid g4">
          <Tile n={course.students?.length || 0} label="Students" />
          <Tile n={tests.length} label={tests.length === 1 ? 'Test' : 'Tests'} />
          <Tile n={qs.length} label={qs.length === 1 ? 'Question' : 'Questions'} />
          <Tile n={envs.length} label={envs.length === 1 ? 'Language' : 'Languages'} />
        </div>
        {joined ? (
          <div className="stack" style={{ gap: 8 }}>
            <Bar pct={p.pct} />
            <div className="between small" style={{ flexWrap: 'wrap' }}>
              <span><b>{p.tried}</b> of {p.total} questions attempted{p.cases > 0 && <> · <b>{p.passed}</b>/{p.cases} test cases passed</>}</span>
              {next && <Link to={`/test/${id}/${next.id}`} className="btn btn-accent btn-sm">{p.tried ? 'Continue' : 'Start'}: {next.title}</Link>}
            </div>
          </div>
        ) : <p className="infobar" style={{ margin: 0 }}><Icon name="shield" size={18} />You are not enrolled in this course. Ask your admin to enroll you once you have paid, then its tests will appear here.</p>}
      </div>
      {qs.length > 0 && (
        <div className="card stack" style={{ gap: 12 }}>
          <h3 className="h3" style={{ fontSize: 20 }}>What you will practise</h3>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {envs.map(e => <span key={e} className="chip chip-pass">{e}</span>)}
            {topics.map(t => <span key={t} className="chip">{t}</span>)}
          </div>
          {mix.length > 0 && <p className="small muted" style={{ margin: 0 }}>Difficulty: {mix.map(([l, n]) => `${n} ${l}`).join(' · ')}</p>}
        </div>
      )}
      {joined && (tests.length === 0 ? <Empty title="No tests assigned yet" body="Your trainer has not added a test to this course yet." /> : tests.map(t => {
        const mine = subs.filter(s => s.testId === t.id), done = mine.length;
        return (
          <article key={t.id} className="card between" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div className="stack" style={{ gap: 4 }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
                <h2 className="h3" style={{ fontSize: 22 }}>{t.title}</h2>
                {t.proctored && <span className="chip chip-proctor"><Icon name="lock" size={14} />Proctored</span>}
                <span className={`chip ${done ? 'chip-pass' : 'chip-accent'}`}>{done}/{t.questionIds.length} attempted</span>
              </div>
              <span className="small muted">{t.questionIds.length} questions · Created by {t.authorName || course.trainerName} · Test ID {testCode(t)}{timed(t) && ` · ${t.durationMin} min · ${windowOf(t) === 'soon' ? `opens ${when(t.publishAt)}` : windowOf(t) === 'closed' ? `closed ${when(t.endAt)}` : `start by ${when(t.endAt)}`}`}{done > 0 && ` · ${mine.reduce((n, s) => n + s.passed, 0)}/${mine.reduce((n, s) => n + s.total, 0)} test cases passed`}</span>
            </div>
            <Link to={`/test/${id}/${t.id}`} className={`btn ${done ? 'btn-ghost' : 'btn-ink'}`}>{done ? 'Continue' : 'Start test'}</Link>
          </article>
        );
      }))}
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
    if (!test || test.draft) return { gone: true };
    const [qs, subs] = await Promise.all([Promise.all(test.questionIds.map(q => get('questions', q))).then(a => a.filter(Boolean)), mySubs(me.uid, [where('testId', '==', testId)]).then(a => a.filter(s => inCourse(s, courseId)))]);
    return { test, qs, subs };
  }, [testId]);
  const att = useAttempt(courseId, testId, d?.test, me.uid);
  const [busy, run] = useBusy();
  if (!d || att.loading) return <Loading />;
  if (d.gone) return <Empty title="This test was removed" action={<Link to={`/course/${courseId}`} className="btn btn-ink">Back to course</Link>} />;
  const win = windowOf(d.test), isTimed = timed(d.test);
  // why the questions are closed: not open yet, closed before starting, time ran out, or the timer has not been started
  const stop = !isTimed ? null : att.expired ? 'expired' : !att.started ? (win === 'open' ? 'start' : win) : null;
  const needStart = d.test.proctored && !exam && (!stop || stop === 'start');
  const locked = needStart || !!stop;
  const done = d.qs.filter(q => d.subs.some(s => s.questionId === q.id)).length;
  return (
    <div className="stack" style={{ gap: 20 }}>
      {!exam && <Back to={`/course/${courseId}`}>Course</Back>}
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="h2" style={{ fontSize: 36 }}>{d.test.title}</h2>
        <span className="small muted">Test ID <b className="mono">{testCode(d.test)}</b>{d.qs.some(q => q.env !== 'web') && <> · Languages: <b>{langsOf(d.test).map(l => LANGS[l]).join(', ')}</b></>}</span>
        <span className="muted">{done} of {d.qs.length} questions submitted{!me.subscribed && '. Free plan: one submission per question, so check your answer before you submit.'}</span>
      </div>
      {att.started && !att.expired && <TimerBar left={att.left} />}
      {stop === 'expired' && <div className="card"><b>Time is up.</b> <span className="muted">Answers you already submitted are saved, and your trainer can see them.</span></div>}
      {stop === 'soon' && <div className="card"><b>Opens {when(d.test.publishAt)}.</b> <span className="muted">You can start from then.</span></div>}
      {stop === 'closed' && <div className="card"><b>This test closed on {when(d.test.endAt)}.</b> <span className="muted">It can no longer be started.</span></div>}
      {stop === 'start' && !d.test.proctored && (
        <div className="card stack" style={{ gap: 12, maxWidth: 700 }}>
          <h2 className="h3" style={{ fontSize: 24 }}>{d.test.durationMin} minutes</h2>
          <p className="muted" style={{ margin: 0 }}>The timer starts when you press Start and keeps running if you close this page. Come back before it reaches zero to carry on. You can start until {when(d.test.endAt)}.</p>
          <div><button className="btn btn-accent btn-lg" disabled={busy} onClick={() => run(att.start)}>{busy ? 'Starting…' : 'Start test'}</button></div>
        </div>
      )}
      {needStart && <>
        {isTimed && !att.started && <div className="card"><b>{d.test.durationMin} minutes.</b> <span className="muted">The timer starts when you press Start exam and keeps running if you close the page.</span></div>}
        <ProctorStart courseId={courseId} testId={testId} questionIds={d.test.questionIds} before={isTimed ? att.start : undefined} />
      </>}
      <div className="card" style={{ padding: 6, opacity: locked ? 0.55 : 1 }}>
        {d.qs.map((q, i) => {
          const s = d.subs.find(x => x.questionId === q.id);
          return (
            <Link key={q.id} to={locked ? '#' : `/solve/${courseId}/${testId}/${q.id}`} onClick={e => locked && e.preventDefault()} aria-disabled={locked} className="rowlink">
              <span className="row">
                {s && s.passed === s.total ? <Icon name="check" size={18} stroke={2.4} color="var(--pass-strong)" /> : <span style={{ width: 18 }} />}
                <span style={{ fontWeight: 600 }}>{i + 1}. {q.title}</span>
              </span>
              <span className="row small">
                <span className="chip">{typeLabel(q)}</span>
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
