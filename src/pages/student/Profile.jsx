import { signOut } from 'firebase/auth';
import { collection, getDoc, doc, query, where } from 'firebase/firestore';
import { auth, db, list } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { Avatar, Bar, Icon, Loading, StreakDots, useLoad, Card, Chip, btn, H2, H3 } from '../../ui.jsx';

/* ---------- profile ---------- */
export function Profile() {
  const me = useMe();
  const [d] = useLoad(async () => ({
    lb: (await getDoc(doc(db, 'leaderboard', me.uid))).data() || { xp: 0, streak: 0 },
    subs: await list(query(collection(db, 'submissions'), where('userId', '==', me.uid))),
  }));
  if (!d) return <Loading />;
  const passed = d.subs.reduce((n, s) => n + s.passed, 0), total = d.subs.reduce((n, s) => n + s.total, 0);
  const solved = d.subs.filter(s => s.passed === s.total).length;
  return (
    <div className="flex flex-col gap-5 max-w-[760px]">
      <Card className="flex items-center gap-5 flex-wrap">
        <Avatar name={me.name} size={72} />
        <div className="flex flex-col gap-1 grow">
          <H2 className="text-[32px]">{me.name}</H2>
          <span className="text-muted">{me.email}</span>
        </div>
        <Chip as="span" className={`${me.subscribed ? 'bg-pass-soft! text-pass!' : ''}`}>{me.subscribed ? 'Subscribed' : 'Free plan'}</Chip>
      </Card>
      <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
        {[[d.lb.xp, 'XP earned'], [solved, 'Questions fully solved'], [`${passed}/${total}`, 'Test cases passed']].map(([n, l]) => (
          <Card key={l} className="flex flex-col gap-2"><div className="big font-display font-extrabold tracking-[-.03em] leading-none text-[34px]">{n}</div><div className="text-[13px] text-muted">{l}</div></Card>
        ))}
      </div>
      <Card className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3"><H3 className="text-[20px]">Streak</H3><span className="flex items-center text-[13px] gap-1"><Icon name="flame" size={16} color="var(--accent)" />{d.lb.streak} {d.lb.streak === 1 ? 'day' : 'days'}</span></div>
        <StreakDots n={d.lb.streak} />
      </Card>
      <Card className="flex flex-col gap-2">
        <H3 className="text-[20px]">Plan</H3>
        <p className="text-ink-2 m-0">{me.subscribed ? 'You can resubmit any question as many times as you like.' : 'You get one graded submission per question. Ask your admin to add a subscription to resubmit.'}</p>
        <Bar pct={me.subscribed ? 100 : 25} color="var(--pass-strong)" />
      </Card>
      <button className={btn('ghost', 'md', 'self-start')} onClick={() => signOut(auth)}><Icon name="logout" size={18} />Log out</button>
    </div>
  );
}
