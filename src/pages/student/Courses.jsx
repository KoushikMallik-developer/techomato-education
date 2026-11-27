import { useState } from 'react';
import { inCourse } from '../../score.js';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db, list, listIn, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { LEVEL_TONE, Bar, CourseGrid, Empty, Icon, Loading, useBusy, useLoad, Chip, btn, Card, H3, H2, Back, SearchBox, PageHero, heroBtn, heroLink, plural } from '../../ui.jsx';
import { get, mySubs } from './data.js';
import { payRewards } from './rewards.js';
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
      {(() => {
        const joined = d.all.filter(mine), avg = joined.length ? Math.round(joined.reduce((n, c) => n + prog[c.id].pct, 0) / joined.length) : 0;
        const tried = joined.reduce((n, c) => n + prog[c.id].tried, 0), total = joined.reduce((n, c) => n + prog[c.id].total, 0);
        return <PageHero pill="Courses" title="Keep learning."
          stats={[['book', 'Joined', joined.length, `of ${d.all.length} courses`], ['check', 'Completed', joined.filter(c => prog[c.id].done).length, 'marked by trainer'], ['clip', 'Questions', `${tried}/${total}`, 'attempted']]}
          ring={{ pct: avg, big: `${avg}%`, small: 'average progress' }}
          actions={<><Link to="/tests" className={heroBtn}>Go to my tests<span className="transition-transform duration-200 group-hover/go:translate-x-1"><Icon name="arrow" size={18} stroke={2.4} /></span></Link><Link to="/results" className={heroLink}>See my results →</Link></>} />;
      })()}
      <SearchBox label="Search courses" placeholder="Search courses by name, topic or trainer" value={q} onChange={setQ} wide />
      {shown.length === 0 ? <Empty title={q ? 'No courses match your search' : 'No courses yet'} body={q ? 'Try a different word.' : 'Courses your admin creates will show up here.'} /> : (
        <>
          <Section title="Joined courses" count={learning.length} hint="in progress">
            <CourseGrid courses={learning} extra={extra} empty={q ? 'None of your joined courses match' : "You haven't joined a course yet. Ask your admin to enroll you."} />
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
      <PageHero name={`course-${course.id}`} pill={`Course · ${courseCode(course)}${joined ? (p.done ? ' · Completed' : ' · Joined') : ' · Not enrolled'}`} title={course.title} text={course.description}
        stats={[['users', 'Students', course.students?.length || 0, `trainer: ${course.trainerName}`], ['clip', tests.length === 1 ? 'Test' : 'Tests', tests.length, plural(qs.length, 'question')], ['code', envs.length === 1 ? 'Language' : 'Languages', envs.length, envs.join(', ')]]}
        ring={joined ? { pct: p.pct, big: `${p.pct}%`, small: 'questions answered' } : undefined} />
      {!joined && <p className="rounded-[14px] bg-pass-soft text-pass py-3 px-4 font-semibold text-[14px] flex gap-2.5 items-center m-0"><Icon name="shield" size={18} />You are not enrolled in this course. Ask your admin to enroll you, then its tests will appear here.</p>}
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
          <div className="bg-accent text-on-accent rounded-xl p-5 flex flex-col gap-3 shadow-[0_1px_2px_rgba(23,24,28,.12)]">
            <div className="text-[13px] font-medium opacity-85">Your score</div>
            <div className="font-display font-bold tracking-[-.03em] leading-none text-[42px] max-phone:text-[32px]">{pct}%</div>
            <Bar pct={pct} fill="bg-on-accent" track="bg-on-accent/25" aria-hidden="true" />
          </div>
          {[['Test cases passed', `${passed}/${total}`], ['Questions fully solved', `${d.qs.filter(q => { const x = d.subs.find(r => r.questionId === q.id); return x && x.passed === x.total; }).length}/${d.qs.length}`], ['Questions answered', `${done}/${d.qs.length}`]].map(([l, v]) => (
            <Card key={l} className="flex flex-col gap-3 justify-between">
              <div className="text-[13px] text-muted">{l}</div>
              <div className="font-display font-bold tracking-[-.03em] leading-none text-[42px] max-phone:text-[32px]">{v}</div>
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
  const submitTest = async () => { await proctor.fillUnanswered(me.uid, courseId, testId, d.test.questionIds); await proctor.recordFinish(me.uid, courseId, testId, !!d.test.proctored); if (exam) proctor.stop(true); await payRewards(me).catch(() => {}); nav(back.to); };
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
        <Card className="flex flex-col gap-6 w-full">
          <div className="flex flex-col gap-1">
            <H3 as="h2" className="text-[24px]">Before you start</H3>
            <span className="text-muted">The questions open when you press Start, and so does your timer.</span>
          </div>
          <dl className="m-0 grid gap-3 grid-cols-4 max-laptop:grid-cols-2 max-phone:grid-cols-1">
            {[['clip', 'Questions', plural(d.qs.length, 'question'), ['Easy', 'Medium', 'Hard'].map(l => [l, d.qs.filter(q => q.diff === l).length]).filter(x => x[1]).map(([l, n]) => `${n} ${l.toLowerCase()}`).join(' · ')],
              ['clock', 'Time limit', `${d.test.durationMin} minutes`, 'from when you press Start'],
              ...(d.qs.some(q => q.env !== 'web') ? [['code', 'Languages', langsOf(d.test).map(l => LANGS[l]).join(', '), 'pick one in the editor']] : []),
              ['target', 'Start by', when(d.test.endAt), 'last time you can start']].map(([icon, l, v, small]) => (
              <div key={l} className="rounded-xl border border-line bg-surface p-4 flex items-start gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-accent-soft text-accent-ink"><Icon name={icon} size={18} /></span>
                <div className="flex flex-col gap-0.5 min-w-0"><dt className="text-[13px] text-muted">{l}</dt><dd className="m-0 font-bold text-[16px] leading-tight">{v}</dd>{small && <dd className="m-0 text-[12px] text-muted">{small}</dd>}</div>
              </div>
            ))}
          </dl>
          <div className="grid gap-4 grid-cols-3 max-laptop:grid-cols-1">
            {[['clock', 'The timer keeps running', 'It does not pause if you close this page. Come back before it reaches zero to carry on.'],
              ['lock', 'One attempt', 'When you submit the test, or the time runs out, it cannot be opened again.'],
              ['check', 'Check before you submit', 'Make sure you have answered every question before you submit the test. A question left blank scores 0.']].map(([icon, title, text]) => (
              <div key={title} className="bg-paper rounded-[14px] p-4 flex flex-col gap-2">
                <Icon name={icon} size={20} />
                <b>{title}</b>
                <span className="text-[13px] text-muted leading-normal">{text}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap pt-5 border-t border-line">
            <button className={btn('accent', 'lg')} disabled={busy} onClick={() => run(att.start)}><Icon name="play" size={18} />{busy ? 'Starting…' : 'Start test'}</button>
            <span className="text-[13px] text-muted">Your {d.test.durationMin}-minute timer starts straight away.</span>
          </div>
        </Card>
      )}
      {needStart && <>
        <ProctorStart courseId={courseId} testId={testId} questionIds={d.test.questionIds} before={isTimed ? att.start : undefined} />
      </>}
      {!locked && (
        <Card as="section" className="p-0 overflow-hidden" aria-labelledby="qs-head">
          <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-4 border-b border-line">
            <H3 as="h2" id="qs-head" className="text-[18px]">Questions</H3>
            <span className="flex items-center gap-3 text-[13px] text-muted min-w-[200px]">
              <span className="whitespace-nowrap"><b className="text-ink">{done}</b> of {d.qs.length} answered</span>
              <span className="grow"><Bar pct={d.qs.length ? (100 * done) / d.qs.length : 0} aria-hidden="true" /></span>
            </span>
          </div>
          {d.qs.map((q, i) => {
            const s = d.subs.find(x => x.questionId === q.id), full = s && s.passed === s.total;
            return (
              <Link key={q.id} to={`/solve/${courseId}/${testId}/${q.id}`} className="group/rl flex items-center gap-4 px-5 py-4 min-h-16 no-underline text-ink border-b border-line last:border-b-0 hover:bg-soft">
                <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 text-[13px] font-bold ${full ? 'bg-pass-soft text-pass' : s ? 'bg-warn-soft text-warn' : 'bg-soft text-muted border border-line'}`}>{full ? <Icon name="check" size={15} stroke={2.6} /> : i + 1}</span>
                <span className="flex flex-col min-w-0 grow">
                  <b className="truncate">{q.title}</b>
                  <span className="flex items-center gap-1.5 flex-wrap mt-1">{q.diff && <Chip tone={LEVEL_TONE[q.diff]}>{q.diff}</Chip>}<Chip>{typeLabel(q)}</Chip></span>
                </span>
                <span className="text-[13px] text-right shrink-0">{s ? <><b className="font-mono" style={{ color: full ? 'var(--pass)' : 'var(--warn)' }}>{s.passed}/{s.total}</b><span className="block text-muted">cases passed</span></> : <span className="text-muted">Not answered</span>}</span>
                <span className="text-muted transition-transform group-hover/rl:translate-x-0.5"><Icon name="arrow" size={18} /></span>
              </Link>
            );
          })}
          {!stop && !needStart && (
            <div className="flex items-center gap-4 flex-wrap px-5 py-4 border-t border-line bg-paper">
              <button className={btn('accent')} onClick={() => setAsking(true)}>Submit test</button>
              <span className="text-[13px] text-muted">{done < d.qs.length ? `${plural(d.qs.length - done, 'question')} not answered yet; ${d.qs.length - done === 1 ? 'it scores' : 'they score'} 0 if you submit now.` : 'Every question has an answer. Submit when you are happy with them.'}</span>
            </div>
          )}
        </Card>
      )}
      {asking && <Confirm title="Submit this test?" body={`Questions you have not answered score 0, and you will not be able to open the test again.${exam ? ' The exam ends now.' : ''}`} label="Submit test" onYes={submitTest} onClose={() => setAsking(false)} />}
    </div>
  );
}
