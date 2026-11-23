import { Link } from 'react-router-dom';
import { inCourse } from '../../score.js';
import { collection, doc, getCountFromServer, getDoc, query, where } from 'firebase/firestore';
import { db, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { dailyOf, dayKey } from '../../score.js';
import { Bar, StreakDots, Empty, Icon, Loading, useLoad } from '../../ui.jsx';
import { examQuestionIds, get, isPublic, mySubs, myCourses } from './data.js';

/* ---------- dashboard ---------- */
export function Dashboard() {
  const me = useMe();
  const [d] = useLoad(async () => {
    const courses = await myCourses(me.uid);
    const tests = (await Promise.all([...new Set(courses.flatMap(c => c.testIds))].map(t => get('tests', t)))).filter(t => t && !t.draft);
    const mine = (await getDoc(doc(db, 'leaderboard', me.uid))).data() || { xp: 0, streak: 0, lastDay: '' };
    const count = async w => (await getCountFromServer(w ? query(collection(db, 'leaderboard'), w) : collection(db, 'leaderboard'))).data().count; // count queries read ~1 doc per 1000, not one per student
    const rank = (await count(where('xp', '>', mine.xp))) + 1;
    return { rank, of: Math.max(rank, await count()), courses, tests, subs: await mySubs(me.uid), mine, daily: dailyOf((await questions()).filter(isPublic), await examQuestionIds()) };
  });
  if (!d) return <Loading />;
  const passed = d.subs.reduce((n, s) => n + s.passed, 0);
  const total = d.subs.reduce((n, s) => n + s.total, 0);
  const pct = total ? Math.round((100 * passed) / total) : 0;
  const today = dayKey(new Date());
  const mine = d.mine, { rank, of } = d;
  const cards = d.courses.flatMap(c => c.testIds.map(t => ({ c, t: d.tests.find(x => x.id === t) }))).filter(x => x.t);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <p className="muted" style={{ margin: '-14px 0 0' }}>Hi {me.name.split(' ')[0]}. {cards.length ? 'Pick up where you left off.' : "Your trainer hasn't assigned a test yet."}</p>
      <div className="grid g4">
        <div className="card-dark stack stat" style={{ gap: 12 }}>
          <div className="between small" style={{ color: '#C9CBD2' }}>
            <span className="row" style={{ gap: 6 }}><Icon name="flame" size={16} color="#F2B8A8" />Streak</span>
            <span style={{ color: '#F2B8A8' }}>{mine.lastDay === today ? 'Done today' : 'Due today'}</span>
          </div>
          <div className="big">{mine.streak} {mine.streak === 1 ? 'day' : 'days'}</div>
          <StreakDots n={mine.streak} dark />
        </div>
        <div className="card stack stat" style={{ gap: 12 }}>
          <div className="small muted">Questions attempted</div>
          <div className="big">{d.subs.length}</div>
          <div className="small ink2">across {new Set(d.subs.map(s => s.testId).filter(t => t !== 'practice')).size} tests</div>
        </div>
        <div className="card stack stat" style={{ gap: 12 }}>
          <div className="small muted">Test cases passed</div>
          <div className="big">{passed}/{total}</div>
          <Bar pct={pct} color="var(--pass-strong)" />
        </div>
        <Link to="/leaderboard" className="card stack stat" style={{ gap: 12, textDecoration: 'none' }}>
          <div className="small muted">Leaderboard</div>
          <div className="big">#{rank}</div>
          <div className="small ink2">of {of}, {mine.xp} XP</div>
        </Link>
      </div>
      {d.daily && (
        <Link to="/contest" className="card between" style={{ background: 'var(--accent)', color: 'var(--on-accent)', border: 0, textDecoration: 'none', flexWrap: 'wrap', gap: 12 }}>
          <span className="stack" style={{ gap: 2 }}><span className="small">Daily contest</span><b style={{ fontSize: 20 }}>{d.daily.title}</b></span>
          <span className="btn btn-white">Solve today's question</span>
        </Link>
      )}
      <h2 className="h3" style={{ fontSize: 22 }}>Your tests</h2>
      {cards.length === 0 ? <Empty title="No tests yet" body="Tests your trainer assigns to your courses show up here." /> : (
        <div className="grid g3">
          {cards.map(({ c, t }) => {
            const done = d.subs.filter(s => s.testId === t.id && inCourse(s, c.id)).length;
            return (
              <article key={c.id + t.id} className="card stack" style={{ gap: 12 }}>
                <div className="between"><span className="small muted">{c.title}</span><span className={`chip ${done === t.questionIds.length ? 'chip-pass' : 'chip-accent'}`}>{done === t.questionIds.length ? 'Attempted' : 'Open'}</span></div>
                <h2 className="h3" style={{ fontSize: 23 }}>{t.title}</h2>
                <div className="small muted">{done}/{t.questionIds.length} questions attempted</div>
                <Bar pct={t.questionIds.length ? (100 * done) / t.questionIds.length : 0} />
                <Link to={`/test/${c.id}/${t.id}`} className="btn btn-ink" style={{ alignSelf: 'flex-start', marginTop: 4 }}>{done ? 'Continue' : 'Start test'}</Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
