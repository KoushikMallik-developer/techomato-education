import { signOut } from 'firebase/auth';
import { collection, getDoc, doc, query, where } from 'firebase/firestore';
import { auth, db, list } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { Avatar, Bar, Icon, Loading, StreakDots, useLoad } from '../../ui.jsx';

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
    <div className="stack" style={{ gap: 20, maxWidth: 760 }}>
      <div className="card row" style={{ gap: 20, flexWrap: 'wrap' }}>
        <Avatar name={me.name} size={72} />
        <div className="stack" style={{ gap: 4, flexGrow: 1 }}>
          <h2 className="h2" style={{ fontSize: 32 }}>{me.name}</h2>
          <span className="muted">{me.email}</span>
        </div>
        <span className={`chip ${me.subscribed ? 'chip-pass' : ''}`}>{me.subscribed ? 'Subscribed' : 'Free plan'}</span>
      </div>
      <div className="grid g3">
        {[[d.lb.xp, 'XP earned'], [solved, 'Questions fully solved'], [`${passed}/${total}`, 'Test cases passed']].map(([n, l]) => (
          <div key={l} className="card stat stack" style={{ gap: 8 }}><div className="big" style={{ fontSize: 34 }}>{n}</div><div className="small muted">{l}</div></div>
        ))}
      </div>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="between"><h3 className="h3" style={{ fontSize: 20 }}>Streak</h3><span className="row small" style={{ gap: 4 }}><Icon name="flame" size={16} color="var(--accent)" />{d.lb.streak} {d.lb.streak === 1 ? 'day' : 'days'}</span></div>
        <StreakDots n={d.lb.streak} />
      </div>
      <div className="card stack" style={{ gap: 8 }}>
        <h3 className="h3" style={{ fontSize: 20 }}>Plan</h3>
        <p className="ink2" style={{ margin: 0 }}>{me.subscribed ? 'You can resubmit any question as many times as you like.' : 'You get one graded submission per question. Ask your admin to add a subscription to resubmit.'}</p>
        <Bar pct={me.subscribed ? 100 : 25} color="var(--pass-strong)" />
      </div>
      <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => signOut(auth)}><Icon name="logout" size={18} />Log out</button>
    </div>
  );
}
