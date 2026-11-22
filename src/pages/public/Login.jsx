import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase.js';
import { DemoNote, highlight, Logo, useBusy } from '../../ui.jsx';

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
    <div className="auth">
      <aside className="auth-art">
        <span style={{ color: '#F5F2EC' }}><Logo /></span>
        <div className="stack" style={{ gap: 18 }}>
          <div className="window" style={{ maxWidth: 480 }}>
            <div className="win-bar"><div className="dots"><span /><span /><span /></div><span>factorial.py</span><span /></div>
            <pre className="code" style={{ padding: '18px 22px' }} dangerouslySetInnerHTML={{ __html: highlight(SAMPLE) }} />
          </div>
          <p className="h3" style={{ fontSize: 30, maxWidth: 440 }}>Write the code. Pass the test cases. Prove it.</p>
        </div>
        <span className="small" style={{ color: '#9CA0AB' }}>Courses, tests and results, in one place.</span>
      </aside>
      <main className="auth-form">
        <form className="auth-box" onSubmit={e => { e.preventDefault(); if (!email || !pw) { setErr('Enter your email and password.'); e.target.elements[email ? 'password' : 'email'].focus(); return; } signIn(email, pw); }} noValidate>
          <div className="mobile-logo"><Logo size={26} /></div>
          <DemoNote style={{ marginBottom: 0 }} />
          <h1 className="h2" style={{ fontSize: 38 }}>Welcome back</h1>
          <p className="muted" style={{ margin: 0 }}>Log in with the account your admin created for you.</p>
          <label className="field"><span>Email</span><input className="input" name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="field"><span>Password</span><input className="input" name="password" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
          {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
          <button className="btn btn-ink btn-lg" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          <Link to="/forgot" className="small" style={{ textAlign: 'center' }}>Forgot password?</Link>
          {import.meta.env.MODE === 'demo' && (
            <>
              <div className="row small muted" style={{ gap: 10 }}>
                <span style={{ flexGrow: 1, height: 1, background: 'var(--line)' }} />Explore with a demo account<span style={{ flexGrow: 1, height: 1, background: 'var(--line)' }} />
              </div>
              <div className="grid g2" style={{ gap: 10 }}>
                {DEMOS.map(([label, mail]) => <button key={mail} type="button" className="btn btn-ghost" onClick={() => signIn(mail, 'demo123')}>{label}</button>)}
              </div>
              <button type="button" className="btn btn-plain btn-sm" onClick={() => { localStorage.clear(); location.reload(); }}>Reset demo data</button>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
