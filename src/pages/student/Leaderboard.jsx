import { collection, getDoc, doc, limit, orderBy, query } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db, list } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { COURSE_POINTS, SOLVE_POINTS } from '../../score.js';
import { payRewards } from './rewards.js';
import { Avatar, Card, Empty, Hero, HeroPill, HeroTitle, Icon, Loading, heroBtn, plural, useLoad } from '../../ui.jsx';

// Podium colours for 1st, 2nd and 3rd.
const MEDAL = [['#F5C84B', '#B8860B'], ['#D9DDE3', '#8A9099'], ['#E0A36B', '#9A5B2A']];

/* ---------- leaderboard ---------- */
export function Leaderboard() {
  const me = useMe();
  const [rows] = useLoad(async () => { // top 50 only; your own row is added below if you are further down
    await payRewards(me).catch(() => {});
    const top = await list(query(collection(db, 'leaderboard'), orderBy('points', 'desc'), limit(50)));
    if (top.some(r => r.id === me.uid)) return top;
    const mine = await getDoc(doc(db, 'leaderboard', me.uid));
    return mine.exists() ? [...top, { id: me.uid, ...mine.data() }] : top;
  });
  if (!rows) return <Loading />;
  const board = (rows.some(r => r.id === me.uid) ? rows : [...rows, { id: me.uid, name: me.name, points: 0, streak: 0 }]).sort((a, b) => (b.points || 0) - (a.points || 0));
  if (!board.length) return <Empty title="No scores yet" body="Solve a problem in Practice to earn points and appear here." />;
  const myRank = board.findIndex(p => p.id === me.uid) + 1, mine = board[myRank - 1];
  const ahead = myRank > 1 ? board[myRank - 2] : null;
  const gap = ahead ? (ahead.points || 0) - (mine.points || 0) : 0;
  const top = board[0].points || 1;
  const podium = [board[1], board[0], board[2]]; // 2nd, 1st, 3rd so the winner stands in the middle
  const rest = board.slice(3);
  return (
    <div className="flex flex-col gap-5">
      <Hero>
        <div className="grid gap-8 grid-cols-[1fr_auto] max-laptop:grid-cols-1 items-center">
          <div className="flex flex-col gap-5 min-w-0">
            <div><HeroPill>Leaderboard</HeroPill></div>
            <HeroTitle>You are #{myRank}</HeroTitle>
            <p className="m-0 text-ink-2 text-[16px] leading-relaxed max-w-[520px]">
              {myRank === 1 ? 'You are at the top. Keep solving to stay there.' : gap === 0 ? `You are level with ${ahead.name}. One more solve puts you ahead.` : `${plural(gap, 'point')} behind ${ahead.name}. That is about ${plural(Math.ceil(gap / SOLVE_POINTS), 'solve')}.`}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[['star', 'Points', mine.points || 0], ['flame', 'Streak', `${mine.streak || 0} ${(mine.streak || 0) === 1 ? 'day' : 'days'}`], ['users', 'Players', board.length]].map(([icon, l, v]) => (
                <div key={l} className="rounded-lg bg-soft border border-line px-4 py-3 flex flex-col gap-0.5 min-w-0">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted"><Icon name={icon} size={13} />{l}</span>
                  <b className="font-display text-[24px] leading-none">{v}</b>
                </div>
              ))}
            </div>
            <div><Link to="/problems" className={heroBtn}>Earn {SOLVE_POINTS} points<span className="transition-transform duration-200 group-hover/go:translate-x-1"><Icon name="arrow" size={18} stroke={2.4} /></span></Link></div>
          </div>

          {/* podium */}
          <div className="flex items-end justify-center gap-3 max-phone:gap-2" aria-label="Top three">
            {podium.map((p, i) => {
              const place = [2, 1, 3][i];
              if (!p) return <div key={i} className="w-28 max-phone:w-24" />;
              const [c1, c2] = MEDAL[place - 1];
              return (
                <div key={p.id} className="flex flex-col items-center gap-2 w-28 max-phone:w-24 animate-rise2" style={{ animationDelay: `${place * 120}ms` }}>
                  {place === 1 && <span style={{ color: c1 }}><Icon name="trophy" size={26} stroke={2} /></span>}
                  <span className="rounded-full p-[3px]" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}><span className="block rounded-full bg-surface p-[2px]"><Avatar name={p.name} size={place === 1 ? 56 : 46} /></span></span>
                  <b className={`text-[14px] text-center leading-tight truncate w-full ${p.id === me.uid ? 'text-accent-ink' : ''}`}>{p.id === me.uid ? 'You' : p.name.split(' ')[0]}</b>
                  <span className="font-mono text-[12px] text-muted">{p.points || 0} pts</span>
                  <div className="w-full rounded-t-lg grid place-items-start justify-center pt-2 font-display font-bold text-[28px] text-[#17181C]" style={{ height: [92, 130, 70][i], background: `linear-gradient(180deg, ${c1}, ${c2})` }}>{place}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Hero>

      {rest.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-[48px_1fr_90px_minmax(0,220px)] max-tablet:grid-cols-[40px_1fr_80px] gap-4 px-5 py-3 border-b border-line text-[12px] font-semibold uppercase tracking-wider text-muted" aria-hidden="true">
            <span>Rank</span><span>Student</span><span>Streak</span><span className="max-tablet:hidden">Points</span>
          </div>
          {rest.map((p, i) => {
            const you = p.id === me.uid;
            return (
              <div key={p.id} className={`grid grid-cols-[48px_1fr_90px_minmax(0,220px)] max-tablet:grid-cols-[40px_1fr_80px] items-center gap-4 px-5 py-3 [&+&]:border-t [&+&]:border-line ${you ? 'bg-accent-soft' : 'hover:bg-soft'}`}>
                <span className="font-mono text-[14px] font-bold text-muted">#{i + 4}</span>
                <span className="flex items-center gap-3 min-w-0">
                  <Avatar name={p.name} size={34} />
                  <span className="flex flex-col min-w-0">
                    <span className={`truncate text-[15px] ${you ? 'font-bold' : 'font-medium'}`}>{p.name}{you && ' (you)'}</span>
                    <span className="hidden max-tablet:block font-mono text-[12px] text-muted">{p.points || 0} pts</span>
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[14px] text-muted"><Icon name="flame" size={15} />{p.streak || 0}</span>
                <span className="flex items-center gap-3 max-tablet:hidden">
                  <span className="grow h-2 rounded-full bg-soft overflow-hidden"><span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (100 * (p.points || 0)) / top)}%` }} /></span>
                  <span className="font-mono text-[13px] w-16 text-right">{p.points || 0}</span>
                </span>
              </div>
            );
          })}
        </Card>
      )}
      <p className="text-[13px] text-muted m-0">Points: {SOLVE_POINTS} for each problem you fully solve in Practice; 25, 100 or 200 for scoring 60%, 75% or 100% in a test; {COURSE_POINTS} for completing a course. Each is earned once. The board shows the top 50.</p>
    </div>
  );
}
