import { useState } from 'react';
import { inCourse } from '../../score.js';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, getDoc, query, where } from 'firebase/firestore';
import { db, list, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { flagMap } from '../../proctor.js';
import { averageScore, histogram, perDay, questionStats, scoreTable } from '../../score.js';
import { BarChart, ChartCard } from '../../Charts.jsx';
import { Avatar, Empty, Loading, plural, useLoad, btn, Card, Chip, Bar, H3, Back, PageHero } from '../../ui.jsx';
import { ResultModal } from './CourseDetail.jsx';

const ms = t => t?.toMillis?.() ?? t; // Firestore timestamp or plain number
const DAY = 864e5;
const when = t => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const STATUS = { done: 'Finished', partial: 'In progress', none: 'Not attempted' };

// Everything about one test in one course: the numbers, the charts, and every student's result with search, per-column filters and sorting.
export default function TestResults() {
  const { courseId, testId } = useParams();
  const me = useMe();
  const [view, setView] = useState(null);
  const [f, setF] = useState({ name: '', status: 'all', score: 'all', last: 'all', flags: 'all' });
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const [d] = useLoad(async () => {
    const [cs, ts] = await Promise.all([getDoc(doc(db, 'courses', courseId)), getDoc(doc(db, 'tests', testId))]);
    if (!cs.exists() || !ts.exists()) return { gone: true };
    const course = { id: courseId, ...cs.data() }, test = { id: testId, ...ts.data() };
    if (!course.testIds.includes(testId)) return { gone: true };
    if (me.role === 'trainer' && (course.trainerId !== me.uid || test.authorId !== me.uid)) return { denied: true }; // a trainer sees only his own tests in his own courses
    // shortcut: one read per enrolled student for names; fine for a class, switch to a batched query for thousands
    const [students, bank, subs] = await Promise.all([
      Promise.all(course.students.map(async id => { const s = await getDoc(doc(db, 'users', id)); return s.exists() ? { id, ...s.data() } : { id, name: 'Removed user', email: '' }; })),
      questions(),
      list(query(collection(db, 'submissions'), where('testId', '==', testId))),
    ]);
    const flags = test.proctored ? await flagMap(courseId, course.students, [testId]) : {};
    return { course, test, students, bank, subs: subs.filter(s => course.students.includes(s.userId) && inCourse(s, courseId)), flags };
  }, [courseId, testId]);
  if (!d) return <Loading />;
  if (d.gone) return <Empty title="Test not found" action={<Link to="/results" className={btn('ink')}>Back to results</Link>} />;
  if (d.denied) return <Empty title="This is not your test" body="You can only see results of tests you wrote, in courses you teach." action={<Link to="/results" className={btn('ink')}>Back to results</Link>} />;

  const { course, test, students, bank, subs, flags } = d;
  const qs = test.questionIds.map(id => bank.find(q => q.id === id)).filter(Boolean);
  const caseCount = Object.fromEntries(qs.map(q => [q.id, q.tests.length]));
  const cells = scoreTable(students, [test], caseCount, subs);
  const now = Date.now();
  const rows = students.map((student, i) => {
    const mine = subs.filter(s => s.userId === student.id && caseCount[s.questionId]);
    const tried = new Set(mine.map(s => s.questionId)).size, cell = cells[i].cells[0];
    return {
      student, tried, cell,
      pct: cell && cell.total ? Math.round((100 * cell.passed) / cell.total) : null,
      status: tried === 0 ? 'none' : tried < qs.length ? 'partial' : 'done',
      last: mine.length ? Math.max(...mine.map(s => ms(s.at) || 0)) : null,
      flags: flags[`${student.id}_${testId}`] || 0,
      auto: mine.some(s => s.auto),
    };
  });

  const attempted = rows.filter(r => r.tried > 0), pcts = attempted.map(r => r.pct ?? 0);
  const avg = averageScore(subs, [test], caseCount);
  const stats = questionStats(qs, [test], subs);
  const spread = histogram(pcts);
  const daily = perDay(subs.map(s => ms(s.at)), 14, now);
  const dayLabels = daily.map((_, i) => String(new Date(now - (13 - i) * DAY).getDate()));
  const flagged = rows.filter(r => r.flags > 0).length;

  const pass = {
    status: r => f.status === 'all' || r.status === f.status,
    name: r => `${r.student.name} ${r.student.email}`.toLowerCase().includes(f.name.trim().toLowerCase()),
    score: r => f.score === 'all' || (f.score === 'none' ? r.pct === null : r.pct !== null && (f.score === 'low' ? r.pct < 40 : f.score === 'mid' ? r.pct >= 40 && r.pct < 70 : r.pct >= 70)),
    last: r => f.last === 'all' || (f.last === 'never' ? r.last === null : r.last !== null && (f.last === 'today' ? now - r.last < DAY : f.last === 'week' ? now - r.last < 7 * DAY : now - r.last >= 7 * DAY)),
    flags: r => f.flags === 'all' || (f.flags === 'flagged' ? r.flags > 0 : r.flags === 0),
  };
  const key = { name: r => r.student.name.toLowerCase(), status: r => r.tried, score: r => r.pct ?? -1, last: r => r.last ?? 0, flags: r => r.flags };
  const shown = rows.filter(r => Object.values(pass).every(fn => fn(r))).sort((a, b) => {
    const x = key[sort.key](a), y = key[sort.key](b);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  });
  const filtering = f.name || f.status !== 'all' || f.score !== 'all' || f.last !== 'all' || f.flags !== 'all';
  const set = patch => setF({ ...f, ...patch });
  const Th = ({ k, children }) => (
    <th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line" aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="border-0 bg-transparent p-0 font-semibold text-inherit cursor-pointer whitespace-nowrap hover:text-ink" onClick={() => setSort({ key: k, dir: sort.key === k ? -sort.dir : 1 })}>{children}<span aria-hidden="true">{sort.key === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</span></button>
    </th>
  );
  const Sel = ({ k, label, options }) => <select className="rounded-xl border-[1.5px] border-field-line bg-surface focus:border-ink min-h-[38px] text-[13px] font-medium px-2 min-w-0 w-full" aria-label={`Filter by ${label}`} value={f[k]} onChange={e => set({ [k]: e.target.value })}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;

  return (
    <div className="flex flex-col gap-5">
      <Back to="/results">All results</Back>
      <PageHero compact pill={`${course.title}${test.proctored ? ' · Proctored' : ''}`} title={test.title}
        text={test.proctored ? (flagged ? `${plural(flagged, 'student')} flagged by proctoring.` : 'No student was flagged by proctoring.') : `${plural(qs.length, 'question')} in this test.`}
        stats={[['users', 'Attempted', `${attempted.length}/${students.length}`, 'students'], ['check', 'Finished', rows.filter(r => r.status === 'done').length, 'every question'], ['trophy', 'Highest', pcts.length ? `${Math.max(...pcts)}%` : '-'], ['chart', 'Lowest', pcts.length ? `${Math.min(...pcts)}%` : '-']]}
        ring={{ pct: avg ?? 0, big: avg === null ? '-' : `${avg}%`, small: 'average student score' }} />

      <div className="grid gap-4 grid-cols-2 max-phone:grid-cols-1">
        <ChartCard title="Score spread" hint={pcts.length ? 'Students by their score on this test.' : 'Nobody has attempted this test yet.'}>
          <BarChart data={['0-19%', '20-39%', '40-59%', '60-79%', '80-100%'].map((label, i) => ({ label, value: spread[i] }))} label="Students by score" color="var(--pass-strong)" />
        </ChartCard>
        <ChartCard title="Submissions per day" hint="Last 14 days, by day of the month.">
          <BarChart data={daily.map((value, i) => ({ label: dayLabels[i], value }))} label="Submissions per day" color="var(--accent)" />
        </ChartCard>
        <ChartCard title="Average score per question" hint="Each student's best attempt counts. Shows which questions were hardest.">
          <BarChart data={qs.map((q, i) => ({ label: qs.length <= 6 ? (q.title.length > 11 ? `${q.title.slice(0, 10)}…` : q.title) : `Q${i + 1}`, value: stats[q.id].avg ?? 0 }))} max={100} label="Average score per question" color="var(--warn)" />
          <ul className="text-[13px] m-0 pl-4.5 grid gap-0.5">
            {qs.map((q, i) => <li key={q.id}><b>Q{i + 1}</b> {q.title}: {stats[q.id].avg === null ? 'no attempts' : `${stats[q.id].avg}% from ${plural(stats[q.id].students, 'student')}`}</li>)}
          </ul>
        </ChartCard>
        <ChartCard title="Who took it" hint="Students split by how far they got.">
          <div className="flex flex-col gap-3">
            {['done', 'partial', 'none'].map(k => {
              const n = rows.filter(r => r.status === k).length;
              return (
                <div key={k} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-[13px]"><span>{STATUS[k]}</span><b>{n}</b></div>
                  <Bar pct={students.length ? (100 * n) / students.length : 0} color={k === 'done' ? 'var(--pass-strong)' : k === 'partial' ? 'var(--warn)' : 'var(--field-line)'} aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      <Card as="section" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <H3 className="text-[20px]">Student by student</H3>
          <span className="text-[13px] text-muted">Showing {shown.length} of {students.length}{filtering && <> · <button type="button" className="border-0 bg-transparent p-0 font-semibold underline text-ink cursor-pointer" onClick={() => setF({ name: '', status: 'all', score: 'all', last: 'all', flags: 'all' })}>Clear filters</button></>}</span>
        </div>
        <div className="overflow-x-auto relative">
          <table className="border-collapse w-full">
            <thead>
              <tr><Th k="name">Student</Th><Th k="status">Progress</Th><Th k="score">Score</Th><Th k="last">Last submission</Th>{test.proctored && <Th k="flags">Flags</Th>}<th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line"><span className="sr-only">Open</span></th></tr>
              <tr className="[:where(&)_th]:pt-1.5 [:where(&)_th]:px-3 [:where(&)_th]:pb-2.5 [:where(&)_th]:border-b [:where(&)_th]:border-line">
                <th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line"><input className="rounded-xl border-[1.5px] border-field-line bg-surface focus:border-ink min-h-[38px] text-[13px] font-medium px-2 min-w-0 w-full" type="search" aria-label="Search students by name or email" placeholder="Search name or email" value={f.name} onChange={e => set({ name: e.target.value })} /></th>
                <th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line"><Sel k="status" label="progress" options={[['all', 'All'], ['done', 'Finished'], ['partial', 'In progress'], ['none', 'Not attempted']]} /></th>
                <th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line"><Sel k="score" label="score" options={[['all', 'All'], ['none', 'No score'], ['low', 'Below 40%'], ['mid', '40% to 69%'], ['high', '70% and up']]} /></th>
                <th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line"><Sel k="last" label="last submission" options={[['all', 'Any time'], ['today', 'Last 24 hours'], ['week', 'Last 7 days'], ['older', 'Older than 7 days'], ['never', 'Never']]} /></th>
                {test.proctored && <th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line"><Sel k="flags" label="flags" options={[['all', 'All'], ['flagged', 'Flagged'], ['clean', 'No flags']]} /></th>}
                <th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? <tr><td className="p-3 border-b border-line text-[15px]" colSpan={test.proctored ? 6 : 5}><span className="text-muted">No students match these filters.</span></td></tr> : shown.map(r => (
                <tr key={r.student.id}>
                  <td className="p-3 border-b border-line text-[15px]"><div className="flex items-center gap-2.5"><Avatar name={r.student.name} size={32} /><div><b>{r.student.name}</b><div className="text-[13px] text-muted">{r.student.email}</div></div></div></td>
                  <td className="p-3 border-b border-line text-[15px]"><Chip as="span" className={`${r.status === 'done' ? 'bg-pass-soft! text-pass!' : r.status === 'partial' ? 'bg-warn-soft! text-warn!' : ''}`}>{STATUS[r.status]}</Chip><div className="text-[13px] text-muted">{r.tried}/{qs.length} questions{r.auto && ' · auto-submitted'}</div></td>
                  <td className="p-3 border-b border-line text-[15px]">{r.pct === null ? <span className="text-muted">—</span> : <><b>{r.pct}%</b><div className="text-[13px] text-muted">{r.cell.passed}/{r.cell.total} test cases</div></>}</td>
                  <td className="p-3 border-b border-line text-[15px]">{r.last ? when(r.last) : <span className="text-muted">Never</span>}</td>
                  {test.proctored && <td className="p-3 border-b border-line text-[15px]">{r.flags ? <Chip tone="warn">{r.flags} flags</Chip> : <Chip tone="pass">No flags</Chip>}</td>}
                  <td className="p-3 border-b border-line text-[15px]"><button type="button" className={btn('ghost', 'sm')} onClick={() => setView({ student: r.student, test })}>View answers</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {view && <ResultModal courseId={courseId} student={view.student} test={view.test} qs={bank} subs={subs} onClose={() => setView(null)} others={shown.map(r => r.student)} onMove={st => setView({ ...view, student: st })} />}
    </div>
  );
}
