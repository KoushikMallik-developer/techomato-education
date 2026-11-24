import { Link } from 'react-router-dom';
import { inCourse } from '../../score.js';
import { collection, doc, getCountFromServer, getDoc, query, where } from 'firebase/firestore';
import { db, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { notOpen, windowOf } from '../../schedule.js';
import { activityByDay, dailyOf, dayKey } from '../../score.js';
import { Bar, StreakDots, Empty, Icon, Loading, useLoad, Card, btn, Chip, H3 } from '../../ui.jsx';
import { solvedIds } from './Practice.jsx';
import { get, isPublic, mySubs, myCourses } from './data.js';

/* ---------- activity graph (like GitHub's contribution graph) ---------- */
const WEEKS = 53;
const SHADES = ['var(--soft)', ...[30, 55, 80, 100].map(p => `color-mix(in srgb, var(--accent) ${p}%, var(--soft))`)];
const shade = n => SHADES[n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4];
function ActivityGraph({ subs }) {
  const by = activityByDay(subs);
  const end = new Date(), start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (WEEKS - 1) * 7 - end.getDay()); // the Sunday WEEKS weeks back, so every column is a full week
  const days = Array.from({ length: (WEEKS - 1) * 7 + end.getDay() + 1 }, (_, i) => { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i); return { d, n: by[dayKey(d)] || 0 }; });
  const total = days.reduce((a, x) => a + x.n, 0);
  const months = days.filter(x => x.d.getDay() === 0 && x.d.getDate() <= 7).map(x => ({ col: Math.floor(days.indexOf(x) / 7), label: x.d.toLocaleDateString('en', { month: 'short' }) }));
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap"><H3 as="h2" className="text-[22px]">Activity</H3><span className="text-[13px] text-muted">{total} {total === 1 ? 'answer' : 'answers'} saved in the last year</span></div>
      <div ref={el => { if (el) el.scrollLeft = el.scrollWidth; }} className="overflow-x-auto pb-1">
        <div role="img" aria-label={`${total} answers saved in the last year`} className="w-full min-w-[689px] relative pt-4">
          {months.map(m => <span key={m.col} className="absolute top-0 text-[11px] text-muted leading-none" style={{ left: `${(100 * m.col) / WEEKS}%` }}>{m.label}</span>)}
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
            {days.map(({ d, n }) => <span key={+d} title={`${n} ${n === 1 ? 'answer' : 'answers'} on ${d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}`} className="aspect-square rounded-[3px]" style={{ background: shade(n) }} />)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted self-end" aria-hidden="true">Less{SHADES.map((c, i) => <span key={i} className="size-3 rounded-[3px]" style={{ background: c }} />)}More</div>
    </Card>
  );
}

/* ---------- dashboard ---------- */
export function Dashboard() {
  const me = useMe();
  const [d] = useLoad(async () => {
    const courses = await myCourses(me.uid);
    const tests = (await Promise.all([...new Set(courses.flatMap(c => c.testIds))].map(t => get('tests', t)))).filter(t => t && !t.draft);
    const mine = (await getDoc(doc(db, 'leaderboard', me.uid))).data() || { xp: 0, streak: 0, lastDay: '' };
    const count = async w => (await getCountFromServer(w ? query(collection(db, 'leaderboard'), w) : collection(db, 'leaderboard'))).data().count; // count queries read ~1 doc per 1000, not one per student
    const rank = (await count(where('xp', '>', mine.xp))) + 1;
    return { rank, of: Math.max(rank, await count()), courses, tests, subs: await mySubs(me.uid), mine, daily: dailyOf((await questions()).filter(isPublic)) };
  });
  if (!d) return <Loading />;
  const today = dayKey(new Date());
  const mine = d.mine, { rank, of } = d;
  const cards = d.courses.flatMap(c => c.testIds.map(t => ({ c, t: d.tests.find(x => x.id === t) }))).filter(x => x.t);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 grid-cols-4 max-laptop:grid-cols-2">
        <div className="bg-panel text-cream rounded-lg p-[22px] flex flex-col [:where(&)_.big]:text-[42px] max-phone:[:where(&)_.big]:text-[32px] gap-3">
          <div className="flex items-center justify-between gap-3 text-[13px] text-on-dark-2">
            <span className="flex items-center gap-1.5"><Icon name="flame" size={16} color="#F2B8A8" />Streak</span>
            <span className="text-rose">{mine.lastDay === today ? 'Done today' : 'Due today'}</span>
          </div>
          <div className="big font-display font-extrabold tracking-[-.03em] leading-none">{mine.streak} {mine.streak === 1 ? 'day' : 'days'}</div>
          <StreakDots n={mine.streak} dark />
        </div>
        <Card className="flex flex-col [:where(&)_.big]:text-[42px] max-phone:[:where(&)_.big]:text-[32px] gap-3">
          <div className="text-[13px] text-muted">Courses enrolled</div>
          <div className="big font-display font-extrabold tracking-[-.03em] leading-none">{d.courses.length}</div>
          <div className="text-[13px] text-ink-2">{d.courses.filter(c => c.completed).length} completed</div>
        </Card>
        <Card className="flex flex-col [:where(&)_.big]:text-[42px] max-phone:[:where(&)_.big]:text-[32px] gap-3">
          <div className="text-[13px] text-muted">Problems solved</div>
          <div className="big font-display font-extrabold tracking-[-.03em] leading-none">{solvedIds(d.subs).size}</div>
          <div className="text-[13px] text-ink-2">all test cases passed</div>
        </Card>
        <Card className="flex flex-col [:where(&)_.big]:text-[42px] max-phone:[:where(&)_.big]:text-[32px] gap-3">
          <div className="text-[13px] text-muted">Leaderboard</div>
          <div className="big font-display font-extrabold tracking-[-.03em] leading-none">#{rank}</div>
          <div className="text-[13px] text-ink-2">of {of}, {mine.xp} XP</div>
        </Card>
      </div>
      <ActivityGraph subs={d.subs} />
      {d.daily && (
        <Link to="/contest" className="border border-line rounded-lg p-[22px] max-phone:p-[18px] shadow-[0_1px_2px_rgba(23,24,28,.04),0_8px_24px_-16px_rgba(23,24,28,.12)] transition-[box-shadow,transform,border-color] duration-200 flex items-center justify-between hover:-translate-y-0.5 hover:border-field-line hover:shadow-[0_2px_4px_rgba(23,24,28,.05),0_16px_32px_-16px_rgba(23,24,28,.22)] bg-accent text-on-accent [border:0px] no-underline flex-wrap gap-3">
          <span className="flex flex-col gap-0.5"><span className="text-[13px]">Daily contest</span><b className="text-[20px]">{d.daily.title}</b></span>
          <span className={btn('white')}>Solve today's question</span>
        </Link>
      )}
      <H3 as="h2" className="text-[22px]">Your tests</H3>
      {cards.length === 0 ? <Empty title="No tests yet" body="Tests your trainer assigns to your courses show up here." /> : (
        <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
          {cards.map(({ c, t }) => {
            const done = d.subs.filter(s => s.testId === t.id && inCourse(s, c.id)).length;
            return (
              <Card as="article" key={c.id + t.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-muted">{c.title}</span><Chip as="span" className={`${done === t.questionIds.length ? 'bg-pass-soft! text-pass!' : 'bg-accent-soft! text-accent-ink!'}`}>{done === t.questionIds.length ? 'Attempted' : notOpen(t) ? (windowOf(t) === 'soon' ? 'Opens soon' : 'Closed') : 'Open'}</Chip></div>
                <H3 as="h2" className="text-[23px]">{t.title}</H3>
                <div className="text-[13px] text-muted">{done}/{t.questionIds.length} questions attempted</div>
                <Bar pct={t.questionIds.length ? (100 * done) / t.questionIds.length : 0} />
                <Link to={`/test/${c.id}/${t.id}`} state={{ to: '/', label: 'Dashboard' }} className={btn(done && done === t.questionIds.length || (!done && notOpen(t)) ? 'ghost' : 'accent', 'md', 'self-start mt-1')}>{t.questionIds.length && done === t.questionIds.length ? 'View result' : done ? 'Continue' : notOpen(t) ? 'Details' : 'Start test'}</Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
