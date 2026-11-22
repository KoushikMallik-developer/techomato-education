/* Code editor used by the Solve page and the Playground. */
export default function Editor({ value, onChange, file, right, onShortcut }) {
  const lines = Math.max(18, value.split('\n').length);
  const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
  const onKey = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onShortcut(e.shiftKey ? 'submit' : 'run'); return; }
    const t = e.target, st = t.selectionStart, en = t.selectionEnd;
    const put = (text, caret) => { onChange(value.slice(0, st) + text + value.slice(en)); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = st + caret; }); };
    if (e.key === 'Tab') { e.preventDefault(); put('    ', 4); return; }
    if (Object.values(pairs).includes(e.key) && value[st] === e.key && st === en) { e.preventDefault(); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = st + 1; }); return; }
    if (pairs[e.key] && st === en && !((e.key === '"' || e.key === "'") && /\w/.test(value[st - 1] || ''))) { e.preventDefault(); put(e.key + pairs[e.key], 1); return; }
    if (e.key === 'Enter' && st === en) {
      const lineStart = value.lastIndexOf('\n', st - 1) + 1;
      const indent = (value.slice(lineStart, st).match(/^\s*/) || [''])[0];
      const extra = /[:{(\[]\s*$/.test(value.slice(lineStart, st)) ? '    ' : '';
      e.preventDefault();
      put('\n' + indent + extra, 1 + indent.length + extra.length);
    }
  };
  return (
    <div className="editor">
      <div className="win-bar"><span style={{ color: 'var(--panel-text)' }}>{file}</span><span>{right}</span></div>
      <div className="editor-body">
        <div className="gutter" aria-hidden="true">{Array.from({ length: lines }, (_, i) => i + 1).join('\n')}</div>
        <label className="sr" htmlFor="ed">Code editor</label>
        <textarea id="ed" spellCheck="false" autoCapitalize="off" autoCorrect="off" rows={lines} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKey} />
      </div>
    </div>
  );
}
