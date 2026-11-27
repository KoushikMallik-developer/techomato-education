// CSV for spreadsheets. Every field is quoted; a value starting with = + - @ gets a leading ' so a spreadsheet never runs it as a formula.
export const toCsv = rows => rows.map(r => r.map(v => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}).join(',')).join('\r\n');

// Reads CSV text: quoted fields, "" inside quotes, commas and line breaks inside quotes, \r\n or \n line ends. Blank lines are skipped.
export function parseCsv(text) {
  const t = text.replace(/^﻿/, ''), rows = [];
  let row = [], f = '', quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c !== '"') f += c;
      else if (t[i + 1] === '"') { f += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  row.push(f); rows.push(row);
  return rows.filter(r => r.some(x => x.trim()));
}

// Saves text as a .csv file in the browser. The byte order mark makes Excel read it as UTF-8 (names with accents, ₹).
export function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
