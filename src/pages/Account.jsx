import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { sendPasswordResetEmail, signOut, updatePassword } from 'firebase/auth';
import { collection, doc, query, updateDoc, where } from 'firebase/firestore';
import { auth, db, list, questions } from '../firebase.js';
import { useMe } from '../auth.jsx';
import { openQuestions } from './student/data.js';
import { courseCode, testCode, typeLabel } from '../schedule.js';
import { Btn, Empty, Field, Icon, Loading, Logo, attempt, notify, useBusy, useLoad } from '../ui.jsx';

/* ---------- notifications ---------- */
const ago = t => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
export function Notifications() {
  const me = useMe();
  const nav = useNavigate();
  const [rows, reload] = useLoad(() => list(query(collection(db, 'notifications'), where('userId', '==', me.uid))));
  if (!rows) return <Loading />;
  const sorted = [...rows].sort((a, b) => b.at - a.at);
  const open = n => attempt(async () => { if (!n.read) await updateDoc(doc(db, 'notifications', n.id), { read: true }); dispatchEvent(new Event('tk-notifs')); if (n.link) nav(n.link); else reload(); });
  const readAll = () => attempt(async () => { await Promise.all(rows.filter(n => !n.read).map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }))); dispatchEvent(new Event('tk-notifs')); reload(); });
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 760 }}>
      <div className="between">
        <p className="muted" style={{ margin: 0 }}>{rows.filter(n => !n.read).length} unread</p>
        <button className="btn btn-ghost btn-sm" onClick={readAll} disabled={!rows.some(n => !n.read)}>Mark all read</button>
      </div>
      {sorted.length === 0 ? <Empty title="You're all caught up" body="New tests and enrollments will show up here." /> : (
        <div className="card" style={{ padding: 6 }}>
          {sorted.map(n => (
            <button key={n.id} className="rowlink" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left' }} onClick={() => open(n)}>
              <span className="row">
                <span style={{ width: 10, height: 10, borderRadius: 99, background: n.read ? 'transparent' : 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontWeight: n.read ? 400 : 600 }}>{n.text}</span>
              </span>
              <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{ago(n.at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- settings ---------- */
export const applyTheme = t => { if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t; };
export function Settings() {
  const me = useMe();
  const [name, setName] = useState(me.name);
  const [pw, setPw] = useState('');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('tk-theme') || 'system'; } catch { return 'system'; } });
  const pick = t => { setTheme(t); applyTheme(t); try { localStorage.setItem('tk-theme', t); } catch { /* private mode: theme just won't persist */ } };
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 640 }}>
      <form className="card stack" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); attempt(async () => { await updateDoc(doc(db, 'users', me.uid), { name: name.trim() }); await updateDoc(doc(db, 'leaderboard', me.uid), { name: name.trim() }).catch(() => {}); notify('Name updated'); }); }}>
        <h3 className="h3" style={{ fontSize: 20 }}>Profile</h3>
        <Field label="Display name"><input className="input" required disabled={me.role !== 'student'} value={name} onChange={e => setName(e.target.value)} /></Field>
        {me.role !== 'student' && <span className="small muted">Ask an admin to change your name: it is shown on course pages.</span>}
        <div className="small muted">Signed in as {me.email}</div>
        <Btn v="ink" className="" style={{ alignSelf: 'flex-start' }} disabled={me.role !== 'student'}>Save name</Btn>
      </form>
      <section className="card stack" style={{ gap: 12 }}>
        <h3 className="h3" style={{ fontSize: 20 }}>Appearance</h3>
        <div className="seg">{[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => <button key={k} aria-pressed={theme === k} onClick={() => pick(k)}>{l}</button>)}</div>
      </section>
      <form className="card stack" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); attempt(async () => { await updatePassword(auth.currentUser, pw); setPw(''); notify('Password changed'); }); }}>
        <h3 className="h3" style={{ fontSize: 20 }}>Password</h3>
        <Field label="New password (min 6)"><input className="input" type="password" minLength={6} required autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <Btn v="ink" style={{ alignSelf: 'flex-start' }}>Change password</Btn>
        <span className="small muted">If it says you need to log in again, log out and back in, then retry.</span>
      </form>
      <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => signOut(auth)}><Icon name="logout" size={18} />Log out</button>
    </div>
  );
}

/* ---------- search ---------- */
const Section = ({ title, children }) => <section className="stack" style={{ gap: 8 }}><h2 className="h3" style={{ fontSize: 20 }}>{title}</h2><div className="card" style={{ padding: 6 }}>{children}</div></section>;
export function SearchPage() {
  const me = useMe();
  const [sp, setSp] = useSearchParams();
  const q = (sp.get('q') || '').trim().toLowerCase();
  const [text, setText] = useState(sp.get('q') || '');
  const [d] = useLoad(async () => ({
    courses: await list(me.role === 'student' ? query(collection(db, 'courses'), where('students', 'array-contains', me.uid)) : me.role === 'trainer' ? query(collection(db, 'courses'), where('trainerId', '==', me.uid)) : collection(db, 'courses')),
    qs: me.role === 'student' ? await openQuestions() : await questions(), // students must not find exam questions here
    tests: await list(collection(db, 'tests')),
    all: await list(collection(db, 'courses')), // to find which course a test belongs to
  }));
  const has = s => s.toLowerCase().includes(q);
  const hit = d && q.length >= 2 && {
    courses: d.courses.filter(c => has(`${c.title} ${c.description} ${courseCode(c)} ${courseCode(c).slice(2)}`)),
    qs: d.qs.filter(x => has(`${x.title} ${x.topic || ''} ${x.statement} ${x.constraints || ''}`)),
    tests: d.tests.filter(x => !x.draft || x.authorId === me.uid).filter(x => has(`${x.title} ${testCode(x)} ${testCode(x).slice(2)}`)).map(x => {
      const own = x.authorId === me.uid, mine = d.courses.find(c => c.testIds?.includes(x.id)), any = d.all.find(c => c.testIds?.includes(x.id));
      const to = own && me.role === 'trainer' ? `/tests/${x.id}/edit` : mine && me.role === 'student' ? `/test/${mine.id}/${x.id}` : any ? `/course/${any.id}` : null;
      return { ...x, to };
    }).filter(x => x.to), // a test that is not in any course cannot be opened by anyone else
  };
  return (
    <div className="stack" style={{ gap: 18 }}>
      <form role="search" className="row" onSubmit={e => { e.preventDefault(); setSp({ q: text }); }}>
        <label className="sr" htmlFor="sq">Search</label>
        <input id="sq" className="input" type="search" autoFocus placeholder="Search courses, questions and tests (name or ID)…" value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 54, fontSize: 17 }} />
        <button className="btn btn-ink btn-lg" type="submit">Search</button>
      </form>
      {!d ? <Loading /> : !hit ? <Empty title="Search everything" body="Find courses and practice questions. Try a topic like “strings”." /> : (
        hit.courses.length + hit.qs.length + hit.tests.length === 0 ? <Empty title={`No results for “${sp.get('q')}”`} body="Check the spelling, or try a broader word." /> : (
          <>
            {hit.qs.length > 0 && <Section title="Questions">{hit.qs.map(x => (
              <Link key={x.id} to={me.role === 'student' ? `/solve/practice/practice/${x.id}` : '/questions'} className="rowlink">
                <b>{x.title}</b><span className="row small"><span className="muted">{x.topic}</span><span className="chip">{typeLabel(x)}</span></span>
              </Link>))}</Section>}
            {hit.tests.length > 0 && <Section title="Tests">{hit.tests.map(x => (
              <Link key={x.id} to={x.to} className="rowlink"><b>{x.title}</b><span className="row small"><span className="mono muted">{testCode(x)}</span>{x.authorName && <span className="muted">{x.authorName}</span>}</span></Link>))}</Section>}
            {hit.courses.length > 0 && <Section title="Courses">{hit.courses.map(c => (
              <Link key={c.id} to={`/course/${c.id}`} className="rowlink"><b>{c.title}</b><span className="row small"><span className="mono muted">{courseCode(c)}</span><span className="muted">{c.trainerName}</span></span></Link>))}</Section>}
          </>
        )
      )}
    </div>
  );
}

/* ---------- forgot password (public) ---------- */
export function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, run] = useBusy();
  return (
    <div className="auth">
      <aside className="auth-art"><Link to="/" style={{ textDecoration: 'none' }}><Logo /></Link><span /><span className="small" style={{ color: '#9CA0AB' }}>Courses, tests and results, in one place.</span></aside>
      <main className="auth-form">
        <form className="auth-box" onSubmit={e => { e.preventDefault(); run(async () => { await sendPasswordResetEmail(auth, email).catch(e => { if (e.code !== 'auth/user-not-found') throw e; }); setSent(true); }); }}>
          <div className="mobile-logo"><Logo size={26} /></div>
          <h1 className="h2" style={{ fontSize: 38 }}>Reset your password</h1>
          {sent ? (
            <>
              <p className="muted" style={{ margin: 0 }}>If an account exists for {email}, we've emailed a link to set a new password.</p>
              <Link to="/login" className="btn btn-ink btn-lg">Back to log in</Link>
            </>
          ) : (
            <>
              <p className="muted" style={{ margin: 0 }}>Enter the email your admin used for your account.</p>
              <Field label="Email"><input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
              <Btn v="ink" className="btn-lg" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Btn>
              <Link to="/login" className="small" style={{ textAlign: 'center' }}>Back to log in</Link>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
