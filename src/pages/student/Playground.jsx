import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { runOnce } from '../../runner.js';
import { Card, ENV_FILE, ENV_LABEL, H3, Hero, HeroPill, HeroTitle, Icon, STARTERS, attempt, btn, heroBtn } from '../../ui.jsx';
import Editor from '../../Editor.jsx';

// What you typed is kept in this browser so leaving the page does not lose it. Nothing is sent anywhere.
const KEY = 'tk-playground';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const keep = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: just not remembered */ } };

/* ---------- playground: a full-screen scratchpad to run code with your own input, nothing is graded ---------- */
export function Playground() {
  const nav = useNavigate();
  const saved = load();
  const [env, setEnv] = useState(useLocation().state?.env || saved.env || 'python'); // a language picked on the landing page wins
  const [codes, setCodes] = useState(saved.codes || {});
  const [input, setInput] = useState(saved.input || '');
  const [out, setOut] = useState(null); // {out, err, ms}
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const code = codes[env] ?? STARTERS[env];
  const web = env === 'web';
  const save = patch => keep({ env, codes, input, ...patch });
  const setCode = v => { const c = { ...codes, [env]: v }; setCodes(c); save({ codes: c }); };
  const pick = k => { setEnv(k); setOut(null); save({ env: k }); };
  const run = () => attempt(async () => {
    setBusy(true);
    try {
      if (web) { setPreview(code); return; }
      const t = performance.now();
      const r = await runOnce(env, code, input);
      setOut({ ...r, ms: Math.round(performance.now() - t) });
    } finally { setBusy(false); }
  });
  const spin = <span className="w-4 h-4 rounded-full border-[2.5px] border-r-transparent animate-spin-fast" />;
  const Head = ({ children }) => <div className="h-11 shrink-0 flex items-center gap-2 px-4 border-b border-line text-[13px] font-semibold">{children}</div>;

  return (
    <div className="h-dvh flex flex-col bg-paper max-tablet:h-auto max-tablet:min-h-dvh">
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-line bg-surface max-phone:h-auto max-phone:py-2 max-phone:flex-wrap">
        <button className="w-9 h-9 rounded-lg grid place-items-center hover:bg-soft" aria-label="Back" onClick={() => nav('/playground')}><Icon name="back" size={18} /></button>
        <span className="w-px h-6 bg-line" aria-hidden="true" />
        <h1 className="m-0 font-display font-bold text-[17px]">Playground</h1>
        <span className="text-[12px] text-muted max-phone:hidden">Try anything. Nothing is graded or saved to your account.</span>
        <span className="grow" />
        <div className="flex gap-1 rounded-xl bg-soft p-1 max-phone:order-last max-phone:w-full max-phone:overflow-x-auto" role="tablist" aria-label="Language">
          {Object.entries(ENV_LABEL).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={env === k} onClick={() => pick(k)} className={`h-8 px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap ${env === k ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>{l}</button>
          ))}
        </div>
        <button className={btn('accent', 'sm', 'min-h-10 px-5')} onClick={run} disabled={busy} title="Ctrl + Enter">
          {busy ? spin : <Icon name="play" size={13} fill="currentColor" stroke={0} />}{web ? 'Preview' : 'Run'}
        </button>
      </header>

      <div className="grow min-h-0 grid grid-cols-[minmax(0,7fr)_minmax(320px,5fr)] max-tablet:grid-cols-1">
        {/* editor */}
        <section className="flex flex-col min-h-[360px] min-w-0 bg-panel border-r border-line max-tablet:border-r-0">
          <div className="h-11 shrink-0 flex items-center justify-between gap-2 px-4 border-b border-panel-line font-mono text-[12px] text-panel-muted">
            <span className="text-panel-text">{ENV_FILE[env]}</span>
            <span className="flex items-center gap-3">
              <span className="max-laptop:hidden">Ctrl+Enter to {web ? 'preview' : 'run'}</span>
              <button className="h-7 px-2.5 rounded-md text-panel-text hover:bg-white/10 font-body font-semibold text-[13px]" onClick={() => setCode(STARTERS[env])} title="Start again from the starter code">Reset</button>
            </span>
          </div>
          <div className="grow min-h-0 flex flex-col [&>div]:grow [&>div]:min-h-0 [&>div]:rounded-none [&>div>div:first-child]:hidden">
            <Editor file={ENV_FILE[env]} value={code} onChange={setCode} onShortcut={() => !busy && run()} />
          </div>
        </section>

        {/* input and output, or the page preview */}
        {web ? (
          <section className="flex flex-col min-h-[420px] bg-surface">
            <Head><Icon name="eye" size={15} />Preview<span className="grow" />{preview && <button className="text-muted hover:text-ink" onClick={() => setPreview('')}>Clear</button>}</Head>
            {preview ? <iframe className="grow w-full bg-white border-0" title="Preview" sandbox="allow-scripts" srcDoc={preview} />
              : <div className="grow grid place-items-center p-6 text-center text-muted text-[14px]"><span className="flex flex-col items-center gap-3"><span className="w-12 h-12 rounded-xl bg-soft grid place-items-center"><Icon name="eye" size={22} /></span>Press <b className="text-ink">Preview</b> to see your page here.</span></div>}
          </section>
        ) : (
          <section className="flex flex-col min-h-0 bg-surface">
            <div className="flex flex-col h-[38%] min-h-[160px] border-b border-line">
              <Head>Input<span className="text-muted font-normal">(stdin)</span><span className="grow" />{input && <button className="text-muted hover:text-ink" onClick={() => { setInput(''); save({ input: '' }); }}>Clear</button>}</Head>
              <textarea aria-label="Program input" spellCheck="false" placeholder="Type the input your program reads, one value per line" className="grow min-h-0 resize-none border-0 outline-none bg-transparent px-4 py-3 font-mono text-[13.5px] leading-relaxed placeholder:text-muted" value={input} onChange={e => { setInput(e.target.value); save({ input: e.target.value }); }} />
            </div>
            <div className="grow min-h-[200px] flex flex-col">
              <Head>
                Output
                {busy ? <span className="flex items-center gap-2 text-muted font-normal">{spin}Running…</span>
                  : out && <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] ${out.err ? 'bg-warn-soft text-warn' : 'bg-pass-soft text-pass'}`}><Icon name={out.err ? 'x' : 'check'} size={12} stroke={2.6} />{out.err ? 'Error' : 'Finished'}</span>}
                <span className="grow" />
                {out && !busy && <span className="font-mono text-[12px] text-muted font-normal">{out.ms} ms</span>}
                {out && !busy && <button className="text-muted hover:text-ink" onClick={() => setOut(null)}>Clear</button>}
              </Head>
              <div className="grow min-h-0 overflow-auto bg-panel">
                {!out ? <p className="m-0 p-4 font-mono text-[13px] text-panel-muted">{busy ? '' : '> Press Run to see what your program prints. The first Python run takes a few seconds to load.'}</p>
                  : <pre className="m-0 p-4 font-mono text-[13.5px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: out.err ? 'var(--rose)' : 'var(--panel-text)' }}>{out.err || out.out || '(no output)'}</pre>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------- playground landing: what it is, then a button into the editor ---------- */
const LANG_INFO = { python: ['.py', 'Scripts, maths and quick experiments'], js: ['.js', 'Logic and data, the language of the web'], cpp: ['.cpp', 'Fast, compiled, competition ready'], web: ['.html', 'Build a page and see it live'] };
export function PlaygroundHome() {
  const last = load().env;
  return (
    <div className="flex flex-col gap-5">
      <Hero>
        <div className="grid gap-8 grid-cols-[1fr_auto] max-tablet:grid-cols-1 items-center">
          <div className="flex flex-col gap-5 min-w-0">
            <div><HeroPill>Playground</HeroPill></div>
            <HeroTitle>Code freely. Break things.</HeroTitle>
            <div className="flex flex-wrap gap-x-4 gap-y-3 items-center">
              <Link to="/playground/editor" className={heroBtn}>Open the playground<span className="transition-transform duration-200 group-hover/go:translate-x-1"><Icon name="arrow" size={18} stroke={2.4} /></span></Link>
              {last && <span className="text-muted text-[14px]">Your {ENV_LABEL[last]} code is waiting where you left it.</span>}
            </div>
          </div>
          <div className="justify-self-center w-[300px] max-phone:w-full rounded-lg bg-panel text-panel-text border border-panel-line font-mono text-[13px] leading-relaxed overflow-hidden shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)]" aria-hidden="true">
            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-panel-line"><span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" /><span className="ml-2 text-muted text-[12px]">hello.py</span></div>
            <div className="p-4 flex flex-col">
              <span><span className="text-[#FF8A5B]">name</span> = input()</span>
              <span><span className="text-[#9DB9F2]">print</span>(<span className="text-[#F0B27A]">{'f"Hi {name}!"'}</span>)</span>
              <span className="mt-3 text-panel-muted"># output</span>
              <span className="text-[#28C840]">Hi Ananya!<span className="inline-block w-2 h-4 align-middle ml-1 bg-[#FF8A5B] animate-pulse" /></span>
            </div>
          </div>
        </div>
      </Hero>

      <section className="flex flex-col gap-3">
        <H3 as="h2" className="text-[22px]">Pick a language</H3>
        <div className="grid gap-4 grid-cols-4 max-laptop:grid-cols-2 max-phone:grid-cols-1">
          {Object.entries(ENV_LABEL).map(([k, l]) => (
            <Link key={k} to="/playground/editor" state={{ env: k }} className="no-underline group/lang">
              <Card className="h-full flex flex-col gap-3 transition-transform duration-200 group-hover/lang:-translate-y-1 group-hover/lang:border-field-line">
                <span className="w-11 h-11 rounded-xl bg-accent-soft text-accent-ink grid place-items-center font-mono font-bold text-[13px]">{LANG_INFO[k][0]}</span>
                <span className="flex flex-col gap-1"><b className="text-[17px]">{l}</b><span className="text-muted text-[14px]">{LANG_INFO[k][1]}</span></span>
                <span className="text-[13px] font-semibold mt-auto flex items-center gap-1">Start coding<span className="transition-transform group-hover/lang:translate-x-1">→</span></span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
        {[['play', 'Runs in your browser', 'No setup and no install. Python, JavaScript and C++ run on the spot.'],
          ['edit', 'Your own input', 'Type what your program reads and see exactly what it prints.'],
          ['eye', 'Live web preview', 'Write HTML, CSS and JavaScript and preview the page next to your code.']].map(([icon, t, b]) => (
          <Card key={t} className="flex gap-4 items-start">
            <span className="w-11 h-11 rounded-xl bg-soft grid place-items-center shrink-0"><Icon name={icon} size={20} /></span>
            <span className="flex flex-col gap-1"><b className="text-[16px]">{t}</b><span className="text-muted text-[14px]">{b}</span></span>
          </Card>
        ))}
      </div>

      <Card className="flex items-center gap-x-6 gap-y-2 flex-wrap text-[14px]">
        <b>Shortcuts</b>
        <span className="flex items-center gap-2 text-muted"><kbd className="font-mono text-[12px] rounded-md border border-line bg-soft px-2 py-0.5 text-ink">Ctrl + Enter</kbd>run your code</span>
        <span className="flex items-center gap-2 text-muted"><kbd className="font-mono text-[12px] rounded-md border border-line bg-soft px-2 py-0.5 text-ink">Tab</kbd>indent</span>
        <span className="text-muted">Your code is kept in this browser, so you can come back to it.</span>
      </Card>
    </div>
  );
}
