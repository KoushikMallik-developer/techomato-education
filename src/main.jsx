import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './auth.jsx';
import App from './App.jsx';
import './index.css';

try { const t = localStorage.getItem('tk-theme'); if (t && t !== 'system') document.documentElement.dataset.theme = t; } catch { /* storage blocked */ }

createRoot(document.getElementById('root')).render(
  <HashRouter><AuthProvider><App /></AuthProvider></HashRouter>
);
