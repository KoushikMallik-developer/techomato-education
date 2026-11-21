import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/* ---------- icons + logo (paths copied from the artifact) ---------- */
const ICONS = {
  home: 'M3 11.5l9-7.5 9 7.5M5 10v10h14V10',
  book: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5zM13 4h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13z',
  check: 'M5 12.5l4.5 4.5L20 6.5', x: 'M6 6l12 12M18 6L6 18',
  clip: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12l2 2 4-4',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4.5-6.5',
  plus: 'M12 5v14M5 12h14', arrow: 'M5 12h14M13 6l6 6-6 6', back: 'M15 6l-6 6 6 6', play: 'M7 4.5l12 7.5-12 7.5z',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  logout: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5', list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  flame: 'M12 22c4 0 7-2.7 7-6.8 0-4-3-6.2-4.3-9.7-.3 2.6-1.6 3.9-3 4.4.4-3.3-.9-6.2-3.7-7.9.3 3.8-3 6.4-3 11.2C5 19.3 8 22 12 22z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.2 14H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6V4.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  medal: 'M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 11 5 2h4l3 6M15.5 11 19 2h-4l-2.2 4.5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  cohort: 'M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6', shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4',
};
export function Icon({ name, size = 20, stroke = 1.9, color = 'currentColor', fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={ICONS[name]} />
    </svg>
  );
}
export function Logo({ size = 30, text = true }) {
  return (
    <span className="logo">
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
export const initials =s => (s || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
export const Avatar = ({ name, size = 40 }) => <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</span>;
export function StreakDots({ n, dark }) {
  const filled = n <= 0 ? 0 : n % 7 === 0 ? 7 : n % 7;
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 5 }} aria-hidden="true">{Array.from({ length: 7 }).map((_, i) => <span key={i} style={{ height: 8, borderRadius: 4, background: i < filled ? 'var(--accent)' : dark ? '#3A3D46' : 'var(--soft)' }} />)}</div>;
}
export const Bar = ({ pct, color }) => <div className="bar"><span style={{ width: Math.max(0, Math.min(100, pct)) + '%', background: color }} /></div>;
export const Btn = ({ v = 'ink', className = '', ...p }) => <button {...p} className={`btn btn-${v} ${className}`} />;
export const Field =({ label, children }) => <label className="field"><span>{label}</span>{children}</label>;
export const Tabs = ({ tabs, value, onChange, label }) => (
  <div className="tabs" role="tablist" aria-label={label}>
    {tabs.map(([k, l]) => <button key={k} role="tab" className="tab" aria-selected={value === k} onClick={() => onChange(k)}>{l}</button>)}
  </div>
);
export const Empty = ({ title, body, action }) => (
  <div className="empty">
    <h2 className="h3" style={{ fontSize: 22 }}>{title}</h2>
    {body && <p className="muted small" style={{ margin: 0, maxWidth: 420 }}>{body}</p>}
    {action}
  </div>
);
export function Modal({ children, onClose }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return <div className="modal-bg" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>{children}</div></div>;
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
    str ? `<span class="tk-s">${str}</span>` : com ? `<span class="tk-c">${com}</span>` : kw ? `<span class="tk-k">${kw}</span>` : num ? `<span class="tk-n">${num}</span>` : `<span class="tk-f">${fn}</span>`)).join('\n');
}
export const CodeBlock = ({ code }) => <div className="prose"><pre><code className="code" dangerouslySetInnerHTML={{ __html: highlight(code) }} /></pre></div>;

/* ---------- toast ---------- */
let show;
export const notify = msg => show?.(msg);
export function Toast() {
  const [msg, setMsg] = useState('');
  useEffect(() => { let t; show = m => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(''), 3500); }; return () => { show = null; clearTimeout(t); }; }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : <div role="status" className="sr" />;
}
export const attempt = async fn => { try { await fn(); } catch (e) { notify(e.message); } };

/* ---------- data loading ---------- */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState();
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then(d => live && setData(d)).catch(e => { console.error(e); live && setData(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return [data, () => setN(x => x + 1)];
}
export const Loading = () => (
  <div className="stack" style={{ gap: 16 }} aria-busy="true" aria-label="Loading">
    <div className="grid g3">{[0, 1, 2].map(i => <div key={i} className="skel" style={{ height: 160 }} />)}</div>
  </div>
);

/* ---------- course cards (artifact "Courses" grid) ---------- */
const TINTS = ['var(--accent-soft)', 'var(--pass-soft)', '#E6EFE3', '#EFEAE1', 'var(--warn-soft)'];
const tint = id => TINTS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
export function CourseGrid({ courses, empty }) {
  if (!courses.length) return <Empty title={empty} />;
  return (
    <div className="grid g3">
      {courses.map(c => (
        <Link key={c.id} to={`/course/${c.id}`} className="card stack" style={{ gap: 12, textDecoration: 'none', padding: 0, overflow: 'hidden' }}>
          <div style={{ height: 120, background: tint(c.id), padding: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span className="chip" style={{ background: 'var(--surface)' }}>{c.trainerName}</span>
            <span className="big" style={{ fontSize: 44, opacity: 0.9, color: '#17181C' }}>{initials(c.title)}</span>
          </div>
          <div className="stack" style={{ gap: 8, padding: '4px 20px 20px' }}>
            <h2 className="h3" style={{ fontSize: 22 }}>{c.title}</h2>
            <p className="small ink2" style={{ margin: 0 }}>{c.description}</p>
            <div className="small muted">{plural(c.students?.length || 0, "student")}, {plural(c.testIds?.length || 0, "test")}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
