import { useState } from 'react';
import { runOnce } from '../../runner.js';
import { ENV_FILE, ENV_LABEL, Icon, STARTERS, attempt, Card, btn, Input, H3 } from '../../ui.jsx';
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
    <div className="flex flex-col gap-3">
      <Card className="flex items-center justify-between gap-3 p-[12px_16px] flex-wrap">
        <div className="seg flex flex-wrap gap-2 [:where(&)_button]:min-h-11 [:where(&)_button]:px-4 [:where(&)_button]:rounded-xl [:where(&)_button]:border-[1.5px] [:where(&)_button]:border-line [:where(&)_button]:bg-surface [:where(&)_button]:font-medium [:where(&)_button[aria-pressed=true]]:border-ink [:where(&)_button[aria-pressed=true]]:bg-ink [:where(&)_button[aria-pressed=true]]:text-paper [:where(&)_button[aria-pressed=true]]:font-semibold [:where(&)_button:disabled]:opacity-50 [:where(&)_button:disabled]:cursor-not-allowed">{Object.entries(ENV_LABEL).map(([k, l]) => <button key={k} aria-pressed={env === k} onClick={() => { setEnv(k); setOut(null); }}>{l}</button>)}</div>
        <button className={btn('accent')} onClick={run} disabled={busy} title="Ctrl + Enter">
          {busy ? <span className="w-4 h-4 rounded-full border-[2.5px] border-r-transparent animate-spin-fast" /> : <Icon name="play" size={14} fill="currentColor" stroke={0} />}Run
        </button>
      </Card>
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-3 min-h-[calc(100dvh-140px)] max-tablet:grid-cols-1">
        <section className="flex flex-col min-w-0">
          <Editor file={ENV_FILE[env]} right="Ctrl + Enter to run" value={code} onChange={v => setCodes({ ...codes, [env]: v })} onShortcut={() => !busy && run()} />
        </section>
        <Card as="section" className="flex flex-col gap-3 [align-self:start]">
          {env !== 'web' && (
            <>
              <label className="flex flex-col gap-1.5 [:where(&)>span]:text-[14px] [:where(&)>span]:font-semibold"><span>Input (stdin)</span><Input as="textarea" className="font-mono py-3 leading-[1.55] resize-y" rows={4} value={input} onChange={e => setInput(e.target.value)} /></label>
              <H3 className="text-[18px]">Output</H3>
              {!out ? <p className="text-[13px] text-muted m-0">Run your code to see the output here. Nothing you run here is graded or saved.</p> : (
                <pre className="font-mono text-[14px] leading-[1.75] text-panel-text m-0 overflow-x-auto bg-panel rounded-[12px] p-3.5 whitespace-pre-wrap" style={{ color: out.err ? 'var(--rose)' : 'var(--panel-text)' }}>{out.err || out.out || '(no output)'}</pre>
              )}
            </>
          )}
          {env === 'web' && (preview
            ? <iframe className="w-[100%] h-105 bg-white [border:1px_solid_var(--line)] rounded-[12px]" title="Preview" sandbox="allow-scripts" srcDoc={preview} />
            : <p className="text-[13px] text-muted m-0">Press Run to preview your page here.</p>)}
        </Card>
      </div>
    </div>
  );
}
