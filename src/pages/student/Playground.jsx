import { useState } from 'react';
import { runOnce } from '../../runner.js';
import { ENV_FILE, ENV_LABEL, Icon, STARTERS, attempt } from '../../ui.jsx';
import Editor from '../../Editor.jsx';

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
