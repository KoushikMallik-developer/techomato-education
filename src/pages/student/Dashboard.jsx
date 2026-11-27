import { Link } from 'react-router-dom';
import { inCourse } from '../../score.js';
import { collection, doc, getCountFromServer, getDoc, query, where } from 'firebase/firestore';
import { db, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { notOpen, timeUp, windowOf } from '../../schedule.js';
import { SOLVE_POINTS, activityByDay, dailyOf, dayKey } from '../../score.js';
import { Bar, Empty, Icon, Loading, useLoad, Card, btn, Chip, H3, Hero, HeroTitle, Ring, heroBtn, plural } from '../../ui.jsx';
import { PointsPromo, solvedIds } from './Practice.jsx';
import { payRewards } from './rewards.js';
import { get, isPublic, myAttempts, mySubs, myCourses } from './data.js';

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
    await payRewards(me).catch(() => {}); // first, so the points below include them
    const courses = await myCourses(me.uid);
    const tests = (await Promise.all([...new Set(courses.flatMap(c => c.testIds))].map(t => get('tests', t)))).filter(t => t && !t.draft);
    const mine = (await getDoc(doc(db, 'leaderboard', me.uid))).data() || { points: 0, streak: 0, lastDay: '' };
    const count = async w => (await getCountFromServer(w ? query(collection(db, 'leaderboard'), w) : collection(db, 'leaderboard'))).data().count; // count queries read ~1 doc per 1000, not one per student
    const rank = (await count(where('points', '>', mine.points || 0))) + 1;
    return { rank, of: Math.max(rank, await count()), courses, tests, subs: await mySubs(me.uid), atts: await myAttempts(me.uid), mine, daily: dailyOf((await questions()).filter(isPublic)) };
  });
  if (!d) return <Loading />;
  const today = dayKey(new Date());
  const mine = d.mine, { rank, of } = d;
  const days = activityByDay(d.subs);
  const week = Array.from({ length: 7 }, (_, i) => days[dayKey(new Date(Date.now() - i * 864e5))] ? 1 : 0).reduce((a, b) => a + b, 0); // active days in the last 7
  const cards = d.courses.flatMap(c => c.testIds.map(t => ({ c, t: d.tests.find(x => x.id === t) }))).filter(x => x.t);
  return (
    <div className="flex flex-col gap-5">
      <Hero>
        <div className="grid gap-8 grid-cols-[1fr_auto] max-tablet:grid-cols-1 items-center">
          <div className="flex flex-col gap-5 min-w-0">
            <div className="flex flex-col gap-1">
              <HeroTitle>{mine.points ? `Rank #${rank}` : "Let's get started."}</HeroTitle>
              <span className="text-muted text-[15px]">{mine.points ? `of ${plural(of, 'student')} on the leaderboard` : 'Solve your first problem to join the leaderboard.'}</span>
            </div>
            <div className="grid grid-cols-4 max-phone:grid-cols-2 gap-3">
              {[['flame', 'Streak', `${mine.streak || 0}`, mine.lastDay === today ? 'done today' : 'due today'],
                ['star', 'Points', `${mine.points || 0}`, `+${SOLVE_POINTS} per solve`],
                ['check', 'Solved', `${solvedIds(d.subs).size}`, 'problems'],
                ['book', 'Courses', `${d.courses.length}`, `${d.courses.filter(c => c.completed).length} completed`]].map(([icon, label, big]) => (
                <div key={label} className="rounded-lg bg-soft border border-line p-4 max-phone:p-3 flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted"><Icon name={icon} size={14} />{label}</span>
                  <b className="font-display text-[30px] max-phone:text-[24px] leading-none">{big}</b>
                </div>
              ))}
            </div>
            {d.daily && (
              <div className="flex flex-wrap gap-x-4 gap-y-3 items-center">
                <Link to="/contest" className={heroBtn}>Today's challenge: {d.daily.title}<span className="transition-transform duration-200 group-hover/go:translate-x-1"><Icon name="arrow" size={18} stroke={2.4} /></span></Link>
                <Link to="/problems" className="text-ink-2 hover:text-accent-ink text-[14px] font-semibold no-underline">Browse problems →</Link>
              </div>
            )}
          </div>
          <div className="justify-self-center">
            <Ring pct={(100 * week) / 7}>
              <b className="text-[36px] leading-none font-display">{week}/7</b>
              <span className="text-muted text-[12px] mt-1.5 max-w-24">days active this week</span>
            </Ring>
          </div>
        </div>
      </Hero>
      <ActivityGraph subs={d.subs} />
      <PointsPromo to="/problems" label="Browse problems" />
      <H3 as="h2" className="text-[22px]">Your tests</H3>
      {cards.length === 0 ? <Empty title="No tests yet" body="Tests your trainer assigns to your courses show up here." /> : (
        <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
          {cards.map(({ c, t }) => {
            const done = d.subs.filter(s => s.testId === t.id && inCourse(s, c.id)).length, n = t.questionIds.length;
            const att = d.atts.find(a => a.id === `${me.uid}_${c.id}_${t.id}`), all = n > 0 && done >= n, over = !all && timeUp(t, att, done), started = done > 0 || !!att;
            return (
              <Card as="article" key={c.id + t.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-muted">{c.title}</span><Chip as="span" className={`${all || over ? 'bg-pass-soft! text-pass!' : 'bg-accent-soft! text-accent-ink!'}`}>{all || over ? 'Submitted' : notOpen(t) ? (windowOf(t) === 'soon' ? 'Opens soon' : 'Closed') : 'Open'}</Chip></div>
                <H3 as="h2" className="text-[23px]">{t.title}</H3>
                <div className="text-[13px] text-muted">{done}/{n} questions attempted</div>
                <Bar pct={n ? (100 * done) / n : 0} />
                <Link to={`/test/${c.id}/${t.id}`} state={{ to: '/', label: 'Dashboard' }} className={btn(all || over || (!started && notOpen(t)) ? 'ghost' : 'accent', 'md', 'self-start mt-1')}>{all || over ? 'View result' : started ? 'Continue' : notOpen(t) ? 'Details' : 'Start test'}</Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
