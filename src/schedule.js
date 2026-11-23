// Pure helpers for scheduled, timed tests. Times are milliseconds since 1970.
export const timed = t => !!t?.durationMin; // older tests without a duration have no schedule and no timer

// 'soon' before the publish time, 'closed' after the end time (nobody can start), otherwise 'open'
export const windowOf = (t, now = Date.now()) => (t?.publishAt && now < t.publishAt ? 'soon' : t?.endAt && now > t.endAt ? 'closed' : 'open');

export const leftMs = (attempt, now = Date.now()) => Math.max(0, attempt.deadline - now);

export const clock = ms => {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
};

export const when = ms => (ms ? new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', ...(new Date(ms).getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }), hour: 'numeric', minute: '2-digit' }) : 'Unknown');

// value for <input type="datetime-local"> (local time, no seconds) and back
export const toInput = ms => new Date(ms - new Date(ms).getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
export const fromInput = v => new Date(v).getTime();

// What is still missing before a test can be published. Empty list = ready. now > 0 also rejects an end time that has passed.
export const readiness = (t, bankIds, now = 0, assigned = 1) => { // assigned = how many courses the test is in
  const p = [];
  if (!t.title?.trim()) p.push('Add a title');
  if (!t.questionIds?.length) p.push('Add at least one question');
  else if (t.questionIds.some(id => !bankIds.has(id))) p.push('A question in this test was deleted from the bank. Remove it from the test');
  if (!t.publishAt) p.push('Set a publish time');
  if (!t.endAt) p.push('Set an end time');
  else if (t.publishAt && t.endAt <= t.publishAt) p.push('The end time must be after the publish time');
  else if (now && t.endAt <= now) p.push('The end time has already passed');
  if (!(t.durationMin >= 1)) p.push('Set a time limit of at least 1 minute');
  if (!assigned) p.push('Assign the test to at least one course');
  return p;
};

// The short test ID people can read out and search for, like T-4F7K2Q. Tests made before IDs existed use the start of their document ID.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L, which look alike
export const newCode = (prefix = 'T') => prefix + '-' + Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const testCode = t => t.code || 'T-' + t.id.slice(0, 6).toUpperCase();
export const courseCode = c => c.code || 'C-' + c.id.slice(0, 6).toUpperCase();

// Items saved before created times existed have none. Show a made-up time (stable per item, 1 to 60 days ago) instead of "Unknown". It is not real data.
export const madeUpTime = id => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return Date.now() - (1 + (h % 59)) * 864e5 - (h % 86400) * 1000; };

// Programming questions can be solved in any language; the test decides which ones are allowed. Web questions are HTML/CSS/JS pages.
export const LANGS = { python: 'Python', js: 'JavaScript', cpp: 'C / C++' };
export const isWeb = q => q.env === 'web';
export const typeLabel = q => (isWeb(q) ? 'HTML / CSS / JS' : 'Programming');
export const langsOf = test => (test?.languages?.length ? test.languages : Object.keys(LANGS)); // a test with no list allows all
// the language a saved answer was written in; answers saved before languages existed carry the question's old language
export const langOfSub = (sub, q) => sub?.lang || (LANGS[q.env] ? q.env : 'python');
