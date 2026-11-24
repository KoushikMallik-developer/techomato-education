import { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { inCourse } from '../../score.js';
import { courseCode, statusOf, testCode } from '../../schedule.js';
import { db, list, listIn, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { plural, Empty, Icon, Loading, useLoad, Card, btn, Chip, Bar, H3, SearchBox } from '../../ui.jsx';
import { Pick, FilterBar, matches, createdOf, STATUS_BADGE, pct, barColor } from './trainerShared.jsx';

// Results for the tests this trainer wrote: a summary, filters, then one card per test, grouped by course.
export function TrainerResults() {
  const me = useMe();
  const [text, setText] = useState('');
  const none = { proc: 'all', sort: 'name' };
  const [f, setF] = useState(none);
  const [shut, setShut] = useState(() => new Set()); // ids of the collapsed courses
  const [d] = useLoad(async () => {
    const courses = await list(query(collection(db, 'courses'), where('trainerId', '==', me.uid)));
    const tests = (await list(query(collection(db, 'tests'), where('authorId', '==', me.uid)))); // only the tests this trainer wrote
    const mine = new Set(tests.map(t => t.id));
    const ids = [...new Set(courses.flatMap(c => c.testIds))].filter(t => mine.has(t));
    const subs = await listIn(ids, x => query(collection(db, 'submissions'), where('testId', 'in', x)));
    return { courses, tests, subs, bank: new Set((await questions()).map(q => q.id)) };
  });
  if (!d) return <Loading />;
  if (!d.courses.length) return <Empty title="No courses assigned to you yet" />;

  // one entry per (course, test)
  const entries = d.courses.flatMap(c => c.testIds.map(tid => {
    const t = d.tests.find(x => x.id === tid);
    if (!t) return null;
    const subs = d.subs.filter(s => s.testId === tid && c.students.includes(s.userId) && inCourse(s, c.id));
    const who = new Set(subs.map(s => s.userId));
    const total = subs.reduce((n, s) => n + s.total, 0), passed = subs.reduce((n, s) => n + s.passed, 0);
    const status = statusOf(t, d.bank, 1); // every entry here is in a course
    return { c, t, who, subs, avg: pct(passed, total), status };
  })).filter(e => e && (e.status === 'open' || e.status === 'closed')); // results exist only once a test has started: drafts and scheduled tests are left out

  const sorts = { name: (a, b) => a.t.title.localeCompare(b.t.title), high: (a, b) => (b.avg ?? -1) - (a.avg ?? -1), low: (a, b) => (a.avg ?? 101) - (b.avg ?? 101),
    attempts: (a, b) => b.who.size - a.who.size, new: (a, b) => createdOf(b.t) - createdOf(a.t) };
  const shown = entries.filter(e => matches(`${e.t.title} ${testCode(e.t)} ${e.c.title} ${courseCode(e.c)}`, text)
    && (f.proc === 'all' || (f.proc === 'yes') === !!e.t.proctored)).sort(sorts[f.sort]);
  const groups = d.courses.map(c => ({ c, rows: shown.filter(e => e.c.id === c.id) })).filter(g => g.rows.length);

  return (
    <div className="flex flex-col gap-5">
      <SearchBox label="Search results" placeholder="Search by test, test ID or course" value={text} onChange={setText} />
      <FilterBar changed={JSON.stringify(f) !== JSON.stringify(none)} onReset={() => setF(none)}>
        <Pick label="Proctoring" value={f.proc} onChange={v => setF({ ...f, proc: v })} options={[['all', 'Proctored or not'], ['yes', 'Proctored'], ['no', 'Not proctored']]} />
        <Pick label="Sort by" value={f.sort} onChange={v => setF({ ...f, sort: v })} options={[['name', 'Test name A to Z'], ['high', 'Highest average'], ['low', 'Lowest average'], ['attempts', 'Most students attempted'], ['new', 'Test created, newest']]} />
      </FilterBar>

      {!entries.length ? <Empty title="No results yet" body="Results appear here once a test you assigned to a course is open or closed. Drafts and scheduled tests are not listed." />
        : !groups.length ? <Empty title="No results match" body="Try a different word or reset the filters." />
        : <>
        {groups.map(({ c, rows }) => (
          <details key={c.id} className="group/cd border border-field-line rounded-lg bg-soft" open={!shut.has(c.id)}>
            <summary className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3.5 px-[18px] cursor-pointer list-none bg-surface rounded-lg [&::-webkit-details-marker]:hidden group-open/cd:border-b group-open/cd:border-line group-open/cd:rounded-b-none" onClick={e => { e.preventDefault(); setShut(x => { const n = new Set(x); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; }); }}>
              <span className="flex rotate-180 transition-transform duration-150 group-open/cd:-rotate-90" aria-hidden="true"><Icon name="back" size={18} /></span>
              <H3 as="h2" className="text-[22px]">{c.title}</H3>
              <Chip as="span" className="font-mono">{courseCode(c)}</Chip>
              <span className="text-[13px] text-muted">{plural(c.students.length, 'student')} · {plural(rows.length, 'test')}</span>
            </summary>
            <div className="flex flex-col gap-3 p-4 [:where(&)_.fact]:bg-surface">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">{(() => { // a summary of this course's tests that are listed
              const all = rows.flatMap(r => r.subs), taking = new Set(rows.flatMap(r => [...r.who])).size, overall = pct(all.reduce((n, x) => n + x.passed, 0), all.reduce((n, x) => n + x.total, 0));
              return [['Tests', rows.length, 'open or closed'], ['Students', c.students.length, 'in this course'], ['Students taking tests', taking, `of ${c.students.length}`], ['Average result', overall === null ? 'None' : `${overall}%`, 'of all submitted answers']].map(([k, v, hint]) => (
                <div key={k} className="fact flex flex-col gap-0.5 py-2 px-3.5 bg-soft rounded-sm"><span className="text-[13px] text-muted">{k}</span><b className="text-[26px] leading-[1.1]">{v}</b><span className="text-[13px] text-muted">{hint}</span></div>
              ));
            })()}</div>
            {rows.map(({ t, who, avg, status }) => {
              const [label, cls] = STATUS_BADGE[status];
              return (
                <Card as="article" key={t.id} className="grid grid-cols-[minmax(0,1fr)_160px_160px_auto] gap-5 items-center py-4 px-[18px] max-laptop:grid-cols-2 max-laptop:[:where(&)>:first-child]:col-[1/-1] max-laptop:[:where(&)>:last-child]:col-[1/-1] max-laptop:[:where(&)>:last-child]:justify-self-start">
                  <div className="flex flex-col gap-2 min-w-0">
                    <H3 className="text-[20px]">{t.title}</H3>
                    <div className="flex items-center flex-wrap gap-2">
                      <Chip as="span" className={`${cls}`}>{label}</Chip>
                      {t.proctored && <Chip tone="proctor"><Icon name="lock" size={14} />Proctored</Chip>}
                      <Chip as="span" className="font-mono">{testCode(t)}</Chip>
                      <Chip as="span">{plural(t.questionIds.length, 'question')}</Chip>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] text-muted">Students attempted</span>
                    <b className="text-[22px] leading-[1.1]">{who.size}<span className="text-[13px] text-muted font-medium"> of {c.students.length}</span></b>
                    <Bar pct={pct(who.size, c.students.length) ?? 0} role="img" aria-label={`${who.size} of ${c.students.length} students attempted`} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] text-muted">Average result</span>
                    {avg === null ? <b className="text-[22px] leading-[1.1] text-muted">None yet</b> : (
                      <>
                        <b className="text-[22px] leading-[1.1]">{avg}%</b>
                        <Bar pct={avg} color={barColor(avg)} role="img" aria-label={`Average result ${avg}%`} />
                      </>
                    )}
                  </div>
                  <Link to={`/results/${c.id}/${t.id}`} className={btn('ink', 'sm')}>View results</Link>
                </Card>
              );
            })}
            </div>
          </details>
        ))}
        </>}
    </div>
  );
}

