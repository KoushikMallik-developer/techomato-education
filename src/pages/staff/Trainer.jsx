import { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { averageScore, inCourse, lastWeeks, perWeek } from '../../score.js';
import { BarChart, ChartCard } from '../../Charts.jsx';
import { courseCode, statusOf, when } from '../../schedule.js';
import { db, list, listIn, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { CourseGrid, plural, Empty, Icon, Loading, useLoad, Card, btn, Chip, Bar, H3, SearchBox, PageHero, heroBtn } from '../../ui.jsx';
import { ms, barColor } from './trainerShared.jsx';

// The trainer's home: what is running, what needs attention, and how the courses are doing.
export function TrainerDashboard() {
  const me = useMe();
  const [d] = useLoad(async () => {
    const [courses, tests, qs] = await Promise.all([
      list(query(collection(db, 'courses'), where('trainerId', '==', me.uid))),
      list(query(collection(db, 'tests'), where('authorId', '==', me.uid))),
      list(query(collection(db, 'questions'), where('authorId', '==', me.uid))),
    ]);
    const all = await questions(), bank = new Set(all.map(q => q.id)), cases = Object.fromEntries(all.map(q => [q.id, q.tests.length]));
    const ids = [...new Set(courses.flatMap(c => c.testIds))].filter(t => tests.some(x => x.id === t));
    return { courses, tests, qs, bank, cases, subs: await listIn(ids, x => query(collection(db, 'submissions'), where('testId', 'in', x))) };
  });
  if (!d) return <Loading />;
  const { courses, tests, qs, bank } = d;
  const inN = t => courses.filter(c => c.testIds?.includes(t.id)).length;
  const status = t => statusOf(t, bank, inN(t));
  const by = k => tests.filter(t => status(t) === k);
  const [drafts, soon, open] = [by('draft'), by('soon'), by('open')];
  // a submission counts in the course it was made in, for students still enrolled there
  const subsOf = c => d.subs.filter(s => c.testIds.includes(s.testId) && c.students.includes(s.userId) && inCourse(s, c.id));
  const all = courses.flatMap(subsOf);
  const overall = averageScore(all, tests, d.cases);
  const week = perWeek(all.map(x => ms(x.at)), 8), labels = lastWeeks(8).map(t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
  const ending = open.filter(t => t.endAt - Date.now() < 2 * 864e5).sort((a, b) => a.endAt - b.endAt); // closes within two days
  const attention = [
    ...drafts.map(t => ({ k: t.id, icon: 'edit', text: `${t.title} is not published yet`, cta: 'Publish', to: `/tests/${t.id}/edit` })),
    ...ending.map(t => ({ k: t.id + 'e', icon: 'clock', text: `${t.title} closes ${when(t.endAt)}`, cta: 'Review', to: `/tests/${t.id}/edit` })),
    ...courses.filter(c => !c.students.length).map(c => ({ k: c.id, icon: 'users', text: `${c.title} has no students yet`, cta: 'Add students', to: `/course/${c.id}` })),
  ];
  const live = [...open, ...soon].sort((a, b) => a.publishAt - b.publishAt || a.endAt - b.endAt).slice(0, 6);
  return (
    <div className="flex flex-col gap-5">
      <PageHero compact title="Dashboard"
        stats={[['book', 'Courses', courses.length, plural(new Set(courses.flatMap(c => c.students)).size, 'student')], ['clip', 'Tests open', open.length, `${soon.length} scheduled · ${drafts.length} draft`], ['code', 'Questions', qs.length, `${qs.filter(q => q.public === false).length} private`], ['check', 'Submissions', all.length, 'answers saved']]}
        ring={{ pct: overall ?? 0, big: overall === null ? '-' : `${overall}%`, small: 'average student score' }}
        actions={<><Link to="/tests/new" className={heroBtn}><Icon name="plus" size={18} />New test</Link><Link to="/results" className={btn('ghost')}>See results →</Link></>} />

      {attention.length > 0 && (
        <Card as="section" className="p-0 overflow-hidden" aria-labelledby="attention">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-line">
            <span className="w-8 h-8 rounded-lg bg-warn-soft text-warn grid place-items-center shrink-0"><Icon name="bell" size={16} /></span>
            <H3 id="attention" className="text-[16px]">Needs your attention</H3>
            <Chip tone="warn">{attention.length}</Chip>
          </div>
          <ul className="m-0 p-0 list-none">
            {attention.map(a => (
              <li key={a.k} className="border-b border-line last:border-b-0">
                <Link to={a.to} className="flex items-center justify-between gap-4 px-5 py-3 min-h-12 no-underline text-ink text-[14px] hover:bg-soft">
                  <span className="flex items-center gap-3 min-w-0"><span className="text-muted"><Icon name={a.icon} size={18} /></span><span className="truncate">{a.text}</span></span>
                  <span className="text-[13px] font-semibold text-accent-ink whitespace-nowrap">{a.cta} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 max-phone:grid-cols-1">
        <ChartCard title="Test activity" hint="Answers submitted per week across your courses.">
          <BarChart data={week.map((value, i) => ({ label: labels[i], value }))} label="Submissions per week" />
        </ChartCard>
        <Card as="section" className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3"><div><H3 className="text-[18px]">Average student score by course</H3><p className="text-[13px] text-muted m-[2px_0_0]">Each student's score on the tests they took, averaged over the class. Unanswered questions in a test count as 0.</p></div><Link to="/courses" className="text-[13px] font-semibold whitespace-nowrap">All courses</Link></div>
          {courses.length === 0 ? <p className="text-muted text-[13px] m-0">No courses assigned to you yet.</p> : courses.map(c => {
            const avg = averageScore(subsOf(c), tests.filter(t => c.testIds.includes(t.id)), d.cases);
            return (
              <Link key={c.id} to={`/course/${c.id}`} className="flex flex-col gap-1.5 no-underline">
                <span className="flex items-center justify-between gap-3 text-[13px]"><b>{c.title}</b><span className="text-muted">{plural(c.students.length, 'student')} · {avg === null ? 'no results yet' : `${avg}%`}</span></span>
                <Bar pct={avg ?? 0} color={avg === null ? undefined : barColor(avg)} aria-hidden="true" />
              </Link>
            );
          })}
        </Card>
      </div>

      <H3 as="h2" className="text-[22px]">Tests running and coming up</H3>
      {live.length === 0 ? <Empty title="No test is open or scheduled" body="Create a test and assign it to a course." action={<Link to="/tests/new" className={btn('ink')}>New test</Link>} /> : (
        <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
          {live.map(t => {
            const c = courses.find(x => x.testIds?.includes(t.id));
            const who = c ? new Set(subsOf(c).filter(x => x.testId === t.id).map(x => x.userId)).size : 0, of = c?.students.length || 0;
            const isOpen = status(t) === 'open';
            return (
              <Card as="article" key={t.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-muted">{c?.title}</span><Chip as="span" className={`${isOpen ? 'bg-chip-green! text-chip-green-ink!' : 'bg-chip-amber! text-chip-amber-ink!'}`}>{isOpen ? 'Open' : 'Scheduled'}</Chip></div>
                <H3 as="h2" className="text-[23px]">{t.title}</H3>
                <div className="text-[13px] text-muted">{isOpen ? `Closes ${when(t.endAt)}` : `Opens ${when(t.publishAt)}`}</div>
                <div className="text-[13px] text-muted">{who} of {of} students attempted</div>
                <Bar pct={of ? (100 * who) / of : 0} aria-hidden="true" />
                {c && <Link to={isOpen ? `/results/${c.id}/${t.id}` : `/tests/${t.id}/edit`} className={btn('ink', 'md', 'self-start mt-1')}>{isOpen ? 'View results' : 'Edit test'}</Link>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TrainerCourses() {
  const me = useMe();
  const [q, setQ] = useState('');
  const [all] = useLoad(() => list(collection(db, 'courses')));
  if (!all) return <Loading />;
  const shown = all.filter(c => `${c.title} ${c.description || ''} ${c.trainerName || ''} ${courseCode(c)}`.toLowerCase().includes(q.trim().toLowerCase()));
  const mine = shown.filter(c => c.trainerId === me.uid);
  const extra = c => c.trainerId === me.uid ? <Chip tone="accent" className="self-start">Yours</Chip> : null;
  return (
    <div className="flex flex-col gap-7">
      {(() => { const own = all.filter(c => c.trainerId === me.uid); return (
        <PageHero compact title="Courses"
          stats={[['book', 'My courses', own.length, `of ${all.length} on the platform`], ['users', 'Students', new Set(own.flatMap(c => c.students)).size, 'across your courses'], ['clip', 'Tests', own.reduce((n, c) => n + (c.testIds?.length || 0), 0), 'assigned']]}
          actions={<Link to="/results" className={heroBtn}>See results<span className="transition-transform duration-200 group-hover/go:translate-x-1"><Icon name="arrow" size={18} stroke={2.4} /></span></Link>} />
      ); })()}
      <SearchBox label="Search courses" placeholder="Search courses by name, topic or trainer" value={q} onChange={setQ} wide />
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5"><H3 as="h2" className="text-[22px]">My courses</H3><Chip as="span">{mine.length}</Chip></div>
        <CourseGrid courses={mine} extra={extra} empty={q ? 'None of your courses match' : 'No courses assigned to you yet'} />
      </section>
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5"><H3 as="h2" className="text-[22px]">All courses</H3><Chip as="span">{shown.length}</Chip></div>
        <CourseGrid courses={shown} extra={extra} empty={q ? 'No courses match your search' : 'No courses yet'} />
      </section>
    </div>
  );
}

