import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, doc, documentId, getDoc, limit, query, where } from 'firebase/firestore';
import { auth, db, list, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { dailyOf } from '../../score.js';
import { NAV } from '../../Shell.jsx';
import { isPublic } from './data.js';
import { langOfSub, typeLabel } from '../../schedule.js';
import { CodeBlock, Empty, Icon, Loading, Tabs, useLoad, Card, Chip, Btn, btn, Input, H2, H3, notify } from '../../ui.jsx';

const mySubs = uid => list(query(collection(db, 'submissions'), where('userId', '==', uid)));
export const solvedIds = subs => new Set(subs.filter(s => s.passed === s.total).map(s => s.questionId));

/* The question of the day: the same for everyone, changes at midnight. shortcut: picks by day number, so adding questions reshuffles it. */

export function useCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const end = new Date(); end.setHours(23, 59, 59, 0);
  const s = Math.max(0, Math.floor((end - now) / 1000)), p = x => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/* ---------- problems bank ---------- */
const Seg = ({ value, onChange, options }) => (
  <div className="seg flex flex-wrap gap-2 [:where(&)_button]:min-h-11 [:where(&)_button]:px-4 [:where(&)_button]:rounded-xl [:where(&)_button]:border-[1.5px] [:where(&)_button]:border-line [:where(&)_button]:bg-surface [:where(&)_button]:font-medium [:where(&)_button[aria-pressed=true]]:border-ink [:where(&)_button[aria-pressed=true]]:bg-ink [:where(&)_button[aria-pressed=true]]:text-paper [:where(&)_button[aria-pressed=true]]:font-semibold [:where(&)_button:disabled]:opacity-50 [:where(&)_button:disabled]:cursor-not-allowed">{options.map(([k, l]) => <button className="min-h-10" key={k} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}</div>
);

// The bank can hold thousands of questions, so Problems reads it in pages. Level and "Web page" are filtered by Firestore;
// private questions and "Programming" are dropped here, and more raw pages are read until a page is full.
// shortcut: the search box only covers the problems already loaded (press Load more to reach the rest). Server-side title search needs an index per filter combination.
const PAGE = 50, RAW = 100;
async function fetchProblems(f, after) {
  const base = [...(f.diff !== 'all' ? [where('diff', '==', f.diff)] : []), ...(f.env === 'web' ? [where('env', '==', 'web')] : [])];
  const rows = [];
  let cur = after, more = true;
  while (rows.length < PAGE && more) {
    const got = await list(query(collection(db, 'questions'), ...base, ...(cur ? [where(documentId(), '>', cur)] : []), limit(RAW)));
    got.forEach(q => { if (isPublic(q) && (f.env !== 'code' || q.env !== 'web')) rows.push(q); });
    more = got.length === RAW;
    cur = got.at(-1)?.id ?? cur;
  }
  return { rows, cur, more };
}

export function Problems() {
  const me = useMe();
  const [subs] = useLoad(() => mySubs(me.uid));
  const [f, setF] = useState({ text: '', env: 'all', diff: 'all', status: 'all' });
  const [pg, setPg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setPg(null);
    fetchProblems(f).then(p => live && setPg(p)).catch(e => { console.error(e); notify('Could not load problems. Check your connection and refresh.'); });
    return () => { live = false; };
  }, [f.diff, f.env]); // text and status only filter what is already loaded
  const more = async () => {
    setBusy(true);
    try { const n = await fetchProblems(f, pg.cur); setPg({ rows: [...pg.rows, ...n.rows], cur: n.cur, more: n.more }); } catch (e) { console.error(e); notify('Could not load more problems.'); }
    setBusy(false);
  };
  const d = subs && { qs: pg?.rows || [], subs };
  if (!d) return <Loading />;
  const done = solvedIds(d.subs);
  const rows = d.qs.filter(q =>
    (f.env === 'all' || (f.env === 'web') === (q.env === 'web')) && (f.diff === 'all' || q.diff === f.diff) &&
    (f.status === 'all' || (f.status === 'solved') === done.has(q.id)) &&
    `${q.title} ${q.topic || ''}`.toLowerCase().includes(f.text.toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted m-[-14px_0_0]">Practice on any question in the bank. The free plan gives one graded submission per question.</p>
      <div className="flex flex-col gap-2.5">
        <Input type="search" placeholder="Search by title or topic" aria-label="Search problems" value={f.text} onChange={e => setF({ ...f, text: e.target.value })} />
        <div className="flex flex-wrap gap-x-6 gap-y-2.5 [&_.seg]:gap-1.5 [&_.seg_button]:min-h-10 [&_.seg_button]:pointer-coarse:min-h-11 [&_.seg_button]:px-3.5 [&_.seg_button]:text-[14px] [&_.seg_button]:rounded-full">
          <Seg value={f.env} onChange={env => setF({ ...f, env })} options={[['all', 'All types'], ['code', 'Programming'], ['web', 'Web page']]} />
          <Seg value={f.diff} onChange={diff => setF({ ...f, diff })} options={[['all', 'Any level'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']]} />
          <Seg value={f.status} onChange={status => setF({ ...f, status })} options={[['all', 'All'], ['todo', 'To do'], ['solved', 'Solved']]} />
        </div>
      </div>
      {!pg ? <Loading /> : rows.length === 0 && !pg.more ? <Empty title="No problems match" body="Try clearing a filter." /> : (
        <Card className="p-1.5">
          {rows.map(q => (
            <Link key={q.id} to={`/solve/practice/practice/${q.id}`} className="group/rl flex items-center justify-between gap-3 p-3 rounded-xl no-underline hover:bg-soft [&+&]:border-t [&+&]:border-line [&+&]:rounded-t-none hover:border-t-transparent [&:hover+&]:border-t-transparent">
              <span className="flex items-center gap-3">
                {done.has(q.id) ? <Icon name="check" size={18} stroke={2.4} color="var(--pass-strong)" /> : <span className="w-[18px] h-[18px] rounded-full border-2 border-line shrink-0" aria-hidden="true" />}
                <span className="font-semibold">{q.title}</span>
              </span>
              <span className="flex items-center gap-3 text-[13px]">
                <span className="text-muted">{q.topic}</span><Chip as="span">{typeLabel(q)}</Chip>
                {q.diff && <span className={`${{ Easy: 'text-pass', Medium: 'text-warn', Hard: 'text-accent-ink' }[q.diff]} font-bold w-14 text-right`}>{q.diff}</span>}
                <span className="text-muted transition-transform duration-150 group-hover/rl:translate-x-[3px] group-hover/rl:text-ink" aria-hidden="true">›</span>
              </span>
            </Link>
          ))}
        </Card>
      )}
      {pg?.more && <div><Btn v="ghost" onClick={more} disabled={busy}>{busy ? 'Loading…' : 'Load more problems'}</Btn></div>}
    </div>
  );
}

/* ---------- daily contest ---------- */
export function Contest() {
  const me = useMe();
  const left = useCountdown();
  const [d] = useLoad(async () => {
    const q = dailyOf((await questions()).filter(isPublic));
    const all = q ? await mySubs(me.uid).then(a => a.filter(s => s.questionId === q.id)) : []; // any attempt counts: in a test or in practice
    return { q, sub: all.sort((a, b) => b.passed - a.passed)[0] || null };
  });
  if (!d) return <Loading />;
  if (!d.q) return <Empty title="No contest today" body="The question bank is empty." />;
  const { q, sub } = d, solved = sub && sub.passed === sub.total;
  return (
    <div className="flex flex-col gap-5 max-w-[760px]">
      <article className="border border-line rounded-lg shadow-[0_1px_2px_rgba(23,24,28,.04),0_8px_24px_-16px_rgba(23,24,28,.12)] transition-[box-shadow,transform,border-color] duration-200 flex flex-col gap-3.5 bg-accent text-on-accent [border:0px] p-7.5">
        <div className="flex items-center justify-between gap-3 text-[13px]"><span>Daily contest</span><span className="font-mono">{left} left</span></div>
        <H2 className="text-[40px]">{q.title}</H2>
        <div className="text-[13px]">{[q.diff, q.topic, typeLabel(q)].filter(Boolean).join(', ')}, +{10 * q.tests.length} XP</div>
        <div className="text-[13px] font-semibold">{solved ? 'Solved. Well done!' : sub ? `Last result: ${sub.passed}/${sub.total} test cases` : 'Not attempted yet'}</div>
        <Link to={`/solve/practice/practice/${q.id}`} className={btn('white', 'md', 'self-start')}>{sub ? 'View your solution' : 'Solve now'}</Link>
      </article>
      <Card className="flex flex-col gap-2">
        <H3 className="text-[20px]">How it works</H3>
        <p className="text-ink-2 m-0">A new question every day. Every passed test case earns 10 XP, and submitting on consecutive days builds your streak.</p>
      </Card>
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
  const [d] = useLoad(async () => ({ subs: await mySubs(me.uid), qs: await questions(), lb: (await getDoc(doc(db, 'leaderboard', me.uid))).data() || {} }));
  if (!d) return <Loading />;
  const done = solvedIds(d.subs);
  const s = { subs: d.subs, solved: done.size, xp: d.lb.xp || 0, streak: d.lb.streak || 0, subscribed: !!me.subscribed,
    envs: new Set(d.subs.filter(x => done.has(x.questionId)).map(x => { const q = d.qs.find(y => y.id === x.questionId); return q ? (q.env === 'web' ? 'web' : langOfSub(x, q)) : null; }).filter(Boolean)).size };
  const got = BADGES.filter(b => b[3](s)).length;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted m-[-14px_0_0]">{got} of {BADGES.length} unlocked.</p>
      <div className="grid gap-4 grid-cols-4 max-laptop:grid-cols-2">
        {BADGES.map(([name, how, icon, test]) => (
          <div key={name} className={`flex flex-col items-center text-center gap-2 py-5 px-3.5 rounded-[20px] border border-line bg-surface ${test(s) ? '' : 'opacity-55!'}`}>
            <span className={`w-16 h-16 rounded-[20px] grid place-items-center ${test(s) ? 'bg-accent-soft text-accent-ink' : 'bg-soft text-muted'}`}><Icon name={test(s) ? icon : 'lock'} size={28} /></span>
            <b>{name}</b><span className="text-[13px] text-muted">{how}</span>
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
    <div className="flex flex-col gap-4">
      <Tabs label="Language" value={tab} onChange={setTab} tabs={Object.keys(SHEETS).map(k => [k, k])} />
      {SHEETS[tab].map(([t, code]) => (
        <Card as="section" key={t} className="flex flex-col gap-2"><H3 className="text-[18px]">{t}</H3><CodeBlock code={code} /></Card>
      ))}
    </div>
  );
}

/* ---------- phone "More" tab ---------- */
export function More() {
  const me = useMe();
  return (
    <div className="flex flex-col gap-3.5">
      {(NAV[me.role] || []).map(([g, items]) => (
        <Card as="section" key={g} className="flex flex-col gap-0.5 p-2">
          <div className="text-[12px] font-bold tracking-[.08em] uppercase text-muted pt-2.5 px-3 pb-0.5">{g}</div>
          {items.map(([l, to, ic]) => <Link key={to} to={to} className="flex items-center gap-2.5 w-full min-h-[42px] py-1.5 px-2.5 rounded-sm border-0 bg-transparent text-left text-[14px] hover:bg-soft no-underline"><Icon name={ic} size={18} />{l}</Link>)}
        </Card>
      ))}
      <button className={btn('ghost', 'md', 'self-start')} onClick={() => signOut(auth)}><Icon name="logout" size={18} />Log out</button>
    </div>
  );
}
