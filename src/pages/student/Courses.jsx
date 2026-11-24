import { useState } from 'react';
import { inCourse } from '../../score.js';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db, list, listIn, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { Bar, CourseGrid, Empty, Icon, Loading, useBusy, useLoad, Chip, btn, Card, H3, H2, Back, SearchBox } from '../../ui.jsx';
import { get, mySubs } from './data.js';
import { Confirm } from '../staff/trainerShared.jsx';
import * as proctor from '../../proctor.js';
import { ProctorStart, useProctor } from '../../ProctorGuard.jsx';
import { TimerBar, useAttempt } from '../../attempt.jsx';
import { LANGS, courseCode, isWeb, langOfSub, langsOf, notOpen, testCode, timed, typeLabel, when, windowOf } from '../../schedule.js';


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
    <section className="flex flex-col gap-3">
      <div className="flex gap-2.5 items-baseline flex-wrap"><H3 as="h2" className="text-[22px]">{title}</H3><Chip as="span">{count}</Chip>{hint && <span className="text-[13px] text-muted">{hint}</span>}</div>
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
    if (!p) return <Chip as="span" className="self-start">Not enrolled</Chip>;
    return (
      <div className="flex flex-col gap-1.5">
        <Bar pct={p.pct} />
        <div className="flex items-center justify-between gap-3 text-[13px]"><span className="text-muted">{p.tried}/{p.total} questions</span>{p.done ? <Chip tone="pass"><Icon name="check" size={14} stroke={2.4} />Completed</Chip> : <b>{p.pct}%</b>}</div>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-7">
      <SearchBox label="Search courses" placeholder="Search courses by name, topic or trainer" value={q} onChange={setQ} wide />
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

const Tile = ({ n, label }) => <div className="bg-paper rounded-[14px] p-4 flex flex-col gap-2 justify-between"><div className="text-[13px] text-muted">{label}</div><div className="big font-display font-extrabold tracking-[-.03em] leading-none text-[28px]">{n}</div></div>;

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
  if (d.gone) return <Empty title="This course was removed" action={<Link to="/courses" className={btn('ink')}>Back to courses</Link>} />;
  const { course, tests, subs, joined, qs } = d;
  const p = progress(course, tests, subs);
  // the languages students can use across this course's tests, plus web pages if any question is one
  const envs = [...new Set(tests.flatMap(t => { const mine = qs.filter(q => t.questionIds.includes(q.id)); return [...(mine.some(q => q.env !== 'web') ? langsOf(t).map(l => LANGS[l]) : []), ...(mine.some(q => q.env === 'web') ? ['HTML / CSS / JS'] : [])]; }))];
  return (
    <div className="flex flex-col gap-5">
      <Back to="/courses">All courses</Back>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center flex-wrap gap-2">
          <Chip as="span">Trainer: {course.trainerName}</Chip>
          <Chip as="span" className="font-mono">Course ID {courseCode(course)}</Chip>
          {joined ? (p.done ? <Chip tone="pass"><Icon name="check" size={14} stroke={2.4} />Completed</Chip> : <Chip tone="accent">Joined</Chip>) : <Chip tone="warn">Not enrolled</Chip>}
        </div>
        <H2 className="text-[40px]">{course.title}</H2>
        <p className="text-ink-2 m-0 text-[17px] max-w-[70ch]">{course.description}</p>
        <div className="grid gap-4 grid-cols-4 max-laptop:grid-cols-2">
          <Tile n={course.students?.length || 0} label="Students" />
          <Tile n={tests.length} label={tests.length === 1 ? 'Test' : 'Tests'} />
          <Tile n={qs.length} label={qs.length === 1 ? 'Question' : 'Questions'} />
          <Tile n={envs.length && envs.length <= 4 ? <span className="flex flex-wrap gap-1.5 text-[13px] tracking-normal font-sans leading-normal">{envs.map(e => <Chip tone="pass" key={e}>{e}</Chip>)}</span> : envs.length} label={envs.length === 1 ? 'Language' : 'Languages'} />
        </div>
        {!joined && <p className="rounded-[14px] bg-pass-soft text-pass py-3 px-4 font-semibold text-[14px] flex gap-2.5 items-center m-0"><Icon name="shield" size={18} />You are not enrolled in this course. Ask your admin to enroll you once you have paid, then its tests will appear here.</p>}
      </Card>
      {joined && (tests.length === 0 ? <Empty title="No tests assigned yet" body="Your trainer has not added a test to this course yet." /> : tests.map(t => {
        const mine = subs.filter(s => s.testId === t.id), done = mine.length, last = Math.max(0, ...mine.map(x => x.at?.toMillis?.() ?? x.at ?? 0)); // `at` is a number in demo mode and a Timestamp in Firebase
        return (
          <Card as="article" key={t.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center flex-wrap gap-2.5">
                  <H3 as="h2" className="text-[22px]">{t.title}</H3>
                  {t.proctored && <Chip tone="proctor"><Icon name="lock" size={14} />Proctored</Chip>}
                </div>
                <span className="text-[13px] text-muted">Created by {t.authorName || course.trainerName} · Test ID {testCode(t)}</span>
              </div>
              <Link to={`/test/${id}/${t.id}`} state={{ to: `/course/${id}`, label: 'Course' }} className={btn(done >= t.questionIds.length || (!done && notOpen(t)) ? 'ghost' : 'accent')}>{done >= t.questionIds.length ? 'View result' : done ? 'Continue' : notOpen(t) ? 'Details' : 'Start test'}</Link>
            </div>
            <div className="grid gap-3 grid-cols-5 max-laptop:grid-cols-3 max-phone:grid-cols-2">
              {[
                ['Questions', t.questionIds.length],
                ['Time limit', timed(t) ? `${t.durationMin} min` : 'None'],
                [windowOf(t) === 'soon' ? 'Opens' : windowOf(t) === 'closed' ? 'Closed' : 'Start by', timed(t) ? when(windowOf(t) === 'soon' ? t.publishAt : t.endAt) : 'Any time'],
                ['Submitted', last ? when(last) : 'Not yet'],
                ['Test cases passed', done ? `${mine.reduce((n, x) => n + x.passed, 0)}/${mine.reduce((n, x) => n + x.total, 0)}` : 'Not started'],
              ].map(([l, v]) => <div key={l} className="bg-paper rounded-xl p-3 flex flex-col gap-0.5"><span className="text-[12px] text-muted">{l}</span><b className="text-[14px]">{v}</b></div>)}
            </div>
          </Card>
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
  const from = useLocation().state; // the page that linked here, so Back returns to it ({ to, label }); a typed address falls back to the course
  const back = from?.to ? from : { to: `/course/${courseId}`, label: 'Course' };
  const [d] = useLoad(async () => {
    const test = await get('tests', testId);
    if (!test || test.draft) return { gone: true };
    const [qs, subs] = await Promise.all([Promise.all(test.questionIds.map(q => get('questions', q))).then(a => a.filter(Boolean)), mySubs(me.uid, [where('testId', '==', testId)]).then(a => a.filter(s => inCourse(s, courseId)))]);
    return { test, qs, subs };
  }, [testId]);
  const att = useAttempt(courseId, testId, d?.test, me.uid);
  const [busy, run] = useBusy();
  const [asking, setAsking] = useState(false);
  if (!d || att.loading) return <Loading />;
  if (d.gone) return <Empty title="This test was removed" action={<Link to={back.to} className={btn('ink')}>Back to {back.label.toLowerCase()}</Link>} />;
  const win = windowOf(d.test), isTimed = timed(d.test);
  // why the questions are closed: not open yet, closed before starting, time ran out, or the timer has not been started
  const stop = !isTimed ? null : att.expired ? 'expired' : !att.started ? (win === 'open' ? 'start' : win) : null;
  const done = d.qs.filter(q => d.subs.some(s => s.questionId === q.id)).length;
  const finished = d.qs.length > 0 && done === d.qs.length; // every question is submitted: the one attempt is over
  if (!exam && (finished || stop === 'expired')) { // the one attempt is over: show the result, never the questions
    const passed = d.subs.reduce((n, x) => n + x.passed, 0), total = d.subs.reduce((n, x) => n + x.total, 0), pct = total ? Math.round((100 * passed) / total) : 0;
    return (
      <div className="flex flex-col gap-5">
        <Back to={back.to}>{back.label}</Back>
        <div className="flex flex-col gap-1.5">
          <H2 className="text-[36px]">{d.test.title}</H2>
          <span className="text-muted">{finished ? 'You have submitted this test. Only one attempt is allowed, so it cannot be opened again.' : 'The timer for this test ran out, so it cannot be opened again.'}</span>
        </div>
        <div className="grid gap-4 grid-cols-4 max-laptop:grid-cols-2">
          <div className="bg-panel text-cream rounded-lg p-[22px] flex flex-col gap-3">
            <div className="text-[13px] text-on-dark-2">Your score</div>
            <div className="font-display font-extrabold tracking-[-.03em] leading-none text-[42px] max-phone:text-[32px]">{pct}%</div>
            <Bar pct={pct} fill="bg-rose" track="bg-[#3A3D45]" aria-hidden="true" />
          </div>
          {[['Test cases passed', `${passed}/${total}`], ['Questions fully solved', `${d.qs.filter(q => { const x = d.subs.find(r => r.questionId === q.id); return x && x.passed === x.total; }).length}/${d.qs.length}`], ['Questions answered', `${done}/${d.qs.length}`]].map(([l, v]) => (
            <Card key={l} className="flex flex-col gap-3 justify-between">
              <div className="text-[13px] text-muted">{l}</div>
              <div className="font-display font-extrabold tracking-[-.03em] leading-none text-[42px] max-phone:text-[32px]">{v}</div>
            </Card>
          ))}
        </div>
        <H3 as="h2" className="text-[22px]">Your answers</H3>
        <Card className="p-1.5">
          {d.qs.map((q, i) => {
            const x = d.subs.find(r => r.questionId === q.id);
            return (
              <details key={q.id} className="group/ans [&+&]:border-t [&+&]:border-line">
                <summary className="flex items-center justify-between gap-3 p-3 cursor-pointer list-none rounded-xl hover:bg-soft [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-3">
                    {x && x.passed === x.total ? <Icon name="check" size={18} stroke={2.4} color="var(--pass-strong)" /> : <span className="w-4.5" />}
                    <span className="font-semibold">{i + 1}. {q.title}</span>
                  </span>
                  {x ? <span className="font-mono font-bold text-[13px]" style={{ color: x.passed === x.total ? 'var(--pass)' : 'var(--warn)' }}>{x.passed}/{x.total}</span> : <span className="text-muted text-[13px]">Not attempted</span>}
                </summary>
                <div className="px-3 pb-3 flex flex-col gap-2">
                  {x?.code ? <>
                    <span className="text-[13px] text-muted">Your submitted answer · {isWeb(q) ? 'HTML / CSS / JS' : LANGS[langOfSub(x, q)]} · {x.passed} of {x.total} test cases passed</span>
                    <pre className="m-0 p-3.5 rounded-xl bg-soft font-mono text-[13px] leading-normal overflow-auto max-h-[360px] whitespace-pre">{x.code}</pre>
                  </> : <span className="text-[13px] text-muted">{x ? 'This question was left blank when the test ended, so it scored 0.' : 'You did not answer this question.'}</span>}
                </div>
              </details>
            );
          })}
        </Card>
      </div>
    );
  }
  const needStart = d.test.proctored && !exam && (!stop || stop === 'start');
  const locked = needStart || !!stop;
  const submitTest = async () => { await proctor.fillUnanswered(me.uid, courseId, testId, d.test.questionIds); await proctor.recordFinish(me.uid, courseId, testId, !!d.test.proctored); if (exam) proctor.stop(true); nav(back.to); };
  return (
    <div className="flex flex-col gap-5">
      {!exam && <Back to={back.to}>{back.label}</Back>}
      <div className="flex flex-col gap-1.5">
        <H2 className="text-[36px]">{d.test.title}</H2>
        <span className="text-[13px] text-muted">Test ID <b className="font-mono">{testCode(d.test)}</b>{d.qs.some(q => q.env !== 'web') && <> · Languages: <b>{langsOf(d.test).map(l => LANGS[l]).join(', ')}</b></>}</span>
      </div>
      {att.started && !att.expired && <TimerBar left={att.left} />}
      {stop === 'expired' && <Card><b>Time is up.</b> <span className="text-muted">Answers you already submitted are saved, and your trainer can see them.</span></Card>}
      {stop === 'soon' && <Card><b>Opens {when(d.test.publishAt)}.</b> <span className="text-muted">You can start from then.</span></Card>}
      {stop === 'closed' && <Card><b>This test closed on {when(d.test.endAt)}.</b> <span className="text-muted">It can no longer be started.</span></Card>}
      {stop === 'start' && !d.test.proctored && (
        <Card className="flex flex-col gap-3 max-w-[700px]">
          <H3 as="h2" className="text-[24px]">{d.test.durationMin} minutes</H3>
          <p className="text-muted m-0">The timer starts when you press Start and keeps running if you close this page. Come back before it reaches zero to carry on. You can start until {when(d.test.endAt)}.</p>
          <div><button className={btn('accent', 'lg')} disabled={busy} onClick={() => run(att.start)}>{busy ? 'Starting…' : 'Start test'}</button></div>
        </Card>
      )}
      {needStart && <>
        <ProctorStart courseId={courseId} testId={testId} questionIds={d.test.questionIds} before={isTimed ? att.start : undefined} />
      </>}
      {!locked && <Card className="p-1.5">
        {d.qs.map((q, i) => {
          const s = d.subs.find(x => x.questionId === q.id);
          return (
            <Link key={q.id} to={`/solve/${courseId}/${testId}/${q.id}`} className="group/rl flex items-center justify-between gap-3 p-3 rounded-xl no-underline hover:bg-soft [&+&]:border-t [&+&]:border-line [&+&]:rounded-t-none hover:border-t-transparent [&:hover+&]:border-t-transparent">
              <span className="flex items-center gap-3">
                {s && s.passed === s.total ? <Icon name="check" size={18} stroke={2.4} color="var(--pass-strong)" /> : <span className="w-4.5" />}
                <span className="font-semibold">{i + 1}. {q.title}</span>
              </span>
              <span className="flex items-center gap-3 text-[13px]">
                <Chip as="span">{typeLabel(q)}</Chip>
                {s ? <span className="font-mono font-bold" style={{ color: s.passed === s.total ? 'var(--pass)' : 'var(--warn)' }}>{s.passed}/{s.total}</span> : <span className="text-muted">Not attempted</span>}
              </span>
            </Link>
          );
        })}
      </Card>}
      {!stop && !needStart && <div><button className={btn('accent')} onClick={() => setAsking(true)}>Submit test</button></div>}
      {asking && <Confirm title="Submit this test?" body={`Questions you have not answered score 0, and you will not be able to open the test again.${exam ? ' The exam ends now.' : ''}`} label="Submit test" onYes={submitTest} onClose={() => setAsking(false)} />}
    </div>
  );
}
