import { Fragment, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db, list } from './firebase.js';
import { useMe } from './auth.jsx';
import { ProctorOverlay, useProctor } from './ProctorGuard.jsx';
import { Avatar, DemoNote, Icon, Logo, btn, Chip, H2 } from './ui.jsx';

// group -> [label, path, icon, extra path prefixes that also highlight the item]
export const NAV = {
  admin: [['Manage', [['Overview', '/', 'chart'], ['Courses', '/courses', 'book', ['/course/']], ['Users', '/users', 'users'], ['Payments', '/payments', 'doc']]], ['Account', [['Settings', '/settings', 'gear']]]],
  trainer: [['Teach', [['Dashboard', '/', 'home'], ['Courses', '/courses', 'book', ['/course/']], ['Results', '/results', 'trophy'], ['Question bank', '/questions', 'code'], ['Tests', '/tests', 'clip']]], ['Account', [['Settings', '/settings', 'gear']]]],
  student: [
    ['Learning', [['Dashboard', '/', 'home'], ['Courses', '/courses', 'book', ['/course/', '/test/', '/solve/']], ['Tests', '/tests', 'clip'], ['Results', '/results', 'trophy']]],
    ['Practice', [['Problems', '/problems', 'list', ['/solve/practice/']], ['Daily contest', '/contest', 'flame'], ['Playground', '/playground', 'play'], ['Cheat sheets', '/cheatsheets', 'doc']]],
    ['Community', [['Leaderboard', '/leaderboard', 'trophy'], ['Achievements', '/achievements', 'medal']]],
    ['Account', [['Profile', '/profile', 'user'], ['Notifications', '/notifications', 'bell'], ['Settings', '/settings', 'gear']]],
  ],
};
const TABS = { admin: 4, trainer: 4 }; // phone tab bar shows the first N items; Settings (with Log out) is the last tab for staff
const STUDENT_TABS = [['Home', '/', 'home', ['/test/']], ['Learn', '/courses', 'book', ['/course/']], ['Contest', '/contest', 'flame'], ['Search', '/search', 'search'], ['More', '/more', 'more']];

export default function Shell({ title, children }) {
  const me = useMe();
  const { pathname, state } = useLocation();
  const here = pathname.startsWith('/test/') && state?.to ? state.to : pathname; // a test opened from Tests or Results lights up that menu item, not Courses
  const groups = NAV[me.role] || [];
  const all = groups.flatMap(([, items]) => items);
  const admin = me.role === 'admin';
  // the longest matching prefix wins, so /solve/practice/ lights up Problems only, not Courses
  const hit = ([, to, , extra = []]) => Math.max(to === '/' ? (here === '/' ? 1 : 0) : here.startsWith(to) ? to.length : 0, ...extra.map(p => (here.startsWith(p) ? p.length : 0)));
  const best = all.reduce((b, i) => (hit(i) > hit(b) ? i : b), all[0]);
  const on = item => hit(item) > 0 && hit(item) === hit(best);
  const dark = admin ? { background: 'var(--panel)', color: 'var(--panel-text)', borderRight: 0 } : undefined;
  const linkStyle = item => (admin ? (on(item) ? { background: '#F5F2EC', color: '#17181C' } : { color: 'var(--panel-text)' }) : undefined);
  const student = me.role === 'student';
  const tabs = student ? STUDENT_TABS : [...all.slice(0, TABS[me.role]), all[all.length - 1]];
  const [unread, setUnread] = useState(0);
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
      <div className="flex min-h-dvh"><div className="grow min-w-0 pt-[30px] px-10 pb-[60px] min-[1700px]:mx-auto max-laptop:pt-6 max-laptop:px-6 max-tablet:pt-[18px] max-tablet:px-4 max-tablet:pb-[110px] [:where(&)_ul]:list-disc max-w-[1280px] m-[0_auto]">
        <div className="rounded-[14px] bg-warn-soft text-warn py-3 px-4 font-semibold text-[14px] flex gap-2.5 items-center mb-4"><Icon name="lock" size={18} />Proctored exam in progress. You can leave only after you submit every question.</div>
        {children}
      </div><ProctorOverlay /></div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <ProctorOverlay />
      <aside className="w-64 shrink-0 sticky top-0 h-screen py-[22px] px-4 bg-surface border-r border-line flex flex-col gap-4 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--line)_transparent] max-tablet:hidden" style={dark} data-dark={admin || undefined} aria-label="Sidebar">
        <div className="flex items-center justify-between gap-3 p-[0_8px]">
          <Link className="no-underline" to="/"><Logo dark={admin} /></Link>
          {admin && <span className="inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap bg-rose text-night p-[3px_8px] text-[12px]">Admin</span>}
        </div>
        <nav className="flex flex-col gap-[3px]" aria-label="Main">
          {groups.map(([g, items]) => (
            <Fragment key={g}>
              <div className={`text-[12px] font-bold tracking-[.08em] uppercase pt-2.5 px-3 pb-0.5 ${admin ? 'text-panel-muted' : 'text-muted'}`}>{g}</div>
              {items.map(item => (
                <Link key={item[1]} to={item[1]} className="flex items-center gap-3 min-h-10 pointer-coarse:min-h-11 px-3 rounded-xl no-underline font-medium text-[15px] text-ink transition-[background] duration-150 hover:bg-soft aria-[current=page]:bg-ink aria-[current=page]:text-paper aria-[current=page]:font-semibold" aria-current={on(item) ? 'page' : undefined} style={linkStyle(item)}>
                  <Icon name={item[2]} />{item[0]}
                </Link>
              ))}
            </Fragment>
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 mt-[auto]">
          <div className="flex items-center gap-3 min-h-10 pointer-coarse:min-h-11 px-3 rounded-xl no-underline font-medium text-[15px] text-ink transition-[background] duration-150 hover:bg-soft aria-[current=page]:bg-ink aria-[current=page]:text-paper aria-[current=page]:font-semibold" style={{ color: admin ? 'var(--panel-text)' : undefined }}>
            <Avatar name={me.name} size={28} dark={admin} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{me.name}</span>
          </div>
          <button className="flex items-center gap-3 min-h-10 pointer-coarse:min-h-11 px-3 rounded-xl no-underline font-medium text-[15px] text-ink transition-[background] duration-150 aria-[current=page]:bg-ink aria-[current=page]:text-paper aria-[current=page]:font-semibold [border:0px] bg-transparent text-left" style={{ color: admin ? 'var(--panel-text)' : undefined }} onClick={() => signOut(auth)}>
            <Icon name="logout" />Log out
          </button>
        </div>
      </aside>

      <div className="grow min-w-0 max-w-[1320px] pt-[30px] px-10 pb-[60px] min-[1700px]:mx-auto max-laptop:pt-6 max-laptop:px-6 max-tablet:pt-[18px] max-tablet:px-4 max-tablet:pb-[110px] [:where(&)_ul]:list-disc">
        <DemoNote />
        <div className="flex justify-between items-center gap-4 mb-[26px]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden max-tablet:inline-flex"><Logo size={28} text={false} /></span>
            <H2 as="h1" className="text-[clamp(30px,3.4vw,40px)] overflow-hidden text-ellipsis">{title}</H2>
          </div>
          <div className="flex items-center gap-3">
            {student && (
              <>
                <Link to="/notifications" aria-label={`Notifications, ${unread} unread`} className={btn('ghost', 'sm', 'relative')}>
                  <Icon name="bell" size={18} />
                  {unread > 0 && <span className="absolute top-0.5 right-0.5 min-w-4.5 h-4.5 rounded-[99px] bg-accent text-on-accent text-[12px] font-bold grid place-items-center">{unread}</span>}
                </Link>
              </>
            )}
            {me.role === 'student' ? (
              <Chip as="span" className={`${me.subscribed ? 'bg-pass-soft! text-pass!' : ''}`}>{me.subscribed ? <><Icon name="shield" size={14} />Subscribed</> : 'Free plan'}</Chip>
            ) : <Chip as="span" className="[text-transform:capitalize]">{me.role}</Chip>}
          </div>
        </div>
        {children}
      </div>

      <nav className="hidden max-tablet:grid fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line pt-1.5 px-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] max-tablet:[:where(&)_:is(a,button)]:flex max-tablet:[:where(&)_:is(a,button)]:flex-col max-tablet:[:where(&)_:is(a,button)]:items-center max-tablet:[:where(&)_:is(a,button)]:justify-center max-tablet:[:where(&)_:is(a,button)]:gap-[3px] max-tablet:[:where(&)_:is(a,button)]:min-h-[52px] max-tablet:[:where(&)_:is(a,button)]:text-[12px] max-tablet:[:where(&)_:is(a,button)]:whitespace-nowrap max-tablet:[:where(&)_:is(a,button)]:font-medium max-tablet:[:where(&)_:is(a,button)]:no-underline max-tablet:[:where(&)_:is(a,button)]:text-muted max-tablet:[:where(&)_:is(a,button)]:border-0 max-tablet:[:where(&)_:is(a,button)]:bg-transparent max-tablet:[:where(&)_[aria-current=page]]:text-accent max-tablet:[:where(&)_[aria-current=page]]:font-semibold" aria-label="Tabs" style={{ gridTemplateColumns: `repeat(${tabs.length},minmax(0,1fr))` }}>
        {tabs.map(item => <Link key={item[1]} to={item[1]} aria-current={on(item) ? 'page' : undefined}><Icon name={item[2]} size={22} />{item[0]}</Link>)}
      </nav>
    </div>
  );
}
