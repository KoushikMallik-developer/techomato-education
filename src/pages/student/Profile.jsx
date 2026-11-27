import { Link } from 'react-router-dom';
import { collection, getDoc, doc, query, where } from 'firebase/firestore';
import { db, list } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { activityByDay, dayKey } from '../../score.js';
import { Avatar, Card, H3, Hero, Icon, Loading, Ring, heroBtn, useLoad } from '../../ui.jsx';

/* ---------- profile ---------- */
export function Profile() {
  const me = useMe();
  const [d] = useLoad(async () => ({
    lb: (await getDoc(doc(db, 'leaderboard', me.uid))).data() || { points: 0, streak: 0 },
    subs: await list(query(collection(db, 'submissions'), where('userId', '==', me.uid))),
  }));
  if (!d) return <Loading />;
  const passed = d.subs.reduce((n, s) => n + s.passed, 0), total = d.subs.reduce((n, s) => n + s.total, 0);
  const solved = new Set(d.subs.filter(s => s.total && s.passed === s.total).map(s => s.questionId)).size;
  const rate = total ? Math.round((100 * passed) / total) : 0;
  const streak = d.lb.streak || 0;
  const days = activityByDay(d.subs);
  const week = Array.from({ length: 7 }, (_, i) => { const t = new Date(Date.now() - (6 - i) * 864e5); return { t, n: days[dayKey(t)] || 0 }; });
  return (
    <div className="flex flex-col gap-5">
      <Hero>
        <div className="grid gap-8 grid-cols-[1fr_auto] max-tablet:grid-cols-1 items-center">
          <div className="flex flex-col gap-5 min-w-0">
            <div className="flex items-center gap-5 flex-wrap">
              <span className="rounded-full p-[2px] bg-accent"><span className="block rounded-full bg-surface p-[3px]"><Avatar name={me.name} size={80} /></span></span>
              <span className="flex flex-col gap-1 min-w-0">
                <span className="font-display font-bold text-[40px] max-phone:text-[30px] leading-none tracking-tight truncate">{me.name}</span>
                <span className="text-muted text-[14px] truncate">{me.email}</span>
                <span className={`self-start mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold ${me.subscribed ? 'bg-accent-soft text-accent-ink' : 'bg-soft text-ink-2'}`}><Icon name="shield" size={13} />{me.subscribed ? 'Subscribed' : 'Free plan'}</span>
              </span>
            </div>
            <div className="grid grid-cols-4 max-phone:grid-cols-2 gap-3">
              {[['star', 'Points', d.lb.points || 0], ['check', 'Solved', solved], ['target', 'Test cases', `${passed}/${total}`], ['flame', 'Streak', `${streak}d`]].map(([icon, l, v]) => (
                <div key={l} className="rounded-lg bg-soft border border-line p-4 max-phone:p-3 flex flex-col gap-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted"><Icon name={icon} size={13} />{l}</span>
                  <b className="font-display text-[26px] max-phone:text-[22px] leading-none truncate">{v}</b>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-3 items-center">
              <Link to="/achievements" className={heroBtn}><Icon name="medal" size={17} />My achievements</Link>
            </div>
          </div>
          <div className="justify-self-center">
            <Ring pct={rate}><b className="text-[36px] leading-none font-display">{rate}%</b><span className="text-muted text-[12px] mt-1.5 max-w-24">of test cases passed</span></Ring>
          </div>
        </div>
      </Hero>

      <div className="grid gap-4 grid-cols-2 max-tablet:grid-cols-1 items-start">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <H3 className="text-[20px]">This week</H3>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Icon name="flame" size={16} color="var(--accent)" />{streak} {streak === 1 ? 'day' : 'days'} streak</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {week.map(({ t, n }, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={`w-full aspect-square rounded-xl grid place-items-center text-[13px] font-bold ${n ? 'bg-accent text-on-accent' : 'bg-soft text-muted border border-line'} ${i === 6 ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent/50' : ''}`} title={`${n} ${n === 1 ? 'answer' : 'answers'}`}>{n ? <Icon name="check" size={15} stroke={2.6} /> : t.getDate()}</span>
                <span className="text-[11px] text-muted">{t.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
          <p className="m-0 text-[13px] text-muted">Save an answer on consecutive days to grow your streak.</p>
        </Card>

        <Card className="flex flex-col gap-4">
          <H3 className="text-[20px]">Your plan</H3>
          <div className={`rounded-xl border p-4 flex items-start gap-3 ${me.subscribed ? 'border-pass/40 bg-pass-soft' : 'border-line bg-paper'}`}>
            <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${me.subscribed ? 'bg-pass-soft text-pass' : 'bg-soft'}`}><Icon name="shield" size={18} /></span>
            <span className="flex flex-col gap-1">
              <b>{me.subscribed ? 'Subscribed' : 'Free plan'}</b>
              {me.subscribed && <span className="text-[14px] text-ink-2">Pro features</span>}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
