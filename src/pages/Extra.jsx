import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { collection, getDoc, doc, query, where } from 'firebase/firestore';
import { auth, db, list } from '../firebase.js';
import { useMe } from '../auth.jsx';
import { runOnce } from '../runner.js';
import { Avatar, Bar, ENV_FILE, ENV_LABEL, Empty, Icon, Loading, STARTERS, StreakDots, attempt, useLoad } from '../ui.jsx';
import { Editor } from './Student.jsx';

/* ---------- playground: run code with your own input, nothing is saved ---------- */
export function Playground() {
  const [env, setEnv] = useState('python');
  const [codes, setCodes] = useState({});
  const [input, setInput] = useState('');
  const [out, setOut] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const code = codes[env] ?? STARTERS[env];
  const run = () => attempt(async () => {
    setBusy(true);
    try {
      if (env === 'web') { setPreview(code); setOut(null); return; }
      setOut(await runOnce(env, code, input));
    } finally { setBusy(false); }
  });
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card between" style={{ padding: '12px 16px', flexWrap: 'wrap' }}>
        <div className="seg">{Object.entries(ENV_LABEL).map(([k, l]) => <button key={k} aria-pressed={env === k} onClick={() => { setEnv(k); setOut(null); }}>{l}</button>)}</div>
        <button className="btn btn-accent" onClick={run} disabled={busy} title="Ctrl + Enter">
          {busy ? <span className="spinner" /> : <Icon name="play" size={14} fill="currentColor" stroke={0} />}Run
        </button>
      </div>
      <div className="ws">
        <section className="stack" style={{ minWidth: 0 }}>
          <Editor file={ENV_FILE[env]} right="Ctrl + Enter to run" value={code} onChange={v => setCodes({ ...codes, [env]: v })} onShortcut={() => !busy && run()} />
        </section>
        <section className="card stack" style={{ gap: 12, alignSelf: 'start' }}>
          {env !== 'web' && (
            <>
              <label className="field"><span>Input (stdin)</span><textarea className="input mono" rows={4} value={input} onChange={e => setInput(e.target.value)} /></label>
              <h3 className="h3" style={{ fontSize: 18 }}>Output</h3>
              {!out ? <p className="small muted" style={{ margin: 0 }}>Run your code to see the output here. Nothing you run here is graded or saved.</p> : (
                <pre className="code" style={{ background: 'var(--panel)', borderRadius: 12, padding: 14, whiteSpace: 'pre-wrap', color: out.err ? '#F2B8A8' : 'var(--panel-text)' }}>{out.err || out.out || '(no output)'}</pre>
              )}
            </>
          )}
          {env === 'web' && (preview
            ? <iframe title="Preview" sandbox="allow-scripts" srcDoc={preview} style={{ width: '100%', height: 420, background: '#fff', border: '1px solid var(--line)', borderRadius: 12 }} />
            : <p className="small muted" style={{ margin: 0 }}>Press Run to preview your page here.</p>)}
        </section>
      </div>
    </div>
  );
}

/* ---------- leaderboard ---------- */
export function Leaderboard() {
  const me = useMe();
  const [rows] = useLoad(() => list(collection(db, 'leaderboard')));
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
