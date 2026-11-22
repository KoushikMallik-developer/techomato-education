import { collection, getDoc, doc, limit, orderBy, query } from 'firebase/firestore';
import { db, list } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { Avatar, Empty, Icon, Loading, useLoad } from '../../ui.jsx';

/* ---------- leaderboard ---------- */
export function Leaderboard() {
  const me = useMe();
  const [rows] = useLoad(async () => { // top 50 only; your own row is added below if you are further down
    const top = await list(query(collection(db, 'leaderboard'), orderBy('xp', 'desc'), limit(50)));
    if (top.some(r => r.id === me.uid)) return top;
    const mine = await getDoc(doc(db, 'leaderboard', me.uid));
    return mine.exists() ? [...top, { id: me.uid, ...mine.data() }] : top;
  });
  if (!rows) return <Loading />;
  const board = (rows.some(r => r.id === me.uid) ? rows : [...rows, { id: me.uid, name: me.name, xp: 0, streak: 0 }]).sort((a, b) => b.xp - a.xp);
  if (!board.length) return <Empty title="No scores yet" body="Submit a test question to earn XP and appear here." />;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <p className="muted" style={{ margin: '-14px 0 0' }}>Every passed test case on a submission earns 10 XP. Submit on consecutive days to build a streak.</p>
      <section className="card stack" style={{ gap: 6 }}>
        {board.map((p, i) => (
          <div key={p.id} className="row" style={{ padding: '8px 10px', borderRadius: 12, background: p.id === me.uid ? 'var(--accent-soft)' : 'transparent' }}>
            <span className="mono small muted" style={{ width: 24 }}>{i + 1}</span>
            <Avatar name={p.name} size={32} />
            <span style={{ flexGrow: 1, fontSize: 15, fontWeight: p.id === me.uid ? 700 : 500 }}>{p.name}{p.id === me.uid && ' (you)'}</span>
            <span className="row small muted" style={{ gap: 4 }}><Icon name="flame" size={14} />{p.streak}</span>
            <span className="mono small" style={{ width: 70, textAlign: 'right' }}>{p.xp} XP</span>
          </div>
        ))}
      </section>
    </div>
  );
}
