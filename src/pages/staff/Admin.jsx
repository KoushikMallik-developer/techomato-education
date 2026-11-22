import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection, doc, getCountFromServer, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { createLogin, db, list } from '../../firebase.js';
import { Avatar, Btn, CourseGrid, Empty, Field, Icon, Loading, attempt, notify, plural, useBusy, useLoad } from '../../ui.jsx';

export function AdminCourses() {
  const [data, reload] = useLoad(async () => ({ courses: await list(collection(db, 'courses')), users: await list(collection(db, 'users')) }));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', description: '', trainerId: '' });
  const [busy, run] = useBusy();
  if (!data) return <Loading />;
  const trainers = data.users.filter(u => u.role === 'trainer');
  const add = e => {
    e.preventDefault();
    run(async () => {
      const t = trainers.find(x => x.id === f.trainerId);
      if (!t) throw new Error('Pick a trainer (create one in Users first)');
      await addDoc(collection(db, 'courses'), { title: f.title, description: f.description, trainerId: t.id, trainerName: t.name, students: [], testIds: [], createdAt: serverTimestamp() });
      setF({ title: '', description: '', trainerId: '' });
      setOpen(false);
      notify('Course added');
      reload();
    });
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between">
        <p className="muted" style={{ margin: 0 }}>Enroll students here once they've paid.</p>
        <button className="btn btn-ink" onClick={() => setOpen(!open)}><Icon name="plus" size={18} />{open ? 'Close' : 'Add course'}</button>
      </div>
      {open && (
        <form className="card grid g3" onSubmit={add}>
          <Field label="Title"><input className="input" required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Description"><input className="input" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Trainer">
            <select className="input" value={f.trainerId} onChange={e => setF({ ...f, trainerId: e.target.value })}>
              <option value="">Select…</option>
              {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <div><Btn v="accent" disabled={busy}>Save course</Btn></div>
        </form>
      )}
      <CourseGrid courses={data.courses} empty="No courses yet" />
    </div>
  );
}

export function AdminUsers() {
  const [users, reload] = useLoad(() => list(collection(db, 'users')));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student' });
  const [busy, run] = useBusy();
  if (!users) return <Loading />;
  const add = e => {
    e.preventDefault();
    run(async () => {
      const uid = await createLogin(f.email, f.password);
      if ((await getDoc(doc(db, 'users', uid))).exists()) throw new Error('That email already has an account.');
      await setDoc(doc(db, 'users', uid), { name: f.name, email: f.email, role: f.role, subscribed: false });
      setF({ name: '', email: '', password: '', role: 'student' });
      setOpen(false);
      notify('User created. Share the password with them.');
      reload();
    });
  };
  const toggle = u => attempt(async () => { await updateDoc(doc(db, 'users', u.id), { subscribed: !u.subscribed }); reload(); });
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between">
        <p className="muted" style={{ margin: 0 }}>Subscribed students can resubmit answers. Free students get one attempt per question.</p>
        <button className="btn btn-ink" onClick={() => setOpen(!open)}><Icon name="plus" size={18} />{open ? 'Close' : 'Add user'}</button>
      </div>
      {open && (
        <form className="card grid g4" onSubmit={add}>
          <Field label="Name"><input className="input" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Password (min 6)"><input className="input" minLength={6} required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Role">
            <select className="input" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
              <option value="student">Student</option><option value="trainer">Trainer</option>
            </select>
          </Field>
          <div><Btn v="accent" disabled={busy}>Create user</Btn></div>
        </form>
      )}
      <div className="card scroll-x" style={{ padding: 6 }}>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Subscribed</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><span className="row" style={{ gap: 10 }}><Avatar name={u.name} size={32} /><b>{u.name}</b></span></td>
                <td className="muted">{u.email}</td>
                <td><span className="chip" style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                <td>{u.role === 'student' ? <button className="switch" role="switch" aria-checked={!!u.subscribed} aria-label={`Subscription for ${u.name}`} onClick={() => toggle(u)} /> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminOverview() {
  const [d] = useLoad(async () => ({
    users: await list(collection(db, 'users')), courses: await list(collection(db, 'courses')),
    subs: (await getCountFromServer(collection(db, 'submissions'))).data().count, pays: await list(collection(db, 'payments')),
  }));
  if (!d) return <Loading />;
  const students = d.users.filter(u => u.role === 'student');
  const revenue = d.pays.reduce((n, p) => n + (p.amount || 0), 0);
  const recent = [...d.pays].sort((a, b) => b.at - a.at).slice(0, 5);
  const stats = [
    ['Students', students.length, `${students.filter(u => u.subscribed).length} subscribed`],
    ['Trainers', d.users.filter(u => u.role === 'trainer').length, 'teaching'],
    ['Courses', d.courses.length, `${d.courses.reduce((n, c) => n + c.students.length, 0)} enrollments`],
    ['Revenue', '₹' + revenue.toLocaleString('en-IN'), `${plural(d.pays.length, 'payment')}, ${plural(d.subs, 'submission')}`],
  ];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="grid g4">
        {stats.map(([l, n, sub], i) => (
          <div key={l} className={`${i === 0 ? 'card-dark' : 'card'} stack stat`} style={{ gap: 10 }}>
            <div className="small" style={{ opacity: 0.75 }}>{l}</div><div className="big">{n}</div><div className="small" style={{ opacity: 0.75 }}>{sub}</div>
          </div>
        ))}
      </div>
      <section className="card stack" style={{ gap: 6 }}>
        <div className="between"><h2 className="h3" style={{ fontSize: 22 }}>Recent payments</h2><Link to="/payments" className="small" style={{ fontWeight: 600 }}>See all</Link></div>
        {recent.length === 0 ? <p className="muted small">No payments recorded yet. Add an amount when you enroll a student.</p> : recent.map(p => (
          <div key={p.id} className="between" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <span><b>{p.userName}</b> <span className="muted small">enrolled in {p.courseTitle}</span></span><span className="mono">₹{p.amount.toLocaleString('en-IN')}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

export function AdminPayments() {
  const [pays] = useLoad(() => list(collection(db, 'payments')));
  if (!pays) return <Loading />;
  const rows = [...pays].sort((a, b) => b.at - a.at);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="muted" style={{ margin: 0 }}>Payments are recorded when you enroll a student on a course page. Total: <b>₹{rows.reduce((n, p) => n + p.amount, 0).toLocaleString('en-IN')}</b></p>
      {rows.length === 0 ? <Empty title="No payments yet" /> : (
        <div className="card scroll-x" style={{ padding: 6 }}>
          <table>
            <thead><tr><th>Date</th><th>Student</th><th>Course</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{rows.map(p => (
              <tr key={p.id}><td className="muted">{new Date(p.at).toLocaleDateString('en-IN')}</td><td><b>{p.userName}</b></td><td>{p.courseTitle}</td><td className="mono" style={{ textAlign: 'right' }}>₹{p.amount.toLocaleString('en-IN')}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
