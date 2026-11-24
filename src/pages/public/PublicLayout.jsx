import { Link } from 'react-router-dom';
import { Logo, btn } from '../../ui.jsx';

export function PublicNav({ onJump }) {
  return (
    <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur-[10px] border-b border-line">
      <div className="max-w-[1280px] mx-auto h-[76px] px-6 flex items-center justify-between gap-4">
        <Link className="no-underline" to="/" aria-label="Techomato home"><Logo /></Link>
        <nav className="flex gap-8 font-medium max-tablet:hidden [:where(&)_a]:no-underline [:where(&)_a]:cursor-pointer [:where(&)_a:hover]:text-accent" aria-label="Main">
          {onJump && <><a href="#/" onClick={onJump('loop')}>How it works</a><a href="#/" onClick={onJump('results')}>Results</a></>}
          <Link to="/pricing">Pricing</Link>
          <Link to="/for-institutes">For institutes</Link>
          <Link to="/help">Help</Link>
        </nav>
        <Link to="/login" className={btn('ink')}>Log in</Link>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="max-w-[1280px] mx-auto px-6">
      <div className="border-t border-line py-8 mt-10 [:where(&)_nav_a]:inline-flex [:where(&)_nav_a]:items-center [:where(&)_nav_a]:min-h-11 flex items-center justify-between gap-3 text-[13px] text-muted flex-wrap">
        <Logo size={24} />
        <nav className="flex items-center gap-5.5 flex-wrap" aria-label="Footer">
          <Link to="/pricing">Pricing</Link><Link to="/for-institutes">For institutes</Link><Link to="/help">Help</Link>
          <Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
        </nav>
        <span>© {new Date().getFullYear()} Techomato Education</span>
      </div>
    </footer>
  );
}

export const PublicPage = ({ children }) => (
  <div><PublicNav /><main className="max-w-[1280px] mx-auto p-[56px_24px_40px]">{children}</main><Footer /></div>
);
