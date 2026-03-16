import { createRoot } from 'react-dom/client';
import App from './app/App';
import { applyBrandTheme, BRAND } from './app/lib/brand';
import { applyThemeMode, readStoredThemeMode } from './app/lib/theme';
import './styles/index.css';

if (
  window.location.protocol.startsWith('http') &&
  window.location.hostname === 'localhost' &&
  window.location.port === '1520'
) {
  const nextUrl = new URL(window.location.href);
  nextUrl.hostname = '127.0.0.1';
  window.location.replace(nextUrl.toString());
}

applyBrandTheme();
document.title = import.meta.env.DEV ? BRAND.devWebsiteTitle : BRAND.websiteTitle;
applyThemeMode(readStoredThemeMode());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (readStoredThemeMode() === 'system') {
    applyThemeMode('system');
  }
});

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.DEV) {
  const existingHost = document.getElementById('agentation-root');
  const agentationHost = existingHost ?? document.createElement('div');

  if (!existingHost) {
    agentationHost.id = 'agentation-root';
    document.body.append(agentationHost);
  }

  void import('./app/components/DevAgentation')
    .then(({ mountDevAgentation }) => {
      mountDevAgentation(agentationHost);
    })
    .catch((error) => {
      console.error('failed to mount agentation in dev', error);
    });
}
