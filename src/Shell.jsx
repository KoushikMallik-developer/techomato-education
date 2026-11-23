import { Fragment, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db, list } from './firebase.js';
import { useMe } from './auth.jsx';
import { ProctorOverlay, useProctor } from './ProctorGuard.jsx';
import { Avatar, DemoNote, Icon, Logo } from './ui.jsx';

// group -> [label, path, icon, extra path prefixes that also highlight the item]
export const NAV = {
  admin: [['Manage', [['Overview', '/', 'chart'], ['Courses', '/courses', 'book', ['/course/']], ['Users', '/users', 'users'], ['Payments', '/payments', 'doc']]], ['Account', [['Settings', '/settings', 'gear']]]],
  trainer: [['Teach', [['Courses', '/', 'book', ['/course/']], ['Results', '/results', 'trophy'], ['Question bank', '/questions', 'code'], ['Tests', '/tests', 'clip']]], ['Account', [['Settings', '/settings', 'gear']]]],
  student: [
    ['Learning', [['Dashboard', '/', 'home'], ['Courses', '/courses', 'book', ['/course/', '/test/', '/solve/']]]],
    ['Practice', [['Problems', '/problems', 'list', ['/solve/practice/']], ['Daily contest', '/contest', 'flame'], ['Playground', '/playground', 'play'], ['Cheat sheets', '/cheatsheets', 'doc']]],
    ['Community', [['Leaderboard', '/leaderboard', 'trophy'], ['Achievements', '/achievements', 'medal']]],
    ['Account', [['Profile', '/profile', 'user'], ['Notifications', '/notifications', 'bell'], ['Settings', '/settings', 'gear']]],
  ],
};
const TABS = { admin: 4, trainer: 4 }; // phone tab bar shows the first N items; Settings (with Log out) is the last tab for staff
const STUDENT_TABS = [['Home', '/', 'home', ['/test/']], ['Learn', '/courses', 'book', ['/course/']], ['Contest', '/contest', 'flame'], ['Search', '/search', 'search'], ['More', '/more', 'more']];

export default function Shell({ title, children }) {
  const me = useMe();
  const { pathname } = useLocation();
  const groups = NAV[me.role] || [];
  const all = groups.flatMap(([, items]) => items);
  const admin = me.role === 'admin';
  // the longest matching prefix wins, so /solve/practice/ lights up Problems only, not Courses
  const hit = ([, to, , extra = []]) => Math.max(to === '/' ? (pathname === '/' ? 1 : 0) : pathname.startsWith(to) ? to.length : 0, ...extra.map(p => (pathname.startsWith(p) ? p.length : 0)));
  const best = all.reduce((b, i) => (hit(i) > hit(b) ? i : b), all[0]);
  const on = item => hit(item) > 0 && hit(item) === hit(best);
  const dark = admin ? { background: 'var(--panel)', color: '#E7E8EC', borderRight: 0 } : undefined;
  const linkStyle = item => (admin ? (on(item) ? { background: '#F5F2EC', color: '#17181C' } : { color: '#E7E8EC' }) : undefined);
  const student = me.role === 'student';
  const tabs = student ? STUDENT_TABS : [...all.slice(0, TABS[me.role]), all[all.length - 1]];
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState('');
  const px = useProctor();
  useEffect(() => {
    if (!student) return;
    const load = () => list(query(collection(db, 'notifications'), where('userId', '==', me.uid), where('read', '==', false))).then(r => setUnread(r.length), () => {});
    load();
    addEventListener('tk-notifs', load); // fired by the Notifications page after marking read
    return () => removeEventListener('tk-notifs', load);
  }, [pathname, me.uid, student]); // shortcut: refetched on navigation, not live

  // During a proctored exam the student sees only that test: no menu, and every other route bounces back.
  if (px.testId) {
    const ok = pathname.startsWith(`/solve/${px.courseId}/${px.testId}/`) || (pathname.startsWith('/test/') && pathname.endsWith(`/${px.testId}`));
    if (!ok) return <Navigate to={px.home} replace />;
    return (
      <div className="app"><div className="main" style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="warnbar" style={{ marginBottom: 16 }}><Icon name="lock" size={18} />Proctored exam in progress. You can leave only after you submit every question.</div>
        {children}
      </div><ProctorOverlay /></div>
    );
  }

  return (
    <div className="app">
      <ProctorOverlay />
      <aside className="side" style={dark} data-dark={admin || undefined} aria-label="Sidebar">
        <div className="between" style={{ padding: '0 8px' }}>
          <Link to="/" style={{ textDecoration: 'none' }}><Logo /></Link>
          {admin && <span className="chip" style={{ background: '#F2B8A8', color: '#17181C', padding: '3px 8px', fontSize: 11 }}>Admin</span>}
        </div>
        <nav className="side-nav" aria-label="Main">
          {groups.map(([g, items]) => (
            <Fragment key={g}>
              <div className="side-group">{g}</div>
              {items.map(item => (
                <Link key={item[1]} to={item[1]} className="side-link" aria-current={on(item) ? 'page' : undefined} style={linkStyle(item)}>
                  <Icon name={item[2]} />{item[0]}
                </Link>
              ))}
            </Fragment>
          ))}
        </nav>
        <div className="stack" style={{ gap: 2, marginTop: 'auto' }}>
          <div className="side-link" style={{ color: admin ? '#E7E8EC' : undefined }}>
            <Avatar name={me.name} size={28} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.name}</span>
          </div>
          <button className="side-link" style={{ border: 0, background: 'transparent', textAlign: 'left', color: admin ? '#E7E8EC' : undefined }} onClick={() => signOut(auth)}>
            <Icon name="logout" />Log out
          </button>
        </div>
      </aside>

      <div className="main">
        <DemoNote />
        <div className="topbar">
          <div className="row" style={{ minWidth: 0 }}>
            <span className="mobile-only"><Logo size={28} text={false} /></span>
            <h1 className="h2 page-h" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
          </div>
          <div className="row">
            {student && (
              <>
                <form role="search" className="search" onSubmit={e => { e.preventDefault(); if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`); }}>
                  <Icon name="search" size={16} />
                  <input type="search" aria-label="Search" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
                </form>
                <Link to="/notifications" aria-label={`Notifications, ${unread} unread`} className="btn btn-ghost btn-sm" style={{ position: 'relative' }}>
                  <Icon name="bell" size={18} />
                  {unread > 0 && <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 99, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{unread}</span>}
                </Link>
              </>
            )}
            {me.role === 'student' ? (
              <span className={`chip ${me.subscribed ? 'chip-pass' : ''}`}>{me.subscribed ? <><Icon name="shield" size={14} />Subscribed</> : 'Free plan'}</span>
            ) : <span className="chip" style={{ textTransform: 'capitalize' }}>{me.role}</span>}
          </div>
        </div>
        {children}
      </div>

      <nav className="tabbar" aria-label="Tabs" style={{ gridTemplateColumns: `repeat(${tabs.length},minmax(0,1fr))` }}>
        {tabs.map(item => <Link key={item[1]} to={item[1]} aria-current={on(item) ? 'page' : undefined}><Icon name={item[2]} size={22} />{item[0]}</Link>)}
      </nav>
    </div>
  );
}
