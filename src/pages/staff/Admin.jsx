import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection, doc, getCountFromServer, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { createLogin, db, freeCode, list } from '../../firebase.js';
import { Avatar, Btn, CourseGrid, Empty, Field, Icon, Loading, attempt, notify, plural, useBusy, useLoad, btn, Card, Chip, Input, H3 } from '../../ui.jsx';

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
      await addDoc(collection(db, 'courses'), { code: await freeCode('courses', 'C'), title: f.title, description: f.description, trainerId: t.id, trainerName: t.name, students: [], testIds: [], createdAt: serverTimestamp() });
      setF({ title: '', description: '', trainerId: '' });
      setOpen(false);
      notify('Course added');
      reload();
    });
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted m-0">Enroll students here once they've paid.</p>
        <button className={btn('ink')} onClick={() => setOpen(!open)}><Icon name="plus" size={18} />{open ? 'Close' : 'Add course'}</button>
      </div>
      {open && (
        <Card as="form" className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1" onSubmit={add}>
          <Field label="Title"><Input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Description"><Input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Trainer">
            <Input as="select" value={f.trainerId} onChange={e => setF({ ...f, trainerId: e.target.value })}>
              <option value="">Select…</option>
              {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Input>
          </Field>
          <div><Btn v="accent" disabled={busy}>Save course</Btn></div>
        </Card>
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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted m-0">Subscribed students can resubmit answers. Free students get one attempt per question.</p>
        <button className={btn('ink')} onClick={() => setOpen(!open)}><Icon name="plus" size={18} />{open ? 'Close' : 'Add user'}</button>
      </div>
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
      <Card className="overflow-x-auto p-1.5">
        <table className="border-collapse w-full">
          <thead><tr><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Name</th><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Email</th><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Role</th><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Subscribed</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="p-3 border-b border-line text-[15px]"><span className="flex items-center gap-2.5"><Avatar name={u.name} size={32} /><b>{u.name}</b></span></td>
                <td className="p-3 border-b border-line text-[15px] text-muted">{u.email}</td>
                <td className="p-3 border-b border-line text-[15px]"><Chip as="span" className="[text-transform:capitalize]">{u.role}</Chip></td>
                <td className="p-3 border-b border-line text-[15px]">{u.role === 'student' ? <button className="relative w-12 h-7 rounded-full border-0 bg-line shrink-0 transition-[background] duration-150 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-[22px] after:h-[22px] after:rounded-full after:bg-white after:transition-transform after:duration-150 aria-checked:bg-ink aria-checked:after:translate-x-5" role="switch" aria-checked={!!u.subscribed} aria-label={`Subscription for ${u.name}`} onClick={() => toggle(u)} /> : <span className="text-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 grid-cols-4 max-laptop:grid-cols-2">
        {stats.map(([l, n, sub], i) => (
          <div key={l} className={`${i === 0 ? 'bg-panel text-cream rounded-lg p-[22px]' : 'bg-surface border border-line rounded-lg p-[22px] max-phone:p-[18px] shadow-[0_1px_2px_rgba(23,24,28,.04),0_8px_24px_-16px_rgba(23,24,28,.12)] transition-[box-shadow,transform,border-color] duration-200'} flex flex-col [:where(&)_.big]:text-[42px] max-phone:[:where(&)_.big]:text-[32px] gap-2.5`}>
            <div className="text-[13px] opacity-[0.75]">{l}</div><div className="big font-display font-extrabold tracking-[-.03em] leading-none">{n}</div><div className="text-[13px] opacity-[0.75]">{sub}</div>
          </div>
        ))}
      </div>
      <Card as="section" className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3"><H3 as="h2" className="text-[22px]">Recent payments</H3><Link to="/payments" className="text-[13px] font-semibold">See all</Link></div>
        {recent.length === 0 ? <p className="text-muted text-[13px]">No payments recorded yet. Add an amount when you enroll a student.</p> : recent.map(p => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-[10px_0] [border-top:1px_solid_var(--line)]">
            <span><b>{p.userName}</b> <span className="text-muted text-[13px]">enrolled in {p.courseTitle}</span></span><span className="font-mono">₹{p.amount.toLocaleString('en-IN')}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function AdminPayments() {
  const [pays] = useLoad(() => list(collection(db, 'payments')));
  if (!pays) return <Loading />;
  const rows = [...pays].sort((a, b) => b.at - a.at);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted m-0">Payments are recorded when you enroll a student on a course page. Total: <b>₹{rows.reduce((n, p) => n + p.amount, 0).toLocaleString('en-IN')}</b></p>
      {rows.length === 0 ? <Empty title="No payments yet" /> : (
        <Card className="overflow-x-auto p-1.5">
          <table className="border-collapse w-full">
            <thead><tr><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Date</th><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Student</th><th className="text-left text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line">Course</th><th className="text-[13px] font-semibold text-muted py-2.5 px-3 border-b border-line text-right">Amount</th></tr></thead>
            <tbody>{rows.map(p => (
              <tr key={p.id}><td className="p-3 border-b border-line text-[15px] text-muted">{new Date(p.at).toLocaleDateString('en-IN')}</td><td className="p-3 border-b border-line text-[15px]"><b>{p.userName}</b></td><td className="p-3 border-b border-line text-[15px]">{p.courseTitle}</td><td className="p-3 border-b border-line text-[15px] font-mono text-right">₹{p.amount.toLocaleString('en-IN')}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
