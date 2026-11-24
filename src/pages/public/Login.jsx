import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase.js';
import { DemoNote, highlight, Logo, useBusy, btn, H3, H2, Input } from '../../ui.jsx';

const SAMPLE = 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)';
const DEMOS = [['Admin', 'admin@demo.com'], ['Trainer', 'trainer@demo.com'], ['Student (free)', 'student@demo.com'], ['Student (subscribed)', 'pro@demo.com']];

export default function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, run] = useBusy();
  const signIn = (e, p) => run(async () => {
    setErr('');
    try { await signInWithEmailAndPassword(auth, e, p); } catch (x) {
      setErr(x.code === 'auth/network-request-failed' ? 'No connection. Try again.' : x.code === 'auth/too-many-requests' ? 'Too many attempts. Wait a few minutes.' : 'Wrong email or password.');
    }
  });
  return (
    <div className="min-h-dvh grid grid-cols-2 max-tablet:grid-cols-1">
      <aside className="bg-panel text-cream p-12 flex flex-col justify-between gap-8 max-tablet:hidden">
        <Logo dark />
        <div className="flex flex-col gap-4.5">
          <div className="bg-panel rounded-[20px] overflow-hidden shadow-[0_30px_60px_-24px_rgba(23,24,28,.5)] max-w-[480px]">
            <div className="h-11 flex items-center justify-between px-[18px] border-b border-panel-line font-mono text-[12px] text-panel-muted"><div className="flex gap-[7px] [:where(&)_span]:w-[11px] [:where(&)_span]:h-[11px] [:where(&)_span]:rounded-full [:where(&)_span]:bg-[#3A3D46]"><span /><span /><span /></div><span>factorial.py</span><span /></div>
            <pre className="font-mono text-[14px] leading-[1.75] text-panel-text m-0 whitespace-pre overflow-x-auto p-[18px_22px]" dangerouslySetInnerHTML={{ __html: highlight(SAMPLE) }} />
          </div>
          <H3 as="p" className="text-[30px] max-w-[440px]">Write the code. Pass the test cases. Prove it.</H3>
        </div>
        <span className="text-[13px] text-panel-muted">Courses, tests and results, in one place.</span>
      </aside>
      <main className="flex items-center justify-center py-12 px-6">
        <form className="w-full max-w-[420px] flex flex-col gap-[18px]" onSubmit={e => { e.preventDefault(); if (!email || !pw) { setErr('Enter your email and password.'); e.target.elements[email ? 'password' : 'email'].focus(); return; } signIn(email, pw); }} noValidate>
          <div className="hidden max-tablet:block"><Logo size={26} /></div>
          <DemoNote style={{ marginBottom: 0 }} />
          <H2 as="h1" className="text-[38px]">Welcome back</H2>
          <p className="text-muted m-0">Log in with the account your admin created for you.</p>
          <label className="flex flex-col gap-1.5 [:where(&)>span]:text-[14px] [:where(&)>span]:font-semibold"><span>Email</span><Input name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="flex flex-col gap-1.5 [:where(&)>span]:text-[14px] [:where(&)>span]:font-semibold"><span>Password</span><Input name="password" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
          {err && <p className="text-accent-ink text-[13px] font-semibold m-0" role="alert">{err}</p>}
          <button className={btn('ink', 'lg')} type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          <Link to="/forgot" className="text-[13px] flex items-center justify-center min-h-11">Forgot password?</Link>
          {import.meta.env.MODE === 'demo' && (
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
