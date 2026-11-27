import { Profile } from './student/Profile.jsx';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sendPasswordResetEmail, signOut, updatePassword } from 'firebase/auth';
import { collection, doc, query, updateDoc, where } from 'firebase/firestore';
import { auth, db, list, questions } from '../firebase.js';
import { useMe } from '../auth.jsx';
import { isPublic } from './student/data.js';
import { courseCode, testCode, typeLabel } from '../schedule.js';
import { Btn, Empty, Field, Icon, Loading, Logo, attempt, notify, useBusy, useLoad, btn, Card, Chip, H3, Input, H2, PageHero } from '../ui.jsx';

// Section title with a small icon tile, used on the Settings cards.
const Head = ({ icon, children, hint }) => <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-ink grid place-items-center shrink-0"><Icon name={icon} size={18} /></span><span className="flex flex-col gap-0.5"><H3 className="text-[18px]">{children}</H3>{hint && <span className="text-[13px] text-muted">{hint}</span>}</span></div>;

/* ---------- settings ---------- */
export const applyTheme = t => { if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t; };
export function Settings() {
  const me = useMe();
  const [name, setName] = useState(me.name);
  const [pw, setPw] = useState('');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('tk-theme') || 'system'; } catch { return 'system'; } });
  const pick = t => { setTheme(t); applyTheme(t); try { localStorage.setItem('tk-theme', t); } catch { /* private mode: theme just won't persist */ } };
  return (
    <div className="flex flex-col gap-5">
      {me.role === 'student' ? <Profile /> : <PageHero title={me.name} stats={[['user', 'Email', me.email], ['shield', 'Role', me.role === 'admin' ? 'Admin' : 'Trainer']]} />}
      <H3 as="h2" className="text-[20px] mt-2">Settings</H3>
      <div className="grid gap-4 grid-cols-2 max-tablet:grid-cols-1 items-start">
      <Card as="form" className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); attempt(async () => { await updateDoc(doc(db, 'users', me.uid), { name: name.trim() }); await updateDoc(doc(db, 'leaderboard', me.uid), { name: name.trim() }).catch(() => {}); notify('Name updated'); }); }}>
        <Head icon="user" hint="Shown on the leaderboard and to your trainers">Name</Head>
        <Field label="Display name"><Input required disabled={me.role !== 'student'} value={name} onChange={e => setName(e.target.value)} /></Field>
        {me.role !== 'student' && <span className="text-[13px] text-muted">Ask an admin to change your name: it is shown on course pages.</span>}
        <div className="text-[13px] text-muted">Signed in as {me.email}</div>
        <Btn v="ink" className="self-start" disabled={me.role !== 'student'}>Save name</Btn>
      </Card>
      <Card as="section" className="flex flex-col gap-4">
        <Head icon="eye" hint="Follow your device, or always light or dark">Appearance</Head>
        <div className="seg flex flex-wrap gap-2 [:where(&)_button]:min-h-11 [:where(&)_button]:px-4 [:where(&)_button]:rounded-xl [:where(&)_button]:border-[1.5px] [:where(&)_button]:border-line [:where(&)_button]:bg-surface [:where(&)_button]:font-medium [:where(&)_button[aria-pressed=true]]:border-ink [:where(&)_button[aria-pressed=true]]:bg-ink [:where(&)_button[aria-pressed=true]]:text-paper [:where(&)_button[aria-pressed=true]]:font-semibold [:where(&)_button:disabled]:opacity-50 [:where(&)_button:disabled]:cursor-not-allowed">{[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => <button key={k} aria-pressed={theme === k} onClick={() => pick(k)}>{l}</button>)}</div>
      </Card>
      <Card as="form" className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); attempt(async () => { await updatePassword(auth.currentUser, pw); setPw(''); notify('Password changed'); }); }}>
        <Head icon="lock" hint="At least 8 characters">Password</Head>
        <Field label="New password (min 8)"><Input type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <Btn v="ink" className="self-start">Change password</Btn>
        <span className="text-[13px] text-muted">If it says you need to log in again, log out and back in, then retry.</span>
      </Card>
      <Card className="flex flex-col gap-4">
        <Head icon="logout" hint="You can sign back in any time">Session</Head>
        <button className={btn('ghost', 'md', 'self-start')} onClick={() => signOut(auth)}><Icon name="logout" size={18} />Log out</button>
      </Card>
      </div>
    </div>
  );
}

/* ---------- search ---------- */
const Section = ({ title, children }) => <section className="flex flex-col gap-2"><H3 as="h2" className="text-[20px]">{title}</H3><Card className="p-1.5">{children}</Card></section>;
export function SearchPage() {
  const me = useMe();
  const [sp, setSp] = useSearchParams();
  const q = (sp.get('q') || '').trim().toLowerCase();
  const [text, setText] = useState(sp.get('q') || '');
  const [d] = useLoad(async () => ({
    courses: await list(me.role === 'student' ? query(collection(db, 'courses'), where('students', 'array-contains', me.uid)) : me.role === 'trainer' ? query(collection(db, 'courses'), where('trainerId', '==', me.uid)) : collection(db, 'courses')),
    qs: me.role === 'student' ? (await questions()).filter(isPublic) : await questions(), // students do not see private questions
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
    <div className="flex flex-col gap-4.5">
      <form role="search" className="flex items-center gap-3" onSubmit={e => { e.preventDefault(); setSp({ q: text }); }}>
        <label className="sr-only" htmlFor="sq">Search</label>
        <input id="sq" className="px-3.5 rounded-xl border-[1.5px] border-field-line bg-surface w-full focus:border-ink min-h-13.5 text-[17px]" type="search" autoFocus placeholder="Search courses, questions and tests (name or ID)…" value={text} onChange={e => setText(e.target.value)} />
        <button className={btn('ink', 'lg')} type="submit">Search</button>
      </form>
      {!d ? <Loading /> : !hit ? <Empty title="Search everything" body="Find courses and practice questions. Try a topic like “strings”." /> : (
        hit.courses.length + hit.qs.length + hit.tests.length === 0 ? <Empty title={`No results for “${sp.get('q')}”`} body="Check the spelling, or try a broader word." /> : (
          <>
            {hit.qs.length > 0 && <Section title="Questions">{hit.qs.map(x => (
              <Link key={x.id} to={me.role === 'student' ? `/solve/practice/practice/${x.id}` : '/questions'} className="group/rl flex items-center justify-between gap-3 p-3 rounded-xl no-underline hover:bg-soft [&+&]:border-t [&+&]:border-line [&+&]:rounded-t-none hover:border-t-transparent [&:hover+&]:border-t-transparent">
                <b>{x.title}</b><span className="flex items-center gap-3 text-[13px]"><span className="text-muted">{x.topic}</span><Chip as="span">{typeLabel(x)}</Chip></span>
              </Link>))}</Section>}
            {hit.tests.length > 0 && <Section title="Tests">{hit.tests.map(x => (
              <Link key={x.id} to={x.to} className="group/rl flex items-center justify-between gap-3 p-3 rounded-xl no-underline hover:bg-soft [&+&]:border-t [&+&]:border-line [&+&]:rounded-t-none hover:border-t-transparent [&:hover+&]:border-t-transparent"><b>{x.title}</b><span className="flex items-center gap-3 text-[13px]"><span className="font-mono text-muted">{testCode(x)}</span>{x.authorName && <span className="text-muted">{x.authorName}</span>}</span></Link>))}</Section>}
            {hit.courses.length > 0 && <Section title="Courses">{hit.courses.map(c => (
              <Link key={c.id} to={`/course/${c.id}`} className="group/rl flex items-center justify-between gap-3 p-3 rounded-xl no-underline hover:bg-soft [&+&]:border-t [&+&]:border-line [&+&]:rounded-t-none hover:border-t-transparent [&:hover+&]:border-t-transparent"><b>{c.title}</b><span className="flex items-center gap-3 text-[13px]"><span className="font-mono text-muted">{courseCode(c)}</span><span className="text-muted">{c.trainerName}</span></span></Link>))}</Section>}
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
    <div className="min-h-dvh grid grid-cols-2 max-tablet:grid-cols-1">
      <aside className="bg-panel text-cream p-12 flex flex-col justify-between gap-8 max-tablet:hidden"><Link className="no-underline" to="/"><Logo dark /></Link><span /><span className="text-[13px] text-panel-muted">Courses, tests and results, in one place.</span></aside>
      <main className="flex items-center justify-center py-12 px-6">
        <form className="w-full max-w-[420px] flex flex-col gap-[18px]" onSubmit={e => { e.preventDefault(); run(async () => { await sendPasswordResetEmail(auth, email).catch(e => { if (e.code !== 'auth/user-not-found') throw e; }); setSent(true); }); }}>
          <div className="hidden max-tablet:block"><Logo size={26} /></div>
          <H2 as="h1" className="text-[38px]">Reset your password</H2>
          {sent ? (
            <>
              <p className="text-muted m-0">If an account exists for {email}, we've emailed a link to set a new password.</p>
              <Link to="/login" className={btn('ink', 'lg')}>Back to log in</Link>
            </>
          ) : (
            <>
              <p className="text-muted m-0">Enter the email you log in with.</p>
              <Field label="Email"><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
              <Btn v="ink" className="min-h-14! px-[30px]! text-[17px]!" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Btn>
              <Link to="/login" className="text-[13px] flex items-center justify-center min-h-11">Back to log in</Link>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
