import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

const brandTitle = import.meta.env.DEV ? 'iClaw-理财客-dev' : 'iClaw-理财客';
document.title = brandTitle;

const themeMode = localStorage.getItem('iclaw-theme-mode');
if (themeMode === 'dark') {
  document.documentElement.classList.add('dark');
} else if (themeMode === 'light') {
  document.documentElement.classList.remove('dark');
} else {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}

createRoot(document.getElementById('root')!).render(<App />);
