import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { GlobalToastViewport } from './app/components/GlobalToastViewport';
import { applyBrandTheme, BRAND } from './app/lib/brand';
import { bootstrapDesktopConfigStore } from './app/lib/persistence/config-store';
import { dismissAppNotification, useAppNotifications } from './app/lib/task-notifications';
import { applyThemeMode, readStoredThemeMode } from './app/lib/theme';
import './styles/index.css';

const IS_TAURI_RUNTIME = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const SHOW_DEV_BRANDING = !IS_TAURI_RUNTIME && import.meta.env.DEV;

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
document.title = SHOW_DEV_BRANDING ? BRAND.devWebsiteTitle : BRAND.websiteTitle;

function DesktopRoot() {
  const notifications = useAppNotifications();
  const notificationTimerIdsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const activeIds = new Set(notifications.map((item) => item.id));

    notifications.forEach((notification) => {
      if (notificationTimerIdsRef.current[notification.id]) {
        return;
      }
      notificationTimerIdsRef.current[notification.id] = window.setTimeout(() => {
        dismissAppNotification(notification.id);
        delete notificationTimerIdsRef.current[notification.id];
      }, 4200);
    });

    Object.entries(notificationTimerIdsRef.current).forEach(([id, timerId]) => {
      if (activeIds.has(id)) {
        return;
      }
      window.clearTimeout(timerId);
      delete notificationTimerIdsRef.current[id];
    });

    return () => {
      Object.values(notificationTimerIdsRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      notificationTimerIdsRef.current = {};
    };
  }, [notifications]);

  return (
    <div className="relative h-screen overflow-hidden">
      <App />
      <GlobalToastViewport notifications={notifications.slice(0, 3)} onDismiss={dismissAppNotification} />
    </div>
  );
}

async function bootstrapApp() {
  await bootstrapDesktopConfigStore();
  applyThemeMode(readStoredThemeMode());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readStoredThemeMode() === 'system') {
      applyThemeMode('system');
    }
  });

  createRoot(document.getElementById('root')!).render(<DesktopRoot />);

  if (SHOW_DEV_BRANDING) {
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
}

void bootstrapApp();
