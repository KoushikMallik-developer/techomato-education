import { collection, getDoc, doc, limit, orderBy, query } from 'firebase/firestore';
import { db, list } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { Avatar, Empty, Icon, Loading, useLoad, Card } from '../../ui.jsx';

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
    <div className="flex flex-col gap-5">
      <p className="text-muted m-[-14px_0_0]">Every passed test case on a submission earns 10 XP. Submit on consecutive days to build a streak.</p>
      <Card as="section" className="flex flex-col gap-1.5">
        {board.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 p-[8px_10px] rounded-[12px]" style={{ background: p.id === me.uid ? 'var(--accent-soft)' : 'transparent' }}>
            <span className="font-mono text-[13px] text-muted w-6">{i + 1}</span>
            <Avatar name={p.name} size={32} />
            <span className="grow text-[15px]" style={{ fontWeight: p.id === me.uid ? 700 : 500 }}>{p.name}{p.id === me.uid && ' (you)'}</span>
            <span className="flex items-center text-[13px] text-muted gap-1"><Icon name="flame" size={14} />{p.streak}</span>
            <span className="font-mono text-[13px] w-17.5 text-right">{p.xp} XP</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
