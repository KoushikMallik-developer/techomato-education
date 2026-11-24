import { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { inCourse, lastWeeks, perWeek } from '../../score.js';
import { BarChart, ChartCard } from '../../Charts.jsx';
import { courseCode, statusOf, when } from '../../schedule.js';
import { db, list, listIn, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { CourseGrid, plural, Empty, Loading, useLoad, Card, btn, Chip, Bar, H3, SearchBox } from '../../ui.jsx';
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
    const bank = new Set((await questions()).map(q => q.id));
    const ids = [...new Set(courses.flatMap(c => c.testIds))].filter(t => tests.some(x => x.id === t));
    return { courses, tests, qs, bank, subs: await listIn(ids, x => query(collection(db, 'submissions'), where('testId', 'in', x))) };
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
  const pct = rows => { const t = rows.reduce((n, x) => n + x.total, 0); return t ? Math.round((100 * rows.reduce((n, x) => n + x.passed, 0)) / t) : null; };
  const overall = pct(all);
  const week = perWeek(all.map(x => ms(x.at)), 8), labels = lastWeeks(8).map(t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
  const ending = open.filter(t => t.endAt - Date.now() < 2 * 864e5).sort((a, b) => a.endAt - b.endAt); // closes within two days
  const closed = by('closed');
  const attention = [
    ...drafts.map(t => ({ k: t.id, text: `${t.title} is not published yet`, to: `/tests/${t.id}/edit` })),
    ...ending.map(t => ({ k: t.id + 'e', text: `${t.title} closes ${when(t.endAt)}`, to: `/tests/${t.id}/edit` })),
    ...courses.filter(c => !c.students.length).map(c => ({ k: c.id, text: `${c.title} has no students yet`, to: `/course/${c.id}` })),
  ];
  const live = [...open, ...soon].sort((a, b) => a.publishAt - b.publishAt || a.endAt - b.endAt).slice(0, 6);
  const split = parts => ( // one thin bar cut into coloured parts, with a legend underneath
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2 rounded-[99px] overflow-hidden bg-line gap-0.5">
        {parts.filter(x => x[1]).map(([l, n, c]) => <span key={l} title={`${l}: ${n}`} style={{ flex: n, background: c }} />)}
      </div>
      <div className="flex items-center text-[12px] text-muted flex-wrap gap-[2px_10px]">{parts.filter(x => x[1]).map(([l, n, c]) => <span key={l} className="flex items-center gap-1"><span className="w-2 h-2 rounded-[99px]" style={{ background: c }} />{n} {l}</span>)}</div>
    </div>
  );
  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted m-[-14px_0_0]">Hi {me.name.split(' ')[0]}. Here is what is happening in your courses.</p>
      <div className="grid gap-4 grid-cols-4 max-laptop:grid-cols-2">
        <div className="bg-panel text-cream rounded-lg p-[22px] flex flex-col [:where(&)_.big]:text-[42px] max-phone:[:where(&)_.big]:text-[32px] gap-3">
          <div className="text-[13px] text-on-dark-2">Average result</div>
          <div className="big font-display font-extrabold tracking-[-.03em] leading-none">{overall === null ? 'None' : `${overall}%`}</div>
          <Bar pct={overall ?? 0} fill="bg-rose" track="bg-[#3A3D45]" aria-hidden="true" />
          <div className="text-[13px] text-on-dark-2">{plural(all.length, 'submission')}</div>
        </div>
        <Card as={Link} to="/courses" className="flex flex-col [:where(&)_.big]:text-[42px] max-phone:[:where(&)_.big]:text-[32px] hover:-translate-y-0.5 hover:border-field-line hover:shadow-[0_2px_4px_rgba(23,24,28,.05),0_16px_32px_-16px_rgba(23,24,28,.22)] gap-3 no-underline">
          <div className="text-[13px] text-muted">Courses</div>
          <div className="big font-display font-extrabold tracking-[-.03em] leading-none">{courses.length}</div>
          <div className="text-[13px] text-ink-2">{plural(new Set(courses.flatMap(c => c.students)).size, 'student')} enrolled</div>
        </Card>
        <Card as={Link} to="/tests" className="flex flex-col [:where(&)_.big]:text-[42px] max-phone:[:where(&)_.big]:text-[32px] hover:-translate-y-0.5 hover:border-field-line hover:shadow-[0_2px_4px_rgba(23,24,28,.05),0_16px_32px_-16px_rgba(23,24,28,.22)] gap-3 no-underline">
          <div className="text-[13px] text-muted">Tests</div>
          <div className="big font-display font-extrabold tracking-[-.03em] leading-none">{tests.length}</div>
          {split([['open', open.length, 'var(--leaf)'], ['scheduled', soon.length, 'var(--warn)'], ['draft', drafts.length, 'var(--panel-muted)'], ['closed', closed.length, 'var(--ink-2)']])}
        </Card>
        <Card as={Link} to="/questions" className="flex flex-col [:where(&)_.big]:text-[42px] max-phone:[:where(&)_.big]:text-[32px] hover:-translate-y-0.5 hover:border-field-line hover:shadow-[0_2px_4px_rgba(23,24,28,.05),0_16px_32px_-16px_rgba(23,24,28,.22)] gap-3 no-underline">
          <div className="text-[13px] text-muted">Question bank</div>
          <div className="big font-display font-extrabold tracking-[-.03em] leading-none">{qs.length}</div>
          {split([['public', qs.filter(q => q.public !== false).length, 'var(--pass-strong)'], ['private', qs.filter(q => q.public === false).length, 'var(--panel-muted)']])}
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-2 max-phone:grid-cols-1">
        <ChartCard title="Test activity" hint="Answers submitted per week across your courses.">
          <BarChart data={week.map((value, i) => ({ label: labels[i], value }))} label="Submissions per week" />
        </ChartCard>
        <Card as="section" className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3"><div><H3 className="text-[18px]">Average result by course</H3><p className="text-[13px] text-muted m-[2px_0_0]">Passed cases out of submitted answers. Unanswered questions are not counted.</p></div><Link to="/courses" className="text-[13px] font-semibold whitespace-nowrap">All courses</Link></div>
          {courses.length === 0 ? <p className="text-muted text-[13px] m-0">No courses assigned to you yet.</p> : courses.map(c => {
            const avg = pct(subsOf(c));
            return (
              <Link key={c.id} to={`/course/${c.id}`} className="flex flex-col gap-1.5 no-underline">
                <span className="flex items-center justify-between gap-3 text-[13px]"><b>{c.title}</b><span className="text-muted">{plural(c.students.length, 'student')} · {avg === null ? 'no results yet' : `${avg}%`}</span></span>
                <Bar pct={avg ?? 0} color={avg === null ? undefined : barColor(avg)} aria-hidden="true" />
              </Link>
            );
          })}
        </Card>
      </div>

      {attention.length > 0 && (
        <Link to={attention[0].to} className="border border-line rounded-lg p-[22px] max-phone:p-[18px] shadow-[0_1px_2px_rgba(23,24,28,.04),0_8px_24px_-16px_rgba(23,24,28,.12)] transition-[box-shadow,transform,border-color] duration-200 flex items-center justify-between hover:-translate-y-0.5 hover:border-field-line hover:shadow-[0_2px_4px_rgba(23,24,28,.05),0_16px_32px_-16px_rgba(23,24,28,.22)] bg-accent text-on-accent [border:0px] no-underline flex-wrap gap-3">
          <span className="flex flex-col gap-0.5"><span className="text-[13px]">{plural(attention.length, 'thing')} need{attention.length === 1 ? 's' : ''} your attention</span><b className="text-[20px]">{attention[0].text}</b></span>
          <span className={btn('white')}>Take a look</span>
        </Link>
      )}

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

