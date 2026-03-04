import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

const brandTitle = import.meta.env.DEV ? 'iClaw-理财客-dev' : 'iClaw-理财客';
document.title = brandTitle;

createRoot(document.getElementById('root')!).render(<App />);
