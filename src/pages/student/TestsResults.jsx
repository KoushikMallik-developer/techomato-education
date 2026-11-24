import { Link, useParams } from 'react-router-dom';
import { collection, documentId, query, where } from 'firebase/firestore';
import { db, list, listIn } from '../../firebase.js';
import { byRank, inCourse } from '../../score.js';
import { notOpen, timed, when, windowOf } from '../../schedule.js';
import { useMe } from '../../auth.jsx';
import { flagCount } from '../../proctor.js';
import { Back, Bar, Card, Chip, Empty, H2, H3, Icon, Loading, btn, plural, useLoad } from '../../ui.jsx';
import { get, mySubs, myCourses } from './data.js';

// Every test in every course the student is in, with how far they got. A test in two courses is two rows: results are kept per course.
function useMyTests() {
  const me = useMe();
  return useLoad(async () => {
    const courses = await myCourses(me.uid);
    const tests = (await Promise.all([...new Set(courses.flatMap(c => c.testIds))].map(id => get('tests', id)))).filter(t => t && !t.draft);
    const subs = await mySubs(me.uid);
    const rows = courses.flatMap(c => c.testIds.map(id => tests.find(t => t.id === id)).filter(Boolean).map(t => {
      const mine = subs.filter(s => s.testId === t.id && inCourse(s, c.id)), n = t.questionIds.length;
      const passed = mine.reduce((a, x) => a + x.passed, 0), total = mine.reduce((a, x) => a + x.total, 0);
      const last = Math.max(0, ...mine.map(x => x.at?.toMillis?.() ?? x.at ?? 0)); // `at` is a number in demo mode and a Timestamp in Firebase
      const done = mine.length, submitted = n > 0 && done >= n, win = timed(t) ? windowOf(t) : 'open';
      const status = submitted ? ['Submitted', 'pass'] : done ? ['In progress', 'accent'] : win === 'closed' ? ['Closed', 'gray'] : win === 'soon' ? ['Opens soon', 'warn'] : ['Not started', 'soft'];
      return { c, t, n, done, passed, total, pct: total ? Math.round((100 * passed) / total) : 0, last, submitted, status };
    }));
    return { courses, rows };
  });
}

/* ---------- Tests: everything assigned to the student ---------- */
export function StudentTests() {
  const [d] = useMyTests();
  if (!d) return <Loading />;
  const { rows } = d;
  if (!rows.length) return <Empty title="No tests yet" body="Tests your trainer assigns to your courses show up here." />;
  return (
    <div className="grid gap-4 grid-cols-3 max-laptop:grid-cols-2 max-tablet:grid-cols-1">
      {rows.map(({ c, t, n, done, last, submitted, status }) => { const shut = !done && notOpen(t); return (
        <Card as="article" key={c.id + t.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-muted">{c.title}</span><Chip tone={status[1]}>{status[0]}</Chip></div>
          <div className="flex items-center flex-wrap gap-2.5"><H3 as="h2" className="text-[22px]">{t.title}</H3>{t.proctored && <Chip tone="proctor"><Icon name="lock" size={14} />Proctored</Chip>}</div>
          <div className="grid gap-2 grid-cols-2 text-[13px]">
            {[['Questions', n], ['Time limit', timed(t) ? `${t.durationMin} min` : 'None'], [timed(t) && windowOf(t) === 'soon' ? 'Opens' : 'Start by', timed(t) ? when(windowOf(t) === 'soon' ? t.publishAt : t.endAt) : 'Any time'], ['Submitted', last ? when(last) : 'Not yet']].map(([l, v]) => <div key={l} className="flex flex-col"><span className="text-muted">{l}</span><b>{v}</b></div>)}
          </div>
          <Link to={`/test/${c.id}/${t.id}`} state={{ to: '/tests', label: 'Tests' }} className={btn(submitted || shut ? 'ghost' : 'accent', 'md', 'self-start mt-auto')}>{submitted ? 'View result' : done ? 'Continue' : shut ? 'Details' : 'Start test'}</Link>
        </Card>
      ); })}
    </div>
  );
}

/* ---------- Results: every test the student has answered ---------- */
export function StudentResults() {
  const [d] = useMyTests();
  if (!d) return <Loading />;
  if (!d.courses.length) return <Empty title="No courses yet" body="Once your admin enrolls you in a course, its tests and results show up here." />;
  return (
    <div className="flex flex-col gap-6">
      {d.courses.map(c => {
        const rows = d.rows.filter(r => r.c.id === c.id);
        const passed = rows.reduce((a, r) => a + r.passed, 0), total = rows.reduce((a, r) => a + r.total, 0);
        return (
          <section key={c.id} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <H3 as="h2" className="text-[22px]">{c.title}</H3>
              <span className="text-[13px] text-muted">{rows.filter(r => r.submitted).length} of {rows.length} tests submitted{total > 0 && ` · ${passed}/${total} test cases passed`}</span>
            </div>
            {!rows.length ? <Card className="text-muted">No tests in this course yet.</Card> : (
              <Card className="p-1.5">
                {rows.map(r => <ResultRow key={r.t.id} r={r} />)}
              </Card>
            )}
          </section>
        );
      })}
    </div>
  );
}

// One test of a course: a link to its own results page.
function ResultRow({ r: { c, t, n, done, passed, total, pct, last, submitted, status } }) {
  return (
    <Link to={`/results/${c.id}/${t.id}`} className="grid gap-4 grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_auto] max-tablet:grid-cols-1 items-center p-4 rounded-xl no-underline hover:bg-soft [&+&]:border-t [&+&]:border-line hover:border-t-transparent [&:hover+&]:border-t-transparent">
      <span className="flex flex-col gap-1.5 min-w-0 items-start"><b className="text-[16px]">{t.title}</b><Chip tone={status[1]}>{status[0]}</Chip></span>
      <span className="flex flex-col gap-0.5 text-[13px]"><span className="text-muted">{submitted ? 'Submitted' : done ? `Answered ${done} of ${n}` : 'Not attempted'}</span><b>{last ? when(last) : '-'}</b></span>
      {done ? (
        <span className="flex flex-col gap-1.5"><span className="flex items-baseline justify-between gap-3 text-[13px]"><b className="font-display text-[20px]">{pct}%</b><span className="text-muted">{passed}/{total} test cases</span></span><Bar pct={pct} color="var(--pass-strong)" aria-hidden="true" /></span>
      ) : <span className="text-[13px] text-muted">No result yet</span>}
      <span className="text-[13px] font-semibold flex items-center gap-1">Results<Icon name="arrow" size={14} /></span>
    </Link>
  );
}

// The results page of one test: the student's own result, then how everyone in the course did.
export function StudentTestResult() {
  const { courseId, testId } = useParams();
  const me = useMe();
  const [d] = useMyTests();
  const [flags] = useLoad(() => flagCount(me.uid, courseId, testId).catch(() => null), [courseId, testId]); // the student's own proctor log, which only they and staff can read
  if (!d) return <Loading />;
  const r = d.rows.find(x => x.c.id === courseId && x.t.id === testId);
  if (!r) return <Empty title="Test not found" body="You are not enrolled in this course, or the test was removed." action={<Link to="/results" className={btn('ink')}>Back to results</Link>} />;
  const { c, t, n, done, passed, total, pct, last, submitted, status } = r;
  return (
    <div className="flex flex-col gap-5">
      <Back to="/results">Results</Back>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center flex-wrap gap-3"><H2 className="text-[36px]">{t.title}</H2><Chip tone={status[1]}>{status[0]}</Chip></div>
        <span className="text-muted">{c.title}{last ? ` · ${submitted ? 'Submitted' : 'Last answer'} ${when(last)}` : ''}</span>
      </div>
      <div className={`grid gap-4 ${t.proctored ? 'grid-cols-4 max-laptop:grid-cols-2' : 'grid-cols-3'} max-tablet:grid-cols-1`}>
        <div className="bg-panel text-cream rounded-lg p-[22px] flex flex-col gap-3">
          <div className="text-[13px] text-on-dark-2">Your score</div>
          <div className="font-display font-extrabold tracking-[-.03em] leading-none text-[42px] max-phone:text-[32px]">{done ? `${pct}%` : 'None'}</div>
          <Bar pct={pct} fill="bg-rose" track="bg-[#3A3D45]" aria-hidden="true" />
        </div>
        {[['Test cases passed', done ? `${passed}/${total}` : '-'], ['Questions answered', `${done}/${n}`], ...(t.proctored ? [['Flags', flags ?? '-']] : [])].map(([l, v]) => (
          <Card key={l} className="flex flex-col gap-3 justify-between"><div className="text-[13px] text-muted">{l}</div><div className="font-display font-extrabold tracking-[-.03em] leading-none text-[42px] max-phone:text-[32px]">{v}</div></Card>
        ))}
      </div>
      <ClassResults courseId={c.id} testId={t.id} proctored={!!t.proctored} />
      <Link to={`/test/${c.id}/${t.id}`} state={{ to: `/results/${c.id}/${t.id}`, label: 'Test results' }} className={btn('ghost', 'md', 'self-start')}>{submitted ? 'View my answers' : 'Open test'}</Link>
    </div>
  );
}

const MEDAL = ['#F2C14E', '#C9CED6', '#D9915A']; // gold, silver, bronze

/* ---------- class results: everyone in the course, for any test ---------- */
// Everyone who attended, ranked by score, then fewer flags, then earlier finish. A student sees only their own flag count and test case count. Only totals are shown, never another student's code.
// shortcut: reads every submission of the test once; fine for a class of a few hundred, summarise per student beyond that.
export function ClassResults({ courseId, testId, proctored }) {
  const me = useMe();
  const [rows] = useLoad(async () => {
    const subs = await list(query(collection(db, 'submissions'), where('testId', '==', testId), where('courseId', '==', courseId)));
    const by = {};
    subs.forEach(x => { const r = (by[x.userId] ||= { uid: x.userId, passed: 0, total: 0, last: 0 }); r.passed += x.passed; r.total += x.total; r.last = Math.max(r.last, x.at?.toMillis?.() ?? x.at ?? 0); });
    const ends = Object.fromEntries((await list(query(collection(db, 'finishes'), where('testId', '==', testId), where('courseId', '==', courseId)))).map(x => [x.userId, x]));
    const people = Object.values(by);
    const names = Object.fromEntries((await listIn(people.map(r => r.uid), ids => query(collection(db, 'leaderboard'), where(documentId(), 'in', ids)))).map(x => [x.id, x.name]));
    return people.map(r => ({ ...r, name: names[r.uid] || 'Student', pct: r.total ? Math.round((100 * r.passed) / r.total) : 0, flags: ends[r.uid]?.flags ?? 0, at: ends[r.uid]?.at ?? r.last })) // ended-at when recorded, else the last answer
      .sort(byRank);
  }, [courseId, testId]);
  return (
    <section className="flex flex-col gap-3">
      <H3 as="h2" className="text-[22px]">Class results</H3>
      {!rows ? <Loading /> : !rows.length ? <Card className="text-muted">Nobody attended this test.</Card> : (
        <Card className="p-1.5">
          {rows.map((r, i) => (
            <div key={r.uid} className={`grid gap-4 grid-cols-[40px_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.2fr)] max-tablet:grid-cols-[32px_minmax(0,1fr)_auto] items-center p-3 rounded-xl [&+&]:border-t [&+&]:border-line ${r.uid === me.uid ? 'bg-soft' : ''}`}>
              {i < 3 ? <span role="img" aria-label={`${['1st', '2nd', '3rd'][i]} place`} title={`${['1st', '2nd', '3rd'][i]} place`} className="size-8 rounded-full grid place-items-center text-[#17181C]" style={{ background: MEDAL[i] }}><Icon name={i ? 'medal' : 'trophy'} size={18} stroke={2.2} /></span> : <b className="font-display text-[18px] text-muted pl-2.5">{i + 1}</b>}
              <span className="font-semibold min-w-0 truncate">{r.name}{r.uid === me.uid && <Chip tone="accent" className="ml-2">You</Chip>}</span>
              <span className="flex items-center gap-3 max-tablet:hidden"><b className="w-10">{r.pct}%</b><span className="grow"><Bar pct={r.pct} color="var(--pass-strong)" aria-hidden="true" /></span></span>
              <span className="text-[13px] text-muted text-right flex flex-col items-end gap-0.5">{r.uid === me.uid && <span>{r.passed}/{r.total} cases</span>}<span>{when(r.at)}</span>{proctored && r.uid === me.uid && <Chip tone={r.flags ? 'warn' : 'pass'}>{r.flags ? plural(r.flags, 'flag') : 'No flags'}</Chip>}</span>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
