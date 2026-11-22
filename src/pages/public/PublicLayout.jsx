import { Link } from 'react-router-dom';
import { Logo } from '../../ui.jsx';

export function PublicNav({ onJump }) {
  return (
    <header className="m-nav">
      <div className="m-nav-in">
        <Link to="/" aria-label="Techomato home" style={{ textDecoration: 'none' }}><Logo /></Link>
        <nav className="m-links" aria-label="Main">
          {onJump && <><a href="#/" onClick={onJump('loop')}>How it works</a><a href="#/" onClick={onJump('results')}>Results</a></>}
          <Link to="/pricing">Pricing</Link>
          <Link to="/for-institutes">For institutes</Link>
          <Link to="/help">Help</Link>
        </nav>
        <Link to="/login" className="btn btn-ink">Log in</Link>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="wrap">
      <div className="foot between small muted" style={{ flexWrap: 'wrap' }}>
        <Logo size={24} />
        <nav className="row" aria-label="Footer" style={{ gap: 22, flexWrap: 'wrap' }}>
          <Link to="/pricing">Pricing</Link><Link to="/for-institutes">For institutes</Link><Link to="/help">Help</Link>
          <Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
        </nav>
        <span>© {new Date().getFullYear()} Techomato Education</span>
      </div>
    </footer>
  );
}

export const PublicPage = ({ children }) => (
  <div><PublicNav /><main className="wrap" style={{ padding: '56px 24px 40px' }}>{children}</main><Footer /></div>
);
