import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, freeCode, list } from '../../firebase.js';
import { LineChart } from '../../Charts.jsx';
import { series } from '../../score.js';
import { ms } from './trainerShared.jsx';
import { Avatar, Bar, Btn, CourseGrid, Field, Icon, Loading, notify, plural, useBusy, useLoad, Card, Input, H3, PageHero, heroBtn, btn } from '../../ui.jsx';

// what a payment was for. Payments made before courses became free carry a course; hand-recorded ones may have a note.
export const what = p => { const base = p.courseTitle ? `Course: ${p.courseTitle}` : p.kind === 'manual' ? 'Payment' : 'Pro subscription'; return p.note ? `${base} · ${p.note}` : base; };
export const rupees = n => '₹' + (n || 0).toLocaleString('en-IN');
export const TH = 'text-left text-[12px] uppercase tracking-[.08em] font-semibold text-muted py-3 px-4 border-b border-line';
export const TD = 'py-3 px-4 border-b border-line text-[15px]';
export const ROLE_TONE = { admin: 'accent', trainer: 'pass', student: 'soft' };

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
      <PageHero compact title="Courses"
        stats={[['book', 'Courses', data.courses.length, `${data.courses.filter(c => c.completed).length} completed`], ['users', 'Enrolled', data.courses.reduce((n, c) => n + c.students.length, 0), 'students in courses'], ['user', 'Trainers', trainers.length, 'can teach'], ['clip', 'Tests', data.courses.reduce((n, c) => n + (c.testIds?.length || 0), 0), 'assigned']]}
        actions={<button className={heroBtn} onClick={() => setOpen(!open)}><Icon name={open ? 'x' : 'plus'} size={18} />{open ? 'Close' : 'Add course'}</button>} />
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

export function AdminOverview() {
  const [d] = useLoad(async () => ({
    users: await list(collection(db, 'users')), courses: await list(collection(db, 'courses')),
    pays: await list(collection(db, 'payments')),
  }));
  if (!d) return <Loading />;
  const students = d.users.filter(u => u.role === 'student');
  const kept = d.pays.filter(p => !p.refunded), revenue = kept.reduce((n, p) => n + (p.amount || 0), 0);
  const recent = [...d.pays].sort((a, b) => ms(b.at) - ms(a.at)).slice(0, 5);
  const subscribed = students.filter(u => u.subscribed).length;
  const fresh = students.filter(u => u.createdAt).sort((a, b) => b.createdAt - a.createdAt);
  const week = fresh.filter(u => u.createdAt > Date.now() - 7 * 864e5).length;
  const enrolled = d.courses.reduce((n, c) => n + c.students.length, 0);
  const top = [...d.courses].sort((a, b) => b.students.length - a.students.length).slice(0, 5);
  const most = Math.max(1, ...top.map(c => c.students.length));
  const subPct = students.length ? Math.round((100 * subscribed) / students.length) : 0;
  return (
    <div className="flex flex-col gap-5">
      <PageHero compact title="Overview" text={week ? `${plural(week, 'new student')} signed up in the last 7 days.` : 'Courses, people and payments at a glance.'}
        stats={[['users', 'Students', students.length, `${subscribed} subscribed`], ['user', 'Trainers', d.users.filter(u => u.role === 'trainer').length, 'teaching'], ['book', 'Courses', d.courses.length, `${enrolled} enrollments`], ['chart', 'Revenue', rupees(revenue), plural(kept.length, 'payment')]]}
        ring={{ pct: subPct, big: `${subPct}%`, small: 'of students subscribed' }}
        actions={<><Link to="/users" className={heroBtn}><Icon name="users" size={18} />Manage users</Link><Link to="/courses" className={btn('ghost')}>Courses →</Link></>} />

      <div className="grid gap-4 grid-cols-2 max-tablet:grid-cols-1">
        <Trend title="Payments" items={kept.map(p => [ms(p.at), p.amount])} total={rupees} color="var(--accent)" />
        <Trend title="Sign-ups" items={students.map(u => [ms(u.createdAt), 1])} total={n => plural(n, 'student')} color="var(--pass-strong)" />
      </div>

      <div className="grid gap-4 grid-cols-3 max-laptop:grid-cols-1 items-start">
        <Card as="section" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3"><H3 as="h2" className="text-[20px]">Biggest courses</H3><Link to="/courses" className="text-[13px] font-semibold text-accent no-underline">All courses</Link></div>
          {top.length === 0 ? <p className="text-muted text-[14px] m-0">No courses yet.</p> : top.map(c => (
            <Link key={c.id} to={`/course/${c.id}`} className="flex flex-col gap-1.5 no-underline text-ink">
              <span className="flex items-center justify-between gap-3"><b className="truncate">{c.title}</b><span className="text-[13px] text-muted shrink-0">{plural(c.students.length, 'student')}</span></span>
              <Bar pct={(100 * c.students.length) / most} fill="bg-accent!" />
              <span className="text-[12px] text-muted">Trainer: {c.trainerName}</span>
            </Link>
          ))}
        </Card>
        <Card as="section" className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3 mb-2"><H3 as="h2" className="text-[20px]">Recent payments</H3><Link to="/payments" className="text-[13px] font-semibold text-accent no-underline">See all</Link></div>
          {recent.length === 0 ? <p className="text-muted text-[14px] m-0">No payments yet. They are recorded when you switch on Pro for a student.</p> : recent.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2.5 border-t border-line">
              <Avatar name={p.userName} size={32} />
              <span className="grow min-w-0 flex flex-col"><b className="truncate text-[14px]">{p.userName}</b><span className="text-muted text-[12px] truncate">{what(p)}</span></span>
              <span className={`font-mono text-[14px] ${p.refunded ? 'line-through text-muted' : ''}`} title={p.refunded ? 'Refunded' : undefined}>{rupees(p.amount)}</span>
            </div>
          ))}
        </Card>
        <Card as="section" className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3 mb-2"><H3 as="h2" className="text-[20px]">New sign-ups</H3><Link to="/users" className="text-[13px] font-semibold text-accent no-underline">All users</Link></div>
          {fresh.length === 0 ? <p className="text-muted text-[14px] m-0">Students who sign up on the website show up here. Enroll them in a course from its page.</p> : fresh.slice(0, 5).map(u => (
            <div key={u.id} className="flex items-center gap-3 py-2.5 border-t border-line">
              <Avatar name={u.name} size={32} />
              <span className="grow min-w-0 flex flex-col"><b className="truncate text-[14px]">{u.name}</b><span className="text-muted text-[12px] truncate">{u.email}</span></span>
              <span className="text-[12px] text-muted shrink-0">{new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

const RANGES = [['today', 'Today', 'today'], ['week', '7 days', 'in the last 7 days'], ['month', 'Month', 'in the last 30 days'], ['year', 'Year', 'in the last 12 months'], ['all', 'All', 'in total']];
// A line graph with its own time range buttons. total: how to say the sum, e.g. rupees
function Trend({ title, items, total, color }) {
  const [range, setRange] = useState('month');
  const data = series(items, range), r = RANGES.find(x => x[0] === range);
  return (
    <Card as="section" className="flex flex-col gap-3">
      <div><H3 as="h2" className="text-[18px]">{title}</H3><p className="text-[13px] text-muted m-[2px_0_0]">{total(data.reduce((a, p) => a + p.value, 0))} {r[2]}</p></div>
      <div className="flex gap-1 p-1 rounded-lg bg-soft border border-line w-full max-w-[420px]" role="group" aria-label={`${title}: time range`}>
        {RANGES.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)} className="grow min-h-8 pointer-coarse:min-h-11 px-1.5 rounded-md border-0 bg-transparent text-[12px] font-medium text-muted whitespace-nowrap hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:font-semibold aria-pressed:shadow-[0_1px_2px_rgba(23,24,28,.1)]">{l}</button>
        ))}
      </div>
      <LineChart data={data} label={`${title} ${r[2]}`} color={color} />
    </Card>
  );
}

