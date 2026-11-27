import { useState } from 'react';
import { Link } from 'react-router-dom';
import { arrayUnion, collection, doc, getDoc, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { createLogin, db, list, questions } from '../../firebase.js';
import { averageScore } from '../../score.js';
import { download, parseCsv, toCsv } from '../../csv.js';
import { Modal, Avatar, Btn, Empty, Field, Icon, Loading, attempt, notify, plural, useBusy, useLoad, Card, Chip, Input, H3, PageHero, SearchBox, heroBtn, btn } from '../../ui.jsx';
import { Confirm, ms } from './trainerShared.jsx';
import { ROLE_TONE, TD, TH, rupees, what } from './Admin.jsx';

const stamp = t => (t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const registered = u => ms(u.createdAt), signedIn = u => ms(u.lastSignIn);
const SORTS = { name: u => u.name.toLowerCase(), role: u => u.role, registered: u => registered(u) || 0, signin: u => signedIn(u) || 0 };
const PAGE = 50;
const SEG = 'min-h-10 px-4 rounded-lg text-[14px] font-semibold border';
const segOn = on => (on ? 'bg-ink text-paper border-ink' : 'bg-surface text-ink border-line hover:bg-soft');

// Firestore takes at most 500 writes in one batch; each user here needs up to two
async function inBatches(items, write) {
  for (let i = 0; i < items.length; i += 200) {
    const b = writeBatch(db);
    items.slice(i, i + 200).forEach(x => write(b, x));
    await b.commit();
  }
}

export function AdminUsers() {
  const [d, reload] = useLoad(async () => ({ users: await list(collection(db, 'users')), courses: await list(collection(db, 'courses')) }));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student' });
  const [text, setText] = useState('');
  const [role, setRole] = useState('all');
  const [plan, setPlan] = useState('all');
  const [sort, setSort] = useState({ k: 'registered', dir: -1 });
  const [cap, setCap] = useState(PAGE);
  const [picked, setPicked] = useState([]);
  const [course, setCourse] = useState('');
  const [view, setView] = useState(null); // the user whose details are open
  const [importing, setImporting] = useState(false);
  const [offAsk, setOffAsk] = useState(null); // students waiting for "switch Pro off" confirmation
  const [busy, run] = useBusy();
  const [pro, setPro] = useState(null), [amount, setAmount] = useState(''); // the students whose Pro payment is being entered
  if (!d) return <Loading />;
  const { users, courses } = d;
  const count = r => users.filter(u => u.role === r).length;
  const q = text.trim().toLowerCase();
  const shown = users
    .filter(u => (role === 'all' || u.role === role) && (plan === 'all' || (u.role === 'student' && !!u.subscribed === (plan === 'pro'))) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)))
    .sort((a, b) => { const x = SORTS[sort.k](a), y = SORTS[sort.k](b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.name.localeCompare(b.name); });
  const sel = users.filter(u => picked.includes(u.id)), selStudents = sel.filter(u => u.role === 'student');
  const add = e => {
    e.preventDefault();
    run(async () => {
      const uid = await createLogin(f.email, f.password);
      if ((await getDoc(doc(db, 'users', uid))).exists()) throw new Error('That email already has an account.');
      await setDoc(doc(db, 'users', uid), { name: f.name, email: f.email, role: f.role, subscribed: false, createdAt: Date.now() });
      setF({ name: '', email: '', password: '', role: 'student' });
      setOpen(false);
      notify('User created. Share the password with them.');
      reload();
    });
  };
  // Turning Pro on records the payment in the same batch, so there is never a Pro student without their payment row (or the reverse).
  const setPlanFor = (list, on, paid = 0) => attempt(async () => {
    const todo = list.filter(u => u.role === 'student' && !!u.subscribed !== on);
    if (!todo.length) return notify(on ? 'They are all on Pro already' : 'None of them are on Pro');
    await inBatches(todo, (b, u) => {
      b.update(doc(db, 'users', u.id), { subscribed: on });
      if (on && paid > 0) b.set(doc(collection(db, 'payments')), { userId: u.id, userName: u.name, kind: 'pro', amount: paid, at: Date.now() });
    });
    notify(todo.length === 1 ? `Pro switched ${on ? 'on' : 'off'} for ${todo[0].name}` : `Pro switched ${on ? 'on' : 'off'} for ${plural(todo.length, 'student')}`);
    reload();
  });
  const enroll = () => attempt(async () => {
    const c = courses.find(x => x.id === course);
    const ids = selStudents.map(u => u.id).filter(id => !c.students.includes(id)), at = Date.now();
    if (!ids.length) return notify(`They are all in ${c.title} already`);
    const b = writeBatch(db);
    b.update(doc(db, 'courses', c.id), { students: arrayUnion(...ids), joins: arrayUnion(...ids.map(uid => ({ uid, at }))) });
    await b.commit();
    notify(`${plural(ids.length, 'student')} enrolled in ${c.title}`);
    reload();
  });
  const exportCsv = rows => download(`users-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([['Name', 'Email', 'Role', 'Plan', 'Registered', 'Last signed in'],
    ...rows.map(u => [u.name, u.email, u.role, u.role === 'student' ? (u.subscribed ? 'Pro' : 'Free') : '', registered(u) ? new Date(registered(u)).toISOString() : '', signedIn(u) ? new Date(signedIn(u)).toISOString() : ''])]));
  const sortBy = k => setSort(s => ({ k, dir: s.k === k ? -s.dir : k === 'name' || k === 'role' ? 1 : -1 }));
  const Th = ({ k, children, className = '' }) => (
    <th className={`${TH} ${className}`} aria-sort={sort.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-[inherit] uppercase tracking-[inherit] hover:text-ink" onClick={() => sortBy(k)}>
        {children}<span aria-hidden="true" className={sort.k === k ? 'text-ink' : 'opacity-30'}>{sort.k === k && sort.dir > 0 ? '↑' : '↓'}</span>
      </button>
    </th>
  );
  const allOn = shown.length > 0 && shown.every(u => picked.includes(u.id));
  return (
    <div className="flex flex-col gap-5">
      {pro && (
        <Modal onClose={() => setPro(null)}>
          <form className="flex flex-col gap-3.5" onSubmit={e => { e.preventDefault(); setPlanFor(pro, true, Number(amount)); setPro(null); }}>
            <H3 as="h2" className="text-[24px]">Switch on Pro for {pro.length === 1 ? pro[0].name : plural(pro.length, 'student')}</H3>
            <Field label={pro.length === 1 ? 'Amount paid (₹)' : 'Amount each student paid (₹)'}><Input type="number" min="0" step="1" required inputMode="numeric" placeholder="499" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
            <p className="text-[13px] text-muted m-0">Enter 0 if it was free. An amount above 0 is added to Payments{pro.length > 1 ? ', once per student' : ''}.</p>
            <div className="flex items-center gap-3 justify-end flex-wrap"><Btn type="button" v="ghost" onClick={() => setPro(null)}>Cancel</Btn><Btn v="accent">Switch on Pro</Btn></div>
          </form>
        </Modal>
      )}
      {offAsk && <Confirm title={`Switch off Pro for ${plural(offAsk.length, 'student')}?`} body="Their payments stay in Payments. You can switch Pro back on later." label="Switch off Pro" onYes={() => setPlanFor(offAsk, false)} onClose={() => setOffAsk(null)} />}
      {view && <UserDetails u={view} courses={courses} onClose={() => setView(null)} />}
      {importing && <ImportUsers onClose={() => setImporting(false)} onDone={reload} />}

      <PageHero compact title="Users"
        stats={[['users', 'Students', count('student')], ['star', 'On Pro', users.filter(u => u.role === 'student' && u.subscribed).length], ['user', 'Trainers', count('trainer')], ['shield', 'Admins', count('admin')]]}
        actions={<>
          <button className={btn('ghost')} onClick={() => setImporting(true)}><Icon name="doc" size={18} />Import CSV</button>
          <button className={heroBtn} onClick={() => setOpen(!open)}><Icon name={open ? 'x' : 'plus'} size={18} />{open ? 'Close' : 'Add user'}</button>
        </>} />
      {open && (
        <Card as="form" className="grid gap-4 grid-cols-4 max-laptop:grid-cols-2" onSubmit={add}>
          <Field label="Name"><Input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Password (min 6)"><Input minLength={6} required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Role">
            <Input as="select" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
              <option value="student">Student</option><option value="trainer">Trainer</option>
            </Input>
          </Field>
          <div><Btn v="accent" disabled={busy}>Create user</Btn></div>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <SearchBox label="Search users" placeholder="Search by name or email" value={text} onChange={v => { setText(v); setCap(PAGE); }} />
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by role">
          {[['all', 'All', users.length], ['student', 'Students', count('student')], ['trainer', 'Trainers', count('trainer')], ['admin', 'Admins', count('admin')]].map(([k, l, n]) => (
            <button key={k} className={`${SEG} ${segOn(role === k)}`} aria-pressed={role === k} onClick={() => { setRole(k); setCap(PAGE); }}>{l} <span className="opacity-60">{n}</span></button>
          ))}
        </div>
        <Input as="select" className="w-auto! min-w-[140px]" aria-label="Filter by plan" value={plan} onChange={e => { setPlan(e.target.value); setCap(PAGE); }}>
          <option value="all">Any plan</option><option value="pro">Pro students</option><option value="free">Free students</option>
        </Input>
        <button className={btn('ghost', 'md', 'ml-auto max-tablet:ml-0')} onClick={() => exportCsv(shown)} disabled={!shown.length}><Icon name="doc" size={18} />Export CSV</button>
      </div>

      {picked.length > 0 && (
        <Card className="sticky top-3 z-10 flex items-center gap-3 flex-wrap py-3 px-4 border-accent/40" role="region" aria-label="Selected users">
          <b className="text-[14px]">{plural(picked.length, 'user')} selected</b>
          {selStudents.length < picked.length && <span className="text-[13px] text-muted">({selStudents.length} {selStudents.length === 1 ? 'is a student' : 'are students'}; course and Pro actions only apply to students)</span>}
          <span className="flex items-center gap-2 flex-wrap">
            <Input as="select" className="w-auto! min-w-[180px]" aria-label="Course to enroll in" value={course} onChange={e => setCourse(e.target.value)}>
              <option value="">Pick a course…</option>{courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Input>
            <Btn v="ink" disabled={!course || !selStudents.length} onClick={enroll}>Enroll</Btn>
          </span>
          <Btn v="ghost" disabled={!selStudents.length} onClick={() => { setAmount(''); setPro(selStudents); }}>Pro on</Btn>
          <Btn v="ghost" disabled={!selStudents.length} onClick={() => setOffAsk(selStudents)}>Pro off</Btn>
          <Btn v="ghost" onClick={() => exportCsv(sel)}><Icon name="doc" size={16} />Export</Btn>
          <Btn v="plain" className="ml-auto" onClick={() => setPicked([])}>Clear</Btn>
        </Card>
      )}

      {shown.length === 0 ? <Empty title="No users match" /> : (
        <Card className="overflow-x-auto p-0">
          <table className="border-collapse w-full">
            <thead><tr>
              <th className={`${TH} w-10 pr-0`}><input type="checkbox" className="w-4.5 h-4.5" aria-label={`Select all ${shown.length} shown`} checked={allOn} onChange={() => setPicked(allOn ? picked.filter(id => !shown.some(u => u.id === id)) : [...new Set([...picked, ...shown.map(u => u.id)])])} /></th>
              <Th k="name">Name</Th><Th k="role">Role</Th>
              <Th k="registered" className="max-tablet:hidden">Registered</Th><Th k="signin" className="max-tablet:hidden">Last signed in</Th>
              <th className={TH}>Pro</th>
            </tr></thead>
            <tbody>
              {shown.slice(0, cap).map(u => (
                <tr key={u.id} className={`hover:bg-soft/60 [&:last-child>td]:border-b-0 ${picked.includes(u.id) ? 'bg-accent-soft/40' : ''}`}>
                  <td className={`${TD} w-10 pr-0`}><input type="checkbox" className="w-4.5 h-4.5" aria-label={`Select ${u.name}`} checked={picked.includes(u.id)} onChange={e => setPicked(e.target.checked ? [...picked, u.id] : picked.filter(x => x !== u.id))} /></td>
                  <td className={TD}>
                    <button type="button" className="flex items-center gap-3 border-0 bg-transparent p-0 text-left text-ink min-w-0 group" onClick={() => setView(u)} aria-label={`Details for ${u.name}`}>
                      <Avatar name={u.name} size={34} />
                      <span className="flex flex-col min-w-0"><b className="truncate group-hover:underline">{u.name}</b><span className="text-[13px] text-muted truncate">{u.email}</span></span>
                    </button>
                  </td>
                  <td className={TD}><Chip tone={ROLE_TONE[u.role]} className="[text-transform:capitalize]">{u.role}</Chip></td>
                  <td className={`${TD} text-[13px] text-ink-2 whitespace-nowrap max-tablet:hidden`}>{stamp(registered(u))}</td>
                  <td className={`${TD} text-[13px] text-ink-2 whitespace-nowrap max-tablet:hidden`}>{stamp(signedIn(u))}</td>
                  <td className={TD}>{u.role === 'student' ? <button className="relative w-12 h-7 rounded-full border-0 bg-line shrink-0 transition-[background] duration-150 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-[22px] after:h-[22px] after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-150 aria-checked:bg-pass-strong aria-checked:after:translate-x-5" role="switch" aria-checked={!!u.subscribed} aria-label={`Pro subscription for ${u.name}`} onClick={() => (u.subscribed ? setPlanFor([u], false) : (setAmount(''), setPro([u])))} /> : <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-line text-[13px] text-muted">
            <span>Showing {Math.min(cap, shown.length)} of {plural(shown.length, 'user')}</span>
            {shown.length > cap && <Btn v="ghost" size="sm" onClick={() => setCap(n => n + PAGE)}>Show {Math.min(PAGE, shown.length - cap)} more</Btn>}
          </div>
        </Card>
      )}
    </div>
  );
}

// Everything about one user: when they joined and last signed in, their courses, results, points and payments.
function UserDetails({ u, courses, onClose }) {
  const student = u.role === 'student';
  const [d] = useLoad(async () => {
    const [subs, pays, lb, tests, qs] = await Promise.all([
      student ? list(query(collection(db, 'submissions'), where('userId', '==', u.id))) : [],
      list(query(collection(db, 'payments'), where('userId', '==', u.id))),
      student ? getDoc(doc(db, 'leaderboard', u.id)).then(s => s.data()) : null,
      student ? list(collection(db, 'tests')) : [],
      student ? questions() : [],
    ]);
    return { subs, pays, lb, tests, qs };
  }, [u.id]);
  const mine = student ? courses.filter(c => c.students?.includes(u.id)) : courses.filter(c => c.trainerId === u.id);
  const fact = (l, v) => <div className="flex flex-col gap-0.5 rounded-lg bg-soft border border-line p-3 min-w-0"><span className="text-[12px] text-muted">{l}</span><b className="text-[14px] truncate">{v}</b></div>;
  let body = <Loading />;
  if (d) {
    const taken = new Set(d.subs.filter(s => s.testId !== 'practice').map(s => s.testId));
    const avg = averageScore(d.subs, d.tests.filter(t => taken.has(t.id)), Object.fromEntries(d.qs.map(q => [q.id, q.tests.length])));
    body = (
      <>
        {student && <div className="grid gap-2.5 grid-cols-4 max-phone:grid-cols-2">{fact('Tests taken', taken.size)}{fact('Average score', avg === null ? '—' : `${avg}%`)}{fact('Points', d.lb?.points || 0)}{fact('Streak', plural(d.lb?.streak || 0, 'day'))}</div>}
        <section className="flex flex-col gap-2">
          <H3 className="text-[15px]">{student ? 'Enrolled in' : 'Teaching'} ({mine.length})</H3>
          {mine.length ? <div className="flex flex-wrap gap-1.5">{mine.map(c => <Link key={c.id} to={`/course/${c.id}`} className="no-underline"><Chip className="hover:bg-line">{c.title}</Chip></Link>)}</div> : <p className="m-0 text-[13px] text-muted">No courses.</p>}
        </section>
        <section className="flex flex-col gap-1">
          <H3 className="text-[15px]">Payments ({d.pays.length})</H3>
          {d.pays.length ? [...d.pays].sort((a, b) => ms(b.at) - ms(a.at)).map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-t border-line text-[14px]"><span className="min-w-0 truncate">{what(p)} <span className="text-muted text-[13px]">· {stamp(ms(p.at))}</span></span><span className={`font-mono ${p.refunded ? 'line-through text-muted' : ''}`}>{rupees(p.amount)}</span></div>
          )) : <p className="m-0 text-[13px] text-muted">No payments.</p>}
        </section>
      </>
    );
  }
  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-start gap-4">
        <Avatar name={u.name} size={56} />
        <div className="flex flex-col gap-1 min-w-0 grow">
          <H3 as="h2" className="text-[22px] truncate">{u.name}</H3>
          <span className="text-[14px] text-muted truncate">{u.email}</span>
          <span className="flex gap-1.5 flex-wrap mt-1"><Chip tone={ROLE_TONE[u.role]} className="[text-transform:capitalize]">{u.role}</Chip>{student && <Chip tone={u.subscribed ? 'pass' : 'gray'}>{u.subscribed ? 'Pro' : 'Free plan'}</Chip>}</span>
        </div>
        <button type="button" className="w-9 h-9 pointer-coarse:w-11 pointer-coarse:h-11 rounded-lg border border-line bg-surface hover:bg-soft grid place-items-center shrink-0" aria-label="Close" onClick={onClose}><Icon name="x" size={16} /></button>
      </div>
      <div className="grid gap-2.5 grid-cols-2">{fact('Registered', stamp(registered(u)))}{fact('Last signed in', stamp(signedIn(u)))}</div>
      {body}
    </Modal>
  );
}

// Add many users from a CSV file: name, email, password and an optional role (student or trainer).
function ImportUsers({ onClose, onDone }) {
  const [rows, setRows] = useState(null), [file, setFile] = useState('');
  const [log, setLog] = useState([]), [busy, run] = useBusy();
  const read = async e => {
    const fl = e.target.files[0]; if (!fl) return;
    setFile(fl.name); setLog([]);
    const all = parseCsv(await fl.text()), head = all[0]?.map(h => h.trim().toLowerCase()) || [];
    const col = k => head.indexOf(k), has = col('email') >= 0;
    setRows((has ? all.slice(1) : all).map((r, i) => {
      const get = (k, n) => (r[has ? col(k) : n] || '').trim();
      const u = { line: i + (has ? 2 : 1), name: get('name', 0), email: get('email', 1).toLowerCase(), password: get('password', 2), role: (get('role', 3) || 'student').toLowerCase() };
      u.problem = !u.name ? 'Name is missing' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email) ? 'Email is not valid' : u.password.length < 6 ? 'Password needs at least 6 characters' : !['student', 'trainer'].includes(u.role) ? 'Role must be student or trainer' : '';
      return u;
    }));
  };
  const ok = rows?.filter(r => !r.problem) || [];
  const go = () => run(async () => {
    const out = [];
    for (const u of ok) { // one at a time: each makes a login, and the sign-in service limits how fast that can go
      try {
        const uid = await createLogin(u.email, u.password);
        if ((await getDoc(doc(db, 'users', uid))).exists()) throw new Error('That email already has an account');
        await setDoc(doc(db, 'users', uid), { name: u.name, email: u.email, role: u.role, subscribed: false, createdAt: Date.now() });
        out.push([u, '']);
      } catch (e) { out.push([u, e.message]); }
      setLog([...out]);
    }
    notify(`${plural(out.filter(x => !x[1]).length, 'user')} added`);
    onDone();
  });
  return (
    <Modal onClose={onClose} wide>
      <H3 as="h2" className="text-[22px]">Import users from CSV</H3>
      <p className="m-0 text-[14px] text-ink-2">One user per row with the columns <b>name</b>, <b>email</b>, <b>password</b> and, if you like, <b>role</b> (student or trainer; student when empty). A first row with those names is optional. Share each password with its user.</p>
      <div className="flex items-center gap-3 flex-wrap">
        <label className={btn('ghost')}><Icon name="doc" size={18} />{file || 'Choose a CSV file'}<input type="file" accept=".csv,text/csv" className="sr-only" onChange={read} /></label>
        <button type="button" className="border-0 bg-transparent text-[13px] font-semibold text-accent-ink p-0" onClick={() => download('users-template.csv', toCsv([['name', 'email', 'password', 'role'], ['Aditya Rao', 'aditya@example.com', 'change-me-123', 'student']]))}>Download a template</button>
      </div>
      {rows && (
        <div className="flex flex-col border border-line rounded-lg max-h-[300px] overflow-y-auto text-[13px]">
          {rows.length === 0 && <p className="m-0 p-3 text-muted">The file has no rows.</p>}
          {rows.map(r => {
            const done = log.find(x => x[0] === r);
            const note = r.problem || (done ? done[1] || 'Added' : '');
            return (
              <div key={r.line} className="flex items-center gap-3 px-3 py-2 border-b border-line last:border-b-0">
                <span className="text-muted tabular-nums w-10 shrink-0">Row {r.line}</span>
                <span className="grow min-w-0 truncate"><b>{r.name || '—'}</b> <span className="text-muted">{r.email}</span></span>
                <span className="capitalize text-muted shrink-0">{r.role}</span>
                {note && <span className={`shrink-0 font-semibold ${r.problem || done?.[1] ? 'text-danger' : 'text-pass'}`}>{note}</span>}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-3 justify-end flex-wrap">
        {rows && <span className="mr-auto text-[13px] text-muted">{plural(ok.length, 'user')} ready{rows.length > ok.length ? `, ${rows.length - ok.length} with problems (skipped)` : ''}</span>}
        <Btn type="button" v="ghost" onClick={onClose}>{log.length ? 'Done' : 'Cancel'}</Btn>
        <Btn v="accent" disabled={busy || !ok.length || log.length > 0} onClick={go}>{busy ? `Adding ${log.length + 1} of ${ok.length}…` : ok.length ? `Add ${plural(ok.length, 'user')}` : 'Add users'}</Btn>
      </div>
    </Modal>
  );
}
