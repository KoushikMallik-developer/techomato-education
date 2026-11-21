import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, query, where } from 'firebase/firestore';
import { auth, db, list } from '../firebase.js';
import { useMe } from '../auth.jsx';
import { NAV } from '../Shell.jsx';
import { CodeBlock, ENV_LABEL, Empty, Icon, Loading, Tabs, useLoad } from '../ui.jsx';

const mySubs = uid => list(query(collection(db, 'submissions'), where('userId', '==', uid)));
export const solvedIds = subs => new Set(subs.filter(s => s.passed === s.total).map(s => s.questionId));

/* The question of the day: the same for everyone, changes at midnight. shortcut: picks by day number, so adding questions reshuffles it. */
export const dailyOf = qs => (qs.length ? [...qs].sort((a, b) => a.id.localeCompare(b.id))[Math.floor(Date.now() / 864e5) % qs.length] : null);

export function useCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const end = new Date(); end.setHours(23, 59, 59, 0);
  const s = Math.max(0, Math.floor((end - now) / 1000)), p = x => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/* ---------- problems bank ---------- */
const Seg = ({ value, onChange, options }) => (
  <div className="seg">{options.map(([k, l]) => <button key={k} aria-pressed={value === k} onClick={() => onChange(k)} style={{ minHeight: 40 }}>{l}</button>)}</div>
);

export function Problems() {
  const me = useMe();
  const [d] = useLoad(async () => ({ qs: await list(collection(db, 'questions')), subs: await mySubs(me.uid) }));
  const [f, setF] = useState({ text: '', env: 'all', diff: 'all', status: 'all' });
  if (!d) return <Loading />;
  const done = solvedIds(d.subs);
  const rows = d.qs.filter(q =>
    (f.env === 'all' || q.env === f.env) && (f.diff === 'all' || q.diff === f.diff) &&
    (f.status === 'all' || (f.status === 'solved') === done.has(q.id)) &&
    `${q.title} ${q.topic || ''}`.toLowerCase().includes(f.text.toLowerCase()));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="muted" style={{ margin: '-14px 0 0' }}>Practice on any question in the bank. The free plan gives one graded submission per question.</p>
      <div className="stack" style={{ gap: 10 }}>
        <input className="input" type="search" placeholder="Search by title or topic" aria-label="Search problems" value={f.text} onChange={e => setF({ ...f, text: e.target.value })} />
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <Seg value={f.env} onChange={env => setF({ ...f, env })} options={[['all', 'All languages'], ...Object.entries(ENV_LABEL)]} />
          <Seg value={f.diff} onChange={diff => setF({ ...f, diff })} options={[['all', 'Any level'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']]} />
          <Seg value={f.status} onChange={status => setF({ ...f, status })} options={[['all', 'All'], ['todo', 'To do'], ['solved', 'Solved']]} />
        </div>
      </div>
      {rows.length === 0 ? <Empty title="No problems match" body="Try clearing a filter." /> : (
        <div className="card" style={{ padding: 6 }}>
          {rows.map(q => (
            <Link key={q.id} to={`/solve/practice/${q.id}`} className="rowlink">
              <span className="row">
                {done.has(q.id) ? <Icon name="check" size={18} stroke={2.4} color="var(--pass-strong)" /> : <span style={{ width: 18 }} />}
                <span style={{ fontWeight: 600 }}>{q.title}</span>
              </span>
              <span className="row small">
                <span className="muted">{q.topic}</span><span className="chip">{ENV_LABEL[q.env]}</span>
                {q.diff && <span className={`diff-${q.diff}`} style={{ fontWeight: 700, width: 56, textAlign: 'right' }}>{q.diff}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- daily contest ---------- */
export function Contest() {
  const me = useMe();
  const left = useCountdown();
  const [d] = useLoad(async () => {
    const q = dailyOf(await list(collection(db, 'questions')));
    const sub = q && (await getDoc(doc(db, 'submissions', `${me.uid}_practice_${q.id}`)));
    return { q, sub: sub?.exists() ? sub.data() : null };
  });
  if (!d) return <Loading />;
  if (!d.q) return <Empty title="No contest today" body="The question bank is empty." />;
  const { q, sub } = d, solved = sub && sub.passed === sub.total;
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 760 }}>
      <article className="card stack" style={{ gap: 14, background: 'var(--accent)', color: 'var(--on-accent)', border: 0, padding: 30 }}>
        <div className="between small"><span>Daily contest</span><span className="mono">{left} left</span></div>
        <h2 className="h2" style={{ fontSize: 40 }}>{q.title}</h2>
        <div className="small">{[q.diff, q.topic, ENV_LABEL[q.env]].filter(Boolean).join(', ')}, +{10 * q.tests.length} XP</div>
        <div className="small" style={{ fontWeight: 600 }}>{solved ? 'Solved. Well done!' : sub ? `Last result: ${sub.passed}/${sub.total} test cases` : 'Not attempted yet'}</div>
        <Link to={`/solve/practice/${q.id}`} className="btn btn-white" style={{ alignSelf: 'flex-start' }}>{sub ? 'View your solution' : 'Solve now'}</Link>
      </article>
      <div className="card stack" style={{ gap: 8 }}>
        <h3 className="h3" style={{ fontSize: 20 }}>How it works</h3>
        <p className="ink2" style={{ margin: 0 }}>A new question every day. Every passed test case earns 10 XP, and submitting on consecutive days builds your streak.</p>
      </div>
    </div>
  );
}

/* ---------- achievements ---------- */
const BADGES = [
  ['First steps', 'Submit your first answer', 'play', s => s.subs.length >= 1],
  ['Green across the board', 'Pass every test case on a question', 'check', s => s.solved >= 1],
  ['High five', 'Fully solve 5 questions', 'star', s => s.solved >= 5],
  ['Polyglot', 'Solve questions in 2 languages', 'code', s => s.envs >= 2],
  ['Century', 'Earn 100 XP', 'target', s => s.xp >= 100],
  ['On a roll', 'Reach a 3-day streak', 'flame', s => s.streak >= 3],
  ['Week warrior', 'Reach a 7-day streak', 'medal', s => s.streak >= 7],
  ['Supporter', 'Have an active subscription', 'shield', s => s.subscribed],
];
export function Achievements() {
  const me = useMe();
  const [d] = useLoad(async () => ({ subs: await mySubs(me.uid), qs: await list(collection(db, 'questions')), lb: (await getDoc(doc(db, 'leaderboard', me.uid))).data() || {} }));
  if (!d) return <Loading />;
  const done = solvedIds(d.subs);
  const s = { subs: d.subs, solved: done.size, xp: d.lb.xp || 0, streak: d.lb.streak || 0, subscribed: !!me.subscribed,
    envs: new Set(d.qs.filter(q => done.has(q.id)).map(q => q.env)).size };
  const got = BADGES.filter(b => b[3](s)).length;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="muted" style={{ margin: '-14px 0 0' }}>{got} of {BADGES.length} unlocked.</p>
      <div className="grid g4">
        {BADGES.map(([name, how, icon, test]) => (
          <div key={name} className={`badge-tile ${test(s) ? '' : 'locked'}`}>
            <span className="badge-icon"><Icon name={test(s) ? icon : 'lock'} size={28} /></span>
            <b>{name}</b><span className="small muted">{how}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- cheat sheets ---------- */
const SHEETS = {
  Python: [['Read input', 'n = int(input())\na, b = map(int, input().split())'], ['Loop', 'for i in range(n):\n    print(i)'], ['List tricks', 'nums = [3, 1, 2]\nnums.sort()\nprint(sum(nums), max(nums), len(nums))'], ['Dictionary count', 'count = {}\nfor w in words:\n    count[w] = count.get(w, 0) + 1'], ['Function', 'def area(w, h):\n    return w * h']],
  JavaScript: [['Read input', 'const n = Number(input());\nconst [a, b] = input().split(" ").map(Number);'], ['Loop', 'for (let i = 0; i < n; i++) {\n  console.log(i);\n}'], ['Array methods', 'const doubled = nums.map(x => x * 2);\nconst big = nums.filter(x => x > 2);\nconst total = nums.reduce((s, x) => s + x, 0);'], ['Object count', 'const count = {};\nfor (const w of words) count[w] = (count[w] || 0) + 1;']],
  'C++': [['Skeleton', '#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n    return 0;\n}'], ['Loop', 'for (int i = 0; i < n; i++) {\n    cout << i << endl;\n}'], ['Strings', 'string s;\ncin >> s;\ncout << s.length() << endl;']],
  'HTML & CSS': [['Page skeleton', '<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    h1 { color: red; }\n  </style>\n</head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>'], ['Flexbox row', '.row {\n  display: flex;\n  gap: 12px;\n  align-items: center;\n}'], ['Click handler', '<button id="b">Click</button>\n<script>\n  document.getElementById("b").onclick = () => alert("Hi");\n</script>']],
};
export function CheatSheets() {
  const [tab, setTab] = useState('Python');
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Tabs label="Language" value={tab} onChange={setTab} tabs={Object.keys(SHEETS).map(k => [k, k])} />
      {SHEETS[tab].map(([t, code]) => (
        <section key={t} className="card stack" style={{ gap: 8 }}><h3 className="h3" style={{ fontSize: 18 }}>{t}</h3><CodeBlock code={code} /></section>
      ))}
    </div>
  );
}

/* ---------- phone "More" tab ---------- */
export function More() {
  const me = useMe();
  return (
    <div className="stack" style={{ gap: 14 }}>
      {(NAV[me.role] || []).map(([g, items]) => (
        <section key={g} className="card stack" style={{ gap: 2, padding: 8 }}>
          <div className="side-group">{g}</div>
          {items.map(([l, to, ic]) => <Link key={to} to={to} className="les-link" style={{ textDecoration: 'none' }}><Icon name={ic} size={18} />{l}</Link>)}
        </section>
      ))}
      <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => signOut(auth)}><Icon name="logout" size={18} />Log out</button>
    </div>
  );
}
