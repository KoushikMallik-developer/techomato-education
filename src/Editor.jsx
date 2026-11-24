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
    <div className="bg-panel rounded-[18px] overflow-hidden flex flex-col min-h-[380px] [:where(&)_textarea]:grow [:where(&)_textarea]:border-0 [:where(&)_textarea]:outline-none [:where(&)_textarea]:resize-none [:where(&)_textarea]:bg-transparent [:where(&)_textarea]:text-panel-text [:where(&)_textarea]:font-mono [:where(&)_textarea]:text-[14px] [:where(&)_textarea]:leading-[1.7] [:where(&)_textarea]:py-4 [:where(&)_textarea]:pr-4 [:where(&)_textarea]:pl-1.5 [:where(&)_textarea]:whitespace-pre [:where(&)_textarea]:overflow-x-auto [:where(&)_textarea]:overflow-y-hidden [:where(&)_textarea]:[tab-size:4] [:where(&)_textarea]:min-h-80 [:where(&)_textarea]:min-w-0">
      <div className="h-11 flex items-center justify-between px-[18px] border-b border-panel-line font-mono text-[12px] text-panel-muted"><span className="text-panel-text">{file}</span><span>{right}</span></div>
      <div className="flex grow min-h-0 overflow-auto">
        <div className="py-4 pr-2.5 pl-4 text-right font-mono text-[14px] leading-[1.7] text-[#6B7080] select-none whitespace-pre" aria-hidden="true">{Array.from({ length: lines }, (_, i) => i + 1).join('\n')}</div>
        <label className="sr-only" htmlFor="ed">Code editor</label>
        <textarea id="ed" spellCheck="false" autoCapitalize="off" autoCorrect="off" rows={lines} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKey} />
      </div>
    </div>
  );
}
