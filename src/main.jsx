import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth.jsx';
import App from './App.jsx';
import './index.css';

try { const t = localStorage.getItem('tk-theme'); if (t && t !== 'system') document.documentElement.dataset.theme = t; } catch { /* storage blocked */ }

// One splat route keeps App's own <Routes>; the data router is what makes view transitions possible.
const router = createHashRouter([{ path: '*', element: <AuthProvider><App /></AuthProvider> }]);
// Every in-app page change (links and navigate()) morphs through the View Transitions API where the browser has it, and is instant elsewhere.
const go = router.navigate;
router.navigate = (to, opts) => go(to, typeof to === 'number' || opts?.replace ? opts : { viewTransition: true, ...opts }); // replace = a filter change, not a page change

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
