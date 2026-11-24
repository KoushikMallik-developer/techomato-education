import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { courseCode } from './schedule.js';

/* ---------- icons + logo (paths copied from the artifact) ---------- */
const ICONS = {
  home: 'M3 11.5l9-7.5 9 7.5M5 10v10h14V10',
  book: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5zM13 4h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13z',
  check: 'M5 12.5l4.5 4.5L20 6.5', x: 'M6 6l12 12M18 6L6 18',
  clip: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12l2 2 4-4',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4.5-6.5',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14M13 6l6 6-6 6', back: 'M15 6l-6 6 6 6', play: 'M7 4.5l12 7.5-12 7.5z',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  logout: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5', list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  flame: 'M12 22c4 0 7-2.7 7-6.8 0-4-3-6.2-4.3-9.7-.3 2.6-1.6 3.9-3 4.4.4-3.3-.9-6.2-3.7-7.9.3 3.8-3 6.4-3 11.2C5 19.3 8 22 12 22z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.2 14H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6V4.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  medal: 'M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 11 5 2h4l3 6M15.5 11 19 2h-4l-2.2 4.5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  cohort: 'M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6', shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4',
};
export function Icon({ name, size = 20, stroke = 1.9, color = 'currentColor', fill = 'none' }) {
  return (
    <svg className="shrink-0" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}
export function Logo({ size = 30, text = true, dark = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display font-extrabold text-[22px] tracking-[-.02em] no-underline shrink-0 [:where(&)_svg]:shrink-0 ${dark ? 'text-cream' : 'text-ink'}`}>
      <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="19" r="14" fill="var(--accent)" />
        <path d="M13 5c2 2 6 2 8 0" stroke="var(--leaf)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M12.5 15.5 9 19l3.5 3.5M21.5 15.5 25 19l-3.5 3.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {text && 'techomato'}
    </span>
  );
}

/* ---------- small pieces ---------- */
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const initials =s => (s || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
export const Avatar = ({ name, size = 40, dark = false }) => <span className={`rounded-full ${dark ? 'bg-cream text-night' : 'bg-ink text-paper'} inline-flex items-center justify-center font-bold shrink-0`} style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</span>;
export function StreakDots({ n, dark }) {
  const filled = n <= 0 ? 0 : n % 7 === 0 ? 7 : n % 7;
  return <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-[5px]" aria-hidden="true">{Array.from({ length: 7 }).map((_, i) => <span className="h-2 rounded-[4px]" key={i} style={{ background: i < filled ? 'var(--accent)' : dark ? '#3A3D46' : 'var(--soft)' }} />)}</div>;
}
export const Bar = ({ pct, color, fill = '', track = 'bg-soft', ...p }) => <div {...p} className={`h-2 rounded overflow-hidden ${track} [:where(&)>span]:block [:where(&)>span]:h-full [:where(&)>span]:rounded [:where(&)>span]:bg-ink [:where(&)>span]:transition-[width] [:where(&)>span]:duration-500`}><span className={fill} style={{ width: Math.max(0, Math.min(100, pct)) + '%', background: color }} /></div>;
const BTN = 'inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] font-semibold no-underline whitespace-nowrap transition-[transform,background] duration-150 active:scale-[.97] disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_V = { ink: 'border-transparent bg-panel text-cream', accent: 'border-transparent bg-[#C8381F] text-white hover:brightness-[.94]', ghost: 'border-ink bg-transparent text-ink hover:bg-soft', plain: 'border-transparent bg-transparent text-ink', white: 'border-transparent bg-white text-night' };
const BTN_S = { md: 'min-h-11 px-5 text-[15px]', sm: 'min-h-9 px-3.5 text-[13px] pointer-coarse:min-h-11', lg: 'min-h-14 px-[30px] text-[17px]' };
// Button look for <button>, <Link> and <a>: className={btn('ghost', 'sm', 'self-start')}
export const btn = (v = 'ink', size = 'md', extra = '') => `${BTN} ${BTN_V[v]} ${BTN_S[size]} ${extra}`;
export const Btn = ({ v = 'ink', size = 'md', className = '', ...p }) => <button {...p} className={btn(v, size, className)} />;
// Card pads 22px (18px on phones) unless the className sets its own padding; Chip is the small rounded label.
const CARD = 'bg-surface border border-line rounded-lg shadow-[0_1px_2px_rgba(23,24,28,.04),0_8px_24px_-16px_rgba(23,24,28,.12)] transition-[box-shadow,transform,border-color] duration-200';
export const Card = ({ as: T = 'div', className = '', ...p }) => <T {...p} className={`${CARD} ${/(^| )(max-\w+:)?p[xytblr]?-/.test(className) ? '' : 'p-[22px] max-phone:p-[18px]'} ${className}`} />;
const TONE = { soft: 'bg-soft', pass: 'bg-pass-soft text-pass', warn: 'bg-warn-soft text-warn', accent: 'bg-accent-soft text-accent-ink', proctor: 'bg-chip-proctor text-chip-proctor-ink', amber: 'bg-chip-amber text-chip-amber-ink', green: 'bg-chip-green text-chip-green-ink', gray: 'bg-chip-gray text-chip-gray-ink' };
export const Chip = ({ as: T = 'span', tone = 'soft', className = '', ...p }) => <T {...p} className={`inline-flex items-center gap-1.5 py-1.5 px-[11px] rounded-full ${TONE[tone]} text-[12px] font-semibold whitespace-nowrap ${className}`} />;
// Text field look for <input>, <select> and <textarea>: <Input as="select">
export const Input = ({ as: T = 'input', className = '', ...p }) => <T {...p} className={`min-h-12 px-3.5 rounded-xl border-[1.5px] border-field-line bg-surface text-[15px] w-full focus:border-ink ${className}`} />;
// Headings: H2 is the big one, H3 the section title; as="h1" etc. keeps the right tag.
export const H2 = ({ as: T = 'h2', className = '', ...p }) => <T {...p} className={`font-display font-extrabold tracking-[-.03em] leading-[1.04] m-0 ${className}`} />;
export const H3 = ({ as: T = 'h3', className = '', ...p }) => <T {...p} className={`font-display font-bold tracking-[-.02em] leading-[1.15] m-0 ${className}`} />;
export const Field =({ label, children }) => <label className="flex flex-col gap-1.5 [:where(&)>span]:text-[14px] [:where(&)>span]:font-semibold"><span>{label}</span>{children}</label>;
// Arrow keys, Home and End move between tabs; only the selected tab is in the Tab order.
const tabKeys = (tabs, value, onChange) => e => {
  const i = tabs.findIndex(t => t[0] === value), last = tabs.length - 1;
  const to = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i <= 0 ? last : i - 1, Home: 0, End: last }[e.key];
  if (to === undefined) return;
  e.preventDefault(); onChange(tabs[to][0]); e.currentTarget.querySelectorAll('[role=tab]')[to].focus();
};
export const Tabs = ({ tabs, value, onChange, label }) => (
  <div className="flex gap-1 p-1 rounded-[14px] bg-soft w-max max-w-full overflow-x-auto" role="tablist" aria-label={label} onKeyDown={tabKeys(tabs, value, onChange)}>
    {tabs.map(([k, l]) => <button key={k} role="tab" className="min-h-10 pointer-coarse:min-h-11 px-4 rounded-sm border-0 bg-transparent font-medium text-[14px] text-ink-2 whitespace-nowrap aria-selected:bg-surface aria-selected:text-ink aria-selected:font-semibold aria-selected:shadow-[0_1px_2px_rgba(23,24,28,.08)]" aria-selected={value === k} tabIndex={value === k ? 0 : -1} onClick={() => onChange(k)}>{l}</button>)}
  </div>
);
// Shown when the app auto-fell-back to demo data (see vite.config.js).
export const DemoNote = ({ style }) => import.meta.env.VITE_NO_KEY && <p role="status" className="text-[13px] m-0 mb-4 p-[8px_12px] rounded-[8px] bg-ink text-paper text-center" style={{ ...style }}>Demo data: Firebase is not configured. Nothing is saved.</p>;
export const Empty = ({ title, body, action }) => (
  <div className="border-[1.5px] border-dashed border-line rounded-lg p-10 text-center flex flex-col items-center gap-3">
    <H3 as="h2" className="text-[22px]">{title}</H3>
    {body && <p className="text-muted text-[13px] m-0 max-w-[420px]">{body}</p>}
    {action}
  </div>
);
export function Modal({ children, onClose }) {
  const box = useRef();
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => { // move focus into the dialog, give it back on close (shortcut: Tab can still leave the dialog)
    const prev = document.activeElement;
    box.current?.querySelector('button, [href], input, select, textarea')?.focus();
    return () => prev?.focus?.();
  }, []);
  return <div className="fixed inset-0 z-50 bg-[rgba(15,16,19,.55)] flex items-center justify-center p-5" onClick={onClose}><div ref={box} className="bg-surface rounded-3xl p-8 max-w-[440px] w-full flex flex-col gap-3.5 [:where(&)_ul]:list-disc" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>{children}</div></div>;
}

export const ENV_LABEL = { python: 'Python', js: 'JavaScript', cpp: 'C / C++', web: 'HTML / CSS / JS' };
export const STARTERS = {
  python: '# Read input with input(), print the answer\n',
  js: '// Read each input line with input(), print with console.log\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
  web: '<!DOCTYPE html>\n<html>\n<head>\n<style>\n\n</style>\n</head>\n<body>\n\n<script>\n\n</script>\n</body>\n</html>\n',
};
export const ENV_FILE = { python: 'solution.py', js: 'solution.js', cpp: 'solution.cpp', web: 'index.html' };

/* ---------- code highlighting (same tokenizer as the artifact) ---------- */
export function highlight(src) {
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const re = /("[^"]*"|'[^']*')|(#.*$|\/\/.*$)|\b(def|return|if|elif|else|for|while|in|import|from|as|and|or|not|True|False|None|class|pass|break|continue|lambda|function|const|let|var|int|long|public|static|void|new|using|namespace|auto)\b|\b(\d+)\b|\b([a-zA-Z_]\w*)(?=\()/g;
  return src.split('\n').map(line => esc(line).replace(re, (m, str, com, kw, num, fn) =>
    str ? `<span class="text-[#A8D8A0]">${str}</span>` : com ? `<span class="text-[#6B7080]">${com}</span>` : kw ? `<span class="text-[#F29B83]">${kw}</span>` : num ? `<span class="text-[#F7C97E]">${num}</span>` : `<span class="text-[#8FB8FF]">${fn}</span>`)).join('\n');
}
export const CodeBlock = ({ code }) => <div className="[:where(&)_pre]:bg-panel [:where(&)_pre]:rounded-[14px] [:where(&)_pre]:py-[18px] [:where(&)_pre]:px-5 [:where(&)_pre]:overflow-x-auto [:where(&)_pre]:mb-4 [:where(&)_pre_code]:bg-none [:where(&)_pre_code]:p-0 [:where(&)_pre_code]:text-panel-text"><pre><code className="font-mono text-[14px] leading-[1.75] text-panel-text m-0 whitespace-pre overflow-x-auto" dangerouslySetInnerHTML={{ __html: highlight(code) }} /></pre></div>;

/* ---------- toast ---------- */
let show;
export const notify = msg => show?.(msg);
export function Toast() {
  const [msg, setMsg] = useState('');
  useEffect(() => { let t; show = m => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(''), 3500); }; return () => { show = null; clearTimeout(t); }; }, []);
  return msg ? <div className="fixed left-1/2 bottom-[calc(24px+env(safe-area-inset-bottom,0px))] -translate-x-1/2 z-[60] bg-ink text-paper py-3.5 px-5 rounded-[14px] font-semibold text-[15px] shadow-[0_16px_40px_-12px_rgba(0,0,0,.4)] animate-rise max-w-[calc(100vw-32px)]" role="status">{msg}</div> : <div role="status" className="sr-only" />;
}
export const attempt = async fn => { try { await fn(); } catch (e) { notify(e.message); } };
// attempt() that ignores a second click while the first is still running (stops duplicate payments/rows)
export function useBusy() {
  const [busy, setBusy] = useState(false), on = useRef(false);
  return [busy, async fn => { if (on.current) return; on.current = true; setBusy(true); try { await attempt(fn); } finally { on.current = false; setBusy(false); } }];
}

/* ---------- data loading ---------- */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState();
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then(d => live && setData(d)).catch(e => { console.error(e); if (live) { setData(null); notify('Could not load this page. Check your connection and refresh.'); } });
    return () => { live = false; };
  }, [...deps, n]);
  return [data, () => setN(x => x + 1)];
}
export const Loading = () => (
  <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
    <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">{[0, 1, 2].map(i => <div key={i} className="rounded-xl bg-[length:200%_100%] animate-shimmer h-40" />)}</div>
  </div>
);

/* ---------- course cards (artifact "Courses" grid) ---------- */
const TINTS = ['var(--accent-soft)', 'var(--pass-soft)', '#E6EFE3', '#EFEAE1', 'var(--warn-soft)'];
const tint = id => TINTS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
export function CourseGrid({ courses, empty, extra }) {
  if (!courses.length) return <Empty title={empty} />;
  return (
    <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
      {courses.map(c => (
        <Card as={Link} key={c.id} to={`/course/${c.id}`} className="flex flex-col hover:-translate-y-0.5 hover:border-field-line hover:shadow-[0_2px_4px_rgba(23,24,28,.05),0_16px_32px_-16px_rgba(23,24,28,.22)] gap-3 no-underline p-0 overflow-hidden">
          <div className="h-30 p-4.5 flex items-end justify-between" style={{ background: tint(c.id) }}>
            <span className="inline-flex items-center gap-1.5 py-1.5 px-[11px] rounded-full text-[12px] font-semibold whitespace-nowrap bg-surface">{c.trainerName}</span>
            <span className="big font-display font-extrabold tracking-[-.03em] leading-none text-[44px] opacity-[0.9] text-night">{initials(c.title)}</span>
          </div>
          <div className="flex flex-col gap-2 p-[4px_20px_20px]">
            <H3 as="h2" className="text-[22px]">{c.title}</H3>
            <p className="text-[13px] text-ink-2 m-0">{c.description}</p>
            <div className="text-[13px] text-muted">{plural(c.students?.length || 0, "student")}, {plural(c.testIds?.length || 0, "test")} · <span className="font-mono">{courseCode(c)}</span></div>
            {extra?.(c)}
          </div>
        </Card>
      ))}
    </div>
  );
}

// An example's input and output side by side.
export const IOPair = ({ input, output }) => (
  <div className="grid gap-2.5 grid-cols-[repeat(2,minmax(0,1fr))]">
    {[['Input', input], ['Output', output]].map(([l, v]) => (
      <div className="bg-paper rounded-[12px] p-3 min-w-0" key={l}>
        <div className="text-[12px] text-muted font-semibold mb-1">{l}</div>
        <pre className="font-mono m-0 text-[14px] whitespace-pre-wrap [overflow-wrap:anywhere]">{v}</pre>
      </div>
    ))}
  </div>
);

// The statement, constraints and visible examples (or requirements for a web page) of a question. Students and the trainer's preview share it.
export const ProblemView = ({ q, shown }) => (
  <>
    <p className="m-0 text-[16px] leading-[1.65] whitespace-pre-wrap bg-paper rounded-[12px] p-[14px_16px]">{q.statement}</p>
    {q.constraints && (
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0 text-[14px]">Constraints</h3>
        <p className="font-mono m-0 text-[14px] leading-[1.7] whitespace-pre-wrap bg-paper rounded-[12px] p-[10px_14px]">{q.constraints}</p>
      </div>
    )}
    {q.env === 'web' ? (
      <div>
        <h3 className="m-[0_0_4px] text-[14px]">Requirements</h3>
        <ul className="text-ink-2 m-0 pl-4.5 leading-[1.9]">{shown.map((t, i) => <li key={i}>{t.desc || t.expr}</li>)}</ul>
      </div>
    ) : shown.map((t, i) => (
      <div key={i} className="flex flex-col gap-2">
        <h3 className="m-0 text-[14px]">Example {i + 1}</h3>
        <IOPair input={t.input} output={t.output} />
        {t.note && <p className="text-[13px] text-ink-2 m-0"><b>Explanation:</b> {t.note}</p>}
      </div>
    ))}
  </>
);

// Small shared pieces: back link, search box (keeps a visible focus ring), round icon button, selectable option row.
export const Back = ({ to, children }) => <Link to={to} className="flex items-center text-[13px] gap-1 font-semibold no-underline"><Icon name="back" size={16} />{children}</Link>;
export const SearchBox = ({ label, placeholder, value, onChange, wide }) => (
  <form role="search" className={`flex items-center gap-2.5 h-[46px] px-4 rounded-full bg-surface border border-line focus-within:outline-2 focus-within:outline-pass-strong focus-within:outline-offset-2 [:where(&)_input]:border-0 [:where(&)_input]:bg-transparent [:where(&)_input]:outline-none [:where(&)_input]:grow [:where(&)_input]:min-w-0 [:where(&)_input]:text-[14px] w-full ${wide ? 'max-w-[480px]' : 'max-w-[420px]'}`} onSubmit={e => e.preventDefault()}>
    <Icon name="search" size={16} />
    <input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </form>
);
export const IconBtn = ({ as: T = 'button', className = '', ...p }) => <T {...p} className={`w-11 h-11 rounded-full border border-line bg-surface inline-flex items-center justify-center shrink-0 ${className}`} />;
export const Option = ({ on, className = '', ...p }) => <label {...p} className={`flex items-center gap-3.5 min-h-14 py-3 px-4 rounded-[14px] border-[1.5px] bg-surface cursor-pointer text-[16px] hover:border-muted [:where(&)_input]:w-5 [:where(&)_input]:h-5 [:where(&)_input]:accent-ink [:where(&)_input]:shrink-0 ${on ? 'border-ink shadow-[inset_0_0_0_1px_var(--ink)]' : 'border-line'} ${className}`} />;
// The save/cancel row that stays at the bottom of long forms (above the phone tab bar).
export const StickyBar = ({ children }) => <div className="sticky bottom-0 z-[5] flex justify-end items-center gap-3 py-3.5 bg-[linear-gradient(to_top,var(--paper)_70%,transparent)] max-tablet:bottom-[72px]">{children}</div>;
