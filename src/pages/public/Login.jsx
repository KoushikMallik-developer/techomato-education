import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from 'firebase/auth';
import { auth } from '../../firebase.js';
import { makeProfile, useMe } from '../../auth.jsx';
import { DemoNote, highlight, Icon, Logo, useBusy, btn, H2, Input } from '../../ui.jsx';

const SAMPLE = 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)';
const ERRORS = {
  'auth/network-request-failed': 'No connection. Try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes.',
  'auth/email-already-in-use': 'That email already has an account. Log in instead.',
  'auth/invalid-email': 'Enter a valid email.',
  'auth/weak-password': 'Use at least 8 characters for your password.',
  'auth/account-exists-with-different-credential': 'This email already logs in with a password. Use that instead.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups and try again.',
  'auth/unauthorized-domain': 'Google sign-in is not set up for this site yet.',
};
const QUIET = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: 'select_account' });
const PERKS = [['code', 'Practice problems', 'By topic and level, with instant results'], ['flame', 'Daily contest', 'Earn points and climb the leaderboard'], ['lock', 'Proctored tests', 'Timed exams from your institute']];
const DEMOS = [['Admin', 'admin@demo.com'], ['Trainer', 'trainer@demo.com'], ['Student (free)', 'student@demo.com'], ['Student (subscribed)', 'pro@demo.com']];

export default function Login({ signup }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, run] = useBusy();
  const go = fn => run(async () => {
    setErr('');
    try { await fn(); } catch (x) {
      if (QUIET.includes(x.code)) return;
      setErr(ERRORS[x.code] || (x.code?.startsWith('auth/') ? (signup ? 'Could not create the account. Try again.' : 'Wrong email or password.') : x.message));
    }
  });
  const signIn = (e, p) => go(() => signInWithEmailAndPassword(auth, e, p));
  // the new login is signed in right away; App then shows VerifyEmail until the link is opened
  const register = () => go(async () => {
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), pw);
    await updateProfile(user, { displayName: name.trim() });
    await sendEmailVerification(user);
  });
  const submit = e => {
    e.preventDefault();
    const missing = signup && !name.trim() ? 'name' : !email ? 'email' : !pw ? 'password' : '';
    if (missing) { setErr(signup ? 'Enter your name, email and a password.' : 'Enter your email and password.'); e.target.elements[missing].focus(); return; }
    if (signup && pw.length < 8) { setErr(ERRORS['auth/weak-password']); e.target.elements.password.focus(); return; }
    if (signup) register(); else signIn(email, pw);
  };
  return (
    <div className="min-h-dvh grid grid-cols-2 max-tablet:grid-cols-1">
      <aside className="relative overflow-hidden bg-[#0E0F13] text-white p-12 flex flex-col justify-between gap-10 max-tablet:hidden">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_50%_40%,#000_25%,transparent_75%)]" aria-hidden="true" />
        <div className="absolute -top-24 -right-20 w-96 h-96 rounded-full bg-[#E2573D] blur-[130px] opacity-35 animate-float" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-10 w-80 h-80 rounded-full bg-[#5B8DEF] blur-[130px] opacity-20 animate-float [animation-delay:-4s]" aria-hidden="true" />
        <Link className="relative no-underline self-start" to="/" aria-label="Techomato home"><Logo dark /></Link>
        <div className="relative flex flex-col gap-8 w-full max-w-[480px] mx-auto">
          <h2 className="font-display font-extrabold tracking-[-.04em] leading-[.95] m-0 text-[clamp(44px,4.6vw,64px)]">Code.<br />Compete.<br /><span className="text-[#FF8A5B]">Prove it.</span></h2>
          <ul className="list-none! p-0 m-0 flex flex-col gap-4">
            {PERKS.map(([icon, t, d]) => (
              <li key={t} className="flex items-center gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-white/[.07] border border-white/10 grid place-items-center shrink-0"><Icon name={icon} size={18} color="#FF8A5B" /></span>
                <span className="flex flex-col"><b className="text-[15px]">{t}</b><span className="text-[13px] text-white/60">{d}</span></span>
              </li>
            ))}
          </ul>
          <div className="rounded-[18px] overflow-hidden border border-white/10 bg-[#15161B] shadow-[0_30px_60px_-24px_rgba(0,0,0,.7)]">
            <div className="h-10 flex items-center justify-between px-4 border-b border-white/10 font-mono text-[12px] text-white/55">
              <span className="flex gap-1.5" aria-hidden="true"><i className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><i className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><i className="w-2.5 h-2.5 rounded-full bg-[#28C840]" /></span>
              <span>factorial.py</span><span className="text-[#8FD3A0]">✓ 6/6</span>
            </div>
            <pre className="font-mono text-[14px] leading-[1.75] text-[#E7E8EC] m-0 whitespace-pre overflow-x-auto p-[16px_20px]" dangerouslySetInnerHTML={{ __html: highlight(SAMPLE) }} />
          </div>
        </div>
        <span className="relative text-[13px] text-white/50">Free for students. Python, JavaScript, C / C++ and HTML / CSS / JS.</span>
      </aside>
      <main className="flex items-center justify-center py-12 px-6">
        <form className="w-full max-w-[420px] flex flex-col gap-[18px]" onSubmit={submit} noValidate>
          <div className="flex items-center justify-between gap-3">
            <Link className="no-underline hidden max-tablet:block" to="/" aria-label="Techomato home"><Logo size={26} /></Link>
            <Link to="/" className="text-[13px] text-muted no-underline hover:text-ink ml-auto">← Back to home</Link>
          </div>
          <DemoNote style={{ marginBottom: 0 }} />
          <H2 as="h1" className="text-[38px]">{signup ? 'Create your account' : 'Welcome back'}</H2>
          <p className="text-muted m-0">{signup ? <>Free for students. Already have an account? <Link to="/login" className="text-accent font-semibold">Log in</Link></> : <>New here? <Link to="/signup" className="text-accent font-semibold">Create a free account</Link></>}</p>
          <button type="button" className={btn('ghost', 'lg')} disabled={busy} onClick={() => go(() => signInWithPopup(auth, google))}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
            Continue with Google
          </button>
          <div className="flex items-center text-[13px] text-muted gap-2.5"><span className="grow h-[1px] bg-line" />or with email<span className="grow h-[1px] bg-line" /></div>
          {signup && <label className="flex flex-col gap-1.5 [:where(&)>span]:text-[14px] [:where(&)>span]:font-semibold"><span>Name</span><Input name="name" autoComplete="name" maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>}
          <label className="flex flex-col gap-1.5 [:where(&)>span]:text-[14px] [:where(&)>span]:font-semibold"><span>Email</span><Input name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="flex flex-col gap-1.5 [:where(&)>span]:text-[14px] [:where(&)>span]:font-semibold"><span>Password</span><Input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={pw} onChange={e => setPw(e.target.value)} /></label>
          {err && <p className="text-accent-ink text-[13px] font-semibold m-0" role="alert">{err}</p>}
          <button className={btn('accent', 'lg')} type="submit" disabled={busy}>{busy ? (signup ? 'Creating account…' : 'Logging in…') : signup ? 'Create account' : 'Log in'}</button>
          {!signup && <Link to="/forgot" className="text-[13px] flex items-center justify-center min-h-11">Forgot password?</Link>}
          {import.meta.env.MODE === 'demo' && !signup && (
            <>
              <div className="flex items-center text-[13px] text-muted gap-2.5">
                <span className="grow h-[1px] bg-line" />Explore with a demo account<span className="grow h-[1px] bg-line" />
              </div>
              <div className="grid grid-cols-2 max-phone:grid-cols-1 gap-2.5">
                {DEMOS.map(([label, mail]) => <button key={mail} type="button" className={btn('ghost')} onClick={() => signIn(mail, 'demo123')}>{label}</button>)}
              </div>
              <button type="button" className={btn('plain', 'sm')} onClick={() => { localStorage.clear(); location.reload(); }}>Reset demo data</button>
            </>
          )}
        </form>
      </main>
    </div>
  );
}

// Shown after an email sign-up until the link in the email is opened.
export function VerifyEmail() {
  const me = useMe();
  const [msg, setMsg] = useState('');
  const [busy, run] = useBusy();
  const check = () => run(async () => {
    const u = auth.currentUser;
    await u.reload();
    if (!u.emailVerified) return setMsg('Not verified yet. Open the link in the email, then try again.');
    await u.getIdToken(true); // the rules read email_verified from the token, so get a fresh one
    await makeProfile(u);
  });
  const resend = () => run(async () => { await sendEmailVerification(auth.currentUser); setMsg('Sent again. Check your inbox and spam folder.'); });
  return (
    <main className="min-h-dvh flex items-center justify-center py-12 px-6">
      <div className="w-full max-w-[420px] flex flex-col gap-[18px]">
        <Logo size={26} />
        <H2 as="h1" className="text-[38px]">Check your email</H2>
        <p className="text-muted m-0">We sent a link to <b className="text-ink">{me.email}</b>. Open it to verify your email, then come back here.</p>
        {msg && <p className="text-ink-2 text-[14px] font-semibold m-0" role="status">{msg}</p>}
        <button className={btn('accent', 'lg')} disabled={busy} onClick={check}>I have verified my email</button>
        <button className={btn('ghost')} disabled={busy} onClick={resend}>Send the link again</button>
        <button className={btn('plain', 'sm')} onClick={() => signOut(auth)}>Use a different account</button>
      </div>
    </main>
  );
}
