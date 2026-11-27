import { Fragment } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import { useMe } from './auth.jsx';
import { ProctorOverlay, useProctor } from './ProctorGuard.jsx';
import { Avatar, DemoNote, Icon, Logo } from './ui.jsx';

// group -> [label, path, icon, extra path prefixes that also highlight the item]
export const NAV = {
  admin: [['Manage', [['Overview', '/', 'chart'], ['Courses', '/courses', 'book', ['/course/']], ['Users', '/users', 'users'], ['Payments', '/payments', 'doc']]]],
  trainer: [['Teach', [['Dashboard', '/', 'home'], ['Courses', '/courses', 'book', ['/course/']], ['Tests', '/tests', 'clip'], ['Results', '/results', 'chart'], ['Question bank', '/questions', 'code']]]],
  student: [
    ['Learning', [['Dashboard', '/', 'home'], ['Courses', '/courses', 'book', ['/course/', '/test/', '/solve/']], ['Tests', '/tests', 'clip'], ['Results', '/results', 'chart']]],
    ['Practice', [['Problems', '/problems', 'list', ['/solve/practice/']], ['Daily contest', '/contest', 'flame'], ['Playground', '/playground', 'play'], ['Cheat sheets', '/cheatsheets', 'doc']]],
    ['Community', [['Leaderboard', '/leaderboard', 'trophy'], ['Achievements', '/achievements', 'medal']]],
  ],
};
const TABS = { admin: 4, trainer: 4 }; // phone tab bar shows the first N items (trainers: Dashboard, Courses, Tests, Results); Account (with Log out) is the last tab for staff
export const ACCOUNT = ['Account', '/profile', 'user', ['/settings']]; // profile and settings, opened from the name in the sidebar
const STUDENT_TABS = [['Home', '/', 'home', ['/test/']], ['Learn', '/courses', 'book', ['/course/']], ['Contest', '/contest', 'flame'], ['Search', '/search', 'search'], ['More', '/more', 'more']];

export default function Shell({ title, children, focus }) {
  const me = useMe();
  const { pathname, state } = useLocation();
  const here = pathname.startsWith('/test/') && state?.to ? state.to : pathname; // a test opened from Tests or Results lights up that menu item, not Courses
  const groups = NAV[me.role] || [];
  const all = groups.flatMap(([, items]) => items);
  const admin = me.role === 'admin';
  // the longest matching prefix wins, so /solve/practice/ lights up Problems only, not Courses
  const hit = ([, to, , extra = []]) => Math.max(to === '/' ? (here === '/' ? 1 : 0) : here.startsWith(to) ? to.length : 0, ...extra.map(p => (here.startsWith(p) ? p.length : 0)));
  const best = [...all, ACCOUNT].reduce((b, i) => (hit(i) > hit(b) ? i : b), all[0]);
  const on = item => hit(item) > 0 && hit(item) === hit(best);
  const student = me.role === 'student';
  const tabs = student ? STUDENT_TABS : [...all.slice(0, TABS[me.role]), ACCOUNT];
  const px = useProctor();

  // During a proctored exam the student sees only that test: no menu, and every other route bounces back.
  if (px.testId) {
    const ok = pathname.startsWith(`/solve/${px.courseId}/${px.testId}/`) || (pathname.startsWith('/test/') && pathname.endsWith(`/${px.testId}`));
    if (!ok) return <Navigate to={px.home} replace />;
    if (focus) return <>{children}<ProctorOverlay /></>; // the solving workspace shows the exam state itself
    return (
      <div className="flex min-h-dvh"><div className="grow min-w-0 pt-[30px] px-10 pb-[60px] min-[1700px]:mx-auto max-laptop:pt-6 max-laptop:px-6 max-tablet:pt-[18px] max-tablet:px-4 max-tablet:pb-[110px] [:where(&)_ul]:list-disc max-w-[1280px] m-[0_auto]">
        <div className="rounded-lg border border-warn/20 bg-warn-soft text-warn py-3 px-4 font-semibold text-[14px] flex gap-2.5 items-center mb-4"><Icon name="lock" size={18} />Proctored exam in progress. You can leave only after you submit every question.</div>
        {children}
      </div><ProctorOverlay /></div>
    );
  }

  if (focus) return <>{children}<ProctorOverlay /></>;
  return (
    <div className="flex min-h-dvh">
      <ProctorOverlay />
      <aside className="w-60 shrink-0 sticky top-0 h-screen py-5 px-3 bg-surface border-r border-line flex flex-col gap-4 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--line)_transparent] max-tablet:hidden" aria-label="Sidebar">
        <div className="flex items-center justify-between gap-3 px-2.5 pb-3 border-b border-line">
          <Link className="no-underline" to="/"><Logo size={26} /></Link>
          {admin && <span className="inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap bg-accent-soft text-accent-ink p-[2px_7px] text-[12px]">Admin</span>}
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {groups.map(([g, items]) => (
            <Fragment key={g}>
              <div className={`text-[11px] font-semibold tracking-[.06em] uppercase pt-4 px-2.5 pb-1.5 text-muted`}>{g}</div>
              {items.map(item => (
                <Link key={item[1]} to={item[1]} className="flex items-center gap-2.5 min-h-9 pointer-coarse:min-h-11 px-2.5 rounded-lg no-underline font-medium text-[14px] text-ink-2 transition-[background,color] duration-150 hover:bg-soft hover:text-ink aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-ink aria-[current=page]:font-semibold" aria-current={on(item) ? 'page' : undefined}>
                  <Icon name={item[2]} size={18} />{item[0]}
                </Link>
              ))}
            </Fragment>
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 mt-[auto] pt-3 border-t border-line">
          <Link to="/profile" className="flex items-center gap-2.5 min-h-12 px-2.5 rounded-lg no-underline text-[14px] text-ink-2 transition-[background,color] duration-150 hover:bg-soft hover:text-ink aria-[current=page]:bg-accent-soft" aria-current={on(ACCOUNT) ? 'page' : undefined} title="Profile and settings">
            <Avatar name={me.name} size={30} />
            <span className="flex flex-col min-w-0 leading-tight grow"><span className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-ink">{me.name}</span><span className="text-[12px] text-muted">Profile and settings</span></span>
            <Icon name="gear" size={16} />
          </Link>
          <button className="flex items-center gap-3 min-h-9 pointer-coarse:min-h-11 px-2.5 rounded-lg no-underline font-medium text-[14px] text-ink-2 transition-[background,color] duration-150 hover:bg-soft hover:text-ink [border:0px] bg-transparent text-left" onClick={() => signOut(auth)}>
            <Icon name="logout" size={18} />Log out
          </button>
        </div>
      </aside>

      <div className="grow min-w-0 max-w-[1320px] pt-[30px] px-10 pb-[60px] min-[1700px]:mx-auto max-laptop:pt-6 max-laptop:px-6 max-tablet:pt-[18px] max-tablet:px-4 max-tablet:pb-[110px] [:where(&)_ul]:list-disc">
        <Link to="/" className="hidden max-tablet:flex items-center mb-4 no-underline w-fit" aria-label="Techomato home"><Logo size={24} /></Link>
        <DemoNote />
        <h1 className="sr-only">{title}</h1>
        {children}
      </div>

      <nav className="hidden max-tablet:grid fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line pt-1.5 px-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] max-tablet:[:where(&)_:is(a,button)]:flex max-tablet:[:where(&)_:is(a,button)]:flex-col max-tablet:[:where(&)_:is(a,button)]:items-center max-tablet:[:where(&)_:is(a,button)]:justify-center max-tablet:[:where(&)_:is(a,button)]:gap-[3px] max-tablet:[:where(&)_:is(a,button)]:min-h-[52px] max-tablet:[:where(&)_:is(a,button)]:text-[12px] max-tablet:[:where(&)_:is(a,button)]:whitespace-nowrap max-tablet:[:where(&)_:is(a,button)]:font-medium max-tablet:[:where(&)_:is(a,button)]:no-underline max-tablet:[:where(&)_:is(a,button)]:text-muted max-tablet:[:where(&)_:is(a,button)]:border-0 max-tablet:[:where(&)_:is(a,button)]:bg-transparent max-tablet:[:where(&)_[aria-current=page]]:text-accent max-tablet:[:where(&)_[aria-current=page]]:font-semibold" aria-label="Tabs" style={{ gridTemplateColumns: `repeat(${tabs.length},minmax(0,1fr))` }}>
        {tabs.map(item => <Link key={item[1]} to={item[1]} aria-current={on(item) ? 'page' : undefined}><Icon name={item[2]} size={22} />{item[0]}</Link>)}
      </nav>
    </div>
  );
}
